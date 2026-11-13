/*
 * 存档和游戏规则：饱腹度、鸟粮、铃铛、探险票、经验、金币、等级。
 * 这里只有数字和规则，不碰画面，方便单独检查。
 * 进度保存在设备本地（localStorage），退出再打开可以接着玩。
 */
(function (global) {
  'use strict';
  const KEY = 'baoshi-house-save';
  const MIN = 60000;
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  const RULES = {
    foodGain: 20,          // 每份鸟粮补多少饱腹度
    maxSatiety: 100,
    bigStep: 30 * MIN,     // 饱腹度高于 20 时：每 30 分钟降 10
    bigDrop: 10,
    smallStep: 15 * MIN,   // 最后 20 点：每 15 分钟降 5
    smallDrop: 5,
    reviveTo: 60,          // 抢救成功后恢复到多少
    adventureMin: 40,      // 低于这个饱腹度不能出门闯关
    ticketAt: 3,           // 一轮答对几题给探险票
    bellAt: 4,             // 一轮答对几题给铃铛
    dailyRuns: 5,          // 每天最多闯几关
    maxLevel: 20,
    unlocks: { 3: 'mint', 5: 'sakura', 8: 'sunset', 12: 'star' }  // 升到几级解锁哪种羽毛
  };

  function fresh() {
    return { v: 2, satiety: 50, food: 2, bells: 1, bond: 0, tickets: 1, xp: 0, coins: 0, level: 1,
      lastTick: Date.now(), correct: {}, stars: {}, daily: { date: today(), runs: 0 }, palette: 'blue',
      hints: 3,                                                 // 提示羽毛：闯关时看接下来 3 步
      owned: {}, outfit: { hat: '', glasses: '', neck: '' },   // 买到的服饰、现在穿戴的
      houses: { coral: 1 }, house: 'coral' };                   // 买到的小屋、现在用的
  }

  const Store = {
    RULES: RULES,
    s: null,

    load() {
      const read = (text) => { try { const d = JSON.parse(text); return d && typeof d === 'object' ? d : null; } catch (e) { return null; } };
      let data = null;
      try { data = read(localStorage.getItem(KEY)); } catch (e) { data = null; }
      // 装成 App 后，系统里还有一份备份存档；两份里用保存时间较新的那一份
      const backup = typeof global.__nativeSave === 'string' ? read(global.__nativeSave) : null;
      if (backup && (!data || (backup.savedAt || 0) > (data.savedAt || 0))) data = backup;
      this.s = Object.assign(fresh(), data || {});
      this.tick(Date.now());
      return this.s;
    },
    save() {
      this.s.savedAt = Date.now();
      const text = JSON.stringify(this.s);
      try { localStorage.setItem(KEY, text); } catch (e) { /* 存不了也不影响继续玩 */ }
      try { global.webkit.messageHandlers.save.postMessage(text); } catch (e) { /* 在浏览器里没有这个通道，忽略 */ }
    },
    reset() { this.s = fresh(); this.save(); },

    /** 按真实经过的时间扣饱腹度，关掉 App 的时间也算 */
    tick(now) {
      const s = this.s;
      let left = now - s.lastTick;
      if (left < 0) { s.lastTick = now; return; }
      while (s.satiety > 0) {
        const big = s.satiety > 20;
        const step = big ? RULES.bigStep : RULES.smallStep;
        if (left < step) break;
        left -= step;
        s.lastTick += step;
        s.satiety = Math.max(0, s.satiety - (big ? RULES.bigDrop : RULES.smallDrop));
      }
      if (s.satiety === 0) s.lastTick = now;
    },

    /** 当前饱腹度对应宝石的哪个形态 */
    status() {
      const v = this.s.satiety;
      if (v <= 0) return 'coma';
      if (v <= 5) return 'dying';
      if (v <= 10) return 'faint';
      if (v <= 20) return 'hungry3';
      if (v <= 40) return 'hungry2';
      if (v <= 60) return 'hungry1';
      return 'idle';
    },

    feed() {
      const s = this.s;
      if (s.satiety <= 0) return { ok: false, msg: '宝石昏过去了，要先答题抢救。' };
      if (s.food <= 0) return { ok: false, msg: '没有鸟粮了，去学习赚一些吧。' };
      if (s.satiety >= RULES.maxSatiety) return { ok: false, msg: '宝石已经吃饱啦。' };
      s.food--; s.bond++;
      s.satiety = Math.min(RULES.maxSatiety, s.satiety + RULES.foodGain);
      this.save();
      return { ok: true };
    },

    ring() {
      const s = this.s;
      if (s.satiety <= 0) return { ok: false, msg: '宝石昏过去了，要先答题抢救。' };
      if (s.bells <= 0) return { ok: false, msg: '没有铃铛了，一轮答对 4 题就能得到一个。' };
      s.bells--; s.bond += 2;
      this.save();
      return { ok: true };
    },

    /** 一轮普通练习结束。results：[{id, ok}] */
    finishQuiz(results) {
      const s = this.s;
      const right = results.filter((r) => r.ok).length;
      results.forEach((r) => { if (r.ok) s.correct[r.id] = 1; });
      const out = { right: right, food: right, bell: right >= RULES.bellAt ? 1 : 0, ticket: right >= RULES.ticketAt ? 1 : 0,
        hint: results.length >= 5 && right === results.length ? 1 : 0 };   // 一轮全对，再得 1 根提示羽毛
      s.food += out.food; s.bells += out.bell; s.tickets += out.ticket; s.hints += out.hint;
      this.save();
      return out;
    },

    /** 抢救答题结束：3 题答对至少 2 题就唤醒 */
    finishRescue(results) {
      const s = this.s;
      results.forEach((r) => { if (r.ok) s.correct[r.id] = 1; });
      const ok = results.filter((r) => r.ok).length >= 2;
      if (ok) { s.satiety = RULES.reviveTo; s.lastTick = Date.now(); }
      this.save();
      return ok;
    },

    runsLeft() {
      const s = this.s;
      if (s.daily.date !== today()) s.daily = { date: today(), runs: 0 };
      return Math.max(0, RULES.dailyRuns - s.daily.runs);
    },
    unlocked(index, ids) { return index === 0 || (this.s.stars[ids[index - 1]] || 0) > 0; },

    /** 进入一关：检查条件并扣一张探险票 */
    enterLevel(index, ids) {
      const s = this.s;
      if (s.satiety <= 0) return { ok: false, msg: '宝石昏过去了，要先答题抢救。' };
      if (!this.unlocked(index, ids)) return { ok: false, msg: '先通过前一关才能来这里。' };
      if (s.satiety < RULES.adventureMin) return { ok: false, msg: '宝石太饿了，没力气出门，先喂喂它。' };
      if (this.runsLeft() <= 0) return { ok: false, msg: '今天已经闯了 ' + RULES.dailyRuns + ' 关，让宝石休息一下，明天再来。' };
      if (s.tickets <= 0) return { ok: false, msg: '没有探险票了，一轮答对 3 题就能得到一张。' };
      s.tickets--; s.daily.runs++;
      this.save();
      return { ok: true };
    },

    needXp(level) { return 60 + 40 * (level - 1); },

    /** 通关结算。重复通关已过的关卡，奖励减半 */
    clearLevel(index, ids, stars) {
      const s = this.s, id = ids[index], before = s.stars[id] || 0;
      let xp = 20 + index * 2, coins = 10 + stars * 5;
      if (before > 0) { xp = Math.floor(xp / 2); coins = Math.floor(coins / 2); }
      if (stars === 3 && before < 3) coins += 20;
      s.stars[id] = Math.max(before, stars);
      s.coins += coins; s.xp += xp;
      const ups = [], skins = [];
      while (s.level < RULES.maxLevel && s.xp >= this.needXp(s.level)) {
        s.xp -= this.needXp(s.level); s.level++; ups.push(s.level);
        if (RULES.unlocks[s.level]) skins.push(RULES.unlocks[s.level]);
      }
      this.save();
      return { xp: xp, coins: coins, levelUps: ups, skins: skins, first: before === 0 };
    },

    /** 用金币买东西。bag 是 'owned'（服饰）或 'houses'（小屋） */
    buy(bag, id, price) {
      const s = this.s;
      if (s[bag][id]) return { ok: true };
      if (s.coins < price) return { ok: false, msg: '金币不够，还差 ' + (price - s.coins) + ' 个。去探险能赚金币。' };
      s.coins -= price; s[bag][id] = 1;
      this.save();
      return { ok: true };
    },
    wear(slot, id) { if (!id || this.s.owned[id]) { this.s.outfit[slot] = id || ''; this.save(); } },
    useHouse(id) { if (this.s.houses[id]) { this.s.house = id; this.save(); } },

    skinUnlocked(name) {
      if (name === 'blue') return true;
      return Object.keys(RULES.unlocks).some((lv) => RULES.unlocks[lv] === name && this.s.level >= +lv);
    },
    skinLevel(name) { return +Object.keys(RULES.unlocks).filter((lv) => RULES.unlocks[lv] === name)[0] || 1; }
  };

  global.Store = Store;
})(window);
