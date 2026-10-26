// ===== Chord engine (pure, no DOM) =====
const Engine = (() => {
  const LET = "CDEFGAB";
  const NAT = [0, 2, 4, 5, 7, 9, 11];
  const ACC = { "-2": "𝄫", "-1": "♭", "0": "", "1": "♯", "2": "𝄪" };
  const r = (l, a = 0) => ({ l, a });

  const ROOTS_DEFAULT = {
    0: [r(0)], 1: [r(1, -1)], 2: [r(1)], 3: [r(2, -1)], 4: [r(2)], 5: [r(3)],
    6: [r(3, 1)], 7: [r(4)], 8: [r(5, -1)], 9: [r(5)], 10: [r(6, -1)], 11: [r(6)],
  };
  // Option E: both enharmonic spellings on black keys + Cb / E#
  const ROOTS_EXT = {
    0: [r(0)], 1: [r(0, 1), r(1, -1)], 2: [r(1)], 3: [r(1, 1), r(2, -1)], 4: [r(2)],
    5: [r(3), r(2, 1)], 6: [r(3, 1), r(4, -1)], 7: [r(4)], 8: [r(4, 1), r(5, -1)],
    9: [r(5)], 10: [r(5, 1), r(6, -1)], 11: [r(6), r(0, -1)],
  };
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const PC_NAMES = ["C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭", "G", "G♯/A♭", "A", "A♯/B♭", "B"];

  // tension id -> [semitones, degree]
  // "b5" / "#5" are dominant-only spellings of #11 / b13 that replace the perfect 5th
  const TEN = { "b5": [6, 5], "#5": [8, 5], "b9": [1, 9], "9": [2, 9], "#9": [3, 9], "11": [5, 11], "#11": [6, 11], "b13": [8, 13], "13": [9, 13] };
  const TEN_ORDER = ["b5", "#5", "b9", "9", "#9", "11", "#11", "b13", "13"];
  const ALT_SET = ["b9", "#9", "#11", "b13"];

  const T3 = [[0, 1], [4, 3], [7, 5]], t3 = [[0, 1], [3, 3], [7, 5]];
  const O5 = [7, 5, "opt"], O9 = [2, 9, "opt"]; // tones that may be left out (practical voicing)
  // id, group, name, w (weight: how often it is asked, max/min ≈ 3x), tones [semi, degree, "opt"?],
  // std labels, symbol labels (option D), 7th?, tensions allowed by option C, dominant?
  const TYPES = [
    { id: "maj", group: "triad", name: "Major", w: 3, tones: T3, std: [""], sym: [] },
    { id: "min", group: "triad", name: "minor", w: 3, tones: t3, std: ["m"], sym: ["-"] },
    { id: "dim", group: "triad", name: "dim", w: 1.4, tones: [[0, 1], [3, 3], [6, 5]], std: ["dim"], sym: ["°"] },
    { id: "aug", group: "triad", name: "aug", w: 1.2, tones: [[0, 1], [4, 3], [8, 5]], std: ["aug"], sym: ["+"] },

    { id: "sus4", group: "sus", name: "sus4", w: 2, tones: [[0, 1], [5, 4], [7, 5]], std: ["sus4"], sym: [] },
    { id: "sus2", group: "sus", name: "sus2", w: 1, tones: [[0, 1], [2, 2], [7, 5]], std: ["sus2"], sym: [] },

    { id: "M7", group: "seventh", name: "M7", w: 2.6, tones: [...T3, [11, 7]], std: ["M7"], sym: ["△7", "△"], seventh: true, ten: ["9", "#11", "13"] },
    { id: "m7", group: "seventh", name: "m7", w: 3, tones: [...t3, [10, 7]], std: ["m7"], sym: ["-7"], seventh: true, ten: ["9", "11"] },
    { id: "dom7", group: "seventh", name: "7", w: 3, tones: [...T3, [10, 7]], std: ["7"], sym: [], seventh: true, ten: ["b9", "9", "#9", "#11", "b13", "13"], dominant: true },
    { id: "7sus4", group: "seventh", name: "7sus4", w: 1.8, tones: [[0, 1], [5, 4], [7, 5], [10, 7]], std: ["7sus4"], sym: [], seventh: true, ten: ["b9", "9", "13"] },
    { id: "aug7", group: "seventh", name: "aug7", w: 1.2, tones: [[0, 1], [4, 3], [8, 5], [10, 7]], std: ["aug7"], sym: ["+7"], seventh: true, ten: ["9", "#11"] },
    { id: "dim7", group: "seventh", name: "dim7", w: 1.5, tones: [[0, 1], [3, 3], [6, 5], [9, 7]], std: ["dim7"], sym: ["°7"], seventh: true, ten: [] },
    { id: "m7b5", group: "seventh", name: "m7(♭5)", w: 2, tones: [[0, 1], [3, 3], [6, 5], [10, 7]], std: ["m7(♭5)"], sym: ["ø7", "ø", "-7(♭5)"], seventh: true, ten: ["9", "11", "b13"], maxTen: 1 },  // (♭5) already reads like a tension
    { id: "mM7", group: "seventh", name: "mM7", w: 1, tones: [...t3, [11, 7]], std: ["mM7"], sym: ["-△7", "m△7"], seventh: true, ten: ["9", "11"], maxTen: 1 },
    { id: "augM7", group: "seventh", name: "augM7", w: 1, tones: [[0, 1], [4, 3], [8, 5], [11, 7]], std: ["augM7"], sym: ["+△7"], seventh: true, ten: [] },

    { id: "6", group: "sixth", name: "6", w: 1.5, tones: [...T3, [9, 6]], std: ["6"], sym: [] },
    { id: "m6", group: "sixth", name: "m6", w: 1.3, tones: [...t3, [9, 6]], std: ["m6"], sym: ["-6"] },

    { id: "add9", group: "add", name: "add9", w: 2, tones: [...T3, [2, 9]], std: ["add9"], sym: [] },
    { id: "madd9", group: "add", name: "madd9", w: 1.3, tones: [...t3, [2, 9]], std: ["madd9"], sym: ["-add9"] },
    { id: "69", group: "add", name: "6(9)", w: 1.2, tones: [...T3, [9, 6], [2, 9]], std: ["6(9)"], sym: [] },

    // tension chords: 3rd, 7th and the top tension are required; 5th and inner tensions may be omitted; 11 is not used on M13 / 13
    { id: "M9", group: "tension", name: "M9", w: 1.8, tones: [[0, 1], [4, 3], O5, [11, 7], [2, 9]], std: ["M9"], sym: ["△9"], seventh: true, ten: ["#11", "13"] },
    { id: "M13", group: "tension", name: "M13", w: 1.2, tones: [[0, 1], [4, 3], O5, [11, 7], O9, [9, 13]], std: ["M13"], sym: ["△13"], seventh: true, ten: ["#11"] },
    { id: "m9", group: "tension", name: "m9", w: 2, tones: [[0, 1], [3, 3], O5, [10, 7], [2, 9]], std: ["m9"], sym: ["-9"], seventh: true, ten: ["11"] },
    { id: "m11", group: "tension", name: "m11", w: 1.5, tones: [[0, 1], [3, 3], O5, [10, 7], O9, [5, 11]], std: ["m11"], sym: ["-11"], seventh: true, ten: [] },
    { id: "dom9", group: "tension", name: "9", w: 2.2, tones: [[0, 1], [4, 3], O5, [10, 7], [2, 9]], std: ["9"], sym: [], seventh: true, ten: ["#11", "b13", "13"], dominant: true },
    { id: "dom13", group: "tension", name: "13", w: 2, tones: [[0, 1], [4, 3], O5, [10, 7], O9, [9, 13]], std: ["13"], sym: [], seventh: true, ten: ["b9", "#9", "#11"], dominant: true },
  ];
  const BY_ID = Object.fromEntries(TYPES.map(t => [t.id, t]));

  const accStr = a => ACC[String(a)] ?? (a > 0 ? "♯".repeat(a) : "♭".repeat(-a));
  const nameOf = (l, a) => LET[l] + accStr(a);
  const pcOf = (l, a) => (((NAT[l] + a) % 12) + 12) % 12;
  const tenText = id => id.replace("b", "♭").replace("#", "♯");
  const pickWeighted = (arr, rnd) => {
    const total = arr.reduce((s, t) => s + (t.w || 1), 0);
    let x = rnd() * total;
    for (const t of arr) { x -= t.w || 1; if (x < 0) return t; }
    return arr[arr.length - 1];
  };

  function spellTone(root, semi, deg) {
    const l = (root.l + deg - 1) % 7;
    const target = (pcOf(root.l, root.a) + semi) % 12;
    const a = ((target - NAT[l] + 18) % 12) - 6;
    return { l, a, pc: target, name: nameOf(l, a) };
  }

  // easiest name for a pitch class; dir > 0 prefers ♯, dir < 0 prefers ♭ on black keys
  function simpleName(pc, dir) {
    const w = NAT.indexOf(pc);
    if (w >= 0) return LET[w];
    return dir > 0 ? LET[NAT.indexOf(pc - 1)] + "♯" : LET[NAT.indexOf((pc + 1) % 12)] + "♭";
  }

  const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

  function rootPool(s) {
    if (s.optA) return WHITE.slice();
    if (s.optB) return s.bases.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    return [...Array(12).keys()];
  }

  function chooseTensions(type, max, rnd) {
    const w = max >= 2 ? [0.25, 0.4, 0.35] : [0.4, 0.6];
    let x = rnd(), n = 0;
    while (n < w.length - 1 && x > w[n]) { x -= w[n]; n++; }
    const pool = type.ten.slice();
    const out = [];
    if (!pool.length) return out;
    while (out.length < n && pool.length) {
      const t = pick(pool, rnd);
      pool.splice(pool.indexOf(t), 1);
      const ok = out.every(o => TEN[o][1] !== TEN[t][1] || (new Set([o, t]).has("b9") && new Set([o, t]).has("#9")));
      if (ok) out.push(t);
    }
    return out.sort((a, b) => TEN_ORDER.indexOf(a) - TEN_ORDER.indexOf(b));
  }

  // returns { head, items }: items are the parenthesised alterations/tensions, lowest first
  function makeLabel(type, tens, alt, useSym, rnd) {
    if (alt) return { head: "7alt", items: [] };
    let variants = type.std.concat(useSym ? type.sym : []);
    if (tens.length) variants = variants.filter(v => v !== "ø" && v !== "△");
    const v = pick(variants, rnd);
    const m = v.match(/^(.*)\((.*)\)$/);
    const head = m ? m[1] : v;
    const items = (m ? m[2].split(",") : []).concat(tens.map(tenText));
    return { head, items };
  }

  // returns {error} or question
  function generate(s, rnd = Math.random, prevSymbol = null) {
    const types = TYPES.filter(t => s.types[t.id]);
    if (!types.length) return { error: "noTypes" };   // error codes; the UI translates them
    const pcs = rootPool(s);
    if (!pcs.length) return { error: "noBases" };

    for (let tries = 0; tries < 80; tries++) {
      const type = pickWeighted(types, rnd);
      const pc = pick(pcs, rnd);
      const spellings = s.optA ? ROOTS_DEFAULT[pc] : (s.optE ? ROOTS_EXT : ROOTS_DEFAULT)[pc];
      const root = pick(spellings, rnd);

      let tens = [], alt = false;
      if (s.optC && type.seventh) {
        if (type.id === "dom7" && rnd() < 0.1) alt = true;
        else tens = chooseTensions(type, Math.min(s.cMax, type.maxTen || 9), rnd);
        // dominant family: write b13 as #5 or #11 as b5 about half the time (only one of them per chord)
        if (type.dominant && !alt) {
          const swaps = [["b13", "#5"], ["#11", "b5"]].filter(([a]) => tens.includes(a));
          if (swaps.length === 1 && rnd() < 0.5) {   // with both #11 and b13 present, keep the tension spelling
            const [from, to] = pick(swaps, rnd);
            tens = tens.map(t => (t === from ? to : t));
          }
          tens.sort((a, b) => TEN_ORDER.indexOf(a) - TEN_ORDER.indexOf(b));
        }
      }
      const replaces5 = tens.includes("#5") || tens.includes("b5");
      const tenDegs = new Set(tens.map(t => TEN[t][1]));

      const tones = [];
      const required = new Set(), optional = new Set(), anyOf = new Set();
      if (alt) {
        for (const [semi, deg] of [[0, 1], [4, 3], [10, 7]]) {
          const t = spellTone(root, semi, deg); tones.push({ ...t, role: "chord", semi }); required.add(t.pc);
        }
        const p5 = spellTone(root, 7, 5); optional.add(p5.pc);
        for (const id of ALT_SET) {
          const t = spellTone(root, TEN[id][0], TEN[id][1]); tones.push({ ...t, role: "alt", semi: TEN[id][0], ten: id }); anyOf.add(t.pc);
        }
      } else {
        for (const [semi, deg, flag] of type.tones) {
          if (replaces5 && semi === 7 && deg === 5) continue;      // #5 / b5 takes the 5th's place: P5 is wrong
          if (flag === "opt" && tenDegs.has(deg)) continue;         // e.g. C13(b9): the natural 9 is gone
          const t = spellTone(root, semi, deg);
          const omittable = flag === "opt" || (tens.length > 0 && semi === 7 && deg === 5);
          tones.push({ ...t, role: omittable ? "optional" : "chord", semi, deg });
          (omittable ? optional : required).add(t.pc);
        }
        for (const id of tens) {
          const t = spellTone(root, TEN[id][0], TEN[id][1]);
          tones.push({ ...t, role: "tension", semi: TEN[id][0], ten: id }); required.add(t.pc);
        }
      }
      // skip spellings no chart would use (triple accidentals, or 2+ double accidentals)
      if (tones.some(t => Math.abs(t.a) > 2)) continue;
      if (tones.filter(t => Math.abs(t.a) === 2).length >= 2) continue;
      // display names: option E keeps strict spelling (C♭ E♯ A𝄫 F𝄪); otherwise use the easy name
      for (const t of tones) {
        const odd = (t.l === 0 || t.l === 3) && t.a === -1 || (t.l === 2 || t.l === 6) && t.a === 1;
        if (!s.optE && (Math.abs(t.a) === 2 || odd)) t.name = simpleName(t.pc, t.a);
      }

      const rootName = nameOf(root.l, root.a);
      const { head, items } = makeLabel(type, tens, alt, s.optD, rnd);
      const label = head + (items.length ? "(" + items.join(",") + ")" : "");
      const symbol = rootName + label;
      if (symbol === prevSymbol && tries < 79) continue;
      return { symbol, rootName, label, head, items, rootPc: pc, type: type.id, group: type.group, tens, alt, tones, required, optional, anyOf };
    }
    return { error: "noChord" };
  }

  function grade(selected, q) {
    const sel = new Set([...selected].map(m => ((m % 12) + 12) % 12));
    let extra = 0, missing = 0;
    for (const pc of sel) if (!q.required.has(pc) && !q.optional.has(pc) && !q.anyOf.has(pc)) extra++;
    for (const pc of q.required) if (!sel.has(pc)) missing++;
    const anyOk = q.anyOf.size === 0 || [...q.anyOf].some(pc => sel.has(pc));
    if (!anyOk) missing++;
    return { correct: sel.size > 0 && extra === 0 && missing === 0, extra, missing, anyOk };
  }

  // a playable voicing inside MIDI 48..72
  function voicing(q) {
    const root = 48 + q.rootPc;
    const out = [];
    for (const t of q.tones) {
      if (t.role === "alt" && !(t.ten === "#9" || t.ten === "b13")) continue;
      let m = root + t.semi;
      const deg = t.ten ? TEN[t.ten][1] : t.deg;
      if (deg >= 9) { m = root + 12 + t.semi; if (m > 72) m -= 12; }
      out.push(m);
    }
    return [...new Set(out)].sort((a, b) => a - b);
  }

  return { TYPES, BY_ID, PC_NAMES, TEN, generate, grade, voicing, tenText, spellTone, simpleName };
})();
if (typeof module !== "undefined") module.exports = Engine;
