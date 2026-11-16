/* Carte « Programme détaillé » des fiches ateliers : le programme n'est chargé qu'après l'envoi
   des coordonnées (ou si le visiteur est déjà connu et clique). Dépend de lead.js. */
(function () {
  "use strict";
  var gate = document.getElementById("progGate");
  var L = window.DaniaLead;
  if (!gate || !L) return;
  var $ = function (id) { return document.getElementById(id); };
  var slug = gate.dataset.slug, label = gate.dataset.label;
  var form = $("progForm"), fMail = $("pg-mail"), fName = $("pg-name"), fTrap = $("pg-trap"), btn = $("progBtn"),
      fields = $("progFields"), known = $("progKnown"), fail = $("progFail"), lock = $("progLock"), body = $("progBody");

  function showFields() { known.hidden = true; fields.hidden = false; }
  var mem = L.readMem();
  if (mem && L.isEmail(mem.email)) {
    fMail.value = mem.email; fName.value = mem.name || "";
    $("progHello").textContent = L.firstName(mem.name) ? "Bonjour " + L.firstName(mem.name) + "." : "Bonjour.";
    known.hidden = false; fields.hidden = true;
  }
  $("progForget").addEventListener("click", function () { L.clearMem(); fMail.value = fName.value = ""; showFields(); fMail.focus(); });
  $("progEdit").addEventListener("click", function () { showFields(); fMail.focus(); });

  /* Le programme est un fragment HTML de ce site, chargé seulement ici. */
  function reveal() {
    return fetch("/programme/" + slug, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.text();
    }).then(function (html) {
      body.innerHTML = html;
      body.hidden = false;
      lock.hidden = true;
      body.focus();
      return true;
    }).catch(function () { return false; });
  }

  function busy(on) { btn.disabled = on; btn.textContent = on ? "Un instant…" : "Consulter le programme"; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = fName.value.trim(), mail = fMail.value.trim();
    var bad = !L.isEmail(mail);
    fMail.setAttribute("aria-invalid", bad ? "true" : "false");
    $("pg-e-mail").hidden = !bad;
    if (bad) { if (fields.hidden) showFields(); fMail.focus(); return; }
    if (fTrap.value) return; /* champ piège : on ne fait rien */

    var what = "Programme détaillé · " + label;
    var subject = "Demande DAN-IA · Programme détaillé : " + label + " · " + (name || mail);
    var text = ["Bonjour,", "", "Je souhaite consulter le programme détaillé de : " + label + ".", "",
      "Prénom : " + (name || "(non renseigné)"), "E-mail : " + mail, "", "Envoyé depuis la fiche « " + label + " » du site DAN-IA."].join("\n");
    busy(true);
    L.send({ name: name, email: mail, tel: "", label: what, code: "programme-" + slug, subject: subject, body: text }).then(function (sent) {
      if (!sent) return false;
      L.writeMem({ name: name, email: mail, tel: (L.readMem() || {}).tel || "" });
      return reveal();
    }).then(function (shown) {
      busy(false);
      if (!shown) {
        $("progMail").href = "mailto:" + L.CFG.MAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
        fail.hidden = false; fail.focus();
      } else { fail.hidden = true; }
    });
  });
})();
