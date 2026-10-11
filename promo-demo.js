'use strict';
/* promo-demo.js — Mark it! 宣传片演出驱动器（独立于原 app，不改其源码）
 * 两种运行模式：
 *   默认      ：真实窗口显示 + 置顶（供系统录屏）
 *   --offscreen：离屏渲染，paint 事件逐帧落 JPEG（零录屏权限），配合 framegrab 合成
 * 用法：npx electron promo-demo.js [--dark] [--offscreen]
 */

const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const SIZE_EXPANDED = { width: 360, height: 640 };
const SIZE_COLLAPSED = { width: 128, height: 40 };
const DEMO_USERDATA = path.join(__dirname, 'demo-userdata');

const args = process.argv.slice(2);
const START_DARK = args.includes('--dark');
const OFFSCREEN = args.includes('--offscreen');
// 可选参数：--seq=<file> 演出序列脚本（默认 promo-seq.js）；--frames=<dir> 帧目录（默认 promo-frames）
const SEQ_ARG = args.find(a => a.startsWith('--seq='));
const SEQ_FILE = SEQ_ARG ? SEQ_ARG.slice(6) : 'promo-seq.js';
const FRAMES_ARG = args.find(a => a.startsWith('--frames='));
const FRAME_DIR = path.join(__dirname, FRAMES_ARG ? FRAMES_ARG.slice(9) : 'promo-frames');

// localStorage 按 userData 分区存储：必须 ready 前改路径，与真实应用数据完全隔离
app.setPath('userData', DEMO_USERDATA);

// 无 GUI 权限环境兜底：绕过 Chromium sandbox（CI/沙箱内可跑通渲染）
app.commandLine.appendSwitch('no-sandbox');
if (!OFFSCREEN) app.commandLine.appendSwitch('disable-gpu');   // offscreen 需软件光栅，不禁 GPU
app.commandLine.appendSwitch('disable-dev-shm-usage');

let win = null;
let frameIdx = 0;
let recT0 = null;   // 帧时间戳基准（ms），演出启动时置位

function applySize(collapsed) {
  const size = collapsed ? SIZE_COLLAPSED : SIZE_EXPANDED;
  win.setSize(size.width, size.height);
}

app.whenReady().then(() => {
  fs.mkdirSync(DEMO_USERDATA, { recursive: true });
  nativeTheme.themeSource = START_DARK ? 'dark' : 'light';

  win = new BrowserWindow({
    width: SIZE_EXPANDED.width,
    height: SIZE_EXPANDED.height,
    x: 1060, y: 240,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: !OFFSCREEN,
    backgroundColor: '#F5F4F0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: OFFSCREEN,
      // 非持久化内存分区：每次启动都是空白 localStorage，杜绝上次演出的残留笔记
      partition: 'demotake'
    }
  });

  if (OFFSCREEN) {
    fs.rmSync(FRAME_DIR, { recursive: true, force: true });
    fs.mkdirSync(FRAME_DIR, { recursive: true });
    win.webContents.setFrameRate(30);
    win.webContents.on('paint', (_e, _dirty, image) => {
      if (recT0 === null) return;   // 演出未开始不收帧
      const ts = Date.now() - recT0;
      const name = `f_${String(frameIdx++).padStart(6, '0')}_${String(ts).padStart(7, '0')}.jpg`;
      fs.writeFileSync(path.join(FRAME_DIR, name), image.toJPEG(92));
    });
  } else {
    win.once('ready-to-show', () => {
      win.showInactive(); win.focus();
      win.setAlwaysOnTop(true, 'screen-saver');   // 最高层级：录屏时压过前台 IDE/浏览器
      const b = win.getBounds();
      console.log('[demo] bounds(dip):', JSON.stringify(b),
        'scale:', win.webContents.getZoomFactor(),
        'screenDip:', JSON.stringify(require('electron').screen.getPrimaryDisplay().bounds));
    });
  }
  win.loadFile(path.join(__dirname, 'index.html'));

  // ---- 复刻 main.js 的 IPC 面 ----
  ipcMain.on('markit:persist', (_e, json) => {
    try { fs.writeFileSync(path.join(DEMO_USERDATA, 'markit-notes.json'), String(json)); } catch (e) {}
  });
  ipcMain.on('markit:set-collapsed', (_e, v) => { applySize(Boolean(v)); });
  ipcMain.on('markit:set-pinned', (_e, v) => { win.setAlwaysOnTop(Boolean(v)); });

  win.webContents.once('did-finish-load', () => {
    // 清场：每次演出从空白看板开始（localStorage 为空 → __MARKIT_NOTES__ = [] 兜底）
    win.webContents.executeJavaScript('localStorage.removeItem("markit_notes"); window.__MARKIT_NOTES__ = []; true')
      .then(() => win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, SEQ_FILE), 'utf8')))
      .then(() => {
        if (OFFSCREEN) { recT0 = Date.now(); console.log('[demo] offscreen recording start'); }
        return win.webContents.executeJavaScript('window.__demoStart()');
      })
      .then(r => {
        console.log('[demo] result:', r);
        setTimeout(() => {
          if (OFFSCREEN) console.log('[demo] frames:', frameIdx);
          app.quit();
        }, 1500);
      })
      .catch(err => { console.error('[demo] error:', err); app.exit(3); });
  });

  // 深色切换通道：演出序列设 window.__wantDark，主进程轮询切换 nativeTheme
  const darkPoll = setInterval(() => {
    if (!win) return;
    win.webContents.executeJavaScript('(window.__wantDark === undefined) ? "keep" : window.__wantDark')
      .then(v => {
        if (v === 'dark') nativeTheme.themeSource = 'dark';
        else if (v === 'light') nativeTheme.themeSource = 'light';
      }).catch(() => {});
  }, 300);

  app.on('window-all-closed', () => { clearInterval(darkPoll); app.quit(); });
});
