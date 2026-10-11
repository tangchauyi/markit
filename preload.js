'use strict';
/* contextBridge 安全暴露 markitHost；contextIsolation 开启，renderer 拿不到 Node */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('markitHost', {
  /** 笔记全量 JSON 字符串（覆盖式）落盘到 userData/markit-notes.json */
  persist(json) { ipcRenderer.send('markit:persist', String(json)); },
  /** 联动窗口尺寸：true → 128×40，false → 360×640 */
  setCollapsed(value) { ipcRenderer.send('markit:set-collapsed', Boolean(value)); },
  /** 固定（置顶）开关：true → alwaysOnTop，false → 普通窗口 */
  setPinned(value) { ipcRenderer.send('markit:set-pinned', Boolean(value)); },
  /** 检查更新下载（F31）：下载 GitHub release 资产到临时目录并自动打开安装器；
      返回 Promise<{ok:boolean, path?:string, error?:string}> */
  downloadUpdate(url, name) { return ipcRenderer.invoke('markit:download-update', String(url), String(name)); }
});
