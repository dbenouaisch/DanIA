(function () {
  "use strict";
  /* Réglages : si l'envoi échoue, remplacer FORMSPREE par l'adresse https://formspree.io/f/XXXXXXXX
     indiquée dans le tableau de bord Formspree. */
  var FORMSPREE = "https://formspree.io/dbenouaisch@gmail.com";
  var AGENDA = "https://calendly.com/dbenouaisch";
  var MAIL = "dbenouaisch@gmail.com";
  var KEY = "dania-contact";
  var DAYS30 = 30 * 24 * 3600 * 1000;

  var form = document.getElementById("rdvForm");
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var fName = $("r-name"), fMail = $("r-mail"), fTel = $("r-tel"), fNeed = $("r-need"),
      fKeep = $("r-keep"), fTrap = $("r-trap"), btn = $("sendBtn"),
      known = $("known"), done = $("rdvDone"), fail = $("rdvFail");

  /* ---- Mémoire des coordonnées : le temps de la visite (sessionStorage),
         ou 30 jours si le visiteur coche la case (localStorage). ---- */
  function readMem() {
    var raw = null, o = null;
    try { raw = sessionStorage.getItem(KEY); } catch (e) {}
    if (!raw) { try { raw = localStorage.getItem(KEY); } catch (e) {} }
    if (!raw) return null;
    try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!o || (o.exp && o.exp < Date.now())) { clearMem(); return null; }
    return o;
  }
  function writeMem(d, keep) {
    var o = { name: d.name, email: d.email, tel: d.tel };
    try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    try {
      if (keep) { o.exp = Date.now() + DAYS30; o.keep = true; localStorage.setItem(KEY, JSON.stringify(o)); }
      else { localStorage.removeItem(KEY); }
    } catch (e) {}
  }
  function clearMem() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function firstName(n) { return (n || "").trim().split(/\s+/)[0] || ""; }
  function showKnown(name) {
    $("knownName").textContent = firstName(name);
    known.hidden = !name;
  }

  var mem = readMem();
  if (mem) {
    fName.value = mem.name || ""; fMail.value = mem.email || ""; fTel.value = mem.tel || "";
    fKeep.checked = !!mem.keep;
    showKnown(mem.name);
  }

  var q = new URLSearchParams(location.search).get("sujet");
  if (q && [].some.call(fNeed.options, function (o) { return o.value === q; })) fNeed.value = q;

  $("forget").addEventListener("click", function () {
    clearMem();
    fName.value = fMail.value = fTel.value = "";
    fKeep.checked = false;
    known.hidden = true;
    fName.focus();
  });

  /* ---- Validation ---- */
  function err(id, eid, bad) {
    $(id).setAttribute("aria-invalid", bad ? "true" : "false");
    $(eid).hidden = !bad;
    return bad;
  }

  /* ---- Texte envoyé : il reflète la demande ---- */
  function needLabel() { return fNeed.options[fNeed.selectedIndex].text; }
  function buildSubject(name) { return "Demande DAN-IA · " + needLabel().replace(/^(Atelier|Conseil) · /, "$1 : ") + " · " + name; }
  function buildBody(name, mail, tel) {
    var l = ["Bonjour,", "", "Je souhaite échanger à propos de : " + needLabel() + ".", ""];
    if (tel) l.push("Merci de me rappeler au " + tel + ".", "");
    l.push("Nom : " + name, "E-mail : " + mail, "", "Envoyé depuis la page Rendez-vous du site DAN-IA.");
    return l.join("\n");
  }
  function agendaUrl(name, mail) {
    return AGENDA + "?name=" + encodeURIComponent(name) + "&email=" + encodeURIComponent(mail);
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
    btn.textContent = on ? "Envoi en cours…" : "Choisir un créneau";
  }

  function showDone(name, mail, tabOpened) {
    var url = agendaUrl(name, mail);
    $("doneName").textContent = firstName(name);
    $("openAgenda").href = url;
    $("doneHint").textContent = tabOpened
      ? "L’agenda vient de s’ouvrir dans un nouvel onglet, votre nom et votre e-mail y sont déjà renseignés."
      : "Ouvrez l’agenda avec le bouton ci-dessous : votre nom et votre e-mail y seront déjà renseignés.";
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
    var bad = [
      err("r-name", "e-name", !name) && "r-name",
      err("r-mail", "e-mail", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) && "r-mail",
      err("r-need", "e-need", !fNeed.value) && "r-need"
    ].filter(Boolean);
    if (bad.length) { $(bad[0]).focus(); return; }

    /* Champ piège : un robot l'a rempli, on fait comme si tout allait bien. */
    if (fTrap.value) { showDone(name, mail, false); return; }

    /* L'onglet est ouvert tout de suite, dans le clic, pour ne pas être bloqué. */
    var tab = null;
    try {
      tab = window.open("", "_blank");
      if (tab) { tab.opener = null; tab.document.title = "Agenda DAN-IA"; tab.document.body.textContent = "Chargement de l’agenda…"; }
    } catch (x) { tab = null; }

    var subject = buildSubject(name), body = buildBody(name, mail, tel);
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
    }).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      writeMem({ name: name, email: mail, tel: tel }, fKeep.checked);
      var opened = !!(tab && !tab.closed);
      if (opened) { tab.location.href = agendaUrl(name, mail); }
      showDone(name, mail, opened);
    }).catch(function () {
      if (tab && !tab.closed) { try { tab.close(); } catch (x) {} }
      showFail(subject, body);
    }).then(function () {
      clearTimeout(timer);
      busy(false);
    });
  });

  $("retry").addEventListener("click", function () { panel("form"); fName.focus(); });
  $("again").addEventListener("click", function () { panel("form"); fNeed.value = ""; fNeed.focus(); });
})();
