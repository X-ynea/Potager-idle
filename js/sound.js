"use strict";
/* Sons du jeu, générés à la volée (Web Audio) : aucun fichier à charger.
   SFX.play("harvest") — les sons sont courts et doux, coupables dans les paramètres. */
const SFX = (() => {
  let ctx = null, master = null;
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    master.gain.value = (S?.settings?.volume ?? .6) * .5;
    return ctx;
  };
  // Une note : forme d'onde, fréquence (avec glissé optionnel), début, durée, volume.
  const tone = (type, f1, f2, t0, d, v = .5) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f1, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .02);
  };
  // Bruit filtré (eau, froissement).
  const noise = (t0, d, freq, q, v = .4) => {
    const n = Math.floor(ctx.sampleRate * d), buf = ctx.createBuffer(1, n, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + t0;
    s.buffer = buf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  };
  const SOUNDS = {
    plant: () => { tone("sine", 220, 140, 0, .12, .5); noise(0, .08, 900, 1, .15); },
    water: () => { for (let i = 0; i < 4; i++) tone("sine", 600 + Math.random() * 500, 1200 + Math.random() * 500, i * .05, .08, .18); noise(0, .25, 2500, .8, .12); },
    harvest: () => { tone("triangle", 520, 880, 0, .12, .45); tone("sine", 880, 1320, .07, .14, .3); },
    double: () => { [660, 880, 1100, 1320].forEach((f, i) => tone("triangle", f, f * 1.02, i * .07, .16, .35)); },
    coin: () => { tone("square", 1320, 0, 0, .07, .12); tone("square", 1760, 0, .06, .16, .12); },
    snail: () => { tone("sine", 300, 120, 0, .18, .35); noise(0, .1, 600, 2, .15); },
    butterfly: () => { [1500, 1900, 1700].forEach((f, i) => tone("sine", f, f * 1.15, i * .05, .07, .18)); },
    cook: () => { tone("sine", 1046, 0, 0, .6, .3); tone("sine", 1568, 0, 0, .4, .12); },
    success: () => { [523, 659, 784, 1046].forEach((f, i) => tone("triangle", f, 0, i * .09, .25, .3)); },
    level: () => { [523, 659, 784].forEach((f, i) => tone("triangle", f, 0, i * .1, .2, .32)); [1046, 1318].forEach(f => tone("triangle", f, 0, .32, .55, .25)); },
    discover: () => { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone("sine", f, 0, i * .07, .35, .25)); },
    click: () => tone("sine", 700, 500, 0, .05, .15),
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
