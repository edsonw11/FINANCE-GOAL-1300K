/**
 * ui/components/flags.js
 * Responsibility: small inline SVG flags (Brazil, United States, Spain) and a phone icon for "automatic".
 * Drawn here, not emoji, because flag emoji do not render on every system (Windows shows letters).
 */
const BOX='viewBox="0 0 24 16" width="36" height="24" role="img" aria-hidden="true" focusable="false"';
const FLAGS={
  'pt-BR':`<svg ${BOX}><rect width="24" height="16" fill="#009c3b"/><path d="M12 1.8 22 8 12 14.2 2 8z" fill="#ffdf00"/><circle cx="12" cy="8" r="3.4" fill="#002776"/><path d="M8.8 7.4q3.2-.9 6.4.9" stroke="#fff" stroke-width=".6" fill="none"/></svg>`,
  'en-US':`<svg ${BOX}><rect width="24" height="16" fill="#fff"/>${[0,2,4,6,8,10,12].map(i=>`<rect y="${i*16/13}" width="24" height="${16/13}" fill="#b22234"/>`).join('')}<rect width="10.5" height="8.6" fill="#3c3b6e"/>${[[2,1.8],[5,1.8],[8,1.8],[3.5,3.6],[6.5,3.6],[2,5.4],[5,5.4],[8,5.4],[3.5,7.2],[6.5,7.2]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r=".5" fill="#fff"/>`).join('')}</svg>`,
  'es':`<svg ${BOX}><rect width="24" height="16" fill="#aa151b"/><rect y="4" width="24" height="8" fill="#f1bf00"/></svg>`,
  'auto':`<svg ${BOX}><rect x="7.5" y="1" width="9" height="14" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12.6" r=".8" fill="currentColor"/></svg>`
};
export const flagSvg=choice=>FLAGS[choice]||'';
