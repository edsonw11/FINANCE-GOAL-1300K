# Importing the diagrams into Miro

**Miro does not read `.drawio` files.** That is why this folder has four other formats. No import into Miro was performed or tested by the tool that generated these files: follow the steps below and check the result on your board.

Source of the facts about Miro: help.miro.com (import of files and diagrams). Limits to respect: 30 MB per file, 32 megapixels, 8192 x 4096 px for an image.

## Which route to use

| Route | Files | Editable in Miro? | When to use |
|---|---|---|---|
| A. Images | `miro/png/*.png` | No (a picture) | Fastest. Drag and drop. Good for presenting. |
| B. Vector | `miro/svg/*.svg` | No (a flat image) | Sharp at any zoom. |
| C. PDF | `miro/pdf/*.pdf` | No | One file per page; Miro can import PDF pages. |
| D. Editable shapes | `../*.drawio` -> `.vsdx` | Yes | When you want to move boxes and arrows in Miro. |
| E. Mermaid | `../mermaid/*.mmd` | Yes (Miro draws it) | Quick diagrams from text. The layout is Miro's, not ours. |

## A, B, C: drag and drop

1. Open the board.
2. Drag the file (PNG, SVG or PDF) onto the board, or use **Upload** in the left toolbar.
3. One file is one diagram page. The file names say which one (`04-end-to-end-flow-sync-run.png`). Diagrams with several pages have one file per page.
4. The PNG files are 2x (sharp on a big screen). The largest are about 3800 px wide, inside Miro's limit.

## D: editable shapes (VSDX)

1. Open a `.drawio` file at https://app.diagrams.net (File > Open from > Device) or in the draw.io desktop app.
2. Go to **File > Export as > VSDX** (one export per page: use the page tabs).
3. In Miro open **Shapes and lines > More shapes > Import diagram** and choose the `.vsdx`. Bulk import takes PDF or VSDX.
4. Check the result: fonts and the routes of the arrows can change in the import.

## E: Mermaid

1. In Miro add a **Diagram** (or press `/` and search for "Mermaid" in the AI/diagram tool, depending on your plan).
2. Choose Mermaid and paste the content of a `.mmd` file.
3. All 20 `.mmd` files parse with the Mermaid 11 parser (checked when they were generated). Miro's own version may differ.

## Suggested board layout

One frame per diagram, in the order of the numbers (01 to 13). Put the legend (it is inside every image) next to the first frame. See `presentation-guide.md` for the order to present them.

## Regenerating

```bash
node docs/architecture/diagrams/tools/build.mjs          # drawio, mermaid, svg, analysis files
bash docs/architecture/diagrams/tools/export-images.sh   # png and pdf (needs google-chrome)
python3 -I docs/architecture/diagrams/tools/validate.py  # checks the drawio files
```
