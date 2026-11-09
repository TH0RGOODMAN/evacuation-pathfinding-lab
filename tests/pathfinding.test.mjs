import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath, createScenario, comparePaths, buildExport } from '../pathfinding.mjs';

// Independent Bellman-Ford reference: no A* heuristic or production neighbour helper.
function reference(g, weight) {
  const d = Array(g.width * g.height).fill(Infinity); d[g.start] = 0;
  for (let pass = 0; pass < d.length - 1; pass++) {
    let changed = false;
    for (let u = 0; u < d.length; u++) if (!g.walls[u] && Number.isFinite(d[u])) {
      for (let v = 0; v < d.length; v++) {
        const adjacent = Math.abs(u % g.width - v % g.width) + Math.abs(Math.floor(u / g.width) - Math.floor(v / g.width)) === 1;
        if (adjacent && !g.walls[v] && d[u] + 1 + weight * g.risk[v] < d[v]) { d[v] = d[u] + 1 + weight * g.risk[v]; changed = true; }
      }
    }
    if (!changed) break;
  }
  return d[g.goal];
}

function verifyPath(g, result, weight) {
  if (!result.found) { assert.deepEqual(result.path, []); assert.equal(result.cost, null); return; }
  assert.equal(result.path[0], g.start); assert.equal(result.path.at(-1), g.goal);
  assert.equal(new Set(result.path).size, result.path.length);
  for (let i = 0; i < result.path.length; i++) {
    const u = result.path[i]; assert.equal(g.walls[u], false);
    if (i) { const v = result.path[i - 1]; assert.equal(Math.abs(u % g.width - v % g.width) + Math.abs(Math.floor(u / g.width) - Math.floor(v / g.width)), 1); }
  }
  const risk = result.path.slice(1).reduce((sum, i) => sum + g.risk[i], 0);
  assert.equal(result.risk, risk); assert.equal(result.steps, result.path.length - 1);
  assert.ok(Math.abs(result.cost - result.steps - weight * risk) < 1e-8);
}

test('synthetic crossing: zero weight agrees, weight 2 exchanges length for lower risk', () => {
  const g = createScenario();
  assert.deepEqual(comparePaths(g, 0).shortest, comparePaths(g, 0).weighted);
  const { shortest, weighted } = comparePaths(g, 2);
  assert.equal(shortest.steps, 15); assert.equal(shortest.risk, 32);
  assert.ok(weighted.steps > shortest.steps); assert.ok(weighted.risk < shortest.risk);
  verifyPath(g, weighted, 2); assert.ok(weighted.cost <= shortest.steps + 2 * shortest.risk);
});

test('both presets and blank canvas have valid optimal paths', () => {
  for (const name of ['crossing', 'corridors', 'blank']) for (const weight of [0, .5, 2, 8]) {
    const g = createScenario(name), r = findPath(g, weight);
    verifyPath(g, r, weight); assert.equal(r.cost, reference(g, weight));
  }
});

test('unreachable endpoint returns no fabricated metrics', () => {
  const g = createScenario('blank');
  for (let y = 0; y < g.height; y++) g.walls[y * g.width + 8] = true;
  const r = findPath(g, 3); assert.equal(r.found, false); verifyPath(g, r, 3);
});

test('same endpoint requires zero movement and excludes start risk', () => {
  const g = createScenario('blank'); g.goal = g.start; g.risk[g.start] = 6;
  const r = findPath(g, 8); assert.equal(r.steps, 0); assert.equal(r.risk, 0); assert.equal(r.cost, 0); verifyPath(g, r, 8);
});

test('invalid dimensions, endpoints, risk and weights are rejected', () => {
  const g = createScenario('blank');
  for (const weight of [-1, NaN, Infinity, 101, '2']) assert.throws(() => findPath(g, weight), TypeError);
  for (const change of [{ width: 1 }, { width: 100 }, { start: -1 }, { goal: 1.5 }, { risk: [1] }, { risk: g.risk.map((v, i) => i ? v : NaN) }, { risk: g.risk.map((v, i) => i ? v : -1) }]) assert.throws(() => findPath({ ...g, ...change }), TypeError);
  g.walls[g.start] = true; assert.throws(() => findPath(g), TypeError);
});

test('A* matches independent Bellman-Ford across 100 seeded random grids', () => {
  let seed = 67231;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let sample = 0; sample < 100; sample++) {
    const width = 3 + Math.floor(random() * 5), height = 3 + Math.floor(random() * 5), size = width * height;
    const g = { width, height, start: 0, goal: size - 1, walls: Array.from({ length: size }, () => random() < .27), risk: Array.from({ length: size }, () => Math.floor(random() * 7)) };
    g.walls[g.start] = false; g.walls[g.goal] = false;
    for (const weight of [0, .5, 2, 8]) {
      const expected = reference(g, weight), r = findPath(g, weight);
      assert.equal(r.found, Number.isFinite(expected)); if (r.found) assert.equal(r.cost, expected);
      verifyPath(g, r, weight);
    }
  }
});

test('search does not mutate inputs and JSON can reproduce the experiment', () => {
  const g = createScenario(), before = structuredClone(g);
  const r = comparePaths(g, 2); assert.deepEqual(g, before);
  const exported = JSON.parse(JSON.stringify(buildExport(g, 2, r)));
  assert.deepEqual(comparePaths(exported.grid, exported.weight), r);
  exported.grid.risk[0] = 99; exported.shortest.path[0] = 99;
  assert.deepEqual(g, before); assert.equal(r.shortest.path[0], g.start);
});
