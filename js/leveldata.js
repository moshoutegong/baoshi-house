/*
 * 关卡数据：4 个世界，每个世界 10 关。地图符号的含义见 levels.js 开头。
 * best = 最少步数，由求解程序算出，同时证明这一关有解。
 * 世界 2 到 4 的大部分关卡是求解程序从大量随机地图里筛出来的：
 * 有解、步数够多、每个木箱都必须用到、新机关必须用到。
 */
(function (global) {
  'use strict';

  const WORLDS = [
    { name: '珊瑚森林', icon: '🌳', intro: '木箱、裂砖、压力板',
      theme: { top: [0xe08568, 0xd4745a], pillar: 0xb5564a, crackPillar: 0x9c6a52, tower: 0x1f4f63, roof: 0xf2c14e,
        bg: 'linear-gradient(#245f73 0%, #3f8f8c 55%, #e9b47c 100%)' } },
    { name: '漩涡溪谷', icon: '🌀', intro: '新机关：传送漩涡',
      theme: { top: [0x5aa868, 0x4c9a5b], pillar: 0x3a7048, crackPillar: 0x6f6a45, tower: 0x7a4f2c, roof: 0xf2c14e,
        bg: 'linear-gradient(#1f5f86 0%, #4f9fb5 55%, #b9d99a 100%)' } },
    { name: '冰雪山谷', icon: '❄️', intro: '新机关：会打滑的冰面',
      theme: { top: [0x7482bd, 0x6675b0], pillar: 0x47538f, crackPillar: 0x6a6480, tower: 0x2c3566, roof: 0xf7f2e9,
        bg: 'linear-gradient(#141a3a 0%, #3b4a8c 55%, #b7a6d6 100%)' } },
    { name: '古老神庙', icon: '🏛️', intro: '所有机关一起出现',
      theme: { top: [0xd6a252, 0xc99546], pillar: 0x9a6a35, crackPillar: 0x7d5c3c, tower: 0x6a3f6f, roof: 0x4fc8e8,
        bg: 'linear-gradient(#3a2356 0%, #8a4f7d 55%, #f0a868 100%)' } }
  ];

  const LEVELS = [
    // ===== 世界 1：珊瑚森林 =====
    { world: 0, name: '初次出发', hint: '朝斜方向滑动，或点相邻的格子。拿齐 3 颗宝石，鸟巢才会打开。', best: 11,
      map: ['S#g#T', '...#.', '.g##.', '.#...', '.#gN.'] },
    { world: 0, name: '岔路口', hint: '宝石不在去鸟巢的路上，要绕过去拿了再回来。', best: 13,
      map: ['T.g....', 'S###g#.', '..#..#.', '..g..N.'] },
    { world: 0, name: '压力板', hint: '把木箱推到黄色的压力板上，闸门就会打开。木箱只能推，不能拉。', best: 14,
      map: ['..g.p....', 'S##B#G#gN', '..###.g..'] },
    { world: 0, name: '步步为营', hint: '有裂纹的地砖踩过一次就会塌。先拿哪颗宝石，顺序很重要。', best: 16,
      map: ['S#c#g', '#...#', 'g.N.#', '#.g.#', '#c###'] },
    { world: 0, name: '两个箱子', hint: '把木箱推进缺口，它会变成桥。缺口有两格宽，第二个箱子要绕到后面去推。', best: 24,
      map: ['S#B..gN', '#.#....', '#gB....', '###g..T'] },
    { world: 0, name: '闸门后的宝石', hint: '有两个木箱：一个用来搭桥，一个用来压住压力板。想清楚哪个去哪儿。', best: 25,
      map: ['...gN#.', '.###Scg', '######.', '#p#BB#.', 'gG..#..'] },
    { world: 0, name: '挡路的箱子', hint: '木箱推错了方向就会堵死路。走错了可以撤销。', best: 27,
      map: ['gc#.##', '..Sc##', '.BB##g', '.#g#.#', '..N#..'] },
    { world: 0, name: '来回奔波', hint: '裂砖只能走一次，先把远处的事情办完再踩它。', best: 31,
      map: ['cggN#.', '##...g', '####c#', '.B#...', '#BS#..'] },
    { world: 0, name: '层层推进', hint: '两个木箱要一前一后推过去，顺序错了就过不去。', best: 34,
      map: ['.######', '..##.#S', '..B#B##', '...gc.N', '#..####', 'g#c#g##'] },
    { world: 0, name: '森林尽头', hint: '森林的最后一关：木箱、裂砖、压力板、闸门都在。慢慢想，一定有办法。', best: 38,
      map: ['##..N##', 'g##SG##', '###p#Bg', '##.##B#', '##...#.', '.cg....'] },

    // ===== 世界 2：漩涡溪谷（传送漩涡）=====
    { world: 1, name: '神奇的漩涡', hint: '走进一个漩涡，会从同样颜色的另一个漩涡里出来。', best: 8,
      map: ['S#1..1gN', '.g....g.'] },
    { world: 1, name: '隔岸取宝', hint: '漩涡能带你去走不到的地方。木箱不会被传送。', best: 18,
      map: ['.....g', 'N..#..', 'S#B###', '#g###1', 'g1c###'] },
    { world: 1, name: '两对漩涡', hint: '有两种颜色的漩涡了。记住每一对通向哪里。', best: 20,
      map: ['g.#N2#.', 'c2.####', '#g##B1g', '1#S....', '#c#....'] },
    { world: 1, name: '绕个大圈', hint: '有时候要故意走进漩涡，再走回来。', best: 22,
      map: ['2#1....', '##c..g.', '2###1c#', '#g.B.N.', '#gS###.'] },
    { world: 1, name: '溪边木箱', hint: '先想好木箱要去哪儿，再决定从哪个漩涡过去推它。', best: 24,
      map: ['g.2###N', '....###', '.2g##B1', '#S1##c.', '..gc#..'] },
    { world: 1, name: '来去匆匆', hint: '裂砖和漩涡在一起，回头路可能就没有了。', best: 26,
      map: ['.#2##g.', '..#.S..', '.#####.', '.#21gBc', 'gc.#N#1'] },
    { world: 1, name: '对岸的箱子', hint: '木箱在漩涡的另一头，从哪边推很关键。', best: 28,
      map: ['g.##...', '.N#1#S.', '#c#2gc2', 'g##B1##', '....##.'] },
    { world: 1, name: '溪谷迷踪', hint: '走不通的时候，试试换一个漩涡。', best: 30,
      map: ['...N#..', '1#g##2.', '...2##.', 'g.#S#1#', 'c#g#Bc#'] },
    { world: 1, name: '连环漩涡', hint: '两对漩涡挨得很近，别进错了。', best: 31,
      map: ['.S#.2#g', '1###12#', 'c#g....', '.#BN#..', 'gc#.##.'] },
    { world: 1, name: '溪谷尽头', hint: '溪谷的最后一关。两个木箱、两对漩涡，一步一步来。', best: 40,
      map: ['###N2#g', '#c.g###', 'S##.11.', '#.#B##.', '..##.2.', 'g#B....'] },

    // ===== 世界 3：冰雪山谷（冰面）=====
    { world: 2, name: '第一次滑冰', hint: '踩上冰面会一直滑，直到滑出冰面或者被挡住。', best: 6,
      map: ['Sgiii#gN', '.....g..'] },
    { world: 2, name: '停不下来', hint: '冰面上的宝石滑过去就能捡到。想好从哪个方向滑上去。', best: 14,
      map: ['..g###', '...Sig', '.i##i#', 'gic#iN', '#i##i.'] },
    { world: 2, name: '冰湖', hint: '一大片冰。滑到哪儿会停下来，出发前先看清楚。', best: 16,
      map: ['.ii###', '#iicg.', 'Nii#S#', '..###i', '.g#..g'] },
    { world: 2, name: '冰上推箱', hint: '木箱推上冰面也会一直滑。', best: 18,
      map: ['####B#', 'S#iiii', 'gN#..#', 'iii.gi', '.g...c'] },
    { world: 2, name: '挡一下', hint: '木箱可以当挡板：滑到它前面就会停住。', best: 20,
      map: ['.#g#N#', '..igii', '.#i###', '..iBi.', 'gci#iS'] },
    { world: 2, name: '滑向远方', hint: '木箱滑进缺口，也能变成桥。', best: 23,
      map: ['N..gci', 'g...#i', '######', 'Si##B.', 'gi#ii.'] },
    { world: 2, name: '冰上的闸门', hint: '两个木箱：谁去压住压力板，谁来当挡板？', best: 26,
      map: ['cg..g..', '#iii...', '#iiiiB#', '##..Gii', 'cgpB##S', '.i.#N##'] },
    { world: 2, name: '雪地迷宫', hint: '冰面会把你带到意想不到的地方。走错了就撤销。', best: 29,
      map: ['.....#.', 'g.i#.#.', 'c#ig#c#', 'iBiN#pS', 'i.ii##.', 'iB#igG#'] },
    { world: 2, name: '长长的冰道', hint: '中间那条冰道很长，从哪一格滑上去结果都不一样。', best: 33,
      map: ['g#Bg.#.', '##S.c.N', '##i.i#.', 'iiiiii.', '#B..#g.', 'p##Gic.'] },
    { world: 2, name: '山谷尽头', hint: '雪山的最后一关。别着急，每一步都想想会滑到哪儿。', best: 33,
      map: ['gc#gGN#', '..##iii', '..###Si', '..c#iii', '..##B#i', '..Bp.gi'] },

    // ===== 世界 4：古老神庙（全部机关）=====
    { world: 3, name: '神庙入口', hint: '漩涡和冰面一起出现了。', best: 9,
      map: ['S1.1ig', 'g...#N', '....g.'] },
    { world: 3, name: '石阶', hint: '从漩涡出来之后，下一步往哪儿走？', best: 18,
      map: ['....g#', '.##1#1', '#.#Scg', 'g#.#Ni', '#i##B#'] },
    { world: 3, name: '侧殿', hint: '木箱、冰面、漩涡，一样一样来。', best: 21,
      map: ['g##...', 'i#c#.g', 'iB1##i', '#S1g#i', '.#N..i'] },
    { world: 3, name: '回廊', hint: '有的地方只能靠滑才能到。', best: 23,
      map: ['....c#', 'i#1#B#', 'ig###g', '..#Sii', 'g.1##N'] },
    { world: 3, name: '冰柱大厅', hint: '中间是一条冰道，从不同的格子滑进去试试。', best: 25,
      map: ['.#.iS#', 'c#Bi##', '#N1i#g', '..1iig', '.g..i#'] },
    { world: 3, name: '暗道', hint: '漩涡在很远的角落，值得跑一趟。', best: 28,
      map: ['gcg1#.', '.N###.', '.#####', 'g#B#S#', '...ii1'] },
    { world: 3, name: '机关室', hint: '这一关要来回好几趟，耐心一点。', best: 30,
      map: ['g#i#..g', '#ciS.#c', 'N1i#g1i', '.#B###i', '.i#.#..'] },
    { world: 3, name: '双箱密室', hint: '两个木箱挨在一起，先推哪个？', best: 30,
      map: ['g.#1.g.', '#S##gc#', 'iiii#..', '#cii##.', '#1iBB#.', 'N#i....'] },
    { world: 3, name: '祭坛', hint: '裂砖只有一次机会，留到最后再踩。', best: 32,
      map: ['.##gcg#', '#B.#c..', '#iii#..', '1#g#1N#', 'iii#S..'] },
    { world: 3, name: '神庙之心', hint: '最后一关！木箱、压力板、闸门、冰面、漩涡全都在。', best: 35,
      map: ['S#iiii1', '#Np##g.', '##i.BGc', 'g#iiii1', '.#i.B#.', '......g'] }
  ];

  // 星级：三星 = 最少步数 + 2 步以内；两星 = 再放宽一些；通关就有一星
  LEVELS.forEach((l, i) => {
    l.id = 'f-' + (i + 1);
    l.par = l.best + 2;
    l.par2 = l.best + Math.max(6, Math.ceil(l.best * 0.35));
  });

  global.WORLDS = WORLDS;
  global.LEVELS = LEVELS;
})(window);
