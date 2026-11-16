/**
 * Enregistre chaque demande du site DAN-IA dans la première feuille de ce tableur.
 *
 * Installation (2 minutes) :
 * 1. Ouvrir le tableur « DAN-IA · Demandes de rendez-vous », menu Extensions > Apps Script.
 * 2. Remplacer le contenu par ce fichier, puis Enregistrer.
 * 3. Déployer > Nouveau déploiement > type « Application Web »
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 4. Autoriser l'accès demandé, copier l'URL de l'application Web (elle se termine par /exec)
 *    et la coller dans SHEET_ENDPOINT, en haut de rdv.js.
 *
 * Après toute modification de ce script : Déployer > Gérer les déploiements > Modifier > Nouvelle version.
 */
var HEADERS = ['Date et heure', 'Prénom', 'E-mail', 'Téléphone', 'Sujet', 'Code du sujet',
               'Origine de la visite', 'Page', 'Envoi Formspree', 'Message'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
    var d = JSON.parse(e.postData.contents);
    var email = clean_(d.email, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out_('refusé');
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    sheet.appendRow([
      new Date(), clean_(d.prenom, 100), email, clean_(d.telephone, 40), clean_(d.sujet, 200),
      clean_(d.code_sujet, 50), clean_(d.origine, 300), clean_(d.page, 300),
      clean_(d.formspree, 20), clean_(d.message, 2000)
    ]);
    return out_('ok');
  } catch (err) {
    return out_('erreur');
  } finally {
    if (locked) lock.releaseLock();
  }
}

/* Coupe les textes trop longs et neutralise les formules (=, +, -, @) saisies par un visiteur. */
function clean_(v, max) {
  var s = String(v == null ? '' : v).slice(0, max);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}
function out_(t) { return ContentService.createTextOutput(t); }
