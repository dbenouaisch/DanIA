# Pragma IA — Landing Page

Site vitrine de Pragma IA, cabinet de conseil en Intelligence Artificielle pour PME et ETI françaises.

## Structure

```
pragma-ia/
├── index.html      ← Landing page complète (HTML/CSS/JS autonome)
├── vercel.json     ← Config Vercel (headers sécurité + cache)
└── README.md       ← Ce fichier
```

## Déploiement sur Vercel via GitHub

### 1. Pousser sur GitHub
```bash
git init
git add .
git commit -m "feat: landing page Pragma IA v1"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/pragma-ia.git
git push -u origin main
```

### 2. Connecter à Vercel
1. Aller sur https://vercel.com
2. "Add New Project" → "Import Git Repository"
3. Sélectionner le repo `pragma-ia`
4. Laisser tous les paramètres par défaut (détection automatique : Static Site)
5. Cliquer **Deploy**

### 3. Ajouter un domaine custom (optionnel)
1. Dashboard Vercel → Projet → Settings → Domains
2. Ajouter `pragma-ia.fr`
3. Copier les enregistrements DNS fournis par Vercel
4. Les ajouter chez ton registrar (OVH, Gandi, etc.)

## Mise à jour du site

```bash
# Modifier index.html, puis :
git add index.html
git commit -m "update: [description de la modification]"
git push
# → Vercel redéploie automatiquement en ~20 secondes
```

## Checklist avant lancement

- [ ] Remplacer `https://calendly.com/VOTRE-LIEN` par ton vrai lien Calendly
- [ ] Ajouter ta photo dans la section fondateur
- [ ] Renseigner email et téléphone dans le footer
- [ ] Compléter le SIRET dans le footer
- [ ] Remplacer les chiffres résultats par tes vrais chiffres clients
- [ ] Créer la page Mentions Légales (obligatoire en France)
- [ ] Configurer Google Analytics ou Plausible
- [ ] Vérifier le rendu mobile (Chrome DevTools → Toggle device toolbar)

## Technologies

- HTML5 / CSS3 / JavaScript vanilla
- Fonts : Playfair Display + Manrope (Google Fonts)
- Images : Unsplash (licence libre, usage commercial autorisé)
- Hébergement : Vercel (plan Hobby gratuit)

## Contact

contact@pragma-ia.fr
