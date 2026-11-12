/*
 * 宝石小屋 —— 画面和操作：小屋、答题、闯关。
 * 规则在 store.js / levels.js，题目在 questions.js，宝石的模型在 baoshi3d.js。
 */
(function () {
  'use strict';
  const S = Store, T = THREE, RULES = Store.RULES;
  S.load();
  const $ = (id) => document.getElementById(id);
  const LEVEL_IDS = LEVELS.map((l) => l.id);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');

  // ================= 渲染基础 =================
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  $('stage').appendChild(renderer.domElement);
  const cv = renderer.domElement;

  const mat = (c) => new T.MeshLambertMaterial({ color: c });
  function block(parent, geo, color, x, y, z) { // 棱角分明的几何建筑块
    const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
    const m = new T.Mesh(g, typeof color === 'number' ? mat(color) : color);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function lights(scene, cx, cz, span, ambient, sunPower) {
    scene.add(new T.AmbientLight(0xfffaf2, ambient));
    const sun = new T.DirectionalLight(0xfff6ea, sunPower);
    sun.position.set(cx - 3, 10, cz + 6); sun.target.position.set(cx, 0, cz);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 40 });
    scene.add(sun, sun.target);
  }

  // ================= 小屋场景 =================
  const home = { scene: new T.Scene(), camera: new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 50) };
  home.camera.position.set(1.0, 1.9, 6); home.camera.lookAt(0, 0.82, 0);
  lights(home.scene, 0, 0, 3.5, 0.74, 0.3);
  // 小屋的风格。环境都用偏深的颜色，宝石是画面里最亮的，容易看清。
  const HOUSES = {
    coral: { name: '珊瑚小屋', icon: '🏠', price: 0, bg: 'linear-gradient(#245f73 0%, #3f8f8c 55%, #e9b47c 100%)',
      top: 0xd9795f, mid: 0xc2624f, base: 0xa94f45, arch: 0x1f4f63,
      extra(g) {
        block(g, new T.BoxGeometry(0.36, 0.5, 0.36), 0xf2c14e, -1.08, 0.25, 0.2);
        block(g, new T.ConeGeometry(0.2, 0.42, 4), 0x1f4f63, -1.08, 0.71, 0.2).rotation.y = Math.PI / 4;
        block(g, new T.IcosahedronGeometry(0.15, 0), 0x3fa66b, 1.1, 0.15, 0.4);
      } },
    forest: { name: '森林小屋', icon: '🌲', price: 150, bg: 'linear-gradient(#1f5f86 0%, #4f9fb5 55%, #b9d99a 100%)',
      top: 0x4f9a5c, mid: 0x3f8350, base: 0x7a5536, arch: 0x8a5a2b,
      extra(g) {
        [[-1.12, 0.1, 1], [1.15, -0.5, 0.8]].forEach((t) => {
          block(g, new T.CylinderGeometry(0.06, 0.08, 0.3, 6), 0x6b4a2f, t[0], 0.15, t[1]);
          block(g, new T.ConeGeometry(0.34 * t[2], 0.55 * t[2], 6), 0x2f7d4a, t[0], 0.5, t[1]);
          block(g, new T.ConeGeometry(0.26 * t[2], 0.48 * t[2], 6), 0x3f9a5c, t[0], 0.82, t[1]).rotation.y = 0.5;
        });
        block(g, new T.CylinderGeometry(0.035, 0.045, 0.12, 6), 0xf3ead8, 1.05, 0.06, 0.5);
        block(g, new T.ConeGeometry(0.11, 0.1, 8), 0xd9453b, 1.05, 0.17, 0.5);
        block(g, new T.IcosahedronGeometry(0.12, 0), 0x8f8a80, -0.95, 0.09, 0.7);
      } },
    night: { name: '星空小屋', icon: '🌙', price: 250, bg: 'linear-gradient(#11163a 0%, #2b2a6b 55%, #6a4c93 100%)',
      top: 0x5b4a9a, mid: 0x4a3b84, base: 0x35285f, arch: 0xf2c14e,
      extra(g) {
        const glow = (c) => new T.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.55 });
        block(g, new T.IcosahedronGeometry(0.3, 1), glow(0xf7e6a1), -1.25, 2.1, -1.4);
        [[-1.1, 1.3, -0.6], [1.2, 1.9, -1.2], [1.35, 0.9, -0.2], [-0.5, 2.3, -1.3], [0.6, 2.45, -1.3]].forEach((p, i) => {
          const s = block(g, new T.OctahedronGeometry(0.07 + (i % 2) * 0.03, 0), glow(0xffe27a), p[0], p[1], p[2]);
          s.castShadow = false; s.userData.star = i;
        });
        block(g, new T.BoxGeometry(0.3, 0.3, 0.3), 0x7f6cc4, -1.08, 0.15, 0.25).rotation.y = 0.4;
        block(g, new T.IcosahedronGeometry(0.13, 0), 0x4fc8e8, 1.1, 0.13, 0.4);
      } }
  };
  home.decor = null; home.house = '';
  function buildHouse(id) {
    if (!HOUSES[id]) id = 'coral';
    if (home.house === id) return;
    if (home.decor) home.scene.remove(home.decor);
    const h = HOUSES[id], g = home.decor = new T.Group(), P8 = Math.PI / 8;
    block(g, new T.CylinderGeometry(1.5, 1.5, 0.16, 8), h.top, 0, -0.08, 0).rotation.y = P8;
    block(g, new T.CylinderGeometry(1.8, 1.8, 0.16, 8), h.mid, 0, -0.24, 0).rotation.y = P8;
    block(g, new T.CylinderGeometry(1.8, 1.2, 1.8, 8), h.base, 0, -1.22, 0).rotation.y = P8;
    block(g, new T.BoxGeometry(0.24, 1.6, 0.24), h.arch, -0.86, 0.8, -1.0);
    block(g, new T.BoxGeometry(0.24, 1.6, 0.24), h.arch, 0.86, 0.8, -1.0);
    block(g, new T.TorusGeometry(0.86, 0.12, 4, 12, Math.PI), h.arch, 0, 1.6, -1.0);
    h.extra(g);
    home.scene.add(g); home.house = id;
    applyBackground();
  }
  function applyBackground() { document.body.style.background = view === 'home' ? HOUSES[home.house || 'coral'].bg : ''; }

  const pet = new Baoshi3D({ palette: S.s.palette });
  pet.group.rotation.y = 0.16; pet.group.scale.setScalar(1.45);
  pet.setOutfit(S.s.outfit);
  home.scene.add(pet.group);
  home.spin = 0; home.spinV = 0;   // 手指拖动让宝石转身

  // ================= 通用界面 =================
  let view = 'home';
  function setView(v) { view = v; document.body.dataset.view = v; applyBackground(); resize(); }
  buildHouse(S.s.house);

  let toastTimer = 0;
  function toast(msg, ms) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms || 2400);
  }
  const sheet = $('sheet');
  function openSheet(html) { sheet.innerHTML = html; sheet.scrollTop = 0; $('modal').classList.add('on'); return sheet; }
  function closeSheet() { $('modal').classList.remove('on', 'dock'); sheet.innerHTML = ''; }
  const isOpen = () => $('modal').classList.contains('on');
  const starsHtml = (n) => '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>';

  const STATUS_CLASS = { idle: '', hungry1: '', hungry2: 'warn', hungry3: 'warn', faint: 'bad', dying: 'bad', coma: 'bad' };
  function refreshHud() {
    const s = S.s, st = S.status(), info = Baoshi3D.INFO[st];
    $('lvText').textContent = 'Lv.' + s.level;
    const need = S.needXp(s.level), maxed = s.level >= RULES.maxLevel;
    $('xpBar').style.width = (maxed ? 100 : Math.min(100, (s.xp / need) * 100)) + '%';
    $('xpText').textContent = maxed ? '满级' : s.xp + ' / ' + need;
    $('coins').textContent = s.coins; $('tickets').textContent = s.tickets;
    $('food').textContent = s.food; $('bells').textContent = s.bells;
    $('satBar').style.width = s.satiety + '%';
    $('satBar').style.background = s.satiety > 40 ? '#3f9d6b' : s.satiety > 20 ? '#d99a2b' : '#d2584f';
    $('satText').textContent = s.satiety;
    $('bond').textContent = s.bond;
    $('mastered').textContent = Object.keys(s.correct).length + ' / ' + QUESTIONS.length;
    const pill = $('statusPill');
    pill.textContent = st === 'idle' ? '精神很好' : info.label;
    pill.className = 'pill ' + STATUS_CLASS[st];
    $('statusTip').textContent = st === 'idle' ? '宝石吃得饱饱的，可以带它去探险。' : info.tip;
    document.body.classList.toggle('coma', st === 'coma');
  }

  // 宝石平时的形态跟着饱腹度走；喂食、玩耍等动作播完后回到这个形态
  function syncPet() {
    const base = S.status();
    const busy = pet.dur !== Infinity || pet.queue.length > 0;
    if (busy) { pet.after = base; return; }
    if (pet.state !== base && !(base === 'idle' && pet.state === 'bored')) pet.setState(base);
  }

  // ================= 喂食和玩耍 =================
  $('btnFeed').onclick = () => {
    const r = S.feed();
    if (!r.ok) return toast(r.msg);
    pet.play([['eat', 3.6], ['satisfied', 3.2]], S.status());
    refreshHud();
  };
  $('btnRing').onclick = () => {
    const r = S.ring();
    if (!r.ok) return toast(r.msg);
    pet.play([['bell', 3.8], ['happy', 2.8]], S.status());
    refreshHud();
  };

  // ================= 答题 =================
  function pickQuestions(subject, n) {
    const all = QUESTIONS.filter((q) => q.s === subject);
    const fresh = shuffle(all.filter((q) => !S.s.correct[q.id]));
    const done = shuffle(all.filter((q) => S.s.correct[q.id]));
    return fresh.concat(done).slice(0, n);   // 优先抽还没答对过的题
  }

  function runQuiz(title, qs, onDone) {
    const results = [];
    let i = 0;
    function show() {
      const q = qs[i], sub = SUBJECTS[q.s];
      const opts = shuffle(q.o.map((text, k) => ({ text: text, ok: k === 0 })));
      openSheet(
        '<div class="qhead"><span class="tag" style="background:' + sub.color + '">' + sub.name + '</span>' +
        '<span>' + title + '</span><span class="grow"></span><span>第 ' + (i + 1) + ' / ' + qs.length + ' 题</span></div>' +
        '<div class="qtext"></div><div class="opts"></div><div id="after"></div>');
      sheet.querySelector('.qtext').textContent = q.q;
      const box = sheet.querySelector('.opts');
      opts.forEach((o, k) => {
        const b = document.createElement('button');
        b.textContent = 'ABCD'[k] + '.  ' + o.text;
        b.onclick = () => {
          box.querySelectorAll('button').forEach((x, j) => { x.disabled = true; if (opts[j].ok) x.classList.add('right'); });
          if (!o.ok) b.classList.add('wrong');
          results.push({ id: q.id, ok: o.ok });
          const last = i === qs.length - 1;
          $('after').innerHTML = '<div class="explain"><b class="' + (o.ok ? 'ok">答对了！' : 'no">答错了，没关系，看看解析：') + '</b><span></span></div>' +
            '<div class="foot"><button class="pri" id="next">' + (last ? '看结果' : '下一题') + '</button></div>';
          $('after').querySelector('span').textContent = q.e;
          $('next').onclick = () => { if (last) onDone(results); else { i++; show(); } };
          sheet.scrollTop = sheet.scrollHeight;
        };
        box.appendChild(b);
      });
    }
    show();
  }

  function openStudy() {
    let html = '<h2>今天学什么？</h2><div class="sub">每轮 5 题。答对 1 题得 1 份鸟粮，答对 3 题再得 1 张探险票，答对 4 题再得 1 个铃铛。</div><div class="grid2">';
    Object.keys(SUBJECTS).forEach((k) => {
      const all = QUESTIONS.filter((q) => q.s === k), ok = all.filter((q) => S.s.correct[q.id]).length;
      html += '<button class="subj" data-s="' + k + '" style="border-left-color:' + SUBJECTS[k].color + '"><b>' + SUBJECTS[k].name + '</b><small>已掌握 ' + ok + ' / ' + all.length + '</small></button>';
    });
    html += '</div><div class="foot"><button id="close">回小屋</button></div>';
    openSheet(html);
    $('close').onclick = closeSheet;
    sheet.querySelectorAll('.subj').forEach((b) => { b.onclick = () => startRound(b.dataset.s); });
  }

  function startRound(subject) {
    runQuiz('练习', pickQuestions(subject, 5), (results) => {
      const r = S.finishQuiz(results);
      let html = '<h2>这一轮答对了 ' + r.right + ' / ' + results.length + ' 题</h2><div class="rewards">';
      if (r.food) html += '<span>🌾 鸟粮 +' + r.food + '</span>';
      if (r.ticket) html += '<span>🎫 探险票 +1</span>';
      if (r.bell) html += '<span>🔔 铃铛 +1</span>';
      if (!r.food) html += '<span>这次没有奖励，再试一次吧</span>';
      html += '</div><div class="note">' + (r.right < RULES.ticketAt ? '答对 ' + RULES.ticketAt + ' 题就能拿到探险票，加油！' : r.right < RULES.bellAt ? '再多答对 1 题就能拿到铃铛。' : '太棒了，奖励全部拿到！') + '</div>' +
        '<div class="foot"><button id="home">回小屋</button><button class="pri" id="again">再来一轮</button></div>';
      openSheet(html);
      $('home').onclick = () => { closeSheet(); if (r.right > 0 && S.status() !== 'coma') pet.play([['happy', 2.6]], S.status()); };
      $('again').onclick = openStudy;
      refreshHud();
    });
  }
  $('btnStudy').onclick = openStudy;

  // ================= 抢救 =================
  $('btnRescue').onclick = () => {
    const subs = shuffle(Object.keys(SUBJECTS)).slice(0, 3);      // 3 个不同科目各 1 题
    const qs = subs.map((s) => shuffle(QUESTIONS.filter((q) => q.s === s))[0]);
    runQuiz('抢救宝石', qs, (results) => {
      const ok = S.finishRescue(results), right = results.filter((r) => r.ok).length;
      openSheet(ok
        ? '<h2>宝石醒过来了！</h2><div class="note">答对了 ' + right + ' 题，宝石的饱腹度恢复到 ' + RULES.reviveTo + '。记得按时喂它哦。</div><div class="foot"><button class="pri" id="ok">好的</button></div>'
        : '<h2>还差一点</h2><div class="note">答对了 ' + right + ' 题，要答对至少 2 题才能唤醒宝石。再试一次吧。</div><div class="foot"><button class="pri" id="ok">再试一次</button></div>');
      $('ok').onclick = () => { closeSheet(); if (ok) { pet.play([['happy', 2.8]], S.status()); } else { $('btnRescue').onclick(); } };
      refreshHud();
    });
  };

  // ================= 装扮：羽毛、帽子、眼镜、围巾、小屋 =================
  const TABS = [['skin', '羽毛'], ['hat', '帽子'], ['glasses', '眼镜'], ['neck', '围巾'], ['house', '小屋']];
  let tab = 'hat', trying = null;   // trying：正在试穿、还没买的东西 {kind:'item'|'house', id, slot, name, price}

  /** 把宝石和小屋摆成"已经拥有的 + 正在试的"样子 */
  function applyLook() {
    const outfit = Object.assign({}, S.s.outfit);
    if (trying && trying.kind === 'item') outfit[trying.slot] = trying.id;
    pet.setOutfit(outfit);
    buildHouse(trying && trying.kind === 'house' ? trying.id : S.s.house);
  }

  function openWardrobe() {
    let html = '<h2>装扮</h2><div class="sub">💰 金币 ' + S.s.coins + '　·　没买的可以先点一下试穿。拖动宝石可以转着看。</div><div class="tabs">';
    TABS.forEach((t) => { html += '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; });
    html += '</div><div class="skins">';
    const card = (attrs, cls, icon, name, note) => '<button ' + attrs + ' class="' + cls + '">' + icon + name + '<small>' + note + '</small></button>';
    if (tab === 'skin') {
      Object.keys(Baoshi3D.PALETTES).forEach((k) => {
        const p = Baoshi3D.PALETTES[k], open = S.skinUnlocked(k), on = S.s.palette === k;
        html += card('data-skin="' + k + '"' + (open ? '' : ' disabled'), on ? 'on' : '', '<i style="background:' + hex(p.wing) + '"></i>', p.name, open ? (on ? '使用中' : '点击换上') : S.skinLevel(k) + ' 级解锁');
      });
    } else if (tab === 'house') {
      Object.keys(HOUSES).forEach((k) => {
        const h = HOUSES[k], own = !!S.s.houses[k], on = S.s.house === k, tr = trying && trying.kind === 'house' && trying.id === k;
        html += card('data-house="' + k + '"', on && !trying ? 'on' : tr ? 'try' : '', '<em>' + h.icon + '</em>', h.name, own ? (on ? '使用中' : '点击换上') : '💰 ' + h.price);
      });
    } else {
      const none = !S.s.outfit[tab] && !trying;
      html += card('data-item=""', none ? 'on' : '', '<em>🚫</em>', '不戴', none ? '现在这样' : '点击取下');
      Baoshi3D.ITEMS.filter((it) => it.slot === tab).forEach((it) => {
        const own = !!S.s.owned[it.id], on = S.s.outfit[tab] === it.id, tr = trying && trying.kind === 'item' && trying.id === it.id;
        html += card('data-item="' + it.id + '"', on && !trying ? 'on' : tr ? 'try' : '', '<em>' + it.icon + '</em>', it.name, own ? (on ? '穿戴中' : '点击换上') : '💰 ' + it.price);
      });
    }
    html += '</div>';
    if (trying) html += '<div class="buybar"><span>正在试：<b>' + trying.name + '</b></span><button class="pri" id="buy">买下（💰 ' + trying.price + '）</button></div>';
    html += '<div class="foot"><button class="pri" id="close">好了</button></div>';
    openSheet(html);
    $('modal').classList.add('dock');   // 靠边显示，不挡住宝石
    applyLook();

    $('close').onclick = () => { trying = null; applyLook(); closeSheet(); refreshHud(); };
    sheet.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; trying = null; openWardrobe(); }; });
    sheet.querySelectorAll('[data-skin]').forEach((b) => { b.onclick = () => { S.s.palette = b.dataset.skin; S.save(); pet.setPalette(b.dataset.skin); openWardrobe(); }; });
    sheet.querySelectorAll('[data-item]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.item, it = Baoshi3D.ITEMS.filter((x) => x.id === id)[0];
        if (!id || S.s.owned[id]) { trying = null; S.wear(tab, id); }
        else trying = { kind: 'item', id: id, slot: tab, name: it.name, price: it.price };
        openWardrobe();
      };
    });
    sheet.querySelectorAll('[data-house]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.house;
        if (S.s.houses[id]) { trying = null; S.useHouse(id); }
        else trying = { kind: 'house', id: id, name: HOUSES[id].name, price: HOUSES[id].price };
        openWardrobe();
      };
    });
    if (trying) $('buy').onclick = () => {
      const t = trying, r = S.buy(t.kind === 'house' ? 'houses' : 'owned', t.id, t.price);
      if (!r.ok) return toast(r.msg, 3000);
      if (t.kind === 'house') S.useHouse(t.id); else S.wear(t.slot, t.id);
      trying = null;
      toast('买到了：' + t.name + '！');
      if (S.status() !== 'coma') pet.play([['happy', 2.2]], S.status());
      openWardrobe(); refreshHud();
    };
  }
  $('btnSkin').onclick = openWardrobe;

  // 在小屋里左右拖动，宝石跟着转身
  let spinDrag = null;
  cv.addEventListener('pointerdown', (e) => { if (view === 'home') spinDrag = e.clientX; });
  addEventListener('pointermove', (e) => {
    if (spinDrag === null || view !== 'home') return;
    const dx = e.clientX - spinDrag; spinDrag = e.clientX;
    home.spin += dx * 0.012; home.spinV = dx * 0.012 * 60;
  });
  addEventListener('pointerup', () => { spinDrag = null; });
  addEventListener('pointercancel', () => { spinDrag = null; });

  // ================= 关卡选择 =================
  function openMap() {
    let html = '<h2>森林探险</h2><div class="sub">🎫 探险票 ' + S.s.tickets + ' 张　·　今天还能闯 ' + S.runsLeft() + ' 关　·　进一关用 1 张票，同一关失败重来不再扣票。</div><div class="levels">';
    LEVELS.forEach((l, i) => {
      const open = S.unlocked(i, LEVEL_IDS), st = S.s.stars[l.id] || 0;
      html += '<button data-i="' + i + '" class="' + (open ? '' : 'locked') + '"><b>' + (open ? i + 1 : '🔒') + '</b><small>' + l.name + '</small><span class="st">' + starsHtml(st) + '</span></button>';
    });
    html += '</div><div class="foot"><button id="close">回小屋</button></div>';
    openSheet(html);
    $('close').onclick = closeSheet;
    sheet.querySelectorAll('.levels button').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.i, r = S.enterLevel(i, LEVEL_IDS);
        if (!r.ok) return toast(r.msg, 3200);
        closeSheet(); startLevel(i);
      };
    });
  }
  $('btnMap').onclick = openMap;

  // ================= 闯关场景 =================
  let lv = null;
  const K = (x, y) => x + ',' + y;

  function startLevel(index) {
    const def = LEVELS[index], pz = new Puzzle(def.map), L = pz.L, sc = new T.Scene();
    const cx = (L.w - 1) / 2, cz = (L.h - 1) / 2;
    lights(sc, cx, cz, Math.max(L.w, L.h) + 2, 0.7, 0.42);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    cam.position.set(cx + 10, 8.5, cz + 10); cam.lookAt(cx, -0.4, cz);

    const tiles = {}, tops = [];
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const t = L.cells[y][x];
      if (t === Puzzle.VOID) continue;
      const g = new T.Group(); g.position.set(x, 0, y); sc.add(g);
      const depth = 1.4 + ((x * 7 + y * 13) % 5) * 0.45, light = (x + y) % 2 === 0;
      block(g, new T.BoxGeometry(1, depth, 1), t === Puzzle.CRACK ? 0x9c6a52 : 0xb5564a, 0, -0.18 - depth / 2, 0);
      const top = block(g, new T.BoxGeometry(1, 0.18, 1), t === Puzzle.CRACK ? 0xf2d6a2 : (light ? 0xe08568 : 0xd4745a), 0, -0.09, 0);
      if (t === Puzzle.CRACK) { // 裂纹
        [[0.02, 0.7, 0.5, 0.1], [-0.2, 0.45, -0.7, -0.08], [0.24, 0.4, -0.3, 0.2]].forEach((c) => {
          const m = block(g, new T.BoxGeometry(c[1], 0.012, 0.045), 0x6b4a3a, c[0], 0.006, c[3]); m.rotation.y = c[2]; m.castShadow = false;
        });
      }
      if (t === Puzzle.WALL) {
        block(g, new T.BoxGeometry(0.62, 1.1, 0.62), 0x1f4f63, 0, 0.55, 0);
        block(g, new T.BoxGeometry(0.78, 0.1, 0.78), 0xf2c14e, 0, 1.15, 0);
        block(g, new T.ConeGeometry(0.46, 0.6, 4), 0xf2c14e, 0, 1.5, 0).rotation.y = Math.PI / 4;
      } else { top.userData = { x: x, y: y }; tops.push(top); tiles[K(x, y)] = g; }
    }
    // 压力板：黄色圆盘，被压住时会沉下去
    const plates = L.plates.map((p) => block(sc, new T.CylinderGeometry(0.34, 0.38, 0.07, 10), 0xf2c14e, p[0], 0.035, p[1]));
    // 闸门：一排青色的栅栏，打开时沉进地里
    const gates = L.gates.map((p) => {
      const g = new T.Group(); g.position.set(p[0], 0, p[1]); sc.add(g);
      [-0.3, 0, 0.3].forEach((o) => { block(g, new T.BoxGeometry(0.13, 0.85, 0.13), 0x2f8f9a, o, 0.425, 0); block(g, new T.BoxGeometry(0.13, 0.85, 0.13), 0x2f8f9a, 0, 0.425, o); });
      block(g, new T.BoxGeometry(0.8, 0.1, 0.8), 0x1f6f7a, 0, 0.88, 0);
      return g;
    });
    // 鸟巢：宝石没拿齐时是灰色的，拿齐后变成金色
    const nestPad = block(sc, new T.CylinderGeometry(0.4, 0.4, 0.05, 8), 0xf6e3b4, L.nest[0], 0.025, L.nest[1]);
    const nestRing = block(sc, new T.TorusGeometry(0.27, 0.09, 4, 8), 0xc99a6a, L.nest[0], 0.11, L.nest[1]);
    nestRing.rotation.x = Math.PI / 2;
    const gems = L.gems.map((g) => {
      const m = block(sc, new T.OctahedronGeometry(0.16, 0), new T.MeshLambertMaterial({ color: 0xbff6ff, emissive: 0x4fc8e8 }), g[0], 0.42, g[1]);
      m.scale.y = 1.4; return m;
    });
    const crates = L.crates.map(() => {
      const g = new T.Group(); sc.add(g);
      block(g, new T.BoxGeometry(0.68, 0.68, 0.68), 0xe9b44c, 0, 0, 0);
      block(g, new T.BoxGeometry(0.72, 0.1, 0.72), 0xb9822c, 0, 0.3, 0);
      block(g, new T.BoxGeometry(0.72, 0.1, 0.72), 0xb9822c, 0, -0.3, 0);
      return g;
    });
    const bird = new Baoshi3D({ boredAfter: 0, palette: S.s.palette });
    bird.setOutfit(S.s.outfit);
    bird.group.scale.setScalar(0.8); sc.add(bird.group);

    lv = { index: index, def: def, pz: pz, L: L, scene: sc, camera: cam, tiles: tiles, tops: tops, gems: gems, crates: crates,
      bird: bird, anim: null, drops: [], face: Math.PI / 4, done: false, cx: cx, cz: cz,
      plates: plates, gates: gates, nestPad: nestPad, nestRing: nestRing };
    $('lvName').textContent = '第 ' + (index + 1) + ' 关 · ' + def.name;
    $('lvPar').textContent = '（三星 ≤ ' + def.par + ' 步）';
    $('lvHint').style.opacity = 1;
    $('lvHint').textContent = def.hint;
    syncLevel();
    setView('level');
  }

  /** 把画面摆成和当前局面完全一致（每步动画结束、撤销、重来时调用） */
  function syncLevel() {
    const st = lv.pz.state;
    lv.bird.group.position.set(st.x, 0, st.y);
    lv.bird.group.rotation.y = lv.face;
    lv.bird.override = null;
    st.crates.forEach((c, i) => {
      const g = lv.crates[i];
      g.position.set(c.x, c.fell ? -0.34 : 0.34, c.y);
      g.scale.set(c.fell ? 1.42 : 1, 1, c.fell ? 1.42 : 1);
    });
    Object.keys(lv.tiles).forEach((k) => {
      const g = lv.tiles[k], dropping = lv.drops.indexOf(g) >= 0;
      if (!st.broken[k]) { g.visible = true; g.position.y = 0; const d = lv.drops.indexOf(g); if (d >= 0) lv.drops.splice(d, 1); }
      else if (!dropping) g.visible = false;
    });
    lv.gems.forEach((m, i) => { m.visible = !st.got[i]; });
    const open = lv.pz.nestOpen();
    lv.nestPad.material.color.setHex(open ? 0xf6e3b4 : 0xa9adb6);
    lv.nestRing.material.color.setHex(open ? 0xf2a93b : 0x7d8494);
    $('lvGems').textContent = lv.pz.gemsGot();
    $('lvSteps').textContent = st.steps;
  }

  function tryMove(dx, dy) {
    if (!lv || lv.anim || lv.done || isOpen()) return;
    lv.face = Math.atan2(dx, dy);
    lv.bird.group.rotation.y = lv.face;
    const before = lv.pz.state, ev = lv.pz.move(dx, dy);
    lv.anim = ev ? { t: 0, dur: 0.3, ev: ev } : { t: 0, dur: 0.22, bump: true };
    if (ev) { $('lvSteps').textContent = lv.pz.state.steps; if (before.steps === 4) $('lvHint').style.opacity = 0; }
  }

  function stepLevel(dt, now) {
    const a = lv.anim;
    if (a) {
      a.t += dt / a.dur;
      const k = Math.min(1, a.t), arc = Math.sin(k * Math.PI);
      if (a.bump) {
        lv.bird.override = { sy: 1 - arc * 0.1, sx: 1 + arc * 0.06, wingL: 12 + arc * 30, wingR: 12 + arc * 30 };
      } else {
        const e = a.ev;
        lv.bird.group.position.x = e.from[0] + (e.to[0] - e.from[0]) * k;
        lv.bird.group.position.z = e.from[1] + (e.to[1] - e.from[1]) * k;
        lv.bird.override = { y: arc * 0.6, wingL: 12 + arc * 70, wingR: 12 + arc * 70, sy: 1 + arc * 0.08, tail: -arc * 20 };
        if (e.push) {
          const g = lv.crates[e.push.i], p = e.push;
          g.position.x = p.from[0] + (p.to[0] - p.from[0]) * k;
          g.position.z = p.from[1] + (p.to[1] - p.from[1]) * k;
          if (p.fell) g.position.y = 0.34 - Math.max(0, k - 0.55) / 0.45 * 0.68;
        }
      }
      if (a.t >= 1) {
        lv.anim = null;
        if (!a.bump) {
          const e = a.ev;
          if (e.collapse) { const g = lv.tiles[K(e.collapse[0], e.collapse[1])]; g.userData.v = 0; lv.drops.push(g); }
          syncLevel();
          if (e.win) winLevel();
          else if (e.nestOpen) toast('宝石拿齐了，鸟巢打开啦！');
          else if (e.gates !== undefined) toast(e.gates ? '闸门打开了' : '闸门关上了', 1400);
          else if (e.to[0] === lv.L.nest[0] && e.to[1] === lv.L.nest[1]) toast('还有宝石没拿，鸟巢还没打开。');
        } else lv.bird.override = null;
      }
    }
    // 闸门升降、压力板下沉
    const gk = 1 - Math.exp(-dt * 10), gOpen = lv.pz.gatesOpen(), st = lv.pz.state;
    lv.gates.forEach((g) => { g.position.y += ((gOpen ? -0.9 : 0) - g.position.y) * gk; });
    lv.plates.forEach((m, i) => {
      const p = lv.L.plates[i], down = (st.x === p[0] && st.y === p[1]) || st.crates.some((c) => !c.fell && c.x === p[0] && c.y === p[1]);
      m.position.y += ((down ? -0.005 : 0.035) - m.position.y) * gk;
    });
    for (let i = lv.drops.length - 1; i >= 0; i--) { // 塌掉的地砖往下掉
      const g = lv.drops[i];
      g.userData.v += dt * 14; g.position.y -= g.userData.v * dt;
      if (g.position.y < -9) { g.visible = false; lv.drops.splice(i, 1); }
    }
    lv.gems.forEach((m, i) => { m.rotation.y = now * 1.6 + i; m.position.y = 0.42 + Math.sin(now * 2.4 + i) * 0.05; });
    lv.bird.update(now, dt);
  }

  function winLevel() {
    lv.done = true;
    lv.face = Math.PI / 4; lv.bird.group.rotation.y = lv.face;
    lv.bird.setState('happy');
    const st = lv.pz.state, got = lv.pz.gemsGot();
    const stars = st.steps <= lv.def.par ? 3 : st.steps <= lv.def.par2 ? 2 : 1;
    const r = S.clearLevel(lv.index, LEVEL_IDS, stars);
    const hasNext = lv.index + 1 < LEVELS.length;
    setTimeout(() => {
      let html = '<h2>通关啦！</h2><div class="bigstars">' + starsHtml(stars) + '</div>' +
        '<div class="note">用了 ' + st.steps + ' 步。三星要 ' + lv.def.par + ' 步以内，两星要 ' + lv.def.par2 + ' 步以内。' + (stars < 3 ? '再走一次，试试更少的步数？' : '走得太漂亮了！') + '</div>' +
        '<div class="rewards"><span>经验 +' + r.xp + '</span><span>💰 金币 +' + r.coins + '</span></div>';
      if (!r.first) html += '<div class="note">这一关以前通过了，奖励减半。</div>';
      r.levelUps.forEach((l) => { html += '<div class="note"><b>升级了！宝石现在是 ' + l + ' 级。</b></div>'; });
      r.skins.forEach((k) => { html += '<div class="note"><b>解锁了新羽毛：' + Baoshi3D.PALETTES[k].name + '！</b>回小屋点"羽毛"就能换上。</div>'; });
      html += '<div class="foot"><button id="back">回小屋</button><button id="replay">再走一次</button>' + (hasNext ? '<button class="pri" id="next">下一关</button>' : '') + '</div>';
      openSheet(html);
      $('back').onclick = () => { closeSheet(); exitLevel(); };
      $('replay').onclick = () => { closeSheet(); restartLevel(); };  // 同一次进入，不再扣票
      if (hasNext) $('next').onclick = () => {
        const e = S.enterLevel(lv.index + 1, LEVEL_IDS);
        if (!e.ok) return toast(e.msg, 3200);
        closeSheet(); startLevel(lv.index + 1);
      };
    }, 1100);
  }

  function restartLevel() { lv.pz.reset(); lv.anim = null; lv.drops = []; lv.done = false; lv.face = Math.PI / 4; lv.bird.setState('idle'); syncLevel(); }
  function exitLevel() { lv = null; setView('home'); refreshHud(); syncPet(); }
  $('btnUndo').onclick = () => { if (lv && !lv.anim && !lv.done && lv.pz.undo()) { lv.drops = []; syncLevel(); } };
  $('btnRestart').onclick = () => { if (lv && !lv.done) restartLevel(); };
  $('btnExit').onclick = () => { if (lv) exitLevel(); };

  // ----- 闯关的操作：方向键、斜向滑动、点相邻格子 -----
  addEventListener('keydown', (e) => {
    if (view !== 'level') return;
    const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (m) { e.preventDefault(); tryMove(m[0], m[1]); }
    if (e.key === 'z' || e.key === 'Backspace') $('btnUndo').onclick();
  });
  const ray = new T.Raycaster(), ptr = new T.Vector2();
  let down = null;
  cv.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', (e) => {
    if (!down || view !== 'level' || !lv) { down = null; return; }
    const dx = e.clientX - down[0], dy = e.clientY - down[1];
    down = null;
    if (Math.hypot(dx, dy) > 24) { // 屏幕上的四个斜方向对应棋盘的四个方向
      if (dx > 0 && dy < 0) tryMove(0, -1); else if (dx > 0) tryMove(1, 0);
      else if (dy > 0) tryMove(0, 1); else tryMove(-1, 0);
      return;
    }
    ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ptr, lv.camera);
    const hit = ray.intersectObjects(lv.tops.filter((t) => t.parent.visible))[0];
    if (!hit) return;
    const tx = hit.object.userData.x - lv.pz.state.x, ty = hit.object.userData.y - lv.pz.state.y;
    if (tx !== 0 && ty === 0) tryMove(Math.sign(tx), 0);
    else if (ty !== 0 && tx === 0) tryMove(0, Math.sign(ty));
  });

  // ================= 画面尺寸和主循环 =================
  function resize() {
    const w = innerWidth, h = innerHeight, a = w / h;
    renderer.setSize(w, h);
    let d = Math.max(1.75, 2.3 / a);
    Object.assign(home.camera, { left: -d * a, right: d * a, top: d, bottom: -d }); home.camera.updateProjectionMatrix();
    if (lv) {
      const span = (lv.L.w + lv.L.h) / 2;
      d = Math.max(span * 0.5 + 2.2, (span * 0.72 + 1.2) / a);
      Object.assign(lv.camera, { left: -d * a, right: d * a, top: d, bottom: -d }); lv.camera.updateProjectionMatrix();
    }
  }
  addEventListener('resize', resize);

  let sim = 0, last = 0, sinceTick = 99;
  function advance(dt) {
    sim += dt; sinceTick += dt;
    if (sinceTick > 5) {  // 每隔几秒按真实时间结算一次饱腹度并存档
      sinceTick = 0;
      const before = S.s.satiety; S.tick(Date.now());
      if (S.s.satiety !== before) S.save();
      if (view === 'home') { refreshHud(); syncPet(); }
    }
    if (view === 'level' && lv) {
      stepLevel(dt, sim);
      cv.style.filter = '';
      renderer.render(lv.scene, lv.camera);
    } else {
      if (spinDrag === null) { home.spin += home.spinV * dt; home.spinV *= Math.exp(-dt * 4); }  // 松手后慢慢停下
      pet.group.rotation.y = 0.16 + home.spin;
      if (home.decor) home.decor.children.forEach((m) => { if (m.userData.star !== undefined) m.rotation.y = sim * 1.2 + m.userData.star; });
      pet.update(sim, dt);
      cv.style.filter = pet.pose.sat < 0.99 ? 'saturate(' + pet.pose.sat.toFixed(2) + ')' : '';
      renderer.render(home.scene, home.camera);
    }
  }
  function frame(ms) {
    const dt = Math.min(0.05, (ms - last) / 1000 || 0.016); last = ms;
    advance(dt);
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { sinceTick = 99; } else S.save(); });
  addEventListener('pagehide', () => S.save());

  pet.setState(S.status());
  refreshHud(); resize();
  requestAnimationFrame(frame);

  // 调试和测试用
  window.__game = { S: S, pet: pet, step: (sec) => { for (let i = 0; i < sec * 60; i++) advance(1 / 60); }, move: tryMove,
    level: () => lv, startLevel: startLevel, home: home, refresh: () => { refreshHud(); syncPet(); } };
})();
