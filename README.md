# Quick Font Size

An Obsidian plugin to make selected text smaller or bigger with the keyboard.

Select some text, then:
- **Smaller:** hold **Ctrl**, press **S**, keep holding Ctrl and tap **Space**. Each Space is one step smaller.
- **Bigger:** hold **Ctrl**, press **B**, keep holding Ctrl and tap **Space**. Each Space is one step bigger.

And anywhere in a note:
- **Go to top:** hold **Ctrl**, press **T**, keep holding Ctrl and tap **Space**. The cursor jumps to the top of the note (below the frontmatter, if any).

(On a Mac, Cmd instead of Ctrl.)

The text is wrapped in a span, which Obsidian shows in Live Preview and Reading view:

```
<span style="font-size:0.8em">smaller text</span>
```

## How it behaves
- **Sizes:** 0.5, 0.6, 0.7, 0.8, 0.9, normal, 1.25, 1.5, 1.75, 2, 2.5, 3 (em). Back at normal size, the span is removed.
- **Pressing again resizes the same span**; it never nests spans. After each step the whole span stays selected, and selecting just the text inside a span works too.
- **Several lines selected:** each line is sized on its own, and list bullets, task boxes, numbers, heading `#` and quote `>` stay outside the span, so they keep working.
- **Ctrl+B still bolds.** With text selected, Ctrl+B waits about a third of a second for a Space; if none comes, it bolds as usual. With nothing selected, Ctrl+B and Ctrl+S are untouched.
- **Ctrl+T still opens a new tab.** It waits about a third of a second for a Space; if none comes, the new tab opens as usual.
- **Ctrl+S still saves** (harmless; it happens anyway).
- Keys are read by their physical position, so it also works with Vietnamese input tools (Unikey, EVKey) and other keyboard layouts.
- Also available as commands: **Make selection smaller** / **Make selection bigger** (assign your own hotkeys if you like).

## Install (manual)
1. In your vault, create the folder `.obsidian/plugins/quick-font-size/`.
2. Copy `main.js` and `manifest.json` from this repo into it.
3. In Obsidian: **Settings → Community plugins**, turn off Restricted mode if needed, then enable **Quick Font Size**.

## License
MIT
