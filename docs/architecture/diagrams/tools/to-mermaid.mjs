/**
 * to-mermaid.mjs
 * Responsibility: turns one page of a diagram into Mermaid text (flowchart or sequenceDiagram), from the same specification as the Draw.io file.
 */
import { KINDS, originOf } from './common.mjs';

const clean = (s) => String(s ?? '').replace(/"/g, "'").replace(/[<>]/g, '').replace(/&/g, 'and').replace(/#/g, 'no.').replace(/;/g, ',');
const label = (n) => {
  const parts = [clean(n.title).toUpperCase()];
  if (n.text) parts.push(clean(n.text));
  if (n.src) parts.push(clean(originOf(n)));
  if (n.status) parts.push(clean(n.status));
  return parts.join('<br/>');
};
const idOf = (s) => 'n_' + s.replace(/[^A-Za-z0-9]/g, '_');

function flowchart(page) {
  const out = ['flowchart LR'];
  for (const k of Object.keys(KINDS)) out.push(`  classDef ${k} fill:${KINDS[k].fill},stroke:${KINDS[k].stroke},color:#222`);
  const kinds = new Map();
  for (const lane of page.lanes) {
    out.push(`  subgraph ${idOf('l_' + lane.id)}["${clean(lane.title)}"]`, '    direction TB');
    for (const n of lane.nodes) {
      const k = n.kind || lane.kind;
      kinds.set(n.id, k);
      out.push(`    ${idOf(n.id)}${k === 'dec' ? '{' : '['}"${label(n)}"${k === 'dec' ? '}' : ']'}`);
    }
    out.push('  end');
  }
  for (const e of page.edges || []) out.push(`  ${idOf(e.from)} ${e.dashed ? '-.->' : '-->'}${e.label ? `|"${clean(e.label)}"|` : ''} ${idOf(e.to)}`);
  for (const [id, k] of kinds) out.push(`  class ${idOf(id)} ${k}`);
  return out.join('\n') + '\n';
}
function sequence(page) {
  const out = ['sequenceDiagram', '  autonumber'];
  for (const p of page.participants) out.push(`  participant ${idOf(p.id)} as ${clean(p.title)}`);
  const arrow = { req: '->>', res: '-->>', ext: '->>', err: '--x' };
  for (const m of page.messages) out.push(`  ${idOf(m.from)}${arrow[m.type || 'req']}${idOf(m.to)}: ${clean(m.text)}`);
  return out.join('\n') + '\n';
}
export const toMermaid = (page) => `%% ${clean(page.title)}\n` + (page.participants ? sequence(page) : flowchart(page));
