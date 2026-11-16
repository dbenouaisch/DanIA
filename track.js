/* Mesure d'audience DAN-IA, sans cookie ni donnée personnelle.
   - Identifiant de visiteur aléatoire dans le navigateur (13 mois max) : sert à estimer les visiteurs uniques.
   - Session : 30 min d'inactivité ; une nouvelle campagne UTM ouvre une nouvelle session.
   - Aucune adresse IP, aucun e-mail, aucun nom : seulement page, titre, domaine d'origine, UTM, type d'appareil.
   - Désactivée si : endpoint vide, navigateur automatisé, « Do Not Track » / GPC, navigateur exclu (?notrack=1),
     ou domaine hors production (sauf test : localStorage « dania-test » = 1, données alors marquées « test »).
   Les événements partent par lots vers le tableur (integrations/google-sheet.gs). */
(function () {
  "use strict";
  var C = window.DANIA_CONFIG || {};
  var EP = C.endpoint || "";
  var PROD = C.prodHosts || [];
  var SESSION_MS = 30 * 60 * 1000, VISITOR_MS = 395 * 24 * 3600 * 1000;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function uid(n) {
    var a = new Uint8Array(n || 8), s = "", i;
    try { (window.crypto || window.msCrypto).getRandomValues(a); } catch (e) { for (i = 0; i < a.length; i++) a[i] = Math.random() * 256; }
    for (i = 0; i < a.length; i++) s += ("0" + a[i].toString(16)).slice(-2);
    return s;
  }

  var qp = new URLSearchParams(location.search);
  if (qp.get("notrack") === "1") ls("dania-notrack", "1");
  if (qp.get("notrack") === "0") ls("dania-notrack", null);

  var notrack = ls("dania-notrack") === "1";
  var offProd = PROD.indexOf(location.hostname) < 0;
  var optTest = ls("dania-test") === "1";
  var dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  var bot = /bot|crawl|spider|headless|lighthouse|preview/i.test(navigator.userAgent);
  var auto = navigator.webdriver === true;
  var isTest = offProd || notrack;
  var active = !!EP && !notrack && !dnt && !bot && (offProd ? optTest : !auto);

  var T = window.daniaTrack = {
    endpoint: EP, uid: uid, active: active,
    isTest: function () { return isTest; },
    sid: function () { return active ? session().id : ""; },
    ev: function (type, o) { if (active) push(type, o || {}); }
  };
  if (!active) return;

  /* ---- visiteur (identifiant aléatoire) ---- */
  var vid = (function () {
    var o = null;
    try { o = JSON.parse(ls("dania-v") || "null"); } catch (e) {}
    if (!o || !o.id || o.exp < Date.now()) { o = { id: uid(8), exp: Date.now() + VISITOR_MS }; ls("dania-v", JSON.stringify(o)); }
    return o.id;
  })();

  /* ---- session ---- */
  function clip(s, n) { return String(s || "").toLowerCase().trim().slice(0, n || 60); }
  var urlUtm = { s: clip(qp.get("utm_source")), m: clip(qp.get("utm_medium")), c: clip(qp.get("utm_campaign")) };
  var hasUtm = !!(urlUtm.s || urlUtm.m || urlUtm.c);
  var cur = null;
  function refHost() {
    try { var h = new URL(document.referrer).hostname.replace(/^www\./, ""); return h === location.hostname.replace(/^www\./, "") ? "" : h; } catch (e) { return ""; }
  }
  function session() {
    if (!cur) { try { cur = JSON.parse(ls("dania-s") || "null"); } catch (e) { cur = null; } }
    var now = Date.now();
    var same = cur && cur.last + SESSION_MS > now &&
      (!hasUtm || (cur.us === urlUtm.s && cur.um === urlUtm.m && cur.uc === urlUtm.c));
    if (!same) {
      cur = { id: uid(8), last: now, ref: refHost(), us: urlUtm.s, um: urlUtm.m, uc: urlUtm.c };
    }
    cur.last = now;
    ls("dania-s", JSON.stringify(cur));
    return cur;
  }

  function device() {
    var w = Math.min(screen.width || 9999, window.innerWidth || 9999);
    return w < 768 ? "mobile" : (w < 1100 ? "tablette" : "ordinateur");
  }
  function path() { return (location.pathname.replace(/\/index\.html$/, "/").replace(/(.)\/$/, "$1").replace(/\.html$/, "")) || "/"; }

  /* ---- envoi par lots ---- */
  var q = [], timer = 0;
  function push(type, o) {
    var s = session();
    q.push({
      t: type, e: uid(6), s: s.id, v: vid, p: path(), ti: document.title.slice(0, 120),
      r: s.ref, us: s.us, um: s.um, uc: s.uc, d: device(), l: o.l || "", n: o.n == null ? "" : o.n,
      x: o.x || "", z: isTest ? 1 : 0
    });
    /* Envoi rapide : une page quittée tout de suite ne doit pas perdre sa visite ni son clic. */
    if (q.length >= 15 || type === "cta") flush(); else if (!timer) timer = setTimeout(flush, 300);
  }
  function flush() {
    clearTimeout(timer); timer = 0;
    if (!q.length) return;
    var body = JSON.stringify({ k: "ev", e: q.splice(0, 50) }), sent = false;
    try { sent = navigator.sendBeacon && navigator.sendBeacon(EP, new Blob([body], { type: "text/plain;charset=UTF-8" })); } catch (e) {}
    if (!sent) {
      try { fetch(EP, { method: "POST", mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body }); } catch (e) {}
    }
    if (q.length) flush();
  }

  /* ---- clics utiles : bouton de contact, e-mail, agenda ---- */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var h = a.getAttribute("href") || "", kind = "";
    if (/^mailto:/i.test(h)) kind = "mail";
    else if (/^https?:\/\/([^/]+\.)?calendly\.com\//i.test(a.href)) kind = "agenda";
    else if (/^https?:\/\/([^/]+\.)?linkedin\.com\//i.test(a.href)) kind = "linkedin";
    else {
      try {
        var u = new URL(a.href, location.href);
        if (u.origin === location.origin && /^\/rendez-vous\/?$/.test(u.pathname) && path() !== "/rendez-vous") kind = "rdv";
        else if (u.origin === location.origin && /^\/programme\/[^/]+\.pdf$/i.test(u.pathname)) kind = "pdf";
      } catch (x) {}
    }
    if (kind) push("cta", { l: kind, x: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) });
  }, true);

  /* ---- début de saisie dans un formulaire du site (rendez-vous, programme PDF, résultat du diagnostic) ---- */
  var seenForm = {};
  document.addEventListener("focusin", function (e) {
    var f = e.target && e.target.closest ? e.target.closest("form") : null;
    if (f && /^(rdvForm|progForm|dqMailForm)$/.test(f.id) && !seenForm[f.id]) { seenForm[f.id] = 1; push("fs", { l: f.id }); }
  });

  /* ---- Core Web Vitals (LCP, CLS, INP), envoyés une fois au départ de la page ---- */
  var lcp = null, cls = 0, win = 0, winStart = 0, winLast = 0, inter = {}, sentCwv = false;
  function observe(type, cb, extra) {
    try { var o = new PerformanceObserver(function (l) { cb(l.getEntries()); }); var p = { type: type, buffered: true }; if (extra) for (var k in extra) p[k] = extra[k]; o.observe(p); } catch (e) {}
  }
  observe("largest-contentful-paint", function (es) { if (es.length) lcp = es[es.length - 1].startTime; });
  observe("layout-shift", function (es) {
    es.forEach(function (x) {
      if (x.hadRecentInput) return;
      if (win && x.startTime - winLast < 1000 && x.startTime - winStart < 5000) win += x.value;
      else { win = x.value; winStart = x.startTime; }
      winLast = x.startTime;
      if (win > cls) cls = win;
    });
  });
  observe("event", function (es) {
    es.forEach(function (x) { if (x.interactionId && (!inter[x.interactionId] || x.duration > inter[x.interactionId])) inter[x.interactionId] = x.duration; });
  }, { durationThreshold: 40 });
  function sendCwv() {
    if (sentCwv) return; sentCwv = true;
    if (lcp != null) push("cwv", { l: "LCP", n: Math.round(lcp) });
    if (document.readyState === "complete" || lcp != null) push("cwv", { l: "CLS", n: Math.round(cls * 1000) / 1000 });
    var d = Object.keys(inter).map(function (k) { return inter[k]; }).sort(function (a, b) { return b - a; });
    if (d.length) push("cwv", { l: "INP", n: Math.round(d[Math.min(d.length - 1, Math.floor(d.length / 50))]) });
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { sendCwv(); flush(); } });
  addEventListener("pagehide", function () { sendCwv(); flush(); });

  push("pv", {});
})();
