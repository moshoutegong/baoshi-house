/*
 * 宝石 —— 低多边形 3D 角色（小屋和闯关共用）
 * 模型由头、身体、翅膀、尾巴、脚、眼睛、喙等部件组成，
 * 每一帧根据"姿势参数"摆放，所有动作都是连续的。
 * 用法：
 *   const pet = new Baoshi3D();  scene.add(pet.group);
 *   每帧调用 pet.update(秒, 间隔秒);  切换形态用 pet.setState('happy')
 * 依赖：全局的 THREE（three.js r128）
 */
(function (global) {
  'use strict';
  const T = global.THREE;
  const R = Math.PI / 180;
  const sin = Math.sin, cos = Math.cos, abs = Math.abs, PI = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const bump = (t, a, b) => (t < a || t > b) ? 0 : sin(((t - a) / (b - a)) * PI);

  // 羽毛配色。换肤只需要换这一组颜色。
  const PALETTES = {
    blue:   { name: '灰蓝',   hood: 0xc2c5cd, hoodLow: 0xa9adb7, body: 0xc3d1e8, bodyLow: 0xa3b8da, wing: 0x7d99c0, wingLow: 0x5f7ea9, tail: 0x56749f },
    mint:   { name: '薄荷绿', hood: 0x9eaaa4, hoodLow: 0x88968f, body: 0xbfe9d5, bodyLow: 0x86d0b0, wing: 0x4fae8c, wingLow: 0x2f8767, tail: 0x379272 },
    sakura: { name: '樱花粉', hood: 0xb0a2a8, hoodLow: 0x9a8b92, body: 0xf8d3dc, bodyLow: 0xeea4b8, wing: 0xdd7998, wingLow: 0xb24f70, tail: 0xc05c7c },
    sunset: { name: '晚霞橙', hood: 0xb0a397, hoodLow: 0x998c80, body: 0xfbdcb6, bodyLow: 0xf5b577, wing: 0xe98a3f, wingLow: 0xbb6521, tail: 0xc9722c },
    star:   { name: '星空紫', hood: 0xa29eb6, hoodLow: 0x8b87a1, body: 0xd4cbf2, bodyLow: 0xa696e0, wing: 0x7560c4, wingLow: 0x533f9c, tail: 0x5f4bab }
  };
  const FACE = new T.Color(0xf7f2e9), BEAK = new T.Color(0xf3a63b), BEAK_DARK = new T.Color(0x4b4645);

  // 默认姿势（角度单位：度）
  const DEF = {
    y: 0, jx: 0,                 // 离地高度、左右抖动
    yaw: 0, roll: 0, pitch: 0,   // 整体转向、左右倾斜、前倾
    lie: 0,                      // 1 = 侧躺
    sx: 1, sy: 1,                // 压扁/拉伸
    headRoll: 0, headPitch: 0, headYaw: 0,
    wingL: 7, wingR: 7, hug: 0,  // 翅膀外展角度、向前合抱
    tail: 0, tailYaw: 0,
    eyeL: 1, eyeR: 1, smileL: 0, smileR: 0, eyeSize: 1,
    beak: 0, blush: 1, sat: 1
  };

  // 各个状态的姿势函数。t 是进入该状态后经过的秒数。
  const STATES = {
    idle(t) {
      const p = {};
      const cycle = t % 6, dir = Math.floor(t / 6) % 2 ? 1 : -1;
      const tilt = bump(cycle, 3, 4.6);            // 偶尔歪头
      p.headRoll = dir * 11 * tilt;
      p.headYaw = dir * 20 * tilt;
      const sh = t % 11;                            // 偶尔抖抖羽毛
      if (sh > 8 && sh < 8.55) { p.roll = sin(t * 48) * 3; p.wingL = p.wingR = 22; p.sx = 1.05; }
      p.tailYaw = sin(t * 1.3) * 8;
      return p;
    },
    hungry1(t) { // 60：有点饿，抬头想鸟粮
      return { headPitch: -12 + sin(t * 1.4) * 3, headYaw: 22, headRoll: 5, eyeL: 0.9, eyeR: 0.9,
        beak: bump(t % 2.4, 0.2, 0.6) * 0.8, blush: 0.8 };
    },
    hungry2(t) { // 40：非常饿，垂头、冒汗
      return { headPitch: 17 + sin(t * 1.1) * 3, headRoll: 5, sy: 0.97, eyeL: 0.6, eyeR: 0.6,
        wingL: 13, wingR: 13, tail: 14, roll: sin(t * 0.9) * 2, blush: 0.5, sat: 0.92 };
    },
    hungry3(t) { // 20：快饿死了，发抖、站不稳
      return { jx: sin(t * 31) * 0.006, headPitch: 27 + sin(t * 0.8) * 2, headRoll: 9, pitch: 6,
        sx: 1.03, sy: 0.93, eyeL: 0.38, eyeR: 0.38, wingL: 20, wingR: 20, tail: 22,
        roll: sin(t * 0.9) * 4, blush: 0.2, sat: 0.82 };
    },
    faint(t) { // 10：饿晕了，闭眼转圈星星、摇摇晃晃
      return { roll: sin(t * 1.7) * 10, headRoll: sin(t * 1.7 + 1.1) * 13, headPitch: 10,
        headYaw: sin(t * 0.85) * 12, sy: 0.93, sx: 1.03, eyeL: 0.12, eyeR: 0.12, beak: 0.45,
        wingL: 26 + sin(t * 1.7) * 8, wingR: 26 - sin(t * 1.7) * 8, tail: 18, blush: 0.15, sat: 0.72 };
    },
    dying(t) { // 5：奄奄一息，瘫坐、眼睛快睁不开
      const flutter = bump(t % 3.6, 2.6, 3.3) * 0.3;
      return { jx: sin(t * 27) * 0.004, sx: 1.1, sy: 0.8 + sin(t * 1.1) * 0.02,
        headPitch: 36, headRoll: 13, eyeL: 0.05 + flutter, eyeR: 0.05 + flutter,
        wingL: 32, wingR: 32, tail: 28, beak: 0.25, blush: 0, sat: 0.58 };
    },
    coma(t) { // 0：昏迷不醒，侧躺
      return { lie: 1, sy: 1 + sin(t * 0.9) * 0.012, eyeL: 0.05, eyeR: 0.05, headRoll: -8,
        wingL: 16, wingR: 4, beak: 0.2, blush: 0, sat: 0.4 };
    },
    eat(t) { // 转身低头到碗里啄，抬头嚼几下，再啄
      const ph = (t % 1.1) / 1.1;
      const down = ph < 0.42 ? sin((ph / 0.42) * PI) : 0;
      const chew = ph >= 0.42 ? abs(sin((ph - 0.42) * 30)) : 0;
      return { yaw: -52, pitch: 10 + down * 36, headPitch: 4 + down * 30,
        beak: down > 0.75 ? 0.6 : chew * 0.7, tail: -down * 20, wingL: 7 + down * 8, wingR: 7 + down * 8 };
    },
    satisfied(t) { // 抱着爱心轻轻晃
      return { roll: sin(t * 2.4) * 6, headRoll: sin(t * 2.4 + 0.7) * 7, hug: 1, wingL: -16, wingR: -16,
        smileL: 1, smileR: 1, sy: 0.97, tailYaw: sin(t * 2.4) * 12 };
    },
    bored(t) { // 坐在树枝上轻轻摇，偶尔打哈欠
      const yawn = bump(t % 6, 4.2, 5.4);
      return { y: 0.13, roll: sin(t * 1.25) * 5, sy: 0.94, sx: 1.03,
        headRoll: sin(t * 0.7) * 6, headYaw: sin(t * 0.45) * 26, headPitch: 6 - yawn * 22,
        eyeL: 0.6 * (1 - yawn) + 0.05, eyeR: 0.6 * (1 - yawn) + 0.05, beak: yawn,
        tailYaw: sin(t * 1.25 + 1) * 14, blush: 0.7 };
    },
    bell(t) { // 铃铛摇摆，宝石跟着晃
      const sw = sin(t * 5);
      return { roll: sw * 8, headRoll: sw * 9, headYaw: 24, headPitch: -12,
        y: abs(sin(t * 5)) * 0.03, wingR: 70 + sw * 24, wingL: 14 + sw * 8,
        beak: 0.4 + sw * 0.35, tailYaw: sw * 16 };
    },
    happy(t) { // 眨眼、挥翅膀、蹦跳
      const j = abs(sin(t * 5.6)), land = 1 - j;
      return { y: j * 0.16, sx: 1 + land * land * 0.07, sy: 1 - land * land * 0.08,
        roll: sin(t * 2.8) * 6, headRoll: sin(t * 2.8 + 0.5) * 6,
        wingL: 112 + sin(t * 17) * 28, wingR: 26 + sin(t * 8) * 16,
        smileR: 1, beak: 0.8, tailYaw: sin(t * 11) * 14 };
    }
  };

  const INFO = {
    idle:      { label: '悠闲',     tip: '宝石在小屋里东张西望。', props: [] },
    hungry1:   { label: '有点饿',   tip: '宝石有点饿了，想吃鸟粮。', props: ['bubble'] },
    hungry2:   { label: '非常饿',   tip: '宝石非常饿，头都抬不起来了。', props: ['bubble', 'sweat'] },
    hungry3:   { label: '快饿死了', tip: '宝石饿得直发抖，快喂喂它！', props: ['bubble', 'sweat'] },
    faint:     { label: '饿晕了',   tip: '宝石饿得头晕眼花，站都站不稳。', props: ['stars'] },
    dying:     { label: '奄奄一息', tip: '宝石瘫坐着，眼睛快睁不开了。', props: [] },
    coma:      { label: '昏迷不醒', tip: '宝石昏过去了，需要答题抢救！', props: [] },
    eat:       { label: '吃东西',   tip: '宝石低头从碗里啄鸟粮。', props: ['bowl'] },
    satisfied: { label: '吃得满足', tip: '吃饱啦，宝石抱着爱心好开心。', props: ['heart'] },
    bored:     { label: '无聊',     tip: '好无聊呀，宝石坐在树枝上晃悠。', props: ['branch'] },
    bell:      { label: '玩铃铛',   tip: '叮铃铃，宝石跟着铃铛一起摇。', props: ['bell', 'notes'] },
    happy:     { label: '开心',     tip: '宝石高兴得又蹦又跳！', props: [] }
  };

  // ---------- 建模小工具 ----------
  function flat(geo) { // 每个三角面独立，得到棱角分明的低多边形效果
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.computeVertexNormals();
    return g;
  }
  // 按每个面的中心位置上色
  function paint(geo, fn) {
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const v = new T.Vector3(), c = new T.Color();
    for (let i = 0; i < pos.count; i++) { // 按顶点上色，颜色之间自然晕开
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      fn(v, c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
  }
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }; // 平滑过渡
  const ball = () => new T.SphereGeometry(1, 72, 48); // 圆润光滑的球体，各部件都由它拉伸而来
  const vcMat = () => new T.MeshLambertMaterial({ vertexColors: true });
  const mat = (c) => new T.MeshLambertMaterial({ color: c });
  function add(parent, geo, material, x, y, z) {
    const m = new T.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = false; // 宝石身上不接收阴影，脸上才不会出现脏脏的暗纹
    parent.add(m);
    return m;
  }
  // 描边：把模型沿表面向外鼓一圈，只画背面，就得到一圈深色的轮廓线
  const lineMat = new T.MeshBasicMaterial({ color: 0x555a66, side: T.BackSide });
  function outline(mesh, t) {
    t = t || 0.015;
    const g = mesh.geometry.clone(), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
    mesh.add(new T.Mesh(g, lineMat));
    return mesh;
  }
  function sprite(draw, size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    draw(cv.getContext('2d'));
    const tex = new T.CanvasTexture(cv);
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(size, size, 1);
    return s;
  }
  const glyph = (ch, color) => (g) => {
    g.font = 'bold 100px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.fillText(ch, 64, 70);
  };

  // ---------- 服饰 ----------
  // slot：hat 戴在头顶，glasses 戴在眼前，neck 围在脖子上
  const ITEMS = [
    { id: 'straw',  slot: 'hat',     name: '草帽',     icon: '👒', price: 30 },
    { id: 'cap',    slot: 'hat',     name: '棒球帽',   icon: '🧢', price: 40 },
    { id: 'party',  slot: 'hat',     name: '派对帽',   icon: '🎉', price: 50 },
    { id: 'crown',  slot: 'hat',     name: '小皇冠',   icon: '👑', price: 120 },
    { id: 'sun',    slot: 'glasses', name: '墨镜',     icon: '🕶️', price: 40 },
    { id: 'round',  slot: 'glasses', name: '圆框眼镜', icon: '👓', price: 40 },
    { id: 'scarf',  slot: 'neck',    name: '红围巾',   icon: '🧣', price: 30 },
    { id: 'bowtie', slot: 'neck',    name: '领结',     icon: '🎀', price: 30 },
    { id: 'collar', slot: 'neck',    name: '铃铛项圈', icon: '🔔', price: 50 }
  ];
  const cyl = (a, b, h, seg) => new T.CylinderGeometry(a, b, h, seg || 32);
  const orb = (r, w, h) => new T.SphereGeometry(r, w || 20, h || 14);

  function makeItem(id, hd) {
    const g = new T.Group();
    const pc = (geo, color, x, y, z, line) => {
      const m = new T.Mesh(geo, mat(color)); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; g.add(m);
      if (line !== false) outline(m, 0.01);
      return m;
    };
    const RED = 0xe2574c, GOLD = 0xf5c33d;
    // 帽子和眼镜的坐标以头的中心为原点；头顶在 y = HY
    if (id === 'straw') {
      pc(cyl(0.37, 0.37, 0.025), 0xf0cf7a, 0, 0.225, 0);
      pc(cyl(0.19, 0.215, 0.15), 0xf0cf7a, 0, 0.3, 0);
      pc(cyl(0.218, 0.218, 0.04), RED, 0, 0.255, 0, false);
      g.rotation.x = -0.1;
    } else if (id === 'cap') {
      const dome = new T.SphereGeometry(1, 36, 14, 0, PI * 2, 0, 1.22);
      dome.scale(hd.HX + 0.02, hd.HY + 0.02, hd.HZ + 0.02);
      pc(dome, RED);
      const brim = pc(orb(1, 24, 10), RED, 0, 0.115, hd.HZ + 0.05); brim.scale.set(0.2, 0.018, 0.17); brim.rotation.x = 0.18;
      pc(orb(0.03), 0xf7f2e9, 0, hd.HY + 0.025, 0, false);
    } else if (id === 'party') {
      pc(new T.ConeGeometry(0.15, 0.34, 28), 0xf08fb0, 0, 0.41, 0);
      pc(cyl(0.152, 0.152, 0.03), GOLD, 0, 0.255, 0, false);
      pc(orb(0.048), GOLD, 0, 0.6, 0);
      g.rotation.z = -0.22;
    } else if (id === 'crown') {
      pc(cyl(0.175, 0.155, 0.09), GOLD, 0, 0.275, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        pc(new T.ConeGeometry(0.042, 0.1, 12), GOLD, sin(a) * 0.14, 0.365, cos(a) * 0.14);
        pc(orb(0.022, 10, 8), i % 2 ? 0x4fc8e8 : RED, sin(a) * 0.168, 0.275, cos(a) * 0.168, false);
      }
      g.rotation.x = -0.08;
    } else if (id === 'sun' || id === 'round') {
      [-1, 1].forEach((s) => {
        let lens;
        if (id === 'sun') { lens = pc(orb(1, 24, 12), 0x23262d, s * 0.178, -0.03, 0.272); lens.scale.set(0.092, 0.075, 0.022); }
        else lens = pc(new T.TorusGeometry(0.078, 0.013, 8, 28), 0x8a5a2b, s * 0.178, -0.03, 0.282, false);
        lens.rotation.y = s * 0.5;
        const arm = pc(new T.BoxGeometry(0.018, 0.018, 0.26), id === 'sun' ? 0x23262d : 0x8a5a2b, s * 0.305, -0.02, 0.1, false);
        arm.rotation.y = s * 0.2;
      });
      pc(new T.BoxGeometry(0.16, 0.02, 0.02), id === 'sun' ? 0x23262d : 0x8a5a2b, 0, -0.012, 0.318, false);
    // 脖子上的东西以身体的原点为准，脖子大约在 y = 0.55
    } else if (id === 'scarf') {
      pc(new T.TorusGeometry(0.275, 0.062, 12, 36), RED, 0, 0.55, 0.01).rotation.x = PI / 2;
      pc(new T.BoxGeometry(0.11, 0.22, 0.05), RED, 0.15, 0.43, 0.3).rotation.z = -0.18;
    } else if (id === 'bowtie') {
      [-1, 1].forEach((s) => { pc(new T.ConeGeometry(0.075, 0.13, 18), RED, s * 0.075, 0.5, 0.335).rotation.z = s * PI / 2; });
      pc(orb(0.036), 0xc23f36, 0, 0.5, 0.345);
    } else if (id === 'collar') {
      pc(new T.TorusGeometry(0.278, 0.028, 10, 36), RED, 0, 0.55, 0.01).rotation.x = PI / 2;
      pc(orb(0.055), GOLD, 0, 0.5, 0.32);
    }
    return g;
  }

  class Baoshi3D {
    constructor(opts) {
      opts = opts || {};
      this.pal = {};
      this.painted = [];
      this.group = new T.Group();
      this._build();
      this._buildProps();

      this.pose = Object.assign({}, DEF);
      this.override = null;      // 外部（闯关）可以直接覆盖部分姿势
      this.queue = []; this.dur = Infinity; this.after = 'idle';
      this.boredAfter = opts.boredAfter == null ? 25 : opts.boredAfter;
      this.onState = opts.onState || null;
      this.nextBlink = 2; this.blinkUntil = 0; this.t = 0; this.clock = 0;
      this.setPalette(opts.palette || 'blue');
      this._enter(opts.state || 'idle');
    }

    _vc(geo, fn) { // 登记一个需要随配色重新上色的模型
      this.painted.push({ geo: geo, fn: fn });
      return geo;
    }

    _build() {
      const P = this.pal, tmp = new T.Color();
      const turn = this.turn = new T.Group(); this.group.add(turn);
      const lean = this.lean = new T.Group(); turn.add(lean);

      // 脚
      const footMat = mat(0x8f8c96);
      [-1, 1].forEach((s) => {
        add(lean, new T.CylinderGeometry(0.032, 0.036, 0.1, 12), footMat, s * 0.13, 0.06, 0.04);
        [-0.5, 0, 0.5].forEach((a) => {
          const toe = add(lean, new T.SphereGeometry(1, 12, 8), footMat, s * 0.13 + a * 0.1, 0.022, 0.15);
          toe.scale.set(0.03, 0.024, 0.085);
          toe.rotation.y = a * 0.7;
        });
      });

      const bend = this.bend = new T.Group(); bend.position.y = 0.22; lean.add(bend);
      const up = this.up = new T.Group(); up.position.y = -0.22; bend.add(up);

      // 身体：蛋形，胸口白色绒毛，肚子由浅蓝过渡到深一点的蓝
      // 比例按原图：身体矮胖，头几乎和身体一样大
      const BX = 0.37, BY = 0.31, BZ = 0.34, BC = 0.33;
      const bodyGeo = ball();
      bodyGeo.scale(BX, BY, BZ);
      this._vc(bodyGeo, (v, c) => {
        const nx = v.x / BX, ny = v.y / BY, nz = v.z / BZ;
        const zig = abs((((nx * 4) % 1) + 1) % 1 - 0.5) * 2;          // 胸口绒毛的锯齿边
        const edge = -0.08 + (zig - 0.5) * 0.24;
        const chest = ss(0.0, 0.3, nz) * ss(edge - 0.04, edge + 0.04, ny) * (1 - ss(0.62, 0.9, abs(nx)));
        c.copy(P.bodyLow).lerp(P.body, clamp((ny + 0.9) / 1.4, 0, 1)).lerp(FACE, chest);
      });
      outline(add(up, bodyGeo, vcMat(), 0, BC, 0));

      // 尾巴：从右后方露出来
      const tail = this.tail = new T.Group(); tail.position.set(0.1, 0.2, -0.2); up.add(tail);
      const tailGeo = new T.ConeGeometry(0.13, 0.4, 20, 4);
      tailGeo.scale(1.4, 1, 0.5); tailGeo.rotateX(-PI * 0.58); tailGeo.translate(0, -0.05, -0.18);
      this._vc(tailGeo, (v, c) => c.copy(P.tail));
      outline(add(tail, tailGeo, vcMat()));

      // 翅膀：深一点的蓝，带一层层的羽毛纹
      const wingGeo = () => {
        const g = ball();
        g.scale(0.075, 0.24, 0.2); g.translate(0, -0.19, 0);
        const wp = g.attributes.position;
        for (let i = 0; i < wp.count; i++) { // 下端收尖
          const k = 1 - ss(-0.2, -0.43, wp.getY(i)) * 0.55;
          wp.setZ(i, wp.getZ(i) * k);
        }
        g.computeVertexNormals();
        this._vc(g, (v, c) => {
          const row = (v.y + 0.43) / 0.08 + (v.z / 0.2) * (v.z / 0.2) * 0.8;
          const line = 1 - ss(0, 0.22, row - Math.floor(row));
          c.copy(P.wingLow).lerp(P.wing, clamp((v.y + 0.42) / 0.36, 0, 1)).lerp(P.tail, line * 0.55).multiplyScalar(1 - line * 0.12);
        });
        return g;
      };
      const mkWing = (s) => {
        const pivot = new T.Group(); pivot.position.set(s * 0.35, 0.52, -0.02); up.add(pivot);
        outline(add(pivot, wingGeo(), vcMat()));
        return pivot;
      };
      this.wingL = mkWing(-1); this.wingR = mkWing(1);

      // 抱着的爱心
      const hs = new T.Shape();
      hs.moveTo(0, -0.16); hs.bezierCurveTo(-0.08, -0.08, -0.21, 0, -0.21, 0.08);
      hs.bezierCurveTo(-0.21, 0.18, -0.08, 0.2, 0, 0.1); hs.bezierCurveTo(0.08, 0.2, 0.21, 0.18, 0.21, 0.08);
      hs.bezierCurveTo(0.21, 0, 0.08, -0.08, 0, -0.16);
      const heartGeo = new T.ExtrudeGeometry(hs, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 14 });
      this.heart = add(up, heartGeo, mat(0xf2787a), 0, 0.3, 0.33);

      // 头：灰色从头顶罩到眉毛上方，两侧往下包到脸颊，前面是一大片白脸
      const head = this.head = new T.Group(); head.position.set(0, 0.5, 0.01); up.add(head);
      const HX = 0.335, HY = 0.3, HZ = 0.31, HC = 0.24;
      this.hd = { HX: HX, HY: HY, HZ: HZ, HC: HC };
      const headGeo = ball();
      headGeo.scale(HX, HY, HZ);
      this._vc(headGeo, (v, c) => {
        const nx = v.x / HX, ny = v.y / HY, nz = v.z / HZ;
        const brow = 0.3 - 0.3 * nx * nx;
        const face = ss(-0.05, 0.15, nz) * (1 - ss(brow - 0.05, brow + 0.05, ny)) * (1 - ss(0.86, 0.97, abs(nx)));
        const chin = (1 - ss(-0.8, -0.5, ny)) * ss(-0.6, -0.2, nz);
        c.copy(P.hoodLow).lerp(P.hood, clamp((ny + 0.4) / 1.2, 0, 1)).lerp(FACE, Math.max(face, chin));
      });
      outline(add(head, headGeo, vcMat(), 0, HC, 0));
      const tuft = add(head, new T.ConeGeometry(0.03, 0.07, 12), vcMat(), 0, HC + HY + 0.015, -0.02);
      this._vc(tuft.geometry, (v, c) => c.copy(P.hood));
      tuft.rotation.x = -0.4;

      const onHead = (dx, dy, dz, k) => {
        const d = new T.Vector3(dx, dy, dz).normalize();
        return { pos: new T.Vector3(d.x * HX * k, HC + d.y * HY * k, d.z * HZ * k), dir: d };
      };
      // 眼睛
      const eyeMat = new T.MeshBasicMaterial({ color: 0x24242a }), glintMat = new T.MeshBasicMaterial({ color: 0xffffff });
      const mkEye = (s) => {
        const at = onHead(s * 0.56, -0.1, 0.82, 0.975);   // 眼睛分得很开，位置在脸的中线偏下
        const g = new T.Group(); g.position.copy(at.pos); g.rotation.y = s * 0.5; head.add(g);
        const pupil = new T.Mesh(new T.SphereGeometry(1, 20, 14), eyeMat); pupil.scale.set(0.042, 0.066, 0.022); g.add(pupil);  // 竖长的椭圆眼
        const glint = new T.Mesh(new T.SphereGeometry(0.014, 10, 8), glintMat); glint.position.set(-0.01, 0.026, 0.016); g.add(glint);
        g.userData.glint = glint;
        return g;
      };
      this.eyeL = mkEye(-1); this.eyeR = mkEye(1);
      // 脸颊
      const blushCv = document.createElement('canvas'); blushCv.width = blushCv.height = 64;
      const bg = blushCv.getContext('2d'), grad = bg.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(245,150,140,1)'); grad.addColorStop(0.55, 'rgba(245,150,140,.6)'); grad.addColorStop(1, 'rgba(245,150,140,0)');
      bg.fillStyle = grad; bg.fillRect(0, 0, 64, 64);
      this.cheekMat = new T.MeshBasicMaterial({ map: new T.CanvasTexture(blushCv), transparent: true, opacity: 0.85, depthWrite: false });
      [-1, 1].forEach((s) => {
        const at = onHead(s * 0.74, -0.42, 0.52, 1.02);
        const m = new T.Mesh(new T.CircleGeometry(0.09, 20), this.cheekMat);
        m.position.copy(at.pos); m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), at.dir);
        head.add(m);
      });
      // 喙：上深下橙
      // 鹦鹉的上喙是一个弯钩：根部又宽又厚，从脸上向前鼓出来，再向下弯成尖。
      // 做法：让一个椭圆截面沿着一段圆弧前进，越往尖端越细。
      const beakGeo = new T.BufferGeometry();
      (() => {
        const N = 22, M = 24, ARC = 0.1, AMAX = 122 * R, pos = [], col = [], idx = [], c = new T.Color();
        for (let i = 0; i <= N; i++) {
          const u = i / N, a = u * AMAX;
          const rad = Math.pow(1 - u, 0.6) * (1 - 0.12 * Math.exp(-u * 30));  // 根部略收一点，像嵌在脸上
          const rx = 0.098 * rad + 0.004, rn = 0.074 * rad + 0.003;
          const py = -ARC + ARC * cos(a), pz = ARC * sin(a);                  // 圆弧上的中心点
          const ny = cos(a), nz = sin(a);                                     // 朝外（鼻梁一侧）的方向
          for (let j = 0; j < M; j++) {
            const f = (j / M) * PI * 2, cf = cos(f), sf = sin(f);
            pos.push(rx * cf, py + rn * sf * ny, pz + rn * sf * nz);
            // 原图的配色：鼻梁中间是深灰色，向两侧和尖端晕成橙黄色
            const dark = ss(0.15, 0.95, sf) * (1 - ss(0.5, 0.9, u)) * 0.92;
            c.copy(BEAK).lerp(BEAK_DARK, dark);
            col.push(c.r, c.g, c.b);
          }
        }
        for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
          const a0 = i * M + j, a1 = i * M + (j + 1) % M, b0 = a0 + M, b1 = a1 + M;
          idx.push(a0, a1, b0, a1, b1, b0);
        }
        beakGeo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        beakGeo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
        beakGeo.setIndex(idx);
        beakGeo.rotateX(0.42);          // 整体往下压，钩尖朝下并略向里收
        beakGeo.computeVertexNormals();
      })();
      outline(add(head, beakGeo, vcMat(), 0, HC - 0.035, HZ - 0.075), 0.008);
      // 下喙：藏在弯钩下面的小圆兜，张嘴时往下转
      const low = this.lowBeak = new T.Group(); low.position.set(0, HC - 0.13, HZ - 0.04); head.add(low);
      const lowGeo = new T.SphereGeometry(1, 16, 12); lowGeo.scale(0.06, 0.035, 0.05); lowGeo.translate(0, -0.02, 0.012);
      add(low, lowGeo, mat(0xe9962f));
    }

    _buildProps() {
      const props = this.props = {};
      const reg = (name, obj, parent) => { if (!obj.isSprite) obj.scale.setScalar(0.001); obj.visible = false; (parent || this.group).add(obj); props[name] = obj; return obj; };
      this.heart.userData.base = 1; props.heart = this.heart; this.heart.visible = false; this.heart.scale.setScalar(0.001);

      // 食盆：跟着宝石的朝向，放在正前方
      const bowl = new T.Group(); bowl.position.set(0, 0, 0.62);
      add(bowl, flat(new T.CylinderGeometry(0.21, 0.14, 0.13, 9)), mat(0xe98b6d), 0, 0.065, 0);
      add(bowl, flat(new T.CylinderGeometry(0.18, 0.18, 0.03, 9)), mat(0xe3b24a), 0, 0.13, 0);
      this.seeds = [0, 1, 2].map((i) => add(bowl, flat(new T.IcosahedronGeometry(0.028, 0)), mat(i % 2 ? 0xedc566 : 0xd79c36), (i - 1) * 0.07, 0.16, 0.02));
      reg('bowl', bowl, this.turn);

      // 树枝
      const branch = new T.Group();
      const log = add(branch, flat(new T.CylinderGeometry(0.075, 0.085, 1.7, 6)), mat(0x9a6e45), 0, 0.075, 0.02);
      log.rotation.z = PI / 2;
      [[-0.7, 0.25], [-0.55, -0.5], [0.68, 0.4]].forEach((l) => {
        const leaf = add(branch, flat(new T.IcosahedronGeometry(0.1, 0)), mat(0x6fbf63), l[0], 0.2, 0.02);
        leaf.scale.set(0.5, 1.4, 0.25); leaf.rotation.z = l[1];
      });
      reg('branch', branch);

      // 铃铛：挂在右上方
      const bell = new T.Group(); bell.position.set(0.62, 1.95, 0.1);
      add(bell, new T.CylinderGeometry(0.008, 0.008, 0.5, 4), mat(0xb08d5b), 0, -0.25, 0);
      add(bell, flat(new T.CylinderGeometry(0.05, 0.15, 0.17, 7)), mat(0xf5c33d), 0, -0.57, 0);
      add(bell, flat(new T.CylinderGeometry(0.165, 0.165, 0.03, 7)), mat(0xe9ab26), 0, -0.665, 0);
      add(bell, flat(new T.IcosahedronGeometry(0.04, 0)), mat(0xd8951c), 0, -0.71, 0);
      this.bell = reg('bell', bell);

      // 平面小图标：音符、星星、汗滴、想鸟粮的气泡
      const notes = new T.Group();
      this.notes = [['♪', '#e9805f'], ['♫', '#4f79b6'], ['♪', '#e3a52b']].map((n) => { const s = sprite(glyph(n[0], n[1]), 0.26); notes.add(s); return s; });
      reg('notes', notes);
      const stars = new T.Group();
      this.stars = ['#f2b632', '#f7d774', '#f2b632'].map((c) => { const s = sprite(glyph('★', c), 0.2); stars.add(s); return s; });
      reg('stars', stars);
      this.sweat = sprite((g) => {
        g.fillStyle = '#8ec9f0'; g.strokeStyle = '#5b9fcb'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(64, 18); g.bezierCurveTo(20, 80, 40, 112, 64, 112); g.bezierCurveTo(88, 112, 108, 80, 64, 18); g.fill(); g.stroke();
      }, 0.15);
      reg('sweat', this.sweat);
      this.bubble = sprite((g) => {
        g.fillStyle = '#fff'; g.strokeStyle = '#6b6871'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(70, 52, 52, 40, 0, 0, PI * 2); g.fill(); g.stroke();
        g.beginPath(); g.arc(24, 100, 9, 0, PI * 2); g.fill(); g.stroke();
        g.beginPath(); g.arc(10, 118, 5, 0, PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#e3b24a'; g.beginPath(); g.ellipse(70, 46, 26, 12, 0, 0, PI * 2); g.fill();
        g.fillStyle = '#e98b6d'; g.beginPath(); g.moveTo(42, 50); g.quadraticCurveTo(46, 76, 70, 76); g.quadraticCurveTo(94, 76, 98, 50); g.closePath(); g.fill(); g.stroke();
      }, 0.62);
      reg('bubble', this.bubble);
    }

    setPalette(name) {
      const p = PALETTES[name] || PALETTES.blue;
      this.palette = name;
      Object.keys(p).forEach((k) => { if (k !== 'name') this.pal[k] = new T.Color(p[k]); });
      this.painted.forEach((it) => paint(it.geo, it.fn));
    }

    /** 换装：outfit = { hat: 'straw', glasses: 'sun', neck: 'scarf' }，不戴的留空 */
    setOutfit(outfit) {
      outfit = outfit || {};
      this.worn = this.worn || {};
      ['hat', 'glasses', 'neck'].forEach((slot) => {
        const want = outfit[slot] || '', cur = this.worn[slot];
        if (cur && cur.id === want) return;
        if (cur) cur.obj.parent.remove(cur.obj);
        this.worn[slot] = null;
        if (!want) return;
        const obj = makeItem(want, this.hd);
        if (slot === 'neck') this.up.add(obj);
        else { obj.position.y += this.hd.HC; this.head.add(obj); }
        this.worn[slot] = { id: want, obj: obj };
      });
    }

    setState(name) { this.queue = []; this.dur = Infinity; this._enter(name); }
    play(steps, after) { this.queue = steps.slice(); this.after = after || 'idle'; this._next(); }
    feed() { this.play([['eat', 3.6], ['satisfied', 3.2]]); }
    ring() { this.play([['bell', 3.8], ['happy', 2.8]]); }

    _next() {
      if (this.queue.length) { const s = this.queue.shift(); this.dur = s[1]; this._enter(s[0]); }
      else { this.dur = Infinity; this._enter(this.after); }
    }

    _enter(name) {
      if (!STATES[name]) name = 'idle';
      this.state = name; this.t = 0;
      const on = INFO[name].props;
      Object.keys(this.props).forEach((k) => { this.props[k].userData.on = on.indexOf(k) >= 0; });
      if (this.onState) this.onState(name, INFO[name]);
    }

    /** 每帧调用。now：当前秒数；dt：距上一帧的秒数 */
    update(now, dt) {
      dt = clamp(dt, 0.001, 0.05);
      this.t += dt; this.clock = now;
      if (this.t >= this.dur) this._next();
      else if (this.state === 'idle' && this.boredAfter > 0 && this.t > this.boredAfter) this._enter('bored');
      const t = this.t;

      const target = Object.assign({}, DEF, STATES[this.state](t));
      const breath = this.state === 'coma' ? 0 : sin(now * 2.3);
      target.sy *= 1 + breath * 0.014;
      target.headPitch += breath * 0.8;
      if (now > this.nextBlink) { this.blinkUntil = now + 0.13; this.nextBlink = now + 2.2 + Math.random() * 3; }
      if (now < this.blinkUntil) { target.eyeL = 0.05; target.eyeR = 0.05; }

      const k = 1 - Math.exp(-dt * 18), kSlow = 1 - Math.exp(-dt * 8);
      const p = this.pose;
      for (const key in DEF) p[key] += (target[key] - p[key]) * (key === 'yaw' || key === 'lie' ? kSlow : k);
      if (this.override) Object.assign(p, this.override);
      this._apply(now, t, dt);
    }

    _apply(now, t, dt) {
      const p = this.pose;
      this.turn.rotation.y = p.yaw * R;
      this.lean.rotation.z = -(p.roll + p.lie * 86) * R;
      this.lean.position.set(p.jx - p.lie * 0.42, p.y + p.lie * 0.31, 0);
      this.lean.scale.set(p.sx, p.sy, p.sx);
      this.bend.rotation.x = p.pitch * R;
      this.head.rotation.set(p.headPitch * R, p.headYaw * R, -p.headRoll * R);
      this.wingL.rotation.set(-p.hug * 1.05, 0, -p.wingL * R);
      this.wingR.rotation.set(-p.hug * 1.05, 0, p.wingR * R);
      this.tail.rotation.set(p.tail * R, p.tailYaw * R + 0.6, 0);
      const eye = (g, open, smile) => {
        const o = clamp(open, 0.05, 1.2) * (1 - smile * 0.72);
        g.scale.set(p.eyeSize * (1 + smile * 0.15), p.eyeSize * o, 1);
        g.userData.glint.visible = o > 0.5;
      };
      eye(this.eyeL, p.eyeL, p.smileL); eye(this.eyeR, p.eyeR, p.smileR);
      this.lowBeak.rotation.x = clamp(p.beak, 0, 1) * 0.7;
      this.cheekMat.opacity = clamp(p.blush, 0, 1) * 0.85;

      // 道具弹出/收起
      const kp = 1 - Math.exp(-dt * 14);
      for (const name in this.props) {
        const o = this.props[name];
        const goal = o.userData.on ? 1 : 0;
        const s = o.userData.s = (o.userData.s || 0) + (goal - (o.userData.s || 0)) * kp;
        o.visible = s > 0.02;
        if (o.isSprite) o.material.opacity = s; else o.scale.setScalar(Math.max(0.001, s));
      }
      if (this.props.heart.visible) this.heart.scale.multiplyScalar(1 + sin(now * 6) * 0.05);
      if (this.props.bowl.visible) this.seeds.forEach((s, i) => { s.position.y = 0.16 + abs(sin(t * 5.7 + i * 1.3)) * (this.state === 'eat' ? 0.09 : 0); });
      this.bell.rotation.z = this.state === 'bell' ? sin(t * 5) * 0.4 : this.bell.rotation.z * 0.9;
      if (this.props.notes.visible) this.notes.forEach((n, i) => {
        const ph = (t * 0.6 + i / 3) % 1;
        n.position.set(0.5 - ph * 0.5 + (i - 1) * 0.16, 1.3 + ph * 0.55, 0.2);
        n.material.opacity = sin(ph * PI);
      });
      if (this.props.stars.visible) this.stars.forEach((s, i) => {
        const a = now * 3.6 + i * (PI * 2 / 3);
        s.position.set(cos(a) * 0.42 + p.roll * 0.012, 1.2 + sin(a * 2) * 0.03, sin(a) * 0.42);
        s.material.opacity = this.props.stars.userData.s;
      });
      const drop = (t * 0.7) % 1;
      this.sweat.position.set(-0.4, 1.0 - drop * 0.22, 0.2);
      if (this.props.sweat.visible) this.sweat.material.opacity = sin(drop * PI) * this.props.sweat.userData.s;
      this.bubble.position.set(0.72, 1.55 + sin(now * 2.4) * 0.03, 0);
    }
  }

  Baoshi3D.PALETTES = PALETTES;
  Baoshi3D.INFO = INFO;
  Baoshi3D.ITEMS = ITEMS;
  global.Baoshi3D = Baoshi3D;
})(window);
