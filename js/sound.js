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
      const warm = ctx.createBiquadFilter(); warm.type = "lowpass"; warm.frequency.value = 2200; warm.Q.value = .3;
      const warm2 = ctx.createBiquadFilter(); warm2.type = "lowpass"; warm2.frequency.value = 2600; warm2.Q.value = .3;
      // Coupe aussi un peu la zone 2,5–4 kHz, celle que l'oreille trouve perçante.
      const tame = ctx.createBiquadFilter(); tame.type = "peaking"; tame.frequency.value = 3000; tame.Q.value = .8; tame.gain.value = -6;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
      // Réverbération : réponse impulsionnelle générée (bruit qui s'éteint doucement).
      const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      const rev = ctx.createConvolver(); rev.buffer = ir;
      dry = ctx.createGain(); dry.gain.value = .8; wet = ctx.createGain(); wet.gain.value = .32;
      master.connect(warm); warm.connect(warm2); warm2.connect(tame); tame.connect(dry); tame.connect(rev); rev.connect(wet);
      dry.connect(comp); wet.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    master.gain.value = (S?.settings?.volume ?? .6) * .45;
    return ctx;
  };
  const at = t0 => ctx.currentTime + t0;
  // Note pincée (kalimba / marimba) : fondamentale + harmonique douce, extinction rapide.
  const pluck = (f, t0 = 0, v = .35, d = .9, bright = .12) => {
    const t = at(t0), g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .018); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    g.connect(master);
    [[1, 1], [2, bright]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = "sine"; o.frequency.value = f * m;
      og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(.0001, t + d * (m === 1 ? 1 : .35));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + d + .05);
    });
  };
  // Clochette / carillon : partiels inharmoniques, longue résonance.
  const bell = (f, t0 = 0, v = .18, d = 1.8) => {
    const t = at(t0);
    [[1, 1], [2.76, .16], [5.4, .03]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * a, t + .014); g.gain.exponentialRampToValueAtTime(.0001, t + d / m ** .5);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .05);
    });
  };
  // Goutte d'eau : sinus qui monte vite, très court.
  const drop = (f, t0 = 0, v = .22) => {
    const t = at(t0), o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + .08);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .12);
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
    plant: () => { hush(0, .18, 500, .8, .22, "lowpass"); wood(N.C4 / 2, .03, .24); },
    water: () => { hush(0, .45, 800, .6, .1); [0, .08, .17, .26].forEach((t, i) => drop(420 + i * 70 + Math.random() * 50, t, .12)); },
    harvest: () => { pluck(N.G4 / 2, 0, .3); pluck(N.C4, .09, .26); },
    double: () => { [N.C4, N.E4, N.G4, N.C5].forEach((f, i) => pluck(f, i * .09, .24)); bell(N.C5, .36, .08); },
    coin: () => { bell(N.E5, 0, .07, 1); bell(N.A5, .08, .05, 1.1); },
    snail: () => { hush(0, .22, 380, 1.2, .2, "lowpass"); wood(N.D4 * .375, .02, .25); },
    butterfly: () => { [N.E4, N.G4, N.A4].forEach((f, i) => pluck(f * 1.5, i * .07, .12, .5, .15)); hush(0, .3, 1100, .5, .04); },
    cook: () => { bell(N.G4, 0, .14, 2); bell(N.C5, .13, .09, 2); },
    success: () => { [N.C4, N.E4, N.G4].forEach((f, i) => pluck(f, i * .1, .25)); bell(N.C5, .32, .09); },
    level: () => { [N.C4 / 2, N.E4 / 2, N.G4 / 2, N.C4].forEach((f, i) => pluck(f, i * .1, .28, 1.1)); [N.E4, N.G4].forEach((f, i) => bell(f, .45 + i * .12, .1, 2.2)); },
    discover: () => { [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5].forEach((f, i) => bell(f, i * .1, .09, 2)); hush(0, 1.2, 1400, .4, .03); },
    click: () => wood(N.G4 / 2, 0, .14),
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
  async function show(kind, title, body, gap = 10 * 60000) {
    if (!S?.settings?.notif || !supported() || Notification.permission !== "granted" || !document.hidden) return;
    if (last[kind] && Date.now() - last[kind] < gap) return; // au plus une par type toutes les 10 min (moins pour les messages)
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
