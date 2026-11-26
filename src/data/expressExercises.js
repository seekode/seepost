/**
 * Mode « Livraison Express » — générateur d'exercices aléatoires.
 *
 * Chaque exercice produit est un objet « niveau » au MÊME format que ceux du Mode Histoire
 * (mechanic, objective, client, leo, starterCode, solution, expectedValues, parcels, ...).
 * Le runner, le validateur, le rendu de la scène et les animations existants sont donc
 * réutilisés tels quels : aucune règle de validation n'est dupliquée ici.
 *
 * La difficulté monte par paliers en fonction du nombre de colis déjà livrés.
 */

/* ------------------------------------------------------------------ */
/* Outils aléatoires                                                   */
/* ------------------------------------------------------------------ */

/** Générateur pseudo-aléatoire déterministe (mulberry32) — permet des tests reproductibles. */
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function shuffle(rng, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const sample = (rng, list, count) => shuffle(rng, list).slice(0, count);
const q = (text) => JSON.stringify(text);
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/* ------------------------------------------------------------------ */
/* Données de décor                                                    */
/* ------------------------------------------------------------------ */

const CLIENTS = [
  { name: 'Camille', avatar: 'camille' },
  { name: 'Théo', avatar: 'theo' },
  { name: 'Inès', avatar: 'ines' },
  { name: 'Sami', avatar: 'sami' },
  { name: 'Nora', avatar: 'nora' },
  { name: 'Lucas', avatar: 'lucas' },
  { name: 'Hugo', avatar: 'hugo' },
  { name: 'Lina', avatar: 'lina' },
  { name: 'Malo', avatar: 'malo' }
];

// Mots simples, sans accent : faciles à taper vite dans l'éditeur.
const WORDS = [
  'livre', 'tasse', 'stylo', 'cahier', 'lampe', 'chaise', 'vase', 'radio', 'balle', 'carte',
  'miroir', 'bougie', 'plante', 'ballon', 'jouet', 'casque', 'pinceau', 'ruban', 'bijou', 'cadeau'
];

const FIRST_NAMES = ['Lina', 'Malo', 'Sami', 'Nora', 'Hugo', 'Lucas', 'Ines', 'Camille', 'Theo', 'Zoe'];

const SUCCESS_LINES = [
  'Colis livré, bien joué !',
  'Livraison réussie, au suivant !',
  'Impeccable : le client est ravi !',
  'Dans les temps, continue comme ça !',
  'Parfait ! Le prochain colis arrive !'
];

const COLORS = ['#f59e0b', '#0ea5e9', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

const CHAPTER_BY_MECHANIC = { variables: 1, conditions: 2, loops: 3, functions: 4, dom: 5 };

export const MECHANIC_LABELS = {
  variables: 'Variable',
  conditions: 'Condition',
  loops: 'Boucle',
  functions: 'Fonction',
  dom: 'DOM'
};

/* ------------------------------------------------------------------ */
/* Paliers de difficulté                                               */
/* ------------------------------------------------------------------ */

/** Paliers : le palier N démarre dès `from` colis livrés. */
export const EXPRESS_TIERS = [
  { tier: 1, from: 0, label: 'Échauffement' },
  { tier: 2, from: 3, label: 'Rythme de croisière' },
  { tier: 3, from: 6, label: 'Coup de feu' },
  { tier: 4, from: 10, label: 'Maître livreur' }
];

export function getTierForDelivered(deliveredCount) {
  let current = EXPRESS_TIERS[0];
  for (const t of EXPRESS_TIERS) {
    if (deliveredCount >= t.from) current = t;
  }
  return current;
}

/* ------------------------------------------------------------------ */
/* Gabarits d'exercices                                                */
/* ------------------------------------------------------------------ */
/**
 * Chaque gabarit : { id, mechanic, minTier, weight, build(ctx) }.
 * build() renvoie les champs spécifiques du niveau + `signature` (anti-répétition)
 * + `objective`, `orderText`, `hint`, `starterCode`, `solution`.
 */

const TEMPLATES = [];
const template = (def) => TEMPLATES.push(def);

/* ---------- Variables ---------- */

template({
  id: 'var-nombre',
  mechanic: 'variables',
  minTier: 1,
  weight: 3,
  build({ rng }) {
    const n = int(rng, 2, 99);
    return {
      title: 'Un nombre à livrer',
      station: 'tapis',
      objective: `Crée une variable contenant le nombre ${n}, puis livre-la avec leo(...).`,
      orderText: `Bonjour ! Un colis avec le nombre ${n}, s’il vous plaît !`,
      hint: 'var nom = valeur; puis leo(nom); — un nombre s’écrit sans guillemets.',
      starterCode: `// Variable = ${n}, puis leo(...)\n`,
      solution: `var colis = ${n};\nleo(colis);`,
      expectedValues: [n],
      signature: `var-nombre:${n}`
    };
  }
});

template({
  id: 'var-texte',
  mechanic: 'variables',
  minTier: 1,
  weight: 3,
  build({ rng }) {
    const w = pick(rng, WORDS);
    return {
      title: 'Un colis en texte',
      station: 'tapis',
      objective: `Crée une variable contenant le texte "${w}", puis livre-la avec leo(...).`,
      orderText: `Je voudrais le colis "${w}", merci !`,
      hint: 'Un texte s’écrit TOUJOURS entre guillemets : "mot".',
      starterCode: `// Variable = "${w}", puis leo(...)\n`,
      solution: `var produit = ${q(w)};\nleo(produit);`,
      expectedValues: [w],
      signature: `var-texte:${w}`
    };
  }
});

template({
  id: 'var-reassign',
  mechanic: 'variables',
  minTier: 2,
  weight: 2,
  build({ rng }) {
    const a = int(rng, 2, 30);
    let b = int(rng, 31, 90);
    if (b === a) b += 1;
    return {
      title: 'Prix modifié',
      station: 'tapis',
      objective: `Crée prix = ${a}, change-le pour qu’il vaille ${b} (sans réécrire var), puis livre-le avec leo(...).`,
      orderText: `Le prix a changé : je prends le colis à ${b} !`,
      hint: 'Pour modifier une variable existante, écris juste : prix = nouvelleValeur;',
      starterCode: `// var prix = ${a}; puis modifie-le à ${b}, puis leo(...)\n`,
      solution: `var prix = ${a};\nprix = ${b};\nleo(prix);`,
      expectedValues: [b],
      requireReassign: true,
      signature: `var-reassign:${a}:${b}`
    };
  }
});

template({
  id: 'var-concat',
  mechanic: 'variables',
  minTier: 2,
  weight: 2,
  build({ rng }) {
    const name = pick(rng, FIRST_NAMES);
    const greet = pick(rng, ['Bonjour ', 'Salut ', 'Merci ']);
    const full = `${greet}${name}`;
    return {
      title: 'Message personnalisé',
      station: 'tapis',
      objective: `Crée prenom = "${name}", puis une variable valant ${q(greet)} + prenom, et livre-la avec leo(...).`,
      orderText: `Je voudrais le message "${full}" !`,
      hint: `On colle des textes avec + : ${q(greet)} + prenom (attention à l’espace dans les guillemets).`,
      starterCode: `// prenom = "${name}", puis un message qui colle ${q(greet)} + prenom\n`,
      solution: `var prenom = ${q(name)};\nvar message = ${q(greet)} + prenom;\nleo(message);`,
      expectedValues: [full],
      requireOperator: '+',
      signature: `var-concat:${greet}${name}`
    };
  }
});

template({
  id: 'var-calcul',
  mechanic: 'variables',
  minTier: 2,
  weight: 3,
  build({ rng }) {
    const op = pick(rng, ['+', '-', '*']);
    let a;
    let b;
    let result;
    let verb;
    if (op === '+') {
      a = int(rng, 10, 60);
      b = int(rng, 10, 40);
      result = a + b;
      verb = 'somme';
    } else if (op === '-') {
      a = int(rng, 30, 90);
      b = int(rng, 5, 25);
      result = a - b;
      verb = 'différence (premier − second)';
    } else {
      a = int(rng, 3, 9);
      b = int(rng, 3, 9);
      result = a * b;
      verb = 'produit';
    }
    return {
      title: 'Calcul automatique',
      station: 'tapis',
      objective: `Crée deux variables (${a} et ${b}), calcule leur ${verb} avec ${op} dans une troisième, puis livre-la.`,
      orderText: `J’ai besoin du colis ${a} ${op} ${b}, calculé par vos soins !`,
      hint: `var resultat = a ${op} b; puis leo(resultat); — ne livre que le résultat.`,
      starterCode: `// a = ${a}, b = ${b}, resultat = a ${op} b, puis leo(resultat)\n`,
      solution: `var a = ${a};\nvar b = ${b};\nvar resultat = a ${op} b;\nleo(resultat);`,
      expectedValues: [result],
      requireOperator: op,
      signature: `var-calcul:${a}${op}${b}`
    };
  }
});

template({
  id: 'var-total',
  mechanic: 'variables',
  minTier: 3,
  weight: 2,
  build({ rng }) {
    const quantite = int(rng, 3, 9);
    const prix = int(rng, 4, 15);
    const withFees = rng() < 0.5;
    const frais = int(rng, 2, 9);
    const total = withFees ? quantite * prix + frais : quantite * prix;
    const calc = withFees ? 'quantite * prix + frais' : 'quantite * prix';
    return {
      title: 'Total de la commande',
      station: 'tapis',
      objective: withFees
        ? `quantite = ${quantite}, prix = ${prix}, frais = ${frais} : livre quantite * prix + frais avec leo(...).`
        : `quantite = ${quantite}, prix = ${prix} : calcule le total (quantite * prix) et livre-le avec leo(...).`,
      orderText: `Ma commande : ${quantite} articles à ${prix} euros${withFees ? `, plus ${frais} euros de frais` : ''}. Quel total ?`,
      hint: 'Crée une variable par information, puis une variable total qui fait le calcul.',
      starterCode: '// Une variable par information, puis le total\n',
      solution: withFees
        ? `var quantite = ${quantite};\nvar prix = ${prix};\nvar frais = ${frais};\nvar total = ${calc};\nleo(total);`
        : `var quantite = ${quantite};\nvar prix = ${prix};\nvar total = ${calc};\nleo(total);`,
      expectedValues: [total],
      requireOperator: '*',
      signature: `var-total:${quantite}:${prix}:${withFees ? frais : 0}`
    };
  }
});

/* ---------- Conditions ---------- */

function wordParcels(rng, keepWords, count = 5) {
  const others = WORDS.filter((w) => !keepWords.includes(w));
  const decoys = sample(rng, others, count - keepWords.length);
  return shuffle(rng, [
    ...keepWords.map((value) => ({ value, expectedAction: 'keep' })),
    ...decoys.map((value) => ({ value, expectedAction: 'delete' }))
  ]);
}

template({
  id: 'cond-egal',
  mechanic: 'conditions',
  minTier: 1,
  weight: 3,
  build({ rng }) {
    const w = pick(rng, WORDS);
    return {
      title: 'Ne livrer que le bon colis',
      station: 'tri',
      objective: `Crée var colis, puis ne livre que "${w}" : if (colis === "${w}") { leo(colis); }`,
      orderText: `Je ne veux que le colis "${w}" !`,
      hint: 'Dans le if, compare avec === puis appelle leo(colis); entre les accolades { }.',
      starterCode: `// Livre uniquement "${w}"\n`,
      solution: `var colis = ${q(w)};\nif (colis === ${q(w)}) {\n  leo(colis);\n}`,
      inputVar: 'colis',
      allowImplicitDelete: true,
      parcels: wordParcels(rng, [w]),
      requireSyntax: ['if', '==='],
      signature: `cond-egal:${w}`
    };
  }
});

template({
  id: 'cond-egal-else',
  mechanic: 'conditions',
  minTier: 2,
  weight: 2,
  build({ rng }) {
    const w = pick(rng, WORDS);
    return {
      title: 'Garder ou supprimer',
      station: 'tri',
      objective: `Livre "${w}" avec leo(...) s’il vaut "${w}" (===), sinon supprimer(); dans le else.`,
      orderText: `Seul le colis "${w}" m’intéresse, jetez les autres !`,
      hint: 'if (...) { leo(colis); } else { supprimer(); }',
      starterCode: `// if / else : garder "${w}", supprimer le reste\n`,
      solution: `var colis = ${q(w)};\nif (colis === ${q(w)}) {\n  leo(colis);\n} else {\n  supprimer();\n}`,
      inputVar: 'colis',
      parcels: wordParcels(rng, [w]),
      requireSyntax: ['if', '===', 'else'],
      signature: `cond-egal-else:${w}`
    };
  }
});

const COMPARATORS = {
  '>': { varName: 'poids', phrase: (t) => `pèse plus de ${t} kg`, test: (v, t) => v > t },
  '<': { varName: 'prix', phrase: (t) => `coûte moins de ${t} euros`, test: (v, t) => v < t },
  '>=': { varName: 'taille', phrase: (t) => `mesure au moins ${t} cm`, test: (v, t) => v >= t },
  '<=': { varName: 'age', phrase: (t) => `a au plus ${t} ans`, test: (v, t) => v <= t }
};

template({
  id: 'cond-seuil',
  mechanic: 'conditions',
  minTier: 2,
  weight: 4,
  build({ rng }) {
    const op = pick(rng, Object.keys(COMPARATORS));
    const cmp = COMPARATORS[op];
    const t = int(rng, 12, 60);
    const values = shuffle(rng, [t, t - 2, t + 2, t - 9, t + 9]);
    const parcels = values.map((value) => ({
      value,
      expectedAction: cmp.test(value, t) ? 'keep' : 'delete'
    }));
    const v = cmp.varName;
    return {
      title: `Seuil (${op})`,
      station: 'tri',
      objective: `Crée var ${v} : livre avec leo(...) si ${v} ${op} ${t} (le colis ${cmp.phrase(t)}), sinon supprimer();`,
      orderText: `Je ne prends que les colis dont ${v} ${op} ${t}.`,
      hint: `if (${v} ${op} ${t}) { leo(${v}); } else { supprimer(); } — attention à la valeur ${t} elle-même !`,
      starterCode: `// ${v} ${op} ${t} -> leo(...), sinon supprimer()\n`,
      solution: `var ${v} = ${t + 1};\nif (${v} ${op} ${t}) {\n  leo(${v});\n} else {\n  supprimer();\n}`,
      inputVar: v,
      parcels,
      requireSyntax: ['if', op, 'else'],
      signature: `cond-seuil:${op}:${t}`
    };
  }
});

template({
  id: 'cond-different',
  mechanic: 'conditions',
  minTier: 3,
  weight: 2,
  build({ rng }) {
    const banned = pick(rng, WORDS);
    const others = sample(rng, WORDS.filter((w) => w !== banned), 4);
    const parcels = shuffle(rng, [
      { value: banned, expectedAction: 'delete' },
      ...others.map((value) => ({ value, expectedAction: 'keep' }))
    ]);
    return {
      title: 'Tout sauf un colis',
      station: 'tri',
      objective: `Crée var etat : livre tout colis qui n’est PAS "${banned}" (!==), supprime le reste avec else.`,
      orderText: `Tout, sauf "${banned}" : je n’en veux surtout pas !`,
      hint: '!== veut dire « différent de » : if (etat !== "mot") { leo(etat); } else { supprimer(); }',
      starterCode: `// Livrer tout sauf "${banned}"\n`,
      solution: `var etat = ${q(others[0])};\nif (etat !== ${q(banned)}) {\n  leo(etat);\n} else {\n  supprimer();\n}`,
      inputVar: 'etat',
      parcels,
      requireSyntax: ['if', '!==', 'else'],
      signature: `cond-different:${banned}`
    };
  }
});

template({
  id: 'cond-deux-cas',
  mechanic: 'conditions',
  minTier: 3,
  weight: 3,
  build({ rng }) {
    const [a, b] = sample(rng, WORDS, 2);
    return {
      title: 'Deux colis acceptés',
      station: 'tri',
      objective: `Crée var code : livre "${a}" (if) ET "${b}" (else if) avec leo(...), supprime tout le reste (else).`,
      orderText: `J’attends deux colis : "${a}" et "${b}" !`,
      hint: 'if (...) { leo(code); } else if (...) { leo(code); } else { supprimer(); }',
      starterCode: `// if / else if / else : "${a}" et "${b}"\n`,
      solution: `var code = ${q(a)};\nif (code === ${q(a)}) {\n  leo(code);\n} else if (code === ${q(b)}) {\n  leo(code);\n} else {\n  supprimer();\n}`,
      inputVar: 'code',
      parcels: wordParcels(rng, [a, b]),
      requireSyntax: ['if', 'else if', 'else'],
      signature: `cond-deux-cas:${a}:${b}`
    };
  }
});

template({
  id: 'cond-intervalle',
  mechanic: 'conditions',
  minTier: 4,
  weight: 3,
  build({ rng }) {
    const lo = int(rng, 5, 15);
    const hi = lo + int(rng, 10, 20);
    const mid = Math.floor((lo + hi) / 2);
    const values = shuffle(rng, [lo - 4, lo, mid, hi, hi + 5]);
    const parcels = values.map((value) => ({
      value,
      expectedAction: value >= lo && value <= hi ? 'keep' : 'delete'
    }));
    return {
      title: 'Zone de température',
      station: 'tri',
      objective: `Crée var temperature : supprime si < ${lo}, else if > ${hi} supprime aussi, sinon livre avec leo(...).`,
      orderText: `Mes plantes veulent entre ${lo}° et ${hi}° (bornes comprises) !`,
      hint: 'Supprime les extrêmes avec < puis > (else if), et mets leo(...) dans le else final.',
      starterCode: `// Entre ${lo} et ${hi} : livrer, sinon supprimer\n`,
      solution: `var temperature = ${mid};\nif (temperature < ${lo}) {\n  supprimer();\n} else if (temperature > ${hi}) {\n  supprimer();\n} else {\n  leo(temperature);\n}`,
      inputVar: 'temperature',
      parcels,
      requireSyntax: ['if', 'else if', 'else'],
      signature: `cond-intervalle:${lo}:${hi}`
    };
  }
});

/* ---------- Boucles ---------- */

const seriesText = (list) => list.map((v) => (typeof v === 'string' ? `"${v}"` : String(v))).join(', ');

template({
  id: 'boucle-compte',
  mechanic: 'loops',
  minTier: 1,
  weight: 3,
  build({ rng }) {
    const n = int(rng, 3, 8);
    const expected = Array.from({ length: n }, (_, i) => i + 1);
    return {
      title: `Série de 1 à ${n}`,
      station: 'generateur',
      objective: `Avec une boucle for, génère les colis de 1 à ${n} avec generer(i).`,
      orderText: `Il me faut tous les numéros de 1 à ${n} !`,
      hint: 'for (var i = départ; i <= fin; i++) { generer(i); }',
      starterCode: `// for : 1 à ${n}\n`,
      solution: `for (var i = 1; i <= ${n}; i++) {\n  generer(i);\n}`,
      expectedGenerated: expected,
      requireForLoop: true,
      signature: `boucle-compte:${n}`
    };
  }
});

template({
  id: 'boucle-plage',
  mechanic: 'loops',
  minTier: 1,
  weight: 3,
  build({ rng }) {
    const a = int(rng, 2, 9);
    const b = a + int(rng, 3, 6);
    const expected = [];
    for (let i = a; i <= b; i++) expected.push(i);
    return {
      title: `Série de ${a} à ${b}`,
      station: 'generateur',
      objective: `Avec une boucle for, génère les colis numérotés de ${a} à ${b}.`,
      orderText: `Je voudrais les numéros de ${a} jusqu’à ${b} !`,
      hint: `Le compteur ne démarre pas à 1 : var i = ${a}.`,
      starterCode: `// for : ${a} à ${b}\n`,
      solution: `for (var i = ${a}; i <= ${b}; i++) {\n  generer(i);\n}`,
      expectedGenerated: expected,
      requireForLoop: true,
      signature: `boucle-plage:${a}:${b}`
    };
  }
});

template({
  id: 'boucle-compte-a-rebours',
  mechanic: 'loops',
  minTier: 2,
  weight: 2,
  build({ rng }) {
    const n = int(rng, 4, 9);
    const expected = [];
    for (let i = n; i >= 1; i--) expected.push(i);
    return {
      title: 'Compte à rebours',
      station: 'generateur',
      objective: `Avec une boucle for qui décompte (i--), génère ${n}, ${n - 1}, ... jusqu’à 1.`,
      orderText: `Un compte à rebours de ${n} à 1, s’il vous plaît !`,
      hint: 'Pour décompter : for (var i = départ; i >= 1; i--)',
      starterCode: `// compte à rebours de ${n} à 1\n`,
      solution: `for (var i = ${n}; i >= 1; i--) {\n  generer(i);\n}`,
      expectedGenerated: expected,
      requireForLoop: true,
      signature: `boucle-rebours:${n}`
    };
  }
});

template({
  id: 'boucle-pas',
  mechanic: 'loops',
  minTier: 2,
  weight: 3,
  build({ rng }) {
    const step = pick(rng, [2, 5, 10]);
    const count = int(rng, 4, 6);
    const expected = Array.from({ length: count }, (_, i) => step * (i + 1));
    const end = expected[expected.length - 1];
    return {
      title: `De ${step} en ${step}`,
      station: 'generateur',
      objective: `Avec une boucle for, génère ${seriesText(expected)} (de ${step} en ${step}).`,
      orderText: `Les numéros de ${step} en ${step}, jusqu’à ${end} !`,
      hint: `Le compteur avance de ${step} : i = i + ${step}`,
      starterCode: `// de ${step} en ${step} jusqu'à ${end}\n`,
      solution: `for (var i = ${step}; i <= ${end}; i = i + ${step}) {\n  generer(i);\n}`,
      expectedGenerated: expected,
      requireForLoop: true,
      signature: `boucle-pas:${step}:${count}`
    };
  }
});

template({
  id: 'boucle-texte',
  mechanic: 'loops',
  minTier: 2,
  weight: 2,
  build({ rng }) {
    const label = pick(rng, ['Colis', 'Lot', 'Boite', 'Sac']);
    const n = int(rng, 3, 5);
    const expected = Array.from({ length: n }, (_, i) => `${label} ${i + 1}`);
    return {
      title: 'Colis numérotés',
      station: 'generateur',
      objective: `Avec une boucle for de 1 à ${n}, génère ${seriesText(expected)} (texte + i).`,
      orderText: `Il me faut ${n} colis étiquetés ${label} 1, ${label} 2...`,
      hint: `Colle le texte et le compteur : generer(${q(`${label} `)} + i);`,
      starterCode: `// ${label} 1 ... ${label} ${n}\n`,
      solution: `for (var i = 1; i <= ${n}; i++) {\n  generer(${q(`${label} `)} + i);\n}`,
      expectedGenerated: expected,
      requireForLoop: true,
      signature: `boucle-texte:${label}:${n}`
    };
  }
});

template({
  id: 'boucle-multiple',
  mechanic: 'loops',
  minTier: 3,
  weight: 2,
  build({ rng }) {
    const k = pick(rng, [3, 4, 6, 7]);
    const n = int(rng, 4, 6);
    const expected = Array.from({ length: n }, (_, i) => (i + 1) * k);
    return {
      title: `Table de ${k}`,
      station: 'generateur',
      objective: `Avec une boucle for de 1 à ${n}, génère i * ${k} : ${seriesText(expected)}.`,
      orderText: `La table de ${k}, ${n} colis !`,
      hint: `Dans la boucle : generer(i * ${k});`,
      starterCode: `// table de ${k}\n`,
      solution: `for (var i = 1; i <= ${n}; i++) {\n  generer(i * ${k});\n}`,
      expectedGenerated: expected,
      requireForLoop: true,
      signature: `boucle-multiple:${k}:${n}`
    };
  }
});

template({
  id: 'boucle-condition',
  mechanic: 'loops',
  minTier: 3,
  weight: 3,
  build({ rng }) {
    const n = int(rng, 7, 10);
    const variant = pick(rng, ['>=', '<', '!==']);
    let test;
    let t;
    let phrase;
    if (variant === '!==') {
      t = int(rng, 2, n - 1);
      test = (i) => i !== t;
      phrase = `tous sauf ${t}`;
    } else {
      t = int(rng, 3, n - 2);
      test = variant === '>=' ? (i) => i >= t : (i) => i < t;
      phrase = variant === '>=' ? `seulement ceux >= ${t}` : `seulement ceux < ${t}`;
    }
    const expected = [];
    for (let i = 1; i <= n; i++) if (test(i)) expected.push(i);
    return {
      title: 'Boucle + condition',
      station: 'generateur',
      objective: `Boucle de 1 à ${n} avec un if dedans : génère ${phrase} (${seriesText(expected)}).`,
      orderText: `Parcourez 1 à ${n} et envoyez-moi ${phrase} !`,
      hint: `Place if (i ${variant} ${t}) { generer(i); } À L’INTÉRIEUR de la boucle.`,
      starterCode: `// for 1 à ${n} + if (i ${variant} ${t})\n`,
      solution: `for (var i = 1; i <= ${n}; i++) {\n  if (i ${variant} ${t}) {\n    generer(i);\n  }\n}`,
      expectedGenerated: expected,
      requireForLoop: true,
      requireIf: true,
      signature: `boucle-condition:${n}:${variant}:${t}`
    };
  }
});

template({
  id: 'boucle-descente-pas',
  mechanic: 'loops',
  minTier: 4,
  weight: 2,
  build({ rng }) {
    const step = pick(rng, [2, 3, 5]);
    const count = int(rng, 4, 6);
    const start = step * count;
    const expected = Array.from({ length: count }, (_, i) => start - step * i);
    return {
      title: `Descente de ${step} en ${step}`,
      station: 'generateur',
      objective: `Avec une boucle for qui descend de ${step} en ${step}, génère ${seriesText(expected)}.`,
      orderText: `Je veux ${seriesText(expected)}, dans cet ordre !`,
      hint: `Pour descendre : i = i - ${step} avec la condition i >= ${step}.`,
      starterCode: `// descendre de ${step} en ${step} depuis ${start}\n`,
      solution: `for (var i = ${start}; i >= ${step}; i = i - ${step}) {\n  generer(i);\n}`,
      expectedGenerated: expected,
      requireForLoop: true,
      signature: `boucle-descente:${step}:${count}`
    };
  }
});

/* ---------- Fonctions ---------- */

const VOID_FUNCTIONS = [
  ['preparerCafe', 'cafe'],
  ['emballerCadeau', 'cadeau'],
  ['fabriquerBiscuit', 'biscuit'],
  ['servirThe', 'the'],
  ['cuireBaguette', 'baguette'],
  ['preparerCrepe', 'crepe']
];

template({
  id: 'fonction-simple',
  mechanic: 'functions',
  minTier: 2,
  weight: 3,
  build({ rng }) {
    const [fn, value] = pick(rng, VOID_FUNCTIONS);
    const calls = int(rng, 2, 4);
    return {
      title: `Fonction ${fn}()`,
      station: 'generateur',
      objective: `Crée la fonction ${fn}() qui appelle generer("${value}"), puis appelle-la ${calls} fois.`,
      orderText: `${calls} fois "${value}", s’il vous plaît !`,
      hint: `function ${fn}() { ... } crée la recette ; ${fn}(); la lance.`,
      starterCode: `// function ${fn}() + ${calls} appels\n`,
      solution: `function ${fn}() {\n  generer(${q(value)});\n}\n\n${Array(calls).fill(`${fn}();`).join('\n')}`,
      mode: 'generate',
      expectedFunction: { name: fn, minParams: 0, minCalls: calls },
      expectedGenerated: Array(calls).fill(value),
      signature: `fonction-simple:${fn}:${calls}`
    };
  }
});

const PARAM_FUNCTIONS = [
  ['emballer', 'objet'],
  ['preparer', 'article'],
  ['ranger', 'produit'],
  ['fabriquer', 'piece']
];

template({
  id: 'fonction-parametre',
  mechanic: 'functions',
  minTier: 2,
  weight: 3,
  build({ rng }) {
    const [fn, param] = pick(rng, PARAM_FUNCTIONS);
    const items = sample(rng, WORDS, 3);
    return {
      title: `Fonction ${fn}(${param})`,
      station: 'generateur',
      objective: `Crée ${fn}(${param}) qui appelle generer(${param}), puis appelle-la pour ${items.map((w) => `"${w}"`).join(', ')}.`,
      orderText: `Je prends : ${items.join(', ')} !`,
      hint: `Le paramètre ${param} se comporte comme une variable dans la fonction.`,
      starterCode: `// ${fn}(${param}) puis 3 appels\n`,
      solution: `function ${fn}(${param}) {\n  generer(${param});\n}\n\n${items.map((w) => `${fn}(${q(w)});`).join('\n')}`,
      mode: 'generate',
      expectedFunction: { name: fn, minParams: 1, minCalls: 3 },
      expectedGenerated: items,
      signature: `fonction-parametre:${fn}:${items.join('|')}`
    };
  }
});

template({
  id: 'fonction-retour-multiple',
  mechanic: 'functions',
  minTier: 2,
  weight: 3,
  build({ rng }) {
    const [fn, k] = pick(rng, [['doubler', 2], ['tripler', 3], ['quadrupler', 4]]);
    const arg = int(rng, 3, 15);
    return {
      title: `Fonction ${fn}()`,
      station: 'tapis',
      objective: `Crée ${fn}(nombre) qui retourne nombre * ${k}, puis stocke ${fn}(${arg}) dans une variable.`,
      orderText: `Pour ${arg} pièces, je veux la quantité multipliée par ${k} !`,
      hint: `return renvoie le résultat : return nombre * ${k}; puis var resultat = ${fn}(${arg});`,
      starterCode: `// ${fn}(nombre) + var resultat = ${fn}(${arg});\n`,
      solution: `function ${fn}(nombre) {\n  return nombre * ${k};\n}\n\nvar resultat = ${fn}(${arg});`,
      mode: 'return',
      expectedFunction: { name: fn, minParams: 1, minCalls: 1 },
      expectedValues: [arg * k],
      extraTests: [
        { args: [5], expected: 5 * k },
        { args: [12], expected: 12 * k }
      ],
      signature: `fonction-retour-multiple:${fn}:${arg}`
    };
  }
});

const TWO_PARAM_FUNCTIONS = [
  { name: 'additionner', params: ['a', 'b'], op: '+', apply: (a, b) => a + b, ranges: [[10, 40], [5, 30]] },
  { name: 'soustraire', params: ['a', 'b'], op: '-', apply: (a, b) => a - b, ranges: [[40, 90], [5, 30]] },
  { name: 'calculerAire', params: ['largeur', 'hauteur'], op: '*', apply: (a, b) => a * b, ranges: [[3, 12], [3, 12]] }
];

template({
  id: 'fonction-retour-deux-parametres',
  mechanic: 'functions',
  minTier: 3,
  weight: 3,
  build({ rng }) {
    const def = pick(rng, TWO_PARAM_FUNCTIONS);
    const x = int(rng, ...def.ranges[0]);
    const y = int(rng, ...def.ranges[1]);
    const [p1, p2] = def.params;
    return {
      title: `Fonction ${def.name}()`,
      station: 'tapis',
      objective: `Crée ${def.name}(${p1}, ${p2}) qui retourne ${p1} ${def.op} ${p2}, puis stocke ${def.name}(${x}, ${y}) dans une variable.`,
      orderText: `Donnez-moi le résultat de ${x} ${def.op} ${y}, calculé par votre recette !`,
      hint: `Deux paramètres séparés par une virgule : function ${def.name}(${p1}, ${p2}) { return ...; }`,
      starterCode: `// ${def.name}(${p1}, ${p2}) + un appel (${x}, ${y})\n`,
      solution: `function ${def.name}(${p1}, ${p2}) {\n  return ${p1} ${def.op} ${p2};\n}\n\nvar resultat = ${def.name}(${x}, ${y});`,
      mode: 'return',
      expectedFunction: { name: def.name, minParams: 2, minCalls: 1 },
      expectedValues: [def.apply(x, y)],
      extraTests: [
        { args: [20, 4], expected: def.apply(20, 4) },
        { args: [9, 7], expected: def.apply(9, 7) }
      ],
      signature: `fonction-deux-params:${def.name}:${x}:${y}`
    };
  }
});

template({
  id: 'fonction-etiquette',
  mechanic: 'functions',
  minTier: 3,
  weight: 2,
  build({ rng }) {
    const [a, b] = sample(rng, WORDS, 2);
    const qa = int(rng, 2, 6);
    const qb = int(rng, 2, 6);
    return {
      title: 'Fonction etiqueter()',
      station: 'generateur',
      objective: `Crée etiqueter(nom, quantite) qui génère nom + " x" + quantite, pour ("${a}", ${qa}) et ("${b}", ${qb}).`,
      orderText: `Je veux "${a} x${qa}" et "${b} x${qb}" !`,
      hint: 'Dans la fonction : generer(nom + " x" + quantite); — puis deux appels.',
      starterCode: '// etiqueter(nom, quantite) + 2 appels\n',
      solution: `function etiqueter(nom, quantite) {\n  generer(nom + " x" + quantite);\n}\n\netiqueter(${q(a)}, ${qa});\netiqueter(${q(b)}, ${qb});`,
      mode: 'generate',
      expectedFunction: { name: 'etiqueter', minParams: 2, minCalls: 2 },
      expectedGenerated: [`${a} x${qa}`, `${b} x${qb}`],
      signature: `fonction-etiquette:${a}:${qa}:${b}:${qb}`
    };
  }
});

const CLASSIFIERS = [
  { name: 'verifierPoids', param: 'poids', high: 'Lourd', low: 'Leger' },
  { name: 'verifierTaille', param: 'taille', high: 'Grand', low: 'Petit' },
  { name: 'verifierNote', param: 'note', high: 'Reussi', low: 'Rate' },
  { name: 'verifierStock', param: 'stock', high: 'Plein', low: 'Vide' }
];

template({
  id: 'fonction-retour-condition',
  mechanic: 'functions',
  minTier: 3,
  weight: 3,
  build({ rng }) {
    const def = pick(rng, CLASSIFIERS);
    const op = pick(rng, ['>=', '>']);
    const t = int(rng, 6, 25);
    const test = op === '>=' ? (v) => v >= t : (v) => v > t;
    const label = (v) => (test(v) ? def.high : def.low);
    const arg = pick(rng, [t - 3, t + 4, t + 9]);
    return {
      title: `Fonction ${def.name}()`,
      station: 'tapis',
      objective: `Crée ${def.name}(${def.param}) : retourne "${def.high}" si ${def.param} ${op} ${t}, sinon "${def.low}". Stocke ${def.name}(${arg}).`,
      orderText: `Mon colis est à ${arg} : étiquette "${def.high}" ou "${def.low}" ?`,
      hint: `Mets un return "${def.high}"; dans le if et un return "${def.low}"; dans le else.`,
      starterCode: `// ${def.name}(${def.param}) + var etiquette = ${def.name}(${arg});\n`,
      solution: `function ${def.name}(${def.param}) {\n  if (${def.param} ${op} ${t}) {\n    return ${q(def.high)};\n  } else {\n    return ${q(def.low)};\n  }\n}\n\nvar etiquette = ${def.name}(${arg});`,
      mode: 'return',
      expectedFunction: { name: def.name, minParams: 1, minCalls: 1 },
      expectedValues: [label(arg)],
      extraTests: [
        { args: [t - 1], expected: label(t - 1) },
        { args: [t], expected: label(t) },
        { args: [t + 7], expected: label(t + 7) }
      ],
      signature: `fonction-condition:${def.name}:${op}:${t}:${arg}`
    };
  }
});

template({
  id: 'fonction-boucle',
  mechanic: 'functions',
  minTier: 4,
  weight: 3,
  build({ rng }) {
    const fn = pick(rng, ['produireLot', 'fabriquerLot', 'preparerLot']);
    const item = pick(rng, WORDS);
    const count = int(rng, 3, 6);
    return {
      title: `Fonction ${fn}()`,
      station: 'generateur',
      objective: `Crée ${fn}(objet, nombre) avec une boucle for, puis appelle ${fn}("${item}", ${count});`,
      orderText: `Un lot de ${count} colis "${item}", s’il vous plaît !`,
      hint: 'La boucle utilise le paramètre comme limite : for (var i = 1; i <= nombre; i++)',
      starterCode: `// ${fn}(objet, nombre) avec for\n`,
      solution: `function ${fn}(objet, nombre) {\n  for (var i = 1; i <= nombre; i++) {\n    generer(objet);\n  }\n}\n\n${fn}(${q(item)}, ${count});`,
      mode: 'generate',
      expectedFunction: { name: fn, minParams: 2, minCalls: 1 },
      expectedGenerated: Array(count).fill(item),
      requireForLoop: true,
      signature: `fonction-boucle:${fn}:${item}:${count}`
    };
  }
});

template({
  id: 'fonction-somme',
  mechanic: 'functions',
  minTier: 4,
  weight: 2,
  build({ rng }) {
    const n = int(rng, 4, 9);
    const sum = (m) => (m * (m + 1)) / 2;
    return {
      title: 'Fonction somme()',
      station: 'tapis',
      objective: `Crée somme(n) qui additionne 1 + 2 + ... + n avec une boucle for et la retourne. Stocke somme(${n}).`,
      orderText: `Combien font tous les nombres de 1 à ${n} additionnés ?`,
      hint: 'var total = 0; puis dans la boucle : total = total + i; et enfin return total;',
      starterCode: `// somme(n) avec for + return, puis var resultat = somme(${n});\n`,
      solution: `function somme(n) {\n  var total = 0;\n  for (var i = 1; i <= n; i++) {\n    total = total + i;\n  }\n  return total;\n}\n\nvar resultat = somme(${n});`,
      mode: 'return',
      expectedFunction: { name: 'somme', minParams: 1, minCalls: 1 },
      expectedValues: [sum(n)],
      extraTests: [
        { args: [3], expected: sum(3) },
        { args: [10], expected: sum(10) }
      ],
      requireForLoop: true,
      signature: `fonction-somme:${n}`
    };
  }
});

/* ---------- DOM ---------- */

const DOM_ITEMS = [
  { word: 'boussole', label: 'Boussole', value: 'Nord' },
  { word: 'lampe', label: 'Lampe', value: 'LED' },
  { word: 'horloge', label: 'Horloge', value: '12h' },
  { word: 'telescope', label: 'Télescope', value: 'x50' },
  { word: 'sablier', label: 'Sablier', value: '5 min' },
  { word: 'compas', label: 'Compas', value: 'Ø 10' },
  { word: 'jumelles', label: 'Jumelles', value: 'x8' },
  { word: 'thermometre', label: 'Thermomètre', value: '21°' }
];

const ZONE_PREFIXES = ['panier', 'boite', 'zone', 'palette'];

function domParcel(rng, item) {
  return { id: `colis-${item.word}`, label: item.label, value: item.value, color: pick(rng, COLORS) };
}

function domTarget(rng, client, orderText, usedIds = []) {
  let id;
  let guard = 0;
  do {
    id = `${pick(rng, ZONE_PREFIXES)}-${client.avatar}`;
    guard++;
  } while (usedIds.includes(id) && guard < 20);
  return {
    id,
    label: 'Zone de dépôt',
    clientName: client.name,
    avatar: client.avatar,
    orderText
  };
}

const idsClause = (showIds, parcelId, targetId) =>
  showIds
    ? `(#${parcelId} → #${targetId})`
    : '(inspecte la page avec F12 pour trouver les id)';

template({
  id: 'dom-simple',
  mechanic: 'dom',
  minTier: 2,
  weight: 3,
  build({ rng, tier, client }) {
    const item = pick(rng, DOM_ITEMS);
    const parcel = domParcel(rng, item);
    const target = domTarget(rng, client, `Pouvez-vous placer « ${item.label} » dans ma zone ?`);
    const showIds = tier < 3 || rng() < 0.5;
    return {
      title: `Déplacer « ${item.label} »`,
      station: 'dom',
      objective: `Déplace le colis « ${item.label} » dans la zone de ${client.name} avec appendChild ${idsClause(showIds, parcel.id, target.id)}.`,
      hint: 'var colis = document.getElementById("..."); var zone = document.getElementById("..."); zone.appendChild(colis);',
      starterCode: '// getElementById x2, puis zone.appendChild(colis)\n',
      solution: `var colis = document.getElementById(${q(parcel.id)});\nvar zone = document.getElementById(${q(target.id)});\nzone.appendChild(colis);`,
      domParcels: [parcel],
      domTargets: [target],
      expectedPlacements: [{ parcelId: parcel.id, targetId: target.id }],
      signature: `dom-simple:${item.word}:${target.id}`
    };
  }
});

template({
  id: 'dom-choisir',
  mechanic: 'dom',
  minTier: 3,
  weight: 3,
  build({ rng, tier, client }) {
    const items = sample(rng, DOM_ITEMS, 3);
    const parcels = items.map((item) => domParcel(rng, item));
    const wanted = pick(rng, parcels);
    const wantedItem = items[parcels.indexOf(wanted)];
    const target = domTarget(rng, client, `Je ne veux que « ${wantedItem.label} » !`);
    const showIds = tier < 4 || rng() < 0.5;
    return {
      title: `Livrer uniquement « ${wantedItem.label} »`,
      station: 'dom',
      objective: showIds
        ? `3 colis sur le tapis : déplace UNIQUEMENT « ${wantedItem.label} » (#${wanted.id}) dans #${target.id}.`
        : `3 colis sur le tapis : inspecte-les (F12) et déplace UNIQUEMENT « ${wantedItem.label} » dans la zone de ${client.name}.`,
      hint: 'Un seul colis à déplacer : récupère-le avec son id, puis zone.appendChild(colis);',
      starterCode: `// Ne déplace que « ${wantedItem.label} »\n`,
      solution: `var colis = document.getElementById(${q(wanted.id)});\nvar zone = document.getElementById(${q(target.id)});\nzone.appendChild(colis);`,
      domParcels: parcels,
      domTargets: [target],
      expectedPlacements: [{ parcelId: wanted.id, targetId: target.id }],
      signature: `dom-choisir:${wanted.id}:${target.id}`
    };
  }
});

template({
  id: 'dom-boucle',
  mechanic: 'dom',
  minTier: 3,
  weight: 2,
  build({ rng, client }) {
    const n = int(rng, 3, 5);
    const parcels = Array.from({ length: n }, (_, i) => ({
      id: `colis-${i + 1}`,
      label: `Colis ${i + 1}`,
      value: `#${i + 1}`,
      color: '#6366f1'
    }));
    const target = domTarget(rng, client, `Chargez les ${n} colis sur ma zone avec une boucle for !`);
    return {
      title: `Charger ${n} colis (for)`,
      station: 'dom',
      objective: `Avec une boucle for, déplace colis-1 à colis-${n} dans #${target.id} (document.getElementById("colis-" + i)).`,
      hint: 'Récupère la zone avant la boucle, puis dans la boucle : getElementById("colis-" + i) et appendChild.',
      starterCode: `// for 1 à ${n} : getElementById("colis-" + i) + appendChild\n`,
      solution: `var zone = document.getElementById(${q(target.id)});\nfor (var i = 1; i <= ${n}; i++) {\n  var colis = document.getElementById("colis-" + i);\n  zone.appendChild(colis);\n}`,
      domParcels: parcels,
      domTargets: [target],
      expectedPlacements: parcels.map((p) => ({ parcelId: p.id, targetId: target.id })),
      requireForLoop: true,
      signature: `dom-boucle:${n}:${target.id}`
    };
  }
});

template({
  id: 'dom-boucle-condition',
  mechanic: 'dom',
  minTier: 4,
  weight: 3,
  build({ rng, client }) {
    const n = int(rng, 4, 6);
    // Au moins un « OK » et au moins un « NON »
    let flags;
    do {
      flags = Array.from({ length: n }, () => rng() < 0.5);
    } while (!flags.some(Boolean) || flags.every(Boolean));
    const parcels = flags.map((ok, i) => ({
      id: `paquet-${i + 1}`,
      simpleText: ok ? 'OK' : 'NON',
      color: ok ? '#16a34a' : '#dc2626'
    }));
    const target = domTarget(rng, client, 'Livrez-moi uniquement les paquets marqués "OK" !');
    return {
      title: 'Trier puis livrer (for + if)',
      station: 'dom',
      objective: `Parcours paquet-1 à paquet-${n} avec for : déplace dans #${target.id} ceux dont colis.textContent === "OK".`,
      hint: 'for + var colis = document.getElementById("paquet-" + i); + if (colis.textContent === "OK") { ... }',
      starterCode: `// for 1 à ${n} + if (colis.textContent === "OK")\n`,
      solution: `var zone = document.getElementById(${q(target.id)});\nfor (var i = 1; i <= ${n}; i++) {\n  var colis = document.getElementById("paquet-" + i);\n  if (colis.textContent === "OK") {\n    zone.appendChild(colis);\n  }\n}`,
      domParcels: parcels,
      domTargets: [target],
      expectedPlacements: parcels.filter((_, i) => flags[i]).map((p) => ({ parcelId: p.id, targetId: target.id })),
      requireForLoop: true,
      requireIf: true,
      signature: `dom-boucle-condition:${flags.map((f) => (f ? 1 : 0)).join('')}:${target.id}`
    };
  }
});

template({
  id: 'dom-fonction',
  mechanic: 'dom',
  minTier: 4,
  weight: 3,
  build({ rng }) {
    const fn = pick(rng, ['livrer', 'deposer', 'poser']);
    const count = int(rng, 2, 3);
    const items = sample(rng, DOM_ITEMS, count);
    const clients = sample(rng, CLIENTS, count);
    const parcels = items.map((item) => domParcel(rng, item));
    const targets = [];
    clients.forEach((c, i) => {
      targets.push(
        domTarget(rng, c, `${items[i].label}, c’est pour moi !`, targets.map((t) => t.id))
      );
    });
    const calls = parcels.map((p, i) => `${fn}(${q(p.id)}, ${q(targets[i].id)});`).join('\n');
    return {
      title: `Fonction ${fn}() + DOM`,
      station: 'dom',
      objective: `Crée ${fn}(idColis, idZone), puis livre ${items.map((it, i) => `« ${it.label} » à ${clients[i].name}`).join(', ')}.`,
      hint: `Dans ${fn} : getElementById x2 puis appendChild ; appelle-la ${count} fois (inspecte les id avec F12).`,
      starterCode: `// function ${fn}(idColis, idZone) puis ${count} appels\n`,
      solution: `function ${fn}(idColis, idZone) {\n  var colis = document.getElementById(idColis);\n  var zone = document.getElementById(idZone);\n  zone.appendChild(colis);\n}\n\n${calls}`,
      domParcels: parcels,
      domTargets: targets,
      expectedPlacements: parcels.map((p, i) => ({ parcelId: p.id, targetId: targets[i].id })),
      requireFunction: { name: fn, minParams: 2 },
      signature: `dom-fonction:${fn}:${items.map((i) => i.word).join('|')}:${targets.map((t) => t.id).join('|')}`
    };
  }
});

export const EXPRESS_TEMPLATES = TEMPLATES;

/* ------------------------------------------------------------------ */
/* Sélection & assemblage                                              */
/* ------------------------------------------------------------------ */

/** Mémoire anti-répétition d'une partie. */
export function createExpressHistory() {
  return { templateIds: [], mechanics: [], signatures: new Set() };
}

function chooseTemplate(rng, tier, history) {
  const eligible = TEMPLATES.filter((t) => t.minTier <= tier.tier);

  const lastTwoSameMechanic =
    history.mechanics.length >= 2 &&
    history.mechanics[history.mechanics.length - 1] === history.mechanics[history.mechanics.length - 2]
      ? history.mechanics[history.mechanics.length - 1]
      : null;
  const recentTemplates = history.templateIds.slice(-3);

  let pool = eligible.filter(
    (t) => !recentTemplates.includes(t.id) && t.mechanic !== lastTwoSameMechanic
  );
  if (pool.length === 0) pool = eligible.filter((t) => !recentTemplates.includes(t.id));
  if (pool.length === 0) pool = eligible;

  // Les gabarits récemment débloqués reviennent plus souvent pour sentir la montée en difficulté.
  const weighted = pool.map((t) => ({
    t,
    w: t.weight * (t.minTier >= tier.tier - 1 ? 2 : 1)
  }));
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  let roll = rng() * total;
  for (const x of weighted) {
    roll -= x.w;
    if (roll <= 0) return x.t;
  }
  return weighted[weighted.length - 1].t;
}

/**
 * Génère l'exercice suivant.
 * @param {object} opts
 * @param {number} opts.deliveredCount colis déjà livrés (pilote le palier de difficulté)
 * @param {function} [opts.rng] générateur aléatoire (par défaut : Math.random)
 * @param {object} [opts.history] mémoire anti-répétition (voir createExpressHistory)
 */
export function generateExpressExercise({ deliveredCount = 0, rng = Math.random, history = createExpressHistory() } = {}) {
  const tier = getTierForDelivered(deliveredCount);
  const number = deliveredCount + 1;

  let chosen = null;
  let built = null;
  let client = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    chosen = chooseTemplate(rng, tier, history);
    client = pick(rng, CLIENTS);
    built = chosen.build({ rng, tier: tier.tier, client });
    if (!history.signatures.has(built.signature)) break;
  }

  history.templateIds.push(chosen.id);
  history.mechanics.push(chosen.mechanic);
  history.signatures.add(built.signature);

  const isDom = chosen.mechanic === 'dom';
  const {
    title,
    station,
    objective,
    orderText,
    hint,
    starterCode,
    solution,
    signature,
    ...engineFields
  } = built;

  const level = {
    id: number,
    chapter: CHAPTER_BY_MECHANIC[chosen.mechanic],
    express: true,
    tier: tier.tier,
    templateId: chosen.id,
    signature,
    title,
    mechanic: chosen.mechanic,
    station,
    objective,
    leo: {
      present: !isDom,
      messages: [isDom ? `Post-it de Léo : ${objective}` : objective],
      hints: [hint],
      success: pick(rng, SUCCESS_LINES)
    },
    starterCode,
    solution,
    ...engineFields
  };

  if (!isDom) {
    level.client = {
      name: client.name,
      avatar: client.avatar,
      orderText,
      dropZoneId: 'comptoir-client',
      dropZoneLabel: `Comptoir de ${client.name}`
    };
  }

  return level;
}
