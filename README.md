# DAN-IA — Site vitrine

Site statique de formation et conseil en IA et données (HTML/CSS/JS, sans build), hébergé sur Vercel.

## Pages
- `/` accueil (orientation Formation / Conseil)
- `/formations` comparatif des ateliers, cas pratiques, à propos, contact
- `/ia-au-quotidien`, `/bureautique`, `/agent-ia` : pages des ateliers
- `/conseil` : accompagnement données et IA
- `/diagnostic` : questionnaire de 10 questions (JavaScript requis)
- `/mentions-legales`, `/confidentialite`

## Structure
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
