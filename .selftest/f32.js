/* F32 自测（v1.0.9）：隔夜闭合事项渲染层过滤
   独立提取 app.js 中的 closedAgedOut 纯函数做边界断言，不依赖 mock DOM。 */
var fs = require('fs');
var path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');

var m = src.match(/function closedAgedOut[\s\S]*?\n}/);
if (!m) { console.error('FATAL: closedAgedOut 未找到'); process.exit(1); }
var closedAgedOut = eval('(' + m[0].replace('function closedAgedOut', 'function') + ')');

var today = new Date(); today.setHours(0, 0, 0, 0);
var t0 = today.getTime();
var Y2349 = t0 - 60 * 1000;          // 昨天 23:59
var T0000 = t0;                      // 今天 00:00 整
var T0800 = t0 + 8 * 3600 * 1000;    // 今天 08:00

var cases = [
  ['done 昨天23:59 → 隔夜隐藏', { status: 'done', statusAt: Y2349, createdAt: Y2349 }, true],
  ['done 今天00:00整 → 仍显示', { status: 'done', statusAt: T0000, createdAt: T0000 }, false],
  ['done 今天08:00 → 仍显示', { status: 'done', statusAt: T0800, createdAt: T0800 }, false],
  ['dropped 昨天 → 隔夜隐藏', { status: 'dropped', statusAt: Y2349, createdAt: Y2349 }, true],
  ['open 无论多旧 → 永不过滤', { status: 'open', statusAt: 0, createdAt: Y2349 - 86400000 * 30 }, false],
  ['存量done无statusAt→兜底createdAt昨天', { status: 'done', statusAt: 0, createdAt: Y2349 }, true],
  ['存量done无statusAt→兜底createdAt今天', { status: 'done', statusAt: 0, createdAt: T0800 }, false],
  ['statusAt缺失且createdAt缺失 → 不过滤（防误删）', { status: 'done', statusAt: 0, createdAt: 0 }, false]
];

var pass = 0, fail = 0;
cases.forEach(function (c) {
  var got = closedAgedOut(c[1]);
  if (got === c[2]) { pass++; console.log('PASS ' + c[0]); }
  else { fail++; console.log('FAIL ' + c[0] + ' 期望 ' + c[2] + ' 实得 ' + got); }
});
console.log('结果：' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
