import './styles/main.css';
import './styles/workshop.css';
import './styles/editor.css';
import './styles/express.css';

import { CHAPTERS } from './data/chapters.js';
import { LEVELS, getLevelById } from './data/levels.js';
import { loadProgress, saveProgress, markLevelCompleted, resetProgress } from './engine/storage.js';
import { runLevelCode, analyzeLiveCode } from './engine/runner.js';
import { validateLevelResult } from './engine/validator.js';
import { SceneRenderer } from './ui/sceneRenderer.js';
import {
  animateExecution,
  animateMoveParcelToTri,
  animateLeoDeliverSingleParcel,
  animateLeoReturnParcelToBelt,
  animateClientPickupAndLeave
} from './ui/animations.js';
import { EditorController } from './ui/editorController.js';
import { ModalManager } from './ui/levelModal.js';
import { ExpressController } from './ui/expressController.js';

class AtelierComptoirApp {
  constructor() {
    this.progress = loadProgress();
    this.currentLevel = getLevelById(this.progress.currentLevelId);
    this.runToken = 0;
    this.liveState = {
      timer: null,
      bugTriggered: false,
      movedToTri: false,
      movingToTri: false,
      lastAutoDeliveredCode: '',
      varMap: new Map(),
      deliveryQueue: [],
      isDelivering: false,
      levelWon: false
    };

    this.elEcranAccueil = document.getElementById('ecran-accueil');
    this.elEcranJeu = document.getElementById('ecran-jeu');

    // Accueil
    this.btnCommencer = document.getElementById('btn-commencer');
    this.btnAccueilNiveaux = document.getElementById('btn-accueil-niveaux');
    this.elAccueilProg = document.getElementById('accueil-progression');
    this.elAccueilProgTexte = document.getElementById('accueil-progression-texte');
    this.btnResetProg = document.getElementById('btn-reinitialiser-progression');

    // HUD
    this.elHudChapitre = document.getElementById('hud-chapitre');
    this.elHudTitre = document.getElementById('hud-niveau-titre');
    this.elHudBarre = document.getElementById('hud-progression-barre');
    this.elHudLabel = document.getElementById('hud-progression-label');
    this.btnMenu = document.getElementById('btn-menu');
    this.btnPrec = document.getElementById('btn-niveau-precedent');
    this.btnSuiv = document.getElementById('btn-niveau-suivant');
    this.btnOuvrirNiveaux = document.getElementById('btn-ouvrir-niveaux');
    this.btnPleinEcran = document.getElementById('btn-plein-ecran');

    this.scene = new SceneRenderer();
    this.modals = new ModalManager({
      onSelectLevel: (levelId) => {
        this.showGameScreen();
        this.loadLevel(levelId);
      },
      onNextLevel: () => {
        if (this.currentLevel.id < LEVELS.length) {
          this.loadLevel(this.currentLevel.id + 1);
        } else {
          this.modals.openLevels(this.progress);
        }
      }
    });

    this.editor = new EditorController({
      onRun: (code) => (this.express.inGame ? this.express.handleRun(code) : this.handleExecuteCode(code)),
      onCodeChange: (code) => {
        if (!this.express.inGame) this.scheduleLiveAnalysis(code);
      },
      onShowSolution: () => {
        if (!this.express.inGame) this.handleShowSolution();
      },
      onOpenMemento: () => this.modals.openMemento()
    });

    // Mode Livraison Express : réutilise scène, éditeur, runner, validateur et animations
    this.express = new ExpressController({
      scene: this.scene,
      editor: this.editor,
      getProgress: () => this.progress,
      onEnter: () => this.prepareExpressScreen(),
      onGoHome: () => this.goHome()
    });

    this.bindEvents();
    this.updateHomeScreen();
  }

  /** Coupe toute activité du Mode Histoire avant d'afficher l'écran de jeu en mode Express. */
  prepareExpressScreen() {
    this.runToken++;
    clearTimeout(this.liveState.timer);
    this.liveState.levelWon = true;
    this.liveState.deliveryQueue = [];
    this.showGameScreen();
  }

  goHome() {
    this.elEcranJeu.hidden = true;
    this.elEcranAccueil.hidden = false;
    this.updateHomeScreen();
  }

  bindEvents() {
    this.btnCommencer.addEventListener('click', () => {
      this.showGameScreen();
      this.loadLevel(this.progress.currentLevelId);
    });

    this.btnAccueilNiveaux.addEventListener('click', () => {
      this.modals.openLevels(this.progress);
    });

    this.btnResetProg.addEventListener('click', () => {
      if (window.confirm('Réinitialiser toute ta progression du Mode Histoire ?')) {
        this.progress = resetProgress();
        this.updateHomeScreen();
      }
    });

    this.btnMenu.addEventListener('click', () => {
      if (!this.express.confirmLeave()) return;
      this.express.leave();
      this.goHome();
    });

    this.btnOuvrirNiveaux.addEventListener('click', () => {
      this.modals.openLevels(this.progress);
    });

    this.btnPrec.addEventListener('click', () => {
      if (this.currentLevel.id > 1) {
        this.loadLevel(this.currentLevel.id - 1);
      }
    });

    this.btnSuiv.addEventListener('click', () => {
      if (this.currentLevel.id < LEVELS.length) {
        this.loadLevel(this.currentLevel.id + 1);
      }
    });

    this.btnPleinEcran.addEventListener('click', () => this.toggleFullscreen());
  }

  updateHomeScreen() {
    const done = this.progress.completedIds.length;
    if (done > 0 || this.progress.currentLevelId > 1) {
      this.btnCommencer.textContent = `Continuer (Exercice ${this.progress.currentLevelId})`;
      this.elAccueilProg.hidden = false;
      this.elAccueilProgTexte.textContent = `Progression sauvegardée : ${done} / ${LEVELS.length} exercices réussis.`;
    } else {
      this.btnCommencer.textContent = 'Commencer';
      this.elAccueilProg.hidden = true;
    }
    this.express.refreshHomeEntry();
  }

  showGameScreen() {
    this.elEcranAccueil.hidden = true;
    this.elEcranJeu.hidden = false;
  }

  loadLevel(levelId) {
    this.runToken++;
    clearTimeout(this.liveState.timer);
    this.liveState = {
      timer: null,
      bugTriggered: false,
      movedToTri: false,
      movingToTri: false,
      lastAutoDeliveredCode: '',
      varMap: new Map(),
      deliveryQueue: [],
      isDelivering: false,
      levelWon: false
    };

    const level = getLevelById(levelId);
    this.currentLevel = level;
    this.progress = { ...this.progress, currentLevelId: level.id };
    saveProgress(this.progress);

    this.editor.setRunning(false);
    this.updateHud();
    this.scene.renderLevel(level);
    this.editor.loadLevel(level);

    // Synchroniser immédiatement les variables déjà présentes dans le starterCode (ex. ex 6, 7, 8, 9)
    this.runLiveAnalysis(this.editor.getCode());
  }

  scheduleLiveAnalysis(code) {
    clearTimeout(this.liveState.timer);
    this.liveState.timer = setTimeout(() => {
      this.runLiveAnalysis(code);
    }, 750);
  }

  async runLiveAnalysis(code) {
    const level = this.currentLevel;
    if (!level || this.liveState.levelWon || this.express.inGame) return;
    if (level.mechanic !== 'variables' && level.mechanic !== 'conditions') return;

    const live = analyzeLiveCode(level, code);
    if (!live.valid) {
      // Code incomplet / faute en cours de frappe -> on ne touche rien et pas d'erreur agressive !
      return;
    }

    if (level.mechanic === 'variables') {
      this.syncLiveVariablesDiff(live);
      return;
    }

    if (this.editor.isRunning) return;

    if (level.mechanic === 'conditions') {
      const varNames = Object.keys(live.vars || {});

      if (varNames.length === 0) {
        // L'élève a supprimé sa variable -> retirer le colis et éteindre l'alerte
        this.scene.syncLiveVariables({}, { maskAsMystery: true });
        this.scene.elZoneColisTri.innerHTML = '';
        this.scene.setBugAlert(false);
        this.liveState.bugTriggered = false;
        this.liveState.movedToTri = false;
        return;
      }

      // Étape 2 : Dès qu'une variable est créée -> le colis apparaît avec "?" + sirène rouge + alerte Léo !
      if (!this.liveState.movedToTri) {
        this.scene.syncLiveVariables(live.vars, { maskAsMystery: true });
      }

      if (!this.liveState.bugTriggered) {
        this.liveState.bugTriggered = true;
        this.scene.setBugAlert(true);
        if (level.leo.bugMessage) {
          this.scene.setLeoReaction(level.leo.bugMessage, 'error');
        }
      }

      // Étape 3 : Dès qu'un bloc if (...) valide est écrit -> Léo déplace physiquement le colis "?" au Centre de tri !
      if (live.hasIf && !this.liveState.movedToTri && !this.liveState.movingToTri) {
        const mysteryParcel = this.scene.elZoneColisTapis.querySelector('.colis');
        if (mysteryParcel) {
          this.liveState.movingToTri = true;
          const myToken = this.runToken;
          await animateMoveParcelToTri(this.scene, mysteryParcel, () => myToken !== this.runToken);
          this.liveState.movingToTri = false;
          if (myToken !== this.runToken) return;
          this.liveState.movedToTri = true;
          if (level.leo.triMessage && !live.hasLeoCall) {
            this.scene.setLeoReaction(level.leo.triMessage, 'normal');
          }
        }
      }

      // Étape 4 : Dès que leo(...) est écrit dans un code exécutable -> lancer la livraison & vérification !
      if (live.hasLeoCall && code.trim() !== this.liveState.lastAutoDeliveredCode && !this.liveState.movingToTri) {
        this.liveState.lastAutoDeliveredCode = code.trim();
        this.handleExecuteCode(code);
      }
    }
  }

  /**
   * Synchronisation différentielle au Chapitre 1 :
   * - Ne touche JAMAIS aux colis dont la variable est inchangée.
   * - Si une variable déjà livrée au comptoir est modifiée, seul ce colis est recréé sur le tapis
   *   et ré-enfilé dans la file de Léo si leo(nom) est présent dans le code !
   * - Si Léo est occupé à livrer un colis, les nouveaux appels leo(colis2) s'ajoutent à sa file d'attente.
   */
  syncLiveVariablesDiff(live) {
    const varMap = this.liveState.varMap;
    const nextVars = live.vars || {};
    const nextNames = new Set(Object.keys(nextVars));

    const removeAllParcelsForVar = (varName) => {
      document.querySelectorAll(`.colis[data-var-name="${CSS.escape(varName)}"]`).forEach((node) => {
        node.remove();
      });
    };

    // 1. Retirer uniquement les variables supprimées du code (tapis ET comptoir)
    for (const [name, entry] of [...varMap.entries()]) {
      if (!nextNames.has(name)) {
        if (entry.el && entry.el.parentNode) {
          entry.el.remove();
        }
        removeAllParcelsForVar(name);
        varMap.delete(name);
        this.liveState.deliveryQueue = this.liveState.deliveryQueue.filter((q) => q.name !== name);
      }
    }

    // 2. Créer ou mettre à jour uniquement les variables nouvelles ou modifiées
    for (const [name, value] of Object.entries(nextVars)) {
      // Ne jamais créer ni livrer un colis NaN ou undefined (saisie en cours)
      if (typeof value === 'undefined' || (typeof value === 'number' && Number.isNaN(value))) {
        continue;
      }

      const existing = varMap.get(name);
      const displayVal = typeof value === 'string' ? `"${value}"` : String(value);

      if (!existing) {
        removeAllParcelsForVar(name);
        const el = this.scene.createParcelElement({
          id: `colis-var-${name}`,
          tag: name,
          value,
          extraClass: 'colis-entree-tapis'
        });
        el.dataset.varName = name;
        this.scene.elZoneColisTapis.appendChild(el);
        varMap.set(name, { value, location: 'tapis', el });
      } else if (existing.value !== value) {
        // La valeur de cette variable a changé !
        if (existing.location === 'tapis') {
          const valSpan = existing.el.querySelector('.colis-valeur');
          if (valSpan) valSpan.textContent = displayVal;
          existing.el.classList.remove('colis-maj');
          void existing.el.offsetWidth;
          existing.el.classList.add('colis-maj');
          existing.value = value;
        } else {
          // Déjà sur le comptoir ou en cours de livraison -> supprimer l'ancien PARTOUT (comptoir inclus)
          // et recréer uniquement celui-ci sur le tapis !
          if (existing.el && existing.el.parentNode) {
            existing.el.remove();
          }
          removeAllParcelsForVar(name);
          const el = this.scene.createParcelElement({
            id: `colis-var-${name}`,
            tag: name,
            value,
            extraClass: 'colis-entree-tapis'
          });
          el.dataset.varName = name;
          this.scene.elZoneColisTapis.appendChild(el);
          varMap.set(name, { value, location: 'tapis', el });
        }
      }
    }

    // 3. Synchroniser la file d'attente de Léo :
    //    - leo(nom) présent + colis sur le tapis -> livrer au comptoir
    //    - leo(nom) retiré + colis sur le comptoir -> ramener du comptoir vers le tapis roulant !
    const requestedNames = new Set(live.leoArgNames || []);
    if (requestedNames.size === 0 && (live.leoCalls || []).length > 0) {
      for (const calledVal of live.leoCalls) {
        for (const [name, entry] of varMap.entries()) {
          if (entry.value === calledVal) {
            requestedNames.add(name);
            break;
          }
        }
      }
    }

    const enqueueAction = (type, name) => {
      // Retirer une éventuelle action opposée en attente pour cette même variable
      this.liveState.deliveryQueue = this.liveState.deliveryQueue.filter(
        (q) => !(q.name === name && q.type !== type)
      );
      const exists = this.liveState.deliveryQueue.some((q) => q.name === name && q.type === type);
      if (!exists) {
        this.liveState.deliveryQueue.push({ type, name });
      }
    };

    // D'abord ramener au tapis les colis qui ne sont plus appelés par leo(...)
    for (const [name, entry] of varMap.entries()) {
      if (!requestedNames.has(name) && (entry.location === 'comptoir' || entry.location === 'delivering')) {
        enqueueAction('return', name);
      }
    }

    // Ensuite livrer les colis demandés par leo(...) qui attendent sur le tapis
    for (const name of requestedNames) {
      const entry = varMap.get(name);
      if (entry && (entry.location === 'tapis' || entry.location === 'returning')) {
        enqueueAction('deliver', name);
      }
    }

    if (this.liveState.deliveryQueue.length > 0 && !this.liveState.isDelivering) {
      this.processLiveDeliveryQueue();
    }
  }

  async processLiveDeliveryQueue() {
    if (this.liveState.isDelivering) return;
    this.liveState.isDelivering = true;

    const myToken = this.runToken;
    const isCancelled = () => myToken !== this.runToken;
    const level = this.currentLevel;
    const deliveryZone = document.getElementById(
      level.client ? level.client.dropZoneId || 'comptoir-client' : 'comptoir-client'
    );

    try {
      while (this.liveState.deliveryQueue.length > 0) {
        if (isCancelled()) return;
        const task = this.liveState.deliveryQueue.shift();
        const entry = this.liveState.varMap.get(task.name);
        if (!entry || !entry.el || !entry.el.isConnected) {
          continue;
        }

        const parcelEl = entry.el;
        const isStillValid = () => {
          const latest = this.liveState.varMap.get(task.name);
          return Boolean(latest && latest.el === parcelEl);
        };

        if (task.type === 'return') {
          if (entry.location !== 'comptoir') continue;
          entry.location = 'returning';
          await animateLeoReturnParcelToBelt(
            this.scene,
            parcelEl,
            this.scene.elZoneColisTapis,
            isCancelled,
            isStillValid
          );
          if (isCancelled()) return;
          if (isStillValid()) {
            entry.location = 'tapis';
          }
        } else if (task.type === 'deliver') {
          if (entry.location !== 'tapis') continue;
          entry.location = 'delivering';
          await animateLeoDeliverSingleParcel(this.scene, parcelEl, deliveryZone, isCancelled, isStillValid);
          if (isCancelled()) return;
          if (isStillValid()) {
            entry.location = 'comptoir';
          }
        }
      }

      if (isCancelled()) return;

      // File vide : vérifier si la commande complète est maintenant valide !
      const latestCode = this.editor.getCode();
      const result = runLevelCode(level, latestCode, { doc: document });
      if (!result.ok) return;

      const validation = validateLevelResult(level, result);
      this.editor.clearConsole();
      this.logExecutionTrace(level, result);

      if (validation.passed) {
        this.liveState.levelWon = true;
        this.editor.setStatus('Réussi !', 'ok');
        this.editor.logSuccess(validation.feedback);
        this.scene.setLeoReaction(validation.feedback, 'success');

        if (deliveryZone) {
          await animateClientPickupAndLeave(this.scene, deliveryZone.id, level.client.avatar, isCancelled);
        }
        if (isCancelled()) return;

        this.progress = markLevelCompleted(this.progress, level.id);
        this.updateHud();

        const isLast = level.id === LEVELS.length;
        setTimeout(() => {
          if (!isCancelled()) {
            this.modals.openVictory(level, isLast);
          }
        }, 320);
      } else {
        this.editor.setStatus('En cours', 'idle');
        this.editor.logInfo(validation.feedback);
        this.scene.setLeoReaction(validation.feedback, 'normal');
        this.scene.setClientsMood('confused');
      }
    } finally {
      if (!isCancelled()) {
        this.liveState.isDelivering = false;
        // Si de nouvelles livraisons ont été ajoutées juste à la toute fin, les traiter aussitôt
        if (this.liveState.deliveryQueue.length > 0 && !this.liveState.levelWon) {
          this.processLiveDeliveryQueue();
        }
      }
    }
  }

  updateHud() {
    const chapter = CHAPTERS.find((c) => c.id === this.currentLevel.chapter);
    this.elHudChapitre.textContent = chapter ? `Chap. ${chapter.id} · ${chapter.shortTitle}` : '';
    this.elHudTitre.textContent = `${this.currentLevel.id}. ${this.currentLevel.title}`;

    const doneCount = this.progress.completedIds.length;
    const pct = Math.round((doneCount / LEVELS.length) * 100);
    this.elHudBarre.style.width = `${pct}%`;
    this.elHudLabel.textContent = `${doneCount} / ${LEVELS.length}`;

    this.btnPrec.disabled = this.currentLevel.id <= 1;
    this.btnSuiv.disabled = this.currentLevel.id >= LEVELS.length;
  }

  handleShowSolution() {
    if (!this.currentLevel) return;
    this.editor.setCode(this.currentLevel.solution);
    this.editor.logInfo('Corrigé chargé dans la zone de code. Lis-le bien puis clique sur Exécuter !');
    this.scene.setLeoReaction(
      'Voici le corrigé ! Prends un instant pour le lire attentivement, puis clique sur Exécuter pour le voir en action.',
      'normal'
    );
  }

  async handleExecuteCode(code) {
    const level = this.currentLevel;
    const myToken = ++this.runToken;
    const isCancelled = () => myToken !== this.runToken;

    this.editor.setRunning(true);
    this.editor.clearConsole();
    this.editor.setStatus('Exécution...', 'idle');

    try {
      // En mode DOM, on remet les colis sur le tapis puis on enregistre leurs positions de départ
      let initialDomRects = null;
      if (level.mechanic === 'dom') {
        this.scene.resetDomBeforeRun();
        initialDomRects =
          typeof this.scene.captureDomParcelRects === 'function'
            ? this.scene.captureDomParcelRects()
            : captureDomParcelRectsFallback(level);
      }

      const result = runLevelCode(level, code, { doc: document });

      if (!result.ok) {
        this.editor.setStatus('Erreur', 'err');
        this.editor.logError(result.error);
        this.scene.setLeoReaction(result.error, 'error');
        this.scene.setClientsMood('confused');
        return;
      }

      const validation = validateLevelResult(level, result);

      // Journaliser le détail pédagogique
      this.logExecutionTrace(level, result);

      // Animer les déplacements réels (Léo en chap. 1-4, notre PNJ joueur en chap. 5 DOM, puis départ client)
      await animateExecution(this.scene, level, result, validation, {
        initialDomRects,
        isCancelled
      });

      if (isCancelled()) return;

      if (validation.passed) {
        this.editor.setStatus('Réussi !', 'ok');
        this.editor.logSuccess(validation.feedback);
        this.scene.setLeoReaction(validation.feedback, 'success');

        this.progress = markLevelCompleted(this.progress, level.id);
        this.updateHud();

        const isLast = level.id === LEVELS.length;
        setTimeout(() => {
          if (!isCancelled()) {
            this.modals.openVictory(level, isLast);
          }
        }, 320);
      } else {
        this.editor.setStatus('À corriger', 'err');
        this.editor.logError(validation.feedback);
        this.scene.setLeoReaction(validation.feedback, 'error');
        this.scene.setClientsMood('confused');
      }
    } catch (unexpectedErr) {
      // Sécurité absolue : ne jamais planter l'application
      this.editor.setStatus('Erreur', 'err');
      this.editor.logError('Une erreur inattendue a été interceptée : ' + String(unexpectedErr.message || unexpectedErr));
    } finally {
      if (!isCancelled()) {
        this.editor.setRunning(false);
      }
    }
  }

  logExecutionTrace(level, result) {
    if (level.mechanic === 'variables') {
      const entries = Object.entries(result.vars || {});
      if (entries.length === 0) {
        this.editor.logInfo('Aucune variable var détectée.');
      } else {
        for (const [k, v] of entries) {
          const valStr = typeof v === 'string' ? `"${v}"` : String(v);
          this.editor.logInfo(`Tapis roulant → var ${k} = ${valStr}`);
        }
      }
    } else if (level.mechanic === 'conditions') {
      for (const dec of result.decisions) {
        const valStr = typeof dec.value === 'string' ? `"${dec.value}"` : String(dec.value);
        const label =
          dec.actualAction === 'keep'
            ? 'CONSERVÉ ✓'
            : dec.actualAction === 'delete'
              ? 'SUPPRIMÉ ✕'
              : 'AUCUNE ACTION';
        this.editor.logInfo(`Centre de tri (${level.inputVar} = ${valStr}) → ${label}`);
      }
    } else if (level.mechanic === 'loops') {
      const list = result.generated.map((g) => (typeof g.value === 'string' ? `"${g.value}"` : String(g.value)));
      this.editor.logInfo(`Générateur → ${list.length} colis produits : [${list.join(', ')}]`);
    } else if (level.mechanic === 'functions') {
      if (level.mode === 'generate') {
        const list = result.generated.map((g) => (typeof g.value === 'string' ? `"${g.value}"` : String(g.value)));
        this.editor.logInfo(`Colis générés par ta fonction : [${list.join(', ')}]`);
      } else {
        for (const [k, v] of Object.entries(result.vars || {})) {
          const valStr = typeof v === 'string' ? `"${v}"` : String(v);
          this.editor.logInfo(`Résultat → var ${k} = ${valStr}`);
        }
      }
    } else if (level.mechanic === 'dom') {
      this.editor.logInfo(`DOM → ${result.getByIdCount} appel(s) à getElementById détecté(s).`);
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }
}

function captureDomParcelRectsFallback(level) {
  const map = new Map();
  const baseEl = document.getElementById('zone-de-jeu');
  if (!baseEl || !level || !level.domParcels) return map;
  const baseRect = baseEl.getBoundingClientRect();
  for (const p of level.domParcels) {
    const el = document.getElementById(p.id);
    if (el) {
      const r = el.getBoundingClientRect();
      map.set(p.id, {
        x: r.left - baseRect.left + r.width / 2,
        y: r.top - baseRect.top + r.height / 2
      });
    }
  }
  return map;
}

function bootApp() {
  new AtelierComptoirApp();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.location.reload();
  });
}
