/**
 * layout.mjs
 * Responsibility: puts the boxes of a page on a grid so nothing overlaps by construction. A "lanes" page is columns (one per stage or area) with boxes stacked in each;
 * a "sequence" page is lifelines with messages down the page. Every renderer uses these coordinates, so the Draw.io, Mermaid-free preview and checks agree.
 */
import { KINDS, originOf, wrap } from './common.mjs';

export const LANE_W = 300, NODE_W = 260, LANE_GAP = 90, TOP = 96, HEAD = 36, PAD = 20, VGAP = 20, LEGEND_H = 70;
const T_CH = 30, X_CH = 40, O_CH = 40; // characters per line: bold title, text, origin

export function nodeParts(n) {
  return { title: wrap(n.title, T_CH), text: wrap(n.text, X_CH), origin: wrap(originOf(n), O_CH), status: n.status ? `Status: ${n.status}` : '' };
}
export function nodeHeight(n) {
  const p = nodeParts(n);
  return 16 + p.title.length * 16 + (p.text.length ? 4 + p.text.length * 14 : 0) + (p.origin.length ? 4 + p.origin.length * 13 : 0) + (p.status ? 17 : 0) + 10;
}

export function layoutLanes(page) {
  const sized = page.lanes.map((lane, i) => {
    const heights = lane.nodes.map(nodeHeight);
    return { lane, col: lane.col ?? i, row: lane.row ?? 0, heights, h: Math.max(HEAD + PAD + heights.reduce((s, v) => s + v + VGAP, 0), 120) };
  });
  const rows = Math.max(...sized.map((s) => s.row)) + 1, rowTop = [TOP], rowH = [];
  for (let r = 0; r < rows; r++) {
    rowH[r] = Math.max(0, ...sized.filter((s) => s.row === r).map((s) => s.h));
    rowTop[r + 1] = rowTop[r] + rowH[r] + 48;
  }
  const lanes = sized.map(({ lane, col, row, heights, h }) => {
    const x = PAD + col * (LANE_W + LANE_GAP), y = rowTop[row];
    let ny = y + HEAD + PAD;
    const nodes = lane.nodes.map((n, k) => {
      const box = { ...n, kind: n.kind || lane.kind, laneId: lane.id, col, row, x: x + (LANE_W - NODE_W) / 2, y: ny, w: NODE_W, h: heights[k], rx: (LANE_W - NODE_W) / 2, ry: ny - y };
      ny += heights[k] + VGAP;
      return box;
    });
    return { ...lane, col, row, x, y, w: LANE_W, h, nodes };
  });
  const cols = Math.max(...lanes.map((l) => l.col)) + 1;
  const width = Math.max(PAD * 2 + cols * LANE_W + (cols - 1) * LANE_GAP, 900), bottom = rowTop[rows - 1] + rowH[rows - 1] + 24;
  const used = [...new Set(lanes.flatMap((l) => l.nodes.map((n) => n.kind)))];
  return { type: 'lanes', width, height: bottom + LEGEND_H + (page.notes?.length || 0) * 18, lanes, legendY: bottom, used };
}
/** Which side of the two boxes a connector leaves and enters: down inside a column, sideways between columns. */
export function edgeSides(a, b) {
  if (a.col === b.col) return b.y >= a.y ? { ex: 0.5, ey: 1, nx: 0.5, ny: 0 } : { ex: 0.5, ey: 0, nx: 0.5, ny: 1 };
  return b.col > a.col ? { ex: 1, ey: 0.5, nx: 0, ny: 0.5 } : { ex: 0, ey: 0.5, nx: 1, ny: 0.5 };
}

const COL_W = 210, LIFE_TOP = 96, LIFE_HEAD = 44, STEP = 46;
export function layoutSequence(page) {
  const parts = page.participants.map((p, i) => ({ ...p, x: PAD + i * COL_W, y: LIFE_TOP, w: 150, h: 0 }));
  const height = LIFE_HEAD + (page.messages.length + 1) * STEP + 20;
  parts.forEach((p) => { p.h = height; });
  const msgs = page.messages.map((m, i) => ({ ...m, y: LIFE_TOP + LIFE_HEAD + (i + 1) * STEP }));
  const width = Math.max(PAD * 2 + parts.length * COL_W, 900), bottom = LIFE_TOP + height + 24;
  return { type: 'sequence', width, height: bottom + LEGEND_H + (page.notes?.length || 0) * 18, parts, msgs, legendY: bottom, used: [...new Set(page.participants.map((p) => p.kind))] };
}
export const layoutPage = (page) => (page.participants ? layoutSequence(page) : layoutLanes(page));
export const legendEntries = (laid) => laid.used.map((k) => ({ kind: k, ...KINDS[k] }));
