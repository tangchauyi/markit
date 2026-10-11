'use strict';
/* transition-demo.js — 过渡段录制驱动（离屏 paint 落帧，零权限）
 * 加载 transition.html（桌面 mockup → 推进到 Mark it 满屏），did-finish-load 后
 * 300ms 启动收帧，录满 DURATION_MS 后退出。
 * 用法：npx electron transition-demo.js <framesDir> [htmlFile] [durationMs]
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const FRAME_DIR = process.argv[2] || 'transition-frames';
const HTML = process.argv[3] || 'transition.html';
const DURATION = parseInt(process.argv[4] || '5200', 10);

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-renderer-backgrounding');   // 离屏窗口不可见，防动画时钟被节流
// offscreen 需软件光栅（不禁 GPU，与 promo-demo 经验一致：offscreen 分支本就不禁 GPU）

let win = null;
let frameIdx = 0;
let recT0 = null;

app.whenReady().then(() => {
  fs.rmSync(FRAME_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAME_DIR, { recursive: true });

  win = new BrowserWindow({
    width: 360, height: 640,
    frame: false, resizable: false, skipTaskbar: true, show: false,
    backgroundColor: '#14141f',
    webPreferences: { contextIsolation: true, nodeIntegration: false, offscreen: true }
  });
  win.webContents.setFrameRate(60);
  win.webContents.setBackgroundThrottling(false);   // 同上：保证 CSS 动画时钟全速
  win.webContents.on('paint', (_e, _dirty, image) => {
    if (recT0 === null) return;
    const ts = Date.now() - recT0;
    const name = `f_${String(frameIdx++).padStart(6, '0')}_${String(ts).padStart(7, '0')}.jpg`;
    fs.writeFileSync(path.join(FRAME_DIR, name), image.toJPEG(92));
  });

  win.loadFile(path.join(__dirname, HTML));
  win.webContents.once('did-finish-load', () => {
    // 注入与帧时间戳同源的时间基准，rAF 时间轴才与收帧对齐
    win.webContents.executeJavaScript('window.__setT0 && window.__setT0()')
      .then(() => { recT0 = Date.now(); })
      .catch(() => { recT0 = Date.now(); });
    setTimeout(() => { app.quit(); }, DURATION);
  });
});

app.on('window-all-closed', () => app.quit());
