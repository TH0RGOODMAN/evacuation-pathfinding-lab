import { createScenario, comparePaths, buildExport } from './pathfinding.mjs';

const $ = id => document.getElementById(id);
let grid = createScenario(), tool = 'risk', focusIndex = grid.start, results;
const names = { crossing: '风险穿越', corridors: '上下两条通道', blank: '空白画布' };
const cells = [];
for (let y = 0; y < grid.height; y++) {
  const row = document.createElement('div'); row.className = 'grid-row'; row.setAttribute('role', 'row');
  for (let x = 0; x < grid.width; x++) {
    const i = y * grid.width + x;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'cell'; button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-rowindex', String(y + 1)); button.setAttribute('aria-colindex', String(x + 1));
    button.addEventListener('focus', () => { focusIndex = i; cells.forEach((cell, n) => cell.tabIndex = n === i ? 0 : -1); });
    button.addEventListener('click', () => edit(i));
    button.addEventListener('keydown', event => {
      const next = { ArrowLeft: x > 0 ? i - 1 : i, ArrowRight: x < grid.width - 1 ? i + 1 : i, ArrowUp: y > 0 ? i - grid.width : i, ArrowDown: y < grid.height - 1 ? i + grid.width : i, Home: y * grid.width, End: (y + 1) * grid.width - 1 }[event.key];
      if (next !== undefined) { event.preventDefault(); cells[next].focus(); }
    });
    cells.push(button); row.append(button);
  }
  $('grid').append(row);
}
$('grid').setAttribute('aria-rowcount', String(grid.height)); $('grid').setAttribute('aria-colcount', String(grid.width));

function number(value) { return Number(value.toFixed(2)).toString(); }
function renderResult(id, result, weight) {
  const element = $(id); element.replaceChildren();
  if (!result.found) { const message = document.createElement('p'); message.textContent = '没有可达路线。试试擦掉一段障碍。'; element.append(message); return; }
  const metrics = document.createElement('div'); metrics.className = 'metrics';
  for (const [value, label] of [[result.steps, '长度 / 格'], [number(result.risk), '累计风险'], [number(result.cost), '本方案代价']]) {
    const item = document.createElement('div'), strong = document.createElement('strong'), span = document.createElement('span');
    strong.textContent = value; span.textContent = label; item.append(strong, span); metrics.append(item);
  }
  const note = document.createElement('p'); note.className = 'cost-note';
  note.textContent = `代价 = ${result.steps} + ${number(weight)} × ${number(result.risk)}；展开 ${result.expanded} 个格点。`;
  element.append(metrics, note);
}

function render(message) {
  const weight = Number($('weight').value);
  results = comparePaths(grid, weight);
  cells.forEach((cell, i) => {
    cell.className = `cell${grid.walls[i] ? ' wall' : ''}${i === grid.start ? ' endpoint' : ''}${i === grid.goal ? ' endpoint goal' : ''}`;
    const colors = ['#fffefa', '#fff0c0', '#ffe39a', '#ffd16c', '#f3b72b', '#e7a51b', '#dc9210'];
    cell.style.setProperty('--cell-color', colors[Math.min(6, Math.ceil(grid.risk[i]))]);
    cell.replaceChildren();
    const mark = i === grid.start && i === grid.goal ? 'S/E' : i === grid.start ? 'S' : i === grid.goal ? 'E' : '';
    if (mark) { const span = document.createElement('span'); span.className = 'marker'; span.textContent = mark; cell.append(span); }
    const route = [results.shortest.path.includes(i) ? '最短路' : '', results.weighted.path.includes(i) ? '加权路' : ''].filter(Boolean).join('、');
    const label = `${Math.floor(i / grid.width) + 1}行${i % grid.width + 1}列，${grid.walls[i] ? '障碍' : '风险 ' + grid.risk[i]}${mark ? '，' + (i === grid.start ? '起点' : '') + (i === grid.goal ? '出口' : '') : ''}${route ? '，' + route : ''}`;
    cell.setAttribute('aria-label', label); cell.title = label; cell.tabIndex = i === focusIndex ? 0 : -1;
  });
  for (const [id, result] of [['shortest-line', results.shortest], ['weighted-line', results.weighted]]) {
    $(id).setAttribute('points', result.path.map(i => `${(i % grid.width + .5) * 100},${(Math.floor(i / grid.width) + .5) * 100}`).join(' '));
  }
  $('weight-value').textContent = number(weight); $('weighted-caption').textContent = `λ = ${number(weight)}`;
  renderResult('shortest-result', results.shortest, 0); renderResult('weighted-result', results.weighted, weight);
  let comparison;
  if (!results.shortest.found) comparison = '起点与出口被障碍隔开，两种方案都无路可走。';
  else if (grid.start === grid.goal) comparison = '起点与出口在同一格：无需移动，长度与累计风险均为 0。';
  else if (weight === 0) comparison = '权重为 0，两种方案完全相同。试着提高权重，看看风险是否改变选择。';
  else comparison = `加权路比最短路${results.weighted.steps === results.shortest.steps ? '长度相同' : '多走 ' + (results.weighted.steps - results.shortest.steps) + ' 格'}，累计风险${Math.abs(results.shortest.risk - results.weighted.risk) < 1e-9 ? '相同' : '少 ' + number(results.shortest.risk - results.weighted.risk)}。两张卡片的代价使用各自的 λ。`;
  $('compare-note').textContent = comparison;
  $('status').textContent = message ? `${message} ${comparison}` : comparison;
}

function edit(i) {
  let message = '地图已更新。';
  if (tool === 'wall') {
    if (i === grid.start || i === grid.goal) { $('status').textContent = 'S/E 格不能设为障碍。先移动起点或出口。'; return; }
    grid.walls[i] = !grid.walls[i];
    if (grid.walls[i]) grid.risk[i] = 0;
  } else if (tool === 'risk') {
    if (grid.walls[i]) { $('status').textContent = '请先擦除障碍，再给这个格子增加风险。'; return; }
    grid.risk[i] = Number($('paint-risk').value);
  } else if (tool === 'erase') { grid.walls[i] = false; grid.risk[i] = 0; }
  else {
    if (grid.walls[i]) { $('status').textContent = '起点和出口需要放在可通行格子上。请先擦除障碍。'; return; }
    grid[tool] = i;
  }
  $('scenario-label').textContent = `${names[$('preset').value]} · 已编辑`;
  render(message);
}

document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
  tool = button.dataset.tool;
  document.querySelectorAll('[data-tool]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('status').textContent = `当前画笔：${button.textContent}。点击或用键盘编辑地图。`;
}));
$('weight').addEventListener('input', () => render());
$('zoom').addEventListener('click', () => {
  const zoomed = $('map-board').classList.toggle('zoomed');
  $('zoom').setAttribute('aria-pressed', String(zoomed));
  $('zoom').textContent = zoomed ? '缩回全图 −' : '放大地图以便编辑 ＋';
  $('status').textContent = zoomed ? '地图已放大，可以横向滚动查看和编辑格子。' : '地图已缩回全图。';
});
function reset() { grid = createScenario($('preset').value); focusIndex = grid.start; $('scenario-label').textContent = names[$('preset').value]; render('已恢复预设，保留当前权重。'); }
$('preset').addEventListener('change', reset); $('reset').addEventListener('click', reset);
$('export').addEventListener('click', () => {
  const result = buildExport(grid, Number($('weight').value), results);
  const blob = new Blob([JSON.stringify(result, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'pathfinding-experiment.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('status').textContent = '已生成 JSON 下载，包含当前地图、权重和两条路线。';
});
render(); $('lab').hidden = false;
