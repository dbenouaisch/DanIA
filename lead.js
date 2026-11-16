/* Contact des visiteurs : mémoire des coordonnées, envoi à Formspree, tableur Google.
   Partagé par la page Rendez-vous (rdv.js) et par les cartes « Programme détaillé » (programme.js). */
(function (w) {
  "use strict";
  var CFG = {
    /* Identifiant du formulaire Formspree (tableau de bord Formspree). */
    FORMSPREE: "https://formspree.io/f/xrpqgryy",
    /* Tableur Google « DAN-IA · Demandes de rendez-vous » : URL de l'application Web Apps Script
       (voir integrations/google-sheet.gs). Vide = enregistrement désactivé. */
    SHEET_ENDPOINT: "",
    MAIL: "dbenouaisch@gmail.com"
  };
  var KEY = "dania-contact";
  var DAYS30 = 30 * 24 * 3600 * 1000;

  function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s || ""); }
  function firstName(n) { return (n || "").trim().split(/\s+/)[0] || ""; }

  /* Après un envoi réussi, le prénom, l'e-mail et le téléphone sont gardés 30 jours dans le navigateur
     (localStorage) pour préremplir les formulaires. Pour ne les garder que le temps de la visite,
     ne conserver que sessionStorage. */
  function readMem() {
    var raw = null, o = null;
    try { raw = sessionStorage.getItem(KEY); } catch (e) {}
    if (!raw) { try { raw = localStorage.getItem(KEY); } catch (e) {} }
    if (!raw) return null;
    try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!o || (o.exp && o.exp < Date.now())) { clearMem(); return null; }
    return o;
  }
  function writeMem(d) {
    var s = JSON.stringify({ name: d.name, email: d.email, tel: d.tel, exp: Date.now() + DAYS30 });
    try { localStorage.setItem(KEY, s); } catch (e) {}
    try { sessionStorage.setItem(KEY, s); } catch (e) {}
  }
  function clearMem() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /* Chaque demande est aussi inscrite dans le tableur, qu'elle ait atteint Formspree ou non. */
  function logSheet(status, d) {
    if (!CFG.SHEET_ENDPOINT) return;
    try {
      fetch(CFG.SHEET_ENDPOINT, {
        method: "POST", mode: "no-cors", keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          prenom: d.name, email: d.email, telephone: d.tel, sujet: d.label, code_sujet: d.code,
          origine: document.referrer || "visite directe", page: location.pathname + location.search,
          formspree: status, message: d.body
        })
      });
    } catch (e) {}
  }

  /* d : { name, email, tel, label, code, subject, body }. Renvoie une promesse : true si Formspree a répondu. */
  function send(d) {
    var payload = {
      name: d.name, email: d.email, telephone: d.tel || "(non renseigné)",
      sujet: d.label, _subject: d.subject, message: d.body,
      origine: document.referrer || "visite directe"
    };
    var ctl = ("AbortController" in w) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
    return fetch(CFG.FORMSPREE, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) { return res.ok; }, function () { return false; }).then(function (sent) {
      clearTimeout(timer);
      logSheet(sent ? "ok" : "échec", d);
      return sent;
    });
  }

  w.DaniaLead = { CFG: CFG, isEmail: isEmail, firstName: firstName, readMem: readMem, writeMem: writeMem, clearMem: clearMem, send: send };
})(window);
