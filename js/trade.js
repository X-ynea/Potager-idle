"use strict";
/* ---------------- Échanges entre amis et boîte aux lettres ----------------
   Fonctions serveur : docs/echanges.sql (toutes les règles sont aussi vérifiées par le serveur).
   · Chaque côté : des objets (récoltes et plats), des pièces, ou les deux. Jamais de pièces des deux côtés.
   · Valeur = prix de vente au marché ; écart de 20 % au plus ; 3 000 de valeur au plus par côté ; 3 propositions par jour.
   · Contre-proposition : répond à un échange reçu (qui est alors remplacé), ne compte pas dans la limite du jour,
     repart pour 48 h. Autant d'allers-retours qu'on veut.
   · Anti-spoil : on ne propose que ce que l'ami a découvert ; dans son inventaire, ce qu'on n'a pas découvert est masqué.
   · Ce qu'on propose quitte la partie dès l'envoi ; ça revient si l'ami refuse, contre-propose, si on annule ou au bout de 48 h.
   La boîte aux lettres (dans le jardin) rassemble les propositions reçues, envoyées, et les nouvelles. */
const TR_MAX = 3000, TR_GAP = 1.2, TR_DAY = 3, TR_HOURS = 48, TR_ITEMS = 8;
const TR = { list: [], loaded: false, draft: null, inv: null, invErr: "", sending: false, busy: false, mailTab: "in", fromMail: false };
const TRADE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Boîte aux lettres : drapeau levé quand il y a du courrier.
const MAIL_ICON = up => `<img class="mb-art" src="assets/img/ui-mail-${up ? "full" : "empty"}.webp" alt="">`;

const trValue = k => (PLANTS[k] || RECIPES[k])?.sell || 0;
const tradable = k => PLANTS[k] ? !PLANTS[k].tuto : !!RECIPES[k];
// Un joueur « connaît » un objet : plante de base toujours, hybride découvert, plat débloqué à son niveau (et ses hybrides découverts).
const knowsItem = (who, k) => PLANTS[k] ? (!PLANTS[k].hybrid || who.hybrids.includes(k)) : RECIPES[k].lvl <= who.level && Object.keys(RECIPES[k].need).every(i => knowsItem(who, i));
const meWho = () => ({ level: S.level, hybrids: S.hybrids || [] });
const trItems = items => Object.entries(items || {}).filter(([k, q]) => (PLANTS[k] || RECIPES[k]) && q > 0);
const sideValue = (items, coins) => trItems(items).reduce((n, [k, q]) => n + trValue(k) * q, 0) + (coins > 0 ? coins : 0);
const haveItems = (items, coins) => S.coins >= (coins || 0) && trItems(items).every(([k, q]) => cnt(itemBag(k), k) >= q);
function moveItems(items, coins, sign) { // sign = -1 : retirer de ma partie, +1 : ajouter
  if (coins > 0) S.coins += sign * coins;
  for (const [k, q] of trItems(items)) { if (!tradable(k)) continue; const bag = itemBag(k); bag[k] = Math.max(0, cnt(bag, k) + sign * q); if (!bag[k]) delete bag[k]; }
}
const trChips = (items, coins) => trItems(items).map(([k, q]) => `<span class="tr-chip">${itemArt(k)}<b class="num">${q}</b><small>${itemName(k)}</small></span>`).join("")
  + (coins > 0 ? `<span class="tr-chip coins">${coin}<b class="num">${fmt(coins)}</b><small>pièces</small></span>` : "");
const trPlain = (items, coins) => [...trItems(items).map(([k, q]) => `${q} × ${itemName(k)}`), ...(coins > 0 ? [`${fmt(coins)} pièces`] : [])].join(", ");
const trBack = r => (r.give_coins || 0) + trItems(r.give).reduce((a, [, q]) => a + q, 0) > 1 ? "sont rendus" : "est rendu";
const trLeft = iso => { const ms = Date.parse(iso) + TR_HOURS * 3600e3 - Date.now(); return ms <= 0 ? "Expire bientôt" : `Expire dans ${dur(ms)}`; };
const trAgo = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 2 ? "à l’instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
const trErr = m => /desequilibre/.test(m) ? "L’échange n’est pas assez équilibré." : /plafond/.test(m) ? `Maximum ${fmt(TR_MAX)} pièces de valeur de chaque côté.`
  : /pieces_contre_pieces/.test(m) ? "Pas de pièces des deux côtés."
  : /trop_echanges/.test(m) ? `Tu as déjà proposé ${TR_DAY} échanges aujourd’hui.` : /spoil/.test(m) ? "Un de ces objets n’est pas encore découvert."
  : /plus_disponible/.test(m) ? "Cet échange n’est plus disponible." : /pas ami/.test(m) ? "Vous n’êtes plus amis."
  : /function|does not exist|404/.test(m) ? "Les échanges ne sont pas encore prêts sur le serveur (script docs/echanges.sql)." : "Action impossible pour le moment.";
const TR_STATUS = { pending: "En attente", accepted: "Accepté", refused: "Refusé", cancelled: "Annulé", expired: "Expiré", countered: "Contre-proposition faite" };

/* ---------- Mes échanges : chargement et récupération des résultats ---------- */
async function loadTrades() {
  if (!friendsReady() || TR.busy) return;
  TR.busy = true;
  try {
    const rows = await CLOUD.rpc("my_trades") || [];
    TR.list = rows; TR.loaded = true;
    // Mes propositions terminées : on récupère une seule fois ce qui revient (le serveur le garantit).
    for (const r of rows.filter(r => r.mine && !r.a_claimed && ["accepted", "refused", "expired", "countered"].includes(r.status))) {
      const st = await CLOUD.rpc("claim_trade", { tid: r.id }).catch(() => null);
      if (!st) continue;
      r.a_claimed = true;
      // Pas de message : la boîte aux lettres signale la nouvelle (pastille).
      if (st === "accepted") { moveItems(r.want, r.want_coins, 1); S.stats.trades = (S.stats.trades || 0) + 1; SFX.play("success"); }
      else moveItems(r.give, r.give_coins, 1);
      save();
    }
  } catch (e) {}
  TR.busy = false;
  render(true);
}
setInterval(() => { if (friendsReady() && !document.hidden) loadTrades(); }, 60e3);
addEventListener("load", () => setTimeout(loadTrades, 6000));
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(loadTrades, 2000); });

/* ---------- Boîte aux lettres ---------- */
const trIn = () => TR.list.filter(r => !r.mine && r.status === "pending");
const trOut = () => TR.list.filter(r => r.mine && r.status === "pending");
// Nouvelles : gardées dans la partie. Une nouvelle non lue reste ; une fois lue, elle disparaît
// 24 h après l'arrosage, ou 7 jours après l'échange.
const NEWS_TTL = { w: 24 * 3600e3, t: 7 * 24 * 3600e3, l: 7 * 24 * 3600e3 };
function mailNews() {
  const list = Array.isArray(S.news) ? S.news : [], keys = new Set(list.map(n => n.k));
  const add = (k, at, html, kind, read) => { if (!keys.has(k) && html) { list.push({ k, at, html, kind, read: !!read }); keys.add(k); } };
  for (const w of S.friendWater || []) if (!w.mine) add("w" + w.id, w.at, `💧 <b>${esc(w.name)}</b> a arrosé ton jardin.`, "w");
  for (const l of S.likes || []) add("l" + l.id, l.at, `❤️ <b>${esc(l.name)}</b> aime ton jardin.`, "l");
  for (const r of TR.list) {
    if (r.status === "pending" || !r.decided_at) continue;
    const at = Date.parse(r.decided_at), who = `<b>${esc(r.name)}</b>`, k = `t${r.id}${r.status}`;
    // Ce que j'ai fait moi-même arrive déjà lu.
    if (r.mine) add(k, at, { accepted: `✅ ${who} a accepté ton échange.`, refused: `❌ ${who} a refusé ton échange.`, expired: `⌛ Ton échange avec ${who} a expiré.`, cancelled: `↩️ Tu as annulé ton échange avec ${who}.`, countered: `🔁 ${who} t’a fait une contre-proposition.` }[r.status], "t", r.status === "cancelled");
    else add(k, at, { accepted: `✅ Tu as accepté l’échange de ${who}.`, refused: `❌ Tu as refusé l’échange de ${who}.`, expired: `⌛ L’échange proposé par ${who} a expiré.`, cancelled: `↩️ ${who} a annulé son échange.`, countered: `🔁 Tu as fait une contre-proposition à ${who}.` }[r.status], "t", ["accepted", "refused", "countered"].includes(r.status));
  }
  const now = Date.now();
  S.news = list.filter(n => !n.read || now - n.at < (NEWS_TTL[n.kind] || NEWS_TTL.t)).sort((a, b) => b.at - a.at).slice(0, 60);
  return S.news;
}
const markNewsRead = () => { const t = Date.now(); TR.newsMark = t; for (const n of mailNews()) if (!n.read) { n.read = true; n.readAt = t; } save(); };
const mailCount = () => FRIENDS_ON ? trIn().length + mailNews().filter(n => !n.read).length : 0;
function mailboxHTML() {
  if (!FRIENDS_ON || !CLOUD.signedIn) return "";
  const n = mailCount();
  return `<button class="mailbox${n ? " has" : ""}" data-act="openMail" aria-label="Boîte aux lettres${n ? ` : ${n} nouveauté${n > 1 ? "s" : ""}` : ""}">${MAIL_ICON(n > 0)}${n ? `<span class="fr-badge">${n}</span>` : ""}</button>`;
}
function tradeCard(r) {
  const who = `<span class="fr-av">${friendAvatar(r.avatar)}</span>`, counter = r.counter_of ? `<span class="tr-tag">Contre-proposition</span>` : "";
  if (r.mine) return `<div class="tr-card">${who}<div class="tr-body"><p class="tr-title">À <b>${esc(r.name)}</b> ${counter}<small class="tr-exp">${trLeft(r.created_at)}</small></p>
      <div class="tr-line"><small>Tu donnes</small>${trChips(r.give, r.give_coins)}</div><div class="tr-line"><small>Contre</small>${trChips(r.want, r.want_coins)}</div>
      <div class="tr-acts"><button class="btn ghost sm" data-act="trCancel" data-arg="${r.id}">Annuler</button></div></div></div>`;
  const ok = haveItems(r.want, r.want_coins);
  return `<div class="tr-card">${who}<div class="tr-body"><p class="tr-title"><b>${esc(r.name)}</b> te propose ${counter}<small class="tr-exp">${trLeft(r.created_at)}</small></p>
      <div class="tr-line"><small>Tu reçois</small>${trChips(r.give, r.give_coins)}</div><div class="tr-line"><small>Contre</small>${trChips(r.want, r.want_coins)}</div>
      ${ok ? "" : `<p class="small tr-miss">Tu n’en as plus assez pour accepter.</p>`}
      <div class="tr-acts"><button class="btn ghost sm" data-act="trRespond" data-arg="${r.id}:0">Refuser</button><button class="btn ghost sm" data-act="trCounter" data-arg="${r.id}">Contre-proposer</button><button class="btn sm" data-act="trRespond" data-arg="${r.id}:1" ${ok ? "" : "disabled"}>Accepter</button></div></div></div>`;
}
function viewMail() {
  const inn = trIn(), out = trOut(), news = mailNews(), mark = TR.newsMark || 0;
  const fresh = news.filter(n => !n.read).length;
  const tabs = [["in", `Reçus${inn.length ? ` <span class="fr-badge">${inn.length}</span>` : ""}`], ["out", `Envoyés <span class="num">${out.length}</span>`], ["news", `Nouvelles${fresh ? ` <span class="fr-badge">${fresh}</span>` : ""}`]];
  let body;
  if (!TR.loaded) body = `<div class="empty-note"><span>On ouvre la boîte…</span></div>`;
  else if (TR.mailTab === "in") body = inn.length ? inn.map(tradeCard).join("") : `<div class="empty-note"><span>Aucune proposition reçue.<br>Tes amis peuvent t’en faire depuis ton jardin ou vos messages.</span></div>`;
  else if (TR.mailTab === "out") body = `<button class="btn tr-new" data-act="trNew">${TRADE_ICON}Nouvel échange</button>
    ${out.length ? out.map(tradeCard).join("") : `<div class="empty-note"><span>Aucune proposition en attente.</span></div>`}`;
  else body = news.length ? `<div class="mail-news">${news.map(n => `<p class="${!n.read || n.readAt >= mark ? "new" : ""}"><span>${n.html}</span><small>${trAgo(n.at)}</small></p>`).join("")}</div><p class="small muted" style="margin:0;text-align:center">Une fois lues, les nouvelles s’effacent : 24 h pour les arrosages, 7 jours pour les échanges.</p>` : `<div class="empty-note"><span>Pas de nouvelles pour l’instant.</span></div>`;
  return `<div class="sheet tall mail-sheet" role="dialog" aria-modal="true" aria-label="Boîte aux lettres">
    <div class="sheet-head"><h2>Boîte aux lettres</h2>${SHEET_X}</div>
    <div class="subtabs" style="grid-template-columns:repeat(3,1fr)">${tabs.map(([k, l]) => `<button data-act="mailTab" data-arg="${k}" aria-pressed="${TR.mailTab === k}">${l}</button>`).join("")}</div>
    ${body}</div>`;
}
const openMailView = () => { modalView = viewMail; if ($("#modal").hidden) { $("#modal").innerHTML = viewMail(); openModal(); } else render(true); };

/* ---------- Message « 📬 » dans la conversation : l'échange qu'il annonce ---------- */
function chatTradeHTML(m, mine) {
  const r = TR.list.find(x => x.id === m.trade_id);
  if (!r) return "";
  const st = r.status === "pending" && Date.parse(r.created_at) + TR_HOURS * 3600e3 < Date.now() ? "expired" : r.status;
  return `<div class="msg-trade"><div class="tr-line"><small>${mine ? "Tu donnes" : "Tu reçois"}</small>${trChips(r.give, r.give_coins)}</div><div class="tr-line"><small>Contre</small>${trChips(r.want, r.want_coins)}</div>
    ${st === "pending" ? (mine ? `<button class="btn ghost sm" data-act="trCancel" data-arg="${r.id}">Annuler l’échange</button>` : `<button class="btn sm" data-act="trSee">Voir dans la boîte aux lettres</button>`)
      : `<span class="tr-state ${st}">${TR_STATUS[st] || ""}</span>`}</div>`;
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
// Contrôle du brouillon : le message qui bloque l'envoi ("" si tout va bien) et les deux valeurs.
function trCheck(d) {
  const va = sideValue(d.give, d.giveCoins), vb = sideValue(d.want, d.wantCoins);
  const gap = va && vb ? Math.round((Math.max(va, vb) / Math.min(va, vb) - 1) * 100) : 0;
  let msg = "";
  if (!va) msg = "Choisis ce que tu donnes.";
  else if (!vb) msg = "Choisis ce que tu demandes.";
  else if (d.giveCoins > 0 && d.wantCoins > 0) msg = "Pas de pièces des deux côtés.";
  else if (va > TR_MAX || vb > TR_MAX) msg = `Maximum ${fmt(TR_MAX)} pièces de valeur de chaque côté.`;
  else if (Math.max(va, vb) > TR_GAP * Math.min(va, vb)) msg = `Pas assez équilibré : l’écart est de ${gap} % (20 % au plus).`;
  else if (S.coins < d.giveCoins) msg = "Tu n’as pas assez de pièces.";
  else if (!haveItems(d.give, 0)) msg = "Tu n’en as pas assez.";
  else if (!d.counter && !IS_TEST && TR.inv && TR.inv.today >= TR_DAY) msg = `Tu as déjà proposé ${TR_DAY} échanges aujourd’hui. Reviens demain !`;
  return { va, vb, gap, msg };
}
function trSide(side, f) {
  const d = TR.draft, give = side === "give", items = give ? d.give : d.want, coins = give ? d.giveCoins : d.wantCoins;
  const otherCoins = give ? d.wantCoins > 0 : d.giveCoins > 0, cat = d.cat[side];
  // Inventaire : le mien (filtré par ce que l'ami connaît), ou le sien (filtré par ce que je connais).
  const who = give ? { level: TR.inv?.level || 1, hybrids: TR.inv?.hybrids || [] } : meWho();
  const bagOf = k => give ? cnt(itemBag(k), k) : cnt(PLANTS[k] ? TR.inv?.crops || {} : TR.inv?.dishes || {}, k);
  const pool = { crops: ORDER, dishes: RORDER };
  const keysOf = c => pool[c].filter(k => tradable(k) && bagOf(k) > 0 && knowsItem(who, k));
  const keys = keysOf(cat), picked = trItems(items);
  const hidden = give && TR.inv ? [...ORDER, ...RORDER].filter(k => tradable(k) && bagOf(k) > 0 && !knowsItem(who, k)).length : 0;
  return `<section class="tr-side">
    <h3 class="tr-head"><span>${give ? "Tu donnes" : `Tu demandes à ${esc(f.name)}`}</span><span class="tr-total num" id="tr-total-${side}" title="Valeur totale (prix de vente au marché)">${coin}${fmt(sideValue(items, coins))}</span></h3>
    ${picked.length ? `<div class="tr-picked">${picked.map(([k, q]) => `<button class="tr-chip on" data-act="trSub" data-arg="${side}:${k}" aria-label="Retirer un ${itemName(k)}">${itemArt(k)}<b class="num">${q}</b><small>${itemName(k)}</small><small class="tr-val num">${fmt(trValue(k) * q)}</small><span class="tr-x">−</span></button>`).join("")}</div>` : ""}
    <div class="seg tr-seg">${[["crops", "Récoltes"], ["dishes", "Plats"]].map(([c, l]) => `<button data-act="trCat" data-arg="${side}:${c}" aria-pressed="${cat === c}">${l} <span class="num">${(!give && !TR.inv) ? "" : keysOf(c).length}</span></button>`).join("")}</div>
    ${!give && !TR.inv ? `<p class="small muted" style="margin:0">${TR.invErr ? esc(TR.invErr) : "Chargement de son inventaire…"}</p>`
      : keys.length ? `<div class="tr-grid">${keys.map(k => { const left = bagOf(k) - (items[k] || 0);
        return `<button class="tr-item" data-act="trAdd" data-arg="${side}:${k}" ${left > 0 && (items[k] || picked.length < TR_ITEMS) ? "" : "disabled"} aria-label="${itemName(k)}">${itemArt(k)}<span class="cnt num">${fmt(left)}</span><small>${fmt(trValue(k))}</small></button>`; }).join("")}</div>`
      : `<p class="small muted" style="margin:0">${cat === "dishes" ? "Aucun plat" : "Aucune récolte"} à ${give ? "proposer" : "demander"} pour l’instant.</p>`}
    ${hidden ? `<p class="small muted" style="margin:0">${hidden} objet${hidden > 1 ? "s" : ""} que ${esc(f.name)} n’a pas encore découvert${hidden > 1 ? "s" : ""} ${hidden > 1 ? "sont" : "est"} masqué${hidden > 1 ? "s" : ""}.</p>` : ""}
    <label class="tr-coins${otherCoins ? " off" : ""}">${coin}<span>${give ? "Et des pièces" : "Et des pièces"}</span><input id="tr-coins-${side}" type="number" inputmode="numeric" min="0" max="${TR_MAX}" step="1" value="${coins || ""}" placeholder="0" ${otherCoins ? "disabled" : ""}>
      <small class="muted">${otherCoins ? "Déjà des pièces de l’autre côté" : give ? `Tu as ${fmt(S.coins)}` : ""}</small></label>
  </section>`;
}
// Balance : deux jauges rondes (ce que tu donnes, ce que tu demandes) et une petite balance au milieu.
// Chaque jauge se remplit par rapport au côté le plus lourd ; tout passe en vert quand l'échange est équilibré.
const SCALE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M7 20h10M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 7l-3 6h6zM18 7l-3 6h6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 13a3 2 0 0 0 6 0zM15 13a3 2 0 0 0 6 0z" fill="currentColor"/><circle cx="12" cy="4" r="1.6" fill="currentColor"/></svg>`;
function trGauges(va, vb, state) {
  const max = Math.max(va, vb, 1);
  const g = (v, label) => { const pct = Math.round(v / max * 100);
    return `<div class="tr-g"><small>${label}</small><span class="tr-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="bg" cx="20" cy="20" r="16"/><circle class="fg" cx="20" cy="20" r="16" pathLength="100" style="stroke-dashoffset:${100 - pct}"/></svg><b class="num">${fmt(v)}</b></span><span class="tr-pct num">${v ? pct + " %" : "—"}</span></div>`; };
  return `<div class="tr-gauges ${state}">${g(va, "Tu donnes")}<span class="tr-g-ico">${SCALE_ICON}</span>${g(vb, "Tu demandes")}</div>`;
}
function trBalanceHTML() {
  const d = TR.draft, c = TR.sending && TR.sendCheck ? TR.sendCheck : trCheck(d), left = Math.max(0, TR_DAY - (TR.inv?.today || 0)), unlimited = IS_TEST;
  return `<div class="tr-balance${c.msg ? "" : " ok"}" id="tr-balance">${trGauges(c.va, c.vb, !c.msg ? "ok" : c.va && c.vb ? "bad" : "")}
    <p class="tr-verdict">${c.msg ? esc(c.msg) : `Échange équilibré ✓${c.gap ? ` · écart ${c.gap} %` : ""}`}</p>
    <button class="btn big" data-act="trSend" ${c.msg || TR.sending || !TR.inv ? "disabled" : ""}>${TR.sending ? "Envoi…" : d.counter ? "Envoyer la contre-proposition" : "Proposer l’échange"}</button>
    <p class="small muted" style="margin:0">Ce que tu donnes est mis de côté jusqu’à sa réponse (${TR_HOURS} h au plus).${d.counter ? " Une contre-proposition ne compte pas dans tes échanges du jour." : unlimited ? " · Version de test : pas de limite par jour." : TR.inv ? ` · ${left} échange${left > 1 ? "s" : ""} possible${left > 1 ? "s" : ""} aujourd’hui` : ""}</p></div>`;
}
function viewTrade() {
  const f = trFriend(); if (!f) { TR.draft = null; return TR.fromMail ? viewMail() : friendsRouter(); }
  return `<div class="sheet tall trade-sheet" role="dialog" aria-modal="true" aria-label="Échange avec ${esc(f.name)}">
    <div class="sheet-head chat-head"><button class="btn ghost sm" data-act="trBack" aria-label="Retour">‹</button><span class="fr-av">${friendAvatar(f.avatar)}</span><span class="fr-id"><b>${TR.draft.counter ? "Contre-proposition à" : "Échange avec"} ${esc(f.name)}</b><small>Valeur = prix de vente au marché</small></span><button class="sheet-x" data-act="trCloseAll" aria-label="Fermer">${X_SVG}</button></div>
    ${trSide("give", f)}${trSide("want", f)}${trBalanceHTML()}</div>`;
}
// Saisie des pièces : on met à jour le brouillon et la balance sans redessiner la fenêtre (le clavier reste ouvert).
document.addEventListener("input", ev => {
  const m = /^tr-coins-(give|want)$/.exec(ev.target.id || ""); if (!m || !TR.draft) return;
  const v = Math.max(0, Math.min(TR_MAX, Math.floor(+ev.target.value || 0)));
  TR.draft[m[1] === "give" ? "giveCoins" : "wantCoins"] = v;
  const other = document.getElementById(`tr-coins-${m[1] === "give" ? "want" : "give"}`);
  if (other) { other.disabled = v > 0; other.closest(".tr-coins")?.classList.toggle("off", v > 0); }
  const b = document.getElementById("tr-balance"); if (b) b.outerHTML = trBalanceHTML();
  const t = document.getElementById(`tr-total-${m[1]}`); if (t) t.innerHTML = coin + fmt(m[1] === "give" ? sideValue(TR.draft.give, TR.draft.giveCoins) : sideValue(TR.draft.want, TR.draft.wantCoins));
});
// Ouvre la fenêtre d'échange avec un ami (brouillon vide, ou contre-proposition pré-remplie).
function trStart(f, draft) {
  TR.draft = { fid: f.id, give: {}, want: {}, giveCoins: 0, wantCoins: 0, cat: { give: "crops", want: "crops" }, counter: null, ...draft };
  TR.inv = null; TR.invErr = ""; SFX.play("click"); loadInventory();
}
function trClose() {
  TR.draft = null;
  if (TR.fromMail) { TR.fromMail = false; openMailView(); return; }
  if (FR.fromTab && VISIT.id == null && FR.chat == null) closeModal(); else render(true);
}

const TRADE_ACTS = {
  trOpen(id) { const f = FR.list.find(x => x.id === +id); if (!f) return; FR.hlTrade = false; tutoFlag("trade_opened"); TR.fromMail = false; trStart(f); friendsOver(); },
  // Nouvel échange depuis la boîte aux lettres : on choisit l'ami dans l'onglet « Amis » (bouton ⇄).
  trNew() {
    closeModal(); FR.tab = "friends"; FR.filter = ""; A.tab("friends"); FR.hlTrade = true; FR.hlPulse = true; render(true); loadFriends(true);
    setTimeout(() => { FR.hlPulse = false; }, 1300); // les boutons ⇄ pulsent une seule fois
  },
  trCloseAll() { TR.draft = null; TR.fromMail = false; closeModal(); },
  trCounter(id) {
    const r = TR.list.find(x => x.id === +id), f = r && FR.list.find(x => x.user_id === r.other && x.direction === "friend");
    if (!f) { toast("Vous n’êtes plus amis."); return; }
    TR.fromMail = true; // pré-rempli avec l'échange inversé : à modifier avant d'envoyer
    trStart(f, { give: { ...r.want }, giveCoins: r.want_coins || 0, want: { ...r.give }, wantCoins: r.give_coins || 0, counter: r.id });
    modalView = friendsRouter; render(true);
  },
  trSee() { TR.mailTab = "in"; FR.chat = null; openMailView(); loadTrades(); },
  trBack() { trClose(); },
  trCat(arg) { const [side, c] = arg.split(":"); if (TR.draft) { TR.draft.cat[side] = c; render(true); } },
  trAdd(arg) {
    const [side, k] = arg.split(":"), d = TR.draft; if (!d || !tradable(k)) return;
    const items = side === "give" ? d.give : d.want;
    if (!items[k] && trItems(items).length >= TR_ITEMS) return;
    items[k] = (items[k] || 0) + 1; SFX.play("click"); render(true);
  },
  trSub(arg) {
    const [side, k] = arg.split(":"), d = TR.draft; if (!d) return;
    const items = side === "give" ? d.give : d.want; if (items[k] > 1) items[k]--; else delete items[k]; render(true);
  },
  async trSend() {
    const d = TR.draft, f = trFriend(); if (!d || !f || TR.sending || trCheck(d).msg) return;
    const give = Object.fromEntries(trItems(d.give)), want = Object.fromEntries(trItems(d.want));
    TR.sendCheck = trCheck(d); TR.sending = true; moveItems(give, d.giveCoins, -1); render(true); // mis de côté tout de suite (la balance reste verte)
    try {
      await CLOUD.rpc("propose_trade", { target: f.user_id, give, give_coins: d.giveCoins, want, want_coins: d.wantCoins, counter: d.counter });
      save(); SFX.play("success");
      toast(`📬 ${d.counter ? "Contre-proposition envoyée" : "Échange proposé"} à <b>${esc(f.name)}</b>.`);
      TR.sending = false; if (d.counter) TR.mailTab = "out";
      trClose(); loadTrades(); if (FR.chat != null) loadMessages(true);
      return;
    } catch (e) { moveItems(give, d.giveCoins, 1); toast(trErr(String(e.message || e))); if (/trop_echanges/.test(e.message) && TR.inv) TR.inv.today = TR_DAY; }
    TR.sending = false; render(true);
  },
  openMail() {
    tutoFlag("mail_opened");
    TR.mailTab = trIn().length ? "in" : mailNews().some(n => !n.read) || !trOut().length ? "news" : "out";
    if (TR.mailTab === "news") markNewsRead(); modalView = viewMail; $("#modal").innerHTML = viewMail(); openModal(); loadTrades();
  },
  mailTab(t) { TR.mailTab = t; if (t === "news") markNewsRead(); render(true); },
  async trRespond(arg) {
    const [id, ok] = arg.split(":"), r = TR.list.find(x => x.id === +id); if (!r || TR.sending) return;
    const accept = ok === "1";
    if (accept && !haveItems(r.want, r.want_coins)) return;
    TR.sending = true;
    try {
      await CLOUD.rpc("respond_trade", { tid: r.id, accept });
      r.status = accept ? "accepted" : "refused"; r.decided_at = new Date().toISOString();
      if (accept) { S.stats.trades = (S.stats.trades || 0) + 1; moveItems(r.want, r.want_coins, -1); moveItems(r.give, r.give_coins, 1); save(); SFX.play("success"); toast(`✅ Échange conclu avec <b>${esc(r.name)}</b> !`); }
    } catch (e) { toast(trErr(String(e.message || e))); }
    TR.sending = false; loadTrades();
  },
  async trCancel(id) {
    const r = TR.list.find(x => x.id === +id); if (!r || TR.sending) return;
    TR.sending = true;
    try {
      await CLOUD.rpc("cancel_trade", { tid: r.id });
      r.status = "cancelled"; r.a_claimed = true; r.decided_at = new Date().toISOString();
      moveItems(r.give, r.give_coins, 1); save();
    } catch (e) { toast(trErr(String(e.message || e))); }
    TR.sending = false; loadTrades();
  },
};
