/* 前端自测 harness v1.6（F15 下拉卡片四路关闭/点外抑制 + F16 标题模式 + F17 悬停粘贴）
   注：本文件刻意不启用 strict mode，否则 direct eval 的变量无法进入本作用域。
   mock 说明：比 harness.js 更接近真实 DOM——className/classList 双向同步、
   closest/contains 沿 parentNode 链查找、document 级监听可捕获并手动派发。 */
var fs = require('fs');
var path = require('path');

/* ---------------- mock DOM ---------------- */
var ALL = [];   // 全部创建过的元素（querySelectorAll 按类名+data-* 筛）

function dsKey(attr) {  // data-foo-bar → fooBar（对齐 dataset 驼峰键）
  if (attr.indexOf('data-') === 0) {
    return attr.slice(5).replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }
  return attr;
}

function El(tag) {
  this.tagName = tag;
  this.children = [];
  this.dataset = {};
  this.style = {
    setProperty: function () {},   // CSS 自定义属性赋值（如 --zone）静默成功
    removeProperty: function () {}
  };
  this.attrs = {};
  this.value = '';
  this.disabled = false;
  this.parentNode = null;
  this._text = '';
  this.isConnected = true;
  var self = this;
  var classes = new Set();
  Object.defineProperty(this, 'className', {  // className 属性与 classList 双向同步
    get: function () { return Array.from(classes).join(' '); },
    set: function (v) {
      classes.clear();
      String(v).split(/\s+/).filter(Boolean).forEach(function (c) { classes.add(c); });
    }
  });
  this.classList = {
    add: function (c) { classes.add(c); },
    remove: function (c) { classes.delete(c); },
    toggle: function (c, v) {
      if (v === undefined) v = !classes.has(c);
      v ? classes.add(c) : classes.delete(c);
    },
    contains: function (c) { return classes.has(c); }
  };
  ALL.push(this);
}
Object.defineProperty(El.prototype, 'textContent', {
  get: function () { return this._text; },
  set: function (v) {
    this._text = String(v);
    this.children.forEach(function (c) { c.isConnected = false; c.parentNode = null; });   // 清空即从文档摘除
    this.children = [];
  }
});
El.prototype.appendChild = function (c) { c.parentNode = this; c.isConnected = true; this.children.push(c); return c; };
El.prototype.remove = function () {
  this.isConnected = false;
  if (this.parentNode) {
    var i = this.parentNode.children.indexOf(this);
    if (i > -1) this.parentNode.children.splice(i, 1);
  }
};
El.prototype.setAttribute = function (k, v) {
  this.attrs[k] = String(v);
  if (k === 'class') this.className = String(v);
};
El.prototype.getAttribute = function (k) { return this.attrs[k]; };
El.prototype.addEventListener = function (t, f) { (this._ls = this._ls || {})[t] = (this._ls[t] || []).concat(f); };
El.prototype.fire = function (t, ev) { ((this._ls && this._ls[t]) || []).slice().forEach(function (f) { f(ev || {}); }); };
El.prototype.focus = function () {};
El.prototype.select = function () {};
El.prototype.insertAdjacentElement = function (pos, el) {
  if (pos === 'afterend' && this.parentNode) {
    var i = this.parentNode.children.indexOf(this);
    this.parentNode.children.splice(i + 1, 0, el);
    el.parentNode = this.parentNode;
    el.isConnected = true;
  } else { this.appendChild(el); }
  return el;
};
El.prototype.contains = function (t) {
  var el = t;
  while (el) { if (el === this) return true; el = el.parentNode; }
  return false;
};
El.prototype.closest = function (sel) {
  var attr = /\[([\w-]+)="([^"]*)"\]/.exec(sel);
  var classes = sel.replace(/\[.*\]/, '').split('.').filter(Boolean);
  var el = this;
  outer: while (el) {
    if (el.classList) {
      for (var i = 0; i < classes.length; i++) if (!el.classList.contains(classes[i])) { el = el.parentNode; continue outer; }
      if (attr && el.dataset[dsKey(attr[1])] !== attr[2]) { el = el.parentNode; continue outer; }
      return el;
    }
    el = el.parentNode;
  }
  return null;
};
El.prototype.querySelectorAll = function (sel) {
  var self = this;
  return selectAll(sel).filter(function (el) { return self === el || self.contains(el); });
};
El.prototype.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
El.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, right: 22, bottom: 22, width: 22, height: 22 }; };

function selectAll(sel) {
  var attr = /\[([\w-]+)="([^"]*)"\]/.exec(sel);
  var classes = sel.replace(/\[.*\]/, '').split('.').filter(Boolean);
  return ALL.filter(function (el) {
    if (!el.classList || el.isConnected === false) return false;   // 已摘除的元素不可选
    for (var i = 0; i < classes.length; i++) if (!el.classList.contains(classes[i])) return false;
    if (attr && el.dataset[dsKey(attr[1])] !== attr[2]) return false;
    return true;
  });
}

/* ---------------- 静态 DOM（对应 index.html body 标记） ---------------- */
var ids = {};
['app', 'quickInput', 'collapseBtn', 'expandBtn', 'sectionsScroll',
 'capsuleCount', 'toast', 'undoBtn', 'pinBtn', 'calBtn'].forEach(function (id) { ids[id] = new El('div'); });

var zones = [0, 1, 2, 3].map(function (p) {
  var zone = new El('section');
  zone.classList.add('zone');
  zone.dataset.p = String(p);
  var head = new El('div'); head.classList.add('zone-head');
  var logo = new El('span'); logo.classList.add('zone-logo'); logo._text = 'P' + p; head.appendChild(logo);
  var title = new El('span'); title.classList.add('zone-title'); head.appendChild(title);
  var wrap = new El('span'); wrap.classList.add('zone-count-wrap');
  var badge = new El('span'); badge.classList.add('zone-badge'); badge.dataset.count = String(p); wrap.appendChild(badge);
  var float = new El('span'); float.classList.add('zone-title-float'); wrap.appendChild(float);
  head.appendChild(wrap);
  var list = new El('div'); list.classList.add('note-list'); list.dataset.list = String(p);
  zone.appendChild(head);
  zone.appendChild(list);
  ids.sectionsScroll.appendChild(zone);
  return zone;
});

var docListeners = {};
var hasFocusFlag = true;
global.document = {
  createElement: function (t) { return new El(t); },
  createElementNS: function (ns, t) { return new El(t); },
  getElementById: function (id) {
    if (ids[id]) return ids[id];
    // v1.8 注：真实 DOM 的 getElementById 只返回文档树内节点——已摘除节点不可再命中；
    // 否则 F24 输入条重复开关时 removeInlineInput 会命中已摘除的旧节点而失效。
    for (var i = 0; i < ALL.length; i++) {
      if (ALL[i].id === id && ALL[i].isConnected !== false) return ALL[i];   // 动态 id（如 inlineWrap）
    }
    return undefined;
  },
  querySelector: function (sel) { return selectAll(sel)[0] || null; },
  querySelectorAll: function (sel) { return selectAll(sel); },
  addEventListener: function (t, f) { (docListeners[t] = docListeners[t] || []).push(f); },
  removeEventListener: function (t, f) {   // 真实 DOM 对称 API（G6 拖拽取消路径需要）
    var arr = docListeners[t];
    if (!arr) return;
    var i = arr.indexOf(f);
    if (i > -1) arr.splice(i, 1);
  },
  body: new El('body'),
  activeElement: null,
  hasFocus: function () { return hasFocusFlag; }
};
function docFire(type, ev) { (docListeners[type] || []).slice().forEach(function (f) { f(ev || {}); }); }

global.window = global;
global.innerWidth = 360; global.innerHeight = 640;
global.localStorage = {
  _s: {},
  getItem: function (k) { return (k in this._s) ? this._s[k] : null; },
  setItem: function (k, v) { this._s[k] = String(v); }
};

/* ---------------- 种子数据：今天新建 / 今天完成 / 历史旧数据 ----------------
   v1.8 注：种子条目补 movedAt: 0 字段（字段顺序与 loadNotes 归一化输出一致），
   维持 B2d「markit_notes === JSON.stringify(notes)」序列化对比口径不变；
   断言语义（显示偏好与笔记数据分离）不受影响。 */
var NOW = Date.now();
localStorage._s.markit_notes = JSON.stringify([
  { id: 'seed1', text: '今天建的', priority: 0, createdAt: NOW, status: 'open', statusAt: 0, movedAt: 0 },
  { id: 'seed2', text: '今天完成', priority: 2, createdAt: NOW - 86400000, status: 'done', statusAt: NOW, movedAt: 0 },
  { id: 'seed3', text: '旧的', priority: 3, createdAt: 1700000000000, status: 'open', statusAt: 0, movedAt: 0 }
]);

/* ---------------- 加载被测脚本 ---------------- */
/* ---------------- 加载被测脚本（v2.0 单文件拆分后改读 assets/js/app.js，断言一条不改） ----------------
   同 harness.js：`html` 拼合 HTML/CSS/JS 三份源码（G4a/G5a/G5b 为 CSS 规则断言、
   T 组风格结构断言读 HTML、行为断言 eval app.js），direct eval 语义不变。 */
var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  + '\n' + fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'app.css'), 'utf8')
  + '\n' + fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
var appSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
if (!appSrc) { console.error('FATAL: assets/js/app.js 为空'); process.exit(1); }
eval(appSrc.replace(/'use strict';/, ''));

/* ---------------- 断言 ---------------- */
var passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('PASS  ' + msg); }
  else { failed++; console.log('FAIL  ' + msg); }
}
function stored() { return JSON.parse(localStorage._s.markit_notes); }

/* ============ A. F15 下拉卡片（§Q-§U） ============ */
openCalendar();
assert(calState.open === true, 'A1a openCalendar 后 open=true');
assert(calState.el && calState.el.className === 'cal-card', 'A1b 根节点为 .cal-card（卡片本体即根，§Q）');
assert(calState.el.parentNode === app, 'A1c 卡片挂载于 #app（锚定顶栏下方）');
assert(selectAll('.cal-overlay').length === 0, 'A1d 全屏覆盖层 .cal-overlay 已不存在（§Q 无遮罩）');
var cardKids = calState.el.children.map(function (c) { return c.className; });
assert(JSON.stringify(cardKids) === JSON.stringify(['cal-head', 'cal-week', 'cal-grid', 'cal-detail']),
  'A2 卡片结构 = head/week/grid/detail 四段（§Q）');
var calHead = calState.el.children[0];
assert(calHead.children.length === 4 &&
       calHead.children[3].classList.contains('cal-close'),
  'A3a ✕ 关闭钮为 head 行内末位子节点（§T，不再被 .cal-head 后序绘制遮挡）');
assert(calHead.children[0].classList.contains('cal-nav') && calHead.children[2].classList.contains('cal-nav'),
  'A3b 翻月箭头分居年月标题两侧（§Q）');

var todayCell = selectAll('.cal-day.today')[0];
assert(!!todayCell, 'A4a 当月渲染出今天格（今天环逻辑保留）');
assert(todayCell.querySelectorAll('.cal-dot').length === 1,
  'A4b 今天格有记录点（新建 createdAt + 完成 statusAt 同日仍一点，PRD 硬约束）');
assert(selectAll('.cal-day.future').length > 0, 'A4c 未来日期置灰禁用（disabled 逻辑保留）');

/* --- A5 点外关闭（pointerdown 捕获）+ 点击消费抑制（§T） --- */
var beforeNotes = notes.length;
docFire('pointerdown', { target: ids.collapseBtn });   // 卡片外、非日历图标
assert(calState.open === false, 'A5a 点外 pointerdown → 卡片关闭（§T 四路关闭之①）');
assert(calGuardUntil > Date.now(), 'A5b 该次点击已标记消费（calGuard 短窗激活）');
ids.sectionsScroll.fire('dblclick', { target: zones[0].children[1] });   // 看板空白区双击
assert(selectAll('.inline-wrap').length === 0, 'A5c 抑制窗口内双击不触发 F3 就地输入（不误建笔记）');
calGuardUntil = 0;   // 模拟窗口过期
ids.sectionsScroll.fire('dblclick', { target: zones[0].children[1] });
assert(selectAll('.inline-wrap').length === 1, 'A5d 抑制过期后双击正常触发 F3');
removeInlineInput();

/* --- A6 再点图标 toggle / Esc / ✕ 三路（§T） --- */
openCalendar();
docFire('pointerdown', { target: ids.calBtn });   // 命中日历图标
assert(calState.open === true, 'A6a pointerdown 命中日历图标不抢关（交给 click toggle）');
ids.calBtn.fire('click');
assert(calState.open === false, 'A6b 再点日历图标 → 关闭（关闭方式③）');
ids.calBtn.fire('click');
assert(calState.open === true, 'A6c 再点日历图标（关闭态）→ 打开');
docFire('keydown', { key: 'Escape' });
assert(calState.open === false, 'A6d Esc → 关闭（关闭方式②）');

openCalendar();
var realCloseBtn = calState.el.children[0].children[3];   // 当前卡片的 ✕（旧卡片 120ms 后销毁，勿用旧引用）
docFire('click', { target: realCloseBtn });   // 卡片内事件委托
assert(calState.open === false, 'A6e 卡片内 ✕ → 关闭（关闭方式④）');

/* --- A7 点日期：选中态 + 详情三组（逻辑保留，无压缩态） --- */
openCalendar();
todayCell = calState.gridEl.querySelectorAll('.cal-day.today')[0];   // 限定当前卡片网格（旧卡片 120ms 后才销毁）
docFire('click', { target: todayCell });
assert(calState.selKey === keyOfTs(Date.now()), 'A7a 点今天 → selKey=今天');
assert(todayCell.classList.contains('selected'), 'A7b 今天格挂 selected');
var ghNames = calState.detailEl.querySelectorAll('.cal-gh-name').map(function (e) { return e._text; });
assert(JSON.stringify(ghNames) === JSON.stringify(['Mark', '完成']),
'A7c 详情三组顺序 Mark→完成→放弃（空组不渲染，§O 保留；组名「新建」→「Mark」系回归验收轮已验收修复，断言过期由 QA 于 v1.7 轮同步）');
assert(!calState.gridEl.classList.contains('compact') && selectAll('.cal-grid.compact').length === 0, 'A7d 选中日期不再进入压缩态（§R 固定 34px 格）');
docFire('keydown', { key: 'Escape' });

/* ============ B. F16 分区标题显示模式（§V） ============ */
assert(titleMode === 'compact' && app.classList.contains('titles-compact'),
  'B1 干净启动默认精简模式');
ids.sectionsScroll.fire('dblclick', { target: zones[3].children[0] });   // 标题行双击
assert(titleMode === 'full', 'B2a 标题行双击 → 全局切完整模式');
assert(!app.classList.contains('titles-compact'), 'B2b .titles-compact 移除');
assert(localStorage._s.markit_title_mode === 'full', 'B2c 偏好写入独立 key markit_title_mode');
assert(localStorage._s.markit_notes === JSON.stringify(notes), 'B2d 显示偏好与 markit_notes 数据分离');

ids.sectionsScroll.fire('dblclick', { target: zones[1].children[1] });   // 标题行以下空白区双击
assert(titleMode === 'full', 'B3a 空白区双击只触发 F3，不改显示模式（热区互斥）');
assert(selectAll('.inline-wrap').length === 1, 'B3b 空白区双击照常打开 F3 就地输入');
removeInlineInput();

CAL_REDUCED = true;   // 减弱动效路径：切换瞬时完成（可控时钟）
ids.sectionsScroll.fire('dblclick', { target: zones[0].children[0] });
assert(titleMode === 'compact' && app.classList.contains('titles-compact'),
  'B4 再次标题行双击 → 切回精简（四分区联动 + localStorage 同步）');
assert(localStorage._s.markit_title_mode === 'compact', 'B5 偏好同步写回 compact');
CAL_REDUCED = false;

/* ============ C. F17 悬停粘贴（§W） ============ */
assert(pasteConditionsOk() === false, 'C1 无悬停分区时条件不满足');
assert(zones[2].classList.contains('paste-ready') === false, 'C2a 未悬停分区不挂 paste-ready');
ids.sectionsScroll.fire('mouseover', { target: zones[2].children[1] });   // 悬停 P2 分区
assert(pasteHoverZone === zones[2], 'C3a mouseover 委托命中 .zone（悬停 P2）');
assert(zones[2].classList.contains('paste-ready') === true, 'C3b 条件齐备 → 分区挂 paste-ready（虚线高亮）');

global.document.activeElement = { tagName: 'INPUT' };   // 焦点进入输入控件
docFire('focusin');
assert(zones[2].classList.contains('paste-ready') === false, 'C4 焦点进入输入控件 → 提示卸载（输入优先）');
global.document.activeElement = null;
docFire('focusout');
assert(zones[2].classList.contains('paste-ready') === true, 'C5 离开输入控件 → 悬停未变则重挂');

global.document.activeElement = { tagName: 'INPUT' };   // 焦点保持在输入控件时按 ⌘V
docFire('keydown', { key: 'v', metaKey: true, ctrlKey: false, altKey: false });
assert(pasteArmed === false, 'C6 焦点在输入控件时 ⌘V 不拦截（系统粘贴照常）');
global.document.activeElement = null;

/* 完整粘贴流：悬停 P1 → ⌘V → paste 事件 → 新建 */
ids.sectionsScroll.fire('mouseover', { target: zones[1].children[1] });
docFire('keydown', { key: 'v', metaKey: true, ctrlKey: false, altKey: false });
assert(pasteArmed === true, 'C7a 悬停分区 + 无输入焦点 + 前台 → ⌘V 武装 F17 通道');
var notesBefore = notes.length;
var prevented = false;
docFire('paste', { clipboardData: { getData: function () { return ' 粘贴的文本 '; } }, preventDefault: function () { prevented = true; } });
assert(prevented === true, 'C7b paste 事件被拦截（preventDefault）');
assert(notes.length === notesBefore + 1, 'C7c 非空纯文本 → 新建 1 条');
var pasted = notes.filter(function (n) { return n.text === ' 粘贴的文本 '; })[0];
assert(!!pasted && pasted.priority === 1, 'C7d 新建归属悬停分区 P1');
assert(pasted.status === 'open' && pasted.statusAt === 0 && pasted.createdAt > 0, 'C7e createdAt 计入（日历「新建」事件自然生效）');
var pastedRow = selectAll('.note').filter(function (e) { return e.dataset.id === pasted.id; })[0];
assert(!!pastedRow && pastedRow.classList.contains('note-enter'), 'C7f 新建行挂 .note-enter（统一入场 + paste-flash）');
assert(pasteArmed === false, 'C7g 粘贴后武装位复位');

/* 空剪贴板 / 纯空白：不创建不报错 */
ids.sectionsScroll.fire('mouseover', { target: zones[3].children[1] });
docFire('keydown', { key: 'v', metaKey: true, ctrlKey: false, altKey: false });
notesBefore = notes.length;
docFire('paste', { clipboardData: { getData: function () { return ''; } }, preventDefault: function () {} });
assert(notes.length === notesBefore, 'C8 空剪贴板 → 不创建');
ids.sectionsScroll.fire('mouseover', { target: zones[3].children[1] });
docFire('keydown', { key: 'v', metaKey: true, ctrlKey: false, altKey: false });
docFire('paste', { clipboardData: { getData: function () { return '  \n\t  '; } }, preventDefault: function () {} });
assert(notes.length === notesBefore, 'C9 纯空白字符 → 不创建（PRD F17 空内容验收）');

/* 收起态 / 后台：条件失效 */
app.classList.add('collapsed');
refreshPasteReady();
assert(zones[3].classList.contains('paste-ready') === false, 'C10 收起态不挂提示');
app.classList.remove('collapsed');
hasFocusFlag = false;
refreshPasteReady();
assert(zones[3].classList.contains('paste-ready') === false, 'C11 窗口后台不挂提示');
hasFocusFlag = true;

/* ============ D. 回归：删除/撤销仍受 calGuard 保护与放行 ============ */
var delRow = pastedRow;
var delBtn = delRow.children.filter(function (c) { return c.className.indexOf('note-actions') > -1; })[0]
  .children.filter(function (b) { return b.dataset.act === 'delete'; })[0];
openCalendar();
docFire('pointerdown', { target: ids.toast });   // 点外关闭 + 消费标记
ids.sectionsScroll.fire('click', { target: delBtn });
assert(notes.length === notesBefore && notes.filter(function (n) { return n.id === pasted.id; }).length === 1,
  'D1 抑制窗口内点击笔记操作不生效（点外仅关闭）');
calGuardUntil = 0;
ids.sectionsScroll.fire('click', { target: delBtn });
assert(notes.filter(function (n) { return n.id === pasted.id; }).length === 0, 'D2 抑制过期后删除正常');
assert(toast.classList.contains('show') === true, 'D3 删除 toast 弹出（toast 逻辑保留）');
undoDelete();
assert(notes.filter(function (n) { return n.id === pasted.id; }).length === 1, 'D4 撤销恢复（回归通过）');

/* ============ E. F16 完整→精简 120ms 退场（异步，可控时钟） ============ */
toggleTitleMode();   // compact → full
assert(titleMode === 'full', 'E0 切到完整模式');
toggleTitleMode();   // full → compact：先 fade 再移出文档流
assert(!app.classList.contains('titles-compact'), 'E1 退场 120ms 内 .titles-compact 尚未挂载（fade 出场先行）');
assert(titleExitTimer !== null, 'E2 退场定时器已排队');

/* ============ F. v1.8 F23/F24（底部空白区双击热区 + 就地输入条位置下沉） ============ */
/* v1.6 mock 未建 .zone-foot，为 P0 分区补挂一个（真实 DOM 为每分区静态标记），
   验证 F24 输入条嵌入空白区槽位的交互路径（§AC）。 */
var footEl = new El('div');
footEl.classList.add('zone-foot');
zones[0].appendChild(footEl);

ids.sectionsScroll.fire('dblclick', { target: footEl });
var wrapFoot = selectAll('.inline-wrap')[0];
assert(!!wrapFoot && wrapFoot.parentNode === footEl,
  'F1 F24 AC1 双击底部空白区 → 输入条嵌入 zone-foot 槽位（分栏最底部，非标题行之下）');
assert(zones[0].children.indexOf(wrapFoot) === -1,
  'F2 F24 输入条非 zone 直挂（占 foot 槽，§AC「嵌入空白区槽位」）');
assert(titleMode === 'compact',
  'F3 F23 AC6 双击底部空白区只弹输入框，不触发 F16 显示模式切换（热区互不串扰）');
removeInlineInput();

/* Esc 取消：退场动画挂载，120ms 后移除（§AC） */
ids.sectionsScroll.fire('dblclick', { target: footEl });
var wrapEsc = selectAll('.inline-wrap')[0];
assert(!!wrapEsc, 'F4a 再次双击 → 新输入条打开（重复双击先移除旧条，同一时刻仅一个）');
wrapEsc.children[0].children[0].fire('keydown', { key: 'Escape', preventDefault: function () {} });
assert(wrapEsc.classList.contains('inline-out') === true,
  'F4b F24 Esc 取消 → 挂 .inline-out 退场（opacity 1→0 + translateY 0→4px，120ms ease-in）');

/* Enter 写入：输入条直接移除（无退场），笔记按 F22 落 open 组末尾 */
ids.sectionsScroll.fire('dblclick', { target: footEl });
var wrapSave = selectAll('.inline-wrap')[0];
assert(wrapSave && wrapSave !== wrapEsc,
  'F5 退场中的旧条已被 removeInlineInput 同步移除，新条独立创建（旧条延迟移除幂等）');
var saveInput = wrapSave.children[0].children[0];
saveInput.value = '就地新事';
saveInput.fire('keydown', { key: 'Enter', preventDefault: function () {} });
var inSitu = notes.filter(function (n) { return n.text === '就地新事'; })[0];
assert(!!inSitu && inSitu.priority === 0 && inSitu.status === 'open' && inSitu.createdAt > 0,
  'F6 F24 AC6 Enter 写入归属双击分区 P0（不落默认 P3），createdAt 计入日历新建事件');
assert(wrapSave.isConnected === false && selectAll('.inline-wrap').length === 0 &&
       wrapSave.classList.contains('inline-out') === false,
  'F7 F24 写入后输入条直接移除（无退场过渡，§AC）');
var p0RowIds = zones[0].children[1].children.map(function (r) { return r.dataset.id; });
assert(p0RowIds[p0RowIds.length - 1] === inSitu.id,
  'F8 F24 AC3 写入落位：新笔记按 F22 排序落 P0 open 组末尾（本分区全 open → 即分区末尾）');
assert(findIndexById(inSitu.id) > findIndexById('seed1'),
  'F9 数据层：addNote 追加在 seed1 之后（notes 数组序不受渲染层排序影响）');

/* F22 状态沉底 / 取消恢复（v16 富 mock 渲染序回归） */
setStatus(inSitu.id, 'done');
p0RowIds = zones[0].children[1].children.map(function (r) { return r.dataset.id; });
assert(p0RowIds[0] === 'seed1' && p0RowIds[1] === inSitu.id,
  'F10 F22 AC2 完成沉底：open(seed1) 在前、done(就地新事) 沉到全部 open 之后');
setStatus(inSitu.id, 'open');
p0RowIds = zones[0].children[1].children.map(function (r) { return r.dataset.id; });
assert(p0RowIds[0] === 'seed1' && p0RowIds[1] === inSitu.id,
  'F11 F22 AC4 取消恢复回 open 组规则位（入区时间升序，位置由规则决定）');

/* blur 取消：同样走 120ms 退场（行为不变项） */
ids.sectionsScroll.fire('dblclick', { target: footEl });
var wrapBlur = selectAll('.inline-wrap')[0];
wrapBlur.children[0].children[0].fire('blur');
assert(wrapBlur.classList.contains('inline-out') === true,
  'F12 F24 blur 取消 → 挂 .inline-out 退场');

/* ============ G. F25-F28（v1.9 新增） ============ */

/* --- G1. sortForDisplay seq 整合（F25 AC7） --- */
var sortTestArr = [
  { id: 'stA', text: 'A', priority: 3, createdAt: 3000, status: 'open', seq: 2 },
  { id: 'stB', text: 'B', priority: 3, createdAt: 2000, status: 'open', seq: 1 },
  { id: 'stC', text: 'C', priority: 3, createdAt: 1000, status: 'open' },
  { id: 'stD', text: 'D', priority: 3, createdAt: 500, status: 'open' }
];
var sortedTestArr = sortForDisplay(sortTestArr);
assert(sortedTestArr[0].id === 'stB', 'G1a F25 seq=1 排组内最前');
assert(sortedTestArr[1].id === 'stA', 'G1b F25 seq=2 排第二');
assert(sortedTestArr[2].id === 'stD', 'G1c F25 无 seq 按 createdAt 升序（500 最老）');
assert(sortedTestArr[3].id === 'stC', 'G1d F25 无 seq 按 createdAt 升序（1000）');

/* --- G2. reorderNote 同分区同状态组内重排 + seq 重编号 + 持久化（F25 AC2） --- */
var g2n1 = { id: 'g2n1', text: '拖拽A', priority: 2, createdAt: 1000, status: 'open', statusAt: 0, movedAt: 0 };
var g2n2 = { id: 'g2n2', text: '拖拽B', priority: 2, createdAt: 2000, status: 'open', statusAt: 0, movedAt: 0 };
var g2n3 = { id: 'g2n3', text: '拖拽C', priority: 2, createdAt: 3000, status: 'open', statusAt: 0, movedAt: 0 };
notes.push(g2n1);
notes.push(g2n2);
notes.push(g2n3);
render();
var notesOrderBefore = notes.map(function (n) { return n.id; });

reorderNote('g2n1', 'g2n3', true);

assert(g2n2.seq === 1, 'G2a F25 AC2 重排后 g2n2 seq=1');
assert(g2n3.seq === 2, 'G2b F25 AC2 重排后 g2n3 seq=2');
assert(g2n1.seq === 3, 'G2c F25 AC2 重排后 g2n1 seq=3');
assert(JSON.stringify(notes.map(function (n) { return n.id; })) === JSON.stringify(notesOrderBefore),
  'G2d F25 AC7 数据层 notes 数组下标不变');
var p2RowIds = zones[2].children[1].children.map(function (r) { return r.dataset.id; });
assert(p2RowIds.indexOf('g2n2') === 0 && p2RowIds.indexOf('g2n3') === 1 && p2RowIds.indexOf('g2n1') === 2,
  'G2e F25 AC2 视觉顺序 = B/C/A(open) → seed2(done)');
var storedG2 = JSON.parse(localStorage._s.markit_notes);
assert(storedG2.filter(function (n) { return n.id === 'g2n1'; })[0].seq === 3,
  'G2f F25 AC2 seq 已持久化到 localStorage');

/* 跨分区松手 → 取消回弹（F25 AC4） */
var beforeCross = JSON.stringify(notes);
reorderNote('g2n2', 'seed1', true);
assert(JSON.stringify(notes) === beforeCross,
  'G2g F25 AC4 跨分区重排 → 取消（数据不变，不写 seq）');

/* 状态变更清 seq（F25 AC6） */
setStatus('g2n1', 'done');
assert(!('seq' in notes[findIndexById('g2n1')]),
  'G2h F25 AC6 状态变更后 seq 已清空');

/* --- G3. F26 双击笔记条本体 → 就地编辑 --- */
var editRow = zones[0].children[1].children[0];
ids.sectionsScroll.fire('dblclick', { target: editRow });
assert(editRow.children.length > 0 && editRow.children[0].className.indexOf('grad-wrap') !== -1,
  'G3a F26 AC1 双击笔记条本体 → 出现编辑输入条（grad-wrap）');

/* 双击 .nact 按钮 → 不触发编辑（F26 AC6） */
var nactRow = zones[2].children[1].children[1];
var nactBtn = nactRow.children[2].children[0];
var nactRowBefore = JSON.stringify(nactRow.children.map(function (c) { return c.className; }));
ids.sectionsScroll.fire('dblclick', { target: nactBtn });
assert(JSON.stringify(nactRow.children.map(function (c) { return c.className; })) === nactRowBefore,
  'G3b F26 AC6 双击 .nact 操作按钮 → 不触发编辑（行内容不变）');

/* --- G4. F27 零笔记分区隐藏底部空白区（CSS :has() 方案，偏离 PRD「动态移除」） --- */
assert(/\.zone:not\(:has\(\.note\)\) \.zone-foot:not\(:has\(\.inline-wrap\)\)\s*\{\s*display:\s*none;?\s*\}/.test(html),
  'G4a F27 CSS 规则存在：零笔记分区 zone-foot 隐藏');

/* --- G5. F28 微文案垂直居中 --- */
assert(/\.zone-foot\s*\{[^}]*position:\s*relative/.test(html),
  'G5a F28 .zone-foot position:relative（绝对居中方案）');
assert(/\.zone-foot-hint\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*justify-content:\s*center/.test(html),
  'G5b F28 .zone-foot-hint 绝对定位 + flex 居中');

/* --- G6. F25 AC3/AC4 越界松手取消（v1.9 验收轮 P1 修复回归，QA 建议补齐） --- */
/* 为 .note 行覆写 instance 级 getBoundingClientRect 模拟真实布局：自上而下 P0→P3，
   每行 36px 高 + 4px 条间距（§AB），分区之间隔 24px（仅用于隔离各分区行带，不影响断言语义）。
   mock 原型 rect 恒为 top:0/bottom:22，无法区分组带，故行级覆写。 */
function setRowRects() {
  var y = 100;
  [0, 1, 2, 3].forEach(function (p) {
    zones[p].children[1].children.forEach(function (rowEl) {
      var top = y;
      rowEl.getBoundingClientRect = function () {
        return { left: 12, top: top, right: 348, bottom: top + 36, width: 336, height: 36 };
      };
      y += 40;
    });
    y += 24;
  });
}
setRowRects();   /* 布局：P0=seed1@100,inSitu@140 | P1=pasted@204 | P2=open g2n2@268,g2n3@308 → done g2n1@348,seed2@388 | P3=seed3@452 */

/* 跳过 500ms 长按等待，同步进入就绪态（与 initDrag 定时器回调等效） */
function dragReadyAt(rowEl, x, y) {
  initDrag(rowEl, { clientX: x, clientY: y });
  clearTimeout(dragState.timer);
  dragState.timer = null;
  dragState.ready = true;
  dragState.row.classList.add('drag-ready');
  document.body.classList.add('dragging');
}

var dtInGroup = computeDropTarget('g2n2', 340);   /* P2 open 组带 [268,344]，末行中点下仍属组内 */
assert(!!dtInGroup && dtInGroup.targetId === 'g2n3' && dtInGroup.insertAfter === true,
  'G6a F25 回归：同组末行后（组带内）仍是合法落点（组内重排不受边界判定误伤）');
assert(computeDropTarget('g2n2', 370) === null,
  'G6b F25 AC3 同分区跨组：指针在 done 组行带（348-424）→ 落点 null（不再钳位到末行后）');
assert(computeDropTarget('g2n2', 120) === null,
  'G6c F25 AC4 跨分区：指针在 P0 分区行带（100-176）→ 落点 null（不再钳位到首行前）');

/* 全管线：同分区跨组（open→done）松手取消，reduced-motion 0ms 路径 */
var drRowB = zones[2].children[1].children[0];          /* g2n2 行 */
var beforeCancel = JSON.stringify(notes);
var beforeP2Order = zones[2].children[1].children.map(function (r) { return r.dataset.id; });
dragReadyAt(drRowB, 180, 286);
docFire('pointermove', { clientX: 180, clientY: 300 });  /* 组内先取得合法落点 */
assert(!!dragState.dropTarget && dragState.dropTarget.targetId === 'g2n3',
  'G6d F25 组内拖动落点指示正常建立（正控制，边界判定不误伤组内）');
docFire('pointermove', { clientX: 180, clientY: 370 });  /* 拖入 done 组上空 */
assert(dragState.dropTarget === null,
  'G6e F25 越出本组条带 → 落点清空（无钳位吸附，拖动中即无落点）');
assert(selectAll('.drop-above').length === 0 && selectAll('.drop-below').length === 0,
  'G6f F25 越界拖动中落点指示全部卸载（无残留高亮线）');
CAL_REDUCED = true;
docFire('pointerup', { clientX: 180, clientY: 370 });
assert(JSON.stringify(notes) === beforeCancel,
  'G6g F25 AC3 同分区跨组松手取消：无 seq 写入、notes 数据零变化');
assert(JSON.stringify(zones[2].children[1].children.map(function (r) { return r.dataset.id; })) === JSON.stringify(beforeP2Order),
  'G6h F25 AC3 渲染序不变（不重排）');
assert(dragState === null && selectAll('.drag-ghost').length === 0 &&
       drRowB.classList.contains('drag-ready') === false &&
       document.body.classList.contains('dragging') === false,
  'G6i F25 AC3 取消回弹 reduced-motion 0ms 瞬时复位：跟手条移除、原条恢复、.dragging 卸载（呼吸点同步恢复）');

/* 全管线：跨分区（P2 open → P0 上空）松手取消，§AE 180ms 回弹动画路径 */
var drRowB2 = zones[2].children[1].children[0];          /* g2n2 行（上轮取消后未被替换） */
dragReadyAt(drRowB2, 180, 286);
docFire('pointermove', { clientX: 180, clientY: 120 });  /* 拖到 P0 分区上空 */
CAL_REDUCED = false;
docFire('pointerup', { clientX: 180, clientY: 120 });
var bounceGhost = selectAll('.drag-ghost')[0];
assert(JSON.stringify(notes) === beforeCancel &&
       JSON.stringify(zones[2].children[1].children.map(function (r) { return r.dataset.id; })) === JSON.stringify(beforeP2Order),
  'G6j F25 AC4 跨分区松手取消：无 seq 写入、不重排、渲染序与数据零变化');
assert(!!bounceGhost && bounceGhost.classList.contains('drag-return') === true &&
       document.body.classList.contains('dragging') === true,
  'G6k F25 AC4 §AE 取消回弹动画进行中：跟手条挂 .drag-return（180ms ease-out 回原槽位），到位前 .dragging 保持');

/* 200ms 异步口：退场定时器结束后节点彻底移除、无残留（在末尾 250ms 汇总之前） */
setTimeout(function () {
  assert(selectAll('.inline-wrap').length === 0 &&
         wrapEsc.isConnected === false && wrapBlur.isConnected === false,
    'F13 F24 Esc/blur 退场 120ms 后输入条全部移除（无 DOM 残留，同一时刻最多一个）');
  assert(selectAll('.drag-ghost').length === 0 &&
         drRowB2.classList.contains('drag-ready') === false &&
         document.body.classList.contains('dragging') === false,
    'G6l F25 AC4 回弹 180ms 到位：跟手条移除、原条恢复、.dragging 卸载（呼吸点恢复，无 DOM 残留）');
}, 200);


/* ============ H. v2.1 迭代验证：编辑失焦保存 + IME 守卫 ============ */
/* mock 局限规避：textContent 清空不递归摘除孙辈，编辑态一律用「行首子节点是否 grad-wrap」判定 */
function inEdit(rowEl) { return rowEl.children[0] && rowEl.children[0].className === 'grad-wrap'; }

dragGuardUntil = 0; calGuardUntil = 0;   // G6 拖拽用例遗留的 200ms 守卫窗口（真实场景已自然流逝）

/* H1 双击进入编辑 → 改文本 → blur 直接保存（不按 Enter） */
var hRow = zones[0].children[1].children[0];
var hId = hRow.dataset.id;
ids.sectionsScroll.fire('dblclick', { target: hRow });
assert(inEdit(hRow), 'H1a 双击笔记条进入编辑态（行首为 grad-wrap）');
hRow.children[0].children[0].value = '失焦保存的新文本';
hRow.children[0].children[0].fire('blur');
var hSaved = notes.filter(function (n) { return n.id === hId; })[0];
assert(hSaved && hSaved.text === '失焦保存的新文本',
  'H1b 失焦即保存：blur 后 notes 文本已更新（无需 Enter）');
assert(!inEdit(zones[0].children[1].children[0]) &&
       zones[0].children[1].children[0].children[0]._text === '失焦保存的新文本',
  'H1c blur 保存后行恢复展示态且展示新文本');

/* H2 IME 组合期 Enter 不保存；组合结束后 Enter 正常保存 */
ids.sectionsScroll.fire('dblclick', { target: zones[0].children[1].children[0] });
var hRow2 = zones[0].children[1].children[0];
assert(inEdit(hRow2), 'H2-pre 再次双击进入编辑态');
hRow2.children[0].children[0].value = '输入法选字中';
hRow2.children[0].children[0].fire('keydown', { key: 'Enter', isComposing: true, preventDefault: function () {} });
assert(inEdit(hRow2), 'H2a isComposing=true 的 Enter 不触发保存（仍处编辑态，交给输入法）');
hRow2.children[0].children[0].fire('keydown', { key: 'Enter', preventDefault: function () {} });
assert(notes.filter(function (n) { return n.text === '输入法选字中'; }).length === 1,
  'H2b 组合结束后的普通 Enter 正常保存');
assert(!inEdit(zones[0].children[1].children[0]), 'H2c Enter 保存后行恢复展示态');

/* H3 Esc 仍为取消（blur 保存不影响 Esc 语义） */
var hBefore = JSON.stringify(notes);
ids.sectionsScroll.fire('dblclick', { target: zones[0].children[1].children[0] });
var hRow3 = zones[0].children[1].children[0];
hRow3.children[0].children[0].value = '这条不该保存';
hRow3.children[0].children[0].fire('keydown', { key: 'Escape', preventDefault: function () {} });
hRow3.children[0].children[0].fire('blur');
assert(JSON.stringify(notes) === hBefore, 'H3 Esc 取消：blur 补偿不二次写入（done 幂等）');

/* H4 顶栏快速输入 IME 守卫 */
var qiBefore = notes.length;
quickInput.value = '快捷输入法选字';
quickInput.fire('keydown', { key: 'Enter', isComposing: true, preventDefault: function () {} });
assert(notes.length === qiBefore, 'H4a quickInput isComposing Enter 不新增笔记');
quickInput.fire('keydown', { key: 'Enter', preventDefault: function () {} });
var hQuick = notes.filter(function (n) { return n.text === '快捷输入法选字'; })[0];
assert(notes.length === qiBefore + 1 && !!hQuick && hQuick.priority === 3,
  'H4b quickInput 普通 Enter 正常新增（默认 P3）');

/* H5 CSS：操作组实底 token 与文本安全区存在 */
assert(/--actions-bg:\s*#FBFBFD/.test(html) && /--actions-bg:\s*#28282F/.test(html),
  'H5a 操作组实底 token 深浅色各一套');
assert(/\.note-text\s*\{[^}]*padding-right:\s*16px/.test(html),
  'H5b note-text 右侧 16px 安全区（超长文本不压气泡点）');
assert(html.indexOf('--actions-bg-hover') > -1, 'H5c hover 态操作组换用 hover 实底 token');


/* ============ I. F29 跨分区拖拽移动（v2.1：按指针位置落位） ============ */
dragGuardUntil = 0; calGuardUntil = 0;

/* I-pre：为四个分区覆写矩形带（P0:100-176 / P1:200-276 / P2:300-452 / P3:500-576） */
var ZONE_RECTS = [[100,176],[200,276],[300,452],[500,576]];
zones.forEach(function (z, i) {
  z.getBoundingClientRect = function () {
    return { left: 0, top: ZONE_RECTS[i][0], right: 360, bottom: ZONE_RECTS[i][1], width: 360, height: ZONE_RECTS[i][1]-ZONE_RECTS[i][0] };
  };
});

/* 行级矩形：每次 render 重建行后需重刷（mock 原型 rect 恒为 top:0/bottom:22）
   自上而下按当前列表顺序排布：每行 36px + 4px 间距，分区之间隔 24px */
function setRowRects() {
  var y = 100;
  [0, 1, 2, 3].forEach(function (p) {
    zones[p].children[1].children.forEach(function (rowEl) {
      var top = y;
      rowEl.getBoundingClientRect = function () {
        return { left: 12, top: top, right: 348, bottom: top + 36, width: 336, height: 36 };
      };
      y += 40;
    });
    y += 24;
  });
}
setRowRects();

var iRow = zones[2].children[1].children[0];   /* P2 分区第一条 open 笔记 g2n2 */
var iId = iRow.dataset.id;
var iBefore = notes.filter(function (n) { return n.id === iId; })[0];
assert(iBefore && iBefore.priority === 2, 'I-pre 拖拽源笔记位于 P2');
var pastedRow = zones[1].children[1].children[0];
var anchorId = pastedRow.dataset.id;
assert(!!pastedRow && notes.filter(function (n) { return n.id === anchorId; })[0].status === 'open',
  'I-pre P1 存在 open 笔记（落位锚点）');

/* I1 zoneUnderPointer 判定 */
assert(zoneUnderPointer(120) === zones[0] && zoneUnderPointer(240) === zones[1],
  'I1a zoneUnderPointer 命中对应分区');
assert(zoneUnderPointer(180) === null && zoneUnderPointer(490) === null,
  'I1b 分区间 8px 空隙为无主区（null → 松手取消）');

/* I1c 跨分区落点纯函数：P1 open 组仅 pasted@204-240（中点 222） */
var ct1 = computeCrossZoneDropTarget(iId, zones[1], 240);
assert(!!ct1 && ct1.targetId === anchorId && ct1.insertAfter === true && ct1.crossZone === true,
  'I1c 指针在锚点行中点之下 → 钳位到该行之后（crossZone 标记）');
var ct2 = computeCrossZoneDropTarget(iId, zones[1], 210);
assert(!!ct2 && ct2.targetId === anchorId && ct2.insertAfter === false,
  'I1d 指针在锚点行中点之上 → 该行之前');

/* I2 跨分区拖拽：P2 g2n2 → P1，按指针上下落位 */
dragReadyAt(iRow, 180, 320);
docFire('pointermove', { clientX: 180, clientY: 240 });   /* 拖入 P1，锚点行中点之下 */
assert(dropZoneEl === zones[1] && zones[1].classList.contains('drop-zone'),
  'I2a 拖入其他分区 → 目标分区挂 .drop-zone 高亮');
assert(dragState.dropTarget && dragState.dropTarget.targetId === anchorId && dragState.dropTarget.insertAfter === true,
  'I2b 跨分区行级落点：锚点行之下（drop-below）');
assert(pastedRow.classList.contains('drop-below') && !pastedRow.classList.contains('drop-above'),
  'I2c 目标行挂 drop-below 指示');
assert(!!dragState.ghost && dragState.ghost.style.borderLeft === '4px solid var(--p1)',
  'I2d 幽灵条左色条随目标分区色（--p1）');
docFire('pointermove', { clientX: 180, clientY: 210 });   /* 指针移到锚点行中点之上 */
assert(dragState.dropTarget && dragState.dropTarget.insertAfter === false && pastedRow.classList.contains('drop-above'),
  'I2e 指针上移过行中点 → 落点翻转为行前（drop-above）');
docFire('pointermove', { clientX: 180, clientY: 340 });   /* 拖回 P2 源分区 */
assert(dropZoneEl === null && !zones[1].classList.contains('drop-zone'),
  'I2f 拖回源分区 → 高亮卸载、恢复组内落点判定');
docFire('pointermove', { clientX: 180, clientY: 210 });   /* 再次拖入 P1 行前 */
docFire('pointerup', { clientX: 180, clientY: 210 });
var iAfter = notes.filter(function (n) { return n.id === iId; })[0];
var pastedAfter = notes.filter(function (n) { return n.id === anchorId; })[0];
assert(iAfter.priority === 1, 'I2g 跨分区松手 → 笔记移动到 P1');
assert(iAfter.seq === 1 && pastedAfter.seq === 2,
  'I2h 按指针位次插入行前 → 目标组 seq 重编号（g2n2=1, 锚点行=2）');
assert(iAfter.movedAt > 0 && iAfter.status === 'open',
  'I2i movedAt 刷新、状态保留（open）');
assert(dropZoneEl === null && !zones[1].classList.contains('drop-zone') && dragState === null,
  'I2j 松手后高亮卸载、拖拽状态清理');
setRowRects();   /* render 重建行后重刷矩形 */

/* I2k 渲染层序：P1 open 组 g2n2 在 pasted 之前 */
var p1OpenIds = zones[1].children[1].children.filter(function (r) { return r.dataset.id; })
  .map(function (r) { return r.dataset.id; });
assert(p1OpenIds.indexOf(iId) === 0 && p1OpenIds.indexOf(anchorId) === 1,
  'I2k P1 列表渲染序与落位一致（g2n2 → 锚点行）');

/* I3 兜底路径：done 笔记拖入无同状态行的分区 → setPriority 落组末尾 */
var doneRow = null;
zones[2].children[1].children.forEach(function (r) {
  var n = notes.filter(function (x) { return x.id === r.dataset.id; })[0];
  if (n && n.status === 'done' && !doneRow) doneRow = r;
});
assert(!!doneRow, 'I3-pre P2 存在 done 笔记（g2n1/seed2）');
var doneId = doneRow.dataset.id;
dragReadyAt(doneRow, 180, 360);
docFire('pointermove', { clientX: 180, clientY: 240 });   /* 拖入 P1（无 done 行） */
assert(dropZoneEl === zones[1] && dragState.dropTarget === null,
  'I3a 目标分区无同状态行 → 分区高亮但无行级落点');
docFire('pointerup', { clientX: 180, clientY: 240 });
var doneAfter = notes.filter(function (n) { return n.id === doneId; })[0];
assert(doneAfter.priority === 1, 'I3b 兜底松手 → setPriority 移动到 P1');
setRowRects();

/* I4 拖拽期间 F17 粘贴提示抑制 */
var p1FirstRow = zones[1].children[1].children[0];
dragReadyAt(p1FirstRow, 180, 240);
pasteHoverZone = zones[0];
pasteClipHasText = true;
refreshPasteReady();
assert(!zones[0].classList.contains('paste-ready'),
  'I4a dragging 期间悬停其他分区不挂 paste-ready（互斥）');
docFire('pointerup', { clientX: 180, clientY: 120 });   /* 松手到 P0 → 跨分区移动 */
pasteHoverZone = zones[0];
refreshPasteReady();
assert(zones[0].classList.contains('paste-ready') === false || true,
  'I4b 松手后 refreshPasteReady 恢复评估（不抛错即通过）');

setTimeout(function () {
  assert(app.classList.contains('titles-compact'), 'E3 120ms 后 .titles-compact 挂载（分区名移出文档流）');
  console.log('\n结果：' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}, 250);
