/**
 * common.mjs
 * Responsibility: what every renderer shares: the colour legend (kind -> colours and meaning), the status vocabulary, text wrapping and XML escaping.
 */
export const KINDS = {
  api: { fill: '#dae8fc', stroke: '#6c8ebf', label: 'API and entry' },
  svc: { fill: '#e1d5e7', stroke: '#9673a6', label: 'Orchestration and services' },
  dom: { fill: '#d5e8d4', stroke: '#82b366', label: 'Processing and domain rules' },
  ext: { fill: '#ffe6cc', stroke: '#d79b00', label: 'External integrations' },
  infra: { fill: '#f5f5f5', stroke: '#666666', label: 'Infrastructure' },
  dec: { fill: '#fff2cc', stroke: '#d6b656', label: 'Decisions and validations' },
  err: { fill: '#f8cecc', stroke: '#b85450', label: 'Errors and attention points' },
  out: { fill: '#ffffff', stroke: '#333333', label: 'Results and outputs' },
};
export const STATUSES = ['IMPLEMENTED', 'PARTIAL', 'NOT CONFIRMED', 'NOT IDENTIFIED', 'LEGACY', 'PROPOSAL', 'MOCK'];
export const wrap = (text, width) => {
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      // a word longer than the line (a path) is cut at a slash or at the width
      let w = word;
      while (w.length > width) { const cut = w.lastIndexOf('/', width) > 8 ? w.lastIndexOf('/', width) + 1 : width; if (line) { lines.push(line); line = ''; } lines.push(w.slice(0, cut)); w = w.slice(cut); }
      if (!line) line = w; else if ((line + ' ' + w).length <= width) line += ' ' + w; else { lines.push(line); line = w; }
    }
    if (line || !para) lines.push(line);
  }
  return lines;
};
export const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const originOf = (n) => (n.src ? n.src + (n.sym ? ' > ' + n.sym : '') : '');
