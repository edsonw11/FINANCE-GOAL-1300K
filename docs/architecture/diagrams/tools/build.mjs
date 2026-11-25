#!/usr/bin/env node
/**
 * build.mjs
 * Responsibility: reads the diagram specifications (specs/) and writes, for each one, the Draw.io file and the Mermaid file(s), plus the traceability matrix.
 * It also writes an SVG of every page (miro/svg), the source of the PNG and PDF files (tools/export-images.sh).
 * Usage: node docs/architecture/diagrams/tools/build.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagrams } from './specs/index.mjs';
import { matrixMarkdown, traceRows } from './trace.mjs';
import { toDrawio } from './to-drawio.mjs';
import { toMermaid } from './to-mermaid.mjs';
import { toSvg } from './to-svg.mjs';
import { analysisDocs } from './analysis-docs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), out = path.resolve(here, '..'), root = path.resolve(here, '../../../..');
const svgDir = path.join(out, 'miro', 'svg');
const { rows, errors } = traceRows(diagrams, root);
if (errors.length) { console.error('Traceability errors:\n  ' + errors.join('\n  ')); process.exit(1); }

mkdirSync(path.join(out, 'mermaid'), { recursive: true });
mkdirSync(svgDir, { recursive: true });
let pages = 0;
for (const d of diagrams) {
  writeFileSync(path.join(out, `${d.id}.drawio`), toDrawio(d));
  d.pages.forEach((page, i) => {
    pages++;
    const suffix = d.pages.length > 1 ? `-${page.slug || i + 1}` : '';
    writeFileSync(path.join(out, 'mermaid', `${d.id}${suffix}.mmd`), toMermaid(page));
    writeFileSync(path.join(svgDir, `${d.id}${suffix}.svg`), toSvg(page));
  });
}
mkdirSync(path.join(out, 'analysis'), { recursive: true });
writeFileSync(path.join(out, 'analysis', 'traceability-matrix.md'), matrixMarkdown(rows));
for (const [name, text] of Object.entries(analysisDocs(diagrams))) writeFileSync(path.join(out, 'analysis', name), text);
console.log(`${diagrams.length} diagrams, ${pages} pages, ${rows.length} traced components`);
