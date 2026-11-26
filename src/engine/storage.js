const STORAGE_KEY = 'atelier_comptoir_progression_v1';

const DEFAULT_STATE = {
  currentLevelId: 1,
  completedIds: []
};

function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function loadProgress() {
  if (!hasLocalStorage()) {
    return { ...DEFAULT_STATE, completedIds: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, completedIds: [] };
    const parsed = JSON.parse(raw);
    const completedIds = Array.isArray(parsed.completedIds)
      ? [...new Set(parsed.completedIds.filter((n) => Number.isInteger(n) && n >= 1 && n <= 40))]
      : [];
    const currentLevelId =
      Number.isInteger(parsed.currentLevelId) && parsed.currentLevelId >= 1 && parsed.currentLevelId <= 40
        ? parsed.currentLevelId
        : 1;
    return { currentLevelId, completedIds };
  } catch {
    return { ...DEFAULT_STATE, completedIds: [] };
  }
}

export function saveProgress(state) {
  if (!hasLocalStorage()) return;
  try {
    const payload = {
      currentLevelId: state.currentLevelId,
      completedIds: [...new Set(state.completedIds)]
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function markLevelCompleted(state, levelId) {
  const completedIds = state.completedIds.includes(levelId)
    ? state.completedIds
    : [...state.completedIds, levelId].sort((a, b) => a - b);
  const nextState = {
    currentLevelId: levelId,
    completedIds
  };
  saveProgress(nextState);
  return nextState;
}

export function resetProgress() {
  const fresh = { ...DEFAULT_STATE, completedIds: [] };
  if (hasLocalStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  return fresh;
}

/* ------------------------------------------------------------------ */
/* Mode « Livraison Express »                                          */
/* Clé de sauvegarde SÉPARÉE : la progression du Mode Histoire n'est    */
/* jamais lue ni modifiée par ce mode.                                  */
/* ------------------------------------------------------------------ */

const EXPRESS_STORAGE_KEY = 'atelier_comptoir_express_v1';
const STORY_TOTAL_LEVELS = 40;

/** Le mode Express se débloque uniquement quand les 40 exercices du Mode Histoire sont réussis. */
export function isExpressUnlocked(progress) {
  const done = new Set(progress && Array.isArray(progress.completedIds) ? progress.completedIds : []);
  for (let id = 1; id <= STORY_TOTAL_LEVELS; id++) {
    if (!done.has(id)) return false;
  }
  return true;
}

const EMPTY_EXPRESS_RECORD = { bestDelivered: 0, bestErrors: 0, gamesPlayed: 0 };

export function loadExpressRecord() {
  if (!hasLocalStorage()) return { ...EMPTY_EXPRESS_RECORD };
  try {
    const raw = window.localStorage.getItem(EXPRESS_STORAGE_KEY);
    if (!raw) return { ...EMPTY_EXPRESS_RECORD };
    const parsed = JSON.parse(raw);
    const toCount = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    return {
      bestDelivered: toCount(parsed.bestDelivered),
      bestErrors: toCount(parsed.bestErrors),
      gamesPlayed: toCount(parsed.gamesPlayed)
    };
  } catch {
    return { ...EMPTY_EXPRESS_RECORD };
  }
}

/**
 * Enregistre le résultat d'une partie terminée.
 * Un record = plus de colis livrés, ou autant de colis avec moins d'erreurs.
 */
export function saveExpressResult({ delivered, errors }) {
  const previous = loadExpressRecord();
  const isNewRecord =
    delivered > 0 &&
    (delivered > previous.bestDelivered ||
      (delivered === previous.bestDelivered && previous.gamesPlayed > 0 && errors < previous.bestErrors));

  const record = {
    bestDelivered: isNewRecord ? delivered : previous.bestDelivered,
    bestErrors: isNewRecord ? errors : previous.bestErrors,
    gamesPlayed: previous.gamesPlayed + 1
  };

  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(EXPRESS_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }
  return { record, previous, isNewRecord };
}
