import { renderLeoSvg, renderPlayerSvg, renderClientSvg } from './svgAssets.js';

/**
 * Moteur d'animations physiques fluides :
 * - Léo (Chapitres 1 à 4) marche jusqu'au poste, saisit le colis dans ses bras,
 *   le transporte jusqu'au comptoir vertical, le dépose puis retourne à sa place.
 * - Notre PNJ joueur "TOI" (Chapitre 5 DOM, quand le code est valide) effectue
 *   les déplacements tapis roulant -> comptoir vertical en portant les colis.
 * - Lorsque la commande est validée, le client remercie dans sa bulle, s'avance
 *   au comptoir, prend le(s) colis dans ses bras et quitte la boutique avec !
 */

const THANK_YOU_PHRASES = [
  'Merci beaucoup !',
  'Parfait, merci !',
  'Super, à bientôt !',
  'Génial, bonne journée !'
];

/**
 * Facteur de vitesse global des animations (1 = Mode Histoire).
 * Le mode Livraison Express l'augmente pour que les livraisons restent vives.
 */
let animationSpeed = 1;

export function setAnimationSpeed(factor = 1) {
  animationSpeed = Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms / animationSpeed));
}

function getGameArea(scene) {
  return (scene && scene.elZoneJeu) || document.getElementById('zone-de-jeu') || document.body;
}

function getCenterRelative(el, container) {
  const safeContainer = container || document.getElementById('zone-de-jeu') || document.body;
  if (!el || typeof el.getBoundingClientRect !== 'function') {
    return { x: 0, y: 0, width: 64, height: 80, left: 0, right: 64, top: 0, bottom: 80 };
  }
  const r = el.getBoundingClientRect();
  const base = safeContainer.getBoundingClientRect();
  return {
    x: r.left - base.left + r.width / 2,
    y: r.top - base.top + r.height / 2,
    width: r.width,
    height: r.height,
    left: r.left - base.left,
    right: r.right - base.left,
    top: r.top - base.top,
    bottom: r.bottom - base.top
  };
}

/**
 * Crée un acteur animé sur le calque #calque-animation pouvant marcher,
 * se tourner gauche/droite et porter un ou plusieurs colis dans ses bras.
 */
class WalkingActor {
  constructor(scene, sourceEl, svgMarkup, { showBubbleText = null } = {}) {
    this.scene = scene;
    this.sourceEl = sourceEl;
    this.baseEl = scene.elZoneJeu || document.getElementById('zone-de-jeu');
    this.layer = scene.elCalqueAnim || document.getElementById('calque-animation');
    if (!this.layer && this.baseEl) {
      this.layer = document.createElement('div');
      this.layer.id = 'calque-animation';
      this.layer.className = 'calque-animation';
      this.layer.setAttribute('aria-hidden', 'true');
      this.baseEl.appendChild(this.layer);
    }

    const start = getCenterRelative(sourceEl, this.baseEl);
    this.home = { x: start.x, y: start.y };
    this.x = start.x;
    this.y = start.y;
    this.width = Math.max(58, start.width || 66);
    this.height = Math.max(70, start.height || 82);

    this.root = document.createElement('div');
    this.root.className = 'acteur-flottant';
    this.root.style.width = `${this.width}px`;
    this.root.style.height = `${this.height}px`;
    this.root.style.transform = `translate3d(${this.x - this.width / 2}px, ${this.y - this.height / 2}px, 0)`;

    if (showBubbleText) {
      const bubble = document.createElement('div');
      bubble.className = 'bulle bulle-client bulle-merci acteur-bulle-flottante';
      bubble.textContent = showBubbleText;
      this.root.appendChild(bubble);
    }

    this.sprite = document.createElement('div');
    this.sprite.className = 'acteur-sprite';
    this.sprite.innerHTML = svgMarkup;
    this.root.appendChild(this.sprite);

    this.carrySlot = document.createElement('div');
    this.carrySlot.className = 'acteur-colis-slot';
    this.root.appendChild(this.carrySlot);

    this.layer.appendChild(this.root);
    this.sourceEl.classList.add('acteur-en-deplacement');
  }

  async walkTo(targetX, targetY, { speedPxPerSec = 310, minMs = 260, maxMs = 760 } = {}) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 4) return;

    // Orienter le personnage dans le sens de sa marche
    if (dx < -4) {
      this.sprite.classList.add('orientation-gauche');
      this.carrySlot.classList.add('bras-gauche');
    } else if (dx > 4) {
      this.sprite.classList.remove('orientation-gauche');
      this.carrySlot.classList.remove('bras-gauche');
    }

    const duration = Math.round(Math.max(minMs, Math.min(maxMs, (dist / speedPxPerSec) * 1000)));
    this.root.classList.add('en-marche');
    this.root.style.transition = `transform ${Math.round(duration / animationSpeed)}ms cubic-bezier(0.42, 0.04, 0.58, 0.96)`;

    // Force reflow pour que la transition démarre proprement
    void this.root.offsetWidth;

    this.x = targetX;
    this.y = targetY;
    this.root.style.transform = `translate3d(${this.x - this.width / 2}px, ${this.y - this.height / 2}px, 0)`;

    await wait(duration + 25);
    this.root.classList.remove('en-marche');
  }

  pickUpVisual(parcelEl, extraCount = 0) {
    this.carrySlot.innerHTML = '';
    const clone = parcelEl.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.remove('colis-entree-tapis', 'colis-maj', 'colis-livre-pop', 'colis-scan');
    clone.classList.add('colis-porte');
    this.carrySlot.appendChild(clone);

    if (extraCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'colis-pile-badge';
      badge.textContent = `+${extraCount}`;
      this.carrySlot.appendChild(badge);
    }
  }

  dropVisual() {
    this.carrySlot.innerHTML = '';
  }

  async returnHome() {
    await this.walkTo(this.home.x, this.home.y, { speedPxPerSec: 340, minMs: 220, maxMs: 640 });
    this.sprite.classList.remove('orientation-gauche');
    this.destroy();
  }

  destroy(restoreSource = true) {
    this.root.remove();
    if (restoreSource && this.sourceEl) {
      this.sourceEl.classList.remove('acteur-en-deplacement');
    }
  }
}

export async function animateExecution(scene, level, result, validation, options = {}) {
  const isCancelled = options.isCancelled || (() => false);
  const deliveryZone = document.getElementById(
    level.client ? level.client.dropZoneId || 'comptoir-client' : 'comptoir-client'
  );

  if (typeof scene.clearAnimationLayer === 'function') {
    scene.clearAnimationLayer();
  } else {
    const layer = document.getElementById('calque-animation');
    if (layer) layer.innerHTML = '';
  }

  if (level.mechanic === 'variables') {
    await animateVariables(scene, level, result, deliveryZone, validation.passed, isCancelled);
    return;
  }

  if (level.mechanic === 'conditions') {
    await animateConditions(scene, level, result, deliveryZone, validation, isCancelled);
    return;
  }

  if (level.mechanic === 'loops') {
    await animateLoops(scene, level, result, deliveryZone, validation.passed, isCancelled);
    return;
  }

  if (level.mechanic === 'functions') {
    if (level.mode === 'return') {
      await animateVariables(
        scene,
        level,
        { vars: result.vars, events: result.varEvents || [] },
        deliveryZone,
        validation.passed,
        isCancelled
      );
    } else {
      await animateLoops(scene, level, result, deliveryZone, validation.passed, isCancelled);
    }
    return;
  }

  if (level.mechanic === 'dom') {
    await animateDomWithPlayer(scene, level, validation.passed, options.initialDomRects, isCancelled);
  }
}

/**
 * Calcule le point juste devant le comptoir côté atelier pour que Léo ou le joueur s'y arrête.
 */
function getCounterDropPoint(scene, dropZoneEl) {
  const z = getCenterRelative(dropZoneEl, getGameArea(scene));
  return { x: z.left - 28, y: z.y };
}

/**
 * Animation atomique : Léo marche jusqu'au tapis roulant, saisit UN colis précis,
 * le porte jusqu'au comptoir vertical, le dépose puis retourne à sa place.
 * Utilisée par la file d'attente live (sans jamais réinitialiser les autres colis !).
 */
export async function animateLeoDeliverSingleParcel(
  scene,
  parcelEl,
  deliveryZone,
  isCancelled = () => false,
  isStillValid = () => true
) {
  if (!parcelEl || !deliveryZone) return;
  const leoEl = scene.elLeo || document.getElementById('leo');
  const gameArea = getGameArea(scene);
  const leo = new WalkingActor(scene, leoEl, renderLeoSvg('normal'));

  try {
    const pRect = getCenterRelative(parcelEl, gameArea);
    await leo.walkTo(pRect.right + 28, pRect.y, { speedPxPerSec: 340, minMs: 240, maxMs: 580 });
    if (isCancelled() || !isStillValid()) return;

    leo.pickUpVisual(parcelEl);
    parcelEl.classList.add('colis-pris');
    await wait(130);
    if (isCancelled() || !isStillValid()) return;

    const counterPt = getCounterDropPoint(scene, deliveryZone);
    await leo.walkTo(counterPt.x, counterPt.y, { speedPxPerSec: 350, minMs: 250, maxMs: 600 });
    if (isCancelled() || !isStillValid()) return;

    leo.dropVisual();
    parcelEl.classList.remove('colis-pris', 'colis-entree-tapis');
    parcelEl.classList.add('colis-livre-pop');
    deliveryZone.appendChild(parcelEl);
    await wait(140);

    if (!isCancelled()) {
      await leo.returnHome();
    }
  } finally {
    if (!isStillValid() && parcelEl.parentNode) {
      parcelEl.remove();
    } else {
      parcelEl.classList.remove('colis-pris');
    }
    leo.destroy(true);
  }
}

/**
 * Animation atomique inverse : si l'élève retire leo(maVar) de son code,
 * Léo va reprendre le colis sur le comptoir vertical et le ramène sur le tapis roulant !
 */
export async function animateLeoReturnParcelToBelt(
  scene,
  parcelEl,
  beltZone,
  isCancelled = () => false,
  isStillValid = () => true
) {
  if (!parcelEl || !beltZone) return;
  const leoEl = scene.elLeo || document.getElementById('leo');
  const gameArea = getGameArea(scene);
  const leo = new WalkingActor(scene, leoEl, renderLeoSvg('normal'));

  try {
    const pRect = getCenterRelative(parcelEl, gameArea);
    await leo.walkTo(pRect.left - 28, pRect.y, { speedPxPerSec: 350, minMs: 220, maxMs: 560 });
    if (isCancelled() || !isStillValid()) return;

    leo.pickUpVisual(parcelEl);
    parcelEl.classList.add('colis-pris');
    await wait(120);
    if (isCancelled() || !isStillValid()) return;

    const beltRect = getCenterRelative(beltZone, gameArea);
    await leo.walkTo(beltRect.right + 28, beltRect.y, { speedPxPerSec: 350, minMs: 240, maxMs: 580 });
    if (isCancelled() || !isStillValid()) return;

    leo.dropVisual();
    parcelEl.classList.remove('colis-pris', 'colis-livre-pop');
    parcelEl.classList.add('colis-entree-tapis');
    beltZone.appendChild(parcelEl);
    await wait(130);

    if (!isCancelled()) {
      await leo.returnHome();
    }
  } finally {
    if (!isStillValid() && parcelEl.parentNode) {
      parcelEl.remove();
    } else {
      parcelEl.classList.remove('colis-pris');
    }
    leo.destroy(true);
  }
}

/**
 * Animation dédiée : Léo marche jusqu'au tapis roulant, saisit le colis mystère (?)
 * dans ses bras, marche jusqu'au Centre de tri et l'y dépose (zéro téléportation !).
 */
export async function animateMoveParcelToTri(scene, parcelEl, isCancelled = () => false) {
  if (!parcelEl || !scene.elZoneColisTri) return;
  const leoEl = scene.elLeo || document.getElementById('leo');
  const gameArea = getGameArea(scene);
  const leo = new WalkingActor(scene, leoEl, renderLeoSvg('normal'));

  try {
    const pRect = getCenterRelative(parcelEl, gameArea);
    await leo.walkTo(pRect.right + 28, pRect.y, { speedPxPerSec: 340, minMs: 240, maxMs: 580 });
    if (isCancelled()) return;

    leo.pickUpVisual(parcelEl);
    parcelEl.classList.add('colis-pris');
    await wait(120);

    const triRect = getCenterRelative(scene.elZoneColisTri, gameArea);
    await leo.walkTo(triRect.x, triRect.top - 14, { speedPxPerSec: 340, minMs: 240, maxMs: 560 });
    if (isCancelled()) return;

    leo.dropVisual();
    scene.elZoneColisTri.innerHTML = '';
    parcelEl.classList.remove('colis-pris', 'colis-entree-tapis');
    parcelEl.classList.add('colis-livre-pop');
    scene.elZoneColisTri.appendChild(parcelEl);
    await wait(120);

    if (!isCancelled()) {
      await leo.returnHome();
    }
  } finally {
    parcelEl.classList.remove('colis-pris');
    leo.destroy(true);
  }
}

/**
 * Chapitre 1 (Variables) & Chapitre 4 (return) :
 * Les colis apparaissent sur le tapis roulant, puis Léo ne livre au comptoir
 * QUE les colis demandés via leo(...) (ou en Chap. 4 mode return).
 */
async function animateVariables(scene, level, result, deliveryZone, passed, isCancelled) {
  scene.elZoneColisTapis.innerHTML = '';
  if (deliveryZone) deliveryZone.innerHTML = '';
  scene.elTapis.classList.add('tapis-actif');

  const parcelByName = new Map();
  const events =
    result.events && result.events.length > 0
      ? result.events
      : Object.entries(result.vars || {}).map(([name, value]) => ({
          name,
          value,
          kind: 'create'
        }));

  for (const ev of events) {
    if (isCancelled()) return;
    if (ev.kind === 'update' && parcelByName.has(ev.name)) {
      const existing = parcelByName.get(ev.name);
      const valSpan = existing.querySelector('.colis-valeur');
      if (valSpan) {
        valSpan.textContent = typeof ev.value === 'string' ? `"${ev.value}"` : String(ev.value);
      }
      existing.classList.remove('colis-maj');
      void existing.offsetWidth;
      existing.classList.add('colis-maj');
      await wait(300);
    } else {
      const parcel = scene.createParcelElement({
        id: `colis-var-${ev.name}`,
        tag: ev.name,
        value: ev.value,
        extraClass: 'colis-entree-tapis'
      });
      parcel.dataset.varName = ev.name;
      scene.elZoneColisTapis.appendChild(parcel);
      parcelByName.set(ev.name, parcel);
      await wait(240);
    }
  }

  scene.elTapis.classList.remove('tapis-actif');
  if (isCancelled()) return;

  // Au Chapitre 1, Léo ne livre que si leo(...) a été appelé !
  const requiresLeoCall = level.mechanic === 'variables';
  const leoCalls = result.leoCalls || [];

  if (deliveryZone && parcelByName.size > 0 && (!requiresLeoCall || leoCalls.length > 0)) {
    let namesToDeliver = [];
    if (requiresLeoCall) {
      const used = new Set();
      for (const calledVal of leoCalls) {
        const match = Object.entries(result.vars || {}).find(
          ([name, val]) => !used.has(name) && parcelByName.has(name) && val === calledVal
        );
        if (match) {
          used.add(match[0]);
          namesToDeliver.push(match[0]);
        }
      }
    } else if (level.expectedValues && level.expectedValues.length > 0 && result.vars) {
      const used = new Set();
      for (const expectedVal of level.expectedValues) {
        const match = Object.entries(result.vars).find(
          ([name, val]) => !used.has(name) && parcelByName.has(name) && val === expectedVal
        );
        if (match) {
          used.add(match[0]);
          namesToDeliver.push(match[0]);
        }
      }
      if (namesToDeliver.length === 0) namesToDeliver = [...parcelByName.keys()];
    } else {
      namesToDeliver = [...parcelByName.keys()];
    }

    if (namesToDeliver.length > 0) {
      const leoEl = scene.elLeo || document.getElementById('leo');
      const leo = new WalkingActor(scene, leoEl, renderLeoSvg('normal'));
      try {
        for (const name of namesToDeliver) {
          if (isCancelled()) return;
          const parcel = parcelByName.get(name);
          if (!parcel) continue;

          const pRect = getCenterRelative(parcel, getGameArea(scene));
          await leo.walkTo(pRect.right + 28, pRect.y);
          if (isCancelled()) return;

          // Léo saisit le colis
          leo.pickUpVisual(parcel);
          parcel.classList.add('colis-pris');
          await wait(140);

          // Léo porte le colis jusqu'au comptoir vertical
          const counterPt = getCounterDropPoint(scene, deliveryZone);
          await leo.walkTo(counterPt.x, counterPt.y);
          if (isCancelled()) return;

          // Pose réelle du colis sur le comptoir
          leo.dropVisual();
          parcel.classList.remove('colis-pris');
          parcel.classList.add('colis-livre-pop');
          deliveryZone.appendChild(parcel);
          await wait(160);
        }

        if (!isCancelled()) {
          await leo.returnHome();
        }
      } finally {
        leo.destroy(true);
      }
    }
  }

  if (isCancelled()) return;
  if (passed && deliveryZone) {
    await animateClientPickupAndLeave(scene, deliveryZone.id, level.client.avatar, isCancelled);
  } else {
    scene.setClientsMood('confused');
  }
}

/**
 * Chapitre 2 (Conditions if / else) :
 * Les 5 colis passent par le Centre de tri. Dès qu'un colis est conservé (feu vert),
 * Léo vient le chercher au Centre de tri, le porte jusqu'au comptoir et le dépose !
 */
async function animateConditions(scene, level, result, deliveryZone, validation, isCancelled) {
  const passed = validation.passed;
  const tagName = result.studentVarName || level.inputVar;

  if (typeof scene.setBugAlert === 'function') {
    scene.setBugAlert(true);
  }
  if (deliveryZone) deliveryZone.innerHTML = '';

  // Récupérer l'unique colis déjà dans le Centre de tri (ou sur le tapis), sinon le créer une seule fois
  let parcelEl =
    scene.elZoneColisTri.querySelector('.colis') ||
    scene.elZoneColisTapis.querySelector('.colis');

  if (!parcelEl) {
    scene.elZoneColisTapis.innerHTML = '';
    parcelEl = scene.createParcelElement({
      id: 'colis-tri-unique',
      tag: tagName,
      value: '?',
      extraClass: 'colis-mystere colis-entree-tapis',
      rawValue: true
    });
    scene.elZoneColisTapis.appendChild(parcelEl);
    await wait(200);
    if (isCancelled()) return;
  }

  // Cas 1 : code invalide avec parasite (ex. leo(colis) hors du if) -> UNE SEULE livraison avec valeur aléatoire !
  if (!passed && typeof validation.parasiteDelivered !== 'undefined') {
    const inTri = scene.elZoneColisTri.contains(parcelEl);
    const leoEl = scene.elLeo || document.getElementById('leo');
    const leo = new WalkingActor(scene, leoEl, renderLeoSvg('oops'));
    try {
      const pRect = getCenterRelative(parcelEl, getGameArea(scene));
      const pickupX = inTri ? pRect.x : pRect.right + 28;
      const pickupY = inTri ? pRect.top - 14 : pRect.y;
      await leo.walkTo(pickupX, pickupY, { speedPxPerSec: 340, minMs: 240, maxMs: 560 });
      if (isCancelled()) return;

      // Révèle la valeur parasite aléatoire !
      parcelEl.classList.remove('colis-mystere');
      const valSpan = parcelEl.querySelector('.colis-valeur');
      if (valSpan) {
        valSpan.textContent =
          typeof validation.parasiteDelivered === 'string'
            ? `"${validation.parasiteDelivered}"`
            : String(validation.parasiteDelivered);
      }
      leo.pickUpVisual(parcelEl);
      parcelEl.classList.add('colis-pris');
      await wait(150);

      if (deliveryZone) {
        const counterPt = getCounterDropPoint(scene, deliveryZone);
        await leo.walkTo(counterPt.x, counterPt.y, { speedPxPerSec: 340, minMs: 260, maxMs: 600 });
        if (isCancelled()) return;
        leo.dropVisual();
        parcelEl.classList.remove('colis-pris');
        parcelEl.classList.add('colis-livre-pop');
        deliveryZone.appendChild(parcelEl);
      }
      await leo.returnHome();
    } finally {
      parcelEl.classList.remove('colis-pris');
      leo.destroy(true);
    }

    scene.setClientsMood('confused');
    return;
  }

  // Cas 2 : Si le colis n'est pas encore dans le Centre de tri, Léo le déplace physiquement dedans
  if (!scene.elZoneColisTri.contains(parcelEl)) {
    await animateMoveParcelToTri(scene, parcelEl, isCancelled);
    if (isCancelled()) return;
  }

  // Cas 3 : Condition réussie -> le colis unique révèle sa bonne valeur au Centre de tri, feu vert, Léo livre au comptoir !
  if (passed) {
    const keptDecision = result.decisions.find((d) => d.expectedAction === 'keep');
    const finalVal = keptDecision ? keptDecision.value : '';

    parcelEl.classList.remove('colis-mystere', 'colis-entree-tapis');
    parcelEl.classList.add('colis-scan');
    const valSpan = parcelEl.querySelector('.colis-valeur');
    if (valSpan) {
      valSpan.textContent = typeof finalVal === 'string' ? `"${finalVal}"` : String(finalVal);
    }
    await wait(260);
    if (isCancelled()) return;

    scene.setSortingLights(true, false);
    parcelEl.classList.remove('colis-scan');
    parcelEl.classList.add('colis-conserve');
    await wait(200);
    if (isCancelled()) return;

    if (deliveryZone) {
      const leoEl = scene.elLeo || document.getElementById('leo');
      const leo = new WalkingActor(scene, leoEl, renderLeoSvg('happy'));
      try {
        const triRect = getCenterRelative(parcelEl, getGameArea(scene));
        await leo.walkTo(triRect.x, triRect.top - 16, { speedPxPerSec: 360, minMs: 210, maxMs: 500 });
        if (isCancelled()) return;

        leo.pickUpVisual(parcelEl);
        parcelEl.classList.add('colis-pris');
        await wait(120);

        const counterPt = getCounterDropPoint(scene, deliveryZone);
        await leo.walkTo(counterPt.x, counterPt.y, { speedPxPerSec: 360, minMs: 230, maxMs: 560 });
        if (isCancelled()) return;

        leo.dropVisual();
        parcelEl.classList.remove('colis-pris');
        parcelEl.classList.add('colis-livre-pop');
        deliveryZone.appendChild(parcelEl);
        await wait(140);

        await leo.returnHome();
      } finally {
        parcelEl.classList.remove('colis-pris');
        leo.destroy(true);
      }
    }

    scene.setSortingLights(false, false);
    if (typeof scene.setBugAlert === 'function') {
      scene.setBugAlert(false);
    }
    if (!isCancelled() && deliveryZone) {
      await animateClientPickupAndLeave(scene, deliveryZone.id, level.client.avatar, isCancelled);
    }
    return;
  }

  // Cas 4 : Autre erreur (ex. condition qui rejette le bon colis ou syntaxe manquante) -> voyant rouge bref
  scene.setSortingLights(false, true);
  await wait(320);
  scene.setSortingLights(false, false);
  scene.setClientsMood('confused');
}

/**
 * Chapitre 3 (Boucles for) & Chapitre 4 (Fonctions qui génèrent) :
 * Le Générateur produit la série de colis avec son compteur en direct,
 * puis Léo marche jusqu'au Générateur, saisit la pile de colis et la porte au comptoir !
 */
async function animateLoops(scene, level, result, deliveryZone, passed, isCancelled) {
  scene.elZoneColisGenerateur.innerHTML = '';
  if (deliveryZone) deliveryZone.innerHTML = '';
  scene.elGenerateur.classList.add('generateur-actif');

  const items = result.generated || [];
  const total = items.length;
  const delay = total > 6 ? 130 : 190;
  const producedParcels = [];

  for (let idx = 0; idx < items.length; idx++) {
    if (isCancelled()) return;
    const item = items[idx];
    scene.elGenerateurCompteur.textContent = `Tour ${idx + 1} / ${total}`;

    const parcel = scene.createParcelElement({
      id: `colis-gen-${idx + 1}`,
      tag: `#${idx + 1}`,
      value: item.value,
      extraClass: 'colis-genere'
    });

    scene.elZoneColisGenerateur.appendChild(parcel);
    producedParcels.push(parcel);
    await wait(delay);
  }

  scene.elGenerateurCompteur.textContent = total > 0 ? `${total} colis produits` : '0 colis';
  scene.elGenerateur.classList.remove('generateur-actif');
  if (isCancelled()) return;

  // Léo marche au Générateur, ramasse le lot et le transporte jusqu'au comptoir vertical !
  if (deliveryZone && producedParcels.length > 0) {
    const leoEl = scene.elLeo || document.getElementById('leo');
    const leo = new WalkingActor(scene, leoEl, renderLeoSvg('normal'));
    try {
      const genRect = getCenterRelative(scene.elZoneColisGenerateur, getGameArea(scene));
      await leo.walkTo(genRect.x, genRect.bottom + 14, { speedPxPerSec: 340, minMs: 240, maxMs: 560 });
      if (isCancelled()) return;

      // Saisit la pile de colis
      leo.pickUpVisual(producedParcels[0], producedParcels.length - 1);
      producedParcels.forEach((p) => p.classList.add('colis-pris'));
      await wait(160);

      // Marche jusqu'au comptoir vertical en portant la pile
      const counterPt = getCounterDropPoint(scene, deliveryZone);
      await leo.walkTo(counterPt.x, counterPt.y, { speedPxPerSec: 340, minMs: 280, maxMs: 650 });
      if (isCancelled()) return;

      // Pose tous les colis sur le comptoir
      leo.dropVisual();
      for (const p of producedParcels) {
        p.classList.remove('colis-pris');
        p.classList.add('colis-livre-pop');
        deliveryZone.appendChild(p);
      }
      await wait(180);

      await leo.returnHome();
    } finally {
      leo.destroy(true);
    }
  }

  if (isCancelled()) return;
  if (passed && deliveryZone) {
    await animateClientPickupAndLeave(scene, deliveryZone.id, level.client.avatar, isCancelled);
  } else {
    scene.setClientsMood('confused');
  }
}

/**
 * Chapitre 5 (DOM : id + appendChild) :
 * Léo est parti (ou regarde fièrement à l'ex 34) !
 * Quand le code DOM est valide, c'est NOTRE PNJ JOUEUR ("TOI") qui marche
 * jusqu'au tapis roulant, saisit chaque colis déplacé, le porte jusqu'au bon
 * emplacement du comptoir vertical et le dépose ! Puis chaque client repart avec son colis !
 */
async function animateDomWithPlayer(scene, level, passed, initialDomRects, isCancelled) {
  if (!passed) {
    // Code non valide : laisser le vrai DOM tel quel pour que l'élève puisse inspecter avec F12
    const movedParcels = document.querySelectorAll('.zone-client-depot .colis');
    movedParcels.forEach((p) => p.classList.add('colis-livre-pop'));
    scene.setClientsMood('confused');
    return;
  }

  const placements = level.expectedPlacements || [];

  // Masquer temporairement les vrais colis déjà déplacés dans le DOM pour jouer le transport par notre PNJ
  const parcelMeta = [];
  for (const pl of placements) {
    const parcelEl = document.getElementById(pl.parcelId);
    const targetEl = document.getElementById(pl.targetId);
    if (parcelEl && targetEl) {
      parcelEl.classList.add('colis-pris');
      const startPos =
        (initialDomRects && initialDomRects.get(pl.parcelId)) ||
        getCenterRelative(scene.elZoneColisTapis, getGameArea(scene));
      parcelMeta.push({ parcelEl, targetEl, startPos, targetId: pl.targetId });
    }
  }

  // Notre PNJ joueur ("TOI") effectue toutes les livraisons !
  const playerEl = scene.elJoueur || document.getElementById('joueur') || scene.elLeo;
  const player = new WalkingActor(scene, playerEl, renderPlayerSvg('happy'));
  try {
    for (const item of parcelMeta) {
      if (isCancelled()) return;

      // 1. Notre PNJ marche jusqu'au colis sur le tapis roulant
      await player.walkTo(item.startPos.x + 42, item.startPos.y, {
        speedPxPerSec: 340,
        minMs: 260,
        maxMs: 620
      });
      if (isCancelled()) return;

      // 2. Saisit le colis dans ses bras
      player.pickUpVisual(item.parcelEl);
      await wait(140);

      // 3. Marche jusqu'à la bonne zone sur le comptoir vertical
      const counterPt = getCounterDropPoint(scene, item.targetEl);
      await player.walkTo(counterPt.x, counterPt.y, {
        speedPxPerSec: 350,
        minMs: 280,
        maxMs: 650
      });
      if (isCancelled()) return;

      // 4. Pose le colis sur le comptoir (le vrai nœud DOM réapparaît avec un pop)
      player.dropVisual();
      item.parcelEl.classList.remove('colis-pris');
      item.parcelEl.classList.add('colis-livre-pop');
      await wait(160);
    }

    if (!isCancelled()) {
      await player.returnHome();
    }
  } finally {
    // Garantir que tous les vrais colis DOM sont visibles si annulé
    parcelMeta.forEach((item) => item.parcelEl.classList.remove('colis-pris'));
    player.destroy(true);
  }

  if (isCancelled()) return;

  // Chaque client servi remercie, prend son colis sur le comptoir et repart avec !
  const targets = level.domTargets || [];
  for (const target of targets) {
    if (isCancelled()) return;
    await animateClientPickupAndLeave(scene, target.id, target.avatar, isCancelled);
  }
}

/**
 * Le client sourit, remercie dans sa bulle, s'avance au comptoir vertical,
 * récupère son/ses colis dans ses bras et repart vers la droite en le portant !
 */
export async function animateClientPickupAndLeave(scene, targetZoneId, avatarKey, isCancelled) {
  const dropZone = document.getElementById(targetZoneId);
  const clientCard = scene.elZoneClients.querySelector(`.client-carte[data-target-id="${targetZoneId}"]`);
  if (!dropZone || !clientCard) return;

  const parcels = [...dropZone.querySelectorAll('.colis')];
  if (parcels.length === 0) return;

  const phrase = THANK_YOU_PHRASES[Math.floor(Math.random() * THANK_YOU_PHRASES.length)];
  if (typeof scene.setClientThankYou === 'function') {
    scene.setClientThankYou(targetZoneId, phrase);
  }
  await wait(320);
  if (isCancelled()) return;

  const gameArea = getGameArea(scene);
  const avatarWrap = clientCard.querySelector('.client-avatar-wrap') || clientCard;
  const zoneRect = getCenterRelative(dropZone, gameArea);
  const gameWidth = gameArea.getBoundingClientRect().width;

  const clientActor = new WalkingActor(scene, avatarWrap, renderClientSvg(avatarKey, 'happy'), {
    showBubbleText: phrase
  });

  // Masquer la carte client statique pendant que le client animé se déplace
  clientCard.classList.add('client-en-depart');

  try {
    // 1. Le client s'avance jusqu'au bord droit du comptoir
    await clientActor.walkTo(zoneRect.right + 34, zoneRect.y, {
      speedPxPerSec: 300,
      minMs: 260,
      maxMs: 580
    });
    if (isCancelled()) return;

    // 2. Le client prend le(s) colis dans ses bras
    clientActor.pickUpVisual(parcels[0], parcels.length - 1);
    parcels.forEach((p) => p.classList.add('colis-emporte'));
    await wait(200);
    if (isCancelled()) return;

    // 3. Le client se retourne et repart vers la sortie (droite) en portant son colis !
    await clientActor.walkTo(gameWidth + 70, zoneRect.y, {
      speedPxPerSec: 290,
      minMs: 420,
      maxMs: 780
    });
  } finally {
    clientActor.destroy(false);
  }
}
