import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateExpressExercise,
  createExpressHistory,
  createRng,
  getTierForDelivered,
  EXPRESS_TEMPLATES,
  EXPRESS_TIERS
} from '../src/data/expressExercises.js';
import { ExpressSession, EXPRESS_CONFIG, formatClock } from '../src/engine/expressSession.js';
import { runLevelCode } from '../src/engine/runner.js';
import { validateLevelResult } from '../src/engine/validator.js';
import { checkStrictBeginnerSyntax } from '../src/engine/syntaxRules.js';
import { isExpressUnlocked, loadExpressRecord, saveExpressResult } from '../src/engine/storage.js';
import { createMockDomForLevel } from './helpers/mockDom.js';

function run(level, code) {
  const doc = level.mechanic === 'dom' ? createMockDomForLevel(level) : undefined;
  const result = runLevelCode(level, code, { doc });
  return result.ok ? validateLevelResult(level, result) : { passed: false, feedback: result.error };
}

test('Express : chaque gabarit produit des exercices dont le corrigé valide (300 tirages / gabarit)', () => {
  for (const tpl of EXPRESS_TEMPLATES) {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = createRng(seed * 7919);
      const built = tpl.build({ rng, tier: 4, client: { name: 'Lina', avatar: 'lina' } });
      const level = { id: 1, mechanic: tpl.mechanic, leo: { success: 'ok' }, client: { avatar: 'lina' }, ...built };

      assert.equal(checkStrictBeginnerSyntax(level.solution).ok, true, `${tpl.id}: syntaxe débutant`);
      const ok = run(level, level.solution);
      assert.equal(ok.passed, true, `${tpl.id} seed ${seed}: ${ok.feedback}\n${level.solution}`);
      const starter = run(level, level.starterCode);
      assert.equal(starter.passed, false, `${tpl.id} seed ${seed}: le code de départ ne doit pas valider`);
    }
  }
});

test('Express : les 5 notions sont couvertes et la difficulté progresse par paliers', () => {
  const mechanics = new Set(EXPRESS_TEMPLATES.map((t) => t.mechanic));
  assert.deepEqual([...mechanics].sort(), ['conditions', 'dom', 'functions', 'loops', 'variables']);

  assert.equal(getTierForDelivered(0).tier, 1);
  assert.equal(getTierForDelivered(EXPRESS_TIERS[1].from).tier, 2);
  assert.equal(getTierForDelivered(EXPRESS_TIERS[3].from + 20).tier, 4);

  // Au palier 1, pas de gabarit avancé (fonctions, DOM) ; le DOM n'arrive qu'au palier 2.
  for (let seed = 1; seed <= 200; seed++) {
    const lvl = generateExpressExercise({ deliveredCount: 0, rng: createRng(seed) });
    assert.equal(lvl.tier, 1);
    assert.ok(['variables', 'conditions', 'loops'].includes(lvl.mechanic), `palier 1 : ${lvl.templateId}`);
  }
});

test('Express : une partie enchaîne des exercices variés, sans répétition', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = createRng(seed);
    const history = createExpressHistory();
    const sigs = new Set();
    let prev = null;
    let prevPrev = null;
    for (let n = 0; n < 30; n++) {
      const lvl = generateExpressExercise({ deliveredCount: n, rng, history });
      assert.equal(lvl.id, n + 1);
      assert.equal(lvl.express, true);
      assert.equal(run(lvl, lvl.solution).passed, true, `${lvl.templateId}: ${lvl.solution}`);
      assert.ok(!sigs.has(lvl.signature), `doublon exact : ${lvl.signature}`);
      sigs.add(lvl.signature);
      if (prev) assert.notEqual(lvl.templateId, prev.templateId, 'même gabarit deux fois de suite');
      if (prev && prevPrev) {
        assert.ok(
          !(lvl.mechanic === prev.mechanic && prev.mechanic === prevPrev.mechanic),
          'même notion trois fois de suite'
        );
      }
      prevPrev = prev;
      prev = lvl;
    }
  }
});

test('Express : une mauvaise réponse est refusée avec un message en français', () => {
  const lvl = generateExpressExercise({ deliveredCount: 0, rng: createRng(3) });
  const wrong = run(lvl, 'var truc = 123456;\nleo(truc);');
  assert.equal(wrong.passed, false);
  assert.ok(wrong.feedback.length > 0);
  assert.equal(run(lvl, 'let x = 1;').passed, false);
});

test('Session : chrono, pause, pénalités et fin de partie', () => {
  let t = 0;
  const s = new ExpressSession({ now: () => t });
  assert.equal(EXPRESS_CONFIG.durationMs, 300000);
  s.start();
  t = 60000;
  assert.equal(formatClock(s.remainingMs), '4:00');

  s.pause();
  t = 120000; // 60 s de pause : le chrono ne bouge pas
  assert.equal(formatClock(s.remainingMs), '4:00');
  s.resume();

  s.registerError();
  assert.equal(s.errors, 1);
  assert.equal(formatClock(s.remainingMs), '3:50');
  assert.equal(s.isOver, false, 'une erreur ne fait pas perdre la partie');

  s.registerDelivery();
  assert.equal(s.delivered, 1);

  t += 10 * 60 * 1000;
  assert.equal(s.update(), true);
  assert.equal(s.isOver, true);
  assert.equal(s.remainingMs, 0);
  s.registerDelivery(); // ignoré après la fin
  assert.equal(s.delivered, 1);
});

test('Session : des pénalités peuvent épuiser le temps restant', () => {
  let t = 0;
  const s = new ExpressSession({ durationMs: 15000, penaltyMs: 10000, now: () => t });
  s.start();
  s.registerError();
  assert.equal(s.isOver, false);
  s.registerError();
  assert.equal(s.isOver, true);
  assert.equal(s.errors, 2);
});

test('Déverrouillage : uniquement quand les 40 exercices sont réussis', () => {
  const ids = (n) => Array.from({ length: n }, (_, i) => i + 1);
  assert.equal(isExpressUnlocked({ completedIds: [] }), false);
  assert.equal(isExpressUnlocked({ completedIds: ids(39) }), false);
  assert.equal(isExpressUnlocked({ completedIds: [...ids(39).slice(1), 40] }), false);
  assert.equal(isExpressUnlocked({ completedIds: ids(40) }), true);
  assert.equal(isExpressUnlocked(undefined), false);
});

test('Record : sauvegardé dans sa propre clé, sans toucher à la progression Histoire', () => {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    }
  };
  try {
    store.set('atelier_comptoir_progression_v1', '{"currentLevelId":12,"completedIds":[1,2,3]}');
    const storyBefore = store.get('atelier_comptoir_progression_v1');

    assert.equal(loadExpressRecord().bestDelivered, 0);
    let res = saveExpressResult({ delivered: 5, errors: 2 });
    assert.equal(res.isNewRecord, true);
    res = saveExpressResult({ delivered: 3, errors: 0 });
    assert.equal(res.isNewRecord, false);
    assert.equal(res.record.bestDelivered, 5);
    res = saveExpressResult({ delivered: 5, errors: 1 });
    assert.equal(res.isNewRecord, true, 'même score avec moins d’erreurs');
    res = saveExpressResult({ delivered: 8, errors: 4 });
    assert.equal(res.record.bestDelivered, 8);
    assert.equal(res.record.gamesPlayed, 4);
    assert.equal(saveExpressResult({ delivered: 0, errors: 0 }).isNewRecord, false);

    assert.equal(loadExpressRecord().bestDelivered, 8);
    assert.equal(store.get('atelier_comptoir_progression_v1'), storyBefore, 'sauvegarde Histoire intacte');
  } finally {
    delete globalThis.window;
  }
});
