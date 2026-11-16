(function () {
  "use strict";
  /* Réglages : identifiant du formulaire Formspree (tableau de bord Formspree), agenda et e-mail de contact. */
  var FORMSPREE = "https://formspree.io/f/xrpqgryy";
  var AGENDA = "https://calendly.com/dbenouaisch";
  var MAIL = "dbenouaisch@gmail.com";
  var KEY = "dania-contact";
  var DAYS30 = 30 * 24 * 3600 * 1000;
  /* Tableur Google « DAN-IA · Demandes de rendez-vous » : URL de l'application Web Apps Script
     (voir integrations/google-sheet.gs). Vide = enregistrement désactivé. */
  var SHEET_ENDPOINT = "";
  var BTN_LABEL = "Voir les créneaux";

  var form = document.getElementById("rdvForm");
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var fName = $("r-name"), fMail = $("r-mail"), fTel = $("r-tel"), fNeed = $("r-need"),
      fTrap = $("r-trap"), btn = $("sendBtn"), fields = $("contactFields"),
      known = $("known"), done = $("rdvDone"), fail = $("rdvFail");

  function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s || ""); }
  function firstName(n) { return (n || "").trim().split(/\s+/)[0] || ""; }

  /* ---- Mémoire des coordonnées : après un envoi réussi, le prénom, l'e-mail et le téléphone
         sont gardés 30 jours dans le navigateur (localStorage) pour préremplir le formulaire.
         Pour ne les garder que le temps de la visite, ne conserver que sessionStorage. ---- */
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

  /* Visiteur déjà connu : « Bonjour Camille, l'agenda vous attend », un seul clic. */
  function showKnown(name) {
    $("knownHello").textContent = firstName(name) ? "Bonjour " + firstName(name) + "." : "Bonjour.";
    known.hidden = false;
    fields.hidden = true;
  }
  function showFields() {
    known.hidden = true;
    fields.hidden = false;
  }

  var mem = readMem();
  if (mem && isEmail(mem.email)) {
    fName.value = mem.name || ""; fMail.value = mem.email; fTel.value = mem.tel || "";
    showKnown(mem.name);
  }

  var q = new URLSearchParams(location.search).get("sujet");
  if (q && [].some.call(fNeed.options, function (o) { return o.value === q; })) fNeed.value = q;

  $("forget").addEventListener("click", function () {
    clearMem();
    fName.value = fMail.value = fTel.value = "";
    showFields();
    fMail.focus();
  });
  $("edit").addEventListener("click", function () { showFields(); fMail.focus(); });

  /* ---- Validation ---- */
  function err(id, eid, bad) {
    $(id).setAttribute("aria-invalid", bad ? "true" : "false");
    $(eid).hidden = !bad;
    return bad;
  }

  /* ---- Texte envoyé : il reflète la demande ---- */
  function needLabel() { return fNeed.options[fNeed.selectedIndex].text; }
  function buildSubject(who) { return "Demande DAN-IA · " + needLabel().replace(/^(Atelier|Conseil) · /, "$1 : ") + " · " + who; }
  function buildBody(name, mail, tel) {
    var l = ["Bonjour,", "", "Je souhaite échanger à propos de : " + needLabel() + ".", ""];
    if (tel) l.push("Merci de me rappeler au " + tel + ".", "");
    l.push("Prénom : " + (name || "(non renseigné)"), "E-mail : " + mail, "", "Envoyé depuis la page Rendez-vous du site DAN-IA.");
    return l.join("\n");
  }
  function agendaUrl(name, mail) {
    return AGENDA + "?email=" + encodeURIComponent(mail) + (name ? "&name=" + encodeURIComponent(name) : "");
  }

  /* Chaque demande est aussi inscrite dans le tableur, qu'elle ait atteint Formspree ou non. */
  function logSheet(status, name, mail, tel, body) {
    if (!SHEET_ENDPOINT) return;
    try {
      fetch(SHEET_ENDPOINT, {
        method: "POST", mode: "no-cors", keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          prenom: name, email: mail, telephone: tel, sujet: needLabel(), code_sujet: fNeed.value,
          origine: document.referrer || "visite directe", page: location.pathname + location.search,
          formspree: status, message: body
        })
      });
    } catch (e) {}
  }

  function panel(which) {
    form.hidden = which !== "form";
    done.hidden = which !== "done";
    fail.hidden = which !== "fail";
    var t = which === "done" ? done : (which === "fail" ? fail : null);
    if (t) t.focus();
  }
  function busy(on) {
    btn.disabled = on;
    btn.textContent = on ? "Envoi en cours…" : BTN_LABEL;
  }

  function showDone(name, mail, tabOpened) {
    var first = firstName(name);
    $("doneTitle").textContent = first ? "Merci " + first + ", votre demande est envoyée" : "Merci, votre demande est envoyée";
    $("openAgenda").href = agendaUrl(name, mail);
    $("doneHint").textContent = tabOpened
      ? "L’agenda s’est ouvert dans un nouvel onglet, votre e-mail y est déjà renseigné. Vous ne le voyez pas ? Utilisez le bouton « Ouvrir l’agenda »."
      : "Ouvrez l’agenda avec le bouton ci-dessus : votre e-mail y sera déjà renseigné.";
    var rc = $("recap"); rc.innerHTML = "";
    [["Sujet", needLabel()], ["E-mail", mail]].forEach(function (p) {
      var dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = p[0]; dd.textContent = p[1]; rc.appendChild(dt); rc.appendChild(dd);
    });
    panel("done");
  }
  function showFail(subject, body) {
    $("failMail").href = "mailto:" + MAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    panel("fail");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = fName.value.trim(), mail = fMail.value.trim(), tel = fTel.value.trim();
    if (err("r-mail", "e-mail", !isEmail(mail))) {
      if (fields.hidden) showFields();
      fMail.focus();
      return;
    }

    /* Champ piège : un robot l'a rempli, on fait comme si tout allait bien. */
    if (fTrap.value) { showDone(name, mail, false); return; }

    /* L'onglet est ouvert tout de suite, dans le clic, pour ne pas être bloqué. */
    var tab = null;
    try {
      tab = window.open("", "_blank");
      if (tab) { tab.opener = null; tab.document.title = "Agenda DAN-IA"; tab.document.body.textContent = "Chargement de l’agenda…"; }
    } catch (x) { tab = null; }

    var subject = buildSubject(name || mail), body = buildBody(name, mail, tel);
    var payload = {
      name: name, email: mail, telephone: tel || "(non renseigné)",
      sujet: needLabel(), _subject: subject, message: body,
      origine: document.referrer || "visite directe"
    };
    busy(true);
    var ctl = ("AbortController" in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
    fetch(FORMSPREE, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) { return res.ok; }, function () { return false; }).then(function (sent) {
      clearTimeout(timer);
      busy(false);
      logSheet(sent ? "ok" : "échec", name, mail, tel, body);
      if (sent) {
        writeMem({ name: name, email: mail, tel: tel });
        var opened = !!(tab && !tab.closed);
        if (opened) { tab.location.href = agendaUrl(name, mail); }
        showDone(name, mail, opened);
      } else {
        if (tab && !tab.closed) { try { tab.close(); } catch (x) {} }
        showFail(subject, body);
      }
    });
  });

  $("retry").addEventListener("click", function () { panel("form"); (fields.hidden ? btn : fMail).focus(); });
  $("again").addEventListener("click", function () { panel("form"); fNeed.focus(); });
})();
