# api-contract.md — Mark it!（本地桌面应用，renderer↔主进程契约，无 HTTP API）

## 1. markitHost（preload contextBridge 暴露，contextIsolation:true，sandbox:true）
| 方法 | 签名 | 语义 |
|---|---|---|
| persist | `markitHost.persist(json: string): void` | 全量覆盖式：把 `JSON.stringify(notes)` 落盘。notes 为对象数组 `{id,text,priority(0-3),createdAt}`。fire-and-forget（ipcRenderer.send），失败静默 |
| setCollapsed | `markitHost.setCollapsed(collapsed: boolean): void` | 联动窗口尺寸：true→260×48（左上角锚定），false→360×640 |

## 2. 初始数据注入：window.__MARKIT_NOTES__
- 主进程通过自定义特权协议 `markit://app/index.html` 返回 index.html，在 `<body>` 开头注入 `window.__MARKIT_NOTES__ = <文件里的笔记数组>`。
- renderer 的 loadNotes() 逻辑：**localStorage('markit_notes') 优先，为空才读 __MARKIT_NOTES__**（前端已实现，无需改动）。

## 3. 数据持久化位置
- 笔记文件：`app.getPath('userData')/markit-notes.json`（打包后为 `~/Library/Application Support/Mark it!/markit-notes.json`；开发态目录名为 markit）
- 窗口状态（F9）：同目录 `window-state.json`（x/y/collapsed）
- 双通道说明：localStorage（Electron 内持久，随 userData 分区）+ 主进程文件互为备份；文件仅在 localStorage 为空时作为初始源，之后以 renderer 每次全量覆盖为准。

## 4. 构建与运行
- 开发：`npm start`（需先 `npm install`）
- 打包：`npm run dist` → `dist/Mark it!-1.0.0-arm64.dmg`（electron-builder，mac dmg arm64，identity:null 免签名）

## 5. 对齐风险提示（给前端）
- persist 为**全量覆盖式**：renderer 每次操作后调 persist（现状已如此），不存在增量冲突；单人单实例（主进程有 single instance lock）无并发丢数据风险。
- `id` 用 `Date.now().toString(36)+random`，理论可碰撞但单机低频操作可忽略。
- 若未来直接手改 `markit-notes.json`：只有当 Electron localStorage 同键为空时才会生效，需同时清 localStorage。
