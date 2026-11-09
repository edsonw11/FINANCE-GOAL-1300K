/**
 * ui/chrome.js
 * Responsibility: Header setup: menu icons, section titles and today's date.
 */
function initChrome(){
document.querySelectorAll('nav button').forEach(b=>b.insertAdjacentHTML('afterbegin',svg(b.dataset.i)));
document.querySelectorAll('h2').forEach(h=>h.textContent=h.textContent.replace(/^[^\p{L}]+/u,''));
$('todayLbl').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
