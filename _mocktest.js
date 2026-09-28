/* 临时验证脚本：用假的 Canvas 2D 上下文跑一遍绘制逻辑，检查调用是否合理 */
const fs = require('fs');
const vm = require('vm');

const calls = { moveTo: [], lineTo: [], fillText: [], rect: [], fillRect: 0, clearRect: 0, strokes: 0 };

const ctx = {
  fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
  fillRect: () => { calls.fillRect++; },
  clearRect: () => { calls.clearRect++; },
  createLinearGradient: () => ({ addColorStop: () => {} }),
  save: () => {}, restore: () => {}, translate: () => {}, setTransform: () => {},
  beginPath: () => {},
  moveTo: (x, y) => calls.moveTo.push([x, y]),
  lineTo: (x, y) => calls.lineTo.push([x, y]),
  rect: (x, y, w, h) => calls.rect.push([x, y, w, h]),
  stroke: () => { calls.strokes++; },
  fillText: (t, x, y) => calls.fillText.push([t, x, y])
};

const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
const document = { getElementById: () => canvas };
const window = { devicePixelRatio: 2 };

const sandbox = { window, document, console, Math, module: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

['js/constants.js', 'js/board.js', 'js/main.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
});

const out = [];
const push = (s) => out.push(s);

push('--- 画布适配 ---');
push('canvas.width  = ' + canvas.width + ' (期望 1120 = 560*2)');
push('canvas.height = ' + canvas.height + ' (期望 1240 = 620*2)');
push('style.width  = ' + canvas.style.width + ' / style.height = ' + canvas.style.height);
push('');
push('--- 绘制调用统计 ---');
push('clearRect 次数      = ' + calls.clearRect + ' (期望 1)');
push('fillRect 次数       = ' + calls.fillRect + ' (期望 2 = 底色+渐变)');
push('stroke 次数         = ' + calls.strokes + ' (期望 4 = 外框/网格/九宫/角标)');
push('rect 次数           = ' + calls.rect.length + ' (期望 1 = 外框)');
push('moveTo 次数         = ' + calls.moveTo.length + ' (期望 126)');
push('lineTo 次数         = ' + calls.lineTo.length + ' (期望 126)');
push('fillText 次数       = ' + calls.fillText.length + ' (期望 4)');
push('');
push('--- 文字内容 ---');
calls.fillText.forEach(c => push('  "' + c[0] + '" @ (' + c[1] + ', ' + c[2] + ')'));

// 关键几何校验
const all = calls.moveTo.concat(calls.lineTo);
const xs = all.map(p => p[0]);
const ys = all.map(p => p[1]);
push('');
push('--- 坐标范围（含 0.5 半像素偏移，网格区应为 46.5 ~ 526.5 / 46.5 ~ 586.5）---');
push('x: ' + Math.min.apply(null, xs) + ' ~ ' + Math.max.apply(null, xs));
push('y: ' + Math.min.apply(null, ys) + ' ~ ' + Math.max.apply(null, ys));

fs.writeFileSync('_check.txt', out.join('\n'));
