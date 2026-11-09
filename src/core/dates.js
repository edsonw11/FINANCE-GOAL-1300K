/**
 * core/dates.js
 * Responsibility: Date and month arithmetic (ISO yyyy-mm-dd, month key yyyy-mm, dd/mm/yyyy display).
 */
const today=()=>new Date().toLocaleDateString('sv');
const mOf=d=>d.slice(0,7);
const mIdx=m=>{const [y,k]=m.split('-').map(Number);return y*12+k-1};
const mKey=i=>Math.floor(i/12)+'-'+String(i%12+1).padStart(2,'0');
const monthEnd=m=>{const [y,k]=m.split('-').map(Number);return m+'-'+String(new Date(y,k,0).getDate()).padStart(2,'0')};
const mLabel=m=>{const [y,k]=m.split('-').map(Number);return MONTH_NAMES[k-1]+' de '+y};
const mShort=m=>{const [y,k]=m.split('-').map(Number);return MONTH_NAMES[k-1].slice(0,3)+'/'+String(y).slice(2)};
const asOf=m=>{const e=monthEnd(m),t=today();return e<t?e:t};
const formatDateBR=d=>d.split('-').reverse().join('/');
const addMonths=(d,n)=>{const [y,m,dd]=d.split('-').map(Number);const t=new Date(y,m-1+n,1);const last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(Math.min(dd,last)).padStart(2,'0')};
const pad2=n=>String(n).padStart(2,'0');
const daysInMonth=(y,mi)=>new Date(y,mi+1,0).getDate();                 // days in the month (mi = 0..11)
const formatISODate=dt=>dt.getFullYear()+'-'+pad2(dt.getMonth()+1)+'-'+pad2(dt.getDate());
const isWeekend=d=>{const w=new Date(d+'T12:00:00').getDay();return w===0||w===6;};
const addDay=(d,n)=>{const dt=new Date(d+'T12:00:00');dt.setDate(dt.getDate()+n);return formatISODate(dt);};
const daysBetween=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/864e5);
