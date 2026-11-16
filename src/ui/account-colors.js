/**
 * ui/account-colors.js
 * Responsibility: the color of each investment account (theme variable picked by account position).
 */
import { COLORS } from '../core/config.js';
import { css } from '../core/dom.js';
import { S } from '../domain/store.js';
export const accColor=id=>css(COLORS[S.accounts.findIndex(a=>a.id===id)%COLORS.length]);
