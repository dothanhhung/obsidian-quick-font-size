'use strict';

const { Plugin, MarkdownView, Notice } = require('obsidian');

// Size ladder in em. 1 = normal (no span).
const SIZES = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const OPEN_RE = /<span style="font-size:\s*([\d.]+)em">$/;
const WRAP_RE = /^<span style="font-size:\s*([\d.]+)em">([\s\S]*)<\/span>$/;
// List bullet, numbered item, heading or quote marker kept outside the span.
const PREFIX_RE = /^(\s*(?:[-*+] \[.\] |[-*+] |\d+[.)] |#{1,6} |> ?)*)/;
const HOLD_WAIT_MS = 350; // Ctrl+B / Ctrl+T wait this long for a Space before bold / new tab

function nextSize(size, dir) {
  // Nearest ladder step, then one step up or down.
  let i = 0;
  SIZES.forEach((s, k) => { if (Math.abs(s - size) < Math.abs(SIZES[i] - size)) i = k; });
  return SIZES[Math.max(0, Math.min(SIZES.length - 1, i + dir))];
}

// "text" or '<span style="font-size:0.8em">text</span>' -> one step smaller/bigger.
function step(text, dir) {
  const m = text.match(WRAP_RE);
  const size = m ? parseFloat(m[1]) : 1;
  const inner = m ? m[2] : text;
  const next = nextSize(size, dir);
  return next === 1 ? inner : `<span style="font-size:${next}em">${inner}</span>`;
}

// One line: keep its list/heading/quote marker outside the span.
function stepLine(line, dir) {
  const prefix = line.match(PREFIX_RE)[0];
  const body = line.slice(prefix.length);
  return body.trim() ? prefix + step(body, dir) : line;
}

module.exports = class QuickFontSizePlugin extends Plugin {
  onload() {
    this.mode = null;    // 'small' (Ctrl+S held), 'big' (Ctrl+B held), 'top' (Ctrl+T held)
    this.holdTimer = null;

    this.registerDomEvent(document, 'keydown', (e) => this.onKeyDown(e), true);
    this.registerDomEvent(document, 'keyup', (e) => {
      if (e.key === 'Control' || e.key === 'Meta') this.mode = null;
    }, true);

    this.addCommand({ id: 'smaller', name: 'Make selection smaller', editorCallback: (ed) => this.resize(ed, -1) });
    this.addCommand({ id: 'bigger', name: 'Make selection bigger', editorCallback: (ed) => this.resize(ed, +1) });
  }

  onunload() {
    clearTimeout(this.holdTimer);
  }

  editor() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view && view.getMode() === 'source' ? view.editor : null;
  }

  onKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl || e.altKey || e.shiftKey) return;
    // Physical key (e.code): a Vietnamese input tool or another layout can
    // change e.key.
    const key = { KeyS: 's', KeyB: 'b', KeyT: 't' }[e.code] || (e.key || '').toLowerCase();
    const space = e.code === 'Space' || e.key === ' ';

    // Ctrl + (S, B or T held) + Space.
    if (space && this.mode) {
      const ed = this.editor();
      if (!ed) return;
      e.preventDefault();
      e.stopPropagation();
      if (this.holdTimer) { clearTimeout(this.holdTimer); this.holdTimer = null; } // no bold / new tab after all
      if (this.mode === 'top') this.goTop(ed);
      else this.resize(ed, this.mode === 'small' ? -1 : 1);
      return;
    }

    if (key !== 's' && key !== 'b' && key !== 't') return;
    const ed = this.editor();
    if (!ed) return;
    // S and B only mean something with text selected; otherwise they behave as usual.
    if (key !== 't' && !ed.somethingSelected()) return;
    this.mode = { s: 'small', b: 'big', t: 'top' }[key];

    // Ctrl+S: let Obsidian save as usual. Ctrl+B (bold) and Ctrl+T (new tab):
    // hold them back briefly in case a Space follows; if none does, run them.
    if (key === 's') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return; // held key auto-repeat: never re-run
    const command = key === 'b' ? 'editor:toggle-bold' : 'workspace:new-tab';
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      this.app.commands.executeCommandById(command);
    }, HOLD_WAIT_MS);
  }

  // Cursor to the very top of the note (below the frontmatter, if any).
  goTop(ed) {
    let line = 0;
    if (ed.getLine(0) === '---') {
      for (let n = 1; n < ed.lineCount(); n++) {
        if (ed.getLine(n) === '---') { line = Math.min(n + 1, ed.lineCount() - 1); break; }
      }
    }
    ed.setCursor({ line, ch: 0 });
    ed.scrollIntoView({ from: { line: 0, ch: 0 }, to: { line, ch: 0 } }, true);
    ed.focus();
  }

  resize(ed, dir) {
    if (!ed.somethingSelected()) { new Notice('Select some text first'); return; }
    let from = ed.getCursor('from');
    let to = ed.getCursor('to');

    if (from.line === to.line) {
      // Selection is just the inner text of a sized span: take the tags too.
      const line = ed.getLine(from.line);
      const before = line.slice(0, from.ch).match(OPEN_RE);
      if (before && line.slice(to.ch).startsWith('</span>')) {
        from = { line: from.line, ch: from.ch - before[0].length };
        to = { line: to.line, ch: to.ch + '</span>'.length };
      }
      const out = step(ed.getRange(from, to), dir);
      ed.replaceRange(out, from, to);
      ed.setSelection(from, { line: from.line, ch: from.ch + out.length });
      return;
    }

    // Several lines: size each whole line on its own.
    const first = from.line;
    const last = to.ch === 0 && to.line > from.line ? to.line - 1 : to.line;
    const start = { line: first, ch: 0 };
    const end = { line: last, ch: ed.getLine(last).length };
    const out = ed.getRange(start, end).split('\n').map((l) => stepLine(l, dir)).join('\n');
    ed.replaceRange(out, start, end);
    const lines = out.split('\n');
    ed.setSelection(start, { line: last, ch: lines[lines.length - 1].length });
  }
};

module.exports.step = step;
module.exports.stepLine = stepLine;
