/** Four-neighbour static grid. One step costs 1 + weight * risk of the entered cell. */
export function validateGrid(grid) {
  if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) || grid.width < 2 || grid.height < 2 || grid.width > 60 || grid.height > 60) throw new TypeError('Grid dimensions must be integers from 2 to 60.');
  const size = grid.width * grid.height;
  if (!Array.isArray(grid.walls) || !Array.isArray(grid.risk) || grid.walls.length !== size || grid.risk.length !== size || !grid.walls.every(v => typeof v === 'boolean') || !grid.risk.every(v => Number.isFinite(v) && v >= 0 && v <= 100)) throw new TypeError('Invalid cell data.');
  if (![grid.start, grid.goal].every(v => Number.isInteger(v) && v >= 0 && v < size) || grid.walls[grid.start] || grid.walls[grid.goal]) throw new TypeError('Endpoints must be walkable cells.');
}

export function neighbours(grid, index) {
  const x = index % grid.width, y = Math.floor(index / grid.width);
  return [x > 0 ? index - 1 : -1, x + 1 < grid.width ? index + 1 : -1, y > 0 ? index - grid.width : -1, y + 1 < grid.height ? index + grid.width : -1].filter(i => i >= 0 && !grid.walls[i]);
}

export function findPath(grid, weight = 0) {
  validateGrid(grid);
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) throw new TypeError('Weight must be between 0 and 100.');
  const size = grid.width * grid.height;
  const distance = new Float64Array(size).fill(Infinity);
  const previous = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open = new Set([grid.start]);
  const gx = grid.goal % grid.width, gy = Math.floor(grid.goal / grid.width);
  const heuristic = i => Math.abs(i % grid.width - gx) + Math.abs(Math.floor(i / grid.width) - gy);
  distance[grid.start] = 0;
  let expanded = 0;
  while (open.size) {
    let current = -1, best = Infinity;
    for (const i of open) {
      const score = distance[i] + heuristic(i);
      if (score < best || (score === best && i < current)) { current = i; best = score; }
    }
    open.delete(current);
    expanded++;
    if (current === grid.goal) {
      const path = [];
      for (let i = current; i !== -1; i = previous[i]) path.push(i);
      path.reverse();
      const risk = path.slice(1).reduce((sum, i) => sum + grid.risk[i], 0);
      return { found: true, path, steps: path.length - 1, risk, cost: distance[current], expanded };
    }
    closed[current] = 1;
    for (const next of neighbours(grid, current)) {
      if (closed[next]) continue;
      const candidate = distance[current] + 1 + weight * grid.risk[next];
      if (candidate < distance[next]) { distance[next] = candidate; previous[next] = current; open.add(next); }
    }
  }
  return { found: false, path: [], steps: null, risk: null, cost: null, expanded };
}

export function comparePaths(grid, weight) {
  return { shortest: findPath(grid, 0), weighted: findPath(grid, weight) };
}

export function createScenario(name = 'crossing') {
  const width = 18, height = 12, size = width * height;
  const grid = { width, height, start: 5 * width + 1, goal: 5 * width + 16, walls: Array(size).fill(false), risk: Array(size).fill(0) };
  const cell = (x, y) => y * width + x;
  if (name === 'crossing') {
    for (let y = 4; y <= 6; y++) for (let x = 5; x <= 12; x++) grid.risk[cell(x, y)] = 4;
    for (let y = 1; y <= 10; y++) if (![3, 5, 9].includes(y)) grid.walls[cell(8, y)] = true;
  } else if (name === 'corridors') {
    grid.start = cell(1, 6); grid.goal = cell(16, 6);
    for (let y = 3; y <= 8; y++) for (let x = 4; x <= 13; x++) grid.walls[cell(x, y)] = true;
    for (let x = 3; x <= 14; x++) { grid.risk[cell(x, 9)] = 3; grid.risk[cell(x, 10)] = 3; grid.risk[cell(x, 11)] = 3; }
  } else if (name !== 'blank') throw new TypeError('Unknown scenario.');
  return grid;
}

export function buildExport(grid, weight, results = comparePaths(grid, weight)) {
  validateGrid(grid);
  return {
    schemaVersion: '1.0', application: 'Evacuation Pathfinding Lab',
    model: { movement: 'four-neighbour', stepUnit: 'grid cell', riskUnit: 'synthetic dimensionless penalty', objective: 'steps + weight * sum(risk of entered cells)', startRiskIncluded: false },
    weight, grid: { ...grid, walls: [...grid.walls], risk: [...grid.risk] },
    shortest: { ...results.shortest, path: [...results.shortest.path] },
    weighted: { ...results.weighted, path: [...results.weighted.path] },
    notice: 'AI-assisted static teaching example with synthetic data. Not a reproduction of a thesis or guidance for real evacuation.',
  };
}
