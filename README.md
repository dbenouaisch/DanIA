# DAN-IA — Site vitrine

Site statique de formation et conseil en IA et données (HTML/CSS/JS, sans build), hébergé sur Vercel.

## Pages
- `/` accueil (orientation Formation / Conseil)
- `/formations` comparatif des ateliers, cas pratiques, à propos, contact
- `/ia-au-quotidien`, `/bureautique`, `/agent-ia` : pages des ateliers
- `/conseil` : accompagnement données et IA
- `/offres` : comparatif des quatre offres (atelier, accompagnement, conseil données, stratégie IA)
- `/a-propos` : présentation de Dan (parcours, façon de travailler)
- `/diagnostic` : questionnaire de 10 questions (JavaScript requis)
- `/rendez-vous` : agenda Calendly intégré dans la page (iframe, autorisée par `frame-src` dans `vercel.json`), formulaire de message (Formspree) en seconde voie ; réglages en tête de `lead.js` et `rdv.js`

## Structure
- `lead.js` : contact des visiteurs, partagé (mémoire des coordonnées 30 jours, envoi Formspree `https://formspree.io/f/xrpqgryy`, tableur Google).
- `rdv.js` : page de rendez-vous (formulaire puis agenda Calendly dans un nouvel onglet).
- `programme.js` et `programme/` : le programme de chaque atelier est lisible sur la fiche ; le PDF (`programme/<atelier>.pdf`, non indexé) n'est proposé qu'après l'envoi de l'e-mail du visiteur. Si les modules changent, mettre à jour la fiche **et** régénérer le PDF.
- `diagnostic.js` : questionnaire et recommandation, chargé uniquement par `/diagnostic` ; propose d'envoyer le résultat par e-mail (consentement obligatoire).
- `integrations/google-sheet.gs` : script Google à coller dans le tableur « DAN-IA · Demandes de rendez-vous » (onglets « Demandes » et « Tableau de bord », déjà mis en forme) pour y enregistrer chaque demande (mode d’emploi en tête du fichier). L’URL obtenue se colle dans `SHEET_ENDPOINT`, en haut de `lead.js`.
- `site.css`, `site.js` : styles et scripts communs. Incrémenter `?v=` dans les pages HTML après modification.
- Libellé unique du bouton de réservation : « Réserver 20 min avec nous » (toutes les pages). Nom unique du deuxième atelier : « Bureautique boostée par l’IA ».
- Mesure d'audience : script Vercel Web Analytics (`/_vercel/insights/script.js`), sans cookie. Il ne collecte rien tant que l'option « Web Analytics » n'est pas activée dans le tableau de bord Vercel du projet (onglet Analytics).
- `fonts/` : polices Caladea et Carlito auto-hébergées (licence SIL OFL, voir les fichiers `LICENSE-*`).
- `vercel.json` : URLs propres, en-têtes de sécurité (CSP, etc.) et règles de cache.

## Suivi du site (page cachée `/suivi-dan`)
- Page non liée depuis le site, non indexée (`noindex`, absente du sitemap), protégée par un mot de passe vérifié **côté Google** (propriété de script `ADMIN_TOKEN`, jamais écrite dans le dépôt ; 5 essais ratés verrouillent la lecture 15 minutes).
- Contenu : visiteurs uniques (jour, semaine, mois), visites, pages vues, demandes, parcours de chaque visite (de l'entrée à la sortie), parcours les plus fréquents, pages de sortie, entonnoirs (rendez-vous, programme PDF, diagnostic), sources et campagnes UTM, fidélité (nouveaux et de retour), performance des pages, Core Web Vitals, enseignements automatiques.
- Collecte : `config.js` (adresse du script Google, domaines de production) et `track.js` (mesure anonyme sans cookie, chargée sur toutes les pages) ; `lead.js` relie chaque demande confirmée à sa visite. Désactivée hors production, pour les navigateurs automatisés, « Do Not Track », et le navigateur exclu (bouton « Exclure ce navigateur » sur la page de suivi).
- Données : tableur Google, onglets « Événements » (mesure) et « Demandes ». Mise en place : étapes 5 à 7 en tête de `integrations/google-sheet.gs` (fonction `installer`, propriété `ADMIN_TOKEN`, nouvelle version du déploiement existant : l'URL ne change pas).
- Limites : visiteurs uniques estimés (un identifiant par navigateur), bloqueurs de publicité, réservations faites dans le calendrier Calendly intégré non mesurables.

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
