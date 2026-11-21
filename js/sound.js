"use strict";
/* Sons du jeu, générés à la volée (Web Audio) : aucun fichier à charger.
   SFX.play("harvest") — les sons sont courts et doux, coupables dans les paramètres. */
const SFX = (() => {
  /* Ambiance « cozy » : instruments doux (kalimba, marimba, carillon, bois), attaques arrondies,
     filtre passe-bas pour enlever le côté électronique et une petite réverbération de pièce. */
  let ctx = null, master = null, dry = null, wet = null;
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      const warm = ctx.createBiquadFilter(); warm.type = "lowpass"; warm.frequency.value = 3800; warm.Q.value = .4;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
      // Réverbération : réponse impulsionnelle générée (bruit qui s'éteint doucement).
      const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      const rev = ctx.createConvolver(); rev.buffer = ir;
      dry = ctx.createGain(); dry.gain.value = .85; wet = ctx.createGain(); wet.gain.value = .28;
      master.connect(warm); warm.connect(dry); warm.connect(rev); rev.connect(wet);
      dry.connect(comp); wet.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    master.gain.value = (S?.settings?.volume ?? .6) * .55;
    return ctx;
  };
  const at = t0 => ctx.currentTime + t0;
  // Note pincée (kalimba / marimba) : fondamentale + harmonique douce, extinction rapide.
  const pluck = (f, t0 = 0, v = .35, d = .9, bright = .25) => {
    const t = at(t0), g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    g.connect(master);
    [[1, 1], [4.01, bright * .35], [2, bright]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.value = f * m;
      og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(.0001, t + d * (m === 1 ? 1 : .35));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + d + .05);
    });
  };
  // Clochette / carillon : partiels inharmoniques, longue résonance.
  const bell = (f, t0 = 0, v = .18, d = 1.8) => {
    const t = at(t0);
    [[1, 1], [2.76, .35], [5.4, .12]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * a, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + d / m ** .5);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .05);
    });
  };
  // Goutte d'eau : sinus qui monte vite, très court.
  const drop = (f, t0 = 0, v = .22) => {
    const t = at(t0), o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + .07);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .12);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .15);
  };
  // Souffle filtré (terre, feuilles, eau qui coule).
  const hush = (t0, d, freq, q, v = .2, type = "bandpass") => {
    const n = Math.floor(ctx.sampleRate * d), buf = ctx.createBuffer(1, n, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const e = i / n; data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * e) * (1 - e * .5); }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = at(t0);
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = v;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  };
  // Petit coup de bois (bloc de marimba grave).
  const wood = (f, t0 = 0, v = .3) => pluck(f, t0, v, .25, .1);
  // Gamme pentatonique majeure (do) : tout sonne bien ensemble.
  const N = { C4: 261.6, D4: 293.7, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5 };
  const SOUNDS = {
    plant: () => { hush(0, .18, 700, .8, .25, "lowpass"); wood(N.C4, .03, .22); },
    water: () => { hush(0, .45, 1800, .6, .12); [0, .07, .16, .24].forEach((t, i) => drop(900 + i * 180 + Math.random() * 120, t, .14)); },
    harvest: () => { pluck(N.G4, 0, .3); pluck(N.C5, .08, .26); },
    double: () => { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => pluck(f, i * .085, .26)); bell(N.C6, .34, .1); },
    coin: () => { bell(N.E5 * 2, 0, .09, 1.1); bell(N.A5 * 2, .07, .07, 1.2); },
    snail: () => { hush(0, .22, 450, 1.2, .22, "lowpass"); wood(N.D4 * .75, .02, .25); },
    butterfly: () => { [N.E5, N.G5, N.A5].forEach((f, i) => pluck(f * 2, i * .06, .12, .5, .4)); hush(0, .3, 3000, .5, .05); },
    cook: () => { bell(N.G5, 0, .16, 2); bell(N.C6, .12, .1, 2); },
    success: () => { [N.C5, N.E5, N.G5].forEach((f, i) => pluck(f, i * .1, .26)); bell(N.C6, .3, .12); },
    level: () => { [N.C4, N.E4, N.G4, N.C5].forEach((f, i) => pluck(f, i * .09, .28, 1.1)); [N.E5, N.G5].forEach((f, i) => bell(f, .42 + i * .1, .12, 2.2)); },
    discover: () => { [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6].forEach((f, i) => bell(f, i * .09, .11, 2)); hush(0, 1.2, 4000, .4, .04); },
    click: () => wood(N.G4, 0, .15),
  };
  return {
    play(name) {
      if (!S?.settings?.sound || !SOUNDS[name]) return;
      try { if (ensure()) SOUNDS[name](); } catch (e) {}
    },
    unlock() { try { if (S?.settings?.sound) ensure(); } catch (e) {} },
  };
})();
// Les navigateurs n'autorisent le son qu'après un premier geste du joueur.
addEventListener("pointerdown", () => SFX.unlock(), { once: true });

/* ---------------- Notifications ---------------- */
const NOTIF = (() => {
  const supported = () => "Notification" in window && "serviceWorker" in navigator;
  const last = {};
  async function show(kind, title, body) {
    if (!S?.settings?.notif || !supported() || Notification.permission !== "granted" || !document.hidden) return;
    if (last[kind] && Date.now() - last[kind] < 10 * 60000) return; // au plus une par type toutes les 10 min
    last[kind] = Date.now();
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const opts = { body, tag: kind, icon: "icons/icon-192.png", badge: "icons/favicon-64.png", renotify: true };
      if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
    } catch (e) {}
  }
  async function enable() {
    if (!supported()) return "unsupported";
    const p = await Notification.requestPermission();
    return p;
  }
  return { supported, show, enable };
})();
