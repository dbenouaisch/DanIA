/* Page de suivi DAN-IA : audience, parcours des visiteurs, sources, pages, fidélité.
   Lit les données agrégées du script Google (integrations/google-sheet.gs) avec le mot de passe de la page.
   Toutes les valeurs venant des visiteurs (pages, titres, domaines, UTM) sont échappées avant affichage. */
(function () {
  "use strict";
  var CFG = window.DANIA_CONFIG || {}, EP = CFG.endpoint || "", TZ = "Europe/Paris";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(n) { return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 }); }
  function dec(n) { return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 1 }); }
  function pct(r) { return (r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %"; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} return null; }
  function dur(ms) { var s = Math.round(ms / 1000); if (s < 60) return s + " s"; var m = Math.floor(s / 60); if (m < 60) return m + " min " + pad(s % 60) + " s"; return Math.floor(m / 60) + " h " + pad(m % 60) + " min"; }

  /* ---------- Heure de Paris ---------- */
  var PF = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  function parts(ms) { var o = {}; PF.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; }); return o; }
  function offset(ms) { var p = parts(ms); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; }
  function midnight(y, m, d) { var t = Date.UTC(y, m - 1, d), t0 = t - offset(t); return t - offset(t0); }
  function ymd(ms) { var p = parts(ms); return [+p.year, +p.month, +p.day]; }
  function addDays(a, n) { var x = new Date(Date.UTC(a[0], a[1] - 1, a[2] + n)); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; }
  function dkey(a) { return a[0] + "-" + pad(a[1]) + "-" + pad(a[2]); }
  function dayOf(ms) { return dkey(ymd(ms)); }
  function fDate(ms, withTime) { return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: withTime ? "2-digit" : undefined, minute: withTime ? "2-digit" : undefined }).format(new Date(ms)); }
  function fShort(ms) { return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms)); }
  function fHour(ms) { return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(ms)); }
  function fDay(key) { var a = key.split("-"); return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(+a[0], +a[1] - 1, +a[2]))); }

  /* ---------- État ---------- */
  var P = { p: "7", from: "", to: "" }, F = { chan: "", camp: "", page: "", dev: "", test: false };
  var mode = "aud", gran = "day", sort = { col: "views", dir: -1 }, visitLimit = 25;
  var D = null, token = ss("dania-suivi-mdp") || "", fetchedAt = 0, per = null, timer = 0;

  /* ---------- Noms lisibles des pages ---------- */
  var NAMES = { "/": "Accueil", "/formations": "Formations", "/conseil": "Conseil", "/offres": "Offres", "/a-propos": "À propos", "/ia-au-quotidien": "L’IA au quotidien", "/bureautique": "Bureautique boostée par l’IA", "/agent-ia": "Créer son agent IA", "/diagnostic": "Diagnostic IA", "/rendez-vous": "Rendez-vous (agenda)" };
  function pname(p) { return NAMES[p] || (D && D.titles[p] ? D.titles[p].replace(/ · DAN-IA$/, "") : p); }

  /* ---------- Période ---------- */
  function period() {
    var now = Date.now(), t = ymd(now), N, fromP, toMs;
    if (P.p === "custom" && P.from && P.to) {
      var a = P.from.split("-").map(Number), b = P.to.split("-").map(Number);
      if (Date.UTC(b[0], b[1] - 1, b[2]) < Date.UTC(a[0], a[1] - 1, a[2])) { var x = a; a = b; b = x; }
      fromP = a; N = Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 864e5) + 1;
      toMs = Math.min(midnight.apply(null, addDays(b, 1)) - 1, now);
    } else { N = P.p === "today" ? 1 : (+P.p || 7); fromP = addDays(t, -(N - 1)); toMs = now; }
    var from = midnight.apply(null, fromP), pFrom = midnight.apply(null, addDays(fromP, -N));
    return { N: N, from: from, to: toMs, pFrom: pFrom, pTo: pFrom + (toMs - from), week: midnight.apply(null, addDays(t, -6)), dataFrom: Math.min(pFrom, from), now: now };
  }

  /* ---------- Chargement ---------- */
  function setStatus(t) { $("status").textContent = t || ""; }
  function load(quiet) {
    if (!EP) { setStatus("Aucune adresse de collecte n’est configurée (config.js). Rien ne peut être affiché."); return Promise.resolve(); }
    per = period();
    if (!quiet) setStatus("Chargement des données…");
    return fetch(EP, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ k: "read", token: token, from: per.dataFrom, to: per.now + 60000 }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) {
          if (j.error === "verrouillé") showLogin("Trop d’essais : réessayez dans 15 minutes.");
          else { ss("dania-suivi-mdp", null); token = ""; showLogin("Mot de passe incorrect."); }
          return;
        }
        D = prepare(j); fetchedAt = Date.now(); setStatus(""); syncFilters(); render();
      }, function () { setStatus("Impossible de joindre le script Google (réseau, URL ou déploiement). Les chiffres affichés datent de la dernière actualisation."); });
  }

  /* ---------- Sources ---------- */
  var SEARCH = /(^|\.)(google|bing|duckduckgo|ecosia|qwant|yahoo|brave|startpage|baidu|yandex|ask|lilo|search)\./;
  var SOCIAL = /(^|\.)(facebook|fb|instagram|linkedin|lnkd|twitter|t|x|youtube|youtu|tiktok|pinterest|reddit|whatsapp|wa|threads|bsky|snapchat|mastodon)\.(com|in|co|me|net|app|social|be)$/;
  function classify(s) {
    if (s.us || s.um || s.uc) { s.chan = "Campagnes UTM"; s.camp = s.uc || "(sans nom)"; s.src = (s.us || "(inconnue)") + (s.um ? " / " + s.um : ""); }
    else if (s.ref) { s.chan = SEARCH.test(s.ref) ? "Recherche" : (SOCIAL.test(s.ref) ? "Réseaux sociaux" : "Sites référents"); s.camp = ""; s.src = s.ref; }
    else { s.chan = "Accès direct ou source inconnue"; s.camp = ""; s.src = "—"; }
  }
  var CHANS = ["Recherche", "Réseaux sociaux", "Sites référents", "Campagnes UTM", "Accès direct ou source inconnue"];
  function kindOf(code) { code = String(code || ""); return /^programme-/.test(code) ? "Programme PDF" : (/^diagnostic-/.test(code) ? "Résultat du diagnostic" : "Message ou rendez-vous"); }

  function prepare(j) {
    var by = {};
    var S = j.sessions.map(function (r) {
      var s = { sid: r[0], vid: r[1], first: r[2], last: r[3], entry: r[4] || "(inconnue)", ref: r[5], us: r[6], um: r[7], uc: r[8], dev: r[9] || "inconnu", pv: r[10], cta: r[11], rdv: r[12], fs: r[13] | 0, mail: r[14], agenda: r[15], auto: r[16], test: r[17], rc: r[18] || 0,
        seq: r[19] ? r[19].split(">") : [], steps: r[20] || null, dg: r[21] || 0, pdf: r[22] || 0, exit: r[23] || r[4] || "", conv: 0, dems: [] };
      s.one = s.pv <= 1; classify(s); by[s.sid] = s; return s;
    });
    var seen = {}, dem = j.demandes.map(function (r) { return { ts: r[0], ok: r[1] === "ok", rid: r[2], sid: r[3], test: r[4], code: r[5], kind: kindOf(r[5]), page: r[6], s: null }; })
      .filter(function (d) { if (!d.rid) return true; if (seen[d.rid]) return false; seen[d.rid] = 1; return true; });
    dem.forEach(function (d) { if (d.ok && d.sid && by[d.sid]) { d.s = by[d.sid]; d.s.dems.push(d); if (!d.test) d.s.conv++; } });
    var firstOf = {};
    S.forEach(function (s) { if (!(s.vid in firstOf) || s.first < firstOf[s.vid]) firstOf[s.vid] = s.first; });
    return { S: S, by: by, dem: dem, firstOf: firstOf, pages: j.pages.map(function (r) { return { day: r[0], path: r[1], dev: r[2], views: r[3], cta: r[4], test: r[5] }; }), titles: j.titles || {},
      cwv: j.cwv.map(function (r) { return { ts: r[0], path: r[1], dev: r[2], m: r[3], v: r[4], test: r[5] }; }), meta: j.meta || { starts: {} }, truncated: j.truncated };
  }

  /* ---------- Filtres ---------- */
  function filtersActive() { return !!(F.chan || F.camp || F.page || F.dev); }
  function passS(s) {
    if (s.test && !F.test) return false;
    if (F.chan && s.chan !== F.chan) return false;
    if (F.camp && (F.camp === "(hors campagne)" ? s.camp !== "" : s.camp !== F.camp)) return false;
    if (F.page && s.entry !== F.page) return false;
    if (F.dev && s.dev !== F.dev) return false;
    return true;
  }
  function inR(ms, a, b) { return ms >= a && ms <= b; }
  function sessionsIn(a, b) { return D.S.filter(function (s) { return inR(s.first, a, b) && passS(s); }); }
  function demIn(a, b) { return D.dem.filter(function (d) { return d.ok && inR(d.ts, a, b) && (F.test || !d.test) && (d.s ? passS(d.s) : !filtersActive()); }); }
  function metrics(a, b) {
    var S = sessionsIn(a, b), v = {}, pv = 0, conv = 0, one = 0, tot = 0;
    S.forEach(function (s) { v[s.vid] = 1; pv += s.pv; if (s.conv > 0) conv++; if (s.one) one++; tot += s.last - s.first; });
    return { sessions: S.length, visitors: Object.keys(v).length, pv: pv, dem: demIn(a, b).length, convS: conv, rate: S.length ? conv / S.length : null, one: one, bounce: S.length ? one / S.length : null, avgDur: S.length ? tot / S.length : null, ppS: S.length ? pv / S.length : null, list: S };
  }

  /* ---------- Cellules : zéro, indisponible, volume insuffisant ---------- */
  function tNA(t) { return '<span class="tag t-na" title="' + esc(t || "Donnée non collectée sur cette période") + '">Indisponible</span>'; }
  function tLow(n) { return '<span class="tag t-low" title="Trop peu de mesures pour conclure">Volume insuffisant</span><span class="n-small">n = ' + fmt(n) + "</span>"; }
  function tZero() { return '<span class="tag t-zero">0</span>'; }
  function cell(v, n, min, f) {
    if (v === null || v === undefined) return tNA();
    if (n < min) return tLow(n);
    if (v === 0) return tZero() + (min > 0 ? '<span class="n-small">n = ' + fmt(n) + "</span>" : "");
    return esc(f(v)) + (min > 0 ? '<span class="n-small">n = ' + fmt(n) + "</span>" : "");
  }
  function cover(start, a, b) { if (!start || b < start) return "none"; return a < start ? "partial" : "full"; }
  function rateCell(conv, n) { return n ? cell(conv / n, n, 30, pct) : '<span class="muted" title="Aucune session">—</span>'; }
  function simpleTable(head, rows) { return '<table><thead><tr>' + head.map(function (h) { return "<th" + (h.n ? ' class="n"' : "") + ">" + esc(h.t) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return "<td" + (head[i].n ? ' class="n"' : "") + ">" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>"; }

  /* ---------- Vue d'ensemble ---------- */
  function delta(cur, prev, isRate) {
    if (isRate) { var d = (cur - prev) * 100; return '<span class="' + (d > 0.05 ? "up" : (d < -0.05 ? "down" : "flat")) + '">' + (d > 0 ? "+" : "") + dec(d) + " pt</span>"; }
    if (prev === 0) return cur === 0 ? '<span class="flat">= 0 avant</span>' : '<span class="up">nouveau</span>';
    var r = (cur - prev) / prev;
    return '<span class="' + (r > 0.005 ? "up" : (r < -0.005 ? "down" : "flat")) + '">' + (r > 0 ? "+" : "") + (r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " %</span>";
  }
  function kpis() {
    var C = metrics(per.from, per.to), Pv = metrics(per.pFrom, per.pTo), st = D.meta.starts, pvStart = st.pv, demStart = st.demandes || st.pv;
    var cvA = cover(pvStart, per.from, per.to), cvD = cover(demStart, per.from, per.to), prevOk = pvStart && pvStart <= per.pFrom, prevOkD = demStart && demStart <= per.pFrom;
    var kinds = {}; demIn(per.from, per.to).forEach(function (d) { kinds[d.kind] = (kinds[d.kind] || 0) + 1; });
    var kt = Object.keys(kinds).map(function (k) { return kinds[k] + " " + k.toLowerCase(); }).join(" · ");
    function card(label, val, n, min, f, cur, prev, ok, cv, src, isRate, extra, big) {
      var cmp = cv === "none" ? tNA("La collecte n’avait pas commencé") : (!ok ? '<span class="flat">Comparaison indisponible' + (pvStart ? " (collecte depuis le " + esc(fDate(pvStart)) + ")" : "") + "</span>" :
        delta(cur, prev, isRate) + ' <span class="muted">vs période précédente (' + (isRate ? pct(prev) : f(prev)) + ")</span>");
      return '<div class="kpi' + (big ? " big" : "") + '"><div class="l">' + label + '</div><div class="v">' + (cv === "none" ? tNA() : cell(val, n, min, f)) + '</div><div class="d">' + cmp + '</div><div class="s">' + esc(src) + (cv === "partial" ? " · période partielle" : "") + (extra ? " · " + esc(extra) : "") + "</div></div>";
    }
    var h = card("Visiteurs uniques estimés", C.visitors, C.visitors, 0, fmt, C.visitors, Pv.visitors, prevOk, cvA, "Un identifiant par navigateur", false, "", true);
    h += card("Sessions (visites)", C.sessions, C.sessions, 0, fmt, C.sessions, Pv.sessions, prevOk, cvA, "30 min d’inactivité = nouvelle visite", false);
    h += card("Pages vues", C.pv, C.pv, 0, fmt, C.pv, Pv.pv, prevOk, cvA, "Toutes pages du site", false);
    h += card("Demandes confirmées", C.dem, C.dem, 0, fmt, C.dem, Pv.dem, prevOkD, cvD, "Envoi confirmé par Formspree", false, kt);
    h += card("Taux de conversion", C.rate, C.sessions, 30, pct, C.rate || 0, Pv.rate || 0, prevOk && Pv.rate !== null && Pv.sessions >= 30, cvA, "Visites avec au moins une demande", true);
    h += card("Pages par visite", C.ppS, C.sessions, 30, dec, C.ppS || 0, Pv.ppS || 0, prevOk && Pv.sessions >= 30, cvA, "Profondeur de lecture", false);
    h += card("Durée moyenne", C.avgDur, C.sessions, 30, dur, C.avgDur || 0, Pv.avgDur || 0, prevOk && Pv.sessions >= 30, cvA, "Estimée sur les visites mesurées", false);
    h += card("Visites sur une seule page", C.bounce, C.sessions, 30, pct, C.bounce || 0, Pv.bounce || 0, prevOk && Pv.sessions >= 30, cvA, "Part des visites sans 2e page", true);
    $("kpis").innerHTML = h;
  }

  /* ---------- Évolution (jour / semaine / mois) ---------- */
  function weekKey(a) { var dow = (new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay() + 6) % 7; return dkey(addDays(a, -dow)); }
  function bucketKey(ms) {
    if (per.N === 1 && gran === "day") return pad(+parts(ms).hour);
    var a = ymd(ms);
    return gran === "month" ? a[0] + "-" + pad(a[1]) : (gran === "week" ? weekKey(a) : dkey(a));
  }
  function bucketList() {
    if (per.N === 1 && gran === "day") { var o = []; for (var h = 0; h < 24; h++) o.push(pad(h)); return o; }
    var out = [], seen = {}, base = ymd(per.from), n = Math.ceil((per.to - per.from) / 864e5) + 1;
    for (var i = 0; i < n; i++) { var k = bucketKey(midnight.apply(null, addDays(base, i)) + 3600e3); if (!seen[k]) { seen[k] = 1; out.push(k); } }
    return out;
  }
  function bucketLabel(k) {
    if (per.N === 1 && gran === "day") return k + " h";
    if (gran === "month") { var a = k.split("-"); return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(Date.UTC(+a[0], +a[1] - 1, 1))); }
    if (gran === "week") return "Sem. " + fDay(k).replace(/^[^ ]+ /, "");
    return fDay(k);
  }
  function series() {
    var keys = bucketList(), idx = {}; keys.forEach(function (k, i) { idx[k] = i; });
    var sess = keys.map(function () { return 0; }), vis = keys.map(function () { return {}; }), pv = keys.map(function () { return 0; }), dem = keys.map(function () { return 0; });
    sessionsIn(per.from, per.to).forEach(function (s) { var i = idx[bucketKey(s.first)]; if (i != null) { sess[i]++; vis[i][s.vid] = 1; pv[i] += s.pv; } });
    demIn(per.from, per.to).forEach(function (d) { var i = idx[bucketKey(d.ts)]; if (i != null) dem[i]++; });
    return { keys: keys, sess: sess, vis: vis.map(function (o) { return Object.keys(o).length; }), pv: pv, dem: dem };
  }
  function lineChart(el, keys, lines, labelFn) {
    var W = 800, H = 260, L = 44, R = 12, T = 12, B = 30, n = keys.length, max = 1;
    lines.forEach(function (l) { l.v.forEach(function (x) { if (x > max) max = x; }); });
    var top = Math.max(4, max), step = Math.pow(10, Math.floor(Math.log10(top / 4))); top = Math.ceil(top / 4 / step) * step * 4;
    function X(i) { return L + (n <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); }
    function Y(v) { return T + (H - T - B) * (1 - v / top); }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Courbe">';
    for (var g = 0; g <= 4; g++) { var gv = top * g / 4; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(gv) + '" y2="' + Y(gv) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (Y(gv) + 4) + '" text-anchor="end" font-size="12" fill="var(--muted)">' + fmt(gv) + "</text>"; }
    var every = Math.max(1, Math.ceil(n / 7));
    keys.forEach(function (k, i) { if (i % every === 0) s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="12" fill="var(--muted)">' + esc(labelFn(k)) + "</text>"; });
    lines.forEach(function (l) {
      s += '<polyline fill="none" stroke="' + l.c + '" stroke-width="2.5"' + (l.d ? ' stroke-dasharray="6 4"' : "") + ' points="' + l.v.map(function (v, i) { return X(i) + "," + Y(v); }).join(" ") + '"/>';
      if (n <= 40) l.v.forEach(function (v, i) { s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="3" fill="' + l.c + '"/>'; });
    });
    s += '<line id="guide" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/></svg>';
    el.innerHTML = s;
    var svg = el.querySelector("svg"), guide = svg.querySelector("#guide"), tip = $("tip"), cur = -1;
    function show(i, cx, cy) {
      cur = i; guide.setAttribute("x1", X(i)); guide.setAttribute("x2", X(i)); guide.setAttribute("visibility", "visible"); tip.hidden = false;
      tip.innerHTML = "<b>" + esc(labelFn(keys[i])) + "</b><br>" + lines.map(function (l) { return esc(l.n) + " : " + fmt(l.v[i]); }).join("<br>");
      tip.style.left = Math.min(cx + 12, innerWidth - 270) + "px"; tip.style.top = Math.max(cy - 50, 8) + "px";
    }
    function hide() { tip.hidden = true; guide.setAttribute("visibility", "hidden"); }
    function at(ev) { var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width; var i = n <= 1 ? 0 : Math.round((x - L) / ((W - L - R) / (n - 1))); show(Math.max(0, Math.min(n - 1, i)), ev.clientX, ev.clientY); }
    svg.addEventListener("pointermove", at); svg.addEventListener("pointerdown", at); svg.addEventListener("pointerleave", hide); svg.addEventListener("pointercancel", hide);
    el.onkeydown = function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault(); var i = cur < 0 ? 0 : cur + (e.key === "ArrowRight" ? 1 : -1); i = Math.max(0, Math.min(n - 1, i));
      var r = svg.getBoundingClientRect(); show(i, r.left + X(i) * r.width / W, r.top + 40);
    };
    el.onblur = hide;
  }
  function legend(items) { return '<div class="legend">' + items.map(function (l) { return '<span><i style="background:' + l.c + '"></i>' + esc(l.n) + "</span>"; }).join("") + "</div>"; }
  function chart() {
    var s = series(), cvA = cover(D.meta.starts.pv, per.from, per.to), lines;
    var gl = per.N === 1 && gran === "day" ? "Heure" : (gran === "month" ? "Mois" : (gran === "week" ? "Semaine" : "Jour"));
    if (cvA === "none") { $("chart").innerHTML = "<p>" + tNA() + "</p>"; $("chartTable").innerHTML = ""; return; }
    if (mode === "aud") lines = [{ n: "Visiteurs uniques estimés", v: s.vis, c: "var(--acc)" }, { n: "Sessions", v: s.sess, c: "var(--acc2)", d: 1 }];
    else if (mode === "pv") lines = [{ n: "Pages vues", v: s.pv, c: "var(--acc)" }];
    else lines = [{ n: "Demandes confirmées", v: s.dem, c: "var(--acc)" }];
    lineChart($("chart"), s.keys, lines, bucketLabel);
    $("chart").insertAdjacentHTML("afterbegin", legend(lines));
    var all = [{ n: "Visiteurs uniques", v: s.vis }, { n: "Sessions", v: s.sess }, { n: "Pages vues", v: s.pv }, { n: "Demandes", v: s.dem }];
    $("chartTable").innerHTML = simpleTable([{ t: gl }].concat(all.map(function (l) { return { t: l.n, n: 1 }; })), s.keys.map(function (k, i) { return [esc(bucketLabel(k))].concat(all.map(function (l) { return fmt(l.v[i]); })); }));
    $("gnote").textContent = "Les visiteurs uniques sont dédupliqués dans chaque " + (gran === "month" ? "mois" : (gran === "week" ? "semaine" : "jour")) + " : la somme des jours dépasse le total de la période.";
  }

  /* ---------- Sources ---------- */
  function sources() {
    var S = sessionsIn(per.from, per.to), cvA = cover(D.meta.starts.pv, per.from, per.to), tot = {}, src = {};
    CHANS.forEach(function (c) { tot[c] = { n: 0, c: 0, d: 0 }; });
    S.forEach(function (s) {
      var t = tot[s.chan]; t.n++; t.d += s.conv; if (s.conv > 0) t.c++;
      var nm = s.camp ? s.camp + " (" + s.src + ")" : s.src, k = s.chan + "|" + nm, o = src[k] || (src[k] = { chan: s.chan, name: nm, n: 0, c: 0, d: 0 });
      o.n++; o.d += s.conv; if (s.conv > 0) o.c++;
    });
    $("tChan").innerHTML = cvA === "none" ? tNA() : simpleTable([{ t: "Canal" }, { t: "Visites", n: 1 }, { t: "Part", n: 1 }, { t: "Demandes", n: 1 }, { t: "Conversion", n: 1 }],
      CHANS.map(function (c) { var t = tot[c]; return ['<button class="btn ghost" type="button" data-chan="' + esc(c) + '">' + esc(c) + "</button>", cell(t.n, t.n, 0, fmt), S.length ? pct(t.n / S.length) : "—", cell(t.d, t.n, 0, fmt), rateCell(t.c, t.n)]; }));
    var list = Object.keys(src).map(function (k) { return src[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 25);
    $("tSrc").innerHTML = cvA === "none" ? tNA() : (list.length ? simpleTable([{ t: "Source ou campagne" }, { t: "Canal" }, { t: "Visites", n: 1 }, { t: "Demandes", n: 1 }, { t: "Conversion", n: 1 }],
      list.map(function (o) { return [esc(o.name), esc(o.chan), cell(o.n, o.n, 0, fmt), cell(o.d, o.n, 0, fmt), rateCell(o.c, o.n)]; })) : "<p>" + tZero() + " visite sur la période.</p>");
    $("tChan").querySelectorAll("[data-chan]").forEach(function (b) { b.onclick = function () { F.chan = F.chan === b.dataset.chan ? "" : b.dataset.chan; syncFilters(); render(); }; });
  }

  /* ---------- Parcours des visiteurs ---------- */
  function chips(seq) { return seq.map(function (p, i) { return (i ? '<span class="arr" aria-hidden="true">›</span>' : "") + '<span class="pg">' + esc(pname(p)) + "</span>"; }).join(""); }
  function journeys() {
    var S = sessionsIn(per.from, per.to), cvA = cover(D.meta.starts.pv, per.from, per.to);
    if (cvA === "none") { $("tJour").innerHTML = tNA(); $("tExit").innerHTML = tNA(); $("tNext").innerHTML = tNA(); $("funnels").innerHTML = ""; return; }
    var by = {}, exits = {}, trans = {}, nTrans = 0;
    S.forEach(function (s) {
      if (s.seq.length) { var k = s.seq.join(">"), o = by[k] || (by[k] = { seq: s.seq, n: 0, c: 0, d: 0 }); o.n++; o.d += s.last - s.first; if (s.conv > 0) o.c++; }
      var ex = s.exit || s.entry; exits[ex] = (exits[ex] || 0) + 1;
      for (var i = 0; i < s.seq.length - 1; i++) { var t = s.seq[i] + ">" + s.seq[i + 1]; trans[t] = (trans[t] || 0) + 1; nTrans++; }
    });
    var list = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 12);
    $("tJour").innerHTML = list.length ? '<table><thead><tr><th>Parcours (pages vues dans l’ordre)</th><th class="n">Visites</th><th class="n">Part</th><th class="n">Demandes</th></tr></thead><tbody>' + list.map(function (o) {
      return '<tr><td><div class="chips-p">' + chips(o.seq) + '</div></td><td class="n">' + fmt(o.n) + '</td><td class="n">' + pct(o.n / S.length) + '</td><td class="n">' + (o.c ? '<span class="tag t-ok">' + fmt(o.c) + "</span>" : tZero()) + "</td></tr>"; }).join("") + "</tbody></table>" : "<p>" + tZero() + " parcours sur la période.</p>";
    var ex = Object.keys(exits).map(function (k) { return { p: k, n: exits[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    $("tExit").innerHTML = ex.length ? simpleTable([{ t: "Dernière page vue" }, { t: "Visites", n: 1 }, { t: "Part", n: 1 }], ex.map(function (o) { return [esc(pname(o.p)), fmt(o.n), pct(o.n / S.length)]; })) : "";
    var tr = Object.keys(trans).map(function (k) { var a = k.split(">"); return { a: a[0], b: a[1], n: trans[k] }; }).sort(function (x, y) { return y.n - x.n; }).slice(0, 10);
    $("tNext").innerHTML = tr.length ? simpleTable([{ t: "De" }, { t: "Vers" }, { t: "Passages", n: 1 }], tr.map(function (o) { return [esc(pname(o.a)), esc(pname(o.b)), fmt(o.n)]; })) : "<p class=\"muted\">Pas encore de navigation d’une page à l’autre.</p>";
    funnels(S);
  }

  function funnelHTML(title, steps, note, base) {
    var h = '<div class="card"><h3>' + esc(title) + "</h3>";
    steps.forEach(function (s, i) {
      var w = base ? Math.min(100, s.n * 100 / base) : 0, prev = i ? steps[i - 1].n : null;
      h += '<div class="step"><span>' + esc(s.t) + '</span><span class="n"><b>' + (s.n === 0 ? tZero() : fmt(s.n)) + "</b>" + (base ? " · " + pct(s.n / base) : "") + (prev ? ' <span class="muted">(' + pct(prev ? s.n / prev : 0) + " de l’étape précédente)</span>" : "") + '</span><div class="bar"><b style="width:' + w + '%"></b></div></div>';
    });
    return h + '<p class="muted small">' + esc(note) + "</p></div>";
  }
  function funnels(S) {
    var f = { all: S.length, rc: 0, rdv: 0, fs1: 0, okM: 0, fiche: 0, fs2: 0, okP: 0, pdf: 0, dg1: 0, dg2: 0, fs4: 0, okD: 0, mail: 0, cal: 0 };
    S.forEach(function (s) {
      var kinds = {}; s.dems.forEach(function (d) { if (!d.test || F.test) kinds[d.kind] = 1; });
      if (s.rc) f.rc++; if (s.rdv) f.rdv++; if (s.fs & 1) f.fs1++; if (kinds["Message ou rendez-vous"]) f.okM++;
      if (s.seq.some(function (p) { return /^\/(ia-au-quotidien|bureautique|agent-ia)$/.test(p); })) f.fiche++;
      if (s.fs & 2) f.fs2++; if (kinds["Programme PDF"]) f.okP++; if (s.pdf) f.pdf++;
      if (s.dg >= 1) f.dg1++; if (s.dg >= 2) f.dg2++; if (s.fs & 4) f.fs4++; if (kinds["Résultat du diagnostic"]) f.okD++;
      if (s.mail) f.mail++; if (s.agenda) f.cal++;
    });
    var unl = filtersActive() ? 0 : D.dem.filter(function (d) { return d.ok && !d.s && inR(d.ts, per.from, per.to) && (F.test || !d.test); }).length;
    $("funnels").innerHTML =
      funnelHTML("Prendre rendez-vous ou écrire", [{ t: "Arrivée sur le site", n: f.all }, { t: "Clic sur « Réserver 20 min »", n: f.rc }, { t: "Page Rendez-vous vue (agenda affiché)", n: f.rdv }, { t: "Formulaire de message commencé", n: f.fs1 }, { t: "Message envoyé et confirmé", n: f.okM }],
        "L’agenda Calendly est intégré : une réservation faite dans le calendrier n’est pas mesurable, seule l’ouverture de la page l’est. « Confirmé » = réponse positive de Formspree, compté une fois par demande." + (unl ? " " + unl + " demande(s) confirmée(s) sans visite reliée : comptées dans le total, attribution indisponible." : ""), f.all) +
      funnelHTML("Programme détaillé (PDF)", [{ t: "Fiche d’atelier vue", n: f.fiche }, { t: "Formulaire du PDF commencé", n: f.fs2 }, { t: "Demande de PDF confirmée", n: f.okP }, { t: "PDF ouvert", n: f.pdf }], "Les fiches comptent les visites où au moins une page d’atelier a été vue.", f.fiche) +
      funnelHTML("Diagnostic IA", [{ t: "Diagnostic commencé", n: f.dg1 }, { t: "Diagnostic terminé", n: f.dg2 }, { t: "Envoi du résultat par e-mail commencé", n: f.fs4 }, { t: "Résultat demandé et confirmé", n: f.okD }], "Part des visites qui ont commencé le diagnostic.", f.dg1) +
      funnelHTML("Clics sans confirmation", [{ t: "Arrivée sur le site", n: f.all }, { t: "Clic sur une adresse e-mail", n: f.mail }, { t: "Clic sur le lien Calendly (nouvel onglet)", n: f.cal }], "Un clic n’est ni un message envoyé ni un rendez-vous réservé : il est compté à part.", f.all);
  }

  /* ---------- Fenêtre « Visite » : parcours d'un visiteur de l'entrée à la sortie ---------- */
  var KIND = { rdv: "Clic « Réserver 20 min »", mail: "Clic sur l’adresse e-mail", agenda: "Clic sur le lien Calendly", pdf: "Ouverture du programme (PDF)", linkedin: "Clic LinkedIn" };
  var FORMS = { rdvForm: "Formulaire de message commencé", progForm: "Formulaire du programme PDF commencé", dqMailForm: "Envoi du résultat du diagnostic commencé" };
  function action(s) { return s.conv > 0 ? "Demande confirmée" : (s.fs ? "Formulaire commencé" : (s.rc ? "Clic « Réserver »" : (s.dg >= 2 ? "Diagnostic terminé" : (s.mail ? "Clic e-mail" : (s.agenda ? "Clic Calendly" : "—"))))); }
  function openVisit(sid) {
    var s = D.by[sid]; if (!s) return;
    var items = [];
    if (s.steps) {
      s.steps.forEach(function (st) {
        var t = st[1], txt = "", cls = "";
        if (t === "p") { txt = "Page vue : " + pname(st[2]); cls = "pv"; }
        else if (t === "c") { txt = KIND[st[3]] || "Clic"; cls = "ev"; }
        else if (t === "f") { txt = FORMS[st[3]] || "Formulaire commencé"; cls = "ev"; }
        else if (t === "d") { txt = String(st[3]).indexOf("fin") === 0 ? "Diagnostic terminé · recommandation : " + pname("/" + String(st[3]).split(":")[1]) : "Diagnostic commencé"; cls = "ev"; }
        if (txt) items.push({ ts: st[0], txt: txt, cls: cls, path: st[2] });
      });
    }
    s.dems.forEach(function (d) { items.push({ ts: d.ts, txt: (d.ok ? "Demande confirmée" : "Envoi non abouti") + " · " + d.kind, cls: d.ok ? "ok" : "ko" }); });
    items.sort(function (a, b) { return a.ts - b.ts; });
    var t0 = s.first, body;
    if (items.length) body = '<ol class="tl">' + items.map(function (it, i) {
      var next = items[i + 1], stay = it.cls === "pv" && next ? '<span class="stay">' + dur(next.ts - it.ts) + " sur cette page</span>" : "";
      return '<li class="' + it.cls + '"><time>+' + dur(it.ts - t0) + "</time><div><b>" + esc(it.txt) + "</b>" + stay + "</div></li>";
    }).join("") + "</ol>";
    else body = '<p class="muted">Détail minuté disponible pour les ' + 300 + " visites les plus récentes. Parcours enregistré :</p><div class=\"chips-p\">" + chips(s.seq) + "</div>";
    var src = s.chan + (s.src !== "—" ? " · " + s.src : "") + (s.camp ? " · campagne " + s.camp : "");
    $("vBody").innerHTML = '<h2 id="vTitle">Visite du ' + esc(fShort(s.first)) + "</h2>" +
      '<dl class="facts"><div><dt>Durée</dt><dd>' + esc(dur(s.last - s.first)) + '</dd></div><div><dt>Pages vues</dt><dd>' + fmt(s.pv) + '</dd></div><div><dt>Appareil</dt><dd>' + esc(s.dev) + '</dd></div><div><dt>Venu de</dt><dd>' + esc(src) + '</dd></div><div><dt>Entrée</dt><dd>' + esc(pname(s.entry)) + '</dd></div><div><dt>Sortie</dt><dd>' + esc(pname(s.exit || s.entry)) + "</dd></div></dl>" +
      (s.test ? '<p class="tag t-low">Trafic de test</p>' : "") + "<h3>Parcours</h3>" + body +
      '<p class="muted small">Visiteur anonyme : aucun nom, e-mail ni adresse IP n’est collecté. Les horaires sont ceux de l’enregistrement (précision d’environ une seconde).</p>';
    var dlg = $("visit"); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }
  function visits() {
    var S = sessionsIn(per.from, per.to).sort(function (a, b) { return b.last - a.last; }), cvA = cover(D.meta.starts.pv, per.from, per.to);
    if (cvA === "none") { $("tVisits").innerHTML = tNA(); $("moreVisits").hidden = true; return; }
    $("tVisits").innerHTML = S.length ? '<table><thead><tr><th>Début (Paris)</th><th class="n">Durée</th><th>Parcours</th><th>Venu de</th><th>Appareil</th><th>Action</th></tr></thead><tbody>' +
      S.slice(0, visitLimit).map(function (s) {
        var seq = s.seq.length ? s.seq : [s.entry];
        return '<tr class="click" tabindex="0" data-sid="' + esc(s.sid) + '"><td>' + esc(fShort(s.first)) + '</td><td class="n">' + esc(dur(s.last - s.first)) + '</td><td><div class="chips-p">' + chips(seq.length > 4 ? seq.slice(0, 3).concat(["…"], seq.slice(-1)) : seq) + '</div></td><td>' + esc(s.chan + (s.src !== "—" ? " · " + s.src : "")) + "</td><td>" + esc(s.dev) + "</td><td>" + (s.conv > 0 ? '<span class="tag t-ok">' + esc(action(s)) + "</span>" : esc(action(s))) + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p>" + tZero() + " visite sur la période.</p>";
    $("moreVisits").hidden = S.length <= visitLimit;
    $("tVisits").querySelectorAll("tr[data-sid]").forEach(function (r) { r.onclick = function () { openVisit(r.dataset.sid); }; r.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openVisit(r.dataset.sid); } }; });
  }

  /* ---------- Fidélité ---------- */
  function loyalty() {
    var S = sessionsIn(per.from, per.to), cvA = cover(D.meta.starts.pv, per.from, per.to);
    if (cvA === "none") { $("loy").innerHTML = tNA(); $("tLoy").innerHTML = ""; return; }
    var byV = {};
    S.forEach(function (s) { (byV[s.vid] = byV[s.vid] || []).push(s); });
    var V = Object.keys(byV), nNew = 0, nRet = 0, nRepeat = 0, cNew = 0, cRet = 0, dist = [0, 0, 0, 0], tot = 0;
    V.forEach(function (v) {
      var arr = byV[v], conv = arr.some(function (s) { return s.conv > 0; }), ret = D.firstOf[v] < per.from;
      if (ret) { nRet++; if (conv) cRet++; } else { nNew++; if (conv) cNew++; }
      if (arr.length >= 2) nRepeat++;
      tot += arr.length; dist[arr.length === 1 ? 0 : (arr.length === 2 ? 1 : (arr.length <= 5 ? 2 : 3))]++;
    });
    var n = V.length, st = D.meta.starts.pv, partial = cover(st, per.pFrom, per.to) !== "full";
    $("loy").innerHTML = '<div class="kpis small">' +
      '<div class="kpi"><div class="l">Nouveaux visiteurs</div><div class="v">' + cell(nNew, n, 0, fmt) + '</div><div class="s">' + (n ? pct(nNew / n) : "—") + " des visiteurs de la période</div></div>" +
      '<div class="kpi"><div class="l">Visiteurs de retour</div><div class="v">' + cell(nRet, n, 0, fmt) + '</div><div class="s">' + (n ? pct(nRet / n) : "—") + " : déjà venus avant la période</div></div>" +
      '<div class="kpi"><div class="l">Revenus pendant la période</div><div class="v">' + cell(nRepeat, n, 0, fmt) + '</div><div class="s">' + (n ? pct(nRepeat / n) : "—") + " avec 2 visites ou plus</div></div>" +
      '<div class="kpi"><div class="l">Visites par visiteur</div><div class="v">' + cell(n ? tot / n : null, n, 10, dec) + '</div><div class="s">Moyenne sur la période</div></div></div>';
    var labs = ["1 visite", "2 visites", "3 à 5 visites", "6 visites ou plus"];
    $("tLoy").innerHTML = simpleTable([{ t: "Nombre de visites dans la période" }, { t: "Visiteurs", n: 1 }, { t: "Part", n: 1 }], labs.map(function (l, i) { return [esc(l), cell(dist[i], n, 0, fmt), n ? pct(dist[i] / n) : "—"]; })) +
      simpleTable([{ t: "Conversion par type de visiteur" }, { t: "Visiteurs", n: 1 }, { t: "Avec demande", n: 1 }, { t: "Taux", n: 1 }], [["Nouveaux", cell(nNew, nNew, 0, fmt), cell(cNew, nNew, 0, fmt), rateCell(cNew, nNew)], ["De retour", cell(nRet, nRet, 0, fmt), cell(cRet, nRet, 0, fmt), rateCell(cRet, nRet)]]) +
      '<p class="note">' + (partial ? "La collecte a commencé récemment : certains « nouveaux » ont pu venir avant. " : "") + "Un visiteur est un navigateur : la même personne sur deux appareils compte deux fois.</p>";
  }

  /* ---------- Enseignements : lecture automatique des chiffres ---------- */
  function insights() {
    var C = metrics(per.from, per.to), S = C.list, out = [], MIN = 30;
    if (cover(D.meta.starts.pv, per.from, per.to) === "none" || S.length < MIN) {
      $("insights").innerHTML = '<li class="ins low"><b>Pas encore assez de visites pour conclure</b><span>' + fmt(S.length) + " visite(s) sur la période, il en faut au moins " + MIN + ". Élargissez la période ou revenez dans quelques jours.</span></li>"; return;
    }
    if (C.bounce > 0.6) out.push(["warn", "Trop de visites s’arrêtent à la première page (" + pct(C.bounce) + ")", "Travaillez le haut de la page d’entrée la plus visitée : une promesse claire et un bouton « Réserver 20 min » visible sans défiler."]);
    var ent = {}; S.forEach(function (s) { var o = ent[s.entry] || (ent[s.entry] = { n: 0, one: 0 }); o.n++; if (s.one) o.one++; });
    var worst = Object.keys(ent).map(function (k) { return { p: k, n: ent[k].n, r: ent[k].one / ent[k].n }; }).filter(function (o) { return o.n >= 15; }).sort(function (a, b) { return b.r - a.r; })[0];
    if (worst && worst.r > 0.7) out.push(["warn", "« " + pname(worst.p) + " » perd " + pct(worst.r) + " de ses visiteurs dès l’arrivée", "Sur " + fmt(worst.n) + " arrivées. Ajoutez un lien clair vers l’étape suivante (offres, rendez-vous) en haut de page."]);
    var chan = {}; S.forEach(function (s) { var o = chan[s.chan] || (chan[s.chan] = { n: 0, c: 0 }); o.n++; if (s.conv > 0) o.c++; });
    var cl = Object.keys(chan).map(function (k) { return { k: k, n: chan[k].n, r: chan[k].c / chan[k].n }; }).filter(function (o) { return o.n >= MIN; }).sort(function (a, b) { return b.r - a.r; });
    if (cl.length >= 2 && cl[0].r > 0) out.push(["good", "Meilleure source : " + cl[0].k + " (" + pct(cl[0].r) + " de conversion)", "Sur " + fmt(cl[0].n) + " visites. Renforcez ce canal. À l’opposé : " + cl[cl.length - 1].k + " (" + pct(cl[cl.length - 1].r) + ")."]);
    var dv = {}; S.forEach(function (s) { var o = dv[s.dev] || (dv[s.dev] = { n: 0, c: 0 }); o.n++; if (s.conv > 0) o.c++; });
    if (dv.mobile && dv.ordinateur && dv.mobile.n >= MIN && dv.ordinateur.n >= MIN) {
      var rm = dv.mobile.c / dv.mobile.n, rd = dv.ordinateur.c / dv.ordinateur.n;
      if (rd > 0 && rm < rd / 2) out.push(["warn", "Le mobile convertit deux fois moins que l’ordinateur (" + pct(rm) + " contre " + pct(rd) + ")", "Testez le parcours de réservation sur téléphone : l’agenda intégré et le formulaire doivent tenir dans le premier écran."]);
    }
    var rdvViews = S.filter(function (s) { return s.rdv; }).length, rdvAct = S.filter(function (s) { return s.rdv && (s.fs & 1 || s.conv > 0); }).length;
    if (rdvViews >= 15 && rdvAct / rdvViews < 0.25) out.push(["info", pct(1 - rdvAct / rdvViews) + " des visiteurs de la page Rendez-vous n’écrivent pas", "Normal si ils réservent dans l’agenda (non mesurable). Comparez avec vos réservations Calendly réelles pour estimer la perte."]);
    var fv = S.filter(function (s) { return s.seq.some(function (p) { return /^\/(ia-au-quotidien|bureautique|agent-ia)$/.test(p); }); }).length;
    if (fv >= 15 && !S.some(function (s) { return s.fs & 2; })) out.push(["info", "Aucune demande de programme PDF sur " + fmt(fv) + " visites de fiches d’atelier", "Le programme est lisible sur la page : si personne ne demande le PDF, mettez-le plus en avant près du bouton de réservation, ou retirez la demande d’e-mail."]);
    if (C.ppS < 1.5) out.push(["warn", "Peu de pages par visite (" + dec(C.ppS) + ")", "Ajoutez des liens de suite en bas de page (« Voir les offres », « Faire le diagnostic »)."]);
    var rep = new Set(S.map(function (s) { return s.vid; })).size; if (rep) { var rr = S.length / rep; if (rr >= 1.3) out.push(["good", "Vos visiteurs reviennent (" + dec(rr) + " visites par visiteur)", "Bon signe de fidélité : pensez à un rappel (e-mail de suivi après atelier, lien vers le diagnostic)."]); }
    if (!out.length) out.push(["info", "Rien d’alarmant sur cette période", "Les indicateurs surveillés (arrivée, sources, mobile, profondeur) sont dans la norme avec le volume actuel."]);
    var ic = { warn: "À corriger", good: "À garder", info: "À savoir" };
    $("insights").innerHTML = out.map(function (o) { return '<li class="ins ' + o[0] + '"><em>' + ic[o[0]] + "</em><b>" + esc(o[1]) + "</b><span>" + esc(o[2]) + "</span></li>"; }).join("");
  }

  /* ---------- Core Web Vitals ---------- */
  var LIM = { LCP: [2500, 4000, " ms"], INP: [200, 500, " ms"], CLS: [0.1, 0.25, ""] };
  function p75(a) { if (!a.length) return null; a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.min(a.length - 1, Math.ceil(a.length * 0.75) - 1)]; }
  function cwvRows(path) { return D.cwv.filter(function (r) { return inR(r.ts, per.from, per.to) && (F.test || !r.test) && (!path || r.path === path) && (!F.dev || r.dev === F.dev); }); }
  function rating(m, v) { var l = LIM[m]; return v <= l[0] ? ["Bon", "t-ok"] : (v <= l[1] ? ["À améliorer", "t-low"] : ["Lent", "t-bad"]); }
  function cwvCell(rows, m, dev) {
    if (!D.meta.starts.cwv) return tNA("Aucune mesure de performance collectée pour l’instant");
    var v = rows.filter(function (r) { return r.m === m && (!dev || r.dev === dev); }).map(function (r) { return r.v; });
    if (v.length < 20) return tLow(v.length);
    var q = p75(v), rt = rating(m, q);
    return esc(m === "CLS" ? q.toLocaleString("fr-FR", { maximumFractionDigits: 3 }) : fmt(q) + LIM[m][2]) + ' <span class="tag ' + rt[1] + '">' + rt[0] + '</span><span class="n-small">n = ' + fmt(v.length) + "</span>";
  }
  function cwvTable(path) {
    var rows = cwvRows(path);
    return simpleTable([{ t: "Mesure (75e centile)" }, { t: "Mobile", n: 1 }, { t: "Ordinateur", n: 1 }, { t: "Tous appareils", n: 1 }],
      ["LCP", "INP", "CLS"].map(function (m) { return [m + (m === "LCP" ? " · affichage principal" : (m === "INP" ? " · réactivité" : " · stabilité")), cwvCell(rows, m, "mobile"), cwvCell(rows, m, "ordinateur"), cwvCell(rows, m, "")]; })) +
      '<p class="muted small">Seuils : LCP bon ≤ 2,5 s, INP bon ≤ 200 ms, CLS bon ≤ 0,1. Une valeur n’est affichée qu’à partir de 20 mesures.</p>';
  }
  function pageSlow(path) { var rows = cwvRows(path), out = []; ["LCP", "INP", "CLS"].forEach(function (m) { var v = rows.filter(function (r) { return r.m === m; }).map(function (r) { return r.v; }); if (v.length >= 20 && p75(v) > LIM[m][0]) out.push(m); }); return out; }

  /* ---------- Pages ---------- */
  function pageStats() {
    var a = dkey(ymd(per.from)), b = dkey(ymd(per.to)), map = {}, S = sessionsIn(per.from, per.to);
    function get(p) { return map[p] || (map[p] = { path: p, views: 0, entry: 0, cta: 0, conv: 0, convS: 0 }); }
    D.pages.forEach(function (r) { if (r.day >= a && r.day <= b && (F.test || !r.test) && (!F.dev || r.dev === F.dev)) { var o = get(r.path); o.views += r.views; o.cta += r.cta; } });
    S.forEach(function (s) { var o = get(s.entry); o.entry++; o.conv += s.conv; if (s.conv > 0) o.convS++; });
    var list = Object.keys(map).map(function (k) { var o = map[k]; o.title = pname(k); o.rate = o.entry ? o.convS / o.entry : null; return o; });
    var site = S.length ? S.filter(function (s) { return s.conv > 0; }).length / S.length : 0, vs = list.map(function (o) { return o.views; }).sort(function (x, y) { return x - y; }), med = vs.length ? vs[Math.floor(vs.length / 2)] : 0;
    list.forEach(function (o) { o.lowConv = o.entry >= 30 && o.views >= med && site > 0 && (o.rate || 0) < site / 2; o.slow = pageSlow(o.path); });
    return { list: list, site: site };
  }
  function pages() {
    var st = pageStats(), cvA = cover(D.meta.starts.pv, per.from, per.to);
    if (cvA === "none") { $("tPages").innerHTML = tNA(); return; }
    var cols = [["title", "Page", 0], ["views", "Vues", 1], ["entry", "Entrées", 1], ["cta", "Clics contact", 1], ["conv", "Demandes", 1], ["rate", "Conversion", 1]];
    var list = st.list.slice().sort(function (x, y) { var a = x[sort.col], b = y[sort.col]; if (a == null) a = -1; if (b == null) b = -1; return (typeof a === "string" ? a.localeCompare(b, "fr") : a - b) * sort.dir; });
    var h = "<table><thead><tr>" + cols.map(function (c) { return '<th class="' + (c[2] ? "n" : "") + '" aria-sort="' + (sort.col === c[0] ? (sort.dir > 0 ? "ascending" : "descending") : "none") + '"><button type="button" data-sort="' + c[0] + '">' + esc(c[1]) + (sort.col === c[0] ? (sort.dir > 0 ? " ▲" : " ▼") : "") + "</button></th>"; }).join("") + "<th>Repères</th></tr></thead><tbody>";
    list.forEach(function (o) {
      var fl = ""; if (o.lowConv) fl += '<span class="tag t-low">▲ Très visitée, convertit peu</span> '; if (o.slow.length) fl += '<span class="tag t-bad">⏱ Lente (' + esc(o.slow.join(", ")) + ")</span>";
      h += '<tr class="click" tabindex="0" data-path="' + esc(o.path) + '"><td>' + esc(o.title) + '<span class="n-small">' + esc(o.path) + '</span></td><td class="n">' + cell(o.views, o.views, 0, fmt) + '</td><td class="n">' + cell(o.entry, o.entry, 0, fmt) + '</td><td class="n">' + cell(o.cta, o.cta, 0, fmt) + '</td><td class="n">' + cell(o.conv, o.entry, 0, fmt) + '</td><td class="n">' + rateCell(o.convS, o.entry) + "</td><td>" + fl + "</td></tr>";
    });
    $("tPages").innerHTML = h + "</tbody></table>";
    $("pagesNote").textContent = "Une demande est attribuée à la page d’entrée de sa visite. Vues et clics suivent la période et l’appareil ; les autres filtres s’appliquent aux entrées, demandes et conversion. Cliquez sur une page pour son détail.";
    $("tPages").querySelectorAll("[data-sort]").forEach(function (b) { b.onclick = function () { var c = b.dataset.sort; sort = { col: c, dir: sort.col === c ? -sort.dir : (c === "title" ? 1 : -1) }; pages(); }; });
    $("tPages").querySelectorAll("tr[data-path]").forEach(function (r) { r.onclick = function () { openDetail(r.dataset.path); }; r.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(r.dataset.path); } }; });
  }
  function openDetail(path) {
    var S = sessionsIn(per.from, per.to).filter(function (s) { return s.entry === path; }), a = dkey(ymd(per.from)), b = dkey(ymd(per.to)), byDay = {};
    D.pages.forEach(function (r) { if (r.path === path && r.day >= a && r.day <= b && (F.test || !r.test) && (!F.dev || r.dev === F.dev)) byDay[r.day] = (byDay[r.day] || 0) + r.views; });
    var days = Object.keys(byDay).sort(), src = {};
    S.forEach(function (s) { var k = s.chan + " · " + (s.camp ? s.camp + " (" + s.src + ")" : s.src); src[k] = (src[k] || 0) + 1; });
    var top = Object.keys(src).sort(function (x, y) { return src[y] - src[x]; }).slice(0, 8);
    var after = {}; S.forEach(function (s) { var nx = s.seq[1] || "(sortie)"; after[nx] = (after[nx] || 0) + 1; });
    var nx = Object.keys(after).sort(function (x, y) { return after[y] - after[x]; }).slice(0, 6);
    $("dBody").innerHTML = '<h2 id="dTitle">' + esc(pname(path)) + '</h2><p class="muted">' + esc(path) + "</p>" +
      "<h3>Vues par jour</h3>" + (days.length ? '<div id="dTrend" class="chart"></div>' : "<p>" + tZero() + " vue sur la période.</p>") +
      "<h3>Principales sources (visites entrées par cette page : " + fmt(S.length) + ")</h3>" + (top.length ? simpleTable([{ t: "Source" }, { t: "Visites", n: 1 }], top.map(function (k) { return [esc(k), fmt(src[k])]; })) : "<p>Aucune entrée.</p>") +
      "<h3>Et ensuite ?</h3>" + (nx.length ? simpleTable([{ t: "Page suivante" }, { t: "Visites", n: 1 }], nx.map(function (k) { return [esc(k === "(sortie)" ? "Quitte le site" : pname(k)), fmt(after[k])]; })) : "<p>Aucune donnée.</p>") +
      '<h3>Parcours des visites entrées par cette page</h3><div id="dFun" class="grid2"></div><h3>Core Web Vitals de la page</h3>' + cwvTable(path);
    funnels2(S, $("dFun"));
    if (days.length) lineChart($("dTrend"), days, [{ n: "Vues", v: days.map(function (d) { return byDay[d]; }), c: "var(--acc)" }], fDay);
    var dlg = $("detail"); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }
  function funnels2(S, el) {
    var f = { all: S.length, rc: 0, rdv: 0, fs: 0, ok: 0 };
    S.forEach(function (s) { if (s.rc) f.rc++; if (s.rdv) f.rdv++; if (s.fs & 1) f.fs++; if (s.conv > 0) f.ok++; });
    el.innerHTML = funnelHTML("Rendez-vous et message", [{ t: "Arrivée sur la page", n: f.all }, { t: "Clic « Réserver 20 min »", n: f.rc }, { t: "Page Rendez-vous vue", n: f.rdv }, { t: "Formulaire commencé", n: f.fs }, { t: "Demande confirmée", n: f.ok }], "Visites entrées par cette page.", f.all);
  }

  /* ---------- Qualité des données ---------- */
  function quality() {
    var st = D.meta.starts, since = function (v) { return v ? esc(fDate(v, true)) : tNA("Aucune donnée collectée pour l’instant"); };
    $("tQual").innerHTML = simpleTable([{ t: "Métrique" }, { t: "Source" }, { t: "Collecte depuis le" }], [
      ["Visites, visiteurs uniques, pages vues, parcours", "Mesure anonyme du site (onglet Événements)", since(st.pv)],
      ["Clics (réserver, e-mail, Calendly, PDF)", "Mesure anonyme du site", since(st.cta)],
      ["Début de formulaire, diagnostic", "Mesure anonyme du site", since(st.fs)],
      ["Demandes confirmées", "Onglet Demandes : envoi Formspree confirmé", since(st.demandes)],
      ["Attribution des demandes (source, parcours)", "Visite reliée par un identifiant technique", since(st.pv)],
      ["Core Web Vitals", "Mesures des navigateurs (Chrome, Edge, Android)", since(st.cwv)]]);
    var tS = D.S.filter(function (s) { return s.test && inR(s.first, per.from, per.to); }).length, tD = D.dem.filter(function (d) { return d.test && d.ok && inR(d.ts, per.from, per.to); }).length;
    var n = [
      "Visiteurs uniques : estimés par un identifiant aléatoire stocké dans le navigateur (13 mois maximum), dédupliqués dans la période choisie. Une personne sur deux appareils compte deux fois.",
      "Une visite s’arrête après 30 minutes d’inactivité ; un lien avec une autre campagne UTM ouvre une nouvelle visite.",
      "Trafic de test et d’administration : " + (F.test ? "inclus (case cochée)" : "exclu") + ". Sur la période : " + fmt(tS) + " visite(s) et " + fmt(tD) + " demande(s) de test. Exclus à la source : domaines hors production, navigateurs automatisés, « Do Not Track » / GPC, et les navigateurs exclus avec le bouton « Exclure ce navigateur ». Cette page ne se mesure pas elle-même.",
      "Les bloqueurs de publicité peuvent masquer une partie du trafic : les chiffres sont des minimums. Une demande dont la visite n’a pas été mesurée est comptée avec attribution indisponible.",
      "L’agenda Calendly est intégré dans la page : les réservations faites dans le calendrier ne sont pas visibles ici (seule la consultation de la page l’est).",
      "Les données personnelles (nom, e-mail) ne sont jamais envoyées à cette page : le parcours d’un visiteur est anonyme."];
    if (D.truncated || D.meta.truncated) n.push("Attention : le volume dépasse la limite de lecture, les chiffres peuvent être incomplets. Archivez les anciennes lignes de l’onglet Événements.");
    $("qNotes").innerHTML = n.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
  }

  /* ---------- Filtres ---------- */
  function fillSelect(id, items, label, cur) { var h = '<option value="">' + esc(label) + "</option>"; items.forEach(function (i) { h += '<option value="' + esc(i) + '"' + (i === cur ? " selected" : "") + ">" + esc(i) + "</option>"; }); $(id).innerHTML = h; }
  function syncFilters() {
    var camps = {}, pg = {}, dv = {};
    D.S.forEach(function (s) { if (s.camp) camps[s.camp] = 1; pg[s.entry] = 1; dv[s.dev] = 1; });
    fillSelect("fChan", CHANS, "Toutes", F.chan);
    fillSelect("fCamp", ["(hors campagne)"].concat(Object.keys(camps).sort()), "Toutes", F.camp);
    fillSelect("fPage", Object.keys(pg).sort(), "Toutes", F.page);
    fillSelect("fDev", Object.keys(dv).sort(), "Tous", F.dev);
    $("fTest").checked = F.test;
    var n = (F.chan ? 1 : 0) + (F.camp ? 1 : 0) + (F.page ? 1 : 0) + (F.dev ? 1 : 0) + (F.test ? 1 : 0);
    $("fCount").textContent = n ? n + " actif" + (n > 1 ? "s" : "") : "";
  }

  /* ---------- Rendu ---------- */
  function live() {
    var c = D.S.filter(function (s) { return !s.test && Date.now() - s.last < 5 * 60e3; }).length;
    $("live").innerHTML = '<i class="' + (c ? "on" : "") + '"></i>' + (c ? fmt(c) + " visite" + (c > 1 ? "s" : "") + " en cours" : "Aucune visite en cours");
  }
  function render() {
    if (!D) return;
    per = period();
    $("range").textContent = "Du " + fDate(per.from, true) + " au " + fDate(per.to, true) + " (heure de Paris). Comparé à : du " + fDate(per.pFrom, true) + " au " + fDate(per.pTo, true) + ".";
    $("refreshed").textContent = "Actualisé à " + fHour(fetchedAt) + " (heure de Paris).";
    setStatus(D.truncated || D.meta.truncated ? "Volume au-delà de la limite de lecture : chiffres possiblement incomplets." : "");
    var dayOnly = per.N === 1; $("granWeek").disabled = dayOnly; $("granMonth").disabled = per.N < 28; if ((gran === "week" && dayOnly) || (gran === "month" && per.N < 28)) gran = "day";
    [].forEach.call($("gran").children, function (b) { b.setAttribute("aria-pressed", b.dataset.g === gran ? "true" : "false"); });
    live(); kpis(); chart(); insights(); journeys(); visits(); sources(); loyalty(); pages(); $("tCwv").innerHTML = cwvTable(""); quality();
  }

  /* ---------- Connexion ---------- */
  function showLogin(msg) { $("app").hidden = true; $("login").hidden = false; $("loginMsg").textContent = msg || ""; $("pwd").focus(); clearInterval(timer); }
  function showApp() { $("login").hidden = true; $("app").hidden = false; clearInterval(timer); timer = setInterval(function () { if (document.visibilityState === "visible" && token) load(true); }, 90000); }

  function bind() {
    $("loginForm").addEventListener("submit", function (e) { e.preventDefault(); token = $("pwd").value; ss("dania-suivi-mdp", token); $("pwd").value = ""; showApp(); load(); });
    $("showPwd").onchange = function () { $("pwd").type = this.checked ? "text" : "password"; };
    $("logout").onclick = function () { ss("dania-suivi-mdp", null); token = ""; D = null; showLogin(""); };
    $("refresh").onclick = function () { load(); };
    $("periods").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return; P.p = b.dataset.p;
      [].forEach.call($("periods").children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      $("customForm").hidden = P.p !== "custom"; if (P.p !== "custom") load();
    });
    $("gran").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b || b.disabled) return; gran = b.dataset.g; render(); });
    $("customForm").addEventListener("submit", function (e) { e.preventDefault(); P.from = $("cFrom").value; P.to = $("cTo").value; if (P.from && P.to) load(); });
    var t = dkey(ymd(Date.now())); $("cTo").value = t; $("cTo").max = t; $("cFrom").max = t; $("cFrom").value = dkey(addDays(ymd(Date.now()), -13));
    [["fChan", "chan"], ["fCamp", "camp"], ["fPage", "page"], ["fDev", "dev"]].forEach(function (p) { $(p[0]).onchange = function () { F[p[1]] = this.value; syncFilters(); render(); }; });
    $("fTest").onchange = function () { F.test = this.checked; syncFilters(); render(); };
    $("fReset").onclick = function () { F = { chan: "", camp: "", page: "", dev: "", test: false }; syncFilters(); render(); };
    $("chartMode").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; mode = b.dataset.m; [].forEach.call($("chartMode").children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); chart(); });
    $("moreVisits").onclick = function () { visitLimit += 25; visits(); };
    var sx = $("selfx");
    function selfState() { var on = ls("dania-notrack") === "1"; sx.setAttribute("aria-pressed", on); sx.textContent = on ? "Ce navigateur est exclu" : "Exclure ce navigateur"; }
    sx.onclick = function () { ls("dania-notrack", ls("dania-notrack") === "1" ? null : "1"); selfState(); }; selfState();
  }

  bind();
  if (token) { showApp(); load(); } else showLogin("");
})();
