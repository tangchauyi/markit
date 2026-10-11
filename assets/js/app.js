/* ============================================================
   数据层：localStorage 持久化（key: markit_notes）
   主进程兼容钩子：window.markitHost（可选注入，不存在则纯 localStorage）
   ============================================================ */
'use strict';

var STORAGE_KEY = 'markit_notes';

function loadNotes() {
  var raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* 隐私模式等 */ }
  // 主进程可通过 window.__MARKIT_NOTES__ 注入初始数据（文件持久化方案）
  if (!raw && Array.isArray(window.__MARKIT_NOTES__)) {
    raw = JSON.stringify(window.__MARKIT_NOTES__);
  }
  if (!raw) return [];
  try {
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(function (n) {
      return n && typeof n.text === 'string' &&
             (n.priority === 0 || n.priority === 1 || n.priority === 2 || n.priority === 3);
    }).map(function (n) {
    var note = {
      id: String(n.id || uid()),
      text: n.text,
      priority: n.priority,
      createdAt: n.createdAt || 0,
      // F12 状态字段：旧数据无 status 一律视为 open（localStorage 兼容）
      status: (n.status === 'done' || n.status === 'dropped') ? n.status : 'open',
      // F15 statusAt（v1.4）：最近一次状态变更时间戳（ms）。
      // 存量兼容：旧数据无此字段 → 0 = 无状态事件，日历只按 createdAt 计新建日，
      // 升级前已完成/不干了的笔记其状态变更日不可知、不展示（PRD F15 如实声明）
      statusAt: (typeof n.statusAt === 'number' && isFinite(n.statusAt) && n.statusAt > 0) ? n.statusAt : 0,
      // F22 movedAt（v1.8，PRD 决策点 38）：进入当前分区的时间戳（⇅ 移动时刻）。
      // 新建笔记不写此字段（0），open 组排序键 = movedAt || createdAt（入区时间）；
      // 存量兼容：v1.8 前旧数据无此字段 → 0，open 组按 createdAt 兜底（一次性迁移差异，
      // 升级前被 ⇅ 移动过的旧笔记首排位置可能与升级前展示不同，PRD 如实声明）
      movedAt: (typeof n.movedAt === 'number' && isFinite(n.movedAt) && n.movedAt > 0) ? n.movedAt : 0
    };
    /* F25 seq（v1.9）：同分区同状态组的手动排序序号（拖拽写入 1..n）。
       仅当存量数据含合法正整数 seq 时才保留该字段；无 seq 的旧数据不新增此字段
       （保持 JSON.stringify 输出与旧版一致，避免无谓的存储结构变化）。
       非拖拽路径（新建/⇅/状态变更/取消恢复）均不写 seq，自然落组末尾。 */
    if (typeof n.seq === 'number' && isFinite(n.seq) && n.seq > 0) note.seq = n.seq;
    return note;
    });
  } catch (e) { return []; }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch (e) { /* 忽略写入失败 */ }
  try {
    if (window.markitHost && typeof window.markitHost.persist === 'function') {
      window.markitHost.persist(JSON.stringify(notes));
    }
  } catch (e) { /* 主进程钩子异常不影响本地 */ }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* IME 组合期守卫：中文/日文等输入法选字回车（composition 会话内）不触发保存。
   isComposing 覆盖标准路径；keyCode 229 兜底部分旧内核在 keydown 时未置位的情况 */
function isImeComposing(e) {
  return e.isComposing === true || e.keyCode === 229;
}

/* ============================================================
   状态
   ============================================================ */
var notes = loadNotes();
var pendingUndo = null;   // { note, index } 删除撤销暂存
var toastTimer = null;

/* ============================================================
   DOM 引用
   ============================================================ */
var app = document.getElementById('app');
/* 跨平台修饰键（v2.1）：Windows 用 Ctrl+V，Mac 用 ⌘V；body 挂 .win 供 CSS 文案切换 */
var IS_WIN = /win/i.test((typeof navigator !== 'undefined' && navigator.platform) ||
  (typeof navigator !== 'undefined' && navigator.userAgent) || '');
if (IS_WIN && document.body && document.body.classList && document.body.classList.add) {
  document.body.classList.add('win');
}
var quickInput = document.getElementById('quickInput');
var collapseBtn = document.getElementById('collapseBtn');
var expandBtn = document.getElementById('expandBtn'); // 胶囊内的展开按钮（no-drag，真机可点击）
var sectionsScroll = document.getElementById('sectionsScroll');
var capsuleCount = document.getElementById('capsuleCount');
var toast = document.getElementById('toast');
var undoBtn = document.getElementById('undoBtn');

/* ============================================================
   F29 i18n（v1.11，2026-10-11）：启动时探测系统语言，适配 zh-CN / zh-Hant / en。
   跟随系统、不做运行中切换与偏好持久化（改系统语言后重启生效，PRD F29）；
   探测失败/未知语言兜底 en（国际通用语，产品决策 2026-10-11：非中文/英文系统用户看英语比看简中可用性更高；自测 shim 无 location → l 为空 → 同样落 en，确定性不变）。
   仅供自测注入：I18N.setLocale('en') + applyStaticI18n()。
   ============================================================ */
var I18N = (function () {
  var DICT = {
    'zh-CN': {
      zoneTitle: ['重要且紧急', '重要但不紧急', '不重要但紧急', '不重要且不紧急'],
      empty: ['双击此处，先记下最要紧的事', '双击此处，安排重要的事', '双击此处，记下急事先处理', '双击此处，随手记点什么'],
      footHint: '双击记一条',
      placeholder: '记一条，回车保存',
      toastDeleted: '已删除 ·', undo: '撤销',
      act: { priority: '切换优先级', edit: '编辑', done: '标记完成', drop: '不干了', undo: '取消状态', del: '删除' },
      groups: { created: 'Mark', done: '完成', dropped: '放弃' },
      ariaCal: '日历回顾', ariaCollapse: '收起为胶囊', ariaClose: '退出应用', ariaCloseCal: '关闭日历',
      ariaPrev: '上一月', ariaNext: '下一月',
      calHint: '点一个日期，回看那天的记录', calEmpty: '这天没有留下记录',
      capsuleTitle: '拖动移动位置', expand: '展开',
      pasteMac: '⌘V 粘贴到这里', pasteWin: 'Ctrl+V 粘贴到这里',
      ariaAbout: '关于 Mark it!',
      aboutToggle: '匿名使用统计',
      aboutPrivacy: '仅上报随机编号、版本与语言，不含笔记内容',
      calTitle: function (y, m) { return y + '年' + (m + 1) + '月'; }
    },
    'zh-Hant': {
      zoneTitle: ['重要且緊急', '重要但不緊急', '不重要但緊急', '不重要且不緊急'],
      empty: ['雙擊此處，先記下最要緊的事', '雙擊此處，安排重要的事', '雙擊此處，記下急事先處理', '雙擊此處，隨手記點什麼'],
      footHint: '雙擊記一條',
      placeholder: '記一條，Enter 儲存',
      toastDeleted: '已刪除 ·', undo: '撤銷',
      act: { priority: '切換優先級', edit: '編輯', done: '標記完成', drop: '不幹了', undo: '取消狀態', del: '刪除' },
      groups: { created: 'Mark', done: '完成', dropped: '放棄' },
      ariaCal: '日曆回顧', ariaCollapse: '收起為膠囊', ariaClose: '退出應用', ariaCloseCal: '關閉日曆',
      ariaPrev: '上一月', ariaNext: '下一月',
      calHint: '點一個日期，回看那天的記錄', calEmpty: '這天沒有留下記錄',
      capsuleTitle: '拖動移動位置', expand: '展開',
      pasteMac: '⌘V 貼上到這裡', pasteWin: 'Ctrl+V 貼上到這裡',
      ariaAbout: '關於 Mark it!',
      aboutToggle: '匿名使用統計',
      aboutPrivacy: '僅上報隨機編號、版本與語言，不含筆記內容',
      calTitle: function (y, m) { return y + '年' + (m + 1) + '月'; }
    },
    'en': {
      zoneTitle: ['Urgent & Important', 'Important, Not Urgent', 'Urgent, Not Important', 'Not Urgent, Not Important'],
      empty: ['Double-click to add the most urgent thing', 'Double-click to add something important', 'Double-click to add something urgent', 'Double-click to jot down anything'],
      footHint: 'Double-click to add',
      placeholder: 'Type a note — Enter to save',
      toastDeleted: 'Deleted ·', undo: 'Undo',
      act: { priority: 'Switch priority', edit: 'Edit', done: 'Mark done', drop: 'Drop it', undo: 'Clear status', del: 'Delete' },
      groups: { created: 'Mark', done: 'Done', dropped: 'Dropped' },
      ariaCal: 'Calendar', ariaCollapse: 'Collapse to capsule', ariaClose: 'Quit app', ariaCloseCal: 'Close calendar',
      ariaPrev: 'Previous month', ariaNext: 'Next month',
      calHint: 'Pick a day to revisit your notes', calEmpty: 'No notes on this day',
      capsuleTitle: 'Drag to move', expand: 'Expand',
      pasteMac: '⌘V to paste here', pasteWin: 'Ctrl+V to paste here',
      ariaAbout: 'About Mark it!',
      aboutToggle: 'Anonymous usage stats',
      aboutPrivacy: 'Only a random ID, app version and language are sent — never your notes',
      calTitle: function (y, m) { return ['January','February','March','April','May','June','July','August','September','October','November','December'][m] + ' ' + y; }
    }
  };
  var cur = (function () {
    var l = '';
    try {
      // 仅在真实浏览器/renderer 环境信任 navigator.language（有 location）；
      // Node 自测 shim 的 navigator.language 是宿主机 en-US，不参与探测（无 location）→ 兜底 en
      if (typeof location !== 'undefined' && location.href &&
          typeof navigator !== 'undefined' && navigator.language)
        l = String(navigator.language).toLowerCase();
    } catch (e) {}
    if (l.indexOf('zh') === 0) return /(tw|hk|mo|hant)/.test(l) ? 'zh-Hant' : 'zh-CN';
    if (l.indexOf('en') === 0) return 'en';
    return 'en';
  })();
  function t(k) { return DICT[cur][k]; }
  function setLocale(l) { if (DICT[l]) cur = l; }   // 仅供自测注入，产品路径不调用
  return { t: t, setLocale: setLocale, locale: function () { return cur; } };
})();

var EMPTY_TEXT = I18N.t('empty');
var ZONE_NAMES = {
  0: 'P0 ' + I18N.t('zoneTitle')[0],
  1: 'P1 ' + I18N.t('zoneTitle')[1],   // F19 v1.7：「且」→「但」，与 zone-title/zone-title-float 同源同步
  2: 'P2 ' + I18N.t('zoneTitle')[2],
  3: 'P3 ' + I18N.t('zoneTitle')[3]
};
var ZONE_VARS = {
  0: 'var(--p0)', 1: 'var(--p1)', 2: 'var(--p2)', 3: 'var(--p3)'
};

/* F29：静态 DOM 文案按 locale 应用（defer 脚本执行时 DOM 已就绪）；
   CSS 悬停粘贴提示走 --paste-hint（平台 ⌘/Ctrl × 语言三维组合由 JS 定值） */
function applyStaticI18n() {
  if (typeof document.querySelectorAll !== 'function') return;   // 自测 shim 无该能力：静态文案本就是中文源码，跳过
  var isWin = false;
  try { isWin = /win/i.test((typeof navigator !== 'undefined' && navigator.platform) || ''); } catch (e) {}
  try {
    var de = document.documentElement;
    if (de && de.style && de.style.setProperty) de.style.setProperty('--paste-hint', '"' + (isWin ? I18N.t('pasteWin') : I18N.t('pasteMac')) + '"');
  } catch (e) {}   // 自测 shim 无 documentElement 时跳过（真实 Electron 恒可用）
  var zt = document.querySelectorAll('.zone-title');
  var ztf = document.querySelectorAll('.zone-title-float');
  var zf = document.querySelectorAll('.zone-foot-hint');
  [0, 1, 2, 3].forEach(function (p) {
    if (zt[p]) zt[p].textContent = I18N.t('zoneTitle')[p];
    if (ztf[p]) ztf[p].textContent = I18N.t('zoneTitle')[p];
    if (zf[p]) zf[p].textContent = I18N.t('footHint');
  });
  var q = function (s) { return document.querySelector(s); };
  if (q('#quickInput')) q('#quickInput').placeholder = I18N.t('placeholder');
  if (q('#calBtn')) q('#calBtn').setAttribute('aria-label', I18N.t('ariaCal'));
  if (q('#aboutBtn')) q('#aboutBtn').setAttribute('aria-label', I18N.t('ariaAbout'));
  if (q('#collapseBtn')) q('#collapseBtn').setAttribute('aria-label', I18N.t('ariaCollapse'));
  if (q('#closeBtn')) q('#closeBtn').setAttribute('aria-label', I18N.t('ariaClose'));
  if (q('#capsule')) q('#capsule').title = I18N.t('capsuleTitle');
  if (q('#expandBtn')) q('#expandBtn').title = I18N.t('expand');
  if (q('#toast span')) q('#toast span').textContent = I18N.t('toastDeleted');
  if (q('#undoBtn')) q('#undoBtn').textContent = I18N.t('undo');
}
applyStaticI18n();

/* ============================================================
   F30 匿名启动统计（v1.12，PRD 第 14 章）：PostHog 原生 fetch 上报，零 SDK 依赖。
   - 仅上报随机 ID / 版本 / 平台 / 语言，绝不包含笔记内容（诚实人设硬约束）；
   - opt-out：关于卡片开关写 localStorage['analytics_opt_out']='1'，启动时检查；
   - PH_KEY 为空 = 未接入采集端，整体 no-op 不发任何请求；
   - fire-and-forget：失败静默不重试不排队，离线丢事件可接受。
   ============================================================ */
var ANALYTICS_OPT_KEY = 'analytics_opt_out';
var ANALYTICS_ID_KEY = 'anon_id';
var PH_KEY = 'phc_tJN9yKkuZ6uEKzZVyuFwHz2hpGQbHVJ5eHsmo9g7AZD4';   // PostHog 项目 Key（公开凭据，可嵌入客户端）
var PH_HOST = 'https://us.i.posthog.com';

function analyticsEnabled() {
  try { return localStorage.getItem(ANALYTICS_OPT_KEY) !== '1'; } catch (e) { return false; }
}
function anonId() {
  try {
    var v = localStorage.getItem(ANALYTICS_ID_KEY);
    if (!v) {
      v = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(ANALYTICS_ID_KEY, v);
    }
    return v;
  } catch (e) { return null; }
}
function reportLaunch() {
  if (!PH_KEY || !analyticsEnabled()) return;   // 未接入 / 用户拒绝 / 存储异常 → 不上报
  try {
    // 自测 shim（有 location 才算真实 renderer）与老环境不上报
    if (typeof fetch !== 'function' || typeof location === 'undefined' || !location.href) return;
    sendEvent('app_launch');
  } catch (e) { /* 网络异常不崩应用 */ }
}
function sendEvent(ev) {
  try {
    var appVer = (typeof window.__MARKIT_VERSION__ === 'string' && window.__MARKIT_VERSION__) || 'dev';
    fetch(PH_HOST + '/i/v0/e/', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PH_KEY, event: ev, distinct_id: anonId(),
        properties: { $lib: 'markit-app', version: appVer,
          os: IS_WIN ? 'windows' : 'mac', lang: I18N.locale() }
      })
    }).catch(function () {});
  } catch (e) { /* 网络异常不崩应用 */ }
}
reportLaunch();

/* F30b 跨天心跳（v1.13）：app 长期不关时，方案二的启动上报只会记到启动当天，
   by-day 统计会漏掉后续挂机日。这里补一个至多每天一条的 app_active 事件：
   - 本地记 last_ping_day（本地时区自然日，YYYY-MM-DD），同日去重不重发；
   - 触发点 = 启动时 + 每 30 分钟定时 + 窗口从隐藏恢复可见时（覆盖系统休眠唤醒）；
   - 复用与 reportLaunch 完全相同的开关/自测豁免/匿名规则，语义 = 「该日 app 处于挂载状态」，
     不代表用户当天有交互（诚实人设：字段名就叫 app_active，不叫 daily_use）。 */
var PING_DAY_KEY = 'last_ping_day';
function localDayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function reportDailyPing() {
  if (!PH_KEY || !analyticsEnabled()) return;
  if (typeof fetch !== 'function' || typeof location === 'undefined' || !location.href) return;
  var today;
  try { today = localStorage.getItem(PING_DAY_KEY); } catch (e) { today = null; }
  var dayKey = localDayKey();
  if (today === dayKey) return;                     // 今天已报 → 不重发
  try { localStorage.setItem(PING_DAY_KEY, dayKey); } catch (e) { /* 隐私模式等 */ }
  try {
    var appVer = (typeof window.__MARKIT_VERSION__ === 'string' && window.__MARKIT_VERSION__) || 'dev';
    fetch(PH_HOST + '/i/v0/e/', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PH_KEY, event: 'app_active', distinct_id: anonId(),
        properties: { $lib: 'markit-app', version: appVer,
          os: IS_WIN ? 'windows' : 'mac', lang: I18N.locale() }
      })
    }).catch(function () {});
  } catch (e) { /* 网络异常不崩应用 */ }
}
reportDailyPing();                                             // 启动当天立即补一条
setInterval(reportDailyPing, 30 * 60 * 1000);                  // 每半小时检查跨天
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) reportDailyPing();                   // 唤醒/切回时兜底检查
  });
}

/* ============================================================
   渲染：按优先级分组，重建四个分区列表 + 角标 + 空态
   F22（v1.8）：展示顺序 = open → done → dropped 三组，组内按时间升序；
   排序仅发生在渲染层，notes 数组本身顺序不动（PRD T4a 裁决：数据层下标
   语义不变，setStatus/undo 均不改下标，撤销删除按原下标 splice 回插不变）。
   ============================================================ */
var STATUS_RANK = { open: 0, done: 1, dropped: 2 };   // F22 三组固定顺序（§AD：组间零视觉分隔）

/* F22 open 组排序键「入区时间」（PRD 决策点 38）：新建 = createdAt，⇅ 移入 = movedAt。
   movedAt 为 0（新建 / 存量旧数据）时按 createdAt 兜底。 */
function zoneEnterAt(n) {
  return (n.movedAt > 0 ? n.movedAt : n.createdAt) || 0;
}

/* F22 渲染层排序（决策点 37）：返回排序副本，不改原数组。
   - 组间：open(0) → done(1) → dropped(2)，不穿插；
   - 组内 v1.9 起为两层：第一层 seq（手动拖拽序，0 表示未设 → 无手动序的排在有 seq 之后）；
   - 第二层为时间键（v1.8 原规则）：open 组按入区时间升序；done/dropped 组按 statusAt 升序；
   - 同键并列（同毫秒）：createdAt 升序 → id 字典序，稳定可复现。 */
function sortForDisplay(arr) {
  return arr.slice().sort(function (a, b) {
    var ra = STATUS_RANK[a.status], rb = STATUS_RANK[b.status];
    if (ra !== rb) return ra - rb;
    /* F25: seq 为组内第一层（手动拖拽序优先于时间键） */
    var hasSeqA = typeof a.seq === 'number' && a.seq > 0;
    var hasSeqB = typeof b.seq === 'number' && b.seq > 0;
    if (hasSeqA !== hasSeqB) return hasSeqA ? -1 : 1;
    if (hasSeqA && hasSeqB && a.seq !== b.seq) return a.seq - b.seq;
    var ka = a.status === 'open' ? zoneEnterAt(a) : a.statusAt;
    var kb = b.status === 'open' ? zoneEnterAt(b) : b.statusAt;
    if (ka !== kb) return ka - kb;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });
}

function render() {
  var grouped = { 0: [], 1: [], 2: [], 3: [] };
  var openCount = { 0: 0, 1: 0, 2: 0, 3: 0 };
  notes.forEach(function (n) {
    grouped[n.priority].push(n);
    if (n.status === 'open') openCount[n.priority]++;  // F12：分区角标只计普通态
  });

  [0, 1, 2, 3].forEach(function (p) {
    var list = document.querySelector('.note-list[data-list="' + p + '"]');
    var badge = document.querySelector('.zone-badge[data-count="' + p + '"]');
    badge.textContent = String(openCount[p]);
    list.textContent = '';

    if (grouped[p].length === 0) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = I18N.t('empty')[p];
      empty.appendChild(buildScribble());     // 马克笔划线（design §J）
      list.appendChild(empty);
    } else {
      // F22：按渲染层排序展示（notes 数组顺序不动，重排瞬时生效无位移动画 §AD）
      sortForDisplay(grouped[p]).forEach(function (n) {
        list.appendChild(buildNoteRow(n, p));
      });
    }
  });

  // F12：胶囊总角标只统计普通态，完成/不干了不计入
  var openTotal = 0;
  notes.forEach(function (n) { if (n.status === 'open') openTotal++; });
  capsuleCount.textContent = String(openTotal);
}

/* 空态马克笔划线 SVG（design §J）：stroke 色由 CSS 引用渐变 defs（深浅色各一套） */
function buildScribble() {
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'empty-scribble');
  svg.setAttribute('viewBox', '0 0 64 8');
  svg.setAttribute('aria-hidden', 'true');
  var path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M2 5 C14 1 26 9 40 4 S58 7 62 4');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-width', '3');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('opacity', '0.9');
  svg.appendChild(path);
  return svg;
}

function buildNoteRow(n, p) {
  var row = document.createElement('div');
  row.className = 'note';
  row.dataset.id = n.id;
  row.dataset.status = n.status;               // F12 三态：open / done / dropped

  var text = document.createElement('span');
  text.className = 'note-text';
  text.textContent = n.text;           // textContent，防注入
  row.appendChild(text);

  // 行尾常驻标记（design §H/§I）：open=呼吸点线索，done=渐变✓徽标，dropped=灰描边✕
  var flag = document.createElement('span');
  if (n.status === 'done') {
    flag.className = 'note-flag note-flag-done';
    flag.innerHTML = '<svg viewBox="0 0 16 16" width="10" height="10"><path d="M3.2 8.6 6.6 11.8 12.8 4.6" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  } else if (n.status === 'dropped') {
    flag.className = 'note-flag note-flag-drop';
    flag.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4 12 12 M12 4 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  } else {
    flag.className = 'note-dot';
    flag.setAttribute('aria-hidden', 'true');
  }
  row.appendChild(flag);

  // 操作组（design §I）：普通态 [⇅][✎][✓][⊘][✕]；已标状态态 [⇅][✎][↺][✕]
  var actions = document.createElement('span');
  actions.className = 'note-actions';

  actions.appendChild(actionBtn('priority', I18N.t('act').priority,
    '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M5 3v10M5 13l-2.2-2.2M5 13l2.2-2.2M11 13V3M11 3L8.8 5.2M11 3l2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'));
  actions.appendChild(actionBtn('edit', I18N.t('act').edit,
    '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 13h2.2l7.1-7.1-2.2-2.2L3 10.8V13z" fill="currentColor"/><path d="M10.6 2.5l2.9 2.9.9-.9c.4-.4.4-1.05 0-1.45L13 2.1c-.4-.4-1.05-.4-1.45 0l-.95.95z" fill="currentColor"/></svg>'));
  if (n.status === 'open') {
    actions.appendChild(actionBtn('done', I18N.t('act').done,
      '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3.2 8.6 6.6 11.8 12.8 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'st'));
    actions.appendChild(actionBtn('drop', I18N.t('act').drop,
      '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.4 4.4 11.6 11.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>', 'st'));
  } else {
    actions.appendChild(actionBtn('undo', I18N.t('act').undo,
      '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M2.8 6.2 A5.4 5.4 0 1 1 2.7 9.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2.8 2.6 v3.6 h3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'st'));
  }
  actions.appendChild(actionBtn('delete', I18N.t('act').del,
    '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'));

  row.appendChild(actions);

  // F25（v1.9）：长按 500ms 进入拖拽就绪态（同分区+同状态组内重排）
  row.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;                        // 仅主键
    if (e.target.closest('.nact')) return;             // 操作按钮不参与长按
    if (dragState) return;                             // 同一时刻仅一条拖拽
    initDrag(row, e);
  });

  return row;
}

// 备注条操作按钮 tooltip：body 级单例气泡，fixed 定位不受 .note overflow:hidden 裁剪
var nactTipEl = null, nactTipTimer = null;
function nactTipShow(btn) {
  nactTipHide();
  nactTipTimer = setTimeout(function () {
    if (!nactTipEl) {
      nactTipEl = document.createElement('div');
      nactTipEl.className = 'nact-tip';
      nactTipEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(nactTipEl);
    }
    nactTipEl.textContent = btn.dataset.tip || '';
    var r = btn.getBoundingClientRect();
    // 先归零测量宽度，再做水平夹紧（防右缘溢出窗口）与上下翻转（防底部溢出）
    nactTipEl.style.left = '0px';
    nactTipEl.style.top = '0px';
    var w = nactTipEl.offsetWidth, h = nactTipEl.offsetHeight;
    var cx = Math.min(Math.max(r.left + r.width / 2, w / 2 + 4), window.innerWidth - w / 2 - 4);
    var below = r.bottom + 6;
    nactTipEl.style.left = Math.round(cx) + 'px';
    nactTipEl.style.top = Math.round(below + h > window.innerHeight - 4 ? r.top - 6 - h : below) + 'px';
    nactTipEl.classList.add('show');
  }, 80);   // 80ms 短延迟仅防掠过误触（原生 title 约 1.5s，用户反馈太慢）
}
function nactTipHide() {
  clearTimeout(nactTipTimer);
  if (nactTipEl) nactTipEl.classList.remove('show');
}

function actionBtn(act, title, svg, cls) {
var b = document.createElement('button');
b.className = cls ? 'nact ' + cls : 'nact';
b.type = 'button';
// 原生 title 延迟过长（macOS 约 1.5s+），改用自绘快出 tooltip（.nact-tip，80ms）
b.dataset.tip = title;
b.setAttribute('aria-label', title);
b.addEventListener('mouseenter', function () { nactTipShow(b); });
b.addEventListener('mouseleave', nactTipHide);
b.addEventListener('click', nactTipHide);
  b.dataset.act = act;
  b.innerHTML = svg;
  return b;
}

/* ============================================================
   增 / 删 / 改 / 移动
   ============================================================ */

// 插入到某分区组末尾
function insertAtEndOfGroup(note, p) {
  var lastIdx = -1;
  for (var i = notes.length - 1; i >= 0; i--) {
    if (notes[i].priority === p) { lastIdx = i; break; }
  }
  if (lastIdx === -1) notes.push(note);
  else notes.splice(lastIdx + 1, 0, note);
}

function addNote(text, priority) {
  // F22：新建不写 movedAt（0），open 组排序键 = movedAt || createdAt = createdAt（入区时间=新建时刻）
  var note = { id: uid(), text: text, priority: priority, createdAt: Date.now(), status: 'open', statusAt: 0, movedAt: 0 };
  insertAtEndOfGroup(note, priority);
  persist();
  render();
  markNoteEntering(note.id);   // F2/F3/F17 统一入场动画 + paste-flash 高亮（§W）；createdAt 已计入 → 日历「新建」事件自然生效
  return note;
}

/* 新建行挂 .note-enter：入场 300ms ease-out（opacity/translateY 8→0）+ 背景
   paste-flash 高亮渐隐（§W）；render() 重建行后按 id 找回，动画播完即恢复常规样式 */
function markNoteEntering(id) {
  var row = document.querySelector('.note[data-id="' + id + '"]');
  if (row) row.classList.add('note-enter');
}

function findIndexById(id) {
  for (var i = 0; i < notes.length; i++) {
    if (notes[i].id === id) return i;
  }
  return -1;
}

function deleteNote(id) {
  var idx = findIndexById(id);
  if (idx === -1) return;
  pendingUndo = { note: notes[idx], index: idx };
  notes.splice(idx, 1);
  persist();
  render();
  showToast();
}

function undoDelete() {
  if (!pendingUndo) return;
  var idx = Math.min(pendingUndo.index, notes.length);
  notes.splice(idx, 0, pendingUndo.note);
  pendingUndo = null;
  persist();
  render();
  hideToast(true);
}

function setPriority(id, p) {
  var idx = findIndexById(id);
  if (idx === -1) return;
  var note = notes[idx];
  if (note.priority === p) return;      // 未变化
  notes.splice(idx, 1);
  insertAtEndOfGroup(note, p);
  note.priority = p;
  note.movedAt = Date.now();   // F22（v1.8）：入区时间 = 移动时刻 → 渲染层落目标分区 open 组末尾（F4 AC6 不回退）
  delete note.seq;             // F25（v1.9）：跨分区移动后手动序失效，落目标分区 open 组末尾
  persist();                    // movedAt 随笔记落盘（决策点 38），重启后排序稳定（AC7）
  render();
}

function updateText(id, text) {
  var idx = findIndexById(id);
  if (idx === -1) return;
  notes[idx].text = text;
  persist();
  render();
}

/* F12：设置笔记状态（open / done / dropped），笔记保留原分区（不跨分区）；
   v1.8 修订（F22）：分区内展示位置由 F22 渲染层排序决定（标完沉到 open 组之后），
   notes 数组下标不变（T4a 数据层断言继续成立）。
   「取消」即传 'open' 恢复普通态，不是独立状态；取消不改入区时间，回 open 组规则位。
   F15（v1.4）：标「完成/不干了」同步写入 statusAt = Date.now()（仅记最近一次）；
   ↺ 取消恢复 open 时把 statusAt 清零——该次状态变更不再计入任何日期的记录
   （PRD F15「取消不计记录」验收）。persist 落盘含新字段。 */
function setStatus(id, status) {
  var idx = findIndexById(id);
  if (idx === -1) return;
  if (notes[idx].status === status) return;
  notes[idx].status = status;
  notes[idx].statusAt = (status === 'done' || status === 'dropped') ? Date.now() : 0;
  delete notes[idx].seq;  // F25（v1.9）：状态变更后手动序失效，落新状态组末尾（AC6）
  persist();
  render();
}

/* ============================================================
   F25（v1.9）+ F29（v2.1）：拖拽排序与跨分区移动
   ============================================================
   F25 同分区 + 同状态组内重排（seq 持久化）：
   - 长按 500ms 且位移 ≤4px → 进入拖拽就绪态（.drag-ready）
   - 移动 → 跟手幽灵条 + 落点指示（.drop-above / .drop-below）
   - 松手 → 同组内重排 + seq 重编号（1..n）+ 持久化
   - 跨组/跨分区越界松手 → 取消回弹（不改 seq、不重排）
   F29 跨分区移动（v2.1）：
   - 拖拽中指针进入其他分区 → 该分区挂 .drop-zone（虚线高亮）+ 幽灵条左色条变色
   - 落位跟随指针：目标分区同状态组内按指针上下取目标行（.drop-above/.drop-below），
     带外钳位到组首前/组末后；目标组为空 → 落组末尾
   - 松手 → moveNoteCross 移动到目标分区对应位次（movedAt 刷新、seq 重编号）
   - 拖拽期间 F17 悬停粘贴提示抑制（视觉/语义互斥）
   - 状态变更/⇅ 移动/新建 → seq 自动清空（本条已由 setStatus/setPriority/addNote 处理）
   ============================================================ */
var DRAG_DELAY = 500;         // 长按阈值（ms）
var DRAG_TOLERANCE = 4;      // 位移容差（px）：按下后 500ms 内位移 >4px 视为滑动，取消长按
var dragState = null;         // 当前拖拽状态：{ id, row, startX, startY, ready, timer, ghost, dropTarget }
var dragGuardUntil = 0;       // 拖拽结束后的短暂抑制窗口（防止 pointerup 后紧随的 click/dblclick 误触发）

function initDrag(row, e) {
  if (dragState) return; // 已有拖拽进行中
  var id = row.dataset.id;
  if (id === undefined || id === null || findIndexById(id) === -1) return;

  dragState = {
    id: id,
    row: row,
    startX: (e && e.clientX !== undefined) ? e.clientX : 0,
    startY: (e && e.clientY !== undefined) ? e.clientY : 0,
    ready: false,          // 是否已进入拖拽就绪态
    ghost: null,           // 跟手幽灵条
    dropTarget: null,      // 当前落点 { targetId, insertAfter, row }
    timer: null
  };

  dragState.timer = setTimeout(function () {
    if (!dragState || dragState.ready) return;
    dragState.ready = true;
    dragState.row.classList.add('drag-ready');
    document.body.classList.add('dragging');
  }, DRAG_DELAY);

  document.addEventListener('pointermove', dragPointerMove);
  document.addEventListener('pointerup', dragPointerUp);
  document.addEventListener('pointercancel', dragPointerCancel);
}

/* 停止拖拽追踪：清定时器/落点指示/dragState/指针监听（不动视觉，返回现场供调用方接管） */
function stopDragTracking() {
  if (!dragState) return null;
  if (dragState.timer) { clearTimeout(dragState.timer); dragState.timer = null; }
  clearDropIndicator();
  setDropZone(null);   // F29：拖拽结束同步卸载跨分区高亮
  var parts = { row: dragState.row, ghost: dragState.ghost, wasReady: dragState.ready };
  dragState = null;
  document.removeEventListener('pointermove', dragPointerMove);
  document.removeEventListener('pointerup', dragPointerUp);
  document.removeEventListener('pointercancel', dragPointerCancel);
  return parts;
}

function cancelDragTracking() {
  var parts = stopDragTracking();
  if (!parts) return;
  if (parts.ghost && parts.ghost.parentNode) {
    parts.ghost.remove();
  }
  if (parts.wasReady) {
    // 只有进入就绪态才有视觉反馈需要清理
    parts.row.classList.remove('drag-ready');
    document.body.classList.remove('dragging');
  }
}

/* §AE 取消回弹（F25 AC3/AC4）：原地/跨组/跨分区越界松手 → 不写 seq、不重排，
   跟手条自当前位置插值位移回原槽位，180ms ease-out、scale 1.03→1、opacity 0.85→1
   同步复原，到位后移除跟手条、恢复原条；reduced-motion 0ms 瞬时复位。 */
function playCancelBounce() {
  var parts = stopDragTracking();
  if (!parts) return;
  var ghost = parts.ghost;
  var row = parts.row;
  var duration = CAL_REDUCED ? 0 : 180;

  function finish() {
    if (ghost && ghost.parentNode) ghost.remove();   // 移除跟手条
    row.classList.remove('drag-ready');               // 恢复原条（.dragging 移除 → 呼吸点恢复）
    document.body.classList.remove('dragging');
  }

  if (!ghost || !ghost.parentNode || duration === 0) {
    finish();
    return;
  }
  var rect = row.getBoundingClientRect();   // 原槽位
  ghost.classList.add('drag-return');
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  ghost.style.transform = 'scale(1)';
  ghost.style.opacity = '1';
  setTimeout(finish, duration);
}

function dragPointerMove(e) {
  if (!dragState) return;
  var cx = (e && e.clientX !== undefined) ? e.clientX : dragState.startX;
  var cy = (e && e.clientY !== undefined) ? e.clientY : dragState.startY;

  if (!dragState.ready) {
    // 未就绪：检查位移是否超容差（视为滑动/点击）
    var dx = cx - dragState.startX;
    var dy = cy - dragState.startY;
    if (dx * dx + dy * dy > DRAG_TOLERANCE * DRAG_TOLERANCE) {
      cancelDragTracking();
    }
    return;
  }

  // 已就绪：计算落点 + 更新视觉反馈
  var dropTarget = computeDropTarget(dragState.id, cy);
  updateDragVisual(dropTarget, cx, cy);
}

function dragPointerUp(e) {
  if (!dragState) return;
  var wasReady = dragState.ready;
  var dropTarget = dragState.dropTarget;
  var dragId = dragState.id;
  var targetZone = dropZoneEl;   // F29：stopDragTracking 会清空，先捕获

  if (wasReady) {
    dragGuardUntil = Date.now() + 200; // 抑制紧随的 click/dblclick
    if (dropTarget) {
      cancelDragTracking();
      if (dropTarget.crossZone) {
        // F29 跨分区松手 → 移动到目标分区指针位次（目标行上/下方）
        moveNoteCross(dragId, dropTarget.targetId, dropTarget.insertAfter, parseInt(targetZone.dataset.p, 10));
      } else {
        reorderNote(dragId, dropTarget.targetId, dropTarget.insertAfter);
      }
    } else if (targetZone) {
      // F29 跨分区松手（目标组为空/无同状态行）→ 兜底移动到组末尾
      var p = parseInt(targetZone.dataset.p, 10);
      cancelDragTracking();
      setPriority(dragId, p);
    } else {
      // dropTarget 与目标分区均为 null（原地/越界松手）→ 取消回弹：
      // 无 seq 写入、无重排，播放 §AE 回弹动画（F25 AC3/AC4）
      playCancelBounce();
    }
    refreshPasteReady();   // F29：拖拽结束重估 F17 悬停粘贴提示挂载
  } else {
    cancelDragTracking();
  }
}

function dragPointerCancel(e) {
  if (!dragState) return;
  if (dragState.ready) {
    dragGuardUntil = Date.now() + 200;
  }
  cancelDragTracking();
  refreshPasteReady();   // F29：拖拽中断后重估 F17 悬停粘贴提示挂载
}

function clearDropIndicator() {
  if (!dragState || !dragState.dropTarget || !dragState.dropTarget.row) return;
  dragState.dropTarget.row.classList.remove('drop-above');
  dragState.dropTarget.row.classList.remove('drop-below');
}

/* ---------- F29 跨分区移动：目标分区追踪 / 高亮 / 落点判定 ---------- */
var dropZoneEl = null;   // 当前跨分区悬停的目标分区元素（非 null 时 dropTarget 恒为 null）

function clearReorderIndicators() {   // 清组内重排落点指示并置空 dropTarget
  if (!dragState) return;
  if (dragState.dropTarget && dragState.dropTarget.row) {
    dragState.dropTarget.row.classList.remove('drop-above');
    dragState.dropTarget.row.classList.remove('drop-below');
  }
  dragState.dropTarget = null;
}

/* 指针 Y 所在分区（矩形带内严格判定；分区间 8px 空隙为无主区 → 拖拽取消） */
function zoneUnderPointer(pointerY) {
  var zones = sectionsScroll.querySelectorAll('.zone');
  for (var i = 0; i < zones.length; i++) {
    var r = zones[i].getBoundingClientRect();
    if (pointerY >= r.top && pointerY <= r.bottom) return zones[i];
  }
  return null;
}

/* 维护跨分区目标高亮（.drop-zone 虚线框）+ 幽灵条左色条随目标分区色 */
function setDropZone(zoneEl) {
  if (dropZoneEl === zoneEl) return;
  if (dropZoneEl) dropZoneEl.classList.remove('drop-zone');
  dropZoneEl = zoneEl;
  if (dropZoneEl) dropZoneEl.classList.add('drop-zone');
  if (dragState && dragState.ghost) {
    dragState.ghost.style.borderLeft = dropZoneEl
      ? '4px solid ' + ZONE_VARS[parseInt(dropZoneEl.dataset.p, 10)]
      : '';
  }
}

function dragPointerMove(e) {
  if (!dragState) return;
  var cx = (e && e.clientX !== undefined) ? e.clientX : dragState.startX;
  var cy = (e && e.clientY !== undefined) ? e.clientY : dragState.startY;

  if (!dragState.ready) {
    // 未就绪：检查位移是否超容差（视为滑动/点击）
    var dx = cx - dragState.startX;
    var dy = cy - dragState.startY;
    if (dx * dx + dy * dy > DRAG_TOLERANCE * DRAG_TOLERANCE) {
      cancelDragTracking();
    }
    return;
  }

  // F29：指针在其他分区内 → 跨分区移动模式（分区虚线高亮 + 行级落点跟随指针）
  var zone = zoneUnderPointer(cy);
  var dragNote = notes[findIndexById(dragState.id)];
  if (zone && dragNote && parseInt(zone.dataset.p, 10) !== dragNote.priority) {
    clearReorderIndicators();
    var ct = computeCrossZoneDropTarget(dragState.id, zone, cy);
    if (!dragState.ghost) updateDragVisual(null, cx, cy);   // 先确保幽灵条已创建
    setDropZone(zone);                                       // 分区高亮 + 左色条 accent
    updateDragVisual(ct, cx, cy);                            // 行级落点指示（目标行上/下方）+ 跟手
    return;
  }
  setDropZone(null);

  // 同分区：组内重排落点判定（F25 原逻辑）
  var dropTarget = computeDropTarget(dragState.id, cy);
  updateDragVisual(dropTarget, cx, cy);
}

/* F29 跨分区行级落点：目标分区同状态组内按指针中点判定上/下方；
   带外钳位（指针在组首上方 → 组首前；组末下方 → 组末后），
   组内无同状态行 → null（松手走 setPriority 落组末尾兜底） */
function computeCrossZoneDropTarget(dragId, zoneEl, pointerY) {
  var dragNote = notes[findIndexById(dragId)];
  if (!dragNote || !zoneEl) return null;
  var p = parseInt(zoneEl.dataset.p, 10);
  if (isNaN(p) || p === dragNote.priority) return null;
  var list = zoneEl.querySelector('.note-list[data-list="' + p + '"]');
  if (!list) return null;
  var rows = [];
  var all = list.querySelectorAll('.note');
  for (var i = 0; i < all.length; i++) {
    var note = notes[findIndexById(all[i].dataset.id)];
    if (note && note.status === dragNote.status) rows.push(all[i]);
  }
  if (rows.length === 0) return null;
  var targetRow = null, insertAfter = false;
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j].getBoundingClientRect();
    if (pointerY < r.top + r.height / 2) { targetRow = rows[j]; insertAfter = false; break; }
  }
  if (!targetRow) { targetRow = rows[rows.length - 1]; insertAfter = true; }   // 指针在末行中点之下 → 组末后（钳位）
  return { targetId: targetRow.dataset.id, insertAfter: insertAfter, row: targetRow, crossZone: true };
}

/* F29 跨分区按位次移动：目标分区同状态组内插入到 targetId 上/下方，seq 全组重编号 */
function moveNoteCross(dragId, targetId, insertAfter, targetP) {
  var dragNote = notes[findIndexById(dragId)];
  var targetNote = notes[findIndexById(targetId)];
  if (!dragNote || !targetNote) return;
  if (targetNote.priority !== targetP) return;
  if (dragNote.priority === targetP) return;   // 同分区路径由 reorderNote 负责

  var grouped = { 0: [], 1: [], 2: [], 3: [] };
  notes.forEach(function (n) { grouped[n.priority].push(n); });
  var sortedGroup = sortForDisplay(grouped[targetP])
    .filter(function (n) { return n.status === dragNote.status; });

  /* 防御：被拖行理论上不在目标组内，若在则先摘除 */
  var dragIdx = sortedGroup.findIndex(function (n) { return n.id === dragId; });
  if (dragIdx > -1) sortedGroup.splice(dragIdx, 1);
  var tIdx = sortedGroup.findIndex(function (n) { return n.id === targetId; });
  if (tIdx === -1) return;
  sortedGroup.splice(insertAfter ? tIdx + 1 : tIdx, 0, dragNote);

  /* 数据层：原位置摘除 → 改分区 → 插到目标行邻位（与渲染层序一致） */
  var srcIdx = findIndexById(dragId);
  notes.splice(srcIdx, 1);
  dragNote.priority = targetP;
  dragNote.movedAt = Date.now();   // 入区时间 = 移动时刻（与 ⇅/setPriority 口径一致）
  var tIdxData = findIndexById(targetId);
  notes.splice(insertAfter ? tIdxData + 1 : tIdxData, 0, dragNote);

  /* 目标组 seq 全覆盖重编号（拖拽落位 = 手动序） */
  sortedGroup.forEach(function (n, idx) { n.seq = idx + 1; });

  persist();
  render();
}

function updateDragVisual(dropTarget, cx, cy) {
  // 更新幽灵条
  if (!dragState.ghost) {
    dragState.ghost = document.createElement('div');
    dragState.ghost.className = 'drag-ghost';
    var note = notes[findIndexById(dragState.id)];
    dragState.ghost.textContent = note ? note.text : '';
    document.body.appendChild(dragState.ghost);
  }
  dragState.ghost.style.left = (cx - 168) + 'px'; // 336px 宽的幽灵条居中于指针
  dragState.ghost.style.top = (cy - 18) + 'px';   // 36px 高的幽灵条居中于指针

  // 更新落点指示
  if (dragState.dropTarget && dragState.dropTarget.row) {
    dragState.dropTarget.row.classList.remove('drop-above');
    dragState.dropTarget.row.classList.remove('drop-below');
  }
  dragState.dropTarget = dropTarget;
  if (dropTarget && dropTarget.row) {
    dropTarget.row.classList.add(dropTarget.insertAfter ? 'drop-below' : 'drop-above');
  }
}

function computeDropTarget(dragId, pointerY) {
  var dragNote = notes[findIndexById(dragId)];
  if (!dragNote) return null;
  var sameGroupRows = [];
  var allRows = sectionsScroll.querySelectorAll('.note');
  for (var i = 0; i < allRows.length; i++) {
    var note = notes[findIndexById(allRows[i].dataset.id)];
    if (note && note.priority === dragNote.priority && note.status === dragNote.status) {
      sameGroupRows.push(allRows[i]);
    }
  }
  if (sameGroupRows.length < 2) return null; // 组内不足 2 条，无重排空间

  // §AE 落点边界（F25 AC3/AC4）：指针超出本组首行上缘 / 末行下缘（跨状态组或跨分区）
  // → 越界返回 null，dragPointerUp 走取消回弹分支（无 seq 写入、无重排）。
  // 注：同组内首行前 / 末行后仍为合法落点——指针仍在本组条带范围内（组内重排），
  // 走下方 insertBefore 首行 / insertAfter 末行分支。
  var firstRect = sameGroupRows[0].getBoundingClientRect();
  var lastRect = sameGroupRows[sameGroupRows.length - 1].getBoundingClientRect();
  if (pointerY < firstRect.top || pointerY > lastRect.bottom) return null;

  // 找到指针 Y 所在的目标行（同组内）
  var targetRow = null;
  var insertAfter = false;
  for (var j = 0; j < sameGroupRows.length; j++) {
    var rowRect = sameGroupRows[j].getBoundingClientRect();
    if (pointerY < rowRect.top + rowRect.height / 2) {
      targetRow = sameGroupRows[j];
      insertAfter = false;
      break;
    }
  }
  // 指针在所有行中点之下 → 落最后一行之后
  if (!targetRow) {
    targetRow = sameGroupRows[sameGroupRows.length - 1];
    insertAfter = true;
  }
  // 拖拽行自身 → 无效（原位松手）
  if (targetRow.dataset.id === dragId) return null;

  return { targetId: targetRow.dataset.id, insertAfter: insertAfter, row: targetRow };
}

function reorderNote(dragId, targetId, insertAfter) {
  var dragNote = notes[findIndexById(dragId)];
  var targetNote = notes[findIndexById(targetId)];
  if (!dragNote || !targetNote) return;
  if (dragNote.priority !== targetNote.priority) return;
  if (dragNote.status !== targetNote.status) return;

  // 同分区 + 同状态组内重排：获取当前视觉顺序，移除被拖行，插入新位置，重编号 1..n
  var grouped = { 0: [], 1: [], 2: [], 3: [] };
  notes.forEach(function (n) { grouped[n.priority].push(n); });
  var sortedGroup = sortForDisplay(grouped[dragNote.priority])
    .filter(function (n) { return n.status === dragNote.status; });

  var dragIdxInGroup = sortedGroup.findIndex(function (n) { return n.id === dragId; });
  if (dragIdxInGroup === -1) return;

  // 移除被拖行
  sortedGroup.splice(dragIdxInGroup, 1);

  // 插入新位置
  var targetIdxInGroup = sortedGroup.findIndex(function (n) { return n.id === targetId; });
  if (targetIdxInGroup === -1) return;
  var insertIdx = insertAfter ? targetIdxInGroup + 1 : targetIdxInGroup;
  sortedGroup.splice(insertIdx, 0, dragNote);

  // 重编号：组内全部笔记 seq = 1..n（全覆盖）
  sortedGroup.forEach(function (n, idx) {
    n.seq = idx + 1;
  });

  persist();
  render();
}

/* ============================================================
   Toast：4s 存活，180ms 滑入/滑出
   ============================================================ */
function showToast() {
  if (toastTimer) clearTimeout(toastTimer);
  toast.classList.add('show');
  toastTimer = setTimeout(function () {
    toast.classList.remove('show');     // 滑出
    toastTimer = null;
    pendingUndo = null;                 // 过期不恢复
  }, 4000);
}
function hideToast(immediate) {
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  if (immediate) pendingUndo = null;
  toast.classList.remove('show');
}
undoBtn.addEventListener('click', undoDelete);

/* ============================================================
   优先级 popover 菜单（120×152）
   ============================================================ */
var popoverEl = null;

function closePopover() {
  if (popoverEl) {
    popoverEl.remove();
    popoverEl = null;
  }
}

function openPopover(anchor, noteId) {
  closePopover();
  popoverEl = document.createElement('div');
  popoverEl.className = 'popover';

  var current = null;
  var idx = findIndexById(noteId);
  if (idx !== -1) current = notes[idx].priority;

  [0, 1, 2, 3].forEach(function (p) {
    var row = document.createElement('div');
    row.className = 'pop-row';
    row.style.setProperty('--row-zone', ZONE_VARS[p]);

    var chip = document.createElement('span');
    chip.className = 'pop-chip';
    chip.style.background = ZONE_VARS[p];

    var label = document.createElement('span');
    label.className = 'pop-label';
    label.textContent = 'P' + p + ' ' + I18N.t('zoneTitle')[p];

    row.appendChild(chip);
    row.appendChild(label);

    if (p === current) {
      var check = document.createElement('span');
      check.className = 'pop-check';
      check.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      row.appendChild(check);
    }

    row.addEventListener('click', function () {
      setPriority(noteId, p);
      closePopover();
    });
    popoverEl.appendChild(row);
  });

  document.body.appendChild(popoverEl);

  // 定位：锚点下方，360px 小窗内夹紧
  var rect = anchor.getBoundingClientRect();
  var w = 152, h = 152;
  var left = rect.left + rect.width / 2 - w / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - w - 4));
  var top = rect.bottom + 4;
  if (top + h > window.innerHeight - 4) top = Math.max(4, rect.top - h - 4);
  popoverEl.style.left = left + 'px';
  popoverEl.style.top = top + 'px';
}

// 点击外部关闭
document.addEventListener('mousedown', function (e) {
  if (popoverEl && !popoverEl.contains(e.target)) closePopover();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && popoverEl) closePopover();
});

/* ============================================================
   笔记条操作：事件委托（优先级 / 编辑 / 删除）
   ============================================================ */
sectionsScroll.addEventListener('click', function (e) {
  if (Date.now() < calGuardUntil) return;   // F15 点外关闭的该次点击仅用于关闭，不触发看板操作（§T）
  var btn = e.target.closest('.nact');
  if (!btn) return;
  var row = btn.closest('.note');
  if (!row) return;
  var id = row.dataset.id;
  var act = btn.dataset.act;

  if (act === 'delete') {
    deleteNote(id);
  } else if (act === 'priority') {
    openPopover(btn, id);
  } else if (act === 'edit') {
    startEdit(row, id);
  } else if (act === 'done') {
    setStatus(id, 'done');
  } else if (act === 'drop') {
    setStatus(id, 'dropped');
  } else if (act === 'undo') {
    setStatus(id, 'open');
  }
});

/* ---------- 原地编辑：笔记条变为高 36px 输入框 ---------- */
function startEdit(row, id) {
  var idx = findIndexById(id);
  if (idx === -1) return;
  var old = notes[idx].text;

  var input = document.createElement('input');
  input.className = 'edit-input';
  input.type = 'text';
  input.value = old;
  input.spellcheck = false;

  var wrap = document.createElement('div');
  wrap.className = 'grad-wrap';   // 渐变描边 wrapper（design §K）
  wrap.appendChild(input);

  row.textContent = '';
  row.style.borderLeftColor = 'transparent';
  row.appendChild(wrap);
  input.focus();
  input.select();

  var done = false;
  function finish(save) {
    if (done) return;
    done = true;
    if (save) {
      var t = input.value.trim();
      if (t) updateText(id, t);
      else render();                       // 清空视为取消
    } else {
      render();                            // Esc 取消，恢复原文
    }
  }
  input.addEventListener('keydown', function (e) {
    if (isImeComposing(e)) return;   // 输入法选字回车不保存（不拦截，交给 IME）
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  /* 失焦即保存：双击/点 ✎ 进入编辑后，点别处不用回车也保存（Esc 仍取消）。
     finish 内 done 标记幂等，render 移除节点后的补偿 blur 不会二次触发 */
  input.addEventListener('blur', function () { finish(true); });
}

/* ============================================================
   双击分区空白处 → 就地输入（自动带该分区优先级）
   v1.8（F23/F24）：双击热区含分区底部常驻空白区（.zone-foot）；
   输入条嵌入分栏最底部（F23 空白区槽位，§AC），写入后按 F22 落 open 组末尾。
   ============================================================ */
sectionsScroll.addEventListener('dblclick', function (e) {
  if (Date.now() < calGuardUntil) return;          // F15 点外关闭的该次点击仅用于关闭（§T）
  // 热区严格互斥（F16）：标题行双击只切精简/完整显示模式，不触发 F3 就地输入
  if (e.target.closest('.zone-head')) { toggleTitleMode(); return; }
  // F25（v1.9）：长按拖拽刚结束的窗口内不响应双击（手势互斥，AC8）
  if (Date.now() < dragGuardUntil) return;
  // F26（v1.9）：双击笔记条本体 → 就地编辑；.nact 操作按钮双击不触发（仅单击语义）
  if (e.target.closest('.nact')) return;
  var noteRow = e.target.closest('.note');
  if (noteRow) { startEdit(noteRow, noteRow.dataset.id); return; }
  if (e.target.closest('.inline-wrap')) return;

  var zone = e.target.closest('.zone');
  if (!zone) return;

  var p = parseInt(zone.dataset.p, 10);
  if (isNaN(p)) return;

  openInlineInput(zone, p);
});

function openInlineInput(zone, p) {
  removeInlineInput();
  var head = zone.querySelector('.zone-head');
  var foot = zone.querySelector('.zone-foot');   // F23 底部常驻空白区 = 输入条预留槽（F24 §AC）

  var wrap = document.createElement('div');
  wrap.className = 'inline-wrap';
  wrap.id = 'inlineWrap';

  var input = document.createElement('input');
  input.className = 'inline-input';
  input.type = 'text';
  input.placeholder = 'Type a note — Enter to save';
  input.spellcheck = false;

  var gwrap = document.createElement('div');
  gwrap.className = 'grad-wrap';  // 渐变描边 wrapper（design §K）
  gwrap.appendChild(input);

  wrap.appendChild(gwrap);
  // F24（§AC）：输入条出现在分栏最底部——非空分区为最后一条笔记之下，
  // 空分区为空态文案之下（foot 槽位于两者之后）；无 foot 结构的环境
  // （自测 mock）退回旧位置兜底，行为语义不变
  if (foot) {
    foot.appendChild(wrap);
  } else if (head) {
    head.insertAdjacentElement('afterend', wrap);
  } else {
    zone.appendChild(wrap);
  }
  input.focus();
  ensureInlineVisible(wrap);      // 超高分区自动滚动到输入条可见（F24 AC4）

  var done = false;
  function finish(save) {
    if (done) return;
    done = true;
    if (save) {
      var t = input.value.trim();
      removeInlineInput();          // Enter 写入：输入条直接移除，无退场过渡（§AC）
      if (t) addNote(t, p);         // 写入后按 F22 排序落该分区 open 组末尾（F24 AC3）
    } else {
      dismissInlineInputAnimated(); // Esc / 失焦取消：120ms ease-in 退场（§AC）
    }
  }
  input.addEventListener('keydown', function (e) {
    if (isImeComposing(e)) return;   // 输入法选字回车不保存（不拦截，交给 IME）
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', function () { finish(false); });
}

/* F24 §AC 取消退场：opacity 1→0 + translateY(0→4px) 120ms ease-in，结束后移除；
   重复双击时 openInlineInput 会先经 removeInlineInput 同步移除旧条，
   此处的延迟移除对已摘除节点幂等（同一时刻最多一个输入条不变）。 */
function dismissInlineInputAnimated() {
  var w = document.getElementById('inlineWrap');
  if (!w) return;
  if (CAL_REDUCED) { w.remove(); return; }   // prefers-reduced-motion：0ms 瞬时（§AC）
  w.classList.add('inline-out');
  setTimeout(function () { w.remove(); }, 120);
}

/* F24 AC4：分区内容超出可视高度时，输入条打开后滚动至可见（滚动策略归前端，
   验收只看结果可见+聚焦；nearest 已可见则零滚动，无跳变）。非 DOM 宿主忽略。 */
function ensureInlineVisible(wrap) {
  try {
    if (typeof wrap.scrollIntoView === 'function') {
      wrap.scrollIntoView({ block: 'nearest' });
    }
  } catch (e) { /* 自测 mock 等环境忽略 */ }
}

function removeInlineInput() {
  var w = document.getElementById('inlineWrap');
  if (w) w.remove();
}

/* ============================================================
   顶栏快速输入：回车添加，默认 P3
   ============================================================ */
quickInput.addEventListener('keydown', function (e) {
  if (isImeComposing(e)) return;   // 输入法选字回车不保存（不拦截，交给 IME）
  if (e.key !== 'Enter') return;
  e.preventDefault();
  var t = quickInput.value.trim();
  if (!t) return;
  addNote(t, 3);
  quickInput.value = '';
  quickInput.focus();
});

/* ============================================================
   收起 / 展开（整窗切换迷你胶囊；窗口尺寸由主进程接管）
   ============================================================ */
function setCollapsed(collapsed) {
  app.classList.toggle('collapsed', collapsed);
  closePopover();
  removeInlineInput();
  if (collapsed) closeCalendar();   // 收起时销毁日历下拉卡片（收起态无日历入口，F15）
  if (collapsed) hideToast();
  refreshPasteReady();              // F17：收起/展开切换后重估悬停粘贴提示挂载（§W）
  // 主进程兼容钩子：注入 window.markitHost.setCollapsed(bool) 即可联动改窗口尺寸
  try {
    if (window.markitHost && typeof window.markitHost.setCollapsed === 'function') {
      window.markitHost.setCollapsed(collapsed);
    }
  } catch (e) { /* 忽略 */ }
}

collapseBtn.addEventListener('click', function () { setCollapsed(true); });
expandBtn.addEventListener('click', function () { setCollapsed(false); });

/* ============================================================
   F18 顶栏关闭按钮（v1.7，design §X）：点击 = 退出应用（非隐藏窗口）
   ============================================================
   数据安全（PRD F18 产品决定）：每次笔记变更已 persist() 双通道落盘
   （localStorage + markitHost.persist → userData/markit-notes.json），
   主进程 before-quit 再兜底重写 notesCache——关闭按钮本身不新增存储逻辑。
   退出链路（决策点 32，沿用现状改动最小）：renderer window.close()
   → BrowserWindow 销毁（closed 时同步窗口位置，F9 不回退）
   → window-all-closed → app.quit()。不弹确认框；胶囊态无关闭按钮。 */
var closeBtn = document.getElementById('closeBtn');
if (closeBtn) {
  closeBtn.addEventListener('click', function () {
    try { window.close(); } catch (e) { /* 非 Electron 宿主（自测 mock 等）忽略 */ }
  });
}

/* ---------- 固定（可选置顶）：默认不置顶，点击切换 ---------- */
var pinBtn = document.getElementById('pinBtn');
var pinned = false;
try { pinned = localStorage.getItem('markit_pinned') === '1'; } catch (e) { /* 忽略 */ }
function applyPinned(v) {
  pinned = !!v;
  pinBtn.classList.toggle('active', pinned);
  pinBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  // 文字说明由纯 CSS hover tooltip 呈现（.tip-off/.tip-on 随 .active 互斥切换），无常驻文字
  try { localStorage.setItem('markit_pinned', pinned ? '1' : '0'); } catch (e) { /* 忽略 */ }
  if (window.markitHost && typeof window.markitHost.setPinned === 'function') {
    window.markitHost.setPinned(pinned);
  }
}
pinBtn.addEventListener('click', function () { applyPinned(!pinned); });
applyPinned(pinned); // 启动时恢复上次固定状态

/* ============================================================
   F15 日历回顾（v1.5）：顶栏入口 + 锚定下拉卡片（月历 / 记录点 / 日期详情）
   ============================================================ */
var calBtn = document.getElementById('calBtn');
var CAL_REDUCED = false;
try { CAL_REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* 忽略 */ }

var calState = {
  open: false,
  y: 0, m: 0,          // 当前显示年月
  selKey: null,        // 选中日 'YYYY-MM-DD'（本地时区）
  el: null,            // 卡片根节点（关闭即销毁无保留态，§Q）
  gridEl: null, titleEl: null, detailEl: null
};
var calGuardUntil = 0; // F15 点外关闭后的短窗抑制：该次点击仅用于关闭（§T）

/* F15 点外关闭（§T 四路关闭之①）：document 级 pointerdown 捕获阶段判定。
   - 命中卡片内部：不关闭（选日期/翻月/✕ 照常）
   - 命中日历图标：交给 click toggle 处理（关闭方式③ 再点图标），不在此抢关
   - 其余任意区域（含看板/底部输入栏）：关闭卡片，且标记该次点击已消费——
     看板侧 click/dblclick 一律抑制，不触发 F3 就地输入等误操作 */
document.addEventListener('pointerdown', function (e) {
  if (!calState.open || !calState.el) return;
  if (calState.el.contains(e.target)) return;
  if (calBtn.contains(e.target)) return;
  closeCalendar();
  calGuardUntil = Date.now() + 600;   // 覆盖一次双击手势窗口（系统双击阈值 ≤500ms）
}, true);

/* ---------- 纯逻辑：日期键 / 事件归集 ---------- */
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function keyOfDate(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }
function keyOfTs(ts) {
  var d = new Date(ts);
  return keyOfDate(d.getFullYear(), d.getMonth(), d.getDate());
}

// 「有记录」事件（PRD F15，解耦口径）：新建(createdAt) 与 最近一次完成/放弃(statusAt) 各自独立计入。
// 同日多事件仍只落一个点（PRD 硬约束）；创建日永远有点，状态日另计——隔天完成时两天各有一点。
// 取消不计记录：↺ 恢复 open 时 statusAt 已清零，状态日自然消失；新建日不受影响。
// 存量兼容：无 statusAt（=0）的终态旧数据按无状态事件处理，只计 createdAt 新建日。
function noteHasStatusEvent(n) {
  return n.statusAt > 0 && (n.status === 'done' || n.status === 'dropped');
}

function recordedDayKeys() {
  var set = {};
  notes.forEach(function (n) {
    var hasStatus = noteHasStatusEvent(n);
    // 解耦：新建日始终计入（哪怕后来完成/放弃）；状态日独立另计。两点同日自然合一。
    if (n.createdAt > 0) set[keyOfTs(n.createdAt)] = true;
    if (hasStatus) set[keyOfTs(n.statusAt)] = true;
  });
  return set;
}

// 某日详情事件归集：新建/完成/放弃三组，组内按事件时间升序（§O）
// 解耦口径：笔记在某日「新建」与该日「完成/放弃」可同时计入各组——当天记当天完成 → 同日出现在新建组与完成组
function eventsForDay(key) {
  var evts = { created: [], done: [], dropped: [] };
  notes.forEach(function (n) {
    var hasStatus = noteHasStatusEvent(n);
    if (n.createdAt > 0 && keyOfTs(n.createdAt) === key) evts.created.push(n);
    if (hasStatus && keyOfTs(n.statusAt) === key) {
      (n.status === 'done' ? evts.done : evts.dropped).push(n);
    }
  });
  evts.created.sort(function (a, b) { return a.createdAt - b.createdAt; });
  evts.done.sort(function (a, b) { return a.statusAt - b.statusAt; });
  evts.dropped.sort(function (a, b) { return a.statusAt - b.statusAt; });
  return evts;
}

/* ---------- 覆盖层构建 / 销毁 ---------- */
var CAL_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function calNavBtn(dir) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'cal-nav';
  b.dataset.dir = dir > 0 ? 'next' : 'prev';
  b.setAttribute('aria-label', dir > 0 ? I18N.t('ariaNext') : I18N.t('ariaPrev'));
  b.innerHTML = dir > 0
    ? '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return b;
}

function openCalendar() {
  if (calState.open) return;
  var now = new Date();
  calState.open = true;
  calState.y = now.getFullYear();      // 默认定位当月（§N）
  calState.m = now.getMonth();
  calState.selKey = null;

  var card = document.createElement('div');   // 卡片本体即根节点：锚定顶栏、无全屏遮罩（§Q）
  card.className = 'cal-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', I18N.t('ariaCal'));

  var head = document.createElement('div');
  head.className = 'cal-head';
  head.appendChild(calNavBtn(-1));
  var title = document.createElement('div');
  title.className = 'cal-title';
  head.appendChild(title);
  head.appendChild(calNavBtn(1));

  var closeBtn = document.createElement('button');   // 关闭方式④：卡片内 ✕（§T，head 行内 absolute right:8px）
  closeBtn.type = 'button';
  closeBtn.className = 'icon-btn cal-close';
  closeBtn.setAttribute('aria-label', I18N.t('ariaCloseCal'));
  closeBtn.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13"><path d="M4.5 4.5 11.5 11.5 M11.5 4.5 4.5 11.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  head.appendChild(closeBtn);          // z-index:5 压过 .cal-head 同层内容（§T，P1 修复手法沿用）

  var week = document.createElement('div');          // 星期表头 一~日（§N）
  week.className = 'cal-week';
  CAL_WEEK.forEach(function (w) {
    var s = document.createElement('span');
    s.textContent = w;
    week.appendChild(s);
  });

  var grid = document.createElement('div');
  grid.className = 'cal-grid';

  var detail = document.createElement('div');       // 详情区独立滚动（§S）
  detail.className = 'cal-detail';

  card.appendChild(head);
  card.appendChild(week);
  card.appendChild(grid);
  card.appendChild(detail);
  app.appendChild(card);   // 锚定顶栏右下（z-index 20，顶栏 z30 恒在其上，§Q）

  calState.el = card;
  calState.gridEl = grid;
  calState.titleEl = title;
  calState.detailEl = detail;

  calBtn.classList.add('active');                    // 激活态（§L）
  calBtn.setAttribute('aria-expanded', 'true');
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();                   // 避免后台输入框截获 Esc/粘贴
  }

  renderCalMonth('init');
  renderCalDetail();                                 // 默认提示（§P）
}

function closeCalendar() {
  if (!calState.open) return;
  var card = calState.el;
  calState.open = false;
  calState.el = null; calState.gridEl = null; calState.titleEl = null; calState.detailEl = null;
  calBtn.classList.remove('active');
  calBtn.setAttribute('aria-expanded', 'false');
  if (!card) return;
  if (CAL_REDUCED) { card.remove(); return; }        // 减弱动效：瞬时销毁
  card.classList.add('closing');                     // 退场 120ms ease-in（§Q），结束后销毁
  setTimeout(function () { card.remove(); }, 120);
}

/* ---------- 月历渲染 / 翻月 ---------- */
function shiftMonth(delta) {
  calState.m += delta;
  if (calState.m < 0) { calState.m = 11; calState.y--; }   // 跨年边界：1月←12月
  else if (calState.m > 11) { calState.m = 0; calState.y++; } // 12月→次年1月
  renderCalMonth(delta > 0 ? 'next' : 'prev');
}

function renderCalMonth(dir) {
  var grid = calState.gridEl, title = calState.titleEl;
  if (!grid || !title) return;
  var y = calState.y, m = calState.m;

  title.textContent = I18N.t('calTitle')(y, m);   // 「2026年2月」格式（§N，F29 分语言）
  title.style.transition = 'none';                   // 120ms fade 同步（§N）
  title.style.opacity = '0';
  void title.offsetWidth;
  title.style.transition = '';
  title.style.opacity = '1';

  var recorded = recordedDayKeys();
  var todayKey = keyOfTs(Date.now());
  var lead = (new Date(y, m, 1).getDay() + 6) % 7;   // 周一=0（星期表头 一~日）
  var days = new Date(y, m + 1, 0).getDate();        // 当月天数，行数 5/6 自适应

  grid.textContent = '';
  for (var i = 0; i < lead; i++) {                   // 前置空槽，无跨月补位格（§N）
    var pad = document.createElement('div');
    pad.className = 'cal-pad';
    grid.appendChild(pad);
  }
  var dotIdx = 0;
  for (var d = 1; d <= days; d++) {
    var key = keyOfDate(y, m, d);
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day';
    cell.dataset.key = key;
    var num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = String(d);
    cell.appendChild(num);
    if (key === todayKey) cell.classList.add('today');       // 今天渐变描边环（§N）
    if (key > todayKey) {                                    // 未来日期：置灰不可点（零填充键可字典序比较）
      cell.classList.add('future');
      cell.disabled = true;
    }
    if (recorded[key]) {                                     // 记录点：多事件仍一点（PRD 硬约束）
      var dot = document.createElement('span');
      dot.className = 'cal-dot';
      dot.style.animationDelay = ((dir === 'init' ? 220 : 0) + dotIdx * 30) + 'ms';  // §P 逐个弹出
      dotIdx++;
      cell.appendChild(dot);
    }
    if (key === calState.selKey) cell.classList.add('selected');
    grid.appendChild(cell);
  }

  if (dir !== 'init' && !CAL_REDUCED) {              // 翻月过渡：opacity + translateX 6px（§N/§R）
    grid.style.transition = 'none';
    grid.style.opacity = '0';
    grid.style.transform = 'translateX(' + (dir === 'next' ? 6 : -6) + 'px)';
    void grid.offsetWidth;                           // 强制回流后恢复过渡再落终态
    grid.style.transition = '';
    grid.style.opacity = '1';
    grid.style.transform = 'translateX(0)';
  } else {
    grid.style.opacity = '';
    grid.style.transform = '';
  }
}

/* ---------- 选日期 → 详情（格尺寸已固定，无需压缩） ---------- */
function selectDay(key) {
  if (!calState.open || !key) return;
  calState.selKey = key;
  var grid = calState.gridEl;
  if (grid) {
    grid.querySelectorAll('.cal-day.selected').forEach(function (c) { c.classList.remove('selected'); });
    var cell = grid.querySelector('.cal-day[data-key="' + key + '"]');
    if (cell) cell.classList.add('selected');
  }
  renderCalDetail();       // 换日期仅详情内容 120ms fade（§S）
}

var CAL_GROUP_ICONS = {   // 组头 12px 小图标（§R），path 复用 §I 呼应操作组（§O）
  created: '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 12.9l.8-2.7 7.7-7.7a1.2 1.2 0 0 1 1.7 0l.3.3a1.2 1.2 0 0 1 0 1.7l-7.7 7.7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  done: '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.2 8.6 6.6 11.8 12.8 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dropped: '<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.4 4.4 11.6 11.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};
var CAL_GROUP_COLOR = {  // 图标色：新建粉 / 完成橙 / 放弃灰（§O）
  created: 'var(--pink)',
  done: 'var(--cal-done-ic)',
  dropped: 'var(--text-secondary)'
};

function calGroup(name, items, kind) {
  var g = document.createElement('div');
  g.className = 'cal-group';

  var h = document.createElement('div');
  h.className = 'cal-gh';
  var ic = document.createElement('span');
  ic.className = 'cal-gh-ic';
  ic.style.color = CAL_GROUP_COLOR[kind];
  ic.innerHTML = CAL_GROUP_ICONS[kind];
  var nm = document.createElement('span');
  nm.className = 'cal-gh-name';
  nm.textContent = name;
  var ct = document.createElement('span');
  ct.className = 'cal-gh-count';
  ct.textContent = String(items.length);
  h.appendChild(ic); h.appendChild(nm); h.appendChild(ct);
  g.appendChild(h);

  var list = document.createElement('div');
  list.className = 'cal-items';
  items.forEach(function (n) {
    var item = document.createElement('div');      // 笔记条降级版（§O）
    item.className = 'cal-item' + (kind === 'done' ? ' st-done' : kind === 'dropped' ? ' st-dropped' : '');
    item.style.setProperty('--zone', ZONE_VARS[n.priority]);   // 左色条=当前分区色
    var t = document.createElement('span');
    t.className = 'cal-item-text';
    t.textContent = n.text;                        // textContent 防注入
    item.appendChild(t);
    list.appendChild(item);
  });
  g.appendChild(list);
  return g;
}

function renderCalDetail() {
  var detail = calState.detailEl;
  if (!detail) return;
  detail.textContent = '';

  var inner = document.createElement('div');
  inner.className = 'cal-detail-inner';            // 120ms fade（§O）

  if (!calState.selKey) {
    var hint = document.createElement('div');      // 默认提示（§P）
    hint.className = 'cal-hint';
    hint.textContent = I18N.t('calHint');   // §P 默认提示原文（F29 分语言）
    inner.appendChild(hint);
  } else {
    var evts = eventsForDay(calState.selKey);
    var total = evts.created.length + evts.done.length + evts.dropped.length;
    if (total === 0) {
      var empty = document.createElement('div');   // 空态日期（§O）
      empty.className = 'cal-empty-day';
      empty.textContent = I18N.t('calEmpty');   // §O 空态日期原文（F29 分语言）
      empty.appendChild(buildScribble());          // 马克笔划线 opacity 0.5
      inner.appendChild(empty);
    } else {
      // 三组固定顺序：Mark → 完成 → 放弃；空组整组不渲染（§O）
      if (evts.created.length) inner.appendChild(calGroup(I18N.t('groups').created, evts.created, 'created'));
      if (evts.done.length) inner.appendChild(calGroup(I18N.t('groups').done, evts.done, 'done'));
      if (evts.dropped.length) inner.appendChild(calGroup(I18N.t('groups').dropped, evts.dropped, 'dropped'));
    }
  }
  detail.appendChild(inner);
}

/* ---------- 事件绑定：入口开关 / 卡片内委托 / Esc ---------- */
calBtn.addEventListener('click', function () {     // 关闭方式③：再点顶栏图标
  if (calState.open) closeCalendar();
  else openCalendar();
});

document.addEventListener('click', function (e) {  // 卡片内事件委托：选日期 / 翻月 / 关闭
  if (!calState.open || !calState.el) return;
  if (!calState.el.contains(e.target)) return;
  var day = e.target.closest('.cal-day');
  if (day && !day.disabled) { selectDay(day.dataset.key); return; }
  var nav = e.target.closest('.cal-nav');
  if (nav) { shiftMonth(nav.dataset.dir === 'next' ? 1 : -1); return; }
  if (e.target.closest('.cal-close')) closeCalendar();   // 关闭方式④：卡片内 ✕
});

document.addEventListener('keydown', function (e) {  // 关闭方式②：Esc
  if (e.key === 'Escape' && calState.open) closeCalendar();
});

/* ============================================================
   F30 关于卡片（v1.12）：版本 / 隐私说明 / 匿名统计开关（opt-out）。
   交互复用日历卡模式：锚定下拉、点外关闭、Esc、卡内 ✕；与日历互斥
   （pointerdown 先关闭日历 → click 再开关于，天然不叠层）。
   ============================================================ */
var aboutBtn = document.getElementById('aboutBtn');
var aboutState = { open: false, el: null };

function closeAbout() {
  if (!aboutState.open || !aboutState.el) return;
  var el = aboutState.el;
  aboutState.open = false; aboutState.el = null;
  try { el.remove(); } catch (e) {}   // 自测 shim 无 remove：真实 DOM 恒可用
  aboutBtn.classList.remove('active');
  aboutBtn.setAttribute('aria-expanded', 'false');
}

function openAbout() {
  if (aboutState.open) return;
  var card = document.createElement('div');
  card.className = 'about-card cal-in';
  var head = document.createElement('div'); head.className = 'about-head';
  var name = document.createElement('span'); name.className = 'about-name';
  name.textContent = 'Mark it!';                       // 品牌名三语不译（F29）
  var ver = document.createElement('span'); ver.className = 'about-ver';
  ver.textContent = 'v' + ((typeof window.__MARKIT_VERSION__ === 'string' && window.__MARKIT_VERSION__) || 'dev');
  var x = document.createElement('button'); x.className = 'about-close icon-btn'; x.type = 'button';
  x.textContent = '✕'; x.setAttribute('aria-label', I18N.t('ariaCloseCal'));
  head.appendChild(name); head.appendChild(ver); head.appendChild(x);
  var privacy = document.createElement('p'); privacy.className = 'about-privacy';
  privacy.textContent = I18N.t('aboutPrivacy');
  var row = document.createElement('div'); row.className = 'about-row';
  var lb = document.createElement('label'); lb.className = 'about-toggle-label';
  lb.textContent = I18N.t('aboutToggle');
  var sw = document.createElement('input'); sw.type = 'checkbox'; sw.className = 'about-switch';
  sw.checked = analyticsEnabled();
  sw.addEventListener('change', function () {
    try {
      if (sw.checked) localStorage.removeItem(ANALYTICS_OPT_KEY);
      else localStorage.setItem(ANALYTICS_OPT_KEY, '1');
    } catch (e) { /* 存储异常：开关仅视觉态 */ }
  });
  lb.appendChild(sw);
  row.appendChild(lb);
  card.appendChild(head); card.appendChild(privacy); card.appendChild(row);
  document.getElementById('app').appendChild(card);
  aboutState.open = true; aboutState.el = card;
  aboutBtn.classList.add('active');
  aboutBtn.setAttribute('aria-expanded', 'true');
}

if (aboutBtn) {   // 自测 shim 无此元素：整块跳过
  aboutBtn.addEventListener('click', function () {
    if (aboutState.open) closeAbout(); else openAbout();
  });
  document.addEventListener('pointerdown', function (e) {   // 点外关闭（捕获阶段，同日历）
    if (!aboutState.open || !aboutState.el) return;
    if (aboutState.el.contains(e.target)) return;
    if (aboutBtn.contains(e.target)) return;
    closeAbout();
  }, true);
  document.addEventListener('click', function (e) {         // 卡内委托：✕ 关闭
    if (!aboutState.open || !aboutState.el) return;
    if (!aboutState.el.contains(e.target)) return;
    if (e.target.closest('.about-close')) closeAbout();
  });
  document.addEventListener('keydown', function (e) {       // Esc
    if (e.key === 'Escape' && aboutState.open) closeAbout();
  });
}

/* ============================================================
   F16 分区标题显示模式（design §V）：默认精简（徽标+角标），hover 标题行
   浮现分区名，双击标题行全局切换精简/完整（双分区联动）；
   偏好存独立 key markit_title_mode（与 markit_notes 分离，仅显示偏好）
   ============================================================ */
var TITLE_MODE_KEY = 'markit_title_mode';
var titleMode = 'compact';        // 'compact' 精简（默认）| 'full' 完整
var titleExitTimer = null;

(function initTitleMode() {        // 启动恢复偏好（无动画，不写回）
  var stored = null;
  try { stored = localStorage.getItem(TITLE_MODE_KEY); } catch (e) { /* 忽略 */ }
  titleMode = stored === 'full' ? 'full' : 'compact';
  app.classList.toggle('titles-compact', titleMode === 'compact');
})();

function toggleTitleMode() {
  applyTitleMode(titleMode === 'compact' ? 'full' : 'compact');
}

function applyTitleMode(mode) {
  if (titleExitTimer) {           // 快速连击：取消未完成的退场定时，避免把新模式又盖回去
    clearTimeout(titleExitTimer);
    titleExitTimer = null;
  }
  var titles = document.querySelectorAll('.zone-title');
  for (var i = 0; i < titles.length; i++) {   // 清理上次切换残留的内联退场样式
    titles[i].style.transition = '';
    titles[i].style.opacity = '';
  }
  titleMode = mode;
  try { localStorage.setItem(TITLE_MODE_KEY, mode); } catch (e) { /* 忽略 */ }
  if (mode === 'full') {
    // 精简→完整：display 恢复即触发 CSS keyframes 入场
    //（fade + translateX(-4px→0)，150ms ease-out，无 delay，§V）
    app.classList.remove('titles-compact');
  } else {
    if (CAL_REDUCED) { app.classList.add('titles-compact'); return; }  // 减弱动效：瞬时切换
    // 完整→精简：分区名先 120ms ease-in fade 出场，结束后移出文档流（徽标与角标相邻）
    for (var j = 0; j < titles.length; j++) {
      titles[j].style.transition = 'opacity 120ms ease-in';
      titles[j].style.opacity = '0';
    }
    titleExitTimer = setTimeout(function () {
      titleExitTimer = null;
      app.classList.add('titles-compact');
      for (var k = 0; k < titles.length; k++) {
        titles[k].style.transition = '';
        titles[k].style.opacity = '';
      }
    }, 120);
  }
}

/* ============================================================
   F17 悬停粘贴（design §W）：hover 分区 + 窗口前台 + 焦点不在任何
   input/textarea/contentEditable → 分区挂 .paste-ready（虚线高亮+微提示）；
   ⌘V（Mac）非空纯文本 → 该分区新建（完整保存，展示层既有单行 ellipsis）
   ============================================================ */
var pasteHoverZone = null;
var pasteArmed = false;      // keydown ⌘V 已判定本次粘贴归 F17
var pasteHandled = false;    // 剪贴板文本已消费（paste 事件与兜底通道防双建）
var pasteClipHasText = null; // 剪贴板预判：null=未知（无权限环境降级显示提示）；true/false=有/无有效文本（QA 第七轮 P2 修复）

function focusInEditable() {  // 焦点是否在任意输入控件（快速输入/就地输入/原地编辑）
  var ae = document.activeElement;
  if (!ae) return false;
  var tag = ae.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || ae.isContentEditable === true;
}

function pasteConditionsOk() {
  return !!pasteHoverZone && pasteHoverZone.isConnected &&
         !app.classList.contains('collapsed') &&  // 收起态不响应（PRD F17）
         document.hasFocus() &&                   // 窗口前台（PRD F17）
         !document.body.classList.contains('dragging') &&  // F29：拖拽期间不显示粘贴提示（与跨分区高亮互斥）
         !focusInEditable();                      // 输入控件优先，系统粘贴照常（PRD F17）
}

function refreshPasteReady() {  // 挂载/卸载 .paste-ready：进出各走 CSS 过渡，零布局位移
var zones = document.querySelectorAll('.zone');
for (var i = 0; i < zones.length; i++) {
zones[i].classList.toggle('paste-ready', zones[i] === pasteHoverZone && pasteConditionsOk() && pasteClipHasText !== false);
}
}

function probePasteClip() {  // 悬停分区时预判剪贴板是否有有效文本；无权限/非文本环境静默降级（design §W 三条件）
if (!(navigator.clipboard && typeof navigator.clipboard.readText === 'function')) return;
navigator.clipboard.readText().then(function (t) {
var has = !!(t && t.replace(/\s/g, ''));
if (pasteClipHasText !== has) { pasteClipHasText = has; refreshPasteReady(); }
}).catch(function () { /* 无权限：维持 null，照常显示提示（降级） */ });
}

/* 分区悬停追踪：sectionsScroll 内 mouseover 委托。顶栏/底部输入栏/日历卡片
   不属于任何分区热区（PRD F17 条件 3）——取不到 .zone 自然不挂载 */
sectionsScroll.addEventListener('mouseover', function (e) {
  var zone = e.target && e.target.closest ? e.target.closest('.zone') : null;
if (zone === pasteHoverZone) return;
pasteHoverZone = zone;
if (zone) probePasteClip();   // 换区悬停时重估剪贴板预判（QA P2 修复）
refreshPasteReady();
});

/* 本页发生复制/剪切后剪贴板必有文本 → 立即翻转预判并刷新提示（不等下次悬停） */
['copy', 'cut'].forEach(function (type) {
document.addEventListener(type, function () {
if (pasteClipHasText !== true) { pasteClipHasText = true; refreshPasteReady(); }
});
});

document.addEventListener('focusin', refreshPasteReady);   // 焦点进入输入控件：提示永不挂载（§W）
document.addEventListener('focusout', refreshPasteReady);  // 离开输入控件：悬停未变则重挂
if (typeof window.addEventListener === 'function') {      // 宿主缺 window 事件面时静默降级
  window.addEventListener('blur', refreshPasteReady);     // 切后台即时撤提示（窗口前台条件）
  window.addEventListener('focus', refreshPasteReady);   // 回前台重估
}

/* ⌘V/Ctrl+V 拦截：条件齐备时武装 F17 通道，不 preventDefault——借系统
   paste 事件同步取剪贴板文本（免 clipboard-read 权限，QA file:// 环境可用）；
   120ms 内未送达（个别环境无焦可编辑目标不派发 paste）则退回
   navigator.clipboard.readText 兜底（无权限/非文本 → catch 静默不创建） */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'v' && e.key !== 'V') return;
  /* Mac 仅 ⌘V（Ctrl+V / ⌥⌘V 不劫持）；Windows 仅 Ctrl+V（Win+V 等不劫持） */
  var modOk = IS_WIN ? (e.ctrlKey && !e.metaKey && !e.altKey)
                     : (e.metaKey && !e.ctrlKey && !e.altKey);
  if (!modOk) return;
  if (!pasteConditionsOk()) { pasteArmed = false; return; }
  pasteArmed = true;
  pasteHandled = false;
  setTimeout(function () {
    if (!pasteArmed || pasteHandled) return;
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      navigator.clipboard.readText().then(function (text) {
        if (!pasteArmed || pasteHandled) return;
        pasteHandled = true;
        createPastedNote(text);
      }).catch(function () { /* 无权限/非文本：静默，不创建不报错（PRD F17） */ });
    }
  }, 120);
});

document.addEventListener('paste', function (e) {
  if (!pasteArmed || pasteHandled) return;
  if (!pasteConditionsOk()) { pasteArmed = false; return; }   // 武装后条件已失效 → 放行系统粘贴
  pasteHandled = true;
  e.preventDefault();                    // 本次 ⌘V 归 F17：拦截无焦可编辑目标的默认粘贴
  var text = '';
  try { text = e.clipboardData.getData('text/plain') || ''; } catch (err) { /* 非文本 → 空 */ }
  createPastedNote(text);
});

function createPastedNote(text) {
  pasteArmed = false;
  if (!text || !text.replace(/\s/g, '')) return;   // 空剪贴板/纯空白/非文本：不创建不报错（PRD F17）
  var p = parseInt(pasteHoverZone && pasteHoverZone.dataset.p, 10);
  if (isNaN(p)) return;
  addNote(text, p);   // 完整保存全文（超长不截断，§W 决策点 29）；createdAt 计入 →
                      // 日历「新建」事件自然生效；入场走 F2/F3/F17 统一动画 + paste-flash
}

/* ============================================================
   启动
   ============================================================ */
render();
