(function () {
  "use strict";
  /* Réglages de la page : agenda de réservation (intégré dans la page). L'identifiant Formspree,
     le tableur Google et l'e-mail de contact se règlent en tête de lead.js. */
  var AGENDA = "https://calendly.com/dbenouaisch";
  var BTN_LABEL = "Envoyer ma demande";

  var form = document.getElementById("rdvForm");
  var L = window.DaniaLead;
  if (!form || !L) return;
  var $ = function (id) { return document.getElementById(id); };
  var fName = $("r-name"), fMail = $("r-mail"), fTel = $("r-tel"), fNeed = $("r-need"),
      fTrap = $("r-trap"), btn = $("sendBtn"), fields = $("contactFields"),
      known = $("known"), done = $("rdvDone"), fail = $("rdvFail");

  /* Visiteur déjà connu : « Bonjour Camille », coordonnées déjà remplies. */
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
    /* L'agenda intégré est prérempli avec le nom et l'e-mail déjà connus. */
    var fr = $("agendaFrame");
    if (fr) fr.src = agendaUrl(mem.name, mem.email) + "&hide_gdpr_banner=1&primary_color=d9803e&embed_domain=" + encodeURIComponent(location.hostname) + "&embed_type=Inline";
  }

  var q = new URLSearchParams(location.search).get("sujet");
  if (q && [].some.call(fNeed.options, function (o) { return o.value === q; })) {
    fNeed.value = q;
    var note = $("sujetNote");
    if (note) { note.textContent = "Sujet choisi : " + fNeed.options[fNeed.selectedIndex].text + ". Mentionnez-le lors de la réservation, ou envoyez-le-nous avec le formulaire ci-dessous."; note.hidden = false; }
  }

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

  function showDone(name, mail) {
    var first = L.firstName(name);
    $("doneTitle").textContent = first ? "Merci " + first + ", votre demande est envoyée" : "Merci, votre demande est envoyée";
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
    if (fTrap.value) { showDone(name, mail); return; }

    var subject = buildSubject(name || mail), body = buildBody(name, mail, tel);
    busy(true);
    L.send({ name: name, email: mail, tel: tel, label: needLabel(), code: fNeed.value, subject: subject, body: body }).then(function (sent) {
      busy(false);
      if (sent) {
        L.writeMem({ name: name, email: mail, tel: tel });
        showDone(name, mail);
      } else {
        showFail(subject, body);
      }
    });
  });

  $("retry").addEventListener("click", function () { panel("form"); (fields.hidden ? btn : fMail).focus(); });
  $("again").addEventListener("click", function () { panel("form"); fNeed.focus(); });
})();
