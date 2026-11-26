/**
 * Logique pure (sans DOM) d'une partie de « Livraison Express » :
 * compte à rebours, pénalités, compteurs de livraisons et d'erreurs.
 *
 * L'horloge est injectable (`now`) pour pouvoir tester le chrono sans attendre.
 */

export const EXPRESS_CONFIG = Object.freeze({
  /** Durée d'une partie. Seule valeur à changer si 5 minutes se révèlent trop courtes. */
  durationMs: 5 * 60 * 1000,
  /** Temps perdu à chaque mauvaise réponse. */
  penaltyMs: 10 * 1000
});

export class ExpressSession {
  constructor({
    durationMs = EXPRESS_CONFIG.durationMs,
    penaltyMs = EXPRESS_CONFIG.penaltyMs,
    now = () => performance.now()
  } = {}) {
    this.durationMs = durationMs;
    this.penaltyMs = penaltyMs;
    this.now = now;

    this.state = 'idle'; // idle | running | paused | over
    this.delivered = 0;
    this.errors = 0;
    this.penaltyTotalMs = 0;

    this._elapsedMs = 0;
    this._segmentStart = null;
  }

  get isRunning() {
    return this.state === 'running';
  }

  get isPaused() {
    return this.state === 'paused';
  }

  get isOver() {
    return this.state === 'over';
  }

  /** Vrai tant que la partie est en cours (même en pause de transition). */
  get isActive() {
    return this.state === 'running' || this.state === 'paused';
  }

  start() {
    this.state = 'running';
    this.delivered = 0;
    this.errors = 0;
    this.penaltyTotalMs = 0;
    this._elapsedMs = 0;
    this._segmentStart = this.now();
  }

  /** Fige le chrono (animation de livraison entre deux colis). */
  pause() {
    if (this.state !== 'running') return;
    this._elapsedMs += this.now() - this._segmentStart;
    this._segmentStart = null;
    this.state = 'paused';
  }

  resume() {
    if (this.state !== 'paused') return;
    this._segmentStart = this.now();
    this.state = 'running';
  }

  /** Temps restant en millisecondes (jamais négatif). */
  get remainingMs() {
    const running = this._segmentStart === null ? 0 : this.now() - this._segmentStart;
    const used = this._elapsedMs + running + this.penaltyTotalMs;
    return Math.max(0, this.durationMs - used);
  }

  /** À appeler à chaque tick : passe en « over » quand le temps est écoulé. Renvoie true si terminé. */
  update() {
    if (this.state === 'running' && this.remainingMs <= 0) {
      this.finish();
    }
    return this.isOver;
  }

  finish() {
    if (this.state === 'over') return;
    if (this.state === 'running') {
      this._elapsedMs += this.now() - this._segmentStart;
    }
    this._segmentStart = null;
    this.state = 'over';
  }

  /** Bonne réponse : un colis de plus. */
  registerDelivery() {
    if (!this.isActive) return this.delivered;
    this.delivered += 1;
    return this.delivered;
  }

  /** Mauvaise réponse : une erreur et du temps perdu. Peut terminer la partie. */
  registerError() {
    if (!this.isActive) return this.errors;
    this.errors += 1;
    this.penaltyTotalMs += this.penaltyMs;
    if (this.remainingMs <= 0) this.finish();
    return this.errors;
  }

  summary() {
    return { delivered: this.delivered, errors: this.errors, penaltyMs: this.penaltyTotalMs };
  }
}

/** Formate des millisecondes en « m:ss » (arrondi à la seconde supérieure, comme un vrai compte à rebours). */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
