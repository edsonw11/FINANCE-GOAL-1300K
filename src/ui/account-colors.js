/**
 * ui/account-colors.js
 * Responsibility: the color of each investment account (theme variable picked by account position) and of each investment type.
 */
import { COLORS } from '../core/config.js';
import { css } from '../core/dom.js';
import { S } from '../domain/store.js';
export const accColor=id=>css(COLORS[S.accounts.findIndex(a=>a.id===id)%COLORS.length]);
// investment types share the same color in the ring and in the tower chart
const TYPE_COLOR={_fixed:'--c4',acao:'--c0',fii:'--c1',etf:'--c2',bdr:'--c3'};
export const typeColor=id=>css(TYPE_COLOR[id]||COLORS[0]);
