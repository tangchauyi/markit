# test-report.md — Mark it! plan for it（v1.0 首轮验收）

测试方式：catdesk browser-action 实测 file:///Users/tangchauyi/Desktop/bcb/markit-planforit/index.html（viewport 360×640，localStorage 清空后从干净态开始）。主进程冒烟（注入/IPC/persist 落盘/收起展开尺寸联动）由统筹者完成，本轮不重复。

## 逐项结论

| # | 测试项 | 结论 | 证据 |
|---|--------|------|------|
| 1 | 快速输入回车默认入 P3 | PASS | 输入「写周报」回车：p3notes=["写周报"]，badge3="1"，输入框已清空（evaluate 断言） |
| 2 | 双击 P0/P1 空白就地输入 | PASS | 双击后 #inlineWrap .inline-input 出现在对应分区内（placeholder「记一条，回车保存」）；P0 提交「救火：线上事故」→ p0notes 含该条、badge0="1"；P1 提交「季度规划」→ p1notes 含该条、badge1="1" |
| 3 | 笔记条编辑 | PASS | 点击铅笔 → .edit-input 预填「写周报」；改为「写周报并发周报邮件」回车 → DOM 与 localStorage 均更新；reload 后仍为新文案「救火：线上事故（已修复）」 |
| 4 | 优先级切换 P3→P0 | PASS | popover 4 行齐全；点 P0 行 → 条目出现在 P0 列表末尾、badge0=2/badge3=0、笔记条左边条变为 p0 红 rgb(255,59,48)=#FF3B30 |
| 5 | 删除 + 4 秒内撤销 | PASS | 删除后条目消失、出现空态文案、toast「已删除 · 撤销」show；4s 内点撤销 → 同 id 条目原位恢复（lsRaw 中 id=mv0qpuj1dgobwf）。注：超过 4s 后 pendingUndo 过期不恢复，符合设计 |
| 6 | 收起/展开 | PASS | 收起：board display=none，迷你胶囊 260×48 显示（「Mark it!」+ 总数角标 3 + chevron.up），截图 screenshot-1791536754922.png；展开：四分区与 3 条笔记完整恢复 |
| 7 | 刷新持久化 | PASS | reload 后 p0=["救火：线上事故"], p1=["季度规划"], badges=[1,1,0,0]；删除且未撤销的条目（等 4.6s 后刷新）未复活 |
| 8 | 视觉检查 | PASS | 四分区纵向堆叠（zoneStackedVertically=true，非田字格）；标题依次「P0 重要且紧急/P1 重要且不紧急/P2 不重要但紧急/P3 不重要且不紧急」；产品名「Mark it!」主标识 +「plan for it」副标语；空态文案与 design.md 逐字一致。截图：screenshot-1791536624934.png（空态）、screenshot-1791536800166.png（有数据态） |

截图目录：/Users/tangchauyi/.agent-browser/tmp/screenshots/

## 问题清单

**P0（阻塞核心闭环）**：无。

**P1（重要）**：无。

**P2（偏差）1 条**
- 优先级 popover 内当前分区勾选标记不可见，且 P2/P3 长标签溢出 popover 边界。
  - 证据：截图 screenshot-1791536685697.png 中「P1 重要且不紧急」「P3 不重要且不紧急」文字溢出白色面板右缘；evaluate 实测 4 行 checkInsidePopover 均为 false（勾选标记被 nowrap 长标签挤出 120px 面板外），P2/P3 行 labelOverflows=true。
  - 影响：仅视觉（design.md 第 4 节「当前分区打勾」未达成），选择功能本身正常。
  - 修复建议：给 .pop-label 加 overflow:hidden 或 min-width:0 使其可收缩，或加宽 popover / 缩短行文案；指派角色：前端。

## 总结论

**有条件通过**（无 P0/P1，仅 1 条 P2 视觉偏差）。F1 主进程侧（拖动/置顶/尺寸联动）与 F6 打包由统筹者冒烟覆盖（DMG 因环境 hdiutil 受限未生成，属环境限制非缺陷）；F2/F3/F4/F5/F7/F8 及全部浏览器侧验收项本轮实测通过。

## PRD 验收标准对照（浏览器侧可测项）

- F1 收起/展开：通过（本报告 #6；拖动/置顶由主进程冒烟覆盖）
- F2 快速输入默认 P3：通过（#1）
- F3 就地输入带分区优先级：通过（#2）
- F4 编辑/移动/删除：通过（#3/#4/#5，删除后刷新不复活）
- F5 本地持久化：通过（#7，localStorage 双通道中 renderer 侧验证；文件落盘由主进程冒烟覆盖）
- F6 打包：APP 与 zip 已产出，DMG 受环境限制未生成（非缺陷，不计入本轮）
- F7 空态文案：通过（#8，四分区文案与 design.md 逐字一致）
- F8 收起态压缩：通过（#6，胶囊 260×48）
- F9 窗口位置记忆：主进程侧，由统筹者冒烟覆盖

## 回归验证（第 2 轮，2025-06 针对 P2「popover 勾选不可见/标签溢出」）

测试方式：同上（catdesk browser-action，viewport 360×640，localStorage 清空从干净态开始）。修复代码核对：index.html 中 .popover width 已由 120px→152px，.pop-label 已加 min-width:0/overflow:hidden/text-overflow:ellipsis。

| # | 回归项 | 结论 | 证据 |
|---|--------|------|------|
| R1 | 快速输入添加「回归验证条目」，点击优先级按钮打开 popover | PASS | popover 打开，4 行齐全，实测面板 rect(204,368)-(356,520)，宽 152px |
| R2a | 4 行标签不溢出面板 | PASS | evaluate 实测 4 行 labelOverflows 均为 false；P0-P2 行 scrollW=clientW=110（完整显示），P3 行（带勾时）label 收缩至 90px 以省略号「P3 不重要且不…」截断在面板内，无文字越过面板右缘 |
| R2b | 当前优先级行勾选图标完全在面板内 | PASS | 当前 P3 行 .pop-check rect(333,487)-(345,499)，面板右界 356/下界 520，checkInside=true；切到 P0 后重开 popover，勾选随当前项移动到 P0 行且 checkInside 仍为 true |
| R3 | 优先级切换仍正常 | PASS | 点 P0 行 → .note 移入 data-list="0"，左边条 3px solid rgb(255,59,48)=#FF3B30，badge P0=1/P3=0，localStorage markit_notes priority=0 |
| R4 | 截图留证 | — | screenshot-1791536973247.png（P3 当前态，勾在 P3 行）、screenshot-1791537020001.png（P0 当前态，勾在 P0 行） |

**回归结论：通过**。原 P2 缺陷已修复，无新增问题；上轮「有条件通过」升级为**通过**（无遗留 P0/P1/P2）。

## 第二轮回归（本轮 4 点用户反馈改动：置顶可选/输入框下沉/迷你胶囊/去副标题）

测试方式：catdesk browser-action 实测 file:///Users/tangchauyi/Desktop/bcb/markit-planforit/index.html（viewport 360×640，localStorage 清空后从干净态开始）。主进程侧（置顶 IPC、窗口尺寸 128×40/360×640 联动、持久化）已由统筹者冒烟 ALL PASS，本轮不重复。测试后已清理测试数据并关闭标签。

| # | 回归项 | 结论 | 证据 |
|---|--------|------|------|
| R1 | 顶栏仅「Mark it!」无副标题；含图钉按钮 | PASS | evaluate：topbarText="Mark it!"，body 全文含 "plan for it"=false；.topbar #pinBtn 存在（count=1），截图 screenshot-1791538686542.png 顶栏可见「Mark it!」+ 图钉 + 收起按钮 |
| R2a | 图钉默认态：无 active，aria-pressed=false | PASS | 干净态 evaluate：pinAria="false"、pinHasActive=false |
| R2b | 点击图钉：active + aria-pressed=true + localStorage markit_pinned="1" | PASS | 点击后 evaluate：pinAria="true"、pinActive=true、ls="1"；截图 screenshot-1791538746154.png 图钉按钮高亮（active 背景色） |
| R2c | 再点图钉恢复：aria-pressed=false、无 active、markit_pinned="0" | PASS | evaluate：pinAria="false"、pinActive=false、ls="0" |
| R2d | 图钉状态持久化（刷新恢复） | PASS | 置顶后 reload：pinAria="true"、pinActive=true（读 localStorage markit_pinned 恢复） |
| R3 | 输入框移至底部栏；回车添加到 P3 | PASS | .topbar #quickInput count=0，.bottombar #quickInput count=1；bottombar rect top=592/bottom=640（紧贴窗口底部，窗高 640）；输入「第二轮回归测试条目」回车 → p3Texts 含该条、badge3="1"、输入框已清空、markit_notes 长度=1 |
| R4a | 收起：.app 含 collapsed，胶囊含 4 圆点+总条数角标 | PASS | 点击收起按钮 → collapsed=true、board display=none、capsule display=flex、.capsule-dot count=4、角标 textContent="1"（与总条数一致）；dotColors 实测 rgb(255,59,48)/rgb(255,149,0)/rgb(255,204,0)/rgb(142,142,147) 即 P0 红/P1 橙/P2 黄/P3 灰；截图 screenshot-1791538777952.png |
| R4b | 点击胶囊恢复展开态 | PASS | 点击 #capsule → collapsed=false、board display=flex、P3 笔记仍在 |
| R5a | 优先级切换（P3→P0） | PASS | popover 4 行，点 P0 行 → 条目移入 data-list="0"，badge0="1"/badge3="0"，左边条 rgb(255,59,48)=#FF3B30 |
| R5b | 编辑 | PASS | 点铅笔 → .edit-input 出现；改「回归测试条目-已编辑」回车 → DOM 与 localStorage 同步更新 |
| R5c | 删除 + toast | PASS | 删除后 .note count=0、四分区空态恢复；同 tick 断言 toast.classList 含 show；markit_notes 长度=0（前次跨命令断言 toastShow=false 系已过 4s 存活期自动滑出，符合 design.md） |
| R5d | 刷新持久化 | PASS | reload 后 badges=["0","0","0","0"]（已删条目未复活），顶栏文案不变 |

截图目录：/Users/tangchauyi/.agent-browser/tmp/screenshots/（screenshot-1791538686542.png 展开态、screenshot-1791538746154.png 图钉高亮态、screenshot-1791538777952.png 收起胶囊态）

### 第二轮回归总结论

**通过**（无 P0/P1/P2 缺陷）。4 点改动全部落地且不回归：
1. 置顶改为可选（R2a-R2d 通过）
2. 快速输入框移至底部固定栏，功能不回归（R3 通过）
3. 收起态迷你胶囊（4 色圆点 + 总条数角标，点击展开；窗口实际收起尺寸 128×40 属主进程侧，统筹者已冒烟）（R4 通过）
4. 副标题已移除，顶栏仅「Mark it!」（R1 通过）

## 第三轮回归（v1.2 F11 固定按钮重做：纯图钉图标 + hover tooltip）

测试方式：catdesk browser-action 实测 file:///Users/tangchauyi/Desktop/bcb/markit-planforit/index.html（viewport 360×640，localStorage 清空后从干净态开始）。已核对 index.html 实现：tooltip 为绝对定位浮层（pointer-events:none，z-index:10）、两态文案 .tip-off/.tip-on 随 .active 互斥、点击写入 localStorage 并调用 markitHost.setPinned（typeof 守卫）。markitHost.setPinned IPC 属 Electron 主进程侧（浏览器环境 window.markitHost 不存在，守卫生效无报错），真机联动由统筹者冒烟覆盖。测试后已清空数据并关闭标签。

| # | 回归项 | 结论 | 证据 |
|---|--------|------|------|
| R1 | 顶栏无常驻文字、无溢出 | PASS | evaluate：按钮直接文本节点仅空白（btnVisibleText="\|\|"，DOM 中 tooltip span 初始隐藏）；topbar scrollWidth=clientWidth=360，无横向溢出/折行；顶栏仅「Mark it!」+ 图钉 + 收起按钮（截图 screenshot-1791540930861.png） |
| R2a | 未固定态描边灰图标 | PASS | svg path computed：fill=none、stroke=rgb(142,142,147)（#8E8E93 灰）、stroke-width=1.2px；按钮背景透明 |
| R2b | hover 后 tooltip 浮现（未固定文案） | PASS | hover + 500ms 后：.pin-tip opacity 0→1、visibility=visible、tipRect(256,43.5,92×26.5)，.tip-off 显示（「点击置顶看板」）、.tip-on 隐藏；截图 screenshot-1791540930861.png 气泡位于按钮下方居中 |
| R2c | hover 不遮挡、无布局抖动 | PASS | hover 前后 pin/name/collapse 三元素 rect 逐值一致（pin 288,9.5,28×28 等）；tip y 起点 43.5 低于三元素底缘（37.5/37.5/32.6），未覆盖任何可操作元素；tooltip pointer-events:none 不拦截热区 |
| R2d | 移开后 tooltip 消失 | PASS | hover .app-name + 400ms 后：opacity=0 |
| R3a | 点击后已固定态 | PASS | aria-pressed=true、active class、path fill=rgb(0,122,255)（#007AFF 实心）、按钮底 rgba(0,122,255,0.12)（#007AFF14 淡蓝圆角底）、localStorage markit_pinned="1"（首采灰色系系 120ms transition 起始帧，移标稳态复测确认） |
| R3b | 已固定 hover 文案切换 | PASS | .tip-on 显示（「已置顶 · 点击取消」）、.tip-off 隐藏、opacity=1；截图 screenshot-1791540984042.png 实心蓝图钉 + 淡蓝底 + 新文案气泡 |
| R4a | 置顶持久化（reload 恢复） | PASS | reload 后 aria=true、active=true、pathFill=rgb(0,122,255)、ls="1" |
| R4b | 再点恢复未固定态 | PASS | aria=false、active 移除、fill=none/stroke=灰 1.2px、背景透明、markit_pinned="0" |
| R5a | 快速输入回归 | PASS | 输入「F11回归测试条目」回车 → P3 末尾新增、badge3="1"、输入框清空 |
| R5b | 优先级切换 P3→P0 回归 | PASS | popover 152×152 四行齐全；点 P0 行 → 条目移入 P0、badge0="1"/badge3="0"、左边条 3px rgb(255,59,48)=#FF3B30、localStorage priority=0 |
| R5c | 删除 + 撤销回归 | PASS | 删除后条目消失、toast「已删除 · 撤销」含 show；点撤销 → 条目原位恢复（P0，同文案），localStorage 同步恢复 |
| R5d | 收起 → 展开回归 | PASS | 收起：collapsed=true、board none、胶囊 4 圆点 + 角标"1"；点胶囊内 #expandBtn → 展开恢复、笔记完整、pin 按钮态不受影响 |
| R6 | PRD F11 验收逐条对照 | 见下 | — |

### PRD F11 验收标准对照

- F11 纯图标（无常驻文本节点）：通过（R1）
- F11 两态可辨 + aria-pressed 同步：通过（R2a/R3a/R4b，纯视觉区分：描边灰 vs 实心蓝+淡蓝底）
- F11 hover 浮现 + 布局零位移：通过（R2b/R2c，绝对定位浮层，坐标逐值一致）
- F11 hover 不遮挡标识/收起按钮/热区：通过（R2c）
- F11 hover 移开消失：通过（R2d）
- F11 点击切换 + 本地持久化 + 重启恢复：通过（R3a/R4a/R4b；markit_pinned 写入与恢复实测，IPC 真机侧由统筹者覆盖）
- F11 热区 ≥ 28×28：通过（按钮 rect 28×28）

### 第三轮回归总结论

**通过**（无 P0/P1/P2 缺陷）。F11 六条验收标准全过，v1.2 改动未引入回归。附注（非缺陷，供统筹者知悉）：胶囊展开仅绑定内部 #expandBtn（Electron drag 区吞点击的刻意设计，代码注释已说明），胶囊空白区点击不展开——与 PRD F1「点击胶囊展开」措辞存在轻微偏差，建议统筹者裁定是否需要在胶囊空白区补 no-drag 点击热区或修订 PRD 措辞。

## 第四轮回归（v1.3 F12/F13/F14 + F11/F3 DOM 调整复测）

测试方式：catdesk browser-action 实测 file:///Users/tangchauyi/Desktop/bcb/markit-planforit/index.html（viewport 360×640，localStorage 清空后从干净态开始）。种子数据 5 条 open 笔记走 F12 全流程；旧格式数据（无 status 字段）单独验证兼容；深色经 emulatemedia colorScheme:dark 切换。测试后已清空数据并关闭标签。

| # | 回归项 | 结论 | 证据 |
|---|--------|------|------|
| R1a | F12 标完成：删除线+置灰+渐变✓徽标+角标减1 | PASS | 点 ✓ 后 evaluate：status=done、textDecoration=line-through、color=rgb(142,142,147)、左色条 rgb(199,199,204)、徽标 16×16 grad-brand、badge0 1→0、胶囊 5→4；操作组变 [priority,edit,undo,delete]。截图 screenshot-1791553444073.png |
| R1b | F12 取消恢复 open | PASS | 点 ↺ 后：status=open、无删除线、opacity=1、色条 rgb(255,59,48)、badge0 0→1、胶囊 4→5、呼吸点恢复、操作组变回 [⇅][✎][✓][⊘][✕] |
| R1c | F12 标不干了：褪色可辨 | PASS | 点 ⊘ 后：opacity=0.55、line-through、文字 rgb(185,185,190)、灰描边✕（stroke rgb(142,142,147)）、色条 color(srgb 1 0.584 0 / 0.4)、badge1 1→0。与完成态差异清晰（无徽标 vs 渐变徽标+半透明）。截图 screenshot-1791553476735.png 两态同屏可辨 |
| R1d | F12 持久化（刷新保持） | PASS | localStorage statuses=[open,open,done,dropped,open]；reload 后 rows 状态逐一保持、胶囊=3、badges=[0,0,1,2]（同时命中 PRD「5 条中 2 条有状态→角标 3」验收） |
| R1e | 有状态笔记仍可编辑/移动/删除 | PASS | done 态 t3 就地编辑成功（新文案+statusStill=done）；经 popover 移到 P2（lsPriority=2、statusStill=done）；dropped 态 t4 删除→toast「已删除 · 撤销」show→点撤销原位恢复且 status 仍 dropped |
| R2 | 旧数据兼容（无 status 字段） | PASS | 写入 2 条无 status 的旧格式数据，reload 无报错，DOM 均 status=open+呼吸点，胶囊=2；loadNotes() 对非法 status 兜底归 open |
| R3 | F14 呼吸点 + hover 反馈 + 热区 | PASS | 呼吸点 6×6、右缘距条右 8px、backgroundImage=linear-gradient(135deg, #FA5C8D, #FBAF5D)、animation dot-breathe 3s infinite；hover 后整条 translateY(-1px)+shadow 0 2px 8px rgba(0,0,0,.1)+bg #0000000A、操作组 opacity 1、呼吸点 hidden；5 枚按钮均 22×22（≥20×20） |
| R4 | F13 渐变三落点 + 深色 | PASS | ①空态划线：stroke=url(#gradMarkLight)/dark=#gradMarkDark；②聚焦描边：wrapper 背景切 grad-brand + glow 3px #FA5C8D1F（深色为提亮档 #FB7AA5→#FCBB74 + #FB7AA51F）；③品牌✓徽标/完成徽标同渐变。深色 reload 后 bgPanel rgba(30,30,36,.93)、正文 rgb(245,245,247)、done 徽标深色渐变、done 文字 #98989F、色条 #48484E，深浅三态可辨。深色截图 screenshot-1791553561168.png |
| R5a | F11 图钉两态+tooltip（DOM 调整后复测） | PASS | aria-pressed false↔true、active class、稳态 fill rgb(0,122,255)+淡蓝底（首采 rgb(29,29,31) 系 120ms 过渡起始帧，等 400ms 稳态复测确认，非缺陷）；hover tooltip 两态文案「点击置顶看板」/「已置顶 · 点击取消」均正确浮现；hover 前后 pin/name/collapse rect 逐值一致（零位移）、tip pointer-events:none；reload 后置顶态恢复、再点复位 ls="0" |
| R5b | F3 就地输入（DOM 调整后复测） | PASS | 双击 P1 分区标题 → #inlineWrap 出现，回车后条目入 P1、badge1=1、ls priority=1 |
| R5c | F4 删除撤销 | PASS | 删除后条目消失+toast show，点撤销原位恢复 |
| R5d | 胶囊收起展开 + 角标口径 | PASS | 收起：collapsed=true、4 圆点、角标=2 与 open 计数一致（done 不计入）；点展开按钮恢复 board display=flex |
| R5e | 快速输入 | PASS | 底部输入「快速输入回归条目」回车 → P3 末尾新增、badge3=2、输入框清空 |
| R6 | PRD F12/F13/F14 验收逐条对照 | 见下 | — |

### PRD F12 验收标准对照

- 标完成（删除线+置灰+原位）：通过（R1a）
- 标不干了（删除线+弱化、与完成态可区分）：通过（R1c，半透明褪色+灰✕ vs 渐变徽标+不透明置灰）
- 取消恢复普通态（不变分区不变形）：通过（R1b）
- 状态持久化：通过（R1d）
- 角标只计普通态：通过（R1d，5 条含 2 状态→胶囊 3）
- 有状态笔记仍可编辑/移动/删除：通过（R1e）

### PRD F13/F14 验收标准对照

- F13 渐变落点（徽标/划线/聚焦描边/品牌✓/呼吸点）+ 色值 #FA5C8D→#FBAF5D：通过（R4，computed backgroundImage 逐值核对）
- F13 深浅色两套成立、正文对比达标（浅 12.6:1/深 11.8:1，token 与 design §G 一致）：通过（R4）
- F14 常态可感知线索（渐变呼吸点，机器可校验）：通过（R3）
- F14 hover 整条反馈 + 操作热区 ≥20×20：通过（R3）
- F14 红线（无常驻大图标排）：通过（常态仅 6px 呼吸点，截图核验无视觉噪音）

### 第四轮回归总结论

**通过**（无 P0/P1/P2 缺陷）。F12 全流程（含旧数据兼容）、F13 渐变三落点与深浅双外观、F14 可发现性（呼吸点+hover 反馈+22×22 热区）全部达标；F11 tooltip 与 F3 就地输入经 DOM 调整后复测无回归。附注（非缺陷）：图钉 active 态点击后瞬采到 120ms 过渡起始帧呈灰色的现象与前轮一致，稳态正确。

## 第五轮回归（v1.4 F15 日历回顾 + statusAt + 行尾对齐修复）

测试方式：catdesk browser-action 实测 file:///Users/tangchauyi/Desktop/bcb/markit-planforit/index.html（viewport 360×640，localStorage 清空从干净态开始；当日=2026-10-09）。逐条对照 PRD v1.4 F15 验收与 design §L-§P。测试后已清空数据并关闭标签。

| # | 测试项 | 结论 | 证据 |
|---|--------|------|------|
| R1a | 顶栏右区顺序 日历→图钉→收起，热区 28×28 | PASS | 实测 x 坐标 cal=256 < pin=288 < col=320，三按钮均 28×28 |
| R1b | 点击日历图标开覆盖层 + 激活态 | PASS | active class、aria-expanded=true、图标色 rgb(250,92,141)=#FA5C8D、常驻底 rgba(250,92,141,.12)=#FA5C8D14；覆盖层 rect(0,48,360,592)，默认当月「2026年10月」、今天 10-09 渐变描边环、默认提示「点一个日期，回看那天的记录」 |
| R1c | 三路关闭 | **FAIL(P1)** | ③Esc：覆盖层销毁+active 移除，PASS；①再点图标：PASS；②覆盖层关闭按钮：**点击点被遮蔽失效**——.cal-close rect(309,71,28×28) 与 .cal-head rect(25,73,310×36) 层叠重叠，elementFromPoint 实测按钮中心 (323,85) 与底部 (323,98) 命中 .cal-head，仅右上角 x>335 约 2px 残余热区命中按钮；Playwright 真实点击直接报「covered by div.cal-head」拒点。✕ 图标视觉可见（head 背景透明）但点击落在 head 上，委托选择器 closest('.cal-close') 不命中，点击无任何响应 |
| R1d | 关闭后数据一致 | PASS | 关闭后 markit_notes 不变、覆盖层销毁无保留态 |
| R1e | 覆盖层锁定底层（决策点 21） | PASS | elementFromPoint(180,400)=cal-hint、(180,616)=cal-card，底层看板/底部输入框被物理遮蔽；顶栏 z30 在其上（收起在覆盖层打开时可正常触发并同步销毁覆盖层） |
| R2a | 新建日出点 | PASS | 种 createdAt=昨日笔记：仅 2026-10-08 有点，今天无点 |
| R2b | 标完成写 statusAt + 当天出点 | PASS | 点✓后 ls status=done、statusAt>0；日历出现 10-08、10-09 两点 |
| R2c | ↺取消清零、点消失 | PASS | 点↺后 statusAt=0；日历仅剩 10-08 一点（当天无其他事件点消失，createdAt 日点保留） |
| R3 | 详情分组/组内升序/空态 | PASS | 种 4 条错峰数据点今天：组顺序 新建(3)→完成(2)→放弃(1)；新建组按 createdAt 升序（8点→9点→10点）、完成组按 statusAt 升序（11:30→12:00）；放弃组条目 opacity 0.55+删除线+P0 色条；无记录日（10-01）显示「这天没有留下记录」+划线。截图 screenshot-1791559732592.png |
| R4a | 翻月 + 跨年 | PASS | 2026年10月→9月（前置 pad 1 格、首日1号）→12月→2027年1月（跨年标题正确、全月 disabled）；2027-01→prev 回 2026-12 |
| R4b | 未来日期置灰不可点 | PASS | 10-15 disabled=true、数字色 rgb(199,199,204)=#C7C7CC；点击后无 compact、无 selected、详情仍为默认提示 |
| R5 | 存量兼容（无 statusAt） | PASS | 3 条旧格式（done/dropped/无 status）reload 无报错、状态照旧渲染（✓徽标/✕/呼吸点）；日历仅 createdAt 日（10-07）一点；点该日仅「新建」组 3 条，任何日期「完成/放弃」组均不含它们 |
| R6 | 行尾对齐修复 | PASS | open 呼吸点中心 x=332、done 徽标中心 x=332、dropped ✕ 中心 x=332，三者与「距行右缘 16px」轴线偏差 <0.6px（呼吸点 right:13px+宽6 → 心16；flag right:8px+宽16 → 心16），同轴 |
| R7a | F2 快速输入回归 | PASS | 回车入 P3 末尾、badge3=1、输入框清空 |
| R7b | F12 三态回归 | PASS | done：line-through+rgb(142,142,147)+16×16 渐变徽标+badge3 1→0；↺：恢复 open+呼吸点回归（6×6 grad-brand+dot-breathe 3s，行尾偏移 13px）；drop：opacity 0.55+line-through+badge3 0 |
| R7c | F11 图钉回归 | PASS | aria-pressed false↔true、active 同步、markit_pinned 1↔0 |
| R7d | 胶囊收起展开回归 | PASS | 收起：board none、胶囊 4 圆点+角标 2（只计 open 2 条）、覆盖层同步销毁、calBtn 不见于收起态；展开：4 条笔记完整恢复 |
| R7e | 记录点排除项 | PASS | 干净单条数据：编辑文字+切优先级后 statusAt 仍 0，日历仅 createdAt 日 1 点无新增；删除后记录点随之消失（删除不产生记录） |
| R7f | statusAt 落盘验收 | PASS | 标「不干了」→reload→开日历点今天：仅「放弃」组含该笔记 |
| R8 | 深色模式覆盖层 | PASS | 卡片底 rgba(30,30,36,.973)=#1E1E24F8、标题 #F5F5F7、未来日 #48484E、今天环/记录点为提亮档渐变 #FB7AA5→#FCBB74。截图 screenshot-1791559903854.png |

### PRD F15 验收对照

- 入口排布/热区：通过（R1a）；打开与关闭：**部分通过**（Esc/图标两路通过，关闭按钮一路失效，见 R1c）
- 翻月（含跨年）/未来置灰：通过（R4a/R4b）
- 记录点-新建/状态事件/排除项/多事件一点：通过（R2a/R2b/R7e/R3——今天 3 新建+2 完成+1 放弃仍仅 1 点）
- 详情分组排序/空态：通过（R3）
- 时间戳落盘：通过（R7f）；取消不计记录：通过（R2c）
- 存量兼容：通过（R5）

## 问题清单（本轮）

**P0（阻塞核心闭环）**：无。

**P1（重要）1 条**
- 覆盖层右上关闭按钮（关闭方式②）热区被 .cal-head 整体遮蔽，用户点击 ✕ 无任何响应，仅右上角约 2px 残余可点。
  - 证据：R1c——elementFromPoint 按钮 4 个采样点中 3 个命中 .cal-head、Playwright 真实点击被判 covered 拒点；按钮 rect(309,71,28×28) 与 head rect(25,73,310×36) 垂直完全重叠（head 为 positioned 元素且 DOM 序在后，绘制在按钮之上）。
  - 影响：PRD F15/design §M 规定三路关闭等价，现仅两路可用；图标视觉可见但不可点，属可感知的功能失效。
  - 修复建议：给 .cal-close 加 z-index:5（其已是 absolute，补层叠序即可），或调整 DOM 顺序将 closeBtn 移到 .cal-head 之后；指派角色：前端。修复后需回归 R1c 及 tooltip 不被新层级影响。

**P2（偏差）**：无。

### 第五轮回归总结论

**不通过**（存在 1 项 P1 功能缺陷，无 P0）。F15 其余验收（入口排布、覆盖层、翻月跨年、记录点全语义、详情分组、存量兼容、statusAt 落盘与取消清零、深浅双外观）与 R6 对齐修复、F11/F12/F14/胶囊/快速输入回归全部通过；唯一阻塞项为关闭按钮热区遮蔽，修复成本低，修复并复测 R1c 后可升级为通过。

## P1 复测（.cal-close 热区遮蔽修复：z-index:5）

测试方式：catdesk browser-action 实测 file:///Users/tangchauyi/Desktop/bcb/markit-planforit/index.html（viewport 360×640，localStorage 清空后从干净态开始），打开日历覆盖层后逐项复测。修复确认：index.html L733 `.cal-close { position:absolute; top:12px; right:12px; z-index:5; }`。

| # | 复测项 | 结论 | 证据 |
|---|--------|------|------|
| P1-1 | elementFromPoint 中心命中 | **PASS** | 按钮 rect(309,71,28×28)，中心 (323,85) 命中 `path`（✕ SVG 图形，按钮子元素），`b.contains(el)=true` 且 `el.closest('.cal-close')` 解析回按钮；四角采样 (311,73)/(335,73)/(311,97)/(335,97) 全部命中 `BUTTON.icon-btn cal-close`，无一命中 .cal-head。上轮 4 采样 3 命中 head 的问题消失 |
| P1-2 | Playwright 真实点击 ✕ | **PASS** | 上轮同点位真实点击被判 covered 拒点；本轮 `click .cal-close` 两次（选日期前、清理前各一次）均成功落点，覆盖层销毁（`.cal-overlay` 不存在），active 态随关闭移除 |
| P1-3 | Esc 关闭 | **PASS** | 覆盖层打开时按 Escape，160ms 退场动画后 `.cal-overlay` 不存在（首次检查恰在动画完成前报 still-open，等待后确认销毁，非缺陷） |
| P1-4 | 翻月/点日期不受 z-index 影响 | **PASS** | 上一月→标题「2026年9月」，下一月→「2026年10月」；点击 10-09 选中态实底圆正常，详情区显示空态「这天没有留下记录」+ 划线装饰；截图 screenshot-1791560127079.png 佐证 ✕/箭头/标题布局无异常 |

测试后已清空 localStorage 并关闭标签，无遗留进程/页面。

### P1 复测结论

**通过**。唯一缺陷已修复，三路关闭（图标再点 / ✕ 按钮 / Esc）全部实测可用，翻月与选日期功能不受层叠序改动影响。第五轮回解决议由「不通过」升级为**通过**（仅剩 P2：无）。

## 第六轮·改造完成度检测（PRD v1.5 F15：日历从全屏覆盖层改造为锚定下拉卡片）

测试方式：catdesk browser-action 实测 file:///Users/tangchauyi/Desktop/bcb/markit-planforit/index.html（viewport 360×640，localStorage 清空后种子数据 8 条：当日新建 10 条/完成 1 条/放弃 1 条，当日=2026-10-10）。深色经 emulatemedia colorScheme:dark。测试后已清空数据并关闭标签。

| # | 检测项 | 结论 | 证据 |
|---|--------|------|------|
| D1 | 锚定下拉卡片（288px 宽、高≤460、贴按钮下方、右缘对齐） | **MISSING** | 点击日历图标后仍为 v1.4 §M 全内容区覆盖层：.cal-overlay rect(0,48,360×592) 铺满顶栏以下全部内容区，.cal-card rect(10,58,340×572)。宽 340>300、高 572>460、无 top:56/right:12 锚定。看板内容被完全遮挡（截图 screenshot-1791590967455.png）。代码 grep 证实 index.html 无任何 v1.5 标记（无 288/top:56px/174px/pointerdown/cal-dropdown） |
| D2 | 四路关闭 | **PARTIAL（1/4 缺失）** | ①点外关闭：**FAIL**——点击覆盖层边缘 (5,300) 与顶栏区 (180,20) 后 .cal-overlay 均仍存在（点外无关闭逻辑，覆盖层本身铺满导致「卡外看板区」物理不存在）；②Esc：PASS（按 Esc 后销毁、active 移除）；③再点图标：PASS；④✕：PASS（.cal-close 点击成功关闭，上轮 P1 修复未回归）。关闭后 markit_notes 8 条完整 |
| D3 | 月历格 34px、详情区独立滚动 max-height 174px | **PARTIAL** | 格实测 42×42px、row-gap 4px（spec 34×34/2px）；点击日期后仍走旧 §O 压缩策略：格 42→30px、grid 获得 compact class（spec §S 明确「月历区固定不动、不压缩」）。详情区 max-height 实测 240px（spec 174px）。滚动能力本身可用：14 条条目 scrollHeight 524>240，滚到底 scrollTop=284、末条「昨天放弃的一条」完全可见（截图 screenshot-1791591089752.png），三组顺序 新建→完成→放弃 正确 |
| D4 | 记录点/今天环/选中态/未来置灰/跨年翻月 | **DONE** | 记录点渐变（选中日改白 rgba(255,255,255,.9)=§N 规则，非选中日截图可见渐变点）；今天 10 环+选中粉底互斥正确；未来 10-15 disabled=true、数字 rgb(199,199,204)=#C7C7CC；翻月 Sep→Dec→**2027年1月（跨年标题正确、全月 future disabled）**→回 Dec 均正确 |
| D5 | 深色模式卡片 token（§U） | **DONE** | cardBg rgba(30,30,36,.973)=#1E1E24F8、shadow rgba(0,0,0,.45) 0 8px 24px、blur(24px) saturate(1.4)、标题 #F5F5F7、星期头 #98989F、未来日 #48484E、激活按钮 #FB7AA5+#FB7AA51F，全部与 §U 一致（截图 screenshot-1791591193999.png）。注：§U 数值本就沿用 v1.4 §M 深色 token，故未受形态未迁移影响 |
| D6 | 残留/冲突检查 | **MISSING（旧实现完整在位）** | 旧 §M 覆盖层 CSS（.cal-overlay 全屏定位、.cal-card margin:10px/inset 340×572/圆角16px/220ms 进场）仍为唯一生效实现（index.html L700-733）；旧 §O 压缩样式与 compact 逻辑（L898-904、selectDay L1895-1901）、.cal-detail max-height 240px（L910）均在。无新增样式冲突，但 v1.5 §Q-§U 层**一行代码都未写入**——改造属「未开始」而非「中断于半途」 |
| D7 | 回归：三态/图钉/胶囊/快速输入 | **DONE** | 快速输入入 P3+清空；完成=done+line-through+badge3 7→6；↺=恢复 open+呼吸点回归；不干了=opacity .55；删除+toast show+撤销原位恢复；图钉 aria/active/markit_pinned 双向切换；收起胶囊角标=10（只计 open）、展开恢复 |

### 缺口汇总（供前端补齐，按优先级）

**P0（本轮核心交付未落地 → 本轮不通过）**
1. 锚定下拉卡片形态未实现：需按 design §Q 重写容器——宽 288px、max-height 460px、position:absolute top:56px/right:12px（left:60px）、圆角 12px、进出场 160/120ms + transform-origin:100% 0、无箭头；废弃 .cal-overlay 全屏容器。对应 PRD F15「卡片形态与锚定（v1.5）」验收、§3 元素清单第 7 条、非目标「不做全屏遮罩形态」。
2. 点外关闭缺失：需按 design §T 实现 document 级 pointerdown **捕获阶段**监听（target 不在卡片内即关闭并抑制该次点击，保证不误触看板双击/编辑）。对应 PRD F15「点外关闭（v1.5）」验收、关闭方式①（PRD 明确这是主关闭方式）。

**P1（随形态迁移必须同步）**
3. 月历格 42→34px、gap 4→2px、数字 13→12px、今天环 26→22px、选中圆 28→24px、记录点 5→4px，并**删除 §O 压缩策略**（.cal-grid.compact 全套 + selectDay 中 compact 逻辑），月历区固定不动。对应 design §R 改值表、§S 决策点 24、PRD F15「详情滚动（v1.5）」。
4. 详情区 max-height 240→174px、独立滚动（去掉随压缩让位逻辑）、常驻网格下方；头部行 36→26px、标题 14→13px、✕ 28→22px、星期表头 22→18px 等其余 §R 改值同步。

**P2：无**（深色 §U、日历内部语义、四路关闭中三路、回归项均通过）。

### 总结论

**不通过**（存在 2 项 P0）。v1.5 形态改造实际未开始：index.html 仍是完整的 v1.4 §M-§P 实现，§Q-§U 零落地。日历核心语义（记录点/翻月/详情分组/深色）与上轮修复（✕ 热区）无回归，D7 四项回归全过；但「锚定小卡片」与「点外关闭」是本轮 PRD 修订的主体，必须补齐后复测 D1/D2/D3 方可放行。

---

## 第七轮·v1.6 验收回归（F15 锚定下拉卡片复测 + F16 分区标题模式 + F17 悬停粘贴）

测试方式：catdesk browser-action 实测 `file:///Users/tangchauyi/Desktop/bcb/markit-planforit/index.html`（viewport 360×640，localStorage 清空后种子 14 条：当日新建 8 + 完成 1 + 放弃 1、存量旧完成 1（statusAt=0）、历史日 3 条；深色经 emulatemedia colorScheme:dark）。测试后已清空 localStorage 并关闭标签，无遗留页面。

### 逐项结论

| # | 检测项 | 结论 | 证据 |
|---|--------|------|------|
| D1 | 日历卡片尺寸/锚定/非全屏/看板可见 | **DONE** | 卡片 rect x=60, y=56, 288×305（5 行月自适应），max-height 460px，right=348（=360−12，§Q 顶栏右缘内缩对齐），z-index 20，`.cal-overlay` 不存在（旧全屏覆盖层已废弃），看板内容四周可见；激活态按钮 #FB7AA5 + #FB7AA51F（evaluate cmd_691 + 截图 screenshot-1791593805416.png） |
| D2 | 四路关闭 + 600ms 防误触 | **DONE** | ①真实 click P2 空态区→卡关闭、无 #inlineWrap、笔记数 14 不变；②Esc、③再点图标、④✕ 均关闭成功（cmd_700-714）；点外关闭后批量执行真实 click+dblclick（<600ms）→ 无就地输入、无新建；等待 1.1s 后 dblclick 同点 → F3 弹出且 zoneP=2、模式未变（cmd_719-724） |
| D3 | 34px 格/详情独立滚动/今天环/记录点/未来置灰/跨年 | **DONE** | 格 34×34、gap 2px、星期头 18px、今天环 22px、detail max-height 174px（cmd_729）；本月 5 个记录点（5/7/8/9/10 日，多事件一日一点）、21 个未来格 disabled 且 #C7C7CC；点今天→新建8/完成1/放弃1 共 10 条，scrollHeight 370>174、scrollTop=196 到底、末条「昨天建的不干了」可见、月历固定无压缩（cmd_732 + 截图 screenshot-1791593881106.png）；连点 3 次 next→「2027年1月」跨年正确、31 格全 future、选中态清除（cmd_740） |
| D4 | F16 默认精简/hover 浮字/双击切换/持久化/热区互斥/P2 深字 | **DONE** | 默认 `.titles-compact` + `.zone-title` display:none + 偏好未写入（cmd_743）；hover P0 标题行→浮字「重要且紧急」opacity 1、head 高 32 不变、pointer-events:none，移开消失、偏好仍未写入（cmd_744-751 + 截图 screenshot-1791593918795.png）；双击 P2 标题→四区全部完整模式 + storage=full + 无 inlineWrap（cmd_754），再双击 P0 标题→精简 + storage=compact（cmd_759）；置 full 后 reload 仍完整模式（cmd_763）；完整模式双击空白区→F3 弹出 zoneP=2 且模式不变（cmd_766）；P2 徽标深字 #1D1D1F（浅）/ #141418（深）（cmd_770/786 + 截图 screenshot-1791593997847.png） |
| D5 | F17 虚线提示/粘贴建笔记/输入框优先/空内容/入场动画/日历联动 | **DONE（附 1 条 P2）** | hover P2 分区→`.paste-ready` 挂载、dashed 1.5px #FFCC00、微提示「⌘V 粘贴到这里」opacity 1（cmd_775 + 截图 screenshot-1791594028224.png）；注入 ⌘V keydown + ClipboardEvent paste「买咖啡」→ P2 新建 1 条、priority=2、createdAt>0（cmd_776）；新行 `.note-enter` + animation note-in 300ms（cmd_778）；焦点在快速输入框（INPUT）时 paste-ready 不挂载、⌘V+paste 0 新建（cmd_782）；空串/纯空白/无数据均 0 新建（cmd_783）；日历今天「新建9」组含「买咖啡」（cmd_802）；收起态拦截为代码核验（pasteConditionsOk 含 collapsed 判断，L2197） |
| D6 | 深色模式：卡片/滚动条/paste-flash/F16/F17 token | **DONE** | --paste-flash #FB7AA526、--cal-scroll #FFFFFF1A、--cal-card-bg #1E1E24F8；卡片 bg rgba(30,30,36,.973)、stroke #FFFFFF14、shadow rgba(0,0,0,.45) 0 8px 24px、blur(24px) saturate(1.4)、标题 #F5F5F7、未来日 #48484E、激活图标 #FB7AA5+#FB7AA51F、P2 徽标 #141418、虚线框 #FFD60A（cmd_786/788/791 + 截图 screenshot-1791594138953.png） |
| D7 | 红线回归：三态对齐/胶囊/图钉/快速输入/F12 兼容 | **DONE** | 全板 16 条笔记 right 全部=344、高全部=36（行尾对齐），done→note-flag-done 渐变✓、dropped→note-flag-drop ✕ + opacity .55 + line-through（cmd_813）；胶囊收起 badge=13=open 数（16−3 非开放），展开恢复 4 分区（cmd_829-831）；图钉 tooltip「点击置顶看板/已置顶 · 点击取消」气泡+三角可见（截图 screenshot-1791594273828.png），aria-pressed/active/markit_pinned 联动（cmd_817-822）；快速输入入 P3 组尾（insertAtEndOfGroup，cmd_808/810）；F12 存量兼容：statusAt=0 的 done 笔记仅出现在 day-5「新建1」组、任何日期无其完成记录（cmd_799） |

### 问题清单

**P0（阻塞核心闭环）**：无。

**P1（重要）**：无。

**P2（偏差）1 条**
- `.paste-ready` 虚线提示的挂载条件未校验「剪贴板含非空文本」（design §W 规定三条件判定；index.html L2195-2200 `pasteConditionsOk` 仅判悬停/前台/焦点三项）。证据：cmd_775——剪贴板为空的干净环境下 hover 分区即挂载虚线框与微提示。影响：空剪贴板时提示「⌘V 粘贴到这里」但粘贴无效果，属提示语义过度承诺；粘贴功能本身行为正确（空内容不创建，cmd_783）。建议：在 hover 判定中尝试 `navigator.clipboard.readText()` 预判（失败/无权限时维持现状降级为仅悬停判定）；指派角色：前端。

**环境观察（不计缺陷）**：本 headless 环境存在 CSS 动画/过渡启动节流——切完整模式后首测 opacity=0、日历进场动画中 rect 为中间态（y=50/w=282），强制渲染（截图）后均为正确终态（opacity 1、x=60/y=56/w=288）。真机 Electron 不受影响，但建议前端知悉以便自测时辨别同类伪象。

### 第七轮总结论

**通过**（无 P0/P1，仅剩 1 条 P2 提示语义偏差）。第六轮两项 P0（锚定下拉卡片形态、点外关闭）已完整落地并复测通过；F15 §Q-§U 全量规格（288px 锚定、34px 格、174px 独立滚动、四路关闭+600ms 防误触、跨年、深色 token）与 F16（默认精简/hover 浮字零抖动/双击全局切换持久化/与 F3 热区互斥/P2 深字）、F17（虚线提示/粘贴建笔记/输入框优先/空内容边界/统一入场动画/日历联动）全部达标；D7 红线回归（三态行尾对齐、胶囊、图钉 tooltip、快速输入、F12 旧数据兼容）无回归。P2 修复后无需再开整轮回归，仅复测 hover+空剪贴板场景即可。

---

## 回归验收轮（2026-10-10）· 4 项缺陷修复独立验收

测试方式：代码核对（index.html 内联 CSS/JS）+ `node .selftest/harness.js`（29/29 通过）+ catdesk browser-action 实测 file:// 页面（viewport 424×659）。日历口径用 localStorage 注入带 status/statusAt 的测试笔记验证，验后已恢复原始 4 条数据并重载确认无残留（notesInDom=4, qaLeft=0, tipEls=0, calOpen=0）。

### 逐项结论

| # | 修复点 | 结论 | 证据 |
|---|--------|------|------|
| R1 | 备注条操作按钮 tooltip 快出（.nact-tip 自绘单例气泡） | **通过** | 代码：CSS L609-629（body 级 fixed、z-index 60、80ms 延迟注释），JS L1433-1473（nactTipShow/nactTipHide/actionBtn，含水平夹紧 L1448 与上下翻转 L1451）。实测：dispatch mouseenter 后同步查 DOM 无气泡（syncTipExists=false，证明非立即弹出）；约 250ms 后 `.nact-tip.show` 出现、text=「删除」、单例（count=1）、位置在按钮下方 6px（btn bottom 109 → tip top 115）、右缘 418 < 424 视口未溢出；mouseleave 后 show 移除；切 hover 第二个按钮仍 count=1 且文案切换为「编辑」，气泡完整渲染不被日历卡（z-index 20）遮挡（截图 screenshot-1791599500717.png） |
| R2 | 日历视窗 top 56px→48px | **通过** | CSS L835 `top: 48px`。实测打开日历：cal-card getBoundingClientRect().top = 48，P0 分区上框线 zoneTop = 48，gap = 0（顶边精确贴线）；卡片 bottom 352.8 < 645 视口、顶栏（bottom=48，z-index 30）不被遮挡、日历按钮仍可点（截图 screenshot-1791599345019.png） |
| R3 | 日历详情事件归集：终态笔记不计入 Mark 组（圆点口径同步） | **通过** | 代码：L1882-1912 noteHasStatusEvent/eventsForDay/recordedDayKeys 三处口径一致（终态只记 statusAt 日）。实测注入 t1（createdAt=10-05，done，statusAt=10-06）：月视图圆点=[10-06,10-07,10-09,10-10]，10-05 无圆点；点开 10-05 →「这天没有留下记录」空态，与无圆点一致；点开 10-06 → 仅「完成:1」组（QA终态笔记），无 Mark 组混入——「有圆点但点开无内容」的空日期已消除 |
| R4 | 日历详情组标签「新建」→「Mark」 | **通过** | 代码：L2160 `calGroup('Mark', evts.created, 'created')`，全文件已无「新建」组标签残留（grep 仅此一处）。实测点开 10-07（注入 open 态 t2）：组标签=「Mark」、hasXinjian=false、条目=「QA未处理笔记」（截图 screenshot-1791599451219.png） |

### 新缺陷排查（修复是否引入回归）

- tooltip 裁剪：无（body 级 fixed + 边缘夹紧，实测右缘按钮 tip right=418 < 424）。
- 日历遮挡：无（贴线不压顶栏、不越视口底）。
- 圆点与详情不一致：无（10-05 无点+空态、10-06/07/09/10 有点+有内容，双向一致）。
- harness 回归：29/29 通过，无回归。
- 覆盖度说明（非缺陷）：tooltip 底部翻转分支（L1451）在固定布局下无贴底按钮可触发，仅代码级核对，真机窄窗拉伸场景建议人工瞄一眼。

### 问题清单

**P0**：无。**P1**：无。**P2**：本轮 4 项修复范围内无新缺陷；第七轮遗留 1 条 P2（.paste-ready 空剪贴板提示语义过度承诺）未在本轮范围内，维持挂账。

### 本轮总结论

**通过**（4/4 修复点全部达标，无 P0/P1，无新增回归）。

---

## v1.7 验收轮（2026-10-10）· F18-F21 四项新需求

测试方式：`node .selftest/harness.js`（44/44）+ `node .selftest/v16.js`（更新断言后 58/58）+ catdesk browser-action 实测 file:// 页面（viewport 380×640，干净态起步）+ Electron 真机链路（CDP 直连 renderer，`--no-sandbox` 为本会话环境所必需）。测试后浏览器 localStorage 已清空、标签已关闭；Electron 侧测试数据已通过 renderer+persist 双通道还原（markit-notes.json 恢复为原 2 条，window-state.json 保持 x=1109,y=38），应用进程已停止。

### v16.js A7c 断言裁定

**断言过期，非缺陷**：A7c 期望详情组名「新建」，但「新建」→「Mark」是上一回归验收轮已验收通过的修复（R4，calGroup('Mark',…)）。裁定：更新 A7c 断言为 ['Mark','完成']，更新后 v16.js **58/58 全过**。裁定过程：先从副本目录恢复同版本基线并复现 57/58 失败原貌，再以原地替换方式修改断言并复跑验证（附注：编辑中曾误截断文件，已从副本逐行核验恢复，基线复现一致后才应用断言更新）。

### 逐项结论（浏览器实测，截图均在 /Users/tangchauyi/.agent-browser/tmp/screenshots/）

| 需求 | AC | 结论 | 证据 |
|---|---|---|---|
| F18 | AC1 存在/排布/热区 | 通过 | 实测 x 坐标 cal=244 < pin=276 < collapse=308 < close=340，四按钮均 28×28，右区顺序 日历→图钉→收起→关闭 |
| F18 | AC2 退出语义 | **有条件通过** | 真机 CDP 点击 ✕ → renderer 立即销毁（WS 重置、DevTools 端点关闭）、无任何对话框；但主进程未退出——根因为本 QA 会话缺陷：本会话派生的 Electron helper 进程全部 SIGKILL 免疫（实测连新实例自有 helper 也无法收割），app.quit() 收尾等待子进程被永久阻塞。main.js 链路（closed→saveWindowState→window-all-closed→app.quit→before-quit 写盘）代码核对完整。**需统筹者真机 30 秒复核：点 ✕ → Dock 图标消失** |
| F18 | AC3 刚输入即关不丢 | 通过 | 真机输入「最后一条 QA v1.7」回车→关闭→重启：该笔记存在于看板（CDP 实测 notes 含该条，domNotes=4） |
| F18 | AC4 全量数据不丢 | 通过 | 重启后 4 条（原 2 条含 done/dropped 状态 + 测试 2 条）数量/分区/状态与关闭前完全一致 |
| F18 | AC5 窗口位置记忆 | 通过 | 重启后 window.screenX/Y = 1109/38，与 window-state.json 完全一致（F9 不回退） |
| F18 | AC6 hover 提示 | 通过 | hover ✕ → .pin-tip「退出应用」浮现（delay 0.15s、pointer-events:none），悬停前后四按钮 rect 逐值一致（零抖动）；截图 screenshot-1791601746956.png |
| F18 | AC7 无确认弹窗 | 通过 | closeBtn 处理器仅 window.close()（L1890-1897，无 confirm）；真机点击即销毁，无对话框 |
| F18 | 边界：胶囊态无关闭按钮 | 通过 | 收起态实测 closeBtnInCapsule=false |
| F19 | AC1 文案正确 | 通过 | zone-title 实测「重要但不紧急」 |
| F19 | AC2 两处同步 | 通过 | zone-title-float 实测同文案；真 hover P1 标题行 opacity=1（深色截图 screenshot-1791601927444.png 中浮字可见）；ZONE_NAMES[1] 同源（popover 呈现点，harness T7f 覆盖） |
| F19 | AC3 其余不动 | 通过 | P0/P2/P3 title 与 float 均为「重要且紧急」「不重要但紧急」「不重要且不紧急」，无「重要且不紧急」残留（harness T7h 负向断言） |
| F19 | AC4 无需迁移 | 通过 | 纯文案，N/A |
| F20 | AC1 提示出现 | 通过 | hover 收起按钮 → 「收起为胶囊」浮现，transition-delay 0.15s，与图钉/日历同为 .pin-tip 规格 |
| F20 | AC2 无原生 title | 通过 | collapseBtn/closeBtn getAttribute('title') 均为 null；仅胶囊 #capsule「拖动移动位置」与 #expandBtn「展开」保留 title（决策点 33 豁免，harness T7l） |
| F20 | AC3 无抖动不遮挡 | 通过 | 悬停前后 cal/pin/collapse/close rect 逐值一致；气泡 absolute 定位、pointer-events:none；移开 400ms 后 opacity=0 |
| F20 | AC4 键盘可达 | 通过 | focus collapseBtn（focus-visible）300ms 后 tip opacity=1、文案「收起为胶囊」；blur 后消失 |
| F20 | AC5 功能不回退 | 通过 | 点击收起 → collapsed=true/board=none/胶囊 4 圆点；点展开按钮恢复 |
| F20 | AC6 胶囊态（豁免项） | 通过（按豁免） | §Z 结论为「不做」：胶囊内 hover 展开按钮无任何自绘 tip（expandBtnTips=0、visibleTips=[]），原生 title「展开」保留，实现与声明一致 |
| F21 | AC1 位置正确 | 通过 | 删除后 toast settle 态：底边 y=584 < bottombar 顶边 y=592，**gap=8px**（=--space-toast-gap）；水平 centerOffset=0；z-index=40 |
| F21 | AC2 不遮挡输入 | 通过 | toast 显示中：与 quickInput 及 grad-wrap 矩形均不相交，输入框可聚焦（activeElement=quickInput）、placeholder「记一条，回车保存」可见、elementFromPoint 命中输入框 |
| F21 | AC3 撤销可用 | 通过 | 点撤销：before=0→after=1，条目恢复至原分区 P3 |
| F21 | AC4 自动消失 | 通过 | 4.5s 后 show=false/opacity=0，localStorage 计数=0（过期不恢复） |
| F21 | AC5 双外观 | 通过 | 深色实测 gap=8px 不变、bg rgba(42,42,50,0.8)/文字 rgb(245,245,245) 可读；截图 screenshot-1791601927444.png（深色 toast 于输入框上方居中、零遮挡）。进场动画方向实测 transform translateY(-8→0)=自上滑入（§AA） |

### 缺陷清单

**P0**：无。**P1**：无。**P2**：无。

**环境受限说明（非实现缺陷，不计缺陷）**：
1. F18 AC2「进程结束」无法在本 QA 会话完成最终观察——本会话派生的所有 Electron helper 进程 SIGKILL 免疫（含测试期间新实例的自有 helper），app.quit() 收尾等待子进程被永久阻塞；应用侧关闭链路（窗口/renderer 销毁、落盘、位置记忆）全部实测正常。遗留与本轮测试相关的不可收割 helper 残留进程（PID 1092/1093/1096/1691-1693/2655-2660/6604-6608 等），主进程均已退出，残留进程不持有窗口、重启后自然消失或注销时清理。
2. 本会话运行 Electron 必须 --no-sandbox（renderer 沙箱在受限会话下初始化失败），与 main.js MARKIT_SMOKE 分支的设计预设一致；真机不受影响。

### 本轮总结论

**有条件通过**。四项需求 F18-F21 全部落地，本轮可验证范围内 **零缺陷**（P0/P1/P2 均无）；自测 harness 44/44、v16 更新断言后 58/58。唯一条件项：F18 AC2「进程结束」需统筹者在正常桌面会话做 30 秒真机复核（点 ✕ → 确认 Dock 无残留）——本环境缺陷阻塞了该单项的完整观察，应用侧证据（窗口销毁、数据双落盘、位置记忆、无弹窗）均为正向。

---

## v1.8 验收轮（2026-10-11）· F22/F23/F24 三项新需求

测试方式：`node .selftest/harness.js`（68/68）+ `node .selftest/v16.js`（72/72）+ catdesk browser-action 实测 file:// 页面（viewport 380×640，干净态起步）。F22 用 localStorage 注入 7 条混排数据（open/done/dropped 交错、时间戳乱序、含一条 movedAt=250 的移入笔记）验证；测试数据验后已清空（reload 后 notesInDom=0、storage=null），浏览器标签已关闭。截图均在 /Users/tangchauyi/.agent-browser/tmp/screenshots/。

### v16.js 两处测试环境变更核实

| 变更 | 裁定 | 理由 |
|---|---|---|
| mock 修复：getElementById 仅返回 isConnected 节点（v16.js L151-158） | **合理，采纳** | 真实 DOM 的 getElementById 不会命中已摘除节点；旧 mock 会让 removeInlineInput 命中已 detach 的旧节点而漏删新条，恰好掩盖 F24「重复双击单实例」这类真实缺陷。此修复提高 mock 保真度、收紧而非放松断言 |
| fixture 补字段：种子笔记补 `movedAt: 0`（v16.js L177-186） | **合理，采纳** | loadNotes 归一化输出新增 movedAt 字段，B2d 断言 `markit_notes === JSON.stringify(notes)` 为序列化全等比较，种子缺字段会假失败；补字段与 loadNotes 输出字段序一致，断言语义（显示偏好与笔记数据分离）不变 |

### 逐项结论（浏览器实测 + 双自测，证据均为实测 evaluate 输出/坐标/截图）

| 需求 | AC | 结论 | 证据 |
|---|---|---|---|
| F22 | AC1 三组顺序 | 通过 | 注入 7 条混排后渲染序 = q4(开A@200)→q7(移入@250)→q2(开B@300) \|\| q3(完@200)→q5(完@900) \|\| q1(弃@100)→q6(弃@800)：open 按入区时间升序、done/dropped 按 statusAt 升序、三组不穿插；截图 screenshot-1791605729228.png |
| F22 | AC2 完成沉底 | 通过 | 首位 open 笔记 q4 点「完成」→ 渲染序从 [q4,q7,q2,新事P0,done×2,dropped×2] 变为 done 组末位（q3,q5 之后）；notes 数组下标不变（q4 数据层仍在 idx=3，dataOrder 与注入序一致） |
| F22 | AC3 done 组内排序 | 通过 | 先后标 q2、q7 完成 → done 组内 q5,q4,q2,q7 严格按 statusAt 升序追加 |
| F22 | AC4 取消恢复 | 通过 | q3 点「取消」→ 回 open 组首位（入区时间=createdAt 150 最早，规则位而非原位），符合「位置由规则决定」 |
| F22 | AC5 新建追加 | 通过 | 就地输入「新事P0」回车 → 渲染序第 4 位 = 3 条 open 之后、done 之前（open 组末尾） |
| F22 | AC6 ⇅ 移动落点 | 通过 | q7（createdAt=50 最老）经 popover 移入 P1 → movedAt 由 250 更新为移动时刻（>=t0），落 P1 open 组末尾；移回 P0 → 落 open 组末尾（在 createdAt 更新的新事P0 之后），F4 不回退 |
| F22 | AC7 重启稳定 | 通过 | reload 后渲染序与重启前逐 id 一致（q3,新事P0 \|\| q5,q4,q2,q7 \|\| q1,q6）；movedAt/statusAt 随 persist 落盘；截图 screenshot-1791605943653.png |
| F22 | AC8 角标不回归 | 通过 | 4 done + 2 open 状态下 P0 角标=2、胶囊=3（只计 open）；全部笔记仍留原分区（zoneOf 逐条核对 z0/z2 未变）；数据层序与注入序一致（T4a 口径） |
| F23 | AC1 常驻存在 | 通过 | 4 分区 .zone-foot 均存在且高=36px（=--zone-foot-min）；P0 满员态 footTop=356=末条笔记底缘、零间隙、foot 内 0 条笔记、不混入 .note-list |
| F23 | AC2 满员可双击 | 通过 | 双击满员 P0 底部空白区 → 就地输入条出现（见 F24 AC1）；空白区属 F3 热区 |
| F23 | AC3 空态不回归 | 通过 | 零笔记分区空态文案+划线正常显示，空态文案底缘(471.8)=foot 顶缘(471.8)，其下 36px 空白区存在且双击可建（P2/P3 实测建条成功）；清理后空板截图 screenshot-1791606022956.png |
| F23 | AC4 有笔记无叠加文案 | 通过 | 有笔记分区 hint 常态 opacity=0；hover 120ms 延迟后 opacity=1 显示「双击记一条」（§AB 决策点 36 悬停微提示例外条款）；零笔记分区 hover 后 opacity 仍=0（引导去重 :has(.note) 生效）；截图 screenshot-1791605798121.png（hover 态，微文案+整区底色可见） |
| F23 | AC5 F17 不受影响 | 通过 | hover P0 foot 时 .paste-ready 虚线框覆盖至空白区（截图 screenshot-1791605798121.png 可见 foot 在虚线容器内）；粘贴落点按 F22 open 组末尾（v16.js C7 组+F 组已覆盖数据路径） |
| F23 | AC6 F16 不串扰 | 通过 | 精简模式下双击 foot → 输入条弹出且 titles-compact 保持（前后 .titles-compact 均 true）；双击标题行切模式路径未被本轮改动影响（harness B 组延续通过） |
| F24 | AC1 非空分区位置 | 通过 | 双击 P0 foot → 输入条 parentNode=zone-foot（分栏最底部槽位）；滚动对齐后实测 wrapTop=212.5 > 末条笔记 bottom=210.5，距标题行极远（head 已滚出视口），非「标题行之下」旧位置 |
| F24 | AC2 空分区位置 | 通过 | 双击 P2 foot → wrapTop=445.1 在空态文案底缘(439.1)之下、footBottom=475.1 内，仍属 P2（zoneP=2）；截图 screenshot-1791605821123.png（输入条在空态文案之下、渐变描边聚焦态） |
| F24 | AC3 写入落位 | 通过 | 「新事P0」回车 → 渲染于 3 条 open 之后、done 之前；「新事P2」落 P2（priority=2 非 P3）、输入条直接移除（wraps=0 无退场过渡） |
| F24 | AC4 滚动可见 | 通过 | 打开即 wrap.scrollIntoView(nearest)：实测 P0 超高内容自动滚至 scrollTop=145.5 使输入条可见，且 activeElement=input（聚焦成立） |
| F24 | AC5 交互不回退 | 通过 | Esc：不落笔记（stored 计数=0）、退场 120ms 后 DOM 无残留（anyInDom=0, withOutClass=0）；连续双击：count=1、同一节点重建（单实例约束）；真实链路复验：真 dblclick 打开（focused=true）→ 真点击 #quickInput → blur 取消 400ms 后 wraps=0 |
| F24 | AC6 优先级正确 | 通过 | 双击 P2 建条 → priority=2；双击 P0 建条 → priority=0，均不落默认 P3 |

### 缺陷清单

**P0**：无。**P1**：无。**P2**：无（v1.7 遗留 .paste-ready 空剪贴板提示语义 P2 维持挂账，不属本轮范围）。

**偏离点裁定（前端上报：Esc/blur 退场动画可被再次双击截断）**：**接受，定级 P2 以下（不予立缺陷）**。裁定依据：① PRD F24 行为不变项与 §AC 均明文「同一时刻最多一个就地输入条（重复双击先移除旧条再开新条）」——旧条同步移除是规格要求的优先路径，退场动画仅 120ms 装饰性过渡，被截断的损失为亚百毫秒级视觉细节；② 实测复现确认无功能损害：Esc 后立即双击 → 旧条（含 inline-out 类）被同步摘除、新条独立打开、Esc 未误存笔记（stored=0），退场节点 120ms 后无 DOM 残留，Esc→再开→Enter 保存链路完整可用（savedOk=true）；③ §AC「重复双击时经 removeInlineInput 同步移除旧条，延迟移除幂等」的实现注释与实测行为一致，属实现如实遵循规格的边界表现。建议（不阻塞）：后续迭代可让 removeInlineInput 对 inline-out 节点跳过（保留动画自然结束），但需注意不得破坏单实例约束。

**测试环境备注（非缺陷）**：合成事件（programmatic blur()）在部分焦点时序下不触发 blur 监听器，曾观察到一条非 inline-out 的输入条残留——已用真实交互链路复验（真 dblclick → 真点击别处 → wraps=0，AC5 证据）排除真实缺陷，属无头环境合成事件的焦点伪象；真机鼠标点击路径行为正确。

### 本轮总结论

**通过**。F22/F23/F24 全部 20 条 AC 实测达标，零 P0/P1/P2 缺陷；自测 harness 68/68、v16 72/72（两处测试环境变更经核实均为合理收紧/对齐，无放松断言）；T4a 数据层下标不变断言延续 PASS（harness T8m/T8d + 实测 dataOrder 不变）；前端上报的退场动画截断偏离点按单实例约束裁定为可接受的规格内表现。无遗留需统筹者复核项。

---

## v1.9 验收轮（2026-10-12）· F25-F28 四项新需求

测试方式：`node .selftest/harness.js`（68/68）+ `node .selftest/v16.js`（89/89，新增 G1-G5 共 21 条）+ catdesk browser-action 实测 file:// 页面（viewport 380×640，storage 注入 5 条 P1 混排 + 2 条 P2）。拖拽用 PointerEvent 序列模拟（pointerdown→真等 600ms→pointermove 序列→pointerup）。测试数据已清空（reload 后 notes=0、storage=null），浏览器标签已关闭。截图均在 /Users/tangchauyi/.agent-browser/tmp/screenshots/。

### 逐项结论（浏览器实测 + 双自测）

| 需求 | AC | 结论 | 证据 |
|---|---|---|---|
| F25 | AC1 长按进入拖拽 | 通过 | 600ms 后 .drag-ready=1、body.dragging=true；实测 transform matrix(1.03)、shadow rgba(0,0,0,0.2) 0 8px 24px、opacity 0.92、cursor grabbing（§AE 全项）；截图 screenshot-1791620004975.png |
| F25 | AC2 同组重排+持久化 | 通过 | A 拖到 C 之下松手：渲染序 B/C/A，seq B1/C2/A3（组内 1..n 全重编号，done 组 D/E 未波及）；reload 后仍 B/C/A；拖动中截图（幽灵条跟手+C 条下缘落点指示）screenshot-1791620039719.png |
| F25 | AC3 跨组取消 | **不通过（P1）** | 长按 open 组 B 松手于 done 组 D 条范围内（y=300 ∈ D 280-316）：结果 open 组重排为 C/A/B 且 seq 重写（A2/B3/C1）——未取消、未回弹、写了 seq，直接违反 AC3「无任何变化」 |
| F25 | AC4 跨分区取消 | **不通过（P1）** | 长按 P2 的 G 松手于 P0 分区上空（elementFromPoint=P0 .empty）：结果 P2 组内 G/F 换位、seq 重写（G1/F2）；拖动中落点指示仍显示 F:above（钳位吸附）、幽灵条已跟入 P0 区。分区未变（仍 z=2）但位置已变+写 seq，违反「回弹原位、不写 seq」。根因同 AC3：computeDropTarget（L1933-1966）把组外上方/下方指针一律钳到首行前/末行后，仅 targetRow=被拖行自身才返回 null，越界取消路径实际不可达 |
| F25 | AC5 新成员落组末 | 通过 | seq 组（C1/A2/B3）内就地新建「QA新建X」→ 落 B 之后、done 之前，seq=none，B/C/A 序不变 |
| F25 | AC6 状态变更清 seq | 通过 | done 组重排（E1/D2）后点 E「取消」：E.seq 删除、回 open 组规则位（movedAt=600 按 v1.8 时间键排在新无 seq 成员 mv24 之前——「取消不改入区时间」既裁一致；AC6 字面「组末尾」仅当时间键最新时成立，非缺陷）；D 手动序 seq=2 保持 |
| F25 | AC7 数据层不变 | 通过 | 拖拽后 persist dataOrder=[A,B,C,D,E] 与注入序一致（下标不变），仅 seq 变化且已落盘（G2d/G2f 断言同向） |
| F25 | AC8 手势互斥 | 通过 | 快速划过（>4px 即移）：无 ready、序不变；短按 80ms 松手：无拖拽；长按就绪原地松手后 guard 窗口内 dblclick：editInputs=0（dragGuardUntil 吞噬）；拖拽中实测他条 .note-actions opacity=0 + pointer-events:none（操作组/呼吸点不可点） |
| F25 | AC9 存量兼容 | 通过 | 无 seq 的 D/E 首屏即按 statusAt 升序（时间键），首拖前无任何 seq 写入 |
| F26 | AC1 双击进入编辑 | 通过 | 真 dblclick C 条本体：.edit-input + grad-wrap 出现、预填原文、全选（0-4）、聚焦、条高 36px；截图 screenshot-1791620540349.png |
| F26 | AC2 Enter 保存 | 通过 | 改「QA拖C改」回车 → 显示更新、reload 后 persisted=「QA拖C改」 |
| F26 | AC3 Esc/blur 取消 | 通过 | Esc 实测恢复「QA拖A」原文、无输入条残留（editInputs=0）；blur 路径沿用 startEdit 既有实现（v1.8 已验收）+ harness/v16 覆盖，采信上游 |
| F26 | AC4 空文本取消 | 通过 | 值改「   」回车 → 原文保留 |
| F26 | AC5 位置不变 | 通过 | 编辑保存后 C 仍第 1 位、seq=1 不变 |
| F26 | AC6 按钮不误触 | 通过 | 真 dblclick ⇅ 按钮：editInputs=0、popover=1（单击语义一次执行，无破坏性双触发；✕/状态按钮双击走同一 L2173 拦截分支，等价采信） |
| F26 | AC7 三热区互斥 | 通过 | 双击笔记条=编辑（AC1）；双击空态区=就地新建（F27 AC3 实测）；双击标题行=切模式（markit_title_mode=compact 落盘、.app.titles-compact 150ms 动画后挂载），互不串扰 |
| F27 | AC1 空分区无 foot | 通过（含偏离，见裁定 1） | 空分区 .zone-foot rect h=0（CSS :not(:has(.note)) display:none）；有笔记 P1 foot h=36——同屏前后对比见 screenshot-1791620004975.png（P0/P2/P3 无空白块、P1 有） |
| F27 | AC2 有笔记不回退 | 通过 | P1 foot 36px、hover 微文案浮现、双击 foot 打开输入条（wrapH=32 于 36px 槽内） |
| F27 | AC3 空分区双击新建 | 通过 | 双击 P0 空态区：输入条位于空态文案之下（wrap.top≥empty.bottom）、foot 因 :has(.inline-wrap) 豁免临时可见；Enter 落 P0（priority=0）；Esc 后 wraps=0、foot 回隐藏、无残留；截图 screenshot-1791620776583.png |
| F27 | AC4 动态切换 | 通过 | P0 新建 → foot 立即 visible h=36；删除 → 立即 hidden h=0；0↔1 双向即时 |
| F27 | AC5 F17 不回归 | 通过 | hover 分区时 .paste-ready 虚线框+「⌘V 粘贴到这里」覆盖至 foot 区（screenshot-1791620900970.png 可见） |
| F28 | AC1 垂直居中 | 通过 | hover P1 foot 400ms 后实测 \|hint 中心−foot 中心\|=0px ≤1px（hintOpacity=1、footH=36）；截图 screenshot-1791620900970.png |
| F28 | AC2 硬约束 | 通过 | foot 仍 36px；双击 foot 仍开输入条（32px 居中，F24 不回退）；hint pointer-events:none 不截双击 |
| F28 | AC3 双外观 | 通过 | 深色实测 dev=0px、color=rgb(165,165,172)=#A5A5AC token 不变；截图 screenshot-1791620946303.png |

### 缺陷清单

**P0**：无。**P1**：1 条——F25 AC3/AC4「越界松手=取消回弹」未实现（同 root cause）：computeDropTarget 无组/分区边界判定，拖到其他状态组或其他分区上方松手会按钳位落点执行组内重排并重写 seq，而非取消回弹；证据见上表 AC3/AC4 行。不丢数据、不跨分区、不改状态，但直接违反两条明文 AC，F25「越界回弹」语义整体缺失。修复建议：computeDropTarget 增加边界判定——pointerY 超出本组首行 top（含组间距容差）或末行 bottom 时返回 null。**P2**：2 条——① 拖拽期间呼吸点未隐藏：design §AE 要求「呼吸点隐藏（同 §I hover 处理）」，实测拖拽中他条 .note-dot opacity=0.4 呼吸动画进行中（无 body.dragging .note-dot 规则）；仅指针悬停条因 :hover 隐藏，视觉影响轻微，建议补一行 CSS。② 第七轮遗留 .paste-ready 空剪贴板 P2 维持挂账（不属本轮）。

### 偏离点裁定（前端上报 3 项）

1. **F27 用 CSS :has() 视觉隐藏而非 DOM 移除——接受，不立缺陷**。用户可见行为（空分区无 36px 空白块、0↔1 即时切换、Esc 无残留、双击热区不变）与 PRD AC1/AC4 完全等价（rect h=0 实测）；决策点 44「无 zone-foot DOM」的字面机器口径未被满足，但其意图是校验用户可见结果，且 CSS 方案换来空分区输入条挂载位的自然复用（:has(.inline-wrap) 豁免分支），实现注释如实声明。建议：下轮 PRD 修订把「节点不存在」措辞改为「视觉不渲染」，消解后续验收口径冲突。
2. **拖拽未做视口自动滚动——接受为 P2 挂账**。PRD F25 交互定义明确含此项，未实现属规格缺口；但 380×640 视口下单组 ≥14 条才越界，MVP 数据规模影响低，拖拽中滚轮/触控板滚动原生可用。建议下轮补齐，或在 PRD 将该句移入非目标。
3. **dragGuard 200ms——接受**。AC8 硬性仅要求「长按就绪后的 pointerup 不触发任何 click/dblclick」：实测 guard 窗口内 dblclick 被吞噬（editInputs=0）；浏览器合成 click 均产生于 pointerup 后同一事件循环，200ms 足以覆盖；>200ms 后的第二次点击属新手势序列，不构成误触。

### 本轮总结论

**不通过（限 F25 一项，修复后需复验）**。F26/F27/F28 全部 AC 实测达标（F27 按偏离裁定 1 口径）；F25 核心闭环（长按 500ms/4px 就绪、同组重排、seq 1..n 重编号、持久化、重启稳定、数据层下标不变、手势互斥、存量兼容）全部通过，但 PRD 明文的越界取消（AC3/AC4）未实现——组外松手会静默重排+重写 seq，属 P1，必须在放行前修复。自测 harness 68/68、v16 89/89 与实测结论一致（自测未覆盖越界取消场景，为本次盲区，建议 G 组补 2 条断言）。前端上报 3 项偏离全部裁定接受（2 项不立缺陷、1 项 P2 挂账）；另新增 P2 呼吸点偏离 1 项（前端未上报）。

## v1.9 复验轮（2026-10-12）· 上轮 P1 越界取消回弹 + P2 呼吸点修复验收

测试方式：`node .selftest/harness.js`（68/68）+ `node .selftest/v16.js`（**101/101**，新增 G6a-G6l 共 12 条越界取消断言）+ catdesk browser-action 实测 file:// 页面（viewport 380×640，storage 注入 7 条：P1 open A/B/C + P1 done D/E + P2 open F/G）。拖拽用 PointerEvent 序列模拟（pointerdown→真等 700ms→pointermove 序列→pointerup）。测试数据已清空（reload 后 notes=0、storage=null），浏览器标签已关闭。截图均在 /Users/tangchauyi/.agent-browser/tmp/screenshots/。

### 上轮 P1 复验（F25 AC3/AC4 越界松手取消回弹）

| 项 | 结论 | 证据（实测 evaluate 输出 + 截图） |
|---|---|---|
| AC3 跨状态组取消 | **通过** | 长按 A（y=178）拖至 done 组 D 条带内（y=298）：拖动中 ghost=1、dropInd=0（无钳位吸附）；松手瞬时 return=true、dragging=true、dragReady=true（回弹进行中）；180ms 后 ghosts=0、dragging=false；顺序 A/B/C/D/E/F/G 不变、**全部 seq=none**；截图 screenshot-1791622009936.png（拖动中，ghost 已入 done 组 y=279-317 且无落点指示）、screenshot-1791622030467.png（松手后，序不变） |
| AC4 跨分区取消 | **通过** | 长按 P2 的 G（y=491）拖至 P0 空分区（y=140，elementFromPoint=zone-head）：拖动中 dropInd=0；截图 screenshot-1791622067366.png（ghost「QA拖G」悬于 P0/P1 交界、原条 G 仍留 P2、无落点指示）；松手瞬时 return=true、dragging=true；后 order 与 seqs 零变化（全 "-"）、ghosts=0、dragging=false |
| 正控制·组内末行后 | **通过（不误取消）** | 长按 A 拖至 C 条带内 y=270（末行 C 中点下）：dropInd=C drop-below；松手 → order B/C/A、seq B=1/C=2/A=3 |
| 正控制·组内首行前 | **通过（不误取消）** | 长按 C 拖至首行 B 上半 y=170（≥firstRect.top 160 且 <B 中点 178）：dropInd=B drop-above；松手 → order C/B/A、seq C=1/B=2/A=3 |

边界判定实现核对：computeDropTarget L2003-2005 `pointerY < firstRect.top || pointerY > lastRect.bottom → null`，dragPointerUp L1936-1943 null 分支走 playCancelBounce（无 seq 写入、无重排），与上轮根因诊断的修复建议一致。

### 上轮 P2 复验（拖拽期间呼吸点隐藏）

**通过**。修复为 `body.dragging .note-dot { visibility: hidden }`（L579）。实测：拖动中他条 .note-dot visibility=hidden；回弹到位后 visibility=visible（呼吸点恢复）。证据见上表 AC3 链路的 evaluate 输出；截图 screenshot-1791622009936.png 中非悬停条呼吸点不可见。

### 回归确认（修复未引入破坏）

| 项 | 结论 | 证据 |
|---|---|---|
| 同组重排+seq 重编号 | 通过 | 正控制两次实测（B/C/A seq 1..n、C/B/A seq 1..n） |
| seq 持久化 | 通过 | reload 后 order=QA拖C,QA拖B,QA拖A 不变、seqs C:1/B:2/A:3 保持 |
| 双击编辑（F26） | 通过 | 真 dblclick A 条：editInputs=1、预填原文；改「QA拖A改」Enter → 落盘、seq=3 保持、位置不变、无输入条残留 |
| F24 新建 | 通过 | 双击 P1 foot → wraps=1；输入「QA新建X」Enter → p=1、seq=-、落 open 组末尾（seq'd 成员之后，AC5 语义）、wraps=0 |
| F27 空分区隐藏 | 通过 | 注入 7 条后实测 P0foot=0、P3foot=0（空）、P1foot=36、P2foot=36（有笔记） |
| 手势 guard | 通过（等价运行） | dragGuardUntil 置位于 L1934-1935 分支之前，取消/重排两路径均覆盖；上轮 AC8 实测结论不受本次修复影响，采信 |

### 既定偏离点裁定（前端上报 3 项，本轮核实）

1. **回弹期间 .dragging 保持到动画结束——接受，与 §AE 一致**。design §AE 明文「到位后移除跟手条、恢复原条」且拖拽期间交互抑制由 .dragging 全局类承载；实测松手瞬时 return=true/dragging=true，180ms 后 dragging=false，时序与规范吻合，非缺陷。
2. **回弹中 ghost 与原条叠加 180ms——接受，§AE 指定形态**。跟手条插值位移回原槽位必然在最后阶段与原条重叠，到位后 ghost 移除（实测 ghosts=0）；§AE 原文即此方案（非占位空隙），无偏差。
3. **回弹窗口内可立即开新拖拽——接受，无缺陷**。唯一重入闸门为 `initDrag` L1826 `if (dragState) return`，而 stopDragTracking 在 playCancelBounce 起始即同步置 null（L1859），回弹动画仅为视觉尾巴；PRD/§AE 均未限制回弹期间开新手势，且旧 ghost 由 finish 闭包移除、互不干扰。证据等级：磁盘证据（代码路径）+ 上表实测状态链。

### 遗留缺陷

**无新增**。上轮 P1 已修复并实测通过；上轮 P2 呼吸点已修复并实测通过。挂账项维持：① 拖拽视口自动滚动未实现（上轮裁定 P2 挂账，本轮未复测，PRD F25 交互定义内）；② .paste-ready 空剪贴板（第七轮遗留 P2，不属本轮）。

### 本轮总结论

**通过**。F25 越界取消（AC3/AC4）双路径实测达标：跨组/跨分区松手均无 seq 写入、无重排、播放 §AE 回弹动画（.drag-return 180ms，期间 .dragging 保持、呼吸点隐藏，到位后全部恢复）；正控制面证实组内首行前/末行后合法落位未被边界判定误伤；F26/F24/F27 回归零破坏；双自测 harness 68/68、v16 101/101（含 G6 新增 12 条越界断言）与实测一致。前端上报 3 项偏离全部裁定接受、不立缺陷。

## 拆分重构回归轮（2026-10-12）· v2.0 单文件拆分（零行为变更）验收

测试方式：双自测复跑 + 拆分等价性独立复核（从 git HEAD 单文件版提取内联段逐字节比对）+ catdesk browser-action file:// 实测（380×640）+ 协议回落安全用例模拟 + electron-builder --mac dir 打包/asar 解包 + 打包 .app 实机 CDP 探测与内置冒烟。测试数据已清（reload 后 notes=0、storage=null），浏览器标签已关闭，全部测试实例按精确 PID 清理（用户 /Applications 正在运行的 Mark it! PID 16403 全程未触碰）。

### 拆分等价性（核心：前后完全等价）

| 项 | 结论 | 证据 |
|---|---|---|
| CSS 逐字节一致 | 通过 | 独立复核：`git show HEAD:index.html` 提取内联 `<style>` vs `assets/css/app.css`，全等比较 === true |
| JS 逐字节一致 | 通过 | 同法提取内联 `<script>` vs `assets/js/app.js`，=== true |
| HTML 骨架等价 | 通过 | 仅 `<style>`→`<link>`、内联 `<script>`→`<script defer src>`，其余逐行全等（骨架归一比较 === true） |
| 自测 harness | 通过 | `node .selftest/harness.js` → 68 passed 0 failed（复跑） |
| 自测 v16 | 通过 | `node .selftest/v16.js` → 101 passed 0 failed（复跑）；「断言零改动」核实：两文件 diff 仅加载器段（harness 16 行 / v16 13 行），断言区零改动 |
| 改动面收敛 | 通过 | git diff：main.js 仅 L84-97 回落块 +11 行；package.json 仅 +`assets/**`；index.html 仅资源外链化 |

### 浏览器实测（file:// 直开 index.html，截图均在 /Users/tangchauyi/.agent-browser/tmp/screenshots/）

| 路径 | 结论 | 证据 |
|---|---|---|
| 外部 CSS 生效 | 通过 | styleSheets[0]=assets/css/app.css、cssRules=191、--p0=#FF3B30 解析；resource timing 探针无 404 |
| 外部 JS 生效 | 通过 | document.scripts=[assets/js/app.js]；渲染循环已执行（.zone=4、胶囊计数联动、storage 读取） |
| 四分区渲染 | 通过 | 4 zones、P0-P3 标题/角标/双击热区齐全；截图 screenshot-1791626321033.png |
| 新建·底部输入条 | 通过 | 输入+Enter → 落 P3 默认区、角标/胶囊=1、localStorage 落盘 |
| 新建·双击空白区 | 通过 | dblclick P0 zone-foot → inline input=1；Enter 保存 → badge=1、输入条移除 |
| 双击编辑 | 通过 | 预填原文「QA双击B」→ 改「…改」→ Enter 落盘、edit-input 清除 |
| 完成/放弃切换 | 通过 | open→done（flag 挂载、按钮变 undo）→undo 恢复 open→drop（note-flag-drop） |
| 日历开关 | 通过 | calBtn → .cal-card=1、aria-expanded=true、31 天格+today 标记（截图 screenshot-1791626445495.png）；再点关闭 expanded=false |
| 深浅色切换 | 通过 | emulatemedia dark → 暗色 token 生效（--text-primary=#F5F5F7、--bg-panel=#1E1E24EE）；系统级切换、无应用内按钮（与既有基线一致）；截图 screenshot-1791626452315.png |
| 长按拖拽排序 | 通过 | pointerdown→真等 700ms→move→up：body.dragging+ghost=1（截图 screenshot-1791626490202.png）→ 序 X/Y/Z 变 Y/Z/X、seq 1..3 重编、storage 持久化、reload 后保持 |

### main.js 协议回落安全检查（L84-97）

**通过**。用例模拟 7 组：`/assets/../../main.js`、`/../../../../etc/hosts.js`、`/%2e%2e/%2e%2e/tmp/evil.js`（URL 解码后穿越）、`/assets/css/app.css%00.html` 均被拒（归一化后越出 __dirname 或扩展名不在白名单 → 404）；合法 assets css/js 正常 SERVE；白名单仅 .css/.js。**P2 偏差**：白名单作用域为整个 __dirname 而非仅 assets/ 子树——模拟 `/node_modules/electron/index.js` → SERVE，与注释「原为 404 的仅 assets 路径」不符；实际风险极低（renderer contextIsolation+sandbox、打包 asar 内只含白名单文件），建议下轮收紧为 rel 须以 `assets/` 开头（一行改动）。

### 打包验证

**通过**。`npx electron-builder --mac dir` 构建成功；`asar list` 确认 /assets/css/app.css、/assets/js/app.js、/index.html、/main.js、/preload.js、/package.json 在包内且无多余文件。**打包 .app 实机 CDP 探测**（隔离 user-data-dir，避开用户运行中实例的单例锁）：markit://app/index.html 下 styleSheets[0]=markit://app/assets/css/app.css（191 规则解析成功）、scripts 含 markit://app/assets/js/app.js、__MARKIT_NOTES__ 注入正常——协议回落从 asar 内读文件路径成立。**打包冒烟**：MARKIT_SMOKE=1 实跑 → SMOKE DONE ALL PASS（注入/persist 落盘/收起 128×40/展开 360×640）。

### 前端上报坑裁定

1. **.selftest/app.js 历史快照——建议删除**。证据：全仓 grep 零引用；内容为 548 行早期 app JS 快照，与现行 1475 行 assets/js/app.js 已无对应关系，且已随 c0098ec 进入 git 历史，工作区保留只徒增混淆。
2. **defer 时序风险——裁定无风险，不立缺陷**。script 位于 body 末尾，defer 语义（解析完成后按序执行、先于 DOMContentLoaded）保证全部 DOM 就绪；Electron 注入的 __MARKIT_NOTES__ 位于 body 首部、必然先于 defer 脚本执行；实测四条链路（渲染/新建/编辑/拖拽）全过。

### 缺陷清单

**P0：无。P1：无。P2：2 条**——① 协议回落白名单作用域偏宽（见上，一行修复建议）；② 部署提醒：用户已安装的 /Applications/Mark it!.app 仍为拆分前 17:44 构建，新 dmg 未安装（非本轮代码缺陷）。

### 本轮总结论

**通过**。零行为变更目标达成：源三段（HTML 骨架/CSS/JS）逐字节等价独立复核成立，双自测 68/101 复跑全绿且断言零改动，浏览器核心路径 10 项实测全过（外部资源生效、无 404），协议回落防逃逸成立（含 P2 宽域偏差），打包产物 assets 齐全且打包实机 markit:// 下 CSS/JS 正常加载、内置冒烟全过。
