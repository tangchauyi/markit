'use strict';
/* ============================================================
   Mark it! — Electron 主进程
   无边框常驻小窗（360×640 / 收起胶囊 128×40），置顶为可选（图钉按钮控制），
   笔记文件持久化 + 窗口位置记忆。
   ============================================================ */
const { app, BrowserWindow, ipcMain, protocol, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

/* Windows：禁硬件加速。部分 Windows GPU 环境下合成器不可靠，会出现
   透明窗整窗不可见 / 白屏（本应用为小看板，无需 GPU 加速，关掉换兼容性） */
if (IS_WIN) app.disableHardwareAcceleration();

/* ---------- 冒烟模式（MARKIT_SMOKE=1）：自动化断言，供回归验证 ----------
   在无头/受限 CI 环境禁 GPU 与 Chromium 沙箱，并用隔离的临时 userData。 */
if (process.env.MARKIT_SMOKE) {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.disableHardwareAcceleration();
  app.setPath('userData', path.join(require('os').tmpdir(), 'markit-smoke'));
  try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); } catch (e) {}
  // 预置一条含 </script> 的笔记，验证注入转义
  try { fs.writeFileSync(path.join(app.getPath('userData'), 'markit-notes.json'),
    JSON.stringify([{ id: 'seed1', text: 'a</script>b', priority: 0, createdAt: 1 }])); } catch (e) {}
  /* F33：预置「坏状态」——折叠态 + 屏幕外坐标，验证启动恢复必须展开且位置被 clamp */
  try { fs.writeFileSync(path.join(app.getPath('userData'), 'window-state.json'),
    JSON.stringify({ x: 0, y: 99999, collapsed: true, pinned: true })); } catch (e) {}
  /* v1.0.3：主进程未捕获异常 → 直接以非零码退出并打印。
     否则 Electron 弹错误对话框阻塞 CI（截图实锤过），且流程步骤仍显示绿 */
  process.on('uncaughtException', (e) => {
    console.log('SMOKE FAIL: uncaughtException ' + ((e && e.stack) || e));
    app.exit(4);
  });
}

const SCHEME = 'markit';
// 必须在 app ready 之前调用：注册特权 scheme（standard+secure 才有 localStorage）
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

const NOTES_FILE = path.join(app.getPath('userData'), 'markit-notes.json');
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

const SIZE_EXPANDED = { width: 360, height: 640 };
const SIZE_COLLAPSED = { width: 128, height: 40 };
const MIN_EXPANDED = { width: 320, height: 480 };  // F35：展开态最小可用尺寸（低于此顶栏/分区挤压变形）
let savedSize = null;                              // F35：上次展开态自定义尺寸（胶囊态不记录）

function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}
function writeJsonSafe(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch (e) { /* 磁盘失败不崩应用 */ }
}

let notesCache = readJsonSafe(NOTES_FILE, []);
let win = null;
let collapsed = false;
let pinned = false; // 固定（置顶）默认关，由 renderer 图钉按钮控制
let saveStateTimer = null;

/* ---------- 窗口状态（位置 + 收起态 + 自定义尺寸）记忆 ---------- */
function loadWindowState() {
  const s = readJsonSafe(STATE_FILE, null);
  if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) {
    /* F33（v1.0.9）：不再恢复折叠态——胶囊仅 128x40，记忆坐标落在贴边/角落时
       形同「打不开」。每次启动一律展开，位置在 createWindow 里按展开尺寸
       clamp 保证整面板可见；会话内的折叠/展开行为不变。 */
    collapsed = false;
    pinned = !!s.pinned;
    /* F35：恢复展开态自定义尺寸；非法/低于最小尺寸回默认（F33 同款兜底） */
    if (Number.isFinite(s.w) && Number.isFinite(s.h) &&
        s.w >= MIN_EXPANDED.width && s.h >= MIN_EXPANDED.height) {
      savedSize = { width: s.w, height: s.h };
    }
    return { x: s.x, y: s.y };
  }
  return null;
}

function saveWindowState() {
  /* v1.0.3 修复：Windows 真机截图抓到 closed 事件里 getPosition 抛
     "Object has been destroyed"。加销毁守卫，关闭路径不再崩 */
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  /* F35：仅展开态记录自定义尺寸；胶囊 128x40 不算数（展开时用回原尺寸） */
  const [w, h] = win.getSize();
  if (!collapsed && Number.isFinite(w) && Number.isFinite(h) &&
      w >= MIN_EXPANDED.width && h >= MIN_EXPANDED.height) {
    savedSize = { width: w, height: h };
  }
  writeJsonSafe(STATE_FILE, {
    x, y, collapsed, pinned,
    w: savedSize ? savedSize.width : SIZE_EXPANDED.width,
    h: savedSize ? savedSize.height : SIZE_EXPANDED.height
  });
}

function clampToWorkArea(x, y, size) {
  const wa = screen.getPrimaryDisplay().workArea;
  const maxX = wa.x + wa.width - size.width;
  const maxY = wa.y + wa.height - size.height;
  return {
    x: Math.min(Math.max(x, wa.x), Math.max(wa.x, maxX)),
    y: Math.min(Math.max(y, wa.y), Math.max(wa.y, maxY))
  };
}

/* ---------- 自定义协议：注入 window.__MARKIT_NOTES__ 后返回 index.html ---------- */
function registerAppScheme() {
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.pathname !== '/index.html' && url.pathname !== '/') {
      /* v2.0 单文件拆分：回落到磁盘静态资源（assets/**）。
         白名单扩展名 + 归一化后必须落在 __dirname 内，防目录逃逸；行为零变更（原为 404 的仅 assets 路径）。 */
      const MIME = {
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
      };
      const rel0 = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      /* URL pathname 恒为正斜杠，Windows path.sep 为反斜杠——
         归一成 / 再做前缀判断（v1.0.2 修复 Windows 下 assets 全部 404） */
      const relFwd = rel0.replace(/\\/g, '/');
      const file = path.normalize(path.join(__dirname, rel0));
      const ext = path.extname(file).toLowerCase();
      /* 白名单仅限 assets/ 下（QA P2 收紧：原实现覆盖整个 __dirname，node_modules 内文件可被 SERVE） */
      if (MIME[ext] && relFwd.startsWith('assets/') && file.startsWith(__dirname + path.sep)) {
        try {
          return new Response(fs.readFileSync(file), { headers: { 'content-type': MIME[ext] } });
        } catch (e) { return new Response('not found', { status: 404 }); }
      }
      return new Response('not found', { status: 404 });
    }
    let html;
    try { html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'); }
    catch (e) { return new Response('index.html missing', { status: 500 }); }
    // JSON.stringify 一次得到数组字面量；串内 < 转义为 \u003c，既合法 JSON 又防止笔记内容提前闭合 script
    const payload = JSON.stringify(Array.isArray(notesCache) ? notesCache : [])
      .replace(/</g, '\\u003c');
    const ver = JSON.stringify(app.getVersion());
    const inject = '<script>window.__MARKIT_NOTES__ = ' + payload + ';' +
      'window.__MARKIT_VERSION__ = ' + ver + ';</script>';
    html = html.replace('<body>', '<body>' + inject);
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
}

/* ---------- 窗口 ---------- */
function createWindow() {
  const saved = loadWindowState();
  /* F35：展开态用上次自定义尺寸（无则默认）；恢复/默认停靠 clamp 均按实际尺寸算 */
  const size = collapsed ? SIZE_COLLAPSED : (savedSize || SIZE_EXPANDED);
  let pos;
  if (saved) {
    pos = clampToWorkArea(saved.x, saved.y, size);
  } else {
    // 默认停靠主屏右上角
    const wa = screen.getPrimaryDisplay().workArea;
    pos = clampToWorkArea(wa.x + wa.width - size.width - 24, wa.y + 24, size);
  }

  win = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: pos.x,
    y: pos.y,
    frame: false,
    /* F35（v1.0.10）：macOS 无边框窗口 resizable:true 即原生支持边缘拖拽缩放
       （系统级 NSTWindow 行为）；Windows 无边框不支持原生边缘 resize，维持 false */
    resizable: IS_MAC,
    alwaysOnTop: pinned,
    /* 平台化窗口材质（v1.0.1 Windows 修复）：
       - macOS：透明窗 + vibrancy 毛玻璃（原设计）
       - Windows：不透明实底窗。transparent:true 在 Windows 部分 GPU
         下整窗不可见；vibrancy 也是 macOS 专属，不传 */
    transparent: IS_MAC,
    hasShadow: true,
    vibrancy: IS_MAC ? 'under-window' : undefined,
    visualEffectState: IS_MAC ? 'active' : undefined,
    backgroundColor: IS_MAC ? '#00000000' : '#F2F2F7',
    title: 'Mark it!',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => win.show());
  /* F35：按当前形态设最小尺寸（展开 320x480；胶囊锁 128x40）。
     minWidth/minHeight 创建参数与收起态 128x40 冲突，故创建后按态设置 */
  win.setMinimumSize(
    collapsed ? SIZE_COLLAPSED.width : MIN_EXPANDED.width,
    collapsed ? SIZE_COLLAPSED.height : MIN_EXPANDED.height
  );
  /* 兜底：个别 GPU 环境下 ready-to-show 可能不触发，1.5s 后强制显示 */
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); }, 1500);
  if (pinned) win.setAlwaysOnTop(true, 'floating');

  win.loadURL(SCHEME + '://app/index.html');

  // 位置/尺寸变化 → 防抖落盘（F9）
  const scheduleSave = () => {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(saveWindowState, 400);
  };
  win.on('moved', scheduleSave);
  win.on('resized', scheduleSave);
  /* v1.0.3：落盘时机从 closed 挪到 close —— closed 触发时窗口已销毁拿不到坐标；
     close 在销毁前触发，可安全读取最终位置 */
  win.on('close', saveWindowState);
  win.on('closed', () => { win = null; });

  if (process.env.MARKIT_SMOKE) runSmoke();
}

/* ---------- 冒烟断言：注入钩子 / persist / setCollapsed / 尺寸联动 ---------- */
function runSmoke() {
  /* v1.0.2 CI 教训：did-finish-load 不触发 / probe 内 fetch 永久 pending 时，
     断言链不会执行也不会 reject → 进程永挂。全局看门狗 90s 强制退出并报败 */
  let watchdog = setTimeout(() => {
    console.log('SMOKE FAIL: watchdog 90s 超时（did-finish-load 未触发或断言链挂起）');
    app.exit(3);
  }, 90000);
  const fail = (msg) => {
    console.log('SMOKE FAIL: ' + msg);
    if (watchdog) clearTimeout(watchdog);
    app.exit(1);
    throw new Error('SMOKE_ABORT');
  };
  /* F33 断言：预置的坏状态（collapsed:true + 屏幕外 y）恢复后必须展开 + 位置 clamp 进工作区 */
  const rsz = win.getSize();
  const [rpx, rpy] = win.getPosition();
  const rwa = screen.getPrimaryDisplay().workArea;
  console.log('SMOKE restore: ' + rsz[0] + 'x' + rsz[1] + ' @' + rpx + ',' + rpy);
  if (rsz[0] !== 360 || rsz[1] !== 640) fail('F33 启动恢复了折叠态（应一律展开）');
  if (rpx < rwa.x || rpx > rwa.x + rwa.width - 360 ||
      rpy < rwa.y || rpy > rwa.y + rwa.height - 640) fail('F33 恢复位置未被 clamp 到工作区');
  win.webContents.once('did-finish-load', () => setTimeout(() => {
    const probe = `(function () {
      var injected = Array.isArray(window.__MARKIT_NOTES__) && window.__MARKIT_NOTES__.length === 1
        && window.__MARKIT_NOTES__[0].text === 'a</scr' + 'ipt>b';
      var host = window.markitHost;
      var hasHost = !!(host && typeof host.persist === 'function' && typeof host.setCollapsed === 'function');
      var lsOk = false;
      try { localStorage.setItem('mk_smoke', '1'); lsOk = localStorage.getItem('mk_smoke') === '1'; localStorage.removeItem('mk_smoke'); } catch (e) {}
      var hasApp = !!(document.getElementById('app') && document.querySelector('.zone[data-p="0"]'));
      /* v1.0.2：静态资源可加载性（Windows path.sep 回归防护） */
      return Promise.all([
        fetch('markit://app/assets/css/app.css'),
        fetch('markit://app/assets/js/app.js')
      ]).then(function (rs) {
        return { injected: injected, hasHost: hasHost, lsOk: lsOk, hasApp: hasApp,
                 cssOk: rs[0].ok, jsOk: rs[1].ok, raw: String(window.__MARKIT_NOTES__) };
      });
    })()`;
    win.webContents.executeJavaScript(probe).then((r) => {
      console.log('SMOKE renderer: ' + JSON.stringify(r));
      if (!r.injected) { console.log('SMOKE DEBUG raw=' + r.raw); return fail('__MARKIT_NOTES__ 注入失败（含 </script> 转义）'); }
      if (!r.hasHost) return fail('markitHost 未暴露');
      if (!r.lsOk) return fail('自定义 scheme 下 localStorage 不可用');
      if (!r.hasApp) return fail('页面结构缺失');
      if (!r.cssOk) return fail('assets/css/app.css 经 markit:// 加载失败（404？）');
      if (!r.jsOk) return fail('assets/js/app.js 经 markit:// 加载失败（404？）');
      return win.webContents.executeJavaScript(
        'window.markitHost.persist(JSON.stringify([{id:"s1",text:"冒烟</scr' + 'ipt>",priority:0,createdAt:1}]))'
      ).then(() => new Promise((res) => setTimeout(res, 400)));
    }).then(() => {
      if (!win) return fail('窗口提前销毁');
      const saved = readJsonSafe(NOTES_FILE, null);
      const persistOk = saved && saved.length === 1 && saved[0].text === '冒烟</scr' + 'ipt>';
      console.log('SMOKE persist: ' + persistOk + ' -> ' + JSON.stringify(saved));
      if (!persistOk) return fail('persist 落盘失败');
      return win.webContents.executeJavaScript('window.markitHost.setCollapsed(true)')
        .then(() => new Promise((res) => setTimeout(res, 300)));
    }).then(() => {
      if (!win) return fail('窗口提前销毁');
      const c = win.getSize();
      console.log('SMOKE collapsed: ' + c[0] + 'x' + c[1] + ' pass=' + (c[0] === 128 && c[1] === 40));
      if (c[0] !== 128 || c[1] !== 40) return fail('收起尺寸不符');
      return win.webContents.executeJavaScript('window.markitHost.setCollapsed(false)')
        .then(() => new Promise((res) => setTimeout(res, 300)));
    }).then(() => {
      if (!win) return fail('窗口提前销毁');
      const e = win.getSize();
      console.log('SMOKE expanded: ' + e[0] + 'x' + e[1] + ' pass=' + (e[0] === 360 && e[1] === 640));
      if (e[0] !== 360 || e[1] !== 640) return fail('展开尺寸不符');
      /* F35：手动缩放被接受 + 低于最小尺寸被钳制 + 尺寸落盘
         （macOS resize 带动画，getSize 前需等动画结束，否则读到中间帧） */
      win.setSize(400, 700);
      return new Promise((res) => setTimeout(res, 300)).then(() => {
        const r1 = win.getSize();
        console.log('SMOKE resize: ' + r1[0] + 'x' + r1[1] + ' pass=' + (r1[0] === 400 && r1[1] === 700));
        if (r1[0] !== 400 || r1[1] !== 700) return fail('F35 自定义尺寸未被接受');
        win.setSize(200, 300);
        return new Promise((res) => setTimeout(res, 300));
      }).then(() => {
        const r2 = win.getSize();
        console.log('SMOKE minclamp: ' + r2[0] + 'x' + r2[1] + ' pass=' + (r2[0] === 320 && r2[1] === 480) +
          ' min=' + JSON.stringify(win.getMinimumSize()));
        if (r2[0] !== 320 || r2[1] !== 480) return fail('F35 最小尺寸未钳制');
        saveWindowState();
        const st35 = readJsonSafe(STATE_FILE, null);
        const persist35 = st35 && st35.w === 320 && st35.h === 480;
        console.log('SMOKE sizepersist: ' + persist35);
        if (!persist35) return fail('F35 自定义尺寸未落盘');
      /* F35b：收起后再展开，应回到自定义尺寸而非默认 360x640 */
      return win.webContents.executeJavaScript('window.markitHost.setCollapsed(true)')
        .then(() => new Promise((res) => setTimeout(res, 300)))
        .then(() => win.webContents.executeJavaScript('window.markitHost.setCollapsed(false)'))
        .then(() => new Promise((res) => setTimeout(res, 300)))
        .then(() => {
          const e2 = win.getSize();
          console.log('SMOKE reexpand: ' + e2[0] + 'x' + e2[1] + ' pass=' + (e2[0] === 320 && e2[1] === 480));
          if (e2[0] !== 320 || e2[1] !== 480) return fail('F35b 展开未回自定义尺寸');
          console.log('SMOKE DONE ALL PASS');
          clearTimeout(watchdog);
          /* v1.0.3：补测正常关窗路径（close → closed → window-all-closed → quit），
             覆盖 saveWindowState 销毁时序；2s 兑底强退防挂起 */
          try { win.close(); } catch (e) {}
          setTimeout(() => app.exit(0), 2000);
        });
      });
    }).catch((e) => fail(e.message));
  }, 600));
}

/* ---------- renderer ↔ 主进程 IPC（契约见 api-contract.md） ---------- */
ipcMain.on('markit:persist', (_event, json) => {
  try {
    const arr = JSON.parse(String(json));
    if (!Array.isArray(arr)) return;
    notesCache = arr;
    writeJsonSafe(NOTES_FILE, notesCache);
  } catch (e) { /* 非法 JSON 忽略，不影响前端 localStorage */ }
});

ipcMain.on('markit:set-pinned', (_event, value) => {
  if (!win || win.isDestroyed()) return;
  pinned = Boolean(value);
  win.setAlwaysOnTop(pinned, 'floating');
  saveWindowState();
});

ipcMain.on('markit:set-collapsed', (_event, value) => {
  if (!win) return;
  const target = !!value;
  if (target === collapsed) return;
  collapsed = target;
  /* F35：展开用上次自定义尺寸（无则默认）；收起仍锁 128x40 */
  const size = collapsed ? SIZE_COLLAPSED : (savedSize || SIZE_EXPANDED);
  // macOS 无边框 + resizable:false 时直接 setBounds 可能被忽略，先临时放开
  // （mac 自 v1.0.10 起常驻 resizable，此 toggle 对其无害；Windows 仍需）
  win.setResizable(true);
  /* 最小尺寸随形态切换（展开=MIN_EXPANDED 恒定值，而非当前尺寸——否则用户
     缩到 330x500 后再收起展开，最小值会被顶到 330x500 下不去） */
  win.setMinimumSize(
    collapsed ? SIZE_COLLAPSED.width : MIN_EXPANDED.width,
    collapsed ? SIZE_COLLAPSED.height : MIN_EXPANDED.height
  );
  win.setSize(size.width, size.height);        // 左上角锚定，收起后顶栏原位变胶囊
  win.setResizable(IS_MAC);                    // F35：mac 常驻可缩放；Windows 维持不可缩放
  saveWindowState();
});

/* ---------- 检查更新下载（F31 v1.15）：GitHub release 资产 → 临时目录 → 打开安装器 ----------
   renderer 侧 fetch 下载会被 github 资产跨域拦住，所以走主进程。
   安全约束：仅接受 https 且主机在 github 白名单内；文件名仅取 basename 落临时目录。 */
function downloadFileFollowRedirects(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'markit-app' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        downloadFileFollowRedirects(new URL(res.headers.location, url).href, dest, redirects - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
  });
}

ipcMain.handle('markit:download-update', async (_event, url, name) => {
  try {
    const u = new URL(String(url));
    // 白名单：仅 github.com 及其资产/跳转域（objects.githubusercontent.com 等）
    if (u.protocol !== 'https:' || !/(^|\.)github\.com$|githubusercontent\.com$/.test(u.hostname)) {
      throw new Error('host not allowed');
    }
    const safeName = path.basename(String(name || 'update')).replace(/[^\w.\- !()]+/g, '_');
    const dest = path.join(require('os').tmpdir(), 'markit-update-' + safeName);
    await downloadFileFollowRedirects(u.href, dest);
    await shell.openPath(dest);   // dmg 挂载 / exe 触发 NSIS，安装引导交给系统
    return { ok: true, path: dest };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'download failed' };
  }
});

/* ---------- 生命周期 ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

  app.whenReady().then(() => {
    registerAppScheme();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  // 退出兜底：把最近一次缓存再写一次，防最后一条未落盘
  app.on('before-quit', () => { writeJsonSafe(NOTES_FILE, notesCache); saveWindowState(); });

  app.on('window-all-closed', () => app.quit());
}
