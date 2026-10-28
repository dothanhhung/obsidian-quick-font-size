'use strict';

const { Plugin, MarkdownView, Notice } = require('obsidian');

// Size ladder in em. 1 = normal (no span).
const SIZES = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const OPEN_RE = /<span style="font-size:\s*([\d.]+)em">$/;
const WRAP_RE = /^<span style="font-size:\s*([\d.]+)em">([\s\S]*)<\/span>$/;
// List bullet, numbered item, heading or quote marker kept outside the span.
const PREFIX_RE = /^(\s*(?:[-*+] \[.\] |[-*+] |\d+[.)] |#{1,6} |> ?)*)/;
const BOLD_WAIT_MS = 350; // Ctrl+B waits this long for a Space before bolding

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
    this.mode = 0;       // -1 = smaller (Ctrl+S held), +1 = bigger (Ctrl+B held)
    this.boldTimer = null;

    this.registerDomEvent(document, 'keydown', (e) => this.onKeyDown(e), true);
    this.registerDomEvent(document, 'keyup', (e) => {
      if (e.key === 'Control' || e.key === 'Meta') this.mode = 0;
    }, true);

    this.addCommand({ id: 'smaller', name: 'Make selection smaller', editorCallback: (ed) => this.resize(ed, -1) });
    this.addCommand({ id: 'bigger', name: 'Make selection bigger', editorCallback: (ed) => this.resize(ed, +1) });
  }

  onunload() {
    clearTimeout(this.boldTimer);
  }

  editor() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view && view.getMode() === 'source' ? view.editor : null;
  }

  onKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();

    // Ctrl + (S or B held) + Space: one size step per Space.
    if (e.code === 'Space' && this.mode) {
      const ed = this.editor();
      if (!ed) return;
      e.preventDefault();
      e.stopPropagation();
      if (this.boldTimer) { clearTimeout(this.boldTimer); this.boldTimer = null; } // no bold after all
      this.resize(ed, this.mode);
      return;
    }

    if (key !== 's' && key !== 'b') return;
    const ed = this.editor();
    if (!ed || !ed.somethingSelected()) return; // nothing selected: S and B behave as usual
    this.mode = key === 's' ? -1 : 1;

    // Ctrl+S: let Obsidian save as usual. Ctrl+B: hold the bold back briefly in
    // case a Space follows; if none does, bold as usual.
    if (key === 'b' && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(this.boldTimer);
      this.boldTimer = setTimeout(() => {
        this.boldTimer = null;
        this.app.commands.executeCommandById('editor:toggle-bold');
      }, BOLD_WAIT_MS);
    } else if (key === 'b') {
      e.preventDefault(); // held B auto-repeat: never re-bold
      e.stopPropagation();
    }
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
