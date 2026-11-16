/* Tableau de bord d'administration DAN-IA.
   Lit les données agrégées du script Google (integrations/google-sheet.gs) avec le jeton d'administration.
   Toutes les valeurs venant des visiteurs (pages, titres, domaines, UTM) sont échappées avant affichage. */
(function () {
  "use strict";
  var CFG = window.DANIA_CONFIG || {}, EP = CFG.endpoint || "", TZ = "Europe/Paris";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(n) { return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 }); }
  function pct(r) { return (r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %"; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---------- Heure de Paris ---------- */
  var PF = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  function parts(ms) { var o = {}; PF.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; }); return o; }
  function offset(ms) { var p = parts(ms); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; }
  function midnight(y, m, d) { var t = Date.UTC(y, m - 1, d), t0 = t - offset(t); return t - offset(t0); }
  function ymd(ms) { var p = parts(ms); return [+p.year, +p.month, +p.day]; }
  function addDays(a, n) { var x = new Date(Date.UTC(a[0], a[1] - 1, a[2] + n)); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; }
  function dkey(a) { return a[0] + "-" + pad(a[1]) + "-" + pad(a[2]); }
  function dayOf(ms) { return dkey(ymd(ms)); }
  function fDate(ms, withTime) {
    return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: withTime ? "2-digit" : undefined, minute: withTime ? "2-digit" : undefined }).format(new Date(ms));
  }
  function fShort(ms) { return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms)); }
  function fDay(key) { var a = key.split("-"); return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(+a[0], +a[1] - 1, +a[2]))); }

  /* ---------- État ---------- */
  var P = { p: "7", from: "", to: "" };
  var F = { chan: "", camp: "", page: "", dev: "", test: false };
  var mode = "aud", sort = { col: "views", dir: -1 }, sessLimit = 25;
  var D = null, token = ss("dania-admin-token") || "", fetchedAt = 0, per = null;

  /* ---------- Période ---------- */
  function period() {
    var now = Date.now(), t = ymd(now), N, fromP, toMs;
    if (P.p === "custom" && P.from && P.to) {
      var a = P.from.split("-").map(Number), b = P.to.split("-").map(Number);
      if (Date.UTC(b[0], b[1] - 1, b[2]) < Date.UTC(a[0], a[1] - 1, a[2])) { var x = a; a = b; b = x; }
      fromP = a;
      N = Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 864e5) + 1;
      toMs = Math.min(midnight.apply(null, addDays(b, 1)) - 1, now);
    } else {
      N = P.p === "today" ? 1 : (+P.p || 7);
      fromP = addDays(t, -(N - 1));
      toMs = now;
    }
    var from = midnight.apply(null, fromP), pFromA = addDays(fromP, -N), pFrom = midnight.apply(null, pFromA);
    var week = midnight.apply(null, addDays(t, -6));
    return { N: N, from: from, to: toMs, pFrom: pFrom, pTo: pFrom + (toMs - from), week: week, dataFrom: Math.min(pFrom, week, from), now: now };
  }

  /* ---------- Chargement ---------- */
  function setStatus(t) { $("status").textContent = t || ""; }
  function load() {
    if (!EP) { setStatus("Aucune adresse d’enregistrement n’est configurée (config.js, champ « endpoint »). Rien ne peut être affiché."); return Promise.resolve(); }
    per = period();
    setStatus("Chargement des données…");
    return fetch(EP, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ k: "read", token: token, from: per.dataFrom, to: per.now + 60000 }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) {
          if (j.error === "verrouillé") { showLogin("Trop d’essais : réessayez dans 10 minutes."); }
          else { ss("dania-admin-token", null); token = ""; showLogin("Jeton refusé."); }
          return;
        }
        D = prepare(j); fetchedAt = Date.now(); setStatus(""); syncFilters(); render();
      }, function () { setStatus("Impossible de joindre le script Google (réseau, URL ou déploiement). Les données affichées, s’il y en a, datent de la dernière actualisation."); });
  }

  /* ---------- Classement des sources ---------- */
  var SEARCH = /(^|\.)(google|bing|duckduckgo|ecosia|qwant|yahoo|brave|startpage|baidu|yandex|ask|lilo|search)\./;
  var SOCIAL = /(^|\.)(facebook|fb|instagram|linkedin|lnkd|twitter|t|x|youtube|youtu|tiktok|pinterest|reddit|whatsapp|wa|threads|bsky|snapchat|mastodon)\.(com|in|co|me|net|app|social|be)$/;
  function classify(s) {
    if (s.us || s.um || s.uc) { s.chan = "Campagnes UTM"; s.camp = s.uc || "(sans nom)"; s.src = (s.us || "(inconnue)") + (s.um ? " / " + s.um : ""); }
    else if (s.ref) { s.chan = SEARCH.test(s.ref) ? "Recherche" : (SOCIAL.test(s.ref) ? "Réseaux sociaux" : "Sites référents"); s.camp = ""; s.src = s.ref; }
    else { s.chan = "Sans source attribuée"; s.camp = ""; s.src = "—"; }
  }
  function prepare(j) {
    var by = {};
    var S = j.sessions.map(function (r) {
      var s = { sid: r[0], vid: r[1], first: r[2], last: r[3], entry: r[4] || "(inconnue)", ref: r[5], us: r[6], um: r[7], uc: r[8], dev: r[9] || "inconnu", pv: r[10], cta: r[11], rdv: r[12], fs: r[13], mail: r[14], agenda: r[15], auto: r[16], test: r[17], rc: r[18] || 0, conv: 0 };
      classify(s); by[s.sid] = s; return s;
    });
    var dem = j.demandes.map(function (r) { return { ts: r[0], ok: r[1] === "ok", rid: r[2], sid: r[3], test: r[4], page: r[6], s: null }; });
    var seenRid = {};
    dem = dem.filter(function (d) { if (!d.rid) return true; if (seenRid[d.rid]) return false; seenRid[d.rid] = 1; return true; });
    dem.forEach(function (d) { if (d.ok && d.sid && by[d.sid]) { d.s = by[d.sid]; if (!d.test) d.s.conv++; } });
    return { S: S, by: by, dem: dem, pages: j.pages.map(function (r) { return { day: r[0], path: r[1], dev: r[2], views: r[3], cta: r[4], test: r[5] }; }), titles: j.titles || {}, cwv: j.cwv.map(function (r) { return { ts: r[0], path: r[1], dev: r[2], m: r[3], v: r[4], test: r[5] }; }), meta: j.meta || { starts: {} }, truncated: j.truncated };
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
  function unlinkedIn(a, b) { return D.dem.filter(function (d) { return d.ok && !d.s && inR(d.ts, a, b) && (F.test || !d.test); }); }

  function metrics(a, b) {
    var S = sessionsIn(a, b), v = {}, pv = 0, conv = 0;
    S.forEach(function (s) { v[s.vid] = 1; pv += s.pv; if (s.conv > 0) conv++; });
    var dm = demIn(a, b);
    return { sessions: S.length, visitors: Object.keys(v).length, pv: pv, dem: dm.length, convS: conv, rate: S.length ? conv / S.length : null, list: S };
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

  /* ---------- Vue d'ensemble ---------- */
  function delta(cur, prev, isRate) {
    if (isRate) { var d = (cur - prev) * 100; return '<span class="' + (d > 0.05 ? "up" : (d < -0.05 ? "down" : "flat")) + '">' + (d > 0 ? "+" : "") + d.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " pt</span>"; }
    if (prev === 0) return cur === 0 ? '<span class="flat">= 0 sur la période précédente</span>' : '<span class="up">nouveau (0 sur la période précédente)</span>';
    var r = (cur - prev) / prev;
    return '<span class="' + (r > 0.005 ? "up" : (r < -0.005 ? "down" : "flat")) + '">' + (r > 0 ? "+" : "") + (r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " %</span>";
  }
  function kpis() {
    var C = metrics(per.from, per.to), Pv = metrics(per.pFrom, per.pTo);
    var st = D.meta.starts, pvStart = st.pv, demStart = st.demandes || st.pv;
    var unl = filtersActive() ? [] : unlinkedIn(per.from, per.to);
    var demCur = C.dem, demPrev = Pv.dem; /* les demandes sans session sont déjà comprises lorsqu’aucun filtre n’est actif */
    var cvA = cover(pvStart, per.from, per.to), cvD = cover(demStart, per.from, per.to);
    var prevOk = pvStart && pvStart <= per.pFrom, prevOkD = demStart && demStart <= per.pFrom;
    var small = ' <span class="vh">compare à la période précédente</span>';
    function card(label, val, n, min, f, cur, prev, ok, cv, src, isRate, extra) {
      var cmp;
      if (cv === "none") cmp = tNA("La collecte n’avait pas commencé");
      else if (!ok) cmp = '<span class="flat">Comparaison indisponible' + (pvStart ? " (collecte depuis le " + esc(fDate(pvStart)) + ")" : "") + "</span>";
      else cmp = delta(cur, prev, isRate) + ' <span class="muted">vs période précédente (' + (isRate ? pct(prev) : fmt(prev)) + ")</span>";
      return '<div class="kpi"><div class="l">' + label + '</div><div class="v">' + (cv === "none" ? tNA() : cell(val, n, min, f)) + '</div><div class="d">' + cmp + small + '</div><div class="s">' + esc(src) + (cv === "partial" ? " · période partielle (collecte depuis le " + esc(fDate(cv === "partial" ? (label.indexOf("Demandes") === 0 ? demStart : pvStart) : 0)) + ")" : "") + (extra || "") + "</div></div>";
    }
    var h = card("Visiteurs uniques estimés", C.visitors, C.visitors, 0, fmt, C.visitors, Pv.visitors, prevOk, cvA, "Source : mesure anonyme du site", false);
    h += card("Sessions", C.sessions, C.sessions, 0, fmt, C.sessions, Pv.sessions, prevOk, cvA, "Source : mesure anonyme du site", false);
    h += card("Demandes de contact confirmées", demCur, demCur, 0, fmt, demCur, demPrev, prevOkD, cvD, "Source : onglet Demandes (envoi confirmé)", false, unl.length ? " · dont " + unl.length + " sans attribution" : "");
    h += card("Taux de conversion", C.rate, C.sessions, 30, pct, C.rate || 0, Pv.rate || 0, prevOk && Pv.rate !== null && Pv.sessions >= 30, cvA, "Sessions avec au moins une demande confirmée ÷ sessions mesurées", true);
    h += '<div class="kpi sec"><div class="l">Pages vues (complément)</div><div class="v">' + (cvA === "none" ? tNA() : cell(C.pv, C.pv, 0, fmt)) + '</div><div class="d">' + (prevOk && cvA !== "none" ? delta(C.pv, Pv.pv) + ' <span class="muted">vs période précédente</span>' : '<span class="flat">Comparaison indisponible</span>') + "</div></div>";
    $("kpis").innerHTML = h;
  }

  /* ---------- Courbes ---------- */
  function bucketKey(ms) {
    if (per.N === 1) return pad(+parts(ms).hour);
    var a = ymd(ms);
    return per.N > 62 ? a[0] + "-" + pad(a[1]) : dkey(a);
  }
  function bucketList() {
    if (per.N === 1) { var o = []; for (var h = 0; h < 24; h++) o.push(pad(h)); return o; }
    var out = [], seen = {}, base = ymd(per.from), n = Math.ceil((per.to - per.from) / 864e5) + 1;
    for (var i = 0; i < n; i++) { var k = per.N > 62 ? (function (a) { return a[0] + "-" + pad(a[1]); })(addDays(base, i)) : dkey(addDays(base, i)); if (!seen[k]) { seen[k] = 1; out.push(k); } }
    return out;
  }
  function bucketLabel(k) { return per.N === 1 ? k + " h" : (per.N > 62 ? k.slice(5) + "/" + k.slice(0, 4) : fDay(k)); }
  function series() {
    var keys = bucketList(), idx = {}, cur = per.N === 1 ? per.from : per.from;
    keys.forEach(function (k, i) { idx[k] = i; });
    var sess = keys.map(function () { return 0; }), vis = keys.map(function () { return {}; }), dem = keys.map(function () { return 0; });
    sessionsIn(per.from, per.to).forEach(function (s) { var i = idx[bucketKey(s.first)]; if (i != null) { sess[i]++; vis[i][s.vid] = 1; } });
    demIn(per.from, per.to).forEach(function (d) { var i = idx[bucketKey(d.ts)]; if (i != null) dem[i]++; });
    return { keys: keys, sess: sess, vis: vis.map(function (o) { return Object.keys(o).length; }), dem: dem };
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
      cur = i; guide.setAttribute("x1", X(i)); guide.setAttribute("x2", X(i)); guide.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.innerHTML = "<b>" + esc(labelFn(keys[i])) + "</b><br>" + lines.map(function (l) { return esc(l.n) + " : " + fmt(l.v[i]); }).join("<br>");
      tip.style.left = Math.min(cx + 12, innerWidth - 270) + "px"; tip.style.top = Math.max(cy - 50, 8) + "px";
    }
    function hide() { tip.hidden = true; guide.setAttribute("visibility", "hidden"); }
    function at(ev) {
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width;
      var i = n <= 1 ? 0 : Math.round((x - L) / ((W - L - R) / (n - 1))); i = Math.max(0, Math.min(n - 1, i));
      show(i, ev.clientX, ev.clientY);
    }
    svg.addEventListener("pointermove", at); svg.addEventListener("pointerdown", at);
    svg.addEventListener("pointerleave", hide); svg.addEventListener("pointercancel", hide);
    el.onkeydown = function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault(); var i = cur < 0 ? 0 : cur + (e.key === "ArrowRight" ? 1 : -1); i = Math.max(0, Math.min(n - 1, i));
      var r = svg.getBoundingClientRect(); show(i, r.left + X(i) * r.width / W, r.top + 40);
    };
    el.onblur = hide;
  }
  function legend(items) { return '<div class="legend">' + items.map(function (l) { return '<span><i style="background:' + l.c + '"></i>' + esc(l.n) + "</span>"; }).join("") + "</div>"; }
  function simpleTable(head, rows) { return '<table><thead><tr>' + head.map(function (h) { return "<th" + (h.n ? ' class="n"' : "") + ">" + esc(h.t) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + r.map(function (c, i) { return "<td" + (head[i].n ? ' class="n"' : "") + ">" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>"; }
  function chart() {
    var s = series(), cvA = cover(D.meta.starts.pv, per.from, per.to), lines, head, rows;
    if (mode === "aud") {
      if (cvA === "none") { $("chart").innerHTML = '<p>' + tNA() + "</p>"; $("chartTable").innerHTML = ""; return; }
      lines = [{ n: "Sessions", v: s.sess, c: "var(--acc)" }, { n: "Visiteurs uniques estimés", v: s.vis, c: "var(--acc2)", d: 1 }];
    } else {
      lines = [{ n: "Demandes de contact confirmées", v: s.dem, c: "var(--acc)" }];
    }
    lineChart($("chart"), s.keys, lines, bucketLabel);
    $("chart").insertAdjacentHTML("afterbegin", legend(lines));
    head = [{ t: per.N === 1 ? "Heure" : "Date" }].concat(lines.map(function (l) { return { t: l.n, n: 1 }; }));
    rows = s.keys.map(function (k, i) { return [esc(bucketLabel(k))].concat(lines.map(function (l) { return fmt(l.v[i]); })); });
    $("chartTable").innerHTML = simpleTable(head, rows);
  }

  /* ---------- Provenance ---------- */
  function rateCell(conv, n) { return n ? cell(conv / n, n, 30, pct) : '<span class="muted" title="Aucune session">—</span>'; }
  function sources() {
    var S = sessionsIn(per.from, per.to), cvA = cover(D.meta.starts.pv, per.from, per.to);
    var order = ["Recherche", "Réseaux sociaux", "Sites référents", "Campagnes UTM", "Sans source attribuée"], tot = {}, src = {};
    order.forEach(function (c) { tot[c] = { n: 0, c: 0, d: 0 }; });
    S.forEach(function (s) {
      var t = tot[s.chan]; t.n++; t.d += s.conv; if (s.conv > 0) t.c++;
      var k = s.chan + "|" + (s.camp ? s.camp + " (" + s.src + ")" : s.src), o = src[k] || (src[k] = { chan: s.chan, name: s.camp ? s.camp + " (" + s.src + ")" : s.src, n: 0, c: 0, d: 0 });
      o.n++; o.d += s.conv; if (s.conv > 0) o.c++;
    });
    var head = [{ t: "Canal" }, { t: "Sessions", n: 1 }, { t: "Demandes", n: 1 }, { t: "Conversion", n: 1 }];
    $("tChan").innerHTML = cvA === "none" ? tNA() : simpleTable(head, order.map(function (c) { var t = tot[c]; return ['<button class="btn ghost" type="button" data-chan="' + esc(c) + '">' + esc(c) + "</button>", cell(t.n, t.n, 0, fmt), cell(t.d, t.n, 0, fmt), rateCell(t.c, t.n)]; }));
    var list = Object.keys(src).map(function (k) { return src[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 25);
    $("tSrc").innerHTML = cvA === "none" ? tNA() : (list.length ? simpleTable([{ t: "Source ou campagne" }, { t: "Canal" }, { t: "Sessions", n: 1 }, { t: "Demandes", n: 1 }, { t: "Conversion", n: 1 }],
      list.map(function (o) { return [esc(o.name), esc(o.chan), cell(o.n, o.n, 0, fmt), cell(o.d, o.n, 0, fmt), rateCell(o.c, o.n)]; })) : "<p>" + tZero() + " session sur la période.</p>");
    $("tChan").querySelectorAll("[data-chan]").forEach(function (b) { b.onclick = function () { F.chan = F.chan === b.dataset.chan ? "" : b.dataset.chan; syncFilters(); render(); }; });
  }

  /* ---------- Parcours ---------- */
  function funnelHTML(title, steps, note, base) {
    var h = '<div class="card"><h3>' + esc(title) + "</h3>";
    steps.forEach(function (s, i) {
      var w = base ? Math.min(100, s.n * 100 / base) : 0, prev = i ? steps[i - 1].n : null;
      h += '<div class="step"><span>' + esc(s.t) + '</span><span class="n"><b>' + (s.n === 0 ? tZero() : fmt(s.n)) + "</b>" + (base ? " · " + pct(s.n / base) : "") + (prev ? ' <span class="muted">(' + (prev ? pct(s.n / prev) : "—") + " de l’étape précédente)</span>" : "") + '</span><div class="bar"><b style="width:' + w + '%"></b></div></div>';
    });
    return h + '<p class="muted small">' + esc(note) + "</p></div>";
  }
  function funnelSteps(S) {
    var f = { all: S.length, rc: 0, rdv: 0, fs: 0, ok: 0, ag: 0, mail: 0, cal: 0 };
    S.forEach(function (s) { if (s.rc) f.rc++; if (s.rdv) f.rdv++; if (s.fs) f.fs++; if (s.conv > 0) { f.ok++; if (s.auto || s.agenda) f.ag++; } if (s.mail) f.mail++; if (s.agenda) f.cal++; });
    return f;
  }
  function funnels(S, el, unl) {
    var f = funnelSteps(S);
    el.innerHTML =
      funnelHTML("Bouton de contact → formulaire de rendez-vous", [
        { t: "Arrivée sur le site", n: f.all }, { t: "Clic sur un bouton de contact", n: f.rc }, { t: "Page Rendez-vous vue", n: f.rdv },
        { t: "Début du formulaire", n: f.fs }, { t: "Envoi confirmé", n: f.ok }, { t: "Agenda ouvert après l’envoi (réservation non confirmée)", n: f.ag }],
        "Chaque étape compte les sessions qui l’ont atteinte, quelle que soit la façon d’y arriver. « Envoi confirmé » = réponse positive de Formspree, compté une seule fois par demande." + (unl ? " " + unl + " demande(s) confirmée(s) ne sont pas reliées à une session : incluses dans le total des demandes, attribution indisponible." : ""), f.all) +
      funnelHTML("Lien e-mail", [{ t: "Arrivée sur le site", n: f.all }, { t: "Clic sur l’adresse e-mail (clic seulement)", n: f.mail }],
        "Un clic sur un lien e-mail n’est pas un message envoyé : l’envoi n’est pas mesurable.", f.all) +
      funnelHTML("Agenda de réservation (Calendly)", [{ t: "Arrivée sur le site", n: f.all }, { t: "Clic sur le lien de l’agenda (clic seulement)", n: f.cal }],
        "Calendly est un domaine tiers : un rendez-vous réservé n’est pas mesurable, seul le clic l’est.", f.all);
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
      '<p class="muted small">Seuils : LCP bon ≤ 2,5 s, INP bon ≤ 200 ms, CLS bon ≤ 0,1. Une valeur n’est affichée qu’à partir de 20 mesures ; la tablette n’est comptée que dans « Tous appareils ».</p>';
  }
  function pageSlow(path) {
    var rows = cwvRows(path), out = [];
    ["LCP", "INP", "CLS"].forEach(function (m) { var v = rows.filter(function (r) { return r.m === m; }).map(function (r) { return r.v; }); if (v.length >= 20 && p75(v) > LIM[m][0]) out.push(m); });
    return out;
  }

  /* ---------- Pages ---------- */
  function pageStats() {
    var a = dkey(ymd(per.from)), b = dkey(ymd(per.to)), map = {}, S = sessionsIn(per.from, per.to);
    function get(p) { return map[p] || (map[p] = { path: p, views: 0, entry: 0, cta: 0, conv: 0, convS: 0 }); }
    D.pages.forEach(function (r) { if (r.day >= a && r.day <= b && (F.test || !r.test) && (!F.dev || r.dev === F.dev)) { var o = get(r.path); o.views += r.views; o.cta += r.cta; } });
    S.forEach(function (s) { var o = get(s.entry); o.entry++; o.conv += s.conv; if (s.conv > 0) o.convS++; });
    var list = Object.keys(map).map(function (k) { var o = map[k]; o.title = D.titles[k] || k; o.rate = o.entry ? o.convS / o.entry : null; return o; });
    var site = S.length ? S.filter(function (s) { return s.conv > 0; }).length / S.length : 0;
    var vs = list.map(function (o) { return o.views; }).sort(function (x, y) { return x - y; }), med = vs.length ? vs[Math.floor(vs.length / 2)] : 0;
    list.forEach(function (o) {
      o.lowConv = o.entry >= 30 && o.views >= med && site > 0 && (o.rate || 0) < site / 2;
      o.slow = pageSlow(o.path);
    });
    return { list: list, site: site };
  }
  function pages() {
    var st = pageStats(), cvA = cover(D.meta.starts.pv, per.from, per.to);
    if (cvA === "none") { $("tPages").innerHTML = tNA(); return; }
    var cols = [["title", "Page", 0], ["views", "Vues", 1], ["entry", "Sessions d’entrée", 1], ["cta", "Clics contact", 1], ["conv", "Demandes confirmées", 1], ["rate", "Conversion", 1]];
    var list = st.list.slice().sort(function (x, y) {
      var a = x[sort.col], b = y[sort.col];
      if (a == null) a = -1; if (b == null) b = -1;
      return (typeof a === "string" ? a.localeCompare(b, "fr") : a - b) * sort.dir;
    });
    var h = "<table><thead><tr>" + cols.map(function (c) { return '<th class="' + (c[2] ? "n" : "") + '" aria-sort="' + (sort.col === c[0] ? (sort.dir > 0 ? "ascending" : "descending") : "none") + '"><button type="button" data-sort="' + c[0] + '">' + esc(c[1]) + (sort.col === c[0] ? (sort.dir > 0 ? " ▲" : " ▼") : "") + "</button></th>"; }).join("") + "<th>Repères</th></tr></thead><tbody>";
    list.forEach(function (o) {
      var fl = "";
      if (o.lowConv) fl += '<span class="tag t-low">▲ Très visitée, convertit peu</span> ';
      if (o.slow.length) fl += '<span class="tag t-bad">⏱ Chargement lent (' + esc(o.slow.join(", ")) + ")</span>";
      h += '<tr class="click" tabindex="0" data-path="' + esc(o.path) + '"><td>' + esc(o.title) + '<span class="n-small">' + esc(o.path) + "</span></td><td class=\"n\">" + cell(o.views, o.views, 0, fmt) + '</td><td class="n">' + cell(o.entry, o.entry, 0, fmt) + '</td><td class="n">' + cell(o.cta, o.cta, 0, fmt) + '</td><td class="n">' + cell(o.conv, o.entry, 0, fmt) + '</td><td class="n">' + rateCell(o.convS, o.entry) + "</td><td>" + fl + "</td></tr>";
    });
    $("tPages").innerHTML = h + "</tbody></table>";
    $("pagesNote").textContent = "Une demande est attribuée à la page d’entrée de sa session. Les vues et les clics suivent la période et l’appareil choisis ; les filtres source, campagne et page d’entrée s’appliquent aux sessions d’entrée, aux demandes et à la conversion. Cliquez sur une page pour son détail.";
    $("tPages").querySelectorAll("[data-sort]").forEach(function (b) { b.onclick = function () { var c = b.dataset.sort; sort = { col: c, dir: sort.col === c ? -sort.dir : (c === "title" ? 1 : -1) }; pages(); }; });
    $("tPages").querySelectorAll("tr[data-path]").forEach(function (r) { r.onclick = function () { openDetail(r.dataset.path); }; r.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(r.dataset.path); } }; });
  }
  function openDetail(path) {
    var S = sessionsIn(per.from, per.to).filter(function (s) { return s.entry === path; });
    var a = dkey(ymd(per.from)), b = dkey(ymd(per.to)), byDay = {};
    D.pages.forEach(function (r) { if (r.path === path && r.day >= a && r.day <= b && (F.test || !r.test) && (!F.dev || r.dev === F.dev)) byDay[r.day] = (byDay[r.day] || 0) + r.views; });
    var days = Object.keys(byDay).sort(), src = {};
    S.forEach(function (s) { var k = s.chan + " · " + (s.camp ? s.camp + " (" + s.src + ")" : s.src); src[k] = (src[k] || 0) + 1; });
    var top = Object.keys(src).sort(function (x, y) { return src[y] - src[x]; }).slice(0, 8);
    $("dBody").innerHTML = '<h2 id="dTitle">' + esc(D.titles[path] || path) + '</h2><p class="muted">' + esc(path) + "</p>" +
      "<h3>Vues par jour</h3>" + (days.length ? '<div id="dTrend"></div>' : "<p>" + tZero() + " vue sur la période.</p>") +
      "<h3>Principales sources (sessions d’entrée : " + fmt(S.length) + ")</h3>" + (top.length ? simpleTable([{ t: "Source" }, { t: "Sessions", n: 1 }], top.map(function (k) { return [esc(k), fmt(src[k])]; })) : "<p>Aucune session d’entrée.</p>") +
      '<h3>Parcours des sessions entrées par cette page</h3><div id="dFun" class="grid2"></div><h3>Core Web Vitals de la page</h3>' + cwvTable(path);
    funnels(S, $("dFun"), 0);
    if (days.length) { var keys = days, vals = days.map(function (d) { return byDay[d]; }); lineChart($("dTrend"), keys, [{ n: "Vues", v: vals, c: "var(--acc)" }], fDay); }
    var dlg = $("detail"); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }

  /* ---------- Activité ---------- */
  function activity() {
    var days = [], t = ymd(per.now), i;
    for (i = 6; i >= 0; i--) days.push(dkey(addDays(t, -i)));
    var S = D.S.filter(function (s) { return s.first >= per.week && passS(s); }), cnt = {};
    S.forEach(function (s) { var k = dayOf(s.first); cnt[k] = (cnt[k] || 0) + 1; });
    var vals = days.map(function (d) { return cnt[d] || 0; });
    if (cover(D.meta.starts.pv, per.week, per.now) === "none") { $("hist").innerHTML = tNA(); $("histTable").innerHTML = ""; $("tSess").innerHTML = tNA(); $("moreSess").hidden = true; return; }
    var W = 800, H = 240, L = 40, B = 34, T = 22, max = Math.max.apply(null, vals.concat([1])), bw = (W - L - 10) / 7, s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Histogramme des sessions par jour">';
    days.forEach(function (d, k) {
      var h = (H - T - B) * vals[k] / max, x = L + k * bw + 8;
      s += '<rect x="' + x + '" y="' + (H - B - h) + '" width="' + (bw - 16) + '" height="' + h + '" rx="4" fill="var(--acc)"><title>' + esc(fDay(d)) + " : " + vals[k] + " session(s)</title></rect>" +
        '<text x="' + (x + (bw - 16) / 2) + '" y="' + (H - B - h - 5) + '" text-anchor="middle" font-size="13" fill="var(--ink)">' + vals[k] + '</text><text x="' + (x + (bw - 16) / 2) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="12" fill="var(--muted)">' + esc(fDay(d)) + "</text>";
    });
    $("hist").innerHTML = s + '<line x1="' + L + '" x2="' + (W - 6) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--line)"/></svg>';
    $("histTable").innerHTML = simpleTable([{ t: "Jour" }, { t: "Sessions", n: 1 }], days.map(function (d, k) { return [esc(fDay(d)), cell(vals[k], vals[k], 0, fmt)]; }));
    var list = S.slice().sort(function (a, b) { return b.last - a.last; });
    function action(s) { return s.conv > 0 ? "Demande confirmée" : (s.fs ? "Formulaire commencé" : (s.rc ? "Clic bouton de contact" : (s.mail ? "Clic e-mail" : (s.agenda ? "Clic agenda" : "Aucune")))); }
    $("tSess").innerHTML = list.length ? simpleTable([{ t: "Dernière activité (Paris)" }, { t: "Page d’entrée" }, { t: "Source" }, { t: "Appareil" }, { t: "Action de contact" }],
      list.slice(0, sessLimit).map(function (s) { return [esc(fShort(s.last)), esc(s.entry), esc(s.chan + (s.src !== "—" ? " · " + s.src : "")), esc(s.dev), esc(action(s))]; })) : "<p>" + tZero() + " session sur 7 jours.</p>";
    $("moreSess").hidden = list.length <= sessLimit;
  }

  /* ---------- Qualité des données ---------- */
  function quality() {
    var st = D.meta.starts, since = function (v) { return v ? esc(fDate(v, true)) : tNA("Aucune donnée collectée pour l’instant"); };
    var rows = [
      ["Sessions, visiteurs uniques, pages vues", "Mesure anonyme du site (onglet Événements)", since(st.pv)],
      ["Clics (contact, e-mail, agenda)", "Mesure anonyme du site", since(st.cta)],
      ["Début de formulaire", "Mesure anonyme du site", since(st.fs)],
      ["Demandes de contact confirmées", "Onglet Demandes : envoi Formspree confirmé", since(st.demandes)],
      ["Attribution des demandes (source, page)", "Session reliée par identifiant technique", since(st.pv)],
      ["Core Web Vitals", "Mesures des navigateurs (Chrome, Edge, Android)", since(st.cwv)]
    ];
    $("tQual").innerHTML = simpleTable([{ t: "Métrique" }, { t: "Source" }, { t: "Collecte depuis le" }], rows);
    var tS = D.S.filter(function (s) { return s.test && inR(s.first, per.from, per.to); }).length, tD = D.dem.filter(function (d) { return d.test && d.ok && inR(d.ts, per.from, per.to); }).length;
    var n = [
      "Visiteurs uniques : estimés par un identifiant aléatoire stocké dans le navigateur (13 mois maximum) et dédupliqués sur la période choisie. Une même personne sur deux appareils compte deux fois ; un navigateur qui efface ses données aussi.",
      "Une session s’arrête après 30 minutes d’inactivité ; un nouveau lien avec une autre campagne UTM ouvre une nouvelle session.",
      "Trafic de test et d’administration : " + (F.test ? "inclus (case cochée)" : "exclu") + ". Sur la période, " + fmt(tS) + " session(s) et " + fmt(tD) + " demande(s) de test. Sont exclus à la source : domaines hors production, navigateurs automatisés, « Do Not Track » / GPC, et les navigateurs exclus avec le bouton « Exclure ce navigateur ». Ce tableau de bord ne se mesure pas lui-même.",
      "Les bloqueurs de publicité peuvent masquer une partie du trafic : les chiffres sont des minimums. Une demande dont la session n’a pas été mesurée est comptée dans les demandes, avec attribution indisponible.",
      "Aucun compte utilisateur sur DAN-IA : la vue « dernières connexions » n’a pas d’objet.",
      "Les demandes antérieures à la mesure d’audience n’ont pas de session : elles figurent dans le total des demandes avec attribution indisponible."
    ];
    if (D.truncated || D.meta.truncated) n.push("Attention : le volume dépasse la limite de lecture, les chiffres peuvent être incomplets. Archivez les anciennes lignes de l’onglet Événements.");
    $("qNotes").innerHTML = n.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");
  }

  /* ---------- Filtres : listes ---------- */
  function fillSelect(id, items, label, cur) {
    var el = $(id), h = '<option value="">' + esc(label) + "</option>";
    items.forEach(function (i) { h += '<option value="' + esc(i) + '"' + (i === cur ? " selected" : "") + ">" + esc(i) + "</option>"; });
    el.innerHTML = h;
  }
  function syncFilters() {
    var chans = ["Recherche", "Réseaux sociaux", "Sites référents", "Campagnes UTM", "Sans source attribuée"], camps = {}, pg = {}, dv = {};
    D.S.forEach(function (s) { if (s.camp) camps[s.camp] = 1; pg[s.entry] = 1; dv[s.dev] = 1; });
    fillSelect("fChan", chans, "Toutes", F.chan);
    fillSelect("fCamp", ["(hors campagne)"].concat(Object.keys(camps).sort()), "Toutes", F.camp);
    fillSelect("fPage", Object.keys(pg).sort(), "Toutes", F.page);
    fillSelect("fDev", Object.keys(dv).sort(), "Tous", F.dev);
    $("fTest").checked = F.test;
  }

  /* ---------- Rendu ---------- */
  function render() {
    if (!D) return;
    per = period();
    $("range").textContent = "Du " + fDate(per.from, true) + " au " + fDate(per.to, true) + " (heure de Paris). Comparé à : du " + fDate(per.pFrom, true) + " au " + fDate(per.pTo, true) + ".";
    $("refreshed").textContent = "Dernière actualisation : " + new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, dateStyle: "full", timeStyle: "medium" }).format(new Date(fetchedAt)) + " (heure de Paris).";
    var warn = [];
    if (D.truncated || D.meta.truncated) warn.push("Volume au-delà de la limite de lecture : chiffres possiblement incomplets.");
    setStatus(warn.join(" "));
    kpis(); chart(); sources();
    var S = sessionsIn(per.from, per.to);
    funnels(S, $("funnels"), filtersActive() ? 0 : unlinkedIn(per.from, per.to).length);
    pages(); $("tCwv").innerHTML = cwvTable(""); activity(); quality();
  }

  /* ---------- Connexion ---------- */
  function showLogin(msg) { $("app").hidden = true; $("login").hidden = false; $("loginMsg").textContent = msg || ""; $("token").focus(); }
  function showApp() { $("login").hidden = true; $("app").hidden = false; }

  function bind() {
    $("loginForm").addEventListener("submit", function (e) { e.preventDefault(); token = $("token").value; ss("dania-admin-token", token); $("token").value = ""; showApp(); load(); });
    $("logout").onclick = function () { ss("dania-admin-token", null); token = ""; D = null; showLogin(""); };
    $("refresh").onclick = function () { load(); };
    $("periods").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      P.p = b.dataset.p;
      [].forEach.call($("periods").children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      $("customForm").hidden = P.p !== "custom";
      if (P.p !== "custom") load();
    });
    $("customForm").addEventListener("submit", function (e) { e.preventDefault(); P.from = $("cFrom").value; P.to = $("cTo").value; if (P.from && P.to) load(); });
    var t = dkey(ymd(Date.now())); $("cTo").value = t; $("cTo").max = t; $("cFrom").max = t; $("cFrom").value = dkey(addDays(ymd(Date.now()), -13));
    [["fChan", "chan"], ["fCamp", "camp"], ["fPage", "page"], ["fDev", "dev"]].forEach(function (p) { $(p[0]).onchange = function () { F[p[1]] = this.value; render(); }; });
    $("fTest").onchange = function () { F.test = this.checked; render(); };
    $("fReset").onclick = function () { F = { chan: "", camp: "", page: "", dev: "", test: false }; syncFilters(); render(); };
    $("chartMode").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; mode = b.dataset.m; [].forEach.call($("chartMode").children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); chart(); });
    $("moreSess").onclick = function () { sessLimit += 25; activity(); };
    var sx = $("selfx");
    function selfState() { var on = ls("dania-notrack") === "1"; sx.setAttribute("aria-pressed", on); sx.textContent = on ? "Ce navigateur est exclu des mesures" : "Exclure ce navigateur"; }
    sx.onclick = function () { ls("dania-notrack", ls("dania-notrack") === "1" ? null : "1"); selfState(); };
    selfState();
  }

  bind();
  if (token) { showApp(); load(); } else showLogin("");
})();
