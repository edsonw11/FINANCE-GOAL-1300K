/**
 * specs/helpers.mjs
 * Responsibility: short constructors for the specification files, so a box reads as one line.
 */
export const n = (id, title, text, src, sym, status = 'IMPLEMENTED', kind) => ({ id, title, text, src, sym, status, ...(kind ? { kind } : {}) });
export const lane = (id, title, kind, nodes, pos = {}) => ({ id, title, kind, nodes, ...pos });
export const e = (from, to, label, extra = {}) => ({ from, to, label, ...extra });
export const m = (from, to, text, type = 'req') => ({ from, to, text, type });
export const p = (id, title, kind) => ({ id, title, kind });
