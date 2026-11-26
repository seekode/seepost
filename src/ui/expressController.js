import { generateExpressExercise, createExpressHistory, getTierForDelivered, MECHANIC_LABELS } from '../data/expressExercises.js';
import { ExpressSession, EXPRESS_CONFIG, formatClock } from '../engine/expressSession.js';
import { runLevelCode } from '../engine/runner.js';
import { validateLevelResult } from '../engine/validator.js';
import { isExpressUnlocked, loadExpressRecord, saveExpressResult } from '../engine/storage.js';
import { animateExecution, setAnimationSpeed } from './animations.js';

/** Les animations de livraison du Mode Histoire sont accélérées pour garder du rythme. */
const ANIMATION_SPEED = 2.4;
/** Durée maximale (réelle) d'une animation de livraison : au-delà, on passe au colis suivant. */
const MAX_ANIMATION_MS = 2600;
const STORY_TOTAL = 40;

const $ = (id) => document.getElementById(id);

/**
 * Pilote le mode « Livraison Express » en réutilisant la scène, l'éditeur, le runner,
 * le validateur et les animations du Mode Histoire. Ne touche jamais à la progression de l'Histoire.
 */
export class ExpressController {
  constructor({ scene, editor, getProgress, onEnter, onGoHome }) {
    this.scene = scene;
    this.editor = editor;
    this.getProgress = getProgress;
    this.onEnter = onEnter;
    this.onGoHome = onGoHome;

    this.session = null;
    this.history = null;
    this.level = null;
    this.inGame = false;
    this.token = 0;
    this.timerId = null;
    this.introFromGame = false;
    this.lastClockText = '';

    // Accueil
    this.btnHome = $('btn-accueil-express');
    this.homeStatus = $('accueil-express-statut');
    this.homeLock = $('accueil-express-cadenas');

    // Écran de jeu
    this.root = $('ecran-jeu');
    this.hud = $('express-hud');
    this.elChrono = $('express-chrono');
    this.elLivres = $('express-livres');
    this.elErreurs = $('express-erreurs');
    this.elRecord = $('express-record');
    this.elPenalite = $('express-penalite');
    this.elBarre = $('express-barre-remplissage');
    this.elHudChapitre = $('hud-chapitre');
    this.elHudTitre = $('hud-niveau-titre');

    // Modales
    this.modalIntro = $('modale-express-intro');
    this.modalBilan = $('modale-express-bilan');

    $('express-regle-duree').textContent = this.formatDuration(EXPRESS_CONFIG.durationMs);
    $('express-regle-penalite').textContent = `${Math.round(EXPRESS_CONFIG.penaltyMs / 1000)} secondes`;

    this.btnHome.addEventListener('click', () => this.handleHomeClick());
    $('btn-express-demarrer').addEventListener('click', () => this.start());
    $('btn-fermer-express-intro').addEventListener('click', () => this.closeIntro());
    $('btn-express-rejouer').addEventListener('click', () => {
      this.modalBilan.hidden = true;
      this.openIntro(true);
    });
    $('btn-express-accueil').addEventListener('click', () => {
      this.modalBilan.hidden = true;
      this.leave();
      this.onGoHome();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modalIntro.hidden) this.closeIntro();
    });
  }

  formatDuration(ms) {
    const min = Math.floor(ms / 60000);
    const sec = Math.round((ms % 60000) / 1000);
    if (min > 0 && sec === 0) return `${min} minute${min > 1 ? 's' : ''}`;
    return `${Math.round(ms / 1000)} secondes`;
  }

  /* ---------- Entrée du menu principal ---------- */

  refreshHomeEntry() {
    const progress = this.getProgress();
    const unlocked = isExpressUnlocked(progress);
    const record = loadExpressRecord();

    this.btnHome.classList.toggle('verrouille', !unlocked);
    this.btnHome.setAttribute('aria-disabled', String(!unlocked));
    this.homeLock.hidden = unlocked;

    if (!unlocked) {
      const done = Math.min(STORY_TOTAL, progress.completedIds.length);
      this.homeStatus.textContent = `Verrouillé : termine les ${STORY_TOTAL} exercices du Mode Histoire (${done} / ${STORY_TOTAL})`;
    } else if (record.bestDelivered > 0) {
      this.homeStatus.textContent = `Record : ${record.bestDelivered} colis livrés`;
    } else {
      this.homeStatus.textContent = `${this.formatDuration(EXPRESS_CONFIG.durationMs)} pour livrer un maximum de colis !`;
    }
  }

  handleHomeClick() {
    if (!isExpressUnlocked(this.getProgress())) {
      this.btnHome.classList.remove('secousse');
      void this.btnHome.offsetWidth;
      this.btnHome.classList.add('secousse');
      return;
    }
    this.openIntro(false);
  }

  openIntro(fromGame) {
    this.introFromGame = fromGame;
    const record = loadExpressRecord();
    $('express-intro-record').textContent =
      record.bestDelivered > 0 ? `${record.bestDelivered} colis` : 'Aucune partie jouée';
    this.modalIntro.hidden = false;
    $('btn-express-demarrer').focus();
  }

  closeIntro() {
    this.modalIntro.hidden = true;
    if (this.introFromGame) {
      this.leave();
      this.onGoHome();
    }
  }

  /* ---------- Partie ---------- */

  start() {
    if (!isExpressUnlocked(this.getProgress())) return;
    this.modalIntro.hidden = true;
    clearInterval(this.timerId);
    this.token++;

    this.onEnter();
    this.inGame = true;
    this.history = createExpressHistory();
    this.session = new ExpressSession();

    this.root.classList.add('mode-express');
    this.hud.hidden = false;
    setAnimationSpeed(ANIMATION_SPEED);
    this.editor.textarea.readOnly = false;

    this.updateCounters();
    this.loadNextExercise();
    this.session.start();
    this.lastClockText = '';
    this.renderClock();
    this.timerId = setInterval(() => this.tick(), 100);
  }

  loadNextExercise() {
    const delivered = this.session.delivered;
    const level = generateExpressExercise({ deliveredCount: delivered, history: this.history });
    this.level = level;

    this.scene.renderLevel(level);
    this.editor.loadLevel(level);
    this.editor.setRunning(false);
    this.editor.objectiveEl.title = level.objective;

    const tier = getTierForDelivered(delivered);
    this.elHudChapitre.textContent = `Express · Palier ${tier.tier} · ${tier.label}`;
    this.elHudTitre.textContent = `Colis n°${level.id} · ${MECHANIC_LABELS[level.mechanic]} — ${level.title}`;
  }

  tick() {
    if (!this.session) return;
    if (this.session.update()) {
      this.endGame();
      return;
    }
    this.renderClock();
  }

  renderClock() {
    const s = this.session;
    const remaining = s.remainingMs;
    const text = formatClock(remaining);
    if (text !== this.lastClockText) {
      this.elChrono.textContent = text;
      this.lastClockText = text;
    }
    this.elChrono.classList.toggle('urgent', remaining <= 30000);
    this.elChrono.classList.toggle('en-pause', s.isPaused);
    this.elBarre.classList.toggle('urgent', remaining <= 30000);
    this.elBarre.style.width = `${(remaining / s.durationMs) * 100}%`;
  }

  updateCounters() {
    const s = this.session;
    this.elLivres.textContent = String(s.delivered);
    this.elErreurs.textContent = String(s.errors);
    const record = loadExpressRecord();
    this.elRecord.textContent = String(Math.max(record.bestDelivered, s.delivered));
  }

  /** Appelé par l'éditeur (Exécuter / Ctrl+Entrée) quand le mode Express est actif. */
  async handleRun(code) {
    const s = this.session;
    if (!this.inGame || !s || !s.isRunning) return;
    if (s.update()) {
      this.endGame();
      return;
    }

    const level = this.level;
    const editor = this.editor;
    const scene = this.scene;

    if (!code.trim()) {
      editor.setStatus('Vide', 'err');
      editor.logError('La zone de code est vide ! Écris ton code puis clique sur Exécuter.');
      return;
    }

    editor.clearConsole();

    let initialDomRects = null;
    if (level.mechanic === 'dom') {
      scene.resetDomBeforeRun();
      initialDomRects = scene.captureDomParcelRects();
    }

    let result;
    let validation;
    try {
      result = runLevelCode(level, code, { doc: document });
      validation = validateLevelResult(level, result);
    } catch (err) {
      result = { ok: false };
      validation = { passed: false, feedback: `Erreur inattendue : ${String(err && err.message ? err.message : err)}` };
    }

    if (!validation.passed) {
      this.handleWrongAnswer(validation.feedback);
      return;
    }

    // Bonne réponse : le colis est validé, le chrono se fige le temps de la livraison.
    s.registerDelivery();
    s.pause();
    this.renderClock();
    this.updateCounters();
    editor.setRunning(true);
    editor.setStatus('Livré !', 'ok');
    editor.logSuccess(validation.feedback);
    scene.setLeoReaction(validation.feedback, 'success');

    const myToken = ++this.token;
    let skip = false;
    const skipTimer = setTimeout(() => {
      skip = true;
    }, MAX_ANIMATION_MS);
    try {
      await animateExecution(scene, level, result, validation, {
        initialDomRects,
        isCancelled: () => skip || myToken !== this.token
      });
    } catch {
      // Une animation ratée ne doit jamais bloquer la partie
    } finally {
      clearTimeout(skipTimer);
    }

    if (myToken !== this.token || !this.inGame) return;
    s.resume();
    this.loadNextExercise();
    this.renderClock();
  }

  handleWrongAnswer(feedback) {
    const s = this.session;
    s.registerError();
    this.updateCounters();

    this.editor.setStatus('À corriger', 'err');
    this.editor.logError(feedback);
    this.scene.setLeoReaction(feedback, 'error');
    this.scene.setClientsMood('confused');
    if (this.level.mechanic === 'dom') {
      this.scene.resetDomBeforeRun();
    }
    this.showPenalty();

    if (s.isOver) {
      this.endGame();
    } else {
      this.renderClock();
    }
  }

  showPenalty() {
    const secs = Math.round(this.session.penaltyMs / 1000);
    this.elPenalite.textContent = `−${secs} s`;
    this.elPenalite.classList.remove('visible');
    void this.elPenalite.offsetWidth;
    this.elPenalite.classList.add('visible');
    this.elChrono.classList.remove('secousse');
    void this.elChrono.offsetWidth;
    this.elChrono.classList.add('secousse');
  }

  endGame() {
    const s = this.session;
    if (!s) return;
    clearInterval(this.timerId);
    this.timerId = null;
    this.token++; // annule une éventuelle animation en cours
    s.finish();
    this.renderClock();
    this.scene.clearAnimationLayer();

    this.editor.setRunning(true);
    this.editor.textarea.readOnly = true;
    this.editor.setStatus('Terminé', 'idle');

    const { delivered, errors } = s.summary();
    const { record, isNewRecord } = saveExpressResult({ delivered, errors });

    $('express-bilan-livres').textContent = String(delivered);
    $('express-bilan-erreurs').textContent = String(errors);
    $('express-bilan-record').textContent = String(record.bestDelivered);
    $('express-bilan-badge').hidden = !isNewRecord;
    $('express-bilan-message').textContent = this.buildBilanMessage(delivered, errors, isNewRecord, record);
    this.elRecord.textContent = String(record.bestDelivered);

    this.modalBilan.hidden = false;
    $('btn-express-rejouer').focus();
  }

  buildBilanMessage(delivered, errors, isNewRecord, record) {
    if (delivered === 0) return 'Aucun colis livré cette fois-ci. Relis bien la consigne et retente ta chance !';
    if (isNewRecord) return 'Tu viens de battre ton meilleur score. Peux-tu faire encore mieux ?';
    const gap = record.bestDelivered - delivered;
    if (gap === 0) return 'Tu égales ton record ! Un colis de plus pour le battre.';
    return `Plus que ${gap} colis pour battre ton record de ${record.bestDelivered}.`;
  }

  /* ---------- Sortie ---------- */

  /** Une partie est en cours (le chrono tourne) : quitter fait perdre le score. */
  get isPlaying() {
    return this.inGame && Boolean(this.session) && this.session.isActive;
  }

  confirmLeave() {
    if (!this.isPlaying) return true;
    return window.confirm('Quitter la partie en cours ? Ton score ne sera pas enregistré.');
  }

  /** Remet l'interface du Mode Histoire (sans toucher à sa progression). */
  leave() {
    clearInterval(this.timerId);
    this.timerId = null;
    this.token++;
    this.inGame = false;
    this.session = null;
    setAnimationSpeed(1);
    this.scene.clearAnimationLayer();
    this.root.classList.remove('mode-express');
    this.hud.hidden = true;
    this.editor.textarea.readOnly = false;
    this.editor.setRunning(false);
    this.modalIntro.hidden = true;
    this.modalBilan.hidden = true;
  }
}
