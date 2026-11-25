"use strict";
/* ---------------- Échanges entre amis et boîte aux lettres ----------------
   Fonctions serveur : docs/echanges.sql (règles vérifiées aussi par le serveur).
   · Objets contre objets (plantes et plats), ou objets contre pièces. Jamais pièces contre pièces.
   · Valeur = prix de vente au marché ; écart de 20 % au plus ; 3 000 de valeur au plus par côté ; 3 propositions par jour.
   · Anti-spoil : on ne propose que ce que l'ami a découvert ; dans son inventaire, ce qu'on n'a pas découvert est masqué.
   · Ce qu'on propose quitte la partie dès l'envoi ; ça revient si l'ami refuse, si on annule ou au bout de 48 h.
   La boîte aux lettres (dans le jardin) rassemble les propositions reçues, envoyées, et les nouvelles. */
const TR_MAX = 3000, TR_GAP = 1.2, TR_DAY = 3, TR_HOURS = 48, TR_ITEMS = 8;
const TR = { list: [], loaded: false, draft: null, inv: null, invErr: "", sending: false, busy: false, mailTab: "in" };
const TRADE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Boîte aux lettres provisoire (en attendant l'image définitive) : rouge vif, drapeau levé quand il y a du courrier.
const MAIL_ICON = up => `<svg class="mb-art" viewBox="0 0 48 56" aria-hidden="true"><rect x="21" y="30" width="6" height="24" rx="1.5" fill="#8a5a33"/><path d="M8 14a10 10 0 0 1 20 0v18H8z" fill="#b3262b"/><path d="M18 4h12a12 12 0 0 1 12 12v16H28V14A10 10 0 0 0 18 4z" fill="#e2473b"/><path d="M8 32h34v4H8z" fill="#9c1f24"/><ellipse cx="18" cy="22" rx="5" ry="7" fill="#7a171b"/>${up ? `<path d="M38 8v-6" stroke="#5b3a1e" stroke-width="2" stroke-linecap="round"/><path d="M38 2h8l-2 3 2 3h-8z" fill="#ffd23f"/>` : `<path d="M38 22h7" stroke="#5b3a1e" stroke-width="2" stroke-linecap="round"/><path d="M45 22v6h-3z" fill="#ffd23f"/>`}</svg>`;

const trValue = k => (PLANTS[k] || RECIPES[k])?.sell || 0;
const tradable = k => PLANTS[k] ? !PLANTS[k].tuto : !!RECIPES[k];
// Un joueur « connaît » un objet : plante de base toujours, hybride découvert, plat débloqué à son niveau (et ses hybrides découverts).
const knowsItem = (who, k) => PLANTS[k] ? (!PLANTS[k].hybrid || who.hybrids.includes(k)) : RECIPES[k].lvl <= who.level && Object.keys(RECIPES[k].need).every(i => knowsItem(who, i));
const meWho = () => ({ level: S.level, hybrids: S.hybrids || [] });
const sideValue = (items, coins) => coins > 0 ? coins : Object.entries(items || {}).reduce((n, [k, q]) => n + trValue(k) * q, 0);
const haveItems = (items, coins) => coins > 0 ? S.coins >= coins : Object.entries(items || {}).every(([k, q]) => cnt(itemBag(k), k) >= q);
function moveItems(items, coins, sign) { // sign = -1 : retirer de ma partie, +1 : ajouter
  if (coins > 0) S.coins += sign * coins;
  for (const [k, q] of Object.entries(items || {})) { if (!tradable(k)) continue; const bag = itemBag(k); bag[k] = Math.max(0, cnt(bag, k) + sign * q); if (!bag[k]) delete bag[k]; }
}
const trChips = (items, coins) => coins > 0 ? `<span class="tr-chip coins">${coin}<b class="num">${fmt(coins)}</b></span>`
  : Object.entries(items || {}).filter(([k]) => PLANTS[k] || RECIPES[k]).map(([k, q]) => `<span class="tr-chip">${itemArt(k)}<b class="num">${q}</b><small>${itemName(k)}</small></span>`).join("");
const trLeft = iso => { const ms = Date.parse(iso) + TR_HOURS * 3600e3 - Date.now(); return ms <= 0 ? "expire bientôt" : `expire dans ${dur(ms)}`; };
const trAgo = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 2 ? "à l’instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
const trErr = m => /desequilibre/.test(m) ? "L’échange n’est pas assez équilibré." : /plafond/.test(m) ? `Maximum ${fmt(TR_MAX)} pièces de valeur de chaque côté.`
  : /trop_echanges/.test(m) ? `Tu as déjà proposé ${TR_DAY} échanges aujourd’hui.` : /spoil/.test(m) ? "Un de ces objets n’est pas encore découvert."
  : /plus_disponible/.test(m) ? "Cet échange n’est plus disponible." : /pas ami/.test(m) ? "Vous n’êtes plus amis."
  : /function|does not exist|404/.test(m) ? "Les échanges ne sont pas encore prêts sur le serveur (script docs/echanges.sql)." : "Action impossible pour le moment.";

/* ---------- Mes échanges : chargement et récupération des résultats ---------- */
async function loadTrades() {
  if (!friendsReady() || TR.busy) return;
  TR.busy = true;
  try {
    const rows = await CLOUD.rpc("my_trades") || [];
    TR.list = rows; TR.loaded = true;
    // Mes propositions terminées : on récupère une seule fois ce qui revient (le serveur le garantit).
    for (const r of rows.filter(r => r.mine && !r.a_claimed && ["accepted", "refused", "expired"].includes(r.status))) {
      const st = await CLOUD.rpc("claim_trade", { tid: r.id }).catch(() => null);
      if (!st) continue;
      r.a_claimed = true;
      if (st === "accepted") { moveItems(r.want, r.want_coins, 1); toast(`📬 <b>${esc(r.name)}</b> a accepté ton échange ! Tu reçois ${trPlain(r.want, r.want_coins)}.`, 6000); SFX.play("success"); }
      else { moveItems(r.give, r.give_coins, 1); toast(st === "refused" ? `📬 <b>${esc(r.name)}</b> a refusé ton échange : ${trPlain(r.give, r.give_coins)} te ${trBack(r)}.` : `📬 Ton échange avec <b>${esc(r.name)}</b> a expiré : ${trPlain(r.give, r.give_coins)} te ${trBack(r)}.`, 6000); }
      save();
    }
  } catch (e) {}
  TR.busy = false;
  render(true);
}
const trPlain = (items, coins) => coins > 0 ? `${fmt(coins)} pièces` : Object.entries(items || {}).filter(([k]) => PLANTS[k] || RECIPES[k]).map(([k, q]) => `${q} × ${itemName(k)}`).join(", ");
const trBack = r => r.give_coins > 0 || Object.values(r.give || {}).reduce((a, b) => a + b, 0) > 1 ? "sont rendus" : "est rendu";
setInterval(() => { if (friendsReady() && !document.hidden) loadTrades(); }, 60e3);
addEventListener("load", () => setTimeout(loadTrades, 6000));
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(loadTrades, 2000); });

/* ---------- Boîte aux lettres ---------- */
const trIn = () => TR.list.filter(r => !r.mine && r.status === "pending");
const trOut = () => TR.list.filter(r => r.mine && r.status === "pending");
// Nouvelles : arrosages reçus, et ce qui est arrivé à mes propositions et à celles que j'ai reçues.
function mailNews() {
  const n = (S.friendWater || []).filter(w => !w.mine && Date.now() - w.at < 24 * 3600e3).map(w => ({ at: w.at, html: `💧 <b>${esc(w.name)}</b> a arrosé ton jardin.` }));
  for (const r of TR.list) {
    if (r.status === "pending" || !r.decided_at) continue;
    const at = Date.parse(r.decided_at), who = `<b>${esc(r.name)}</b>`;
    if (r.mine) n.push({ at, html: { accepted: `✅ ${who} a accepté ton échange.`, refused: `❌ ${who} a refusé ton échange.`, expired: `⌛ Ton échange avec ${who} a expiré.`, cancelled: `↩️ Tu as annulé ton échange avec ${who}.` }[r.status] });
    else n.push({ at, html: { accepted: `✅ Tu as accepté l’échange de ${who}.`, refused: `❌ Tu as refusé l’échange de ${who}.`, expired: `⌛ L’échange proposé par ${who} a expiré.`, cancelled: `↩️ ${who} a annulé son échange.` }[r.status] });
  }
  return n.filter(x => x.html).sort((a, b) => b.at - a.at);
}
const mailCount = () => FRIENDS_ON ? trIn().length + mailNews().filter(x => x.at > (S.mailSeen || 0)).length : 0;
function mailboxHTML() {
  if (!FRIENDS_ON || !CLOUD.signedIn) return "";
  const n = mailCount();
  return `<button class="mailbox${n ? " has" : ""}" data-act="openMail" aria-label="Boîte aux lettres${n ? ` : ${n} nouveauté${n > 1 ? "s" : ""}` : ""}">${MAIL_ICON(n > 0)}${n ? `<span class="fr-badge">${n}</span>` : ""}</button>`;
}
function tradeCard(r) {
  const who = `<span class="fr-av">${friendAvatar(r.avatar)}</span>`;
  if (r.mine) return `<div class="tr-card">${who}<div class="tr-body"><p class="tr-title">À <b>${esc(r.name)}</b> · <span class="muted">${trLeft(r.created_at)}</span></p>
      <div class="tr-line"><small>Tu donnes</small>${trChips(r.give, r.give_coins)}</div><div class="tr-line"><small>Contre</small>${trChips(r.want, r.want_coins)}</div>
      <div class="tr-acts"><button class="btn ghost sm" data-act="trCancel" data-arg="${r.id}">Annuler</button></div></div></div>`;
  const ok = haveItems(r.want, r.want_coins);
  return `<div class="tr-card">${who}<div class="tr-body"><p class="tr-title"><b>${esc(r.name)}</b> te propose · <span class="muted">${trLeft(r.created_at)}</span></p>
      <div class="tr-line"><small>Tu reçois</small>${trChips(r.give, r.give_coins)}</div><div class="tr-line"><small>Contre</small>${trChips(r.want, r.want_coins)}</div>
      <div class="tr-acts">${ok ? "" : `<span class="small tr-miss">Tu n’en as plus assez</span>`}<button class="btn ghost sm" data-act="trRespond" data-arg="${r.id}:0">Refuser</button><button class="btn sm" data-act="trRespond" data-arg="${r.id}:1" ${ok ? "" : "disabled"}>Accepter</button></div></div></div>`;
}
function viewMail() {
  const inn = trIn(), out = trOut(), news = mailNews(), seen = S.mailSeen || 0;
  const fresh = news.filter(x => x.at > seen).length;
  const tabs = [["in", `Reçus${inn.length ? ` <span class="fr-badge">${inn.length}</span>` : ""}`], ["out", `Envoyés <span class="num">${out.length}</span>`], ["news", `Nouvelles${fresh ? ` <span class="fr-badge">${fresh}</span>` : ""}`]];
  let body;
  if (!TR.loaded) body = `<div class="empty-note"><span>On ouvre la boîte…</span></div>`;
  else if (TR.mailTab === "in") body = inn.length ? inn.map(tradeCard).join("") : `<div class="empty-note"><span>Aucune proposition reçue.<br>Tes amis peuvent t’en faire depuis ton jardin ou vos messages.</span></div>`;
  else if (TR.mailTab === "out") body = out.length ? out.map(tradeCard).join("") : `<div class="empty-note"><span>Aucune proposition en attente.<br>Pour échanger, visite le jardin d’un ami.</span></div>`;
  else body = news.length ? `<div class="mail-news">${news.map(x => `<p class="${x.at > seen ? "new" : ""}"><span>${x.html}</span><small>${trAgo(x.at)}</small></p>`).join("")}</div>` : `<div class="empty-note"><span>Pas de nouvelles pour l’instant.</span></div>`;
  return `<div class="sheet tall mail-sheet" role="dialog" aria-modal="true" aria-label="Boîte aux lettres">
    <div class="sheet-head"><h2>Boîte aux lettres</h2><button class="btn ghost sm" data-act="close">Fermer</button></div>
    <div class="subtabs" style="grid-template-columns:repeat(3,1fr)">${tabs.map(([k, l]) => `<button data-act="mailTab" data-arg="${k}" aria-pressed="${TR.mailTab === k}">${l}</button>`).join("")}</div>
    ${body}</div>`;
}

/* ---------- Fenêtre d'échange ---------- */
const trFriend = () => FR.list.find(x => x.id === TR.draft?.fid);
async function loadInventory() {
  const f = trFriend(); if (!f) return;
  try { const d = await CLOUD.rpc("friend_inventory", { target: f.user_id }); if (TR.draft?.fid !== f.id) return;
    TR.inv = { crops: d?.crops || {}, dishes: d?.dishes || {}, level: +d?.level || 1, hybrids: Array.isArray(d?.hybrids) ? d.hybrids : [], today: +d?.trades_today || 0 }; TR.invErr = ""; }
  catch (e) { TR.invErr = trErr(String(e.message || e)); }
  render(true);
}
// Contrôle du brouillon : renvoie le message qui bloque l'envoi (ou "" si tout va bien) et les deux valeurs.
function trCheck(d) {
  const va = sideValue(d.give, d.giveCoins), vb = sideValue(d.want, d.wantCoins);
  const gap = va && vb ? Math.round((Math.max(va, vb) / Math.min(va, vb) - 1) * 100) : 0;
  let msg = "";
  if (!va) msg = "Choisis ce que tu donnes.";
  else if (!vb) msg = "Choisis ce que tu demandes.";
  else if (d.giveCoins > 0 && d.wantCoins > 0) msg = "Pas de pièces contre des pièces.";
  else if (va > TR_MAX || vb > TR_MAX) msg = `Maximum ${fmt(TR_MAX)} pièces de valeur de chaque côté.`;
  else if (Math.max(va, vb) > TR_GAP * Math.min(va, vb)) msg = `Pas assez équilibré : l’écart est de ${gap} % (20 % au plus).`;
  else if (!haveItems(d.give, d.giveCoins)) msg = d.giveCoins > 0 ? "Tu n’as pas assez de pièces." : "Tu n’en as pas assez.";
  else if (TR.inv && TR.inv.today >= TR_DAY) msg = `Tu as déjà proposé ${TR_DAY} échanges aujourd’hui. Reviens demain !`;
  return { va, vb, gap, msg };
}
function trSide(side, f) {
  const d = TR.draft, give = side === "give", mode = give ? d.giveMode : d.wantMode, items = give ? d.give : d.want, coins = give ? d.giveCoins : d.wantCoins;
  const otherCoins = give ? d.wantMode === "coins" : d.giveMode === "coins";
  const head = `<div class="tr-side-head"><h3>${give ? "Tu donnes" : `Tu demandes à ${esc(f.name)}`}</h3><div class="seg tr-seg"><button data-act="trMode" data-arg="${side}:items" aria-pressed="${mode === "items"}">Objets</button><button data-act="trMode" data-arg="${side}:coins" aria-pressed="${mode === "coins"}" ${otherCoins ? "disabled" : ""}>Pièces</button></div></div>`;
  if (mode === "coins") return `<section class="tr-side">${head}<label class="tr-coins">${coin}<input id="tr-coins-${side}" type="number" inputmode="numeric" min="0" max="${TR_MAX}" step="1" value="${coins || ""}" placeholder="0"><span class="small muted">${give ? `Tu as ${fmt(S.coins)} pièces` : "pièces"}</span></label></section>`;
  // Inventaire : le mien (filtré par ce que l'ami connaît), ou le sien (filtré par ce que je connais).
  const who = give ? { level: TR.inv?.level || 1, hybrids: TR.inv?.hybrids || [] } : meWho();
  const bagOf = k => give ? cnt(itemBag(k), k) : cnt(PLANTS[k] ? TR.inv?.crops || {} : TR.inv?.dishes || {}, k);
  const keys = [...ORDER, ...RORDER].filter(k => tradable(k) && bagOf(k) > 0 && knowsItem(who, k));
  const picked = Object.entries(items).filter(([, q]) => q > 0);
  const hidden = give ? [...ORDER, ...RORDER].filter(k => tradable(k) && bagOf(k) > 0 && !knowsItem(who, k)).length : 0;
  return `<section class="tr-side">${head}
    ${picked.length ? `<div class="tr-picked">${picked.map(([k, q]) => `<button class="tr-chip on" data-act="trSub" data-arg="${side}:${k}" aria-label="Retirer un ${itemName(k)}">${itemArt(k)}<b class="num">${q}</b><small>${itemName(k)}</small><span class="tr-x">−</span></button>`).join("")}</div>` : ""}
    ${!give && !TR.inv ? `<p class="small muted">${TR.invErr ? esc(TR.invErr) : "Chargement de son inventaire…"}</p>`
      : keys.length ? `<div class="tr-grid">${keys.map(k => { const left = bagOf(k) - (items[k] || 0);
        return `<button class="tr-item" data-act="trAdd" data-arg="${side}:${k}" ${left > 0 && (items[k] || picked.length < TR_ITEMS) ? "" : "disabled"} aria-label="${itemName(k)}">${itemArt(k)}<span class="cnt num">${fmt(left)}</span><small>${fmt(trValue(k))}</small></button>`; }).join("")}</div>`
      : `<p class="small muted">${give ? "Rien à proposer pour l’instant." : `${esc(f.name)} n’a rien à échanger pour l’instant.`}</p>`}
    ${hidden ? `<p class="small muted" style="margin:0">${hidden} objet${hidden > 1 ? "s" : ""} que ${esc(f.name)} n’a pas encore découvert${hidden > 1 ? "s" : ""} ${hidden > 1 ? "sont" : "est"} masqué${hidden > 1 ? "s" : ""}.</p>` : ""}
  </section>`;
}
function trBalanceHTML() {
  const c = trCheck(TR.draft), max = Math.max(c.va, c.vb, 1);
  return `<div class="tr-balance${c.msg ? "" : " ok"}" id="tr-balance">
    <div class="tr-bars"><span><small>Tu donnes</small><b class="num">${fmt(c.va)}</b><i style="width:${(c.va / max * 100).toFixed(0)}%"></i></span><span><small>Tu demandes</small><b class="num">${fmt(c.vb)}</b><i style="width:${(c.vb / max * 100).toFixed(0)}%"></i></span></div>
    <p>${c.msg ? esc(c.msg) : `Échange équilibré ✓${c.gap ? ` · écart ${c.gap} %` : ""}`}</p>
    <button class="btn big" data-act="trSend" ${c.msg || TR.sending || !TR.inv ? "disabled" : ""}>${TR.sending ? "Envoi…" : "Proposer l’échange"}</button>
    <p class="small muted" style="margin:0">Ce que tu donnes est mis de côté jusqu’à sa réponse (${TR_HOURS} h au plus).${TR.inv ? ` · ${Math.max(0, TR_DAY - TR.inv.today)} échange${TR_DAY - TR.inv.today > 1 ? "s" : ""} possible${TR_DAY - TR.inv.today > 1 ? "s" : ""} aujourd’hui` : ""}</p></div>`;
}
function viewTrade() {
  const f = trFriend(); if (!f) { TR.draft = null; return friendsRouter(); }
  return `<div class="sheet tall trade-sheet" role="dialog" aria-modal="true" aria-label="Échange avec ${esc(f.name)}">
    <div class="sheet-head chat-head"><button class="btn ghost sm" data-act="trBack" aria-label="Retour">‹</button><span class="fr-av">${friendAvatar(f.avatar)}</span><span class="fr-id"><b>Échange avec ${esc(f.name)}</b><small>Valeur = prix de vente au marché</small></span></div>
    ${trSide("give", f)}${trSide("want", f)}${trBalanceHTML()}</div>`;
}
// Saisie des pièces : on met à jour le brouillon et la balance sans redessiner la fenêtre (le clavier reste ouvert).
document.addEventListener("input", ev => {
  const m = /^tr-coins-(give|want)$/.exec(ev.target.id || ""); if (!m || !TR.draft) return;
  const v = Math.max(0, Math.min(TR_MAX * 2, Math.floor(+ev.target.value || 0)));
  TR.draft[m[1] === "give" ? "giveCoins" : "wantCoins"] = v;
  const b = document.getElementById("tr-balance"); if (b) b.outerHTML = trBalanceHTML();
});

const TRADE_ACTS = {
  trOpen(id) {
    const f = FR.list.find(x => x.id === +id); if (!f) return;
    TR.draft = { fid: f.id, give: {}, want: {}, giveCoins: 0, wantCoins: 0, giveMode: "items", wantMode: "items" }; TR.inv = null; TR.invErr = "";
    SFX.play("click"); friendsOver(); loadInventory();
  },
  trBack() { TR.draft = null; if (FR.fromTab && VISIT.id == null && FR.chat == null) closeModal(); else render(true); },
  trMode(arg) {
    const [side, mode] = arg.split(":"), d = TR.draft; if (!d) return;
    if (side === "give") { d.giveMode = mode; d.give = {}; d.giveCoins = 0; } else { d.wantMode = mode; d.want = {}; d.wantCoins = 0; }
    render(true);
  },
  trAdd(arg) {
    const [side, k] = arg.split(":"), d = TR.draft; if (!d || !tradable(k)) return;
    const items = side === "give" ? d.give : d.want;
    if (!items[k] && Object.keys(items).length >= TR_ITEMS) return;
    items[k] = (items[k] || 0) + 1; SFX.play("click"); render(true);
  },
  trSub(arg) {
    const [side, k] = arg.split(":"), d = TR.draft; if (!d) return;
    const items = side === "give" ? d.give : d.want; if (items[k] > 1) items[k]--; else delete items[k]; render(true);
  },
  async trSend() {
    const d = TR.draft, f = trFriend(); if (!d || !f || TR.sending || trCheck(d).msg) return;
    const give = d.giveCoins > 0 ? {} : { ...d.give }, want = d.wantCoins > 0 ? {} : { ...d.want };
    TR.sending = true; moveItems(give, d.giveCoins, -1); render(true); // mis de côté tout de suite
    try {
      await CLOUD.rpc("propose_trade", { target: f.user_id, give, give_coins: d.giveCoins, want, want_coins: d.wantCoins });
      save(); SFX.play("success");
      toast(`📬 Échange proposé à <b>${esc(f.name)}</b> ! Ce que tu donnes est mis de côté jusqu’à sa réponse.`, 5000);
      TR.draft = null; TR.sending = false;
      if (FR.fromTab && VISIT.id == null && FR.chat == null) closeModal(); else render(true);
      loadTrades(); if (FR.chat != null) loadMessages(true);
      return;
    } catch (e) { moveItems(give, d.giveCoins, 1); toast(trErr(String(e.message || e))); if (/trop_echanges/.test(e.message) && TR.inv) TR.inv.today = TR_DAY; }
    TR.sending = false; render(true);
  },
  openMail() { TR.mailTab = trIn().length ? "in" : "news"; if (TR.mailTab === "news") S.mailSeen = Date.now(); modalView = viewMail; $("#modal").innerHTML = viewMail(); openModal(); loadTrades(); save(); },
  mailTab(t) { TR.mailTab = t; if (t === "news") { render(true); S.mailSeen = Date.now(); save(); } else render(true); },
  async trRespond(arg) {
    const [id, ok] = arg.split(":"), r = TR.list.find(x => x.id === +id); if (!r || TR.sending) return;
    const accept = ok === "1";
    if (accept && !haveItems(r.want, r.want_coins)) return;
    TR.sending = true;
    try {
      await CLOUD.rpc("respond_trade", { tid: r.id, accept });
      r.status = accept ? "accepted" : "refused"; r.decided_at = new Date().toISOString();
      if (accept) { moveItems(r.want, r.want_coins, -1); moveItems(r.give, r.give_coins, 1); save(); SFX.play("success"); toast(`✅ Échange conclu avec <b>${esc(r.name)}</b> ! Tu reçois ${trPlain(r.give, r.give_coins)}.`, 5000); }
      else toast(`Échange de <b>${esc(r.name)}</b> refusé.`);
    } catch (e) { toast(trErr(String(e.message || e))); }
    TR.sending = false; loadTrades();
  },
  async trCancel(id) {
    const r = TR.list.find(x => x.id === +id); if (!r || TR.sending) return;
    TR.sending = true;
    try {
      await CLOUD.rpc("cancel_trade", { tid: r.id });
      r.status = "cancelled"; r.a_claimed = true; r.decided_at = new Date().toISOString();
      moveItems(r.give, r.give_coins, 1); save(); toast(`Échange annulé : ${trPlain(r.give, r.give_coins)} te ${trBack(r)}.`);
    } catch (e) { toast(trErr(String(e.message || e))); }
    TR.sending = false; loadTrades();
  },
};
