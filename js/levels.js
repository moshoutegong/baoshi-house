/*
 * 闯关规则和关卡数据（不碰画面）。
 * 地图符号：
 *   #  地面        .  空（走不过去）
 *   S  起点        N  鸟巢（终点）：拿齐全部宝石后才会打开
 *   g  有宝石的地面
 *   B  木箱：只能推不能拉；推进缺口会掉下去填平，变成一座桥
 *   c  裂开的地砖：踩过离开后就塌掉
 *   p  压力板：木箱压着（或宝石站着）时，所有闸门打开；有多块压力板时要全部压住
 *   G  闸门：关着的时候过不去
 *   T  小塔：装饰，不能走
 */
(function (global) {
  'use strict';
  const VOID = 0, FLOOR = 1, CRACK = 2, WALL = 3, GATE = 4;

  // best = 最少步数（由求解程序算出并验证过有解）
  const LEVELS = [
    { name: '初次出发', hint: '朝斜方向滑动，或点相邻的格子。拿齐 3 颗宝石，鸟巢才会打开。', best: 11,
      map: ['S#g#T', '...#.', '.g##.', '.#...', '.#gN.'] },
    { name: '岔路口', hint: '宝石不在去鸟巢的路上，要绕过去拿了再回来。', best: 13,
      map: ['T.g....', 'S###g#.', '..#..#.', '..g..N.'] },
    { name: '压力板', hint: '把木箱推到黄色的压力板上，闸门就会打开。木箱只能推，不能拉。', best: 14,
      map: ['..g.p....', 'S##B#G#gN', '..###.g..'] },
    { name: '步步为营', hint: '有裂纹的地砖踩过一次就会塌。先拿哪颗宝石，顺序很重要。', best: 16,
      map: ['S#c#g', '#...#', 'g.N.#', '#.g.#', '#c###'] },
    { name: '两个箱子', hint: '把木箱推进缺口，它会变成桥。缺口有两格宽，第二个箱子要绕到后面去推。', best: 24,
      map: ['S#B..gN', '#.#....', '#gB....', '###g..T'] },
    { name: '闸门后的宝石', hint: '有两个木箱：一个用来搭桥，一个用来压住压力板。想清楚哪个去哪儿。', best: 25,
      map: ['...gN#.', '.###Scg', '######.', '#p#BB#.', 'gG..#..'] },
    { name: '挡路的箱子', hint: '木箱推错了方向就会堵死路。走错了可以撤销。', best: 27,
      map: ['gc#.##', '..Sc##', '.BB##g', '.#g#.#', '..N#..'] },
    { name: '来回奔波', hint: '裂砖只能走一次，先把远处的事情办完再踩它。', best: 31,
      map: ['cggN#.', '##...g', '####c#', '.B#...', '#BS#..'] },
    { name: '层层推进', hint: '两个木箱要一前一后推过去，顺序错了就过不去。', best: 34,
      map: ['.######', '..##.#S', '..B#B##', '...gc.N', '#..####', 'g#c#g##'] },
    { name: '森林尽头', hint: '最后一关：木箱、裂砖、压力板、闸门都在。慢慢想，一定有办法。', best: 38,
      map: ['##..N##', 'g##SG##', '###p#Bg', '##.##B#', '##...#.', '.cg....'] }
  ];

  function parse(map) {
    const L = { w: map[0].length, h: map.length, cells: [], gems: [], crates: [], plates: [], gates: [], start: [0, 0], nest: [0, 0] };
    for (let y = 0; y < L.h; y++) {
      L.cells.push([]);
      for (let x = 0; x < L.w; x++) {
        const ch = map[y][x];
        let t = FLOOR;
        if (ch === '.') t = VOID; else if (ch === 'c') t = CRACK; else if (ch === 'T') t = WALL; else if (ch === 'G') t = GATE;
        if (ch === 'S') L.start = [x, y];
        if (ch === 'N') L.nest = [x, y];
        if (ch === 'g') L.gems.push([x, y]);
        if (ch === 'B') L.crates.push([x, y]);
        if (ch === 'p') L.plates.push([x, y]);
        if (ch === 'G') L.gates.push([x, y]);
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
  // 这一格有没有地面可站：没塌的地面，或者被掉下去的木箱填平了
  function solid(L, s, x, y) {
    const t = cell(L, x, y);
    if ((t === FLOOR || t === CRACK || t === GATE) && !s.broken[x + ',' + y]) return true;
    return s.crates.some((c) => c.fell && c.x === x && c.y === y);
  }
  const crateAt = (s, x, y) => s.crates.findIndex((c) => !c.fell && c.x === x && c.y === y);
  /** 闸门现在是不是开着：每块压力板上都有木箱或宝石 */
  function gatesOpen(L, s) {
    if (!L.plates.length) return false;
    return L.plates.every((p) => (s.x === p[0] && s.y === p[1]) || crateAt(s, p[0], p[1]) >= 0);
  }
  const allGems = (s) => s.got.every(Boolean);

  /** 走一步。走不了返回 null，否则返回 {state: 新状态, ev: 这一步发生了什么} */
  function step(L, s, dx, dy) {
    const nx = s.x + dx, ny = s.y + dy;
    if (s.won || !solid(L, s, nx, ny)) return null;
    const open = gatesOpen(L, s);
    if (cell(L, nx, ny) === GATE && !open) return null;
    const n = clone(s), ev = { from: [s.x, s.y], to: [nx, ny] };
    const ci = crateAt(s, nx, ny);
    if (ci >= 0) {
      const bx = nx + dx, by = ny + dy;
      if (bx < 0 || by < 0 || bx >= L.w || by >= L.h) return null;
      const bt = cell(L, bx, by);
      if (bt === WALL || crateAt(s, bx, by) >= 0) return null;
      if (bt === GATE && !open) return null;
      if (bx === L.nest[0] && by === L.nest[1]) return null;
      const c = n.crates[ci];
      c.x = bx; c.y = by; c.fell = !solid(L, s, bx, by);
      ev.push = { i: ci, from: [nx, ny], to: [bx, by], fell: c.fell };
    }
    const here = s.x + ',' + s.y;
    if (cell(L, s.x, s.y) === CRACK && !s.broken[here]) { n.broken[here] = true; ev.collapse = [s.x, s.y]; }
    n.x = nx; n.y = ny; n.steps++;
    // 这一步走完如果闸门会关上，门里不能有东西（否则会被夹住），这样的走法不允许
    const openAfter = gatesOpen(L, n);
    if (!openAfter && L.gates.some((g) => (n.x === g[0] && n.y === g[1]) || crateAt(n, g[0], g[1]) >= 0)) return null;
    if (openAfter !== open) ev.gates = openAfter;
    L.gems.forEach((g, i) => { if (!n.got[i] && g[0] === nx && g[1] === ny) { n.got[i] = true; ev.gem = i; } });
    if (ev.gem !== undefined && allGems(n)) ev.nestOpen = true;
    if (nx === L.nest[0] && ny === L.nest[1] && allGems(n)) { n.won = true; ev.win = true; }
    return { state: n, ev: ev };
  }

  const keyOf = (s) => s.x + ',' + s.y + '|' + s.got.map((b) => b ? 1 : 0).join('') + '|' +
    s.crates.map((c) => c.x + ',' + c.y + (c.fell ? 'f' : '')).join(';') + '|' + Object.keys(s.broken).sort().join(';');

  /** 穷举求解：返回最少步数 best 和走法 path（U 上 D 下 L 左 R 右）。无解时 best 为 null */
  function solve(map, cap) {
    const L = parse(map), DIRS = [[1, 0, 'R'], [-1, 0, 'L'], [0, 1, 'D'], [0, -1, 'U']];
    const first = init(L), seen = {};
    seen[keyOf(first)] = { prev: null, move: '' };
    let queue = [first], count = 0;
    cap = cap || 400000;
    while (queue.length && count < cap) {
      const next = [];
      for (const s of queue) {
        const sk = keyOf(s);
        for (const d of DIRS) {
          const r = step(L, s, d[0], d[1]);
          if (!r) continue;
          const n = r.state;
          if (n.won) {
            let path = d[2], k = sk;
            while (seen[k].prev !== null) { path = seen[k].move + path; k = seen[k].prev; }
            return { best: n.steps, path: path, states: count };
          }
          const k = keyOf(n);
          if (seen[k]) continue;
          seen[k] = { prev: sk, move: d[2] }; count++; next.push(n);
        }
      }
      queue = next;
    }
    return { best: null, path: '', states: count };
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
    nestOpen() { return allGems(this.state); }
    gatesOpen() { return gatesOpen(this.L, this.state); }
    cell(x, y) { return cell(this.L, x, y); }
  }
  Puzzle.VOID = VOID; Puzzle.FLOOR = FLOOR; Puzzle.CRACK = CRACK; Puzzle.WALL = WALL; Puzzle.GATE = GATE;
  Puzzle.solve = solve;

  // 星级：三星 = 最少步数 + 2 步以内；两星 = 再放宽一些；通关就有一星
  LEVELS.forEach((l, i) => {
    l.id = 'f-' + (i + 1);
    l.par = l.best + 2;
    l.par2 = l.best + Math.max(6, Math.ceil(l.best * 0.35));
  });

  global.LEVELS = LEVELS;
  global.Puzzle = Puzzle;
})(window);
