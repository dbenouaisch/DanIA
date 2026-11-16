/**
 * Enregistre chaque demande du site DAN-IA dans l'onglet « Demandes » de ce tableur.
 * (Le tableur est déjà mis en forme : ne pas renommer l'onglet ni déplacer les colonnes.)
 *
 * Installation (2 minutes) :
 * 1. Ouvrir le tableur « DAN-IA · Demandes de rendez-vous », menu Extensions > Apps Script.
 * 2. Remplacer le contenu par ce fichier, puis Enregistrer.
 * 3. Déployer > Nouveau déploiement > type « Application Web »
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 4. Autoriser l'accès demandé, copier l'URL de l'application Web (elle se termine par /exec)
 *    et la coller dans SHEET_ENDPOINT, en haut de lead.js.
 *
 * Après toute modification de ce script : Déployer > Gérer les déploiements > Modifier > Nouvelle version.
 *
 * Colonnes de l'onglet « Demandes » (A à L) :
 * Date et heure | Statut | Prénom | E-mail | Téléphone | Sujet | Origine de la visite |
 * Envoi Formspree | Notes | Message | Code du sujet (masquée) | Page (masquée)
 */
var SHEET_NAME = 'Demandes';
var DEFAULT_STATUS = 'Nouveau';

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
    var d = JSON.parse(e.postData.contents);
    var email = clean_(d.email, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out_('refusé');
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName(SHEET_NAME) || book.getSheets()[0];
    sheet.appendRow([
      new Date(),                     // A Date et heure
      DEFAULT_STATUS,                 // B Statut (liste déroulante)
      clean_(d.prenom, 100),          // C Prénom
      email,                          // D E-mail
      text_(d.telephone, 40),         // E Téléphone (texte brut : le « + » est conservé)
      clean_(d.sujet, 200),           // F Sujet
      clean_(d.origine, 300),         // G Origine de la visite
      clean_(d.formspree, 20),        // H Envoi Formspree (ok / échec)
      '',                             // I Notes (saisies à la main)
      clean_(d.message, 2000),        // J Message
      clean_(d.code_sujet, 50),       // K Code du sujet
      clean_(d.page, 300)             // L Page
    ]);
    return out_('ok');
  } catch (err) {
    return out_('erreur');
  } finally {
    if (locked) lock.releaseLock();
  }
}

/* Texte brut, limité en taille. */
function text_(v, max) { return String(v == null ? '' : v).slice(0, max); }

/* Idem, et neutralise les formules (=, +, -, @) saisies par un visiteur. */
function clean_(v, max) {
  var s = text_(v, max);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}
function out_(t) { return ContentService.createTextOutput(t); }
