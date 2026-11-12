/*
 * 闯关规则和关卡数据（不碰画面）。
 * 地图符号：
 *   #  地面        .  空（掉不下去，也走不过去）
 *   S  起点        N  鸟巢（终点）
 *   g  有宝石的地面
 *   B  木箱：可以推；推进缺口会掉下去填平，变成一座桥
 *   c  裂开的地砖：踩过离开后就塌掉
 *   T  小塔：装饰，不能走
 */
(function (global) {
  'use strict';
  const VOID = 0, FLOOR = 1, CRACK = 2, WALL = 3;

  const LEVELS = [
    { name: '初次出发', hint: '朝斜方向滑动，或点相邻的格子，带宝石走到鸟巢。',
      map: ['S#g#T', '...#.', '.g##.', '.#...', '.#gN.'] },
    { name: '岔路口', hint: '宝石不一定在去鸟巢的路上，绕过去拿了再回来。',
      map: ['T.g....', 'S###g#.', '..#..#.', '..g..N.'] },
    { name: '木箱搭桥', hint: '把木箱推进缺口，它会掉下去变成一座桥。',
      map: ['.g....T', 'S#B.#gN', '.g.....'] },
    { name: '推对方向', hint: '木箱只能推，不能拉。推之前先看看它会去哪儿。',
      map: ['..#g...', '..#...T', 'S#B#.gN', '..#....', '..g....'] },
    { name: '裂开的地砖', hint: '有裂纹的地砖踩过一次就会塌，走之前想清楚。',
      map: ['S#c#g#', 'T....#', 'N#g#c#', '..g...'] },
    { name: '近路的代价', hint: '抄近路很快，可是有些宝石就拿不到了。',
      map: ['S#c#g', '..c.#', 'N##g#', 'T.g..'] },
    { name: '箱子和裂砖', hint: '木箱和裂砖一起出现了，一步一步来。',
      map: ['S#B.#g#', '..g...c', 'N#c#g##'] },
    { name: '两个箱子', hint: '缺口有两格宽，需要两个木箱。第二个箱子要绕到它后面去推。',
      map: ['S#B..gN', '#.#....', '#gB....', '###g..T'] },
    { name: '步步为营', hint: '拿宝石的先后顺序很重要。走错了可以撤销。',
      map: ['S#c#g', '#...#', 'g.N.#', '#.g.#', '#c###'] },
    { name: '森林尽头', hint: '最后一关，把学到的本领都用上。',
      map: ['S#B.#c#g', 'T.#....#', 'g###B.gN', '..g.....'] }
  ];
  LEVELS.forEach((l, i) => { l.id = 'w1-' + (i + 1); });

  function parse(map) {
    const L = { w: map[0].length, h: map.length, cells: [], gems: [], crates: [], start: [0, 0], nest: [0, 0] };
    for (let y = 0; y < L.h; y++) {
      L.cells.push([]);
      for (let x = 0; x < L.w; x++) {
        const ch = map[y][x];
        let t = FLOOR;
        if (ch === '.') t = VOID; else if (ch === 'c') t = CRACK; else if (ch === 'T') t = WALL;
        if (ch === 'S') L.start = [x, y];
        if (ch === 'N') L.nest = [x, y];
        if (ch === 'g') L.gems.push([x, y]);
        if (ch === 'B') L.crates.push([x, y]);
        L.cells[y].push(t);
      }
    }
    return L;
  }
  const init = (L) => ({ x: L.start[0], y: L.start[1], got: L.gems.map(() => false),
    crates: L.crates.map((c) => ({ x: c[0], y: c[1], fell: false })), broken: {}, steps: 0, won: false });
  const clone = (s) => ({ x: s.x, y: s.y, got: s.got.slice(), crates: s.crates.map((c) => ({ x: c.x, y: c.y, fell: c.fell })),
    broken: Object.assign({}, s.broken), steps: s.steps, won: s.won });
  const cell = (L, x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h) ? VOID : L.cells[y][x];
  // 这一格现在能不能站：没塌的地面，或者被掉下去的木箱填平了
  function solid(L, s, x, y) {
    const t = cell(L, x, y);
    if ((t === FLOOR || t === CRACK) && !s.broken[x + ',' + y]) return true;
    return s.crates.some((c) => c.fell && c.x === x && c.y === y);
  }
  const crateAt = (s, x, y) => s.crates.findIndex((c) => !c.fell && c.x === x && c.y === y);

  /** 走一步。走不了返回 null，否则返回 {state: 新状态, ev: 这一步发生了什么} */
  function step(L, s, dx, dy) {
    const nx = s.x + dx, ny = s.y + dy;
    if (s.won || !solid(L, s, nx, ny)) return null;
    const n = clone(s), ev = { from: [s.x, s.y], to: [nx, ny] };
    const ci = crateAt(s, nx, ny);
    if (ci >= 0) {
      const bx = nx + dx, by = ny + dy;
      if (bx < 0 || by < 0 || bx >= L.w || by >= L.h) return null;
      if (cell(L, bx, by) === WALL || crateAt(s, bx, by) >= 0) return null;
      if (bx === L.nest[0] && by === L.nest[1]) return null;
      const c = n.crates[ci];
      c.x = bx; c.y = by; c.fell = !solid(L, s, bx, by);
      ev.push = { i: ci, from: [nx, ny], to: [bx, by], fell: c.fell };
    }
    const here = s.x + ',' + s.y;
    if (cell(L, s.x, s.y) === CRACK && !s.broken[here]) { n.broken[here] = true; ev.collapse = [s.x, s.y]; }
    n.x = nx; n.y = ny; n.steps++;
    L.gems.forEach((g, i) => { if (!n.got[i] && g[0] === nx && g[1] === ny) { n.got[i] = true; ev.gem = i; } });
    if (nx === L.nest[0] && ny === L.nest[1]) { n.won = true; ev.win = true; }
    return { state: n, ev: ev };
  }

  const keyOf = (s) => s.x + ',' + s.y + '|' + s.got.map((b) => b ? 1 : 0).join('') + '|' +
    s.crates.map((c) => c.x + ',' + c.y + (c.fell ? 'f' : '')).join(';') + '|' + Object.keys(s.broken).sort().join(';');

  /** 穷举求解：返回最少几步能通关（win），最少几步能拿齐宝石再通关（all）。无解为 null */
  function solve(map) {
    const L = parse(map), seen = {}, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let queue = [init(L)], win = null, all = null, count = 0;
    seen[keyOf(queue[0])] = 1;
    while (queue.length && count < 400000 && all === null) {
      const next = [];
      for (const s of queue) {
        for (const d of DIRS) {
          const r = step(L, s, d[0], d[1]);
          if (!r) continue;
          const n = r.state;
          if (n.won) {
            if (win === null) win = n.steps;
            if (all === null && n.got.every(Boolean)) all = n.steps;
            continue;
          }
          const k = keyOf(n);
          if (seen[k]) continue;
          seen[k] = 1; count++; next.push(n);
        }
      }
      queue = next;
    }
    return { win: win, all: all, states: count };
  }

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
    cell(x, y) { return cell(this.L, x, y); }
    solid(x, y) { return solid(this.L, this.state, x, y); }
  }
  Puzzle.VOID = VOID; Puzzle.FLOOR = FLOOR; Puzzle.CRACK = CRACK; Puzzle.WALL = WALL;
  Puzzle.solve = solve;

  // 三星步数 = 拿齐宝石的最少步数 + 2 步的余量
  LEVELS.forEach((l) => { const r = solve(l.map); l.best = r; l.par = (r.all === null ? 99 : r.all + 2); });

  global.LEVELS = LEVELS;
  global.Puzzle = Puzzle;
})(window);
