# SmokeTrack — Déploiement sur Vercel

## Étapes pour mettre l'app sur ton téléphone

### 1. Créer un compte GitHub (gratuit)
→ https://github.com/signup

### 2. Créer un nouveau dépôt GitHub
1. Clique sur "New repository"
2. Nomme-le `smoketrack`
3. Laisse-le Public
4. Clique "Create repository"

### 3. Uploader les fichiers
Dans ton nouveau dépôt GitHub, clique **"uploading an existing file"** et glisse-dépose **tous les fichiers** de ce dossier en respectant la structure :

```
smoketrack/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── manifest.json
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── main.jsx
    └── App.jsx
```

### 4. Déployer sur Vercel
1. Va sur https://vercel.com et connecte-toi avec ton compte GitHub
2. Clique **"Add New Project"**
3. Sélectionne ton dépôt `smoketrack`
4. Vercel détecte automatiquement Vite — clique juste **"Deploy"**
5. En 1 minute, tu as une URL du type `smoketrack-xxx.vercel.app`

### 5. Installer sur iPhone
1. Ouvre l'URL dans **Safari** (important : pas Chrome)
2. Appuie sur l'icône **Partager** (carré avec flèche vers le haut)
3. Sélectionne **"Sur l'écran d'accueil"**
4. Appuie sur **"Ajouter"**

→ SmokeTrack apparaît comme une vraie app sur ton écran d'accueil !

### 5. Installer sur Android
1. Ouvre l'URL dans **Chrome**
2. Appuie sur les **3 points** en haut à droite
3. Sélectionne **"Ajouter à l'écran d'accueil"**
4. Confirme

---

## Notes
- Les données sont stockées **localement sur ton téléphone** (localStorage)
- L'app fonctionne **hors-ligne** une fois installée
- Gratuit à 100% — Vercel ne facture pas pour ce type de projet
