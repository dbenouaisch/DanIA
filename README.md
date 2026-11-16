# DAN-IA — Site vitrine

Site statique de formation et conseil en IA et données (HTML/CSS/JS, sans build), hébergé sur Vercel.

## Pages
- `/` accueil (orientation Formation / Conseil)
- `/formations` comparatif des ateliers, cas pratiques, à propos, contact
- `/ia-au-quotidien`, `/bureautique`, `/agent-ia` : pages des ateliers
- `/conseil` : accompagnement données et IA
- `/diagnostic` : questionnaire de 10 questions (JavaScript requis)
- `/rendez-vous` : formulaire (Formspree) puis ouverture de l’agenda Calendly dans un nouvel onglet ; réglages en tête de `rdv.js`
- `/mentions-legales`
- `/admin` : tableau de bord d'administration (non indexé, protégé par un jeton), voir « Mesure d'audience »

## Structure
- `rdv.js` : formulaire de rendez-vous (envoi Formspree, mémoire des coordonnées, agenda). Le formulaire Formspree utilisé est `https://formspree.io/f/xrpqgryy`.
- `integrations/google-sheet.gs` : script Google à coller dans le tableur « DAN-IA · Demandes de rendez-vous » (onglets « Demandes » et « Tableau de bord », déjà mis en forme) pour y enregistrer chaque demande (mode d’emploi en tête du fichier). L’URL obtenue se colle dans `SHEET_ENDPOINT`, en haut de `rdv.js`.
- `site.css`, `site.js` : styles et scripts communs. Incrémenter `?v=` dans les pages HTML après modification.
- `fonts/` : polices Caladea et Carlito auto-hébergées (licence SIL OFL, voir les fichiers `LICENSE-*`).
- `vercel.json` : URLs propres, en-têtes de sécurité (CSP, etc.) et règles de cache.

## Mesure d'audience et tableau de bord `/admin`
- `config.js` : adresse `endpoint` du script Google (vide = ni mesure ni enregistrement des demandes) et domaines de production.
- `track.js` : mesure anonyme, sans cookie (pages vues, source/UTM, appareil, clics contact/e-mail/agenda, début de formulaire, Core Web Vitals). Désactivée hors production, pour les navigateurs automatisés, « Do Not Track », et le navigateur exclu via `/admin` (bouton « Exclure ce navigateur » ou `?notrack=1`). Pour tester ailleurs : `localStorage.setItem("dania-test","1")` (données marquées « test », masquées par défaut).
- `integrations/google-sheet.gs` : collecte les événements (onglet « Événements ») et les demandes (onglet « Demandes ») et sert les données à `/admin`. Mise en place : suivre les étapes 5 à 7 en tête du fichier (fonction `installer`, propriété `ADMIN_TOKEN`, nouvelle version du déploiement), puis coller l'URL `/exec` dans `config.js`.
- `/admin` + `admin.js` + `admin.css` : lecture avec le jeton `ADMIN_TOKEN` (conservé le temps de la session du navigateur, jamais dans le dépôt). Heure d'affichage : Europe/Paris.
- Chaque demande reçoit un identifiant unique (`rid`) : elle n'est jamais comptée deux fois. Elle est reliée à sa visite par l'identifiant de session ; sans session (mesure bloquée), elle est comptée avec attribution indisponible.
- Limites : visiteurs uniques estimés (identifiant par navigateur), bloqueurs de publicité, rendez-vous Calendly non mesurables (domaine tiers : seul le clic l'est).

## Déploiement
Toute modification poussée sur la branche de production (`main`) est redéployée automatiquement par Vercel.
Pour tester en local : `python3 -m http.server` puis ouvrir http://localhost:8000 (les URLs sans `.html` ne fonctionnent qu'avec Vercel ou `npx vercel dev`).

## Référencement (SEO)
- Chaque page a son `title`, sa `description`, son `canonical`, ses balises Open Graph et un balisage JSON-LD (`@graph` : Organization, Person, Course/Service, BreadcrumbList).
- `sitemap.xml` et `robots.txt` pointent vers `https://dan-ia.vercel.app`. `404.html` est servie automatiquement par Vercel (non indexée).
- **Changement de domaine** : remplacer `https://dan-ia.vercel.app` par le nouveau domaine dans tous les fichiers, puis ajouter une redirection permanente de l'ancien domaine dans `vercel.json` :
  ```bash
  grep -rl "dan-ia.vercel.app" --include=*.html --include=*.xml --include=*.txt . | xargs sed -i 's#https://dan-ia.vercel.app#https://NOUVEAU-DOMAINE#g'
  ```
- Après chaque changement important : soumettre `sitemap.xml` dans Google Search Console et Bing Webmaster Tools.
