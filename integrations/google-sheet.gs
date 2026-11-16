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
 *    et la coller dans « endpoint », en haut de config.js.
 *
 * Mesure d'audience et tableau de bord /admin (à faire une seule fois) :
 * 5. Dans l'éditeur Apps Script, choisir la fonction « installer » puis Exécuter : elle crée l'onglet
 *    « Événements » et ajoute 3 colonnes à « Demandes » (M à O : identifiant, session, test). Masquer ces colonnes.
 * 6. Paramètres du projet (roue dentée) > Propriétés du script > Ajouter : ADMIN_TOKEN = une longue
 *    phrase secrète (20 caractères ou plus). C'est le jeton à saisir sur /admin. Ne jamais le mettre dans le dépôt.
 * 7. Déployer > Gérer les déploiements > Modifier > Nouvelle version.
 *
 * Données : « Demandes » = demandes (confirmée si Envoi Formspree = ok). « Événements » = mesure anonyme
 * (pages vues, clics, début de formulaire, Core Web Vitals), sans e-mail ni nom. Ces deux onglets ne doivent
 * pas être renommés. Pour alléger le tableur au bout de plusieurs mois, copier les anciennes lignes
 * d'« Événements » dans un autre fichier puis les supprimer ici (la collecte reprend sans interruption).
 *
 * Après toute modification de ce script : Déployer > Gérer les déploiements > Modifier > Nouvelle version.
 *
 * Colonnes de l'onglet « Demandes » (A à L) :
 * Date et heure | Statut | Prénom | E-mail | Téléphone | Sujet | Origine de la visite |
 * Envoi Formspree | Notes | Message | Code du sujet (masquée) | Page (masquée) |
 * Identifiant de la demande (masquée) | Session (masquée) | Test (masquée)
 */
var SHEET_NAME = 'Demandes';
var EVENTS_NAME = 'Événements';
var DEFAULT_STATUS = 'Nouveau';
var TZ = 'Europe/Paris';
var EVENT_HEADERS = ['Date et heure', 'Type', 'Visiteur', 'Session', 'Id événement', 'Page', 'Titre', 'Domaine d\'origine',
  'utm_source', 'utm_medium', 'utm_campaign', 'Appareil', 'Libellé', 'Valeur', 'Test', 'Détail'];
var EVENT_TYPES = { pv: 1, cta: 1, fs: 1, agenda_auto: 1, cwv: 1 };
var MAX_SESSIONS = 60000, MAX_EVENT_ROWS = 250000, MAX_CWV = 20000;

function doGet() { return out_('DAN-IA : service actif'); }

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d && d.k === 'ev') return logEvents_(d.e);
    if (d && d.k === 'read') return readStats_(d);
    return logRequest_(d);
  } catch (err) {
    return out_('erreur');
  }
}

/* À exécuter une fois depuis l'éditeur : prépare les onglets. */
function installer() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var ev = book.getSheetByName(EVENTS_NAME) || book.insertSheet(EVENTS_NAME);
  if (ev.getLastRow() < 1) {
    ev.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]).setFontWeight('bold');
    ev.setFrozenRows(1);
    ev.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
  var dem = book.getSheetByName(SHEET_NAME) || book.getSheets()[0];
  dem.getRange(1, 13, 1, 3).setValues([['Identifiant de la demande', 'Session', 'Test']]).setFontWeight('bold');
}

/* ---------- Demandes de rendez-vous ---------- */
function logRequest_(d) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
    var email = clean_(d.email, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out_('refusé');
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName(SHEET_NAME) || book.getSheets()[0];
    var rid = clean_(d.rid, 40);
    /* Une même demande n'est jamais comptée deux fois. */
    if (rid && sheet.getLastRow() > 1) {
      var ids = sheet.getRange(2, 13, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === rid) return out_('doublon');
    }
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
      clean_(d.page, 300),            // L Page
      rid,                            // M Identifiant de la demande
      clean_(d.sid, 40),              // N Session (vide si la mesure n'a pas pu être reliée)
      d.test ? 1 : 0                  // O Test
    ]);
    return out_('ok');
  } catch (err) {
    return out_('erreur');
  } finally {
    if (locked) lock.releaseLock();
  }
}

/* ---------- Mesure d'audience : enregistrement des événements ---------- */
function logEvents_(list) {
  if (!Array.isArray(list) || !list.length) return out_('vide');
  list = list.slice(0, 50);
  var cache = CacheService.getScriptCache();
  var vkey = 'v' + String(list[0] && list[0].v || '').slice(0, 20);
  var n = parseInt(cache.get(vkey) || '0', 10), g = parseInt(cache.get('g') || '0', 10);
  if (n > 150 || g > 4000) return out_('limite');
  cache.put(vkey, String(n + list.length), 60);
  cache.put('g', String(g + list.length), 60);

  var now = new Date(), rows = [], starts = {};
  list.forEach(function (x) {
    if (!x || !EVENT_TYPES[x.t] || !x.s || !x.e) return;
    var num = (x.n === '' || x.n == null || isNaN(Number(x.n))) ? '' : Number(x.n);
    rows.push([now, x.t, clean_(x.v, 40), clean_(x.s, 40), clean_(x.e, 40), clean_(x.p, 200), clean_(x.ti, 120),
      clean_(x.r, 100), clean_(x.us, 60), clean_(x.um, 60), clean_(x.uc, 60), clean_(x.d, 20), clean_(x.l, 40), num,
      x.z ? 1 : 0, clean_(x.x, 60)]);
    starts[x.t] = 1;
  });
  if (!rows.length) return out_('vide');

  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName(EVENTS_NAME);
    if (!sheet) { installer(); sheet = book.getSheetByName(EVENTS_NAME); }
    var last = Math.max(sheet.getLastRow(), 1);
    sheet.getRange(last + 1, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
    /* Date de début de collecte de chaque type de mesure (conservée une fois pour toutes). */
    var props = PropertiesService.getScriptProperties();
    Object.keys(starts).forEach(function (t) {
      if (!props.getProperty('start_' + t)) props.setProperty('start_' + t, String(now.getTime()));
    });
    return out_('ok');
  } catch (err) {
    return out_('erreur');
  } finally {
    if (locked) lock.releaseLock();
  }
}

/* ---------- Lecture pour /admin (protégée par ADMIN_TOKEN) ---------- */
function readStats_(d) {
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get('fails') || '0', 10);
  if (fails >= 10) return json_({ error: 'verrouillé' });
  var token = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!token || token.length < 12 || String(d.token || '') !== token) {
    cache.put('fails', String(fails + 1), 600);
    return json_({ error: 'refusé' });
  }
  cache.remove('fails');
  var from = Number(d.from), to = Number(d.to);
  if (!(from > 0) || !(to > from)) return json_({ error: 'période invalide' });

  var book = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var meta = { starts: {}, now: Date.now(), truncated: false };
  ['pv', 'cta', 'fs', 'cwv', 'agenda_auto'].forEach(function (t) {
    var v = props.getProperty('start_' + t); meta.starts[t] = v ? Number(v) : null;
  });

  var evRows = [];
  var evSheet = book.getSheetByName(EVENTS_NAME);
  if (evSheet && evSheet.getLastRow() > 1) {
    var last = evSheet.getLastRow();
    var tsCol = evSheet.getRange(2, 1, last - 1, 1).getValues();
    var lo = 0, hi = tsCol.length;                       /* premier index dont la date >= from (lignes chronologiques) */
    while (lo < hi) { var mid = (lo + hi) >> 1; if (tsCol[mid][0].getTime() < from) lo = mid + 1; else hi = mid; }
    var count = tsCol.length - lo;
    if (count > MAX_EVENT_ROWS) { lo = tsCol.length - MAX_EVENT_ROWS; count = MAX_EVENT_ROWS; meta.truncated = true; }
    if (count > 0) evRows = evSheet.getRange(2 + lo, 1, count, EVENT_HEADERS.length).getValues();
    evRows = evRows.map(function (r) { r[0] = r[0].getTime(); return r; });
  }

  var demRows = [];
  var dem = book.getSheetByName(SHEET_NAME) || book.getSheets()[0];
  if (dem.getLastRow() > 1) {
    var all = dem.getRange(2, 1, dem.getLastRow() - 1, 15).getValues();
    meta.starts.demandes = all[0][0] instanceof Date ? all[0][0].getTime() : null;
    all.forEach(function (r) {
      if (!(r[0] instanceof Date)) return;
      var t = r[0].getTime();
      if (t < from || t > to) return;
      demRows.push([t, String(r[7]), String(r[12]), String(r[13]), r[14] ? 1 : 0, String(r[10]), String(r[11])]);
    });
  }
  var res = aggregate_(evRows, demRows, from, to);
  res.meta = meta;
  if (res.truncated) meta.truncated = true;
  return json_(res);
}

/* Fonction pure (testable hors Apps Script).
   ev  : lignes de l'onglet Événements, date en millisecondes.
   dem : [date, envoi, rid, sid, test, codeSujet, page].
   Sessions : une ligne par session ; pages vues : agrégées par jour (heure de Paris), page et appareil. */
function aggregate_(ev, dem, from, to, dayFn) {
  dayFn = dayFn || function (ms) { return Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd'); };
  var seen = {}, S = {}, order = [], pv = {}, titles = {}, cwv = [], truncated = false;
  ev.forEach(function (r) {
    var ts = r[0], type = r[1], sid = r[3], eid = r[4];
    if (ts < from || ts > to || !sid) return;
    if (eid) { if (seen[eid]) return; seen[eid] = 1; }
    var s = S[sid];
    if (!s) {
      if (order.length >= MAX_SESSIONS) { truncated = true; return; }
      s = S[sid] = { sid: sid, vid: r[2], first: ts, last: ts, entry: '', entryTs: Infinity, ref: r[7], us: r[8], um: r[9], uc: r[10],
        dev: r[11], pv: 0, cta: 0, rdv: 0, fs: 0, mail: 0, agenda: 0, auto: 0, test: 0, rc: 0 };
      order.push(sid);
    }
    if (ts < s.first) s.first = ts;
    if (ts > s.last) s.last = ts;
    if (r[14]) s.test = 1;
    var path = r[5], day = dayFn(ts);
    if (type === 'pv') {
      s.pv++;
      if (ts < s.entryTs) { s.entryTs = ts; s.entry = path; }
      if (path === '/rendez-vous') s.rdv = 1;
      var k = day + '|' + path + '|' + r[11] + '|' + (r[14] ? 1 : 0);
      var a = pv[k] || (pv[k] = [day, path, r[11], 0, 0, r[14] ? 1 : 0]);
      a[3]++;
      if (r[6]) titles[path] = r[6];
    } else if (type === 'cta') {
      s.cta++;
      if (r[12] === 'mail') s.mail = 1; else if (r[12] === 'agenda') s.agenda = 1; else if (r[12] === 'rdv') s.rc = 1;
      var k2 = day + '|' + path + '|' + r[11] + '|' + (r[14] ? 1 : 0);
      var a2 = pv[k2] || (pv[k2] = [day, path, r[11], 0, 0, r[14] ? 1 : 0]);
      a2[4]++;
    } else if (type === 'fs') {
      s.fs = 1;
    } else if (type === 'agenda_auto') {
      s.auto = 1;
    } else if (type === 'cwv') {
      if (cwv.length < MAX_CWV && r[13] !== '') cwv.push([ts, path, r[11], r[12], r[13], r[14] ? 1 : 0]);
    }
  });
  var sessions = order.map(function (id) {
    var s = S[id];
    return [s.sid, s.vid, s.first, s.last, s.entry, s.ref, s.us, s.um, s.uc, s.dev, s.pv, s.cta, s.rdv, s.fs, s.mail, s.agenda, s.auto, s.test, s.rc];
  });
  return { sessions: sessions, pages: Object.keys(pv).map(function (k) { return pv[k]; }), titles: titles, cwv: cwv, demandes: dem, truncated: truncated };
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Texte brut, limité en taille. */
function text_(v, max) { return String(v == null ? '' : v).slice(0, max); }

/* Idem, et neutralise les formules (=, +, -, @) saisies par un visiteur. */
function clean_(v, max) {
  var s = text_(v, max);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}
function out_(t) { return ContentService.createTextOutput(t); }
