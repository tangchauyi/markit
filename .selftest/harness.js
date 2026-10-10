/* 前端自测 harness：mock DOM + localStorage，加载 index.html 内联脚本做断言
   注：本文件刻意不启用 strict mode，否则 direct eval 的变量无法进入本作用域
   覆盖：F12 旧数据兼容 / 三态渲染 / 角标口径 / 状态持久化 / 有状态笔记仍可管理
   v1.7 增补 T7：F18 关闭按钮退出链路 / F19 P1 文案 / F20 title 移除 / F21 toast 上移 */
var fs = require('fs');
var path = require('path');

/* ---------------- mock DOM ---------------- */
function El(tag) {
  this.tagName = tag;
  this.children = [];
  this.dataset = {};
  this.style = {};
  this.className = '';
  this.innerHTML = '';
  this.value = '';
  this.attrs = {};
  this.parentNode = null;
  this._text = '';
  var self = this;
  var classes = new Set();
  this.classList = {
    add: function (c) { classes.add(c); sync(); },
    remove: function (c) { classes.delete(c); sync(); },
    toggle: function (c, v) {
      if (v === undefined) v = !classes.has(c);
      v ? classes.add(c) : classes.delete(c); sync();
    },
    contains: function (c) { return classes.has(c); }
  };
  function sync() { self.className = Array.from(classes).join(' '); }
}
Object.defineProperty(El.prototype, 'textContent', {
  get: function () { return this._text; },
  set: function (v) { this._text = String(v); this.children = []; }
});
El.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); return c; };
El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); if (k === 'class') { this.className = String(v); } };
El.prototype.getAttribute = function (k) { return this.attrs[k]; };
El.prototype.addEventListener = function (t, f) { (this._ls = this._ls || {})[t] = (this._ls[t] || []).concat(f); };
El.prototype.remove = function () {
  if (this.parentNode) {
    var i = this.parentNode.children.indexOf(this);
    if (i > -1) this.parentNode.children.splice(i, 1);
  }
};
El.prototype.querySelector = function () { return null; };
El.prototype.closest = function () { return null; };
El.prototype.contains = function () { return false; };
El.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, right: 22, bottom: 22, width: 22, height: 22 }; };
El.prototype.insertAdjacentElement = function (pos, el) { this.appendChild(el); return el; };
El.prototype.focus = function () {};
El.prototype.select = function () {};

var lists = { 0: new El('div'), 1: new El('div'), 2: new El('div'), 3: new El('div') };
var badges = { 0: new El('span'), 1: new El('span'), 2: new El('span'), 3: new El('span') };
var ids = {};
['app', 'quickInput', 'collapseBtn', 'expandBtn', 'sectionsScroll',
 'capsuleCount', 'toast', 'undoBtn', 'pinBtn', 'calBtn', 'closeBtn'].forEach(function (id) { ids[id] = new El(id); });

global.document = {
  createElement: function (t) { return new El(t); },
  createElementNS: function (ns, t) { return new El(t); },
  getElementById: function (id) { return ids[id]; },
  querySelector: function (sel) {
    var m = /\.note-list\[data-list="(\d)"\]/.exec(sel);
    if (m) return lists[m[1]];
    var b = /\.zone-badge\[data-count="(\d)"\]/.exec(sel);
    if (b) return badges[b[1]];
    return null;
  },
  addEventListener: function () {},
  body: new El('body')
};
global.window = global;
global.innerWidth = 360; global.innerHeight = 640;
global.localStorage = {
  _s: {},
  getItem: function (k) { return (k in this._s) ? this._s[k] : null; },
  setItem: function (k, v) { this._s[k] = String(v); }
};

/* ---------------- 造旧格式 + 混合数据（无 status / 非法 status） ---------------- */
localStorage._s.markit_notes = JSON.stringify([
  { id: 'a', text: '旧数据A', priority: 0, createdAt: 1 },            // 无 status → open
  { id: 'b', text: '旧数据B', priority: 3, createdAt: 2 },            // 无 status → open
  { id: 'c', text: '已完成C', priority: 1, createdAt: 3, status: 'done' },
  { id: 'd', text: '不干了D', priority: 2, createdAt: 4, status: 'dropped' },
  { id: 'e', text: '脏数据E', priority: 3, createdAt: 5, status: 'weird' } // 非法 → open
]);

/* ---------------- 加载被测脚本（去掉 use strict 以便 eval 变量入当前作用域） ---------------- */
var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var m = /<script>([\s\S]*)<\/script>/.exec(html);
if (!m) { console.error('FATAL: 未提取到内联 script'); process.exit(1); }
var src = m[1].replace(/'use strict';/, '');
eval(src); // var/function 进入本作用域

/* ---------------- 断言 ---------------- */
var passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('PASS  ' + msg); }
  else { failed++; console.log('FAIL  ' + msg); }
}
function stored() { return JSON.parse(localStorage._s.markit_notes); }
function rowActs(row) {
  return row.children.filter(function (c) { return c.className.indexOf('note-actions') > -1; })[0]
    .children.map(function (b) { return b.dataset.act; });
}
function rowFlag(row) {
  return row.children.filter(function (c) {
    return c.className.indexOf('note-flag') > -1 || c.className.indexOf('note-dot') > -1;
  })[0];
}

/* T1 旧数据兼容：无 status 视为 open，不报错 */
assert(notes.length === 5, 'T1a 旧格式 5 条全部加载');
assert(notes[0].status === 'open' && notes[1].status === 'open', 'T1b 无 status 字段 → open');
assert(notes[4].status === 'open', 'T1c 非法 status 值 → 兜底 open');
assert(notes[2].status === 'done' && notes[3].status === 'dropped', 'T1d done/dropped 正常读取');

/* T2 角标口径：分区角标与胶囊总角标只计 open */
assert(badges[0].textContent === '1', 'T2a P0 角标=1（open only）');
assert(badges[1].textContent === '0', 'T2b P1 有 1 条 done → 角标 0');
assert(badges[2].textContent === '0', 'T2c P2 有 1 条 dropped → 角标 0');
assert(badges[3].textContent === '2', 'T2d P3 角标=2');
assert(ids.capsuleCount.textContent === '3', 'T2e 胶囊总角标=3（5 条中 2 条已标状态）');

/* T3 三态渲染：行 data-status / 行尾标记 / 操作组按钮集 */
var p0rows = lists[0].children;
assert(p0rows.length === 1 && p0rows[0].dataset.status === 'open', 'T3a open 行 data-status=open');
assert(rowFlag(p0rows[0]) && rowFlag(p0rows[0]).className === 'note-dot', 'T3b open 行尾有呼吸点（F14 常态线索）');
assert(JSON.stringify(rowActs(p0rows[0])) === JSON.stringify(['priority', 'edit', 'done', 'drop', 'delete']),
  'T3c open 操作组=[⇅][✎][✓][⊘][✕]');
var p1rows = lists[1].children;
assert(p1rows[0].dataset.status === 'done', 'T3d done 行 data-status=done');
assert(rowFlag(p1rows[0]).className.indexOf('note-flag-done') > -1, 'T3e done 行尾=渐变✓徽标');
assert(JSON.stringify(rowActs(p1rows[0])) === JSON.stringify(['priority', 'edit', 'undo', 'delete']),
  'T3f done 操作组=[⇅][✎][↺][✕]');
var p2rows = lists[2].children;
assert(p2rows[0].dataset.status === 'dropped', 'T3g dropped 行 data-status=dropped');
assert(rowFlag(p2rows[0]).className.indexOf('note-flag-drop') > -1, 'T3h dropped 行尾=灰✕');

/* T4 状态流：done → undo → open，原分区原位，持久化 */
var idxBefore = findIndexById('a');
setStatus('a', 'done');
assert(findIndexById('a') === idxBefore, 'T4a 标完成后留在原分区原位（notes 数组下标不变）');
assert(stored().filter(function (n) { return n.id === 'a'; })[0].status === 'done', 'T4b done 已写入 localStorage');
assert(badges[0].textContent === '0' && ids.capsuleCount.textContent === '2', 'T4c 角标随状态扣减');
setStatus('a', 'open');
assert(stored().filter(function (n) { return n.id === 'a'; })[0].status === 'open', 'T4d 取消恢复 open 并持久化');
assert(findIndexById('a') === idxBefore && lists[0].children.length === 1, 'T4e 取消后仍在 P0 原位');
assert(badges[0].textContent === '1' && ids.capsuleCount.textContent === '3', 'T4f 角标恢复');

/* T5 有状态笔记仍可管理：编辑文字 / 切换优先级，状态保留 */
updateText('c', '已完成C-改');
assert(stored().filter(function (n) { return n.id === 'c'; })[0].text === '已完成C-改', 'T5a done 笔记可编辑');
assert(stored().filter(function (n) { return n.id === 'c'; })[0].status === 'done', 'T5b 编辑后 done 状态保留');
setPriority('c', 0);
var movedC = stored().filter(function (n) { return n.id === 'c'; })[0];
assert(movedC.priority === 0 && movedC.status === 'done', 'T5c done 笔记可移动且状态保留');
var p0After = lists[0].children;
assert(p0After.length === 2 && p0After.some(function (r) { return r.dataset.id === 'c' && r.dataset.status === 'done'; }),
  'T5d 移动后渲染行仍带 done 态');

/* T6 删除 + 撤销：有状态笔记删除后撤销，状态完整恢复 */
deleteNote('d');
assert(stored().length === 4, 'T6a 删除已持久化');
undoDelete();
var backD = stored().filter(function (n) { return n.id === 'd'; })[0];
assert(!!backD && backD.status === 'dropped' && backD.priority === 2, 'T6b 撤销恢复 dropped 状态与原分区');

/* ============ T7 v1.7（F18-F21） ============ */
/* --- F18 顶栏关闭按钮：点击 → window.close()（退出链路 renderer→window-all-closed→app.quit） --- */
var closeCalls = 0;
window.close = function () { closeCalls++; };
assert(!!(ids.closeBtn._ls && ids.closeBtn._ls.click && ids.closeBtn._ls.click.length),
  'T7a F18 closeBtn 已挂 click 监听');
ids.closeBtn._ls.click.forEach(function (f) { f({}); });
assert(closeCalls === 1, 'T7b F18 点击关闭按钮 → 调用 window.close() 一次（不弹确认框，无新增存储逻辑）');
var closeTag = /<button id="closeBtn"[^>]*>/.exec(html)[0];
assert(closeTag.indexOf('title') === -1, 'T7c F18 关闭按钮无原生 title（tooltip 复用 .pin-tip，无双提示）');
assert(/<span class="pin-tip" aria-hidden="true">退出应用<\/span>/.test(html),
  'T7d F18 关闭按钮挂 .pin-tip「退出应用」（§X）');
assert(html.indexOf('id="calBtn"') < html.indexOf('id="pinBtn"') &&
       html.indexOf('id="pinBtn"') < html.indexOf('id="collapseBtn"') &&
       html.indexOf('id="collapseBtn"') < html.indexOf('id="closeBtn"'),
  'T7e F18 顶栏右区顺序 日历→图钉→收起→关闭（AC1）');

/* --- F19 P1 分区文案：「重要且不紧急」→「重要但不紧急」，两处 DOM 同步 --- */
assert(ZONE_NAMES[1] === 'P1 重要但不紧急', 'T7f F19 ZONE_NAMES P1=重要但不紧急（popover 呈现点同步）');
assert(ZONE_NAMES[0] === 'P0 重要且紧急' && ZONE_NAMES[2] === 'P2 不重要但紧急' &&
       ZONE_NAMES[3] === 'P3 不重要且不紧急', 'T7g F19 P0/P2/P3 文案不动（AC3）');
assert(/(?<!不)重要且不紧急/.test(html) === false,
  'T7h F19 HTML 无独立「重要且不紧急」残留（负向断言排除 P3「不重要且不紧急」，含 zone-title/zone-title-float/ZONE_NAMES）');
assert((html.match(/重要但不紧急/g) || []).length === 3,
  'T7i F19 zone-title 与 zone-title-float 两处均为「重要但不紧急」（与 ZONE_NAMES 共 3 处，无一双旧）');

/* --- F20 收起/展开按钮 hover 提示：移除原生 title，挂 .pin-tip；胶囊态豁免 --- */
var collapseTag = /<button id="collapseBtn"[^>]*>/.exec(html)[0];
assert(collapseTag.indexOf('title') === -1, 'T7j F20 顶栏收起按钮无原生 title 残留（AC2 双 tooltip 禁令）');
assert(/<span class="pin-tip" aria-hidden="true">收起为胶囊<\/span>/.test(html),
  'T7k F20 收起按钮挂 .pin-tip「收起为胶囊」（§Z 复用 §C 规格）');
var expandTag = /<button id="expandBtn"[^>]*>/.exec(html)[0];
assert(expandTag.indexOf('title="展开"') > -1,
  'T7l F20 胶囊展开按钮保留原生 title（决策点 33 豁免：128×40 窗内自绘气泡无处安放）');

/* --- F21 undo toast 上移：bottombar 上边线上方 8px、自上滑入 --- */
assert(/--space-toast-gap:\s*8px/.test(html), 'T7m F21 新增 token --space-toast-gap: 8px（§AA）');
assert(/bottom:\s*calc\(48px \+ var\(--space-toast-gap\)\)/.test(html),
  'T7n F21 toast 定位 bottom = 48px + gap（底边距 bottombar 上边线 8px，不遮挡输入框）');
assert(/transform:\s*translate\(-50%,\s*-8px\)/.test(html),
  'T7o F21 toast 自上滑入 translateY(-8px→0)（防越线遮挡渐变描边，§AA）');

/* ============ T8 v1.8（F22 渲染层排序 / F23 底部空白区 / F24 输入条下沉） ============ */
/* --- F22：受控夹具——P0 内三态混合、⇅ 移入、同键并列（PRD 第 10 章 AC1/AC3） --- */
notes.length = 0;
notes.push(
  { id: 'k1', text: '先完成', priority: 0, createdAt: 100, status: 'done',    statusAt: 900,  movedAt: 0 },
  { id: 'k2', text: '新开',   priority: 0, createdAt: 500, status: 'open',    statusAt: 0,    movedAt: 0 },
  { id: 'k3', text: '老笔记移入', priority: 0, createdAt: 50, status: 'open', statusAt: 0,    movedAt: 400 }, // ⇅ 移入：入区时间=400
  { id: 'k4', text: '旧开',   priority: 0, createdAt: 200, status: 'open',    statusAt: 0,    movedAt: 0 },
  { id: 'k5', text: '先弃',   priority: 0, createdAt: 10,  status: 'dropped', statusAt: 700,  movedAt: 0 },
  { id: 'k6', text: '后弃',   priority: 0, createdAt: 20,  status: 'dropped', statusAt: 800,  movedAt: 0 },
  { id: 'k7', text: '后完成', priority: 0, createdAt: 30,  status: 'done',    statusAt: 1000, movedAt: 0 }
);
persist();
render();
var p0Ids = lists[0].children.map(function (r) { return r.dataset.id; });
assert(JSON.stringify(p0Ids) === JSON.stringify(['k4', 'k3', 'k2', 'k1', 'k7', 'k5', 'k6']),
  'T8a F22 AC1/AC3 三组顺序 open→done→dropped 不穿插；open 按入区时间升序（k4@200 < k3移入@400 < k2@500）、done 按 statusAt（k1@900 < k7@1000）、dropped 按 statusAt（k5@700 < k6@800）');
assert(lists[0].children.length === 7,
  'T8b F23 空白区独立于 .note-list：列表 children 仅笔记条，.zone-foot 不混入列表、列表不渲染进脚注区');
assert(badges[0].textContent === '3' && ids.capsuleCount.textContent === '3',
  'T8c F22 AC8 角标不回归：P0 角标与胶囊角标仍只计 open（3 条 open / 2 done / 2 dropped）');

var beforeRender = JSON.stringify(notes);
render();
assert(JSON.stringify(notes) === beforeRender,
  'T8d F22 排序仅渲染层：render 前后 notes 数组顺序不变（T4a 数据层断言口径延续，决策点 37）');

/* --- F22 并列兜底：同入区时间（同毫秒）按 createdAt 再按 id 字典序 --- */
notes.push(
  { id: 'k9', text: '并列B', priority: 1, createdAt: 100, status: 'open', statusAt: 0, movedAt: 0 },
  { id: 'k8', text: '并列A', priority: 1, createdAt: 100, status: 'open', statusAt: 0, movedAt: 0 }
);
persist();
render();
assert(JSON.stringify(lists[1].children.map(function (r) { return r.dataset.id; })) === JSON.stringify(['k8', 'k9']),
  'T8e F22 同键并列：入区时间与 createdAt 均相同 → id 字典序稳定兜底（k8 < k9，可复现）');

/* --- F22 ⇅ 移动：movedAt=移动时刻，落目标分区 open 组末尾（F4 AC6 不回退） --- */
var idxK4 = findIndexById('k4');
setPriority('k4', 1);
var movedK4 = notes.filter(function (n) { return n.id === 'k4'; })[0];
assert(movedK4.priority === 1 && movedK4.movedAt > 0,
  'T8f F22 决策点 38 ⇅ 移动写入 movedAt=移动时刻（入区时间字段）');
assert(stored().filter(function (n) { return n.id === 'k4'; })[0].movedAt === movedK4.movedAt,
  'T8g F22 movedAt 随笔记落盘（决策点 4：v1.8 起存储含入区时间字段）');
assert(JSON.stringify(lists[1].children.map(function (r) { return r.dataset.id; })) === JSON.stringify(['k8', 'k9', 'k4']),
  'T8h F22 AC6/F4 不回退：createdAt 最老（200）的 k4 移入 P1 后仍落 open 组末尾（排在 k8/k9 之后）');
var reloaded = loadNotes();
assert(reloaded.filter(function (n) { return n.id === 'k4'; })[0].movedAt === movedK4.movedAt,
  'T8i F22 AC7 重启口径：loadNotes 读回 movedAt，排序键持久化');
localStorage._s.markit_notes = JSON.stringify([
  { id: 'legacy', text: '旧版笔记', priority: 2, createdAt: 42, status: 'open' }   // v1.8 前旧 schema：无 statusAt/movedAt
]);
var legacyLoaded = loadNotes()[0];
assert(legacyLoaded.movedAt === 0 && legacyLoaded.statusAt === 0 && legacyLoaded.status === 'open',
  'T8j F22 存量兼容：旧数据无 movedAt → 0，open 组按 createdAt 兜底（决策点 38，一次性迁移差异如实声明）');
persist();   // 恢复存储与内存 notes 一致，供后续断言使用

/* --- F22 AC5/AC2/AC4：新建追加 / 完成沉底 / 取消恢复（与 F24 写入路径联动） --- */
var addedNote = addNote('新事', 0);
p0Ids = lists[0].children.map(function (r) { return r.dataset.id; });
assert(p0Ids[2] === addedNote.id && p0Ids[3] === 'k1',
  'T8k F22 AC5 新建追加：新条落在全部 open（k3@400、k2@500）之后、done（k1）之前 = open 组末尾');
var idxK2 = findIndexById('k2');
setStatus('k2', 'done');
p0Ids = lists[0].children.map(function (r) { return r.dataset.id; });
assert(JSON.stringify(p0Ids) === JSON.stringify(['k3', addedNote.id, 'k1', 'k7', 'k2', 'k5', 'k6']),
  'T8l F22 AC2 完成沉底：k2 离开 open 位落 done 组 statusAt 末位（今次标完最晚）、仍在 dropped 之前');
assert(findIndexById('k2') === idxK2,
  'T8m F22/T4a 数据层断言延续：setStatus 不改 notes 数组下标（排序只发生在渲染层）');
setStatus('k2', 'open');
p0Ids = lists[0].children.map(function (r) { return r.dataset.id; });
assert(JSON.stringify(p0Ids) === JSON.stringify(['k3', 'k2', addedNote.id, 'k1', 'k7', 'k5', 'k6']),
  'T8n F22 AC4 取消恢复：k2 回 open 组，位置=入区时间升序规则位（k3@400 < k2@500 < 新事@now，不保证回到取消前原位）');
assert(badges[0].textContent === '3' && ids.capsuleCount.textContent === '6',
  'T8o F22 AC8 状态变更后角标口径不变：P0 角标=3（open only），胶囊=6（P0×3 + P1×3）');

/* --- F23/F24 静态结构与样式口径（§AB/§AC；交互路径由 v16.js F 组覆盖） --- */
assert((html.match(/class="zone-foot"/g) || []).length === 4,
  'T8p F23 AC1 四个分区各有一个常驻 .zone-foot（静态标记，任何笔记数量下存在）');
assert(/data-list="0"><\/div>\s*(<!--[\s\S]*?-->\s*)?<div class="zone-foot"><span class="zone-foot-hint"[^>]*>双击记一条<\/span><\/div>/.test(html),
  'T8q F23 空白区位于 .note-list 之后、区内仅含 hover 微文案 span（不渲染笔记条与常驻文案）');
assert(/--zone-foot-min:\s*36px/.test(html),
  'T8r F23 新增 token --zone-foot-min: 36px（§AB 取 PRD 下限，深浅色同值）');
assert((html.match(/双击记一条/g) || []).length === 4,
  'T8s F23 §AB hover 微文案恰 4 处（每分区一条，非常驻文案，决策点 36 选「悬停微提示」）');
assert(/\.zone:has\(\.note\) \.zone-foot:hover \.zone-foot-hint/.test(html),
  'T8t F23 引导去重：微文案仅 ≥1 条笔记分区显示（:has(.note)，零笔记分区不与 F7 空态叠加）');
assert(/\.zone-foot-hint\s*\{[\s\S]*?pointer-events:\s*none/.test(html),
  'T8u F23 §AB 微文案 pointer-events:none 不截双击命中（空白区整体均为 F3 热区）');
assert(html.indexOf('zone-sep') === -1 && html.indexOf('group-divider') === -1,
  'T8v F22 §AD 分组间零视觉分隔：无分隔线/分组标题类名引入（组边界由三态样式自明）');
assert(/\.zone-foot \.inline-wrap\s*\{[\s\S]*?flex:\s*1/.test(html) && /\.zone-foot:has\(\.inline-wrap\)\s*\{[\s\S]*?padding:\s*2px 12px 2px/.test(html),
  'T8w F24 §AC 输入条嵌入 zone-foot 槽位：撑满 336px 槽宽、32px 于 36px 槽内垂直居中（上下各 2px）');
assert(/@keyframes inline-out/.test(html) && /\.inline-wrap\.inline-out/.test(html),
  'T8x F24 §AC Esc/blur 取消退场 120ms ease-in（inline-out，Enter 保存路径无退场过渡）');

console.log('\n结果：' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
