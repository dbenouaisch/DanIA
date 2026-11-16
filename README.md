# DAN-IA — Site vitrine

Site statique de formation et conseil en IA et données (HTML/CSS/JS, sans build), hébergé sur Vercel.

## Pages
- `/` accueil (orientation Formation / Conseil)
- `/formations` comparatif des ateliers, cas pratiques, à propos, contact
- `/ia-au-quotidien`, `/bureautique`, `/agent-ia` : pages des ateliers
- `/conseil` : accompagnement données et IA
- `/diagnostic` : questionnaire de 10 questions (JavaScript requis)
- `/rendez-vous` : formulaire (Formspree) puis ouverture de l’agenda Calendly dans un nouvel onglet ; réglages en tête de `lead.js` et `rdv.js`
- `/mentions-legales`

## Structure
- `lead.js` : contact des visiteurs, partagé (mémoire des coordonnées 30 jours, envoi Formspree `https://formspree.io/f/xrpqgryy`, tableur Google).
- `rdv.js` : page de rendez-vous (formulaire puis agenda Calendly dans un nouvel onglet).
- `programme.js` et `programme/` : le programme détaillé de chaque atelier n'est chargé qu'après l'envoi de l'e-mail du visiteur (carte « Programme » des fiches). Le contenu des programmes se modifie dans `programme/*.html`.
- `integrations/google-sheet.gs` : script Google à coller dans le tableur « DAN-IA · Demandes de rendez-vous » (onglets « Demandes » et « Tableau de bord », déjà mis en forme) pour y enregistrer chaque demande (mode d’emploi en tête du fichier). L’URL obtenue se colle dans `SHEET_ENDPOINT`, en haut de `lead.js`.
- `site.css`, `site.js` : styles et scripts communs. Incrémenter `?v=` dans les pages HTML après modification.
- `fonts/` : polices Caladea et Carlito auto-hébergées (licence SIL OFL, voir les fichiers `LICENSE-*`).
- `vercel.json` : URLs propres, en-têtes de sécurité (CSP, etc.) et règles de cache.

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
