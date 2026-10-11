/* promo-seq-en.js — v2 storyboard sequence, ENGLISH take (injected via promo-demo.js executeJavaScript)
 * Timing parity with promo-seq.js: typed strings are longer in English, so cps is
 * raised per field to keep every beat within ~100ms of the CN choreography.
 * Provides window.__demoStart().
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

  // per-char typing: value accumulates + input events (real render path)
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

  // ---- hover shim: synthetic events can't trigger CSS :hover, replay via class ----
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

  // hover + Cmd-V paste (F17 full chain), fallback to addNote after 900ms
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

  // long-press 500ms + progressive move + release (real F29 drag chain)
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
      log('EN take start');

      /* ====== preset notes (opening realism) ====== */
      addNote('Book a meeting room for Lily', 3);
      addNote("Order mom's birthday cake", 3);
      addNote('Quarterly review moved to Wed', 1);
      await sleep(1600);

      /* ====== shot 3: product establishing (3s, no action) ====== */
      await sleep(3000);

      /* ====== shot 4: quadrant logos pulse in order (5s) ====== */
      for (var p = 0; p <= 3; p++) {
        var logo = zoneOf(p).querySelector('.zone-logo');
        logo.classList.add('demo-pulse');
        mouseOver(logo);
        await sleep(1150);
        logo.classList.remove('demo-pulse');
      }

      /* ====== shot 5: quick-input typing + Enter to P3 (5.5s) ======
         CN: 12 chars @4.5cps = 2.67s → EN 23 chars @8.5cps = 2.71s (parity) */
      var qi = document.getElementById('quickInput');
      qi.focus();
      await typeInto(qi, 'Send boss the dashboard', 8.5, 500);
      pressEnter(qi);
      await sleep(1800);
      var dNote = noteIdByText('Send boss the dashboard');

      /* ====== shot 6: dblclick P0 inline input + hover P1 Cmd-V paste (7s) ======
         CN: 9 chars @6cps = 1.5s → EN 18 chars @12cps = 1.5s (parity) */
      dblclickZoneBlank(0);
      await sleep(600);
      var inline0 = document.querySelector('#inlineWrap .inline-input');
      if (inline0) {
        await typeInto(inline0, '3 PM client review', 12, 400);
        pressEnter(inline0);
      }
      await sleep(1500);
      mouseOver(listEl(1));
      await sleep(800);
      pasteInto(1, 'Homepage redesign brief V2.1');
      await sleep(1800);

      /* ====== shot 7: drag across zones + reorder in-zone (7.5s) ====== */
      if (dNote) await dragNote(dNote, 0, { holdMs: 700, steps: 46, moveStepMs: 32 });
      await sleep(1200);
      var cakeId = noteIdByText('birthday cake');
      var lilyId = noteIdByText('Lily');
      if (cakeId && lilyId) {
        var cakeRow = rowOf(cakeId), lilyRow = rowOf(lilyId);
        if (cakeRow && lilyRow) {
          var toY = rectCenter(lilyRow).y;
          await dragNote(cakeId, 3, { holdMs: 650, steps: 26, moveStepMs: 30, endY: toY });
        }
      }
      await sleep(1000);

      /* ====== shot 8: done → drop → delete + undo (4.5s) ====== */
      var meetId = noteIdByText('client review');
      if (meetId) { var b = actBtnOf(meetId, 'done'); if (b) await clickBtn(b, 250, meetId); }
      var reqId = noteIdByText('redesign brief');
      if (reqId) { var d = actBtnOf(reqId, 'drop'); if (d) await clickBtn(d, 250, reqId); }
      if (cakeId) { var del = actBtnOf(cakeId, 'delete'); if (del) await clickBtn(del, 150, cakeId); }
      await sleep(600);
      var undoBtn = document.getElementById('undoBtn');
      if (undoBtn) await clickBtn(undoBtn, 100);
      await sleep(600);

      /* ====== shot 9: collapse to capsule → expand (3.5s) ====== */
      var collapseBtn = document.getElementById('collapseBtn');
      await clickBtn(collapseBtn, 150);
      await sleep(2000);
      var expandBtn = document.getElementById('expandBtn');
      if (expandBtn) await clickBtn(expandBtn, 100);
      await sleep(700);

      /* ====== shot 10: calendar recap + switch to dark (5s) ====== */
      var calBtn = document.getElementById('calBtn');
      await clickBtn(calBtn, 150);
      await sleep(2200);
      window.__wantDark = 'dark';
      await sleep(1800);
      fire(document, new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
      await sleep(800);

      /* ====== shot 11: dark establishing (2.5s, into CTA card) ====== */
      await sleep(2500);
      log('EN take done');
      return 'demo-done';
    })();
  };
})();
