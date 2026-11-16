/**
 * ui/components/progress-bar.js
 * Responsibility: horizontal progress bar (budget used, bills paid). The fill is capped at 100%;
 * the tone (ok / near / over) only changes the color.
 */
export const PROGRESS_TONE={ok:'ok',near:'near',over:'over'};
export function progressBar(share,tone=PROGRESS_TONE.ok,label=''){
  const pct=Math.max(0,Math.min(1,share||0))*100;
  return `<div class="pbar pbar-${tone}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((share||0)*100)}"${label?` aria-label="${label}"`:''}><i style="width:${pct.toFixed(1)}%"></i></div>`;
}
