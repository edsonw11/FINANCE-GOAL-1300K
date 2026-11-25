/**
 * to-svg.mjs
 * Responsibility: a plain SVG preview of a laid-out page (same coordinates as the Draw.io file), only to look at the diagram without diagrams.net: it is not a deliverable.
 */
import { KINDS, STATUSES, wrap, xml } from './common.mjs';
import { edgeSides, layoutPage, legendEntries, nodeParts } from './layout.mjs';

const text = (x, y, s, o = '') => `<text x="${x}" y="${y}" font-family="Helvetica,Arial,sans-serif" ${o}>${xml(s)}</text>`;
export function toSvg(page) {
  const laid = layoutPage(page), out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${laid.width}" height="${laid.height}" viewBox="0 0 ${laid.width} ${laid.height}"><defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#4a5568"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>`);
  out.push(text(20, 32, page.title, 'font-size="20" font-weight="bold"'));
  wrap(page.subtitle || '', 190).slice(0, 2).forEach((t, i) => out.push(text(20, 54 + i * 15, t, 'font-size="12" fill="#555"')));
  if (laid.type === 'lanes') {
    const pos = new Map();
    laid.lanes.forEach((l) => {
      out.push(`<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="#fff" stroke="#9aa4b2"/><rect x="${l.x}" y="${l.y}" width="${l.w}" height="36" fill="#f8f9fb" stroke="#9aa4b2"/>`, text(l.x + l.w / 2, l.y + 23, l.title, 'font-size="13" font-weight="bold" text-anchor="middle"'));
      l.nodes.forEach((n) => {
        pos.set(n.id, n);
        const k = KINDS[n.kind], p = nodeParts(n);
        out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${k.fill}" stroke="${k.stroke}"${n.kind === 'dec' ? ' stroke-dasharray="5 3"' : ''}/>`);
        let y = n.y + 18;
        p.title.forEach((t) => { out.push(text(n.x + 8, y, t, 'font-size="12" font-weight="bold"')); y += 16; });
        y += 2; p.text.forEach((t) => { out.push(text(n.x + 8, y, t, 'font-size="11"')); y += 14; });
        y += 2; p.origin.forEach((t) => { out.push(text(n.x + 8, y, t, 'font-size="9" fill="#666"')); y += 13; });
        if (p.status) out.push(text(n.x + 8, y + 2, p.status, 'font-size="9" font-style="italic"'));
      });
    });
    (page.edges || []).forEach((e, ei) => {
      const a = pos.get(e.from), b = pos.get(e.to);
      const sd = edgeSides(a, b), p1 = [a.x + a.w * sd.ex, a.y + a.h * sd.ey], p2 = [b.x + b.w * sd.nx, b.y + b.h * sd.ny];
      let d;
      if (sd.ex === 0.5) d = `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`;
      else { const xm = (p1[0] + p2[0]) / 2 + ((ei % 5) - 2) * 9; d = `M${p1[0]},${p1[1]} L${xm},${p1[1]} L${xm},${p2[1]} L${p2[0]},${p2[1]}`; }
      const col = e.kind === 'err' ? '#b85450' : e.kind === 'ext' ? '#d79b00' : '#4a5568';
      out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.5"${e.dashed ? ' stroke-dasharray="5 3"' : ''} marker-end="url(#a)"/>`);
      if (e.label) {
        const w = e.label.length * 5.4 + 8, lx = sd.ex === 0.5 ? p1[0] + 6 : (p1[0] + p2[0]) / 2 + ((ei % 5) - 2) * 9 - w / 2, ly = sd.ex === 0.5 ? (p1[1] + p2[1]) / 2 : p1[1] - 6;
        out.push(`<rect x="${lx}" y="${ly - 11}" width="${w}" height="14" rx="3" fill="#fff" stroke="#e2e8f0"/>`, text(lx + 4, ly, e.label, 'font-size="10" fill="#333"'));
      }
    });
  } else {
    const by = new Map(laid.parts.map((p) => [p.id, p]));
    laid.parts.forEach((p) => {
      const k = KINDS[p.kind];
      out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="40" rx="6" fill="${k.fill}" stroke="${k.stroke}"/>`, text(p.x + p.w / 2, p.y + 24, p.title, 'font-size="11" font-weight="bold" text-anchor="middle"'), `<line x1="${p.x + p.w / 2}" y1="${p.y + 40}" x2="${p.x + p.w / 2}" y2="${p.y + p.h}" stroke="#999" stroke-dasharray="4 3"/>`);
    });
    laid.msgs.forEach((m, i) => {
      const a = by.get(m.from), b = by.get(m.to), x1 = a.x + a.w / 2, x2 = b.x + b.w / 2;
      const col = m.type === 'err' ? '#b85450' : m.type === 'ext' ? '#d79b00' : '#4a5568';
      out.push(`<line x1="${x1}" y1="${m.y}" x2="${x2}" y2="${m.y}" stroke="${col}" stroke-width="1.5"${m.type === 'res' || m.type === 'err' ? ' stroke-dasharray="5 3"' : ''} marker-end="url(#a)"/>`, text(Math.min(x1, x2) + 6, m.y - 5, `${i + 1}. ${m.text}`, 'font-size="10"'));
    });
  }
  legendEntries(laid).forEach((e, i) => out.push(`<rect x="${20 + i * 160}" y="${laid.legendY}" width="150" height="26" rx="5" fill="${e.fill}" stroke="${e.stroke}"/>`, text(20 + i * 160 + 6, laid.legendY + 17, e.label, 'font-size="10"')));
  out.push(text(20, laid.legendY + 48, `Status values: ${STATUSES.join(' | ')}. Colours are a convention, not an implementation status.`, 'font-size="10" fill="#555"'));
  (page.notes || []).forEach((t, i) => out.push(text(20, laid.legendY + 70 + i * 18, t, 'font-size="10" fill="#555"')));
  return out.join('\n') + '</svg>\n';
}
