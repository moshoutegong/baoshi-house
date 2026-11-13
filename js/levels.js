/*
 * 闯关规则（不碰画面）。关卡数据在 leveldata.js。
 * 地图符号：
 *   #  地面        .  空（走不过去）
 *   S  起点        N  鸟巢（终点）：拿齐全部宝石后才会打开
 *   g  有宝石的地面
 *   B  木箱：只能推不能拉；推进缺口会掉下去填平，变成一座桥
 *   c  裂开的地砖：踩过离开后就塌掉
 *   p  压力板：木箱压着（或宝石站着）时，所有闸门打开；有多块压力板时要全部压住
 *   G  闸门：关着的时候过不去
 *   i  冰面：踩上去会一直滑，直到滑出冰面或被挡住；木箱推上去也会滑
 *   1 2 3  传送门：成对出现，走进一个会从另一个出来（木箱不会被传送）
 *   T  小塔：装饰，不能走
 */
(function (global) {
  'use strict';
  const VOID = 0, FLOOR = 1, CRACK = 2, WALL = 3, GATE = 4, ICE = 5;

  function parse(map) {
    const L = { w: map[0].length, h: map.length, cells: [], gems: [], crates: [], plates: [], gates: [],
      portal: {}, portals: [], start: [0, 0], nest: [0, 0] };
    const pairs = {};
    for (let y = 0; y < L.h; y++) {
      L.cells.push([]);
      for (let x = 0; x < L.w; x++) {
        const ch = map[y][x];
        let t = FLOOR;
        if (ch === '.') t = VOID; else if (ch === 'c') t = CRACK; else if (ch === 'T') t = WALL;
        else if (ch === 'G') t = GATE; else if (ch === 'i') t = ICE;
        if (ch === 'S') L.start = [x, y];
        if (ch === 'N') L.nest = [x, y];
        if (ch === 'g') L.gems.push([x, y]);
        if (ch === 'B') L.crates.push([x, y]);
        if (ch === 'p') L.plates.push([x, y]);
        if (ch === 'G') L.gates.push([x, y]);
        if (ch >= '1' && ch <= '9') (pairs[ch] = pairs[ch] || []).push([x, y]);
        L.cells[y].push(t);
      }
    }
    Object.keys(pairs).forEach((k) => {
      const p = pairs[k];
      if (p.length !== 2) return;
      L.portal[p[0][0] + ',' + p[0][1]] = p[1];
      L.portal[p[1][0] + ',' + p[1][1]] = p[0];
      L.portals.push({ id: +k, a: p[0], b: p[1] });
    });
    return L;
  }
  const init = (L) => ({ x: L.start[0], y: L.start[1], got: L.gems.map(() => false),
    crates: L.crates.map((c) => ({ x: c[0], y: c[1], fell: false })), broken: {}, steps: 0, won: false });
  const clone = (s) => ({ x: s.x, y: s.y, got: s.got.slice(), crates: s.crates.map((c) => ({ x: c.x, y: c.y, fell: c.fell })),
    broken: Object.assign({}, s.broken), steps: s.steps, won: s.won });
  const cell = (L, x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h) ? VOID : L.cells[y][x];
  // 这一格有没有地面可站：没塌的地面，或者被掉下去的木箱填平了
  function solid(L, s, x, y) {
    const t = cell(L, x, y);
    if (t !== VOID && t !== WALL && !s.broken[x + ',' + y]) return true;
    return s.crates.some((c) => c.fell && c.x === x && c.y === y);
  }
  const crateAt = (s, x, y) => s.crates.findIndex((c) => !c.fell && c.x === x && c.y === y);
  /** 闸门是不是开着：每块压力板上都有木箱，或者宝石正站在上面 */
  function gatesOpen(L, s, ignoreBird) {
    if (!L.plates.length) return false;
    return L.plates.every((p) => (!ignoreBird && s.x === p[0] && s.y === p[1]) || crateAt(s, p[0], p[1]) >= 0);
  }
  const allGems = (s) => s.got.every(Boolean);

  /** 走一步。走不了返回 null，否则返回 {state: 新状态, ev: 这一步发生了什么} */
  function step(L, s, dx, dy) {
    const nx = s.x + dx, ny = s.y + dy;
    if (s.won || !solid(L, s, nx, ny)) return null;
    const open = gatesOpen(L, s);
    if (cell(L, nx, ny) === GATE && !open) return null;
    const n = clone(s), ev = { from: [s.x, s.y], to: [nx, ny], first: [nx, ny], trail: [] };

    // ---- 推木箱 ----
    const ci = crateAt(s, nx, ny);
    if (ci >= 0) {
      const c = n.crates[ci];
      const canEnter = (x, y) => {
        if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
        const t = cell(L, x, y);
        if (t === WALL || crateAt(n, x, y) >= 0) return false;
        if (t === GATE && !open) return false;
        return !(x === L.nest[0] && y === L.nest[1]);
      };
      if (!canEnter(nx + dx, ny + dy)) return null;
      const path = [];
      do { // 推一格；如果落在冰面上，就继续往前滑
        c.x += dx; c.y += dy; path.push([c.x, c.y]);
        if (!solid(L, s, c.x, c.y)) { c.fell = true; break; }
      } while (cell(L, c.x, c.y) === ICE && canEnter(c.x + dx, c.y + dy));
      ev.push = { i: ci, from: [nx, ny], to: [c.x, c.y], fell: c.fell, path: path };
    }

    // ---- 离开裂砖，它就塌了 ----
    const here = s.x + ',' + s.y;
    if (cell(L, s.x, s.y) === CRACK && !s.broken[here]) { n.broken[here] = true; ev.collapse = [s.x, s.y]; }

    // ---- 宝石（鹦鹉）落脚：捡宝石、冰面滑行、传送 ----
    let px = nx, py = ny, gotGem = false;
    const collect = () => { L.gems.forEach((g, i) => { if (!n.got[i] && g[0] === px && g[1] === py) { n.got[i] = true; gotGem = true; } }); };
    const midOpen = gatesOpen(L, n, true);
    collect();
    while (cell(L, px, py) === ICE && !L.portal[px + ',' + py]) {
      const tx = px + dx, ty = py + dy;
      if (!solid(L, n, tx, ty) || crateAt(n, tx, ty) >= 0) break;
      if (cell(L, tx, ty) === GATE && !midOpen) break;
      px = tx; py = ty; ev.trail.push([px, py]); collect();
    }
    const exit = L.portal[px + ',' + py];
    if (exit && crateAt(n, exit[0], exit[1]) < 0) { ev.warp = { from: [px, py], to: exit }; px = exit[0]; py = exit[1]; collect(); }
    n.x = px; n.y = py; n.steps++;
    ev.to = [px, py];

    // 这一步走完如果闸门会关上，门里不能有东西（否则会被夹住），这样的走法不允许
    const openAfter = gatesOpen(L, n);
    if (!openAfter && L.gates.some((g) => (n.x === g[0] && n.y === g[1]) || crateAt(n, g[0], g[1]) >= 0)) return null;
    if (openAfter !== open) ev.gates = openAfter;
    if (gotGem) { ev.gem = true; if (allGems(n)) ev.nestOpen = true; }
    if (px === L.nest[0] && py === L.nest[1] && allGems(n)) { n.won = true; ev.win = true; }
    return { state: n, ev: ev };
  }

  const keyOf = (s) => s.x + ',' + s.y + '|' + s.got.map((b) => b ? 1 : 0).join('') + '|' +
    s.crates.map((c) => c.x + ',' + c.y + (c.fell ? 'f' : '')).join(';') + '|' + Object.keys(s.broken).sort().join(';');

  /** 从某个局面出发穷举求解：返回还需要的最少步数 best 和走法 path（U 上 D 下 L 左 R 右）。无解时 best 为 null */
  function solveFrom(L, start, cap) {
    const DIRS = [[1, 0, 'R'], [-1, 0, 'L'], [0, 1, 'D'], [0, -1, 'U']];
    const seen = {};
    seen[keyOf(start)] = { prev: null, move: '' };
    let queue = [start], count = 0, depth = 0;
    cap = cap || 400000;
    while (queue.length && count < cap) {
      const next = [];
      depth++;
      for (const s of queue) {
        const sk = keyOf(s);
        for (const d of DIRS) {
          const r = step(L, s, d[0], d[1]);
          if (!r) continue;
          const n = r.state;
          if (n.won) {
            let path = d[2], k = sk;
            while (seen[k].prev !== null) { path = seen[k].move + path; k = seen[k].prev; }
            return { best: depth, path: path, states: count };
          }
          const k = keyOf(n);
          if (seen[k]) continue;
          seen[k] = { prev: sk, move: d[2] }; count++; next.push(n);
        }
      }
      queue = next;
    }
    return { best: null, path: '', states: count, gaveUp: queue.length > 0 };
  }
  const solve = (map, cap) => { const L = parse(map); return solveFrom(L, init(L), cap); };

  class Puzzle {
    constructor(map) { this.L = parse(map); this.reset(); }
    reset() { this.state = init(this.L); this.history = []; }
    move(dx, dy) {
      const r = step(this.L, this.state, dx, dy);
      if (!r) return null;
      this.history.push(this.state);
      this.state = r.state;
      return r.ev;
    }
    undo() { if (!this.history.length) return false; this.state = this.history.pop(); return true; }
    gemsGot() { return this.state.got.filter(Boolean).length; }
    nestOpen() { return allGems(this.state); }
    gatesOpen() { return gatesOpen(this.L, this.state); }
    cell(x, y) { return cell(this.L, x, y); }
    /** 从现在的局面求接下来怎么走。走不通了返回 best: null */
    hint() { return solveFrom(this.L, this.state, 250000); }
  }
  Puzzle.VOID = VOID; Puzzle.FLOOR = FLOOR; Puzzle.CRACK = CRACK; Puzzle.WALL = WALL; Puzzle.GATE = GATE; Puzzle.ICE = ICE;
  Puzzle.solve = solve;
  global.Puzzle = Puzzle;
})(window);
