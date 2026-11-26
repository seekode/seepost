# Atelier & Comptoir

**Atelier & Comptoir** est un jeu web pédagogique de gestion et d'apprentissage du **JavaScript** conçu spécialement pour les **grands débutants absolus**.

Il propose un **Mode Histoire complet de 40 micro-exercices très progressifs (~7 heures)** guidés par ton collègue **Léo**, directement dans une interface plein écran combinant un atelier visuel animé, un espace client et un éditeur de code intégré.

---

## Démarrage rapide

### Avec npm
```bash
git clone <url-du-depot>
cd atelier-et-comptoir
npm install
npm run dev
```

### Avec Bun
```bash
bun install
bun dev
```

Puis ouvre l'adresse affichée dans le terminal (par défaut `http://localhost:5173`). Appuie sur `F11` (ou clique sur **Plein écran**) pour une immersion optimale.

### Lancer les tests automatisés (vérifie les 40 exercices et leurs corrigés)
```bash
npm test
```

---

## Parcours pédagogique (~7 heures, 40 exercices)

Toutes les notions suivent une **syntaxe de base stricte** pour ne jamais surcharger les débutants :
- **Variables :** uniquement `var` (pas de `let` ni `const`)
- **Conditions :** uniquement `if`, `else if`, `else` (`===`, `!==`, `>`, `<`, `>=`, `<=`)
- **Boucles :** uniquement `for` classique (`for (var i = ...; ...; i++)`)
- **Fonctions :** syntaxe classique `function nom(...) { ... }`
- **DOM :** vrais éléments HTML inspectables avec `F12`, `document.getElementById("...")` et `appendChild`

### Les 5 chapitres
1. **Chapitre 1 — Les variables (`var`) — Le Tapis Roulant (Exercices 1 à 10)**  
   Créer, nommer, modifier des variables (nombres, textes, calculs, concaténation). Chaque variable fait apparaître un vrai colis sur le tapis roulant, livré par Léo au client.
2. **Chapitre 2 — Les conditions (`if / else`) — Le Centre de Tri (Exercices 11 à 19)**  
   Le tapis roulant bugue et envoie 5 colis (dont 4 parasites). Utilise le centre de tri pour `conserver()` le bon colis et `supprimer()` les autres.
3. **Chapitre 3 — Les boucles (`for`) — Le Générateur (Exercices 20 à 27)**  
   Duplique et incrémente automatiquement des séries de colis dans le générateur tout en visualisant l'avancement du compteur `i`.
4. **Chapitre 4 — Les fonctions (`function`) — Les Recettes de l'Atelier (Exercices 28 à 33)**  
   Regroupe des actions répétitives dans des fonctions réutilisables avec paramètres, `return`, conditions et boucles.
5. **Chapitre 5 — Le DOM (`id` + `appendChild`) — Tu prends le relais ! (Exercices 34 à 40)**  
   Léo part en congé ! Ouvre l'inspecteur du navigateur (`F12`), utilise l'outil de sélection d'élément pour trouver les vrais `id` des colis et des zones clients, stocke-les dans des `var` et déplace les éléments avec `appendChild`.

---

---

## Mode Livraison Express (bonus)

Débloqué **uniquement après avoir réussi les 40 exercices** du Mode Histoire (entrée verrouillée sur l'accueil, avec la progression `x / 40`).

- **5 minutes** pour livrer un maximum de colis (durée modifiable dans `EXPRESS_CONFIG.durationMs`, `src/engine/expressSession.js`).
- Chaque livraison réussie déclenche un **nouvel exercice aléatoire** (variables, conditions, boucles, fonctions, DOM) dont les valeurs et objectifs varient ; jamais deux fois le même gabarit de suite.
- Une **mauvaise réponse** coûte 10 secondes (`penaltyMs`) mais ne termine pas la partie. Le chrono est figé pendant l'animation de livraison.
- **Difficulté progressive** par paliers : Échauffement (0 colis), Rythme de croisière (3), Coup de feu (6), Maître livreur (10).
- **Bilan** de fin de partie (colis livrés, erreurs, meilleur score) ; le record est sauvegardé dans une clé `localStorage` séparée (`atelier_comptoir_express_v1`) : la sauvegarde du Mode Histoire n'est jamais modifiée.

Le mode réutilise tel quel `runner.js`, `validator.js`, la scène, l'éditeur et les animations : le générateur (`src/data/expressExercises.js`) produit des « niveaux » au même format que ceux de l'Histoire.

## Architecture du projet

```text
├── index.html                   # Page principale & structure DOM inspectable
├── vite.config.js               # Configuration Vite (sans overlay bloquant)
├── src/
│   ├── main.js                  # Point d'entrée & orchestration du jeu
│   ├── data/
│   │   ├── chapters.js          # Métadonnées des 5 chapitres
│   │   ├── levels-ch1.js        # Exercices 1 à 10 (var)
│   │   ├── levels-ch2.js        # Exercices 11 à 19 (if / else)
│   │   ├── levels-ch3.js        # Exercices 20 à 27 (for)
│   │   ├── levels-ch4.js        # Exercices 28 à 33 (function)
│   │   ├── levels-ch5.js        # Exercices 34 à 40 (DOM id + appendChild)
│   │   ├── levels.js            # Liste complète des 40 niveaux
│   │   └── expressExercises.js  # Générateur d'exercices aléatoires (Livraison Express)
│   ├── engine/
│   │   ├── storage.js           # Sauvegarde automatique localStorage (+ record Express, déverrouillage)
│   │   ├── expressSession.js    # Chrono, pénalités et compteurs d'une partie Express
│   │   ├── syntaxRules.js       # Règles strictes débutant, garde anti-boucle infinie, instrumentation
│   │   ├── errorTranslator.js   # Traduction claire des erreurs JS en français
│   │   ├── runner.js            # Exécution isolée (try/catch) par mécanique
│   │   └── validator.js         # Validation des objectifs d'exercice
│   ├── ui/
│   │   ├── svgAssets.js         # Personnages SVG (Léo & clients)
│   │   ├── sceneRenderer.js     # Rendu de l'atelier, du comptoir et des vrais éléments DOM
│   │   ├── animations.js        # Animations fluides des colis, postes et livraisons
│   │   ├── editorController.js  # Éditeur intégré (numéros de ligne, Tab, Ctrl+Entrée)
│   │   ├── levelModal.js        # Sélecteur de niveaux, mémento et modale de victoire
│   │   └── expressController.js # Interface et déroulement du mode Livraison Express
│   └── styles/
│       ├── main.css             # Thème, menu d'accueil, barre HUD, modales
│       ├── workshop.css         # Scène de jeu (Atelier, 3 postes, Léo, Espace client)
│       ├── editor.css           # Zone de code & journal d'exécution
│       └── express.css          # Entrée de menu, HUD chronométré et modales Express
└── tests/
    ├── curriculum.test.js       # Tests automatisés vérifiant les 40 exercices et leurs corrigés
    └── express.test.js          # Tests du générateur, du chrono, du record et du déverrouillage
```

## Licence

MIT
