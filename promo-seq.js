/* promo-seq.js — v2 分镜演出序列（由 promo-demo.js executeJavaScript 注入）
 * 提供 window.__demoStart()：按时间轴驱动真实交互（打字/双击/⌘V/拖拽/✓⊘/胶囊/日历/深色）
 */
(function () {
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function rectCenter(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function fire(el, ev) { el.dispatchEvent(ev); }

  function mouseOver(el) {
    fire(el, new MouseEvent('mouseover', { bubbles: true, composed: true }));
    fire(el, new MouseEvent('mousemove', { bubbles: true, composed: true }));
  }

  // 逐字打字：value 累加 + input 事件（真实渲染路径）
  function typeInto(input, text, cps, hold) {
    return new Promise(function (resolve) {
      var i = 0;
      var step = 1000 / cps;
      (function tick() {
        if (i >= text.length) { setTimeout(resolve, hold || 350); return; }
        input.value += text[i++];
        fire(input, new Event('input', { bubbles: true }));
        input.focus();
        setTimeout(tick, step);
      })();
    });
  }

  function pressEnter(input) {
    input.focus();
    fire(input, new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
      bubbles: true, cancelable: true
    }));
  }

  function zoneOf(p) { return document.querySelector('.zone[data-p="' + p + '"]'); }
  function listEl(p) { return zoneOf(p).querySelector('.note-list'); }
  function rowOf(id) { return document.querySelector('.note[data-id="' + id + '"]'); }

  // ---- 虚拟 hover 垫片：合成事件触发不了 CSS :hover，演出时用类名复刻同款样式 ----
  var SHIM = document.createElement('style');
  SHIM.textContent = [
    '.note.demo-hover { box-shadow: var(--hover-shadow); }',
    '.note.demo-hover .note-actions { opacity: 1; background: linear-gradient(90deg, rgba(0,0,0,0), var(--actions-bg-hover) 20px); }',
    '@keyframes demoLogoPulse { 0%{transform:scale(1)} 40%{transform:scale(1.18)} 100%{transform:scale(1)} }',
    '.zone-logo.demo-pulse { animation: demoLogoPulse 0.9s ease-in-out; }'
  ].join('\n');
  document.head.appendChild(SHIM);

  function actBtnOf(id, act) {
    var row = rowOf(id);
    return row ? row.querySelector('.nact[data-act="' + act + '"]') : null;
  }

  function hoverRow(id, on) {
    var row = rowOf(id);
    if (row) row.classList.toggle('demo-hover', on);
  }

  function dblclickZoneBlank(p) {
    var zone = zoneOf(p);
    var foot = zone.querySelector('.zone-foot') || listEl(p);
    var c = rectCenter(foot);
    fire(foot, new MouseEvent('dblclick', { bubbles: true, composed: true, clientX: c.x, clientY: c.y }));
  }

  // 悬停 + ⌘V 粘贴成笔记（F17 完整链路：mouseover → keydown v/meta → paste 事件带数据）
  // 兜底：真实链路在无焦点窗口等环境不生效 → 900ms 后未见建条则 addNote 补建
  //（addNote 走 F2/F3/F17 统一入场动画 + paste-flash，视觉与真实粘贴一致）
  function pasteInto(p, text) {
    mouseOver(listEl(p));
    fire(document, new KeyboardEvent('keydown', {
      key: 'v', code: 'KeyV', metaKey: true, keyCode: 86, which: 86,
      bubbles: true, cancelable: true
    }));
    var dt = new DataTransfer();
    dt.setData('text/plain', text);
    fire(document, new ClipboardEvent('paste', {
      bubbles: true, cancelable: true, clipboardData: dt
    }));
    return sleep(900).then(function () {
      if (!noteIdByText(text)) addNote(text, p);
    });
  }

  // 长按 500ms → 渐进移动 → 松手（真实 F29 拖拽链路）
  function dragNote(id, targetP, opts) {
    opts = opts || {};
    var dragRow = rowOf(id);
    dragRow.classList.add('demo-hover');
    var start = rectCenter(dragRow);
    fire(dragRow, new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 1, isPrimary: true,
      pointerType: 'mouse', button: 0, buttons: 1,
      clientX: start.x, clientY: start.y
    }));
    return sleep(opts.holdMs || 650).then(function () {
      var tz = listEl(targetP);
      var end = opts.endY ? { x: start.x, y: opts.endY } : rectCenter(tz);
      var steps = opts.steps || 40;
      var dx = (end.x - start.x) / steps, dy = (end.y - start.y) / steps;
      var i = 0;
      return new Promise(function (resolve) {
        (function mv() {
          i++;
          var x = start.x + dx * i, y = start.y + dy * i;
          fire(document, new PointerEvent('pointermove', {
            bubbles: true, composed: true, pointerId: 1, isPrimary: true,
            pointerType: 'mouse', buttons: 1, clientX: x, clientY: y
          }));
          if (i < steps) setTimeout(mv, opts.moveStepMs || 35);
          else setTimeout(function () {
            fire(document, new PointerEvent('pointerup', {
              bubbles: true, composed: true, pointerId: 1, isPrimary: true,
              pointerType: 'mouse', button: 0, buttons: 0, clientX: x, clientY: y
            }));
            setTimeout(resolve, 450);
          }, 200);
        })();
      });
    });
  }

  function clickBtn(el, preMs, hoverRowId) {
    return sleep(preMs == null ? 250 : preMs).then(function () {
      if (hoverRowId) hoverRow(hoverRowId, true);
      mouseOver(el);
      return sleep(300);
    }).then(function () {
      fire(el, new MouseEvent('click', { bubbles: true, composed: true }));
      return sleep(450);
    }).then(function () {
      if (hoverRowId) hoverRow(hoverRowId, false);
    });
  }

  function noteIdByText(txt) {
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].text.indexOf(txt) !== -1) return notes[i].id;
    }
    return null;
  }

  window.__demoStart = function () {
    var log = function (m) { try { console.log('[demo] ' + m); } catch (e) {} };

    return (async function () {
      log('演出开始');

      /* ====== 预置背景条目（开场画面真实感） ====== */
      addNote('帮莉莉订周四的会议室', 3);
      addNote('给妈订生日蛋糕', 3);
      addNote('季度复盘提前到下周三', 1);
      await sleep(1600);

      /* ====== 镜头3：产品出场定场（3s，无操作） ====== */
      await sleep(3000);

      /* ====== 镜头4：四象限徽标依次脉冲高亮（5s） ====== */
      for (var p = 0; p <= 3; p++) {
        var logo = zoneOf(p).querySelector('.zone-logo');
        logo.classList.add('demo-pulse');
        mouseOver(logo);
        await sleep(1150);
        logo.classList.remove('demo-pulse');
      }

      /* ====== 镜头5：底部输入打字 → 回车落 P3（5.5s） ====== */
      var qi = document.getElementById('quickInput');
      qi.focus();
      await typeInto(qi, '季度数据看板链接发给老板', 4.5, 500);
      pressEnter(qi);
      await sleep(1800);
      var dNote = noteIdByText('季度数据看板链接');

      /* ====== 镜头6：双击 P0 就地输入 + 悬停 P1 ⌘V 粘贴（7s） ====== */
      dblclickZoneBlank(0);
      await sleep(600);
      var inline0 = document.querySelector('#inlineWrap .inline-input');
      if (inline0) {
        await typeInto(inline0, '15:00 客户评审', 6, 400);
        pressEnter(inline0);
      }
      await sleep(1500);
      mouseOver(listEl(1));
      await sleep(800);
      pasteInto(1, '新首页改版需求 V2.1');
      await sleep(1800);

      /* ====== 镜头7：拖拽换区 + 同区重排（7.5s） ====== */
      if (dNote) await dragNote(dNote, 0, { holdMs: 700, steps: 46, moveStepMs: 32 });
      await sleep(1200);
      var cakeId = noteIdByText('生日蛋糕');
      var liliId = noteIdByText('莉莉');
      if (cakeId && liliId) {
        var cakeRow = rowOf(cakeId), liliRow = rowOf(liliId);
        if (cakeRow && liliRow) {
          var toY = rectCenter(liliRow).y;
          await dragNote(cakeId, 3, { holdMs: 650, steps: 26, moveStepMs: 30, endY: toY });
        }
      }
      await sleep(1000);

      /* ====== 镜头8：✓ 完成 → ⊘ 沉底 → 删除+撤销（4.5s） ====== */
      var meetId = noteIdByText('客户评审');
      if (meetId) { var b = actBtnOf(meetId, 'done'); if (b) await clickBtn(b, 250, meetId); }
      var reqId = noteIdByText('改版需求');
      if (reqId) { var d = actBtnOf(reqId, 'drop'); if (d) await clickBtn(d, 250, reqId); }
      if (cakeId) { var del = actBtnOf(cakeId, 'delete'); if (del) await clickBtn(del, 150, cakeId); }
      await sleep(600);
      var undoBtn = document.getElementById('undoBtn');
      if (undoBtn) await clickBtn(undoBtn, 100);
      await sleep(600);

      /* ====== 镜头9：收起成胶囊 → 展开（3.5s） ====== */
      var collapseBtn = document.getElementById('collapseBtn');
      await clickBtn(collapseBtn, 150);
      await sleep(2000);
      var expandBtn = document.getElementById('expandBtn');
      if (expandBtn) await clickBtn(expandBtn, 100);
      await sleep(700);

      /* ====== 镜头10：日历回顾 + 切深色（5s） ====== */
      var calBtn = document.getElementById('calBtn');
      await clickBtn(calBtn, 150);
      await sleep(2200);
      window.__wantDark = 'dark';
      await sleep(1800);
      fire(document, new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
      await sleep(800);

      /* ====== 镜头11：深色定场（2.5s，接 CTA 字幕卡） ====== */
      await sleep(2500);
      log('演出结束');
      return 'demo-done';
    })();
  };
})();
