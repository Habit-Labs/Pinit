# Pinit

Pin notes to the top of their folder in the Obsidian file explorer — no more renaming files to `AAA-note` to force them to the top.

## Features

- **Pin to top** — right-click a note in the file explorer (or use the note's ⋮ menu) and choose **Pin to top**. The note floats above the rest of its folder.
- **Reorder pins** — on a pinned note, **Pin above** / **Pin below** move it up or down within the pinned group.
- **Unpin** — removes the note from the pinned group; it returns to its normal sort position.
- **Per-folder** — pins are scoped to each folder, so every folder keeps its own pinned group at the top.
- **Visual marker** — pinned notes show a small pin icon that follows your theme colors.
- **Command palette** — `Pin current note to top`, `Unpin current note`, `Move pinned note up`, `Move pinned note down`.

Pins persist across restarts and survive note renames and folder renames. Moving a note to a different folder unpins it, so you can re-pin it where you want.

## How it works

The plugin reorders items within Obsidian's own file explorer so pinned notes appear first, in the order you set. It does not modify your notes, filenames, or frontmatter — pin state is stored in the plugin's own data file.

## Usage

1. Enable **Pinit** in Settings → Community plugins.
2. Right-click any note in the file explorer → **Pin to top**.
3. Right-click a pinned note → **Pin above** / **Pin below** to reorder, or **Unpin** to remove.

## Development

```bash
npm install
npm run dev    # watch build
npm run build  # type-check + production build
npm run lint   # Obsidian plugin review lint
```

## License

[MIT](LICENSE)
