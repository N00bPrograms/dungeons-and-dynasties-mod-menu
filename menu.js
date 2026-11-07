// Dungeons & Dynasties mod menu. Injected into the game's WebView2 page by DDModLauncher.
// Toggle with F8. Edits the live guild state through the game's own React state hook,
// so the game saves the changes normally (and signs them) the next time it saves.
(() => {
  if (window.__ddmm) return;
  window.__ddmm = true;

  // ---------- settings ----------
  const KEY = 'ddmm_settings';
  const S = Object.assign(
    { open: true, x: 24, y: 80, lockGold: false, lockValue: 0, fresh: false, autoBuild: false, closed: {} },
    (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })()
  );
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

  // ---------- rules mirrored from the game (v0.3) ----------
  const ATTRS = ['weaponSkill', 'marksmanship', 'power', 'spellcraft', 'armorUse', 'parry', 'evasion', 'criticalStrike',
    'composure', 'bravery', 'decisions', 'anticipation', 'teamwork', 'leadership', 'concentration', 'aggression',
    'discipline', 'resolve', 'strength', 'agility', 'stamina', 'vitality', 'speed', 'reflexes', 'threat', 'mitigation',
    'healing', 'support', 'crowdControl', 'positioning'];
  const xpFor = lv => { const a = Math.max(1, Math.min(20, lv)) - 1; return Math.ceil(0.9 * a * a + 6 * a); };
  const stars = ab => Math.max(0.5, Math.min(5, Math.round(ab / 200 * 5 * 2) / 2));
  const HALL_MAX = 6;
  const bedsFor = g => 6 + ((g.hall && g.hall.level) || 1) * 3;

  const RARITIES = ['common', 'rare', 'mythic', 'legendary'];
  const ROLL = { common: { pct: .09, flat: .05 }, rare: { pct: .15, flat: .09 }, mythic: { pct: .22, flat: .13 }, legendary: { pct: .3, flat: .17 } };
  const PREFIX = { common: '', rare: 'Tempered ', mythic: 'Masterwork ', legendary: 'Fabled ' };
  const F = (slot, kind, name, mods, extra = {}) => ({ slot, kind, name, mods, ...extra });
  const FAMILIES = [
    F('weapon', 'melee', 'Keen Blade', e => ({ attackPct: e.pct, critChance: e.flat * .5 })),
    F('weapon', 'melee', 'Heavy Maul', e => ({ attackPct: e.pct * 1.3 })),
    F('weapon', 'melee', 'Balanced Spear', e => ({ attackPct: e.pct * .8, accuracy: Math.round(e.flat * 40) })),
    F('weapon', 'melee', 'Warded Longsword', e => ({ attackPct: e.pct * .7, blockChance: e.flat * 1.2, mitigation: e.flat * .3 })),
    F('weapon', 'ranged', 'Recurve Bow', e => ({ attackPct: e.pct, critChance: e.flat * .5 }), { favours: ['ranger'] }),
    F('weapon', 'ranged', 'Heavy Arbalest', e => ({ attackPct: e.pct * 1.3 }), { favours: ['ranger'] }),
    F('weapon', 'ranged', "Marksman's Sling", e => ({ attackPct: e.pct * .8, accuracy: Math.round(e.flat * 40) }), { favours: ['ranger'] }),
    F('weapon', 'ranged', "Traveller's Harp", e => ({ attackPct: e.pct * .9, healPct: e.pct * .5 }), { favours: ['bard'] }),
    F('weapon', 'spell', "Stormcaller's Rod", e => ({ attackPct: e.pct, critChance: e.flat * .5 })),
    F('weapon', 'spell', 'Elder Greatstaff', e => ({ attackPct: e.pct * 1.3 })),
    F('weapon', 'spell', "Seeker's Wand", e => ({ attackPct: e.pct * .8, accuracy: Math.round(e.flat * 40) })),
    F('weapon', 'spell', 'Channeling Wand', e => ({ attackPct: e.pct * .9, healPct: e.pct * .5 })),
    F('armour', null, 'Plated Hauberk', e => ({ mitigation: e.flat, hpPct: e.pct * .6 })),
    F('armour', null, 'Bulwark Harness', e => ({ mitigation: e.flat * 1.4 })),
    F('armour', null, 'Padded Jerkin', e => ({ hpPct: e.pct, mitigation: e.flat * .4 })),
    F('armour', null, 'Oaken Shield', e => ({ blockChance: e.flat * 1.5, mitigation: e.flat * .3 })),
    F('armour', null, 'Field Dressing Rig', e => ({ healTakenPct: e.pct * 1.6, hpPct: e.pct * .3 })),
    F('armour', null, 'Stormwax Waders', e => ({ mitigation: e.flat * .6 }), { counters: 'flooded' }),
    F('armour', null, 'Furred Mantle', e => ({ hpPct: e.pct * .6 }), { counters: 'deepcold' }),
    F('armour', null, "Skirmisher's Jack", e => ({ mitigation: e.flat * .5, critChance: e.flat * .6 })),
    F('armour', null, 'Warded Vestments', e => ({ healPct: e.pct * .8, hpPct: e.pct * .4 })),
    F('armour', null, 'Barkweave Tunic', e => ({ hpPct: e.pct * .7, healTakenPct: e.pct * .8 }), { counters: 'frozen' }),
    F('armour', null, "Duelist's Doublet", e => ({ mitigation: e.flat * .5, attackPct: e.pct * .5 })),
    F('armour', null, 'Heraldic Surcoat', e => ({ blockChance: e.flat * .9, hpPct: e.pct * .5 })),
    F('armour', null, 'Aegis of the Steadfast', e => ({ mitigation: e.flat * 1.2, hpPct: e.pct * .5 }), { grantsTrait: 'stalwart' }),
    F('trinket', null, 'Everburning Torch', e => ({ accuracy: Math.round(e.flat * 30) }), { counters: 'darkness' }),
    F('trinket', null, 'Warding Charm', e => ({ hpPct: e.pct * .4 }), { counters: 'cursed' }),
    F('trinket', null, 'Vital Pendant', e => ({ hpPct: e.pct })),
    F('trinket', null, 'Lucky Charm', e => ({ critChance: e.flat })),
    F('trinket', null, 'Sigil of Focus', e => ({ healPct: e.pct, accuracy: Math.round(e.flat * 20) })),
    F('trinket', null, 'Whetstone Fetish', e => ({ attackPct: e.pct * .8 })),
    F('trinket', null, 'Ashgate Warhorn', e => ({ accuracy: Math.round(e.flat * 20), attackPct: e.pct * .4 })),
    F('trinket', null, 'Kingsfoil Pouch', e => ({ healPct: e.pct }), { counters: 'infernal' }),
    F('trinket', null, 'Marrow Talisman', e => ({ mitigation: e.flat * .7 })),
    F('trinket', null, 'Vigil Candle', e => ({ healTakenPct: e.pct * 1.2 })),
    F('trinket', null, "Guardian's Seal", e => ({ blockChance: e.flat * 1.1 })),
    F('trinket', null, "Archer's Loupe", e => ({ critChance: e.flat * .6, accuracy: Math.round(e.flat * 15) })),
    F('trinket', null, 'Crown of Hubris', e => ({ attackPct: e.pct, hpPct: e.pct }), { grantsTrait: 'arrogant' }),
    F('trinket', null, 'Hungering Coffer', e => ({ critChance: e.flat * 1.4 }), { grantsTrait: 'greedy' }),
    F('trinket', null, 'Banner of Valour', e => ({ hpPct: e.pct * .6 }), { grantsTrait: 'brave' }),
    F('trinket', null, "Sage's Circlet", e => ({ healPct: e.pct * .8 }), { grantsTrait: 'iron-willed' }),
  ];
  const MOD_LABEL = { attackPct: 'attack', critChance: 'crit', accuracy: 'accuracy', blockChance: 'block', mitigation: 'armour',
    hpPct: 'HP', healPct: 'healing', healTakenPct: 'healing recv' };

  // ---------- game state access ----------
  function getHook() {
    const el = document.getElementById('root');
    if (!el) return null;
    const ck = Object.keys(el).find(k => k.startsWith('__reactContainer'));
    if (!ck) return null;
    const fiberRoot = el[ck] && el[ck].stateNode;
    const top = fiberRoot && fiberRoot.current;
    if (!top) return null;
    const stack = [top];
    let guard = 0;
    while (stack.length && guard++ < 50000) {
      const f = stack.pop();
      let h = f.memoizedState, i = 0;
      while (h && typeof h === 'object' && 'queue' in h && i++ < 400) {
        const v = h.memoizedState;
        if (v && typeof v === 'object' && !Array.isArray(v) && 'gold' in v && Array.isArray(v.roster) &&
            h.queue && typeof h.queue.dispatch === 'function') return h;
        h = h.next;
      }
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    return null;
  }
  const guild = () => { const h = getHook(); return h ? h.memoizedState : null; };

  function update(fn, label) {
    const h = getHook();
    if (!h) { flash('No guild loaded yet', true); return false; }
    h.queue.dispatch(prev => {
      try { const next = fn(prev); return next || prev; }
      catch (e) { console.error('[ddmm]', e); return prev; }
    });
    if (label) flash(label);
    return true;
  }

  // ---------- edits ----------
  const isFresh = a => a.condition >= 100 && a.morale >= 100 && !a.stress && !a.fatigue && !a.injury;
  const fresh = a => ({ ...a, condition: 100, morale: 100, stress: 0, fatigue: 0, injury: null });
  const healOnly = a => ({ ...a, condition: 100, injury: null });
  const maxAttrs = a => ({
    ...a,
    attributes: Object.fromEntries(Object.keys(a.attributes || {}).map(k => [k, 20])),
    currentAbility: 200, potentialAbility: 200, abilityStars: 5, potentialStars: 5,
  });
  const maxPotential = a => ({ ...a, potentialAbility: 200, potentialStars: 5 });
  const setLevel = lv => a => ({ ...a, level: lv, experience: xpFor(lv) });
  const mapHeroes = (g, sel, fn) => ({ ...g, roster: g.roster.map(a => (sel === '*' || a.id === sel) ? fn(a) : a) });
  const finishBuilds = g => {
    if (!g.hall || !Array.isArray(g.hall.builds)) return g;
    return { ...g, hall: { ...g.hall, builds: g.hall.builds.map(b => b.completeDay > g.day ? { ...b, completeDay: g.day } : b) } };
  };
  const num = v => { const n = Math.floor(Number(String(v).replace(/[^\d.-]/g, ''))); return Number.isFinite(n) ? n : null; };

  // items
  let forgeSeq = 0;
  function makeItem(fam, rarity, power, day) {
    if (fam.grantsTrait && RARITIES.indexOf(rarity) < 2) rarity = 'mythic'; // trait gear is mythic+ in the game
    const q = rarity === 'legendary' ? 1 : 1.25;                            // best possible quality roll
    const r = ROLL[rarity];
    const raw = fam.mods({ pct: r.pct * q * power, flat: r.flat * q * power });
    const mods = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, k === 'accuracy' ? Math.round(v) : Number(v.toFixed(4))]));
    const tier = 9;
    const it = {
      id: `it_ddmm_${Date.now().toString(36)}_${++forgeSeq}_${Math.floor(1000 + Math.random() * 9000)}`,
      name: fam.grantsTrait ? fam.name : PREFIX[rarity] + fam.name,
      slot: fam.slot, rarity, mods,
      value: Math.round((25 + tier * 14) * (1 + RARITIES.indexOf(rarity) * 0.9) * q),
      tier, quality: q,
      history: { day, how: 'market' },
    };
    if (fam.counters) it.counters = fam.counters;
    if (fam.grantsTrait) it.grantsTrait = fam.grantsTrait;
    if (fam.kind) it.weaponKind = fam.kind;
    if (fam.favours) it.favours = fam.favours.slice();
    return it;
  }

  // recruiting
  function sources(g) {
    const out = [];
    out.push({ key: 'tavern', label: 'Tavern recruits', heroes: (g.recruits || []).map(r => r.adventurer).filter(Boolean) });
    const lg = g.league || {};
    out.push({ key: 'free', label: 'Free agents', heroes: (lg.freeAgents || []).map(f => f.hero).filter(Boolean) });
    const mine = new Set(g.roster.map(a => a.id));
    (lg.divisions || []).forEach((d, di) => (d.guilds || []).forEach(gu => {
      if (!Array.isArray(gu.roster) || !gu.roster.length || gu.roster.some(h => mine.has(h.id))) return;
      out.push({ key: 'g:' + gu.id, label: `Div ${di + 1} · ${gu.name}`, heroes: gu.roster });
    }));
    return out;
  }
  function joinHero(h, day) {
    const attributes = h.attributes ||
      (Array.isArray(h.a) ? Object.fromEntries(ATTRS.map((k, i) => [k, h.a[i] != null ? h.a[i] : 10])) : null);
    const { a, away, leavingOnReturn, dealing, aspirant, borrowedFrom, courtedFrom, swornAgain, post, ...rest } = h;
    return {
      ...rest, attributes, equipment: {}, injury: rest.injury || null,
      origin: 'recruited', joinedDay: day, oathLeft: Math.max(3, rest.oathLeft || 0),
      morale: Math.max(rest.morale || 0, 75), dealing: { paid: 0, wages: 0, earned: 0 },
    };
  }
  function recruit(p, srcKey, heroId) {
    if (p.roster.some(a => a.id === heroId)) return p;
    let hero = null, next = { ...p };
    if (srcKey === 'tavern') {
      const r = (p.recruits || []).find(r => r.adventurer && r.adventurer.id === heroId);
      if (!r) return p;
      hero = r.adventurer;
      next.recruits = p.recruits.filter(r => !(r.adventurer && r.adventurer.id === heroId));
    } else if (srcKey === 'free') {
      const fa = (p.league.freeAgents || []).find(f => f.hero && f.hero.id === heroId);
      if (!fa) return p;
      hero = fa.hero;
      next.league = { ...p.league, freeAgents: p.league.freeAgents.filter(f => f !== fa) };
    } else {
      const gid = srcKey.slice(2);
      for (const d of p.league.divisions) for (const gu of d.guilds) if (gu.id === gid) hero = (gu.roster || []).find(h => h.id === heroId) || null;
      if (!hero) return p;
      next.league = {
        ...p.league,
        divisions: p.league.divisions.map(d => d.guilds.some(gu => gu.id === gid)
          ? { ...d, guilds: d.guilds.map(gu => gu.id === gid ? { ...gu, roster: gu.roster.filter(h => h.id !== heroId) } : gu) }
          : d),
      };
    }
    if (!hero.attributes && !Array.isArray(hero.a)) return p;
    next.roster = [...p.roster, joinHero(hero, p.day)];
    return next;
  }

  // ---------- UI ----------
  const host = document.createElement('div');
  host.id = 'ddmm-host';
  host.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;';
  const root = host.attachShadow({ mode: 'open' });
  const famOptions = ['weapon', 'armour', 'trinket'].map(slot =>
    `<optgroup label="${slot === 'weapon' ? 'Weapons' : slot === 'armour' ? 'Armour' : 'Trinkets'}">` +
    FAMILIES.map((f, i) => f.slot !== slot ? '' :
      `<option value="${i}">${f.grantsTrait ? '★ ' : ''}${f.name}${f.kind ? ` (${f.kind})` : ''} — ${
        Object.keys(f.mods({ pct: 1, flat: 1 })).map(k => MOD_LABEL[k] || k).join(', ')}${
        f.grantsTrait ? ` · trait: ${f.grantsTrait}` : ''}${f.counters ? ` · vs ${f.counters}` : ''}</option>`).join('') +
    '</optgroup>').join('');
  root.innerHTML = `
<style>
  :host { all: initial; }
  .p { position: fixed; width: 320px; background: #17130f; color: #eadfcb; border: 1px solid #6b5432;
       border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.6); font: 13px/1.35 Segoe UI, system-ui, sans-serif; user-select: none; }
  .h { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; cursor: move;
       background: linear-gradient(#2a2116, #1e1810); border-bottom: 1px solid #6b5432; border-radius: 8px 8px 0 0; }
  .h b { color: #e8b75a; letter-spacing: .3px; } .h span { color: #9c8a6c; font-size: 11px; }
  .x { cursor: pointer; color: #9c8a6c; padding: 0 4px; } .x:hover { color: #fff; }
  .b { padding: 8px 10px 10px; max-height: 80vh; overflow: auto; }
  .st { font-size: 12px; color: #c9b998; background: #0f0c09; border-radius: 5px; padding: 6px 8px; margin-bottom: 4px; }
  details { border-top: 1px solid #2e2518; padding: 2px 0 4px; }
  summary { cursor: pointer; margin: 6px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #e8b75a; list-style: none; }
  summary::before { content: '▸ '; color: #9c8a6c; } details[open] > summary::before { content: '▾ '; }
  .r { display: flex; gap: 5px; margin: 4px 0; flex-wrap: wrap; align-items: center; }
  button { background: #3a2d1b; color: #f1e6d0; border: 1px solid #7a6038; border-radius: 4px; padding: 4px 8px; font: inherit; cursor: pointer; }
  button:hover { background: #503e24; } button:active { transform: translateY(1px); }
  button.go { background: #5a4220; border-color: #b8862f; }
  input[type=text], select { background: #0f0c09; color: #f1e6d0; border: 1px solid #5a4628; border-radius: 4px; padding: 4px 6px; font: inherit; min-width: 0; }
  input[type=text] { width: 110px; } input.sm { width: 46px; } select { width: 100%; } select.half { width: auto; flex: 1; }
  label { display: flex; gap: 6px; align-items: center; cursor: pointer; margin: 4px 0; }
  .note { font-size: 11px; color: #9c8a6c; }
  .f { min-height: 16px; font-size: 12px; color: #9fd38a; margin-top: 8px; } .f.err { color: #e88; }
</style>
<div class="p">
  <div class="h"><div><b>D&amp;D Mod Menu</b> <span>F8 to hide</span></div><div class="x" data-a="close">✕</div></div>
  <div class="b">
    <div class="st" id="st">Waiting for a guild…</div>

    <details data-s="treasury" open><summary>Treasury</summary>
      <div class="r"><input type="text" id="gold" placeholder="amount"><button data-a="setGold">Set gold</button></div>
      <div class="r"><button data-a="g10k">+10k</button><button data-a="g100k">+100k</button><button data-a="g1m">+1M</button></div>
      <label><input type="checkbox" id="lockGold"> Gold never drops below current amount</label>
    </details>

    <details data-s="guild" open><summary>Guild</summary>
      <div class="r"><input type="text" id="renown" placeholder="renown"><button data-a="setRenown">Set renown</button><button data-a="r100">+100</button></div>
      <div class="r"><button data-a="patron">Patron confidence 100</button></div>
    </details>

    <details data-s="heroes" open><summary>Heroes</summary>
      <div class="r"><select id="hero"></select></div>
      <div class="r"><button data-a="fresh">Fully rest</button><button data-a="heal">Heal injuries</button></div>
      <div class="r">Level <input type="text" class="sm" id="lvl" value="20"><button data-a="setLvl">Set level</button><button data-a="maxLvl">Max (20)</button></div>
      <div class="r"><button data-a="maxAttr">Max attributes + ability</button><button data-a="maxPot">Max potential</button></div>
      <label><input type="checkbox" id="fresh"> Keep everyone rested &amp; uninjured</label>
    </details>

    <details data-s="recruit" open><summary>Recruit anyone (free)</summary>
      <div class="r"><select id="src"></select></div>
      <div class="r"><select id="cand"></select></div>
      <div class="r"><button class="go" data-a="recruit">Recruit for free</button><span class="note" id="beds"></span></div>
      <div class="r"><button data-a="hallUp">Upgrade hall (+3 beds)</button></div>
      <div class="note">The game won't advance a day while you have more heroes than beds.</div>
    </details>

    <details data-s="forge" open><summary>Item forge</summary>
      <div class="r"><select id="fam">${famOptions}</select></div>
      <div class="r">
        <select id="rar" class="half"><option value="common">Common</option><option value="rare">Rare</option><option value="mythic">Mythic</option><option value="legendary" selected>Legendary</option></select>
        <select id="pow" class="half"><option value="1">Normal</option><option value="2">Strong ×2</option><option value="3">Godly ×3</option></select>
        <select id="qty" class="half"><option>1</option><option>3</option><option>5</option></select>
      </div>
      <div class="r"><button class="go" data-a="forge">Forge into stash</button></div>
      <div class="note">★ items grant a trait and are Mythic or better. Combat caps armour at 80%, crit at 45%, block at 60%.</div>
    </details>

    <details data-s="hall" open><summary>Guild Hall</summary>
      <div class="r"><button data-a="builds">Finish builds now</button></div>
      <label><input type="checkbox" id="autoBuild"> Auto-finish new builds</label>
    </details>

    <div class="f" id="f"></div>
  </div>
</div>`;

  const $ = id => root.getElementById(id);
  const panel = root.querySelector('.p');
  const place = () => {
    S.x = Math.max(0, Math.min(window.innerWidth - 60, S.x));
    S.y = Math.max(0, Math.min(window.innerHeight - 40, S.y));
    panel.style.left = S.x + 'px'; panel.style.top = S.y + 'px';
    panel.style.display = S.open ? 'block' : 'none';
  };
  for (const d of root.querySelectorAll('details')) {
    if (S.closed[d.dataset.s]) d.open = false;
    d.addEventListener('toggle', () => { S.closed[d.dataset.s] = !d.open; save(); });
  }

  let flashT;
  function flash(msg, err) {
    const f = $('f'); f.textContent = msg; f.className = 'f' + (err ? ' err' : '');
    clearTimeout(flashT); flashT = setTimeout(() => { f.textContent = ''; }, 3000);
  }

  const heroSel = () => $('hero').value || '*';
  const heroLabel = () => heroSel() === '*' ? 'all heroes' : $('hero').selectedOptions[0].textContent.replace(/ \(.*$/, '');

  const actions = {
    close: () => { S.open = false; save(); place(); },
    setGold: () => { const n = num($('gold').value); if (n == null) return flash('Enter a number', true);
      update(g => ({ ...g, gold: n }), `Gold set to ${n.toLocaleString()}`); if (S.lockGold) { S.lockValue = n; save(); } },
    g10k: () => addGold(10000), g100k: () => addGold(100000), g1m: () => addGold(1000000),
    setRenown: () => { const n = num($('renown').value); if (n == null) return flash('Enter a number', true);
      update(g => ({ ...g, renown: n }), `Renown set to ${n}`); },
    r100: () => update(g => ({ ...g, renown: (g.renown || 0) + 100 }), '+100 renown'),
    patron: () => update(g => ({ ...g, patronConfidence: 100 }), 'Patron confidence 100'),
    fresh: () => update(g => mapHeroes(g, heroSel(), fresh), `Rested ${heroLabel()}`),
    heal: () => update(g => mapHeroes(g, heroSel(), healOnly), `Healed ${heroLabel()}`),
    setLvl: () => { const n = num($('lvl').value); if (n == null || n < 1 || n > 20) return flash('Level must be 1–20', true);
      update(g => mapHeroes(g, heroSel(), setLevel(n)), `Level ${n}: ${heroLabel()}`); },
    maxLvl: () => update(g => mapHeroes(g, heroSel(), setLevel(20)), `Level 20: ${heroLabel()}`),
    maxAttr: () => update(g => mapHeroes(g, heroSel(), maxAttrs), `Maxed attributes: ${heroLabel()}`),
    maxPot: () => update(g => mapHeroes(g, heroSel(), maxPotential), `Max potential: ${heroLabel()}`),
    recruit: () => {
      const src = $('src').value, id = $('cand').value;
      if (!src || !id) return flash('Pick a hero first', true);
      const name = $('cand').selectedOptions[0].textContent.split(' · ')[0];
      update(p => recruit(p, src, id), `${name} joined the guild`);
      setTimeout(() => { lastSrcKey = ''; refreshRecruit(true); }, 50);
    },
    hallUp: () => {
      const g = guild(); if (!g) return flash('No guild loaded yet', true);
      if ((g.hall.level || 1) >= HALL_MAX) return flash('Hall is already at max level', true);
      update(p => ({ ...p, hall: { ...p.hall, level: Math.min(HALL_MAX, (p.hall.level || 1) + 1) } }), `Hall upgraded to level ${(g.hall.level || 1) + 1}`);
      setTimeout(() => refreshRecruit(true), 50);
    },
    forge: () => {
      const fam = FAMILIES[+$('fam').value], rar = $('rar').value, pow = +$('pow').value, qty = +$('qty').value;
      const g = guild(); if (!g) return flash('No guild loaded yet', true);
      const items = Array.from({ length: qty }, () => makeItem(fam, rar, pow, g.day));
      update(p => ({ ...p, stash: [...items, ...(p.stash || [])] }), `Forged ${qty}× ${items[0].name} into the stash`);
    },
    builds: () => update(finishBuilds, 'Builds finish at the next day tick'),
  };
  function addGold(n) {
    update(g => ({ ...g, gold: (g.gold || 0) + n }), `+${n.toLocaleString()} gold`);
    if (S.lockGold) setTimeout(() => { const g = guild(); if (g) { S.lockValue = g.gold; save(); } }, 50);
  }

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-a]'); if (a && actions[a.dataset.a]) actions[a.dataset.a]();
  });
  for (const id of ['lockGold', 'fresh', 'autoBuild']) {
    $(id).checked = !!S[id];
    $(id).addEventListener('change', () => {
      S[id] = $(id).checked;
      if (id === 'lockGold' && S.lockGold) { const g = guild(); S.lockValue = g ? g.gold : 0; flash(`Gold locked at ${S.lockValue.toLocaleString()}`); }
      save();
    });
  }
  // keep typing in the menu from triggering game hotkeys
  for (const t of ['keydown', 'keyup', 'keypress']) host.addEventListener(t, e => { if (e.key !== 'F8') e.stopPropagation(); });

  // dragging
  root.querySelector('.h').addEventListener('mousedown', e => {
    if (e.target.closest('.x')) return;
    const ox = e.clientX - S.x, oy = e.clientY - S.y;
    const mv = ev => { S.x = ev.clientX - ox; S.y = ev.clientY - oy; place(); };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); save(); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'F8') { e.preventDefault(); e.stopPropagation(); S.open = !S.open; save(); place(); }
  }, true);
  window.addEventListener('resize', place);

  // ---------- recruit lists ----------
  let lastSrcKey = '', lastCandKey = '';
  const heroAbility = h => h.currentAbility || 0;
  function refreshRecruit(force) {
    const g = guild(); if (!g) return;
    const srcs = sources(g);
    const sk = srcs.map(s => s.key + ':' + s.heroes.length).join('|');
    const sel = $('src');
    if (force || sk !== lastSrcKey) {
      lastSrcKey = sk;
      const prev = sel.value;
      sel.innerHTML = srcs.map(s => `<option value="${esc(s.key)}">${esc(s.label)} (${s.heroes.length})</option>`).join('');
      if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
      lastCandKey = '';
    }
    const src = srcs.find(s => s.key === sel.value) || srcs[0];
    const ck = src ? src.key + ':' + src.heroes.map(h => h.id).join(',') : '';
    if (force || ck !== lastCandKey) {
      lastCandKey = ck;
      const cand = $('cand'), prev = cand.value;
      const list = src ? src.heroes.slice().sort((a, b) => heroAbility(b) - heroAbility(a)) : [];
      cand.innerHTML = list.length
        ? list.map(h => `<option value="${esc(h.id)}">${esc(h.name)} · Lv ${h.level} ${esc(h.classId || '')} · ★${stars(heroAbility(h))}/${stars(h.potentialAbility || 0)}</option>`).join('')
        : '<option value="">(nobody here)</option>';
      if ([...cand.options].some(o => o.value === prev)) cand.value = prev;
    }
    $('beds').textContent = `Roster ${g.roster.length} · beds ${bedsFor(g)}`;
  }
  $('src').addEventListener('change', () => { lastCandKey = ''; refreshRecruit(); });

  // ---------- tick: status + toggles ----------
  let rosterKey = '';
  function tick() {
    const g = guild();
    if (!g) { $('st').textContent = 'Waiting for a guild… (load a save)'; return; }
    $('st').innerHTML = `<b>${esc(g.name || 'Guild')}</b> · Day ${g.day} · ${(g.gold || 0).toLocaleString()} gold · ${g.renown || 0} renown`;

    const key = g.roster.map(a => a.id + a.name + a.level).join('|');
    if (key !== rosterKey) {
      rosterKey = key;
      const sel = $('hero'), prev = sel.value;
      sel.innerHTML = '<option value="*">All heroes</option>' +
        g.roster.map(a => `<option value="${esc(a.id)}">${esc(a.name)} (Lv ${a.level} ${esc(a.classId)})</option>`).join('');
      if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
    }
    refreshRecruit();

    const needGold = S.lockGold && (g.gold || 0) < S.lockValue;
    const needFresh = S.fresh && g.roster.some(a => !isFresh(a));
    const needBuild = S.autoBuild && g.hall && Array.isArray(g.hall.builds) && g.hall.builds.some(b => b.completeDay > g.day);
    if (needGold || needFresh || needBuild) {
      update(p => {
        let n = p;
        if (needGold && (n.gold || 0) < S.lockValue) n = { ...n, gold: S.lockValue };
        if (needFresh) n = { ...n, roster: n.roster.map(a => isFresh(a) ? a : fresh(a)) };
        if (needBuild) n = finishBuilds(n);
        return n;
      });
    }
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function mount() {
    if (!document.body) return setTimeout(mount, 200);
    document.body.appendChild(host);
    place();
    tick();
    setInterval(tick, 1000);
    console.log('[ddmm] mod menu loaded — F8 to toggle');
  }
  mount();
})();
