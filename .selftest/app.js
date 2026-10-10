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
      return {
        id: String(n.id || uid()),
        text: n.text,
        priority: n.priority,
        createdAt: n.createdAt || 0,
        // F12 状态字段：旧数据无 status 一律视为 open（localStorage 兼容）
        status: (n.status === 'done' || n.status === 'dropped') ? n.status : 'open'
      };
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
var quickInput = document.getElementById('quickInput');
var collapseBtn = document.getElementById('collapseBtn');
var expandBtn = document.getElementById('expandBtn'); // 胶囊内的展开按钮（no-drag，真机可点击）
var sectionsScroll = document.getElementById('sectionsScroll');
var capsuleCount = document.getElementById('capsuleCount');
var toast = document.getElementById('toast');
var undoBtn = document.getElementById('undoBtn');

var EMPTY_TEXT = {
  0: '双击此处，先记下最要紧的事',
  1: '双击此处，安排重要的事',
  2: '双击此处，记下急事先处理',
  3: '双击此处，随手记点什么'
};
var ZONE_NAMES = {
  0: 'P0 重要且紧急',
  1: 'P1 重要且不紧急',
  2: 'P2 不重要但紧急',
  3: 'P3 不重要且不紧急'
};
var ZONE_VARS = {
  0: 'var(--p0)', 1: 'var(--p1)', 2: 'var(--p2)', 3: 'var(--p3)'
};

/* ============================================================
   渲染：按优先级分组，重建四个分区列表 + 角标 + 空态
   ============================================================ */
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
      empty.textContent = EMPTY_TEXT[p];
      empty.appendChild(buildScribble());     // 马克笔划线（design §J）
      list.appendChild(empty);
    } else {
      grouped[p].forEach(function (n) {
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

  actions.appendChild(actionBtn('priority', '切换优先级',
    '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M5 3v10M5 13l-2.2-2.2M5 13l2.2-2.2M11 13V3M11 3L8.8 5.2M11 3l2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'));
  actions.appendChild(actionBtn('edit', '编辑',
    '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 13h2.2l7.1-7.1-2.2-2.2L3 10.8V13z" fill="currentColor"/><path d="M10.6 2.5l2.9 2.9.9-.9c.4-.4.4-1.05 0-1.45L13 2.1c-.4-.4-1.05-.4-1.45 0l-.95.95z" fill="currentColor"/></svg>'));
  if (n.status === 'open') {
    actions.appendChild(actionBtn('done', '标记完成',
      '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3.2 8.6 6.6 11.8 12.8 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'st'));
    actions.appendChild(actionBtn('drop', '不干了',
      '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.4 4.4 11.6 11.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>', 'st'));
  } else {
    actions.appendChild(actionBtn('undo', '取消状态',
      '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M2.8 6.2 A5.4 5.4 0 1 1 2.7 9.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2.8 2.6 v3.6 h3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'st'));
  }
  actions.appendChild(actionBtn('delete', '删除',
    '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'));

  row.appendChild(actions);
  return row;
}

function actionBtn(act, title, svg, cls) {
  var b = document.createElement('button');
  b.className = cls ? 'nact ' + cls : 'nact';
  b.type = 'button';
  b.title = title;
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
  var note = { id: uid(), text: text, priority: priority, createdAt: Date.now(), status: 'open' };
  insertAtEndOfGroup(note, priority);
  persist();
  render();
  return note;
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
  persist();
  render();
}

function updateText(id, text) {
  var idx = findIndexById(id);
  if (idx === -1) return;
  notes[idx].text = text;
  persist();
  render();
}

/* F12：设置笔记状态（open / done / dropped），笔记保留原分区原位；
   「取消」即传 'open' 恢复普通态，不是独立状态 */
function setStatus(id, status) {
  var idx = findIndexById(id);
  if (idx === -1) return;
  if (notes[idx].status === status) return;
  notes[idx].status = status;
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
    label.textContent = ZONE_NAMES[p];

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
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', function () { finish(false); });
}

/* ============================================================
   双击分区空白处 → 就地输入（自动带该分区优先级）
   ============================================================ */
sectionsScroll.addEventListener('dblclick', function (e) {
  // 双击笔记条 / 已有就地输入框 / 操作区时忽略
  if (e.target.closest('.note')) return;
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

  var wrap = document.createElement('div');
  wrap.className = 'inline-wrap';
  wrap.id = 'inlineWrap';

  var input = document.createElement('input');
  input.className = 'inline-input';
  input.type = 'text';
  input.placeholder = '记一条，回车保存';
  input.spellcheck = false;

  var gwrap = document.createElement('div');
  gwrap.className = 'grad-wrap';  // 渐变描边 wrapper（design §K）
  gwrap.appendChild(input);

  wrap.appendChild(gwrap);
  head.insertAdjacentElement('afterend', wrap);
  input.focus();

  var done = false;
  function finish(save) {
    if (done) return;
    done = true;
    if (save) {
      var t = input.value.trim();
      removeInlineInput();
      if (t) addNote(t, p);                // Enter 入该分区末尾
    } else {
      removeInlineInput();                 // Esc / 失焦取消
    }
  }
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', function () { finish(false); });
}

function removeInlineInput() {
  var w = document.getElementById('inlineWrap');
  if (w) w.remove();
}

/* ============================================================
   顶栏快速输入：回车添加，默认 P3
   ============================================================ */
quickInput.addEventListener('keydown', function (e) {
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
  if (collapsed) hideToast();
  // 主进程兼容钩子：注入 window.markitHost.setCollapsed(bool) 即可联动改窗口尺寸
  try {
    if (window.markitHost && typeof window.markitHost.setCollapsed === 'function') {
      window.markitHost.setCollapsed(collapsed);
    }
  } catch (e) { /* 忽略 */ }
}

collapseBtn.addEventListener('click', function () { setCollapsed(true); });
expandBtn.addEventListener('click', function () { setCollapsed(false); });

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
   启动
   ============================================================ */
render();
