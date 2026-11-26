/**
 * to-drawio.mjs
 * Responsibility: turns the laid-out pages of one diagram into a Draw.io (diagrams.net) file: one <diagram> page per page, lanes as containers, real connectors with source and target.
 */
import { KINDS, STATUSES, originOf, xml } from './common.mjs';
import { LANE_GAP, LANE_W, edgeSides, layoutPage, legendEntries, nodeParts } from './layout.mjs';

const cell = (id, value, style, parent, x, y, w, h, extra = '') =>
  `<mxCell id="${id}" value="${xml(value)}" style="${style}" vertex="1" parent="${parent}"${extra}><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
const nodeHtml = (n) => {
  const p = nodeParts(n);
  const parts = [`<b>${xml(p.title.join(' '))}</b>`];
  if (p.text.length) parts.push(xml(p.text.join(' ')));
  if (n.src) parts.push(`<font color="#666666" style="font-size:9px">${xml(originOf(n))}</font>`);
  if (p.status) parts.push(`<i style="font-size:9px">${xml(p.status)}</i>`);
  return parts.join('<br>');
};
const kindStyle = (k) => `fillColor=${KINDS[k].fill};strokeColor=${KINDS[k].stroke}`;
const header = (page, laid, pid) => [
  cell(`${pid}_title`, `<b style="font-size:20px">${xml(page.title)}</b><br><span style="font-size:12px;color:#555555">${xml(page.subtitle || '')}</span>`, 'text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;', '1', 20, 10, Math.min(laid.width - 40, 1400), 70),
];
const legend = (page, laid, pid) => {
  const out = []; let x = 20;
  legendEntries(laid).forEach((e, i) => {
    out.push(cell(`${pid}_lg${i}`, e.label, `rounded=1;whiteSpace=wrap;html=1;fontSize=10;${kindStyle(e.kind)}`, '1', x, laid.legendY, 150, 26));
    x += 160;
  });
  out.push(cell(`${pid}_lgs`, `Status values: ${STATUSES.join(' | ')}. Colours are a convention, not an implementation status.`, 'text;html=1;align=left;whiteSpace=wrap;fontSize=10;fontColor=#555555;', '1', 20, laid.legendY + 34, Math.min(laid.width - 40, 1400), 28));
  (page.notes || []).forEach((t, i) => out.push(cell(`${pid}_note${i}`, t, 'text;html=1;align=left;whiteSpace=wrap;fontSize=10;fontColor=#555555;', '1', 20, laid.legendY + LEGEND_OFFSET + i * 18, Math.min(laid.width - 40, 1400), 18)));
  return out;
};
const LEGEND_OFFSET = 66;

function lanesPage(page, laid, pid) {
  const cells = header(page, laid, pid), pos = new Map();
  laid.lanes.forEach((lane) => {
    cells.push(cell(`${pid}_l_${lane.id}`, lane.title, `swimlane;startSize=36;html=1;whiteSpace=wrap;fontStyle=1;fontSize=13;fillColor=#f8f9fb;strokeColor=#9aa4b2;swimlaneFillColor=#ffffff;`, '1', lane.x, lane.y, lane.w, lane.h));
    lane.nodes.forEach((n) => {
      pos.set(n.id, { lane, n });
      const shape = n.kind === 'dec' ? 'rounded=1;arcSize=30;dashed=1' : 'rounded=1;arcSize=8';
      cells.push(cell(`${pid}_n_${n.id}`, nodeHtml(n), `${shape};whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingRight=6;spacingTop=4;fontSize=11;${kindStyle(n.kind)}`, `${pid}_l_${lane.id}`, n.rx, n.ry, n.w, n.h));
    });
  });
  (page.edges || []).forEach((e, i) => {
    const a = pos.get(e.from), b = pos.get(e.to);
    const sd = edgeSides(a.n, b.n), dir = `exitX=${sd.ex};exitY=${sd.ey};entryX=${sd.nx};entryY=${sd.ny};`;
    const color = e.kind === 'err' ? '#b85450' : e.kind === 'ext' ? '#d79b00' : '#4a5568';
    cells.push(`<mxCell id="${pid}_e${i}" value="${xml(e.label || '')}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeColor=${color};fontSize=10;labelBackgroundColor=#ffffff;${e.dashed ? 'dashed=1;' : ''}${dir}" edge="1" parent="1" source="${pid}_n_${e.from}" target="${pid}_n_${e.to}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });
  return cells.concat(legend(page, laid, pid));
}

function sequencePage(page, laid, pid) {
  const cells = header(page, laid, pid), byId = new Map(laid.parts.map((p) => [p.id, p]));
  laid.parts.forEach((p) => cells.push(cell(`${pid}_p_${p.id}`, `<b>${xml(p.title)}</b>`, `shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;collapsible=0;recursiveResize=0;outlineConnect=0;size=40;fontSize=11;${kindStyle(p.kind)}`, '1', p.x, p.y, p.w, p.h)));
  laid.msgs.forEach((m, i) => {
    const a = byId.get(m.from), b = byId.get(m.to), fy = ((m.y - a.y) / a.h).toFixed(4);
    const style = { req: '', res: 'dashed=1;', ext: 'strokeColor=#d79b00;', err: 'dashed=1;strokeColor=#b85450;' }[m.type || 'req'];
    cells.push(`<mxCell id="${pid}_m${i}" value="${xml(`${i + 1}. ${m.text}`)}" style="html=1;verticalAlign=bottom;endArrow=block;endFill=1;fontSize=10;labelBackgroundColor=#ffffff;exitX=0.5;exitY=${fy};entryX=0.5;entryY=${fy};${style}" edge="1" parent="1" source="${pid}_p_${m.from}" target="${pid}_p_${m.to}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });
  return cells.concat(legend(page, laid, pid));
}

export function toDrawio(diagram) {
  const pages = diagram.pages.map((page, i) => {
    const laid = layoutPage(page), pid = `p${i + 1}`;
    const cells = laid.type === 'lanes' ? lanesPage(page, laid, pid) : sequencePage(page, laid, pid);
    return `<diagram id="${pid}" name="${xml(page.name || page.title)}"><mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${laid.width}" pageHeight="${laid.height}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" version="24.0.0">${pages.join('\n')}</mxfile>\n`;
}
export { LANE_GAP, LANE_W };
