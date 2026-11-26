import { highlightJavaScript } from './syntaxHighlighter.js';
import { extractDeclaredVars, extractDeclaredFunctions, stripCommentsAndStrings } from '../engine/syntaxRules.js';

/**
 * Suggestions de base strictement alignées sur le programme débutant d'Atelier & Comptoir.
 * cursorOffset = décalage du curseur depuis la fin du texte inséré (0 = tout à la fin).
 */
const BASE_COMPLETIONS = [
  { label: 'var', insert: 'var ', kind: 'mot-clé', desc: 'Créer une variable', cursorOffset: 0 },
  { label: 'if', insert: 'if () {\n  \n}', kind: 'mot-clé', desc: 'Condition si', cursorOffset: -8 },
  { label: 'else', insert: 'else {\n  \n}', kind: 'mot-clé', desc: 'Sinon', cursorOffset: -2 },
  { label: 'else if', insert: 'else if () {\n  \n}', kind: 'mot-clé', desc: 'Sinon si', cursorOffset: -8 },
  {
    label: 'for',
    insert: 'for (var i = 1; i <= 10; i++) {\n  \n}',
    kind: 'mot-clé',
    desc: 'Boucle for classique',
    cursorOffset: -2
  },
  {
    label: 'function',
    insert: 'function nom() {\n  \n}',
    kind: 'mot-clé',
    desc: 'Créer une fonction',
    cursorOffset: -2
  },
  { label: 'return', insert: 'return ', kind: 'mot-clé', desc: 'Renvoyer un résultat', cursorOffset: 0 }
];

const ATELIER_COMPLETIONS = [
  {
    label: 'leo()',
    insert: 'leo();',
    kind: 'atelier',
    desc: 'Demander à Léo de livrer un colis',
    mechanics: ['variables', 'conditions'],
    cursorOffset: -2
  },
  {
    label: 'supprimer()',
    insert: 'supprimer();',
    kind: 'atelier',
    desc: 'Supprimer le colis (Centre de tri)',
    mechanics: ['conditions'],
    cursorOffset: 0
  },
  {
    label: 'generer()',
    insert: 'generer();',
    kind: 'atelier',
    desc: 'Produire un colis (Générateur)',
    mechanics: ['loops', 'functions'],
    cursorOffset: -2
  }
];

const DOM_COMPLETIONS = [
  {
    label: 'document',
    insert: 'document',
    kind: 'DOM',
    desc: 'La page HTML',
    mechanics: ['dom'],
    cursorOffset: 0
  },
  {
    label: 'document.getElementById',
    insert: 'document.getElementById("")',
    kind: 'DOM',
    desc: 'Trouver un élément par son id',
    mechanics: ['dom'],
    cursorOffset: -2
  }
];

const MEMBER_COMPLETIONS = [
  {
    label: 'getElementById',
    insert: 'getElementById("")',
    kind: 'DOM',
    desc: 'Sélectionner un élément par son id',
    afterObject: 'document',
    cursorOffset: -2
  },
  {
    label: 'appendChild',
    insert: 'appendChild();',
    kind: 'DOM',
    desc: 'Déplacer un colis dans cette zone',
    afterAny: true,
    cursorOffset: -2
  },
  {
    label: 'textContent',
    insert: 'textContent',
    kind: 'DOM',
    desc: 'Lire le texte d’un élément HTML',
    afterAny: true,
    cursorOffset: 0
  }
];

/**
 * Contrôleur de la zone de code intégrée (bas de l'écran) :
 * - coloration syntaxique temps réel synchronisée
 * - autocomplétion intelligente (mots-clés, fonctions atelier, DOM, variables locales)
 * - numéros de ligne synchronisés
 * - indentation Tab (2 espaces)
 * - raccourci Ctrl+Entrée / Cmd+Entrée
 * - réinitialisation automatique à chaque nouvel exercice
 */
export class EditorController {
  constructor({ onRun, onCodeChange, onShowSolution, onOpenMemento }) {
    this.textarea = document.getElementById('editeur-code');
    this.linesEl = document.getElementById('editeur-lignes');
    this.highlightPre = document.getElementById('editeur-surlignage');
    this.highlightCode = document.getElementById('editeur-surlignage-code');
    this.popupEl = document.getElementById('editeur-autocompletion');

    this.objectiveEl = document.getElementById('editeur-objectif');
    this.consoleEl = document.getElementById('console-sortie');
    this.consoleStatusEl = document.getElementById('console-statut');

    this.btnRun = document.getElementById('btn-executer');
    this.btnReset = document.getElementById('btn-reinitialiser-code');
    this.btnSolution = document.getElementById('btn-corrige');
    this.btnMemento = document.getElementById('btn-memento');

    this.currentLevel = null;
    this.starterCode = '';
    this.isRunning = false;
    this.onRun = onRun;
    this.onCodeChange = onCodeChange;
    this.onShowSolution = onShowSolution;

    // État de l'autocomplétion
    this.suggestions = [];
    this.selectedIndex = 0;
    this.replaceStart = 0;

    this.textarea.addEventListener('input', () => {
      this.syncVisuals();
      this.updateAutocomplete(false);
      if (this.onCodeChange) this.onCodeChange(this.textarea.value);
    });

    this.textarea.addEventListener('scroll', () => this.syncScroll());

    this.textarea.addEventListener('click', () => this.hideAutocomplete());
    this.textarea.addEventListener('blur', () => {
      // Laisser le temps au mousedown sur une suggestion de s'exécuter
      setTimeout(() => this.hideAutocomplete(), 120);
    });

    this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));

    this.btnRun.addEventListener('click', () => this.triggerRun());
    this.btnReset.addEventListener('click', () => {
      this.setCode(this.starterCode);
      this.hideAutocomplete();
      this.logInfo('Zone de code réinitialisée.');
      if (this.onCodeChange) this.onCodeChange(this.textarea.value);
      this.textarea.focus();
    });
    this.btnSolution.addEventListener('click', () => {
      this.hideAutocomplete();
      if (this.onShowSolution) this.onShowSolution();
    });
    this.btnMemento.addEventListener('click', () => {
      this.hideAutocomplete();
      if (onOpenMemento) onOpenMemento();
    });

    this.syncVisuals();
  }

  handleKeyDown(e) {
    // Ctrl+Entrée ou Cmd+Entrée -> toujours exécuter le code
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.hideAutocomplete();
      this.triggerRun();
      return;
    }

    // Ctrl+Espace -> ouvrir l'autocomplétion manuellement
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      this.updateAutocomplete(true);
      return;
    }

    // Navigation dans le menu d'autocomplétion s'il est ouvert
    if (!this.popupEl.hidden && this.suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
        this.renderAutocompletePopup();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
        this.renderAutocompletePopup();
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        this.applySuggestion(this.suggestions[this.selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hideAutocomplete();
        return;
      }
    }

    // Touche Tab standard -> insère 2 espaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.textarea.selectionStart;
      const end = this.textarea.selectionEnd;
      const val = this.textarea.value;
      this.textarea.value = val.slice(0, start) + '  ' + val.slice(end);
      this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
      this.syncVisuals();
    }
  }

  loadLevel(level) {
    this.currentLevel = level;
    this.starterCode = level.starterCode || '';
    this.setCode(this.starterCode);
    this.hideAutocomplete();
    this.objectiveEl.textContent = level.objective || '';
    this.clearConsole();
    this.setStatus('Prêt', 'idle');
    this.logInfo(`${level.express ? 'Colis n°' : 'Exercice '}${level.id} : ${level.objective}`);
    this.textarea.focus();
    this.textarea.selectionStart = this.textarea.selectionEnd = this.textarea.value.length;
  }

  getCode() {
    return this.textarea.value;
  }

  setCode(code) {
    this.textarea.value = code;
    this.syncVisuals();
  }

  setRunning(running) {
    this.isRunning = running;
    this.btnRun.disabled = running;
    this.btnRun.classList.toggle('en-cours', running);
  }

  triggerRun() {
    if (this.isRunning) return;
    if (this.onRun) this.onRun(this.getCode());
  }

  syncVisuals() {
    this.updateLineNumbers();
    if (this.highlightPre && this.highlightCode) {
      this.highlightCode.innerHTML = highlightJavaScript(this.textarea.value);
      this.textarea.classList.add('surlignage-actif');
    } else {
      this.textarea.classList.remove('surlignage-actif');
    }
    this.syncScroll();
  }

  syncScroll() {
    this.linesEl.scrollTop = this.textarea.scrollTop;
    if (this.highlightPre) {
      this.highlightPre.scrollTop = this.textarea.scrollTop;
      this.highlightPre.scrollLeft = this.textarea.scrollLeft;
    }
  }

  updateLineNumbers() {
    const lineCount = Math.max(1, this.textarea.value.split('\n').length);
    const nums = [];
    for (let i = 1; i <= lineCount; i++) {
      nums.push(String(i));
    }
    this.linesEl.textContent = nums.join('\n');
  }

  /* ---------- Autocomplétion contextuelle ---------- */

  isCursorInCommentOrString(code, pos) {
    let i = 0;
    while (i < pos) {
      const ch = code[i];
      const next = code[i + 1];
      if (ch === '/' && next === '/') {
        const nl = code.indexOf('\n', i + 2);
        if (nl === -1 || pos <= nl) return true;
        i = nl + 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        const end = code.indexOf('*/', i + 2);
        if (end === -1 || pos <= end + 1) return true;
        i = end + 2;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        i++;
        while (i < pos) {
          if (code[i] === '\\') {
            i += 2;
            continue;
          }
          if (code[i] === quote) {
            i++;
            break;
          }
          i++;
        }
        if (i >= pos && code[pos - 1] !== quote) return true;
        continue;
      }
      i++;
    }
    return false;
  }

  updateAutocomplete(forceOpen) {
    const code = this.textarea.value;
    const pos = this.textarea.selectionStart;

    if (pos !== this.textarea.selectionEnd || this.isCursorInCommentOrString(code, pos)) {
      this.hideAutocomplete();
      return;
    }

    const before = code.slice(0, pos);

    // Cas 1 : après un point (ex: document. ou boite.)
    const memberMatch = /([A-Za-z_$][A-Za-z0-9_$]*)\.([A-Za-z0-9_$]*)$/.exec(before);
    if (memberMatch) {
      const objName = memberMatch[1];
      const prefix = memberMatch[2].toLowerCase();
      this.replaceStart = pos - memberMatch[2].length;

      const items = MEMBER_COMPLETIONS.filter((c) => {
        const objOk = c.afterAny || c.afterObject === objName;
        const prefixOk = !prefix || c.label.toLowerCase().startsWith(prefix);
        return objOk && prefixOk && c.label.toLowerCase() !== prefix;
      });

      if (items.length > 0) {
        this.suggestions = items;
        this.selectedIndex = 0;
        this.positionPopup(before);
        this.renderAutocompletePopup();
      } else {
        this.hideAutocomplete();
      }
      return;
    }

    // Cas 2 : mot en cours de saisie
    const wordMatch = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(before);
    const word = wordMatch ? wordMatch[1] : '';

    if (!forceOpen && word.length < 1) {
      this.hideAutocomplete();
      return;
    }

    this.replaceStart = pos - word.length;
    const lower = word.toLowerCase();
    const candidates = this.buildCandidateList(code);

    const filtered = candidates.filter((item) => {
      const lbl = item.label.toLowerCase();
      if (!lower) return true;
      if (lbl === lower && item.insert.trim() === word) return false;
      return lbl.startsWith(lower);
    });

    if (filtered.length === 0) {
      this.hideAutocomplete();
      return;
    }

    this.suggestions = filtered.slice(0, 7);
    this.selectedIndex = 0;
    this.positionPopup(before);
    this.renderAutocompletePopup();
  }

  buildCandidateList(code) {
    const mechanic = this.currentLevel ? this.currentLevel.mechanic : '';
    const seen = new Set();
    const list = [];

    const pushUnique = (item) => {
      if (seen.has(item.label)) return;
      seen.add(item.label);
      list.push(item);
    };

    // 1. Variable d'entrée du niveau (Chapitre 2 conditions : colis, poids, numero...)
    if (this.currentLevel && this.currentLevel.inputVar) {
      pushUnique({
        label: this.currentLevel.inputVar,
        insert: this.currentLevel.inputVar,
        kind: 'colis',
        desc: 'Variable du colis à trier',
        cursorOffset: 0
      });
    }

    // 2. Fonctions de l'atelier adaptées au chapitre actuel en priorité
    for (const item of ATELIER_COMPLETIONS) {
      if (!mechanic || item.mechanics.includes(mechanic)) {
        pushUnique(item);
      }
    }

    // 3. Suggestions DOM au chapitre 5
    if (mechanic === 'dom') {
      for (const item of DOM_COMPLETIONS) {
        pushUnique(item);
      }
    }

    // 4. Variables & fonctions déjà écrites par l'élève dans son code
    const cleaned = stripCommentsAndStrings(code);
    for (const fn of extractDeclaredFunctions(cleaned)) {
      pushUnique({
        label: `${fn.name}()`,
        insert: `${fn.name}()`,
        kind: 'fonction',
        desc: 'Ta fonction',
        cursorOffset: fn.params.length > 0 ? -1 : 0
      });
    }
    for (const v of extractDeclaredVars(cleaned)) {
      pushUnique({
        label: v,
        insert: v,
        kind: 'variable',
        desc: 'Ta variable',
        cursorOffset: 0
      });
    }

    // 5. Mots-clés JavaScript débutant
    for (const kw of BASE_COMPLETIONS) {
      pushUnique(kw);
    }

    return list;
  }

  positionPopup(textBeforeCursor) {
    const lines = textBeforeCursor.split('\n');
    const row = lines.length - 1;
    const col = lines[row].length;

    const lineHeightPx = 22.8;
    const charWidthPx = 8.9;

    const rawTop = 12 + (row + 1) * lineHeightPx - this.textarea.scrollTop;
    const rawLeft = 14 + col * charWidthPx - this.textarea.scrollLeft;

    const maxLeft = Math.max(12, this.textarea.clientWidth - 250);
    const left = Math.max(8, Math.min(rawLeft, maxLeft));

    // Si trop bas dans la zone de code, ouvrir le menu au-dessus de la ligne du curseur
    const preferAbove = rawTop + 150 > this.textarea.clientHeight && rawTop > 130;
    if (preferAbove) {
      this.popupEl.style.top = 'auto';
      this.popupEl.style.bottom = `${Math.max(8, this.textarea.clientHeight - (rawTop - lineHeightPx))}px`;
    } else {
      this.popupEl.style.bottom = 'auto';
      this.popupEl.style.top = `${Math.max(8, Math.min(rawTop, this.textarea.clientHeight - 48))}px`;
    }
    this.popupEl.style.left = `${left}px`;
  }

  renderAutocompletePopup() {
    this.popupEl.innerHTML = '';
    this.suggestions.forEach((item, idx) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.role = 'option';
      row.className = `auto-item ${idx === this.selectedIndex ? 'auto-actif' : ''}`;
      row.innerHTML = `
        <span class="auto-label">${escapeHtml(item.label)}</span>
        <span class="auto-badge auto-badge-${escapeHtml(item.kind.replace(/[^a-z]/gi, '').toLowerCase())}">${escapeHtml(item.kind)}</span>
        <span class="auto-desc">${escapeHtml(item.desc)}</span>
      `;
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.applySuggestion(item);
      });
      this.popupEl.appendChild(row);
    });
    this.popupEl.hidden = false;
  }

  applySuggestion(item) {
    if (!item) return;
    const val = this.textarea.value;
    const end = this.textarea.selectionEnd;
    const before = val.slice(0, this.replaceStart);
    const after = val.slice(end);

    this.textarea.value = before + item.insert + after;
    const newCursor = before.length + item.insert.length + (item.cursorOffset || 0);
    this.textarea.selectionStart = this.textarea.selectionEnd = Math.max(0, newCursor);

    this.hideAutocomplete();
    this.syncVisuals();
    if (this.onCodeChange) this.onCodeChange(this.textarea.value);
    this.textarea.focus();
  }

  hideAutocomplete() {
    this.popupEl.hidden = true;
    this.suggestions = [];
    this.selectedIndex = 0;
  }

  /* ---------- Console / Journal ---------- */

  clearConsole() {
    this.consoleEl.innerHTML = '';
  }

  setStatus(text, kind = 'idle') {
    this.consoleStatusEl.textContent = text;
    this.consoleStatusEl.className = `console-statut statut-${kind}`;
  }

  logInfo(msg) {
    this.appendLog(msg, 'info');
  }

  logSuccess(msg) {
    this.appendLog(msg, 'success');
  }

  logError(msg) {
    this.appendLog(msg, 'error');
  }

  appendLog(msg, kind) {
    const div = document.createElement('div');
    div.className = `console-ligne console-${kind}`;
    div.textContent = msg;
    this.consoleEl.appendChild(div);
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
