(function () {
  "use strict";
  /* Réglages de la page : agenda de réservation. L'identifiant Formspree, le tableur Google
     et l'e-mail de contact se règlent en tête de lead.js. */
  var AGENDA = "https://calendly.com/dbenouaisch";
  var BTN_LABEL = "Voir les créneaux";

  var form = document.getElementById("rdvForm");
  var L = window.DaniaLead;
  if (!form || !L) return;
  var $ = function (id) { return document.getElementById(id); };
  var fName = $("r-name"), fMail = $("r-mail"), fTel = $("r-tel"), fNeed = $("r-need"),
      fTrap = $("r-trap"), btn = $("sendBtn"), fields = $("contactFields"),
      known = $("known"), done = $("rdvDone"), fail = $("rdvFail");

  /* Visiteur déjà connu : « Bonjour Camille, l'agenda vous attend », un seul clic. */
  function showKnown(name) {
    $("knownHello").textContent = L.firstName(name) ? "Bonjour " + L.firstName(name) + "." : "Bonjour.";
    known.hidden = false;
    fields.hidden = true;
  }
  function showFields() {
    known.hidden = true;
    fields.hidden = false;
  }

  var mem = L.readMem();
  if (mem && L.isEmail(mem.email)) {
    fName.value = mem.name || ""; fMail.value = mem.email; fTel.value = mem.tel || "";
    showKnown(mem.name);
  }

  var q = new URLSearchParams(location.search).get("sujet");
  if (q && [].some.call(fNeed.options, function (o) { return o.value === q; })) fNeed.value = q;

  $("forget").addEventListener("click", function () {
    L.clearMem();
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
    var first = L.firstName(name);
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
    $("failMail").href = "mailto:" + L.CFG.MAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    panel("fail");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = fName.value.trim(), mail = fMail.value.trim(), tel = fTel.value.trim();
    if (err("r-mail", "e-mail", !L.isEmail(mail))) {
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
    busy(true);
    L.send({ name: name, email: mail, tel: tel, label: needLabel(), code: fNeed.value, subject: subject, body: body }).then(function (sent) {
      busy(false);
      if (sent) {
        L.writeMem({ name: name, email: mail, tel: tel });
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
