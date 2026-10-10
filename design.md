# design.md — Mark it! plan for it（设计规范 v1.6）

## 风格基调
macOS 原生桌面小组件质感：半透明毛玻璃面板 + 小圆角卡片 + 系统字体。信息密度高、留白克制，四分区用左侧色条+角标区分优先级，不打断视觉。深浅色跟随系统（无切换按钮，遵守 PRD 非目标）。

## 1. 配色 token（hex，浅色/深色一一对应）
| token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| bg-panel | #F2F2F7EE (rgba 242,242,247,.94) | #1E1E24EE | 窗口底，配 backdrop-filter: blur(24px) saturate(1.4) |
| bg-card | #FFFFFFCC | #2A2A32CC | 笔记条底 |
| text-primary | #1D1D1F | #F5F5F7 | 笔记正文 |
| text-secondary | #8E8E93 | #98989F | 空态/辅助 |
| p0 | #FF3B30 | #FF453A | 分区色条/角标 |
| p1 | #FF9500 | #FF9F0A | 同上 |
| p2 | #FFCC00 | #FFD60A | 同上 |
| p3 | #8E8E93 | #6C6C72 | 同上 |
| stroke | #00000014 | #FFFFFF14 | 分区分隔线 1px |
| hover | #0000000A | #FFFFFF0F | hover 蒙层 |

## 2. 字体字号（全部 -apple-system / SF Pro，行高 1.4）
应用名「Mark it! plan for it」：13px / 600 / text-primary。分区标题：12px / 600 / 各分区色。条数角标：11px / 600 / 白字，背景=分区色，胶囊 12px 圆角，min宽 18px 高 18px。笔记正文：13px / 400。输入框文字：13px / 400，placeholder=text-secondary。空态文案：12px / text-secondary / italic。迷你胶囊文字：12px / 600。

## 3. 布局（展开态窗口 360×640，收起态 260×48，无边框窗口）
- 顶栏 高 48px，内边距 12px：左=应用名，中=输入框 flex:1 高 28px 圆角 8px 背景 bg-card 描边 stroke，右=收起按钮 28×28 圆角 6px。整条顶栏 -webkit-app-region: drag；输入框与按钮 no-drag。顶栏下 1px stroke 分隔线。
- 四分区纵向堆叠，每分区：标题行高 32px（左 4px 竖色条 12×12 圆角 2px + 分区名 + 角标 + 右侧 12px 内边距），下方笔记列表 padding 0 12px 8px，分区间隔 8px，分区底部 1px stroke。P0-P3 名称严格照抄 PRD：重要且紧急/重要且不紧急/不重要但紧急/不重要且不紧急。
- 笔记条：高 36px，圆角 8px，背景 bg-card，左 3px 实色边=所属分区色，内边距 8px，文字单行 ellipsis，条间距 4px。列表区 overflow-y:auto。
- 空态文案（居中，替代列表）：P0「双击此处，先记下最要紧的事」P1「双击此处，安排重要的事」P2「双击此处，记下急事先处理」P3「双击此处，随手记点什么」。

## 4. 交互细节
- 笔记条默认只显文字；hover（180ms ease-out 过渡）右侧淡入操作组：优先级按钮（图标⇅）、编辑（铅笔）、删除（×）各 22×22、图标 14px/text-secondary，hover 变 text-primary。操作组背景加 4px 渐变遮罩保证可读。
- 优先级按钮：点击弹 popover 菜单 120×152 圆角 10px 背景浅#FFFFFFF2/深#32323AC8+blur，4 行各高 32px，行内 12×12 色块+分区名，当前分区打勾；选中行 hover 色 hover。
- 编辑：点击铅笔，笔记条原地变为高 36px 输入框（同顶栏输入框样式，自动 focus 全选），Enter 保存 Esc 取消。
- 就地输入：双击分区空白，该分区标题下插入高 32px 输入框（同上样式，placeholder「记一条，回车保存」），Enter 入该分区末尾，Esc/失焦取消，180ms fade+4px 位移入场。
- 收起/展开按钮：SF Symbol chevron.down 图标（收起态 chevron.up），hover 背景 hover，active 缩放 0.92。

## 5. 关键状态
- 收起态：窗口 260×48，仅剩一个毛玻璃胶囊（圆角 24px，同 bg-panel），内容=应用名缩写「Mark it!」+未读总条数角标 + 展开按钮，整块 drag。
- 删除：建议直接删（小窗不适合模态）+ 底部 toast「已删除 · 撤销」高 36px 圆角 10px 背景 bg-card+blur，toast 存活 4s，点撤销恢复原位置，180ms ease-out 滑入/滑出。
- 输入框 focus：描边变 p3→#007AFF（浅）/#0A84FF（深）1.5px，120ms。

## 6. macOS 桌面质感
启用 vibrancy（titleBarStyle hiddenInset + backgroundColor 'transparent' + visualEffectState active），面板毛玻璃如上；窗口阴影用系统默认；所有圆角见上（外层不额外加圆角，交给系统）；唯一 drag 区=顶栏与迷你胶囊，其余 no-drag。

## v1.2 增补：固定按钮（F11，追加章节，覆盖顶栏右侧图钉按钮全部样式与交互）

> 注：PRD v1.1 起输入框位于底部栏；本文 §3 顶栏「中=输入框」为旧版遗留描述，以 PRD 元素清单为准：顶栏 = 应用名 + spacer + 固定按钮 + 收起按钮。

### A. 图标（图钉 thumbtack，viewBox 0 0 16 16，渲染 14×14px）
统一 path（两态共用，仅填充/描边与颜色不同）：
`d="M4.375 1.5h7.25a.875.875 0 0 1 .875.875v.875a.875.875 0 0 1-.875.875h-7.25a.875.875 0 0 1-.875-.875v-.875a.875.875 0 0 1 .875-.875zM5.9 3.25h4.2l-1.3 5.95h-1.6zM7.55 9.2h.9L8 14.75z"`
（结构：头部圆角横条 x3.5–12.5/y1.5–3.25；锥体 (5.9,3.25)–(10.1,3.25) 收窄至 (7.2,9.2)–(8.8,9.2)；针尖三角收至 (8,14.75)）
- 未固定态：fill:none; stroke:currentColor; stroke-width:1.2; stroke-linejoin:round; stroke-linecap:round; color=text-secondary（浅#8E8E93/深#98989F），按钮 hover 时 color 变 text-primary（浅#1D1D1F/深#F5F5F7）。
- 已固定态：fill:currentColor; stroke:none; color=品牌蓝 浅#007AFF/深#0A84FF（沿用 §5 focus token）。
- 两态均挂 aria-pressed（false/true），状态切换时图标颜色 120ms ease-out 过渡。

### B. hover 文字形态：采用 b) 深色 tooltip 气泡（含小三角）
理由：① 标签展开即使绝对定位也会横向侵占右侧收起按钮或左侧 spacer 的视觉空间（360px 顶栏下 60px 右组区内无横向余量），tooltip 纵向浮出零占位；② 天然脱离文档流（absolute+pointer-events:none），满足 F11「不抖动、不遮挡、移开消失」三条硬性要求；③ macOS 原生 hover 说明惯例，用户认知零成本。
### C. tooltip 规格
- 位置：absolute，left:50% + translateX(-50%)，top:calc(100% + 6px)（按钮下方居中，伸入 P0 区域上方，pointer-events:none 不拦截点击）。
- 气泡：背景 浅/深同用 #1D1D1FF2 + blur(12px)，文字 #F5F5F7 12px/400 单行 nowrap，内边距 5px 10px，圆角 6px，z-index 10。
- 小三角：::before 8×8px 同背景色正方形 rotate(45deg)，top:-4px，left:50% margin-left:-4px。
- 动效：opacity 0→1 + translateY(4px→0)，transition: opacity 120ms ease-out, transform 120ms ease-out；浮现 delay 150ms（防掠过误触），消失 delay 0ms（CSS :hover 切换 transition-delay 实现，触发机制按 PRD 决策点 10 归前端）。
### D. 布局尺寸
- 按钮：28×28px（=最小热区），圆角 6px，图标居中 14×14，no-drag，cursor:pointer。
- 未固定 hover 背景：token hover（浅#0000000A/深#FFFFFF0F）；active 缩放 0.92（与收起按钮一致）。
- 已固定态常驻底色：浅#007AFF14/深#0A84FF1F 填满 28×28 圆角 6px（淡色圆角底，与品牌蓝实心图钉叠加后仍可辨）；此态 hover 底色加深至 浅#007AFF1F/深#0A84FF2E。
- focus-visible：outline 2px #007AFF（深色#0A84FF），offset 2px。
- 顶栏右组排布：…spacer(flex:1) → 固定按钮 28px → 间距 4px → 收起按钮 28px，右缘距顶栏 padding 12px。
### E. hover 文案
- 未固定态：「点击置顶看板」；已固定态：「已置顶 · 点击取消」。
### F. 空间检查（360px 顶栏）
360 − 左右 padding 24 = 336；应用名 13px/600 约 138px；右组 28+4+28=60px；spacer 剩余约 138px，排布充裕。收起态（260×48）顶栏内不放固定按钮，仅迷你胶囊。

## v1.3 增补（F12/F13/F14，追加章节；与上文冲突处以本节为准）

### G. 渐变色板系统（F13）
- grad-brand = linear-gradient(135deg, #FA5C8D 0%, #FBAF5D 100%)；深色模式 grad-brand-dark = linear-gradient(135deg, #FB7AA5 0%, #FCBB74 100%)（整体提亮一档防沉入深底）。两模式渐变上仅放白色图形符号，禁止放 <19px 文字（白字对 #FA5C8D 仅 3.0:1）。
- 渐变允许落点（全部为非文字元素）：①完成态 ✓ 徽标（§H）②空态马克笔划线（§J）③输入框聚焦描边（§K）④应用名旁 ✓ 小方块（§K）⑤常态操作呼吸点（§I）⑥状态按钮 hover 图标色（单端色 #FA5C8D/深#FB7AA5）。
- 渐变禁止落点：窗口/卡片大面积背景、正文与辅助文字颜色、四分区色条与角标（保 P0-P3 识别与小字对比度，此为 F13「四分区识别不冲突」条款的落点）。
- 对比度硬值：正文 text-primary 浅#1D1D1F（对 bg-panel ≈12.6:1）/深#F5F5F7（≈11.8:1），≥4.5:1 达标。有意义辅助文字（空态/提示）升级专用 token text-muted-strong：浅#6D6D72（4.6:1）/深#A5A5AC（6.8:1）；原 text-secondary #8E8E93/#98989F 对比约 2.9:1，降级为仅限图标与非文字使用。

### H. 笔记条三态（F12）
- 普通态（画风融入）：圆角 8→12px；左侧分区色条 3→4px（保留分区纯色，不渐变化），条圆角随条 12px（仅左侧两角）；其余不变。
- 完成态：文字 line-through 1.5px + 置灰 浅#8E8E93/深#98989F；左色条 = 分区色 40% 淡残影（color-mix zone 40% transparent，v1.8a 对调：正向事保留暖调归属感）；条背景降为 浅#FFFFFF99/深#2A2A3280；行尾常驻徽标 16×16px 圆角 5px、底=grad-brand，内含白✓ SVG（10px，stroke 2.2，`M3.2 8.6 6.6 11.8 12.8 4.6`，linecap/linejoin round）——手绘感由圆头粗描边承担。
- 不干了态：文字 line-through 1.5px + 褪色 浅#B9B9BE/深#7C7C84；整条 opacity 0.55；左色条 = 固定灰 浅#C7C7CC/深#48484E（v1.8a 对调：放弃彻底退役，不再残留分区色）；行尾 14px 灰描边 ✕（stroke text-secondary，1.6px，`M4 4 12 12 M12 4 4 12`），无徽标。与完成态区分：完成=徽标+分区色淡残影，不干了=无徽标+固定灰色条+整条半透明褪色。
- 取消恢复：hover 操作组出现 ↺（见 §I），点击后回普通态，opacity/删除线/色条 200ms ease-out 同步过渡。三态均留原分区原位，编辑/移动/删除能力不变。

### I. 笔记操作组（F14）
- 常态线索：每条右侧常驻 6×6px 圆形渐变点（底=grad-brand），呼吸动画 opacity 0.4↔0.75、3s ease-in-out infinite alternate（prefers-reduced-motion 时静止于 0.55）。不占新空间（置于条内右缘 8px 处），满足「可感知线索存在性可机器校验」。
- hover 整条：背景→token hover + box-shadow 0 2px 8px rgba(0,0,0,0.10)（深 rgba(0,0,0,0.35)）+ translateY(-1px)，180ms ease-out；同时呼吸点隐藏、操作组淡入 120ms ease-out。
- 操作组排布（行内右缘，垂直居中）：普通态 [⇅][✎][✓][⊘][✕]，已标状态态 [⇅][✎][↺][✕]。每枚按钮 22×22px（热区≥20×20 达标）、间距 2px、图标 14px；⇅/✎/✕ 沿用现样式，✓/⊘/↺ 用 SVG stroke 1.6 round，色 text-secondary，hover 变 text-primary；状态按钮 hover 图标色变 #FA5C8D（深#FB7AA5）。组尾加 4px 渐变遮罩同现有防可读性冲突。
- 图标 path（viewBox 0 0 16 16）：✓=`M3.2 8.6 6.6 11.8 12.8 4.6`；⊘（不干了）=`circle cx8 cy8 r5.4` + `M4.4 4.4 11.6 11.6`；↺（取消）=`M2.8 6.2 A5.4 5.4 0 1 1 2.7 9.6` + `M2.8 2.6 v3.6 h3.6`。

### J. 空态与分区标题
- 空态：4 条文案措辞不变；文案下方加 64×8px 马克笔划线 SVG：`M2 5 C14 1 26 9 40 4 S58 7 62 4`，stroke=url(#grad-brand)，width 3，linecap round，opacity 0.9。文案色由 italic+text-secondary 改为 12px/400 text-muted-strong（对比达标），手绘感由划线承担。
- 分区标题：字重 600→700，letter-spacing 0.3px；色条 12×12 圆角 2→4px；标题行高、角标、分区色不变。

### K. 顶栏与底部输入框
- 底部输入框聚焦态：外层 wrapper 常态 padding 1.5px 背景 stroke；focus 时背景切 grad-brand（=渐变描边，深浅色同用各自渐变 token）、圆角 10px，内层 input 圆角 8.5px，附加 shadow 0 0 0 3px #FA5C8D1F（深 #FB7AA51F），160ms ease-out。§5 原 #007AFF 聚焦描边自 v1.3 废弃（仅图钉已固定态仍用品牌蓝）。
- 产品名旁渐变✓（判断：建议加）：应用名左侧插入 16×16px 圆角 5px grad-brand 方块 + 白✓（§H 徽标缩小版），与名间距 6px。理由：零布局风险（顶栏 spacer 余量约 138px）、与 icon 同源强化品牌、深浅色通用；不加则顶栏渐变落点为零，F13「画风一致」观感打折。

## v1.4 增补：日历回顾（F15，追加章节）

### L. 顶栏日历图标（决策点 17）
- SVG（viewBox 0 0 16 16，渲染 14×14，fill:none; stroke:currentColor; stroke-width:1.2; stroke-linecap/linejoin:round）：
`M5.25 1.5v2.25 M10.75 1.5v2.25 M2.75 4.5h10.5v8.25a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5z M5.5 8.25h.01 M10.5 8.25h.01`
（双提环 + 圆角外壳 + 两粒日期点，线稿重量与图钉 §A 完全一致）
- 按钮 28×28px 圆角 6px，位于图钉左侧、间距 4px（右组从左到右：日历 → 图钉 → 收起）；no-drag。常态 color=text-secondary（浅#8E8E93/深#98989F），hover color=text-primary + 背景 token hover，active 缩放 0.92，focus-visible outline 2px #FA5C8D（深#FB7AA5）offset 2px。
- 激活态（覆盖层打开期间）：图标 color #FA5C8D/深#FB7AA5 + 常驻底色 浅#FA5C8D14/深#FA5C8D1F（沿用图钉已固定态手法），120ms ease-out。tooltip「回看日历记录」完全复用 §C 规格。

### M. 覆盖层
- 判断：**留边圆角卡片**。理由：与毛玻璃笔记卡片同构、圆角语言延续；360 全幅平铺会与顶栏贴死、观感沉重且失去「临时层」暗示。尺寸：逻辑容器占顶栏下方全部内容区（y 48–640，即 360×592），卡片 inset 10px → **340×572**，圆角 16px，内边距 14px，z-index 20（顶栏及其 tooltip 恒在其上，置顶/收起不受影响，满足 F15；底层内容锁定交互，决策点 21）。关闭后销毁无保留态。
- 背景 浅#F2F2F7F8/深#1E1E24F8 + blur(24px) saturate(1.4)（比 bg-panel 更实以遮底层），边 1px stroke，阴影 0 8px 24px rgba(0,0,0,0.18)/深 rgba(0,0,0,0.45)。
- 卡片右上关闭按钮 28×28px 圆角 6px，✕ 14px stroke 1.6（`M4.5 4.5 11.5 11.5 M11.5 4.5 4.5 11.5`），色 text-secondary、hover 变 text-primary + 背景 token hover、active 0.92（与顶栏按钮同规格）。
- 进场：opacity 0→1 + translateY(-8px→0) + scale(0.98→1)，220ms ease-out；退场反向 160ms ease-in。Esc/顶栏图标/关闭按钮三路等价关闭（前端实现）。

### N. 月历网格
- 头部行高 36px：年月标题「2026年2月」格式 14px/700 text-primary 居中；两侧翻月箭头 22×22px（chevron 14px，色 text-secondary、hover 背景 token hover、active 0.92，同收起按钮规格），分贴卡片左右内缘。翻月无最早月份限制。
- 星期表头高 22px：一 二 三 四 五 六 日，11px/600 text-secondary（非正文用色，§G 允许），逐列居中。
- 日期格 42×42px、水平/垂直 gap 各 4px（7×42+6×4=312px 居中），只画当月、行数 5/6 自适应，无跨月补位格。数字 13px/400 text-primary，置于格内上部（top 5px）居中。
- 今天：数字外 26×26 圆形**渐变描边**（border 2px grad-brand/深 grad-brand-dark），数字 13px/600。判断用描边不用渐变底圆：不填底则记录点仍可见、不与选中态混淆。
- 有记录日：数字下方居中 5×5px 圆点，bg=grad-brand（深 grad-brand-dark），与数字间距 2px；同日多事件仍是一个点（PRD 硬约束）。
- 未来日期（>今天）：数字 浅#C7C7CC/深#48484E，无点，cursor:default，点击无响应；今天与历史日 cursor:pointer。
- 选中日：28×28 圆形实底 浅#FA5C8D/深#FB7AA5（单端实色，非渐变，规避 §G 渐变小字禁令），数字白 13px/700，text-shadow 0 1px 2px rgba(0,0,0,0.25)（单字符高字重例外，与图钉实心态同手法），记录点改白 #FFFFFFE6。
- 未选中可点日：hover 背景 token hover、圆角 10px，120ms ease-out。
- 翻月过渡：网格容器 200ms ease-out，opacity 0→1 + translateX（下月 8px→0 / 上月 −8px→0），年月标题 120ms fade 同步。

### O. 日期详情区（决策点 19）
- 判断：**点击后日历压缩上移**（非常驻固定区）。理由：① 日历主用途是「哪些天记过事一目了然」，未选日期时 42px 大格信息最全，常驻详情区会在小窗（360×640）常年空置约 30% 高度；② 压缩后星期表头与选中格持续可见，换日期看详情不脱离日历上下文，满足「同层无跳转」。
- 压缩动画：日期格高 42→30px、行 gap 4→3px、记录点 5×5→4×4，220ms ease-out；详情区自 0 展开至剩余高度（max-height 240px，overflow-y:auto），同 220ms ease-out。已压缩态再点其他日期不重播压缩，仅内容 120ms fade 切换。
- 三组固定顺序 新建→完成→放弃；组头行高 24px：前置 14px 小图标（viewBox 0 0 16 16，stroke 1.6 round）+ 组名 12px/700 text-primary + 右侧组条数 11px/600 text-muted-strong。图标复用 §I path 呼应操作组：✎=`M3 12.9l.8-2.7 7.7-7.7a1.2 1.2 0 0 1 1.7 0l.3.3a1.2 1.2 0 0 1 0 1.7l-7.7 7.7z`；✓=`M3.2 8.6 6.6 11.8 12.8 4.6`；⊘=`circle cx8 cy8 r5.4`+`M4.4 4.4 11.6 11.6`。图标色：新建 #FA5C8D/深#FB7AA5、完成 #FBAF5D/深#FCBB74、放弃 text-secondary。空组整组不渲染。
- 条目（笔记条降级版）：高 28px 圆角 8px bg-card，左 4px 色条=该笔记当前分区色，文字 13px/400 text-primary 单行 ellipsis，条间距 4px；「完成/放弃」组条目加 line-through 1.5px + §H 对应置灰/褪色 token，「新建」组为普通态。组内按事件时间升序（createdAt/statusAt）。
- 空态日期：详情区居中「这天没有留下记录」12px/400 text-muted-strong，下方 §J 马克笔划线（opacity 0.5）。

### P. 空月与动效汇总
- 整月无记录：网格与表头照常渲染、全月无点；未点选日期时详情区显示默认提示「点一个日期，回看那天的记录」12px/400 text-muted-strong（覆盖层刚打开即此态）。
- 动效参数汇总：覆盖层进场 220ms ease-out（§M）、退场 160ms ease-in、翻月 200ms ease-out、日历压缩/详情展开 220ms ease-out、日期格 hover 120ms ease-out；记录点在覆盖层进场完成后逐个 scale(0→1) 120ms ease-out，按格序间隔 30ms。prefers-reduced-motion 时以上全部瞬时呈现（0ms）。

## v1.5 增补：日历下拉卡片（F15 形态迁移；与 §M–§P 冲突处以本节为准，迁移映射见 §R）

### Q. 卡片容器（决策点 23）
- 尺寸：宽 288px；高随内容自适应（5 行月最矮，6 行月 worst case 顶满上限），max-height 460px。纵向结构（上到下）：padding 8px 12px 8px → 头部 26px → 星期表头 18px（margin-top 4px）→ 网格（margin-top 2px，6 行 worst 6×34+5×2=214px）→ 详情区（margin-top 6px，max-height 174px，flex:1）。6 行 worst case 合计 8+26+4+18+2+214+6+174+8=460px 整。
- 锚定：position:absolute 于窗口坐标系，top:56px（=顶栏 48px + 8px 间距）；**右缘与顶栏右缘对齐**（右缩进 12px，与收起按钮右缘同一条线），即 left:60px / right:12px（360−12−288=60）。不选「按钮右缘对齐」理由：日历按钮右缘 x=284，288px 卡片左缘将落在 x=−4，越出窗口。
- 外观：圆角 12px；背景/描边/阴影原样沿用 §M（浅#F2F2F7F8/深#1E1E24F8 + blur(24px) saturate(1.4)、1px stroke、0 8px 24px rgba(0,0,0,0.18)/深 rgba(0,0,0,0.45)）。z-index 20，关闭后销毁。
- 进出场：进场 opacity 0→1 + translateY(-6px→0) + scale(0.98→1)，transform-origin:100% 0（自锚点右上生长），160ms ease-out；退场反向 120ms ease-in。
- 小箭头指示（决策点 25）：**不加**。按钮正下方弹出 + 图标激活底色（§L）已明示锚定关系；省下约 8px 高度预算，且免去深浅色下箭头可辨性负担。
- 头部行 26px：翻月箭头 22×22px（chevron 12px，规格同 §N）分居年月标题两侧、整组水平居中；年月标题 13px/700 text-primary；✕ 关闭钮 absolute right:8px 垂直居中（见 §T）。

### R. §L–§P 迁移映射表
- 原样保留（零改动）：§L 全部（图标 path、28×28 按钮、激活态、tooltip）；§N 今天环 2px 渐变描边手法、选中态单端实底、未来置灰 #C7C7CC/#48484E、记录点渐变与「多事件一点」、翻月 200ms ease-out、格 hover 120ms ease-out；§O 三组顺序与组图标/组色、line-through 置灰/褪色 token、空态文案「这天没有留下记录」；§P 空月渲染、默认提示、记录点逐个进场（120ms/间隔 30ms）；§G 全部渐变禁令继续适用；深色 grad-brand-dark token 不变。
- 改值（旧→新）：日期格 42→34px；格 gap 4→2px；格数字 13→12px（top 5→4px）；今天环 26→22px（描边仍 2px）；选中圆 28→24px、内数字 13→12px/700；记录点 5×5→4×4px（与数字间距 2px 不变）；可点日 hover 圆角 10→8px；翻月位移 8→6px；月历头部行 36→26px、标题 14→13px/700、箭头 chevron 14→12px；星期表头 22→18px（字 11px/600 不变）；组头行 24→22px、组图标 14→12px；详情条目 28→26px、文字 13→12px（圆角 8px/色条 4px 不变）；关闭钮 28→22px（✕ 14→13px）。
- 废弃（由 §Q/§S 替代）：§M 覆盖层容器全套（340×572 inset 定位、圆角 16px、220/160ms 进出场、z 语义「锁底层」）；§O「日历压缩上移」策略与压缩动画（42→30px 等）；§P 动效汇总中覆盖层条目。

### S. 详情区滚动（决策点 24）
- 判断：**详情区独立滚动**（否决整卡滚动与压缩式）。理由：卡片高度已贴 460 上限，整卡滚动会使月历漂移、失去锚定感；压缩式要在 34px 小格上二次挤压，可读性差。月历区固定不动，仅详情区 overflow-y:auto，满足「分组语义不变 + 全部条目可达」验收。
- 详情区常驻网格下方：未选日期时显示默认提示「点一个日期，回看那天的记录」（§P 原文），选中后内容 120ms ease-out fade 切换；空组整组不渲染（§O 原规则）。
- 滚动条：宽 8px，thumb 浅#0000001A/深#FFFFFF1A 圆角 4px，hover 加深至 #0000002E/#FFFFFF2E。
- 高度预算核对（6 行月）：详情可视高 = 460 −（8+26+4+18+2+214+6+8）= 174px，约 6 条详情条目（26px+4px 间距）可视，滚动可达全部。

### T. 点外关闭与关闭入口
- 点外关闭（决策点 21 配套）：无遮罩、不锁底层，看板 hover 照常。前端口径：document 级 pointerdown **捕获阶段**监听，target 不在卡片 DOM 内即关闭，并标记该次点击已消费（stopPropagation 或 flag 抑制），保证「点外仅关闭、不触发看板双击/编辑」验收；再次点击顶栏日历图标 = toggle；Esc 关闭。样式层无额外要求。
- 卡片内 ✕：**保留**（判断：360px 窗内点外关闭的「外」区域小、且多与看板可点元素重叠，✕ 提供零歧义关闭入口；PRD 允许可选，此处定保留）。规格：头部行 absolute right:8px、22×22px 圆角 6px，✕ 13px stroke 1.6（path 同 §M `M4.5 4.5 11.5 11.5 M11.5 4.5 4.5 11.5`），色 text-secondary，hover 变 text-primary + 背景 token hover，active 缩放 0.92。
- 四路关闭等价：点外 / Esc / 再点图标 / ✕，任一关闭后卡片销毁、看板数据不变（沿用 §M「关闭后销毁无保留态」）。

### U. 深色模式卡片 token（增量，其余沿用 §1/§G 深色列）
| 元素 | 深色值 |
|---|---|
| 卡片底/描边/阴影 | #1E1E24F8 / #FFFFFF14 / rgba(0,0,0,0.45) |
| 头部标题/星期表头/格数字 | #F5F5F7 / #98989F / #F5F5F7（沿 §1） |
| 激活日历图标+底色 | #FB7AA5 + #FB7AA51F（§L 原样） |
| 今天环/记录点/组图标渐变 | grad-brand-dark：#FB7AA5→#FCBB74（§G 原样） |
| 选中日实底/未来数字 | #FB7AA5 / #48484E |
| ✕/箭头/滚动条 | #98989F（hover #F5F5F7）/ 同 / #FFFFFF1A（hover #FFFFFF2E） |

## v1.6 增补：F16 分区标题显示模式 + F17 悬停粘贴（追加章节，§V/§W；与 §2/§3/§J 分区标题旧描述冲突处以本节为准：原「竖色条+分区名」由徽标体系取代）

### V. F16 分区标题显示模式（决策点 26）
- 徽标形态（两种模式共用常驻元素）：胶囊 高 20px、padding 0 7px、min宽 30px、圆角 6px，底=分区色（浅 #FF3B30/#FF9500/#FFCC00/#8E8E93，深 #FF453A/#FF9F0A/#FFD60A/#6C6C72）；文字「P0-P3」11px/700、letter-spacing 0.3px、白字，仅 P2 例外用深字 浅#1D1D1F/深#141418（黄底白字对比不足）。防塌行：标题行高 32px 不变（§3），行内 display:flex; align-items:center，徽标 height:20px + line-height:1。
- 精简态（默认）：标题行内容 = 徽标 + 6px + 条数角标（规格沿用 §2 胶囊，白字分区色底；P2 角标同徽标用深字）。原 §3 左侧 12×12 竖色条在两种模式下均移除（徽标已承担分区色标识）。
- hover 临时文字（仅精简模式）：行内浮现，非气泡——absolute 于标题行内，left=角标右缘+8px，top:50%+translateY(-50%)，单行 nowrap 12px/600，色 text-secondary（浅#8E8E93/深#98989F），pointer-events:none；脱离文档流零布局抖动，12px 文字居中于 32px 行内不溢出不遮笔记条。动效复用 §C 参数：opacity 0→1 + translateX(-4px→0)、150ms ease-out、浮现 delay 120ms / 消失 delay 0ms。完整模式 hover 无额外行为。
- 双击全局切换反馈：精简→完整，四分区分区名同时 fade + translateX(-4px→0) 入场 150ms ease-out、无 delay；完整→精简，分区名 120ms ease-in fade 出场。徽标两态位置尺寸完全不变，全程无布局位移、无 toast。完整模式排版：徽标 + 6px + 分区名（12px/700 分区色 letter-spacing 0.3px，§J）+ 6px + 角标，行高 32px 不变。
- 与 F3 热区感知：标题行（0–32px）cursor:default；标题行以下分区空白区（笔记列表区/空态区）cursor:text——以光标差异 + 精简态 hover 浮字双暗示边界，无分隔线；热区精确判定归前端（决策点 27）。
- 深色：徽标底/hover 文字色已在上面内嵌给出；无其他增量 token。

### W. F17 悬停粘贴（决策点 28/29）
- 可粘贴提示（挂载态 .paste-ready，三条件由前端判定：悬停分区容器 且 剪贴板含非空文本 且 焦点不在任何输入控件）：① 分区容器 outline 1.5px dashed 当前分区色（深浅同用各自分区色），outline-offset -3px、圆角 10px，outline-color 由 transparent 过渡至实色 180ms ease-out；② 微提示「⌘V 粘贴到这里」absolute top:6px right:12px 于分区内，胶囊 高 20px、padding 0 8px、圆角 6px、背景 #1D1D1FF2+blur(12px)（复用 §C 气泡底，深浅色同用）、文字 #F5F5F7 11px/600、⌘V 符号照排，pointer-events:none，进场 opacity 0→1 + translateY(2px→0) 150ms ease-out。两元素均不占文档流，360px 窗内零 reflow；与笔记条 hover 反馈（§I）分属容器级/条级，可叠加不冲突。分区悬停期间 cursor:default。
- 条件失效退场（含焦点进入输入框、移出分区）：提示整体 120ms ease-in fade-out；输入焦点态下 .paste-ready 永不挂载（F17 输入框优先验收的样式层保障），系统默认粘贴照常。
- 粘贴成功反馈：新笔记入场 300ms ease-out，opacity 0→1 + translateY(8px→0)，同时背景高亮 keyframes paste-flash：0% 浅#FA5C8D26/深#FB7AA526 → 100% bg-card（深用深 bg-card 值）。prefers-reduced-motion 时 0ms 瞬时。无 toast（PRD 决策点 29：新笔记出现本身即最低验收线）。
- 该入场动画统一作为 F2/F3/F17 全部新建笔记的入场（此前未定义，本轮补齐，一次实现三处复用）。
- 超长文本展示（决策点 29 落定）：不引入字符数阈值——展示层沿用笔记条既有单行 ellipsis（§3），数据层完整保存全文；编辑态（F4）与日历详情条目（§S）均按全文数据渲染、条内单行 ellipsis。
- 深色增量 token：paste-flash 起始色 #FB7AA526；虚线框色=深色分区色（#FF453A/#FF9F0A/#FFD60A/#6C6C72）；微提示气泡沿用 §C 深底（#1D1D1FF2/#F5F5F7），深浅一致。

## v1.7 增补：迭代 v1.7 设计规范（F18-F21，追加章节 §X/§Y/§Z/§AA；§3 顶栏右组排布以本节为准）

### X. F18 顶栏关闭按钮（决策点 31）
- 图标：✕ 线稿，viewBox 0 0 16 16 渲染 14×14，fill:none; stroke:currentColor; stroke-width:1.2; stroke-linecap/linejoin:round（线宽与图钉 §A/日历 §L 完全一致）；path=`M4.5 4.5 11.5 11.5 M11.5 4.5 4.5 11.5`。与收起按钮（chevron.down）形态正交，一眼可区分。
- 按钮：28×28px 圆角 6px、图标居中、no-drag、cursor:pointer（与顶栏其他 icon-btn 同规格）。
- 颜色（全部引用既有 token，无新增）：常态 color=text-secondary（浅#8E8E93/深#98989F）；hover color=text-primary + 背景 token hover（浅#0000000A/深#FFFFFF0F），120ms ease-out；active 缩放 0.92；focus-visible outline 2px #FA5C8D（深#FB7AA5）offset 2px（同 §L）。
- hover **不变红**（决策）：退出=自动落盘的安全操作，非破坏性行为，无需警示色；且红色 hover 会打破顶栏四按钮统一的 hover 语言（F20 正是要消除顶栏体验割裂）。退出与收起的语义区分由 tooltip 文字「退出应用」承担。
- 排布：顶栏右组从左到右 日历 → 图钉 → 收起 → 关闭，按钮间距 4px，关闭按钮右缘距顶栏 padding 12px；右组宽 28×4+4×3=124px。胶囊态不加关闭按钮（PRD 硬边界）。
- tooltip：文案「退出应用」，完全复用 §C 规格（absolute、top:calc(100%+6px)、气泡 #1D1D1FF2+blur(12px)、文字 #F5F5F7 12px/400、padding 5px 10px、圆角 6px、z-index 10、小三角 8×8 rotate45、120ms ease-out、浮现 delay 150ms/消失 0ms、pointer-events:none）。

### Y. F19 P1 分区文案修订（纯文案，零样式改动）
- P1 文字：「重要且不紧急」→「重要但不紧急」，覆盖**两处 DOM**：完整模式常驻标题（zone-title）与精简模式 hover 浮现文字（zone-title-float），必须同源同步，禁止一新一旧。
- P0/P2/P3 文案不动（重要且紧急 / 不重要但紧急 / 不重要且不紧急）。字号/字重/颜色沿 §V（完整模式 12px/700 分区色；hover 浮现 12px/600 text-secondary）。§3 旧排版行内 P1 名称同步以本节为准。

### Z. F20 收起/展开按钮 hover 提示（决策点 33 落定）
- 展开态顶栏收起按钮：hover 浮现「收起为胶囊」，**完全复用 §C 全套规格**（含 150ms 浮现 delay、120ms 过渡、气泡/小三角/pointer-events:none/z-index 10），不新造任何 token；键盘可达：触发选择器 :hover 与 :focus-visible 并列（同 delay），满足 AC4。
- 需移除的原生 title：①顶栏收起按钮（展开态 DOM）；②顶栏展开按钮（胶囊展开后顶栏内同一按钮的收起态 title 一并清理）——凡挂 .pin-tip 自绘提示的节点一律不得残留 title 属性（AC2 双 tooltip 禁令）。
- 胶囊态展开按钮（决策点 33）：**豁免，不做自绘 tooltip，保留原生 title**。理由：胶囊窗口高度仅 40–48px、宽度 128–260px，自绘气泡（含 6px 偏移+三角 8px）无处安放，任何 absolute 摆位都会越出窗口边界被 frameless 裁剪；此结论在 PRD 128×40 与本文 §3 260×48 两套尺寸下均成立。实现说明中如实声明即可（PRD 允许豁免）。
- 硬性要求沿 F11：无布局抖动、不遮挡日历/图钉/关闭热区、移开消失——气泡伸入 P0 区域上方，§C 定位天然满足。

### AA. F21 undo toast 上移（决策点 34 落定）
- 定位规则：toast 底边 = bottombar 上边线 − 8px 垂直间距；换算为 fixed 定位 `bottom: 56px`（bottombar 高 48px + 间距 8px），`left:50% + translateX(-50%)` 水平居中。机器可校验：toast 底边 y < bottombar 顶边 y（640−48=592 线上方）。
- 【新增 token】`--space-toast-gap: 8px`（toast 与底部模块上边线的垂直间距，唯一新增值；实现写 bottom: calc(48px + var(--space-toast-gap))）。其余尺寸沿用：高 36px、圆角 10px、背景 bg-card+blur、4s 存活、撤销按钮 pointer-events 规则不变。
- 动画：时长/缓动沿用既有 180ms ease-out 滑入/滑出，**方向由自下滑入改为自上滑入**（进场 translateY(-8px→0)、退场 translateY(0→-8px)）。理由：若保留自下 (+8px)，进场首帧 toast 矩形会向下越过 bottombar 上边线、与渐变描边 wrapper 相交，违反「显示期间任何时刻不相交」硬约束；自上滑入全程位于上边线之上。prefers-reduced-motion 时 0ms 瞬时。
- 聚焦外发光避让：§K 聚焦发光为 wrapper 外扩 shadow 0 0 0 3px，即发光上沿最高到 bottombar 上边线上方 3px；toast 底边在上边线上方 8px，净空 5px，两者不相交。z-index 补齐为 40（高于日历卡 §Q 的 20 与顶栏气泡 §C 的 10，此前未写明，本轮落定）。

## v1.8 增补：迭代 v1.8 设计规范（F22-F24，追加章节 §AB/§AC/§AD；§4「就地输入：该分区标题下插入」的旧位置描述以本节为准）

### AB. F23 分区底部常驻空白区（决策点 36 落定）
- 尺寸与结构：每个分区 .note-list 末尾常驻一个空白区块，**高 36px、宽=列表内容全宽 336px（沿 §3 列表 padding 0 12px）**，位于最后一条笔记（或空态文案）之下、分区底部 1px stroke 分隔线之上；随分区内容正常滚动，不悬浮不固定。【新增 token】`--zone-foot-min: 36px`（唯一新增尺寸值，取 PRD 下限：与笔记条高 36px 同值，模块节奏一致）。空白区替换 §3 列表 padding-bottom 8px（8px 计入 36px 内，即笔记末条距空白区顶 8px）。
- 常态视觉：纯空白——透明背景、无边线、无文案、无渐变落点（§G 禁令继续适用）；光标 cursor:text（沿 §V 空白区规则，与标题行 cursor:default 划界）。
- hover 微提示（决策点 36 选「悬停微提示」，非常驻文案，满足 F23 AC4 例外条款）：hover 时区内水平居中浮现「双击记一条」12px/400 text-muted-strong（浅#6D6D72/深#A5A5AC，§G 对比达标 token），无 italic、无划线；整区背景 token hover（浅#0000000A/深#FFFFFF0F）、圆角 8px；opacity 0→1 150ms ease-out、浮现 delay 120ms / 消失 delay 0ms（复用 §V hover 浮字时序）。active（双击按下瞬间）无独立视觉，双击直接交由 F24 打开输入条。
- 引导去重（防与 F7 空态叠加）：**零笔记分区 hover 不显示「双击记一条」微文案**（空态文案+§J 划线已在上方承担引导，避免双提示）；有 ≥1 条笔记的分区才显示。分区角标、空态文案位置均不受影响。
- 双击热区边界：空白区整体 336×36px 均为 F3 双击热区（含 hover 提示文字，文字节点 pointer-events:none 不截点击）；上边界=最后一条笔记条底缘+8px，不与笔记条热区重叠（笔记条双击无动作，落点在笔记条上仍被忽略，现状不变）；下边界=分区 stroke 线；左右边界=列表 padding 内缘。空白区同属 F17 悬停 ⌘V 分区热区（§W 容器 outline 覆盖到本区）。与 F16 标题热区互不串扰（双击本区只弹输入框）。
- 与分区边线关系：底部 1px stroke 分隔线保留在空白区之下、归属本分区外缘，空白区不压线、不描边、不为其加圆角容器（hover 底色圆角 8px 是热区暗示，非结构性边框）。

### AC. F24 就地输入条位置下沉
- 位置：输入条出现位置=**F23 空白区槽位**，即分栏最底部——非空分区为最后一条笔记之下，空分区为空态文案之下；输入条打开期间 F23 空白区被输入条占据（空白区就是输入条的预留槽），其上方笔记条零位移、无滚动跳变。
- 尺寸与样式：高 32px、宽 336px（=空白区槽内），完全沿用 §4 就地输入条样式（同顶栏输入框样式、placeholder「记一条，回车保存」、文字 13px/400 placeholder=text-secondary）+ §K 渐变描边聚焦态（wrapper padding 1.5px 背景 grad-brand/深 grad-brand-dark、圆角 10px、内层圆角 8.5px、聚焦 shadow 0 0 0 3px #FA5C8D1F/深#FB7AA51F、160ms ease-out）。在 36px 槽内垂直居中（上下各 2px）。
- 行为不变项（PRD 硬约束，样式零改动）：自动聚焦、Enter 保存、Esc 取消、blur 取消、同一时刻最多一个输入条；写入后新笔记按 F22 落 open 组末尾，入场动画沿用 §W 300ms ease-out + paste-flash 高亮（三处复用口径不变），F15「新建」事件自然生效。
- 出现动画：入场 opacity 0→1 + translateY(4px→0) 180ms ease-out（沿 §4 原参数）；Esc/blur 取消退场 opacity 1→0 + translateY(0→4px) 120ms ease-in。写入保存后输入条直接移除（无退场过渡），新笔记以 §W 入场动画衔接。prefers-reduced-motion 时 0ms 瞬时。自动滚动至可见由前端实现（AC4 只验结果）。

### AD. F22 分区内状态分组排序（纯渲染逻辑，样式层决策）
- 结论：**分组之间不加任何视觉分隔**（无分隔线、无分组标题、无间距突变、无背景分层）。理由：① 三态已有强视觉自明性——open=常态渐变呼吸点、done=渐变✓徽标+置灰+浅背景、dropped=✕+整条 opacity 0.55（§H），组边界由条目样式直接可读，加分隔线属重复表达；② 360×640 小窗四分区高度预算紧张，36px 笔记条已是最小信息单元，每分区再插 2 条分隔线（1px+上下 margin≥8px）×4 分区会加剧拥挤，违反「窗口小巧克制」红线（F14 同源约束）；③ 不引入新视觉元素，深浅色两套、F13 四分区识别、§G 渐变禁令全部零新增校验面。
- 排序变化动画：状态变更（完成/取消/⇅ 移动）导致条目重排时**瞬时生效、无 FLIP 位移动画**。理由：多条目同时重排的 180ms 交错位移在小窗内观感混乱，且需额外处理 reduced-motion 分支；「完成沉底」的动觉反馈已由 §H 三态样式过渡（200ms ease-out opacity/删除线/色条）承担。仅新建笔记保留 §W 入场动画（不受排序影响，恒落 open 组末尾）。
- 排序键（入区时间/statusAt/并列兜底）与渲染层实现归前端（PRD 决策点 37/38），样式层无参与项、无新增 token。

## v1.9 增补：迭代 v1.9 设计规范（F25-F28，追加章节 §AE-§AH）

### AE. F25 长按拖拽排序（决策点 40 落定）
- 就绪态（长按满 500ms 且位移 ≤4px）：原条原地抬升——scale(1.03) + box-shadow 0 8px 24px rgba(0,0,0,0.20)（深 rgba(0,0,0,0.45)，沿用 §Q 卡片阴影量级，与 §I hover 的 0 2px 8px 量级拉开两档，两态可辨）+ opacity 0.92（13px text-primary 对 bg-card 基准 12.6:1，×0.92 后仍 ≥4.5:1，文字可读硬约束达标）+ cursor:grabbing；过渡 180ms ease-out。进入就绪即全局挂 .dragging 类。
- 拖动中：① 原位占位=同尺寸虚线框——高 36px、宽 336px（沿 §AB 槽宽）、border 1.5px dashed color-mix(分区色 50%, transparent)（沿 §H color-mix 手法；§W 为容器级 outline 实色，此处为条级 36px 槽半透明虚线，层级/形态可辨）、圆角 12px（§H 条圆角）、背景透明；② 跟手幽灵条=position:fixed、336×36px、bg-card、opacity 0.85、scale(1.03)、就绪态同款阴影、pointer-events:none、transform 无过渡（跟手零延迟），文字 13px text-primary 全程可读。
- 落点指示：占位空隙方案——虚线框随拖动实时渲染在「当前插入位」（即该虚线框本身兼作落点指示，不另画插线）；组边界不可越=落点计算限定同分区同状态组内，拖出组范围时虚线框吸附本组上/下边界内缘不再移动（吸附即提示，不另加警示色）。
- 松手：组内落位——虚线框消失、seq 生效渲染，无额外动画（沿 §AD「排序瞬时生效」口径）；取消（原地松手/越界松手，AC3/AC4）——回弹：跟手条自当前位置插值位移回原槽位，180ms ease-out，scale 1.03→1、opacity 0.85→1 同步复原，到位后移除跟手条、恢复原条。
- 拖拽期间交互抑制（.dragging 全局类）：.nact 操作组 opacity:0 + pointer-events:none；呼吸点隐藏（同 §I hover 隐藏处理）；其余笔记条 hover 抬升/底色禁用（.dragging 下 .note:hover 不触发 §I 变换）。就绪态原地松手不触发任何 click/dblclick（前端时序，决策点 43）。
- prefers-reduced-motion：就绪态抬升无过渡（阴影/cursor 直接切换）、回弹 0ms 瞬时复位、跟手条始终无过渡不变。【新增 token】`--drag-shadow: 0 8px 24px rgba(0,0,0,0.20)`（深 rgba(0,0,0,0.45)），唯一新增值；其余全部引用既有 token。

### AF. F26 双击笔记条就地编辑
- 就地输入条**完全沿用既有规格，零新增**：高 36px 输入框 + §K 渐变描边 wrapper（padding 1.5px 背景 grad-brand/深 grad-brand-dark、圆角 10px、内层 8.5px、聚焦 shadow 0 0 0 3px #FA5C8D1F/深#FB7AA51F、160ms ease-out）、预填原文全选自动聚焦、Enter 保存 / Esc 取消 / blur 取消 / 空文本取消——全部照抄 §4「编辑」+ §K。
- 进入方式（建议，兼容成本最低）：**原条原地变输入框**——双击处理器直接复用现有 startEdit 同一入口（现状 ✎ 按钮已是「条原地变 36px 输入框」，双击仅新增一条触发路径，零新样式零新布局）；否决「隐藏原条+旁挂输入条」（会出现 36+36px 双高度闪动，需新布局分支）。进入/退出无独立动画（与现状 ✎ 编辑一致）；保存后按 F22 v1.9 两层规则重渲染落位（沿 §AD 瞬时生效无 FLIP）。
- 单实例约束与 §AC/F24 同源共用：同一时刻最多一个编辑输入条；编辑 A 时双击 B = A 的输入条按 blur 取消、B 进入编辑。热区=.note 本体；.nact 按钮双击不触发（前端判定）；编辑态输入框长按为原生文本选区，天然不触发 F25 拖拽。

### AG. F27 零笔记分区隐藏底部空白区（纯逻辑变更，无新视觉）
- 渲染规则：分区笔记数=0 时 render 不输出 .zone-foot 节点（DOM 不存在），空态文案（§J）下缘直接接分区底部 1px stroke 分隔线（§3），无 36px 空白块；有 ≥1 条笔记分区维持 §AB 全部规格零改动（36px/--zone-foot-min、hover 微文案、双击热区、圆角 8px hover 底色）。
- 无新 token、无新视觉、无过渡动画：0↔1 条切换随 render 即时挂载/移除节点（F27 AC4 即时性要求，不加 fade，避免与 §AB hover 时序耦合出半态）。
- 空态热区不受影响：.empty 空态区仍属 F3 双击热区与 F17 悬停 ⌘V 分区热区（§AB「空白区同属分区热区」语义由空态区全量承接）；空分区就地输入条挂载位（决策点 41）位于空态文案之下，样式沿用 §AC（32px/渐变描边/180ms 入场），关闭后无残留。§AB「零笔记分区 hover 不显示微文案」的去重规则随 foot 移除自然失效，无需改。

### AH. F28 「双击记一条」微文案垂直居中（决策点 42 落定）
- 方案：**绝对居中**。否决 padding 对称化（8px 12px 8px 会把内容盒压至 20px，F24 输入条 32px 在槽内居中的既有布局会被破坏，违反 AC2）；否决 line-height（与 flex 叠加须双改两处）。落定实现：.zone-foot 加 position:relative（唯一新增属性）；微文案改 position:absolute; inset:0; display:flex; align-items:center; justify-content:center——文字行盒（12px×1.4≈16.8px）垂直中心 = 36px 槽中心，上/下留白各 ≈9.6px 完全对称，偏差 0px ≤1px。
- 脱离文档流，F24 输入条在槽内的既有布局零影响；水平居中（justify-content:center）、12px/400 text-muted-strong（浅#6D6D72/深#A5A5AC）、浮现 delay 120ms / 过渡 150ms ease-out、pointer-events:none、hover 底色 token hover 圆角 8px——全部沿 §AB 原值不变。深浅色双外观均居中（AC3）。
- 机器校验口径：|微文案行盒中心 y − foot 槽中心 y| ≤ 1px（getBoundingClientRect）；foot 高度仍 = --zone-foot-min 36px；末条笔记与 foot 上缘 8px 呼吸（§AB padding-top 8px）不变。
