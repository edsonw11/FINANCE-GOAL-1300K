/**
 * tools/fake-clock-preload.cjs
 * Responsibility: used only to check that the unit tests do not depend on the day they run (node --require, with FAKE_NOW=2026-01-31T12:00:00).
 * Moves "now" of the test process (the harness hands this same Date to its vm contexts); `new Date(x)` with an argument is untouched.
 */
const fake=process.env.FAKE_NOW;
if(fake){
  const real=Date,offset=new real(fake).getTime()-real.now();
  const patch=D=>{
    function F(...a){return a.length?new D(...a):new D(D.now()+offset);}
    F.prototype=D.prototype;F.now=()=>D.now()+offset;F.UTC=D.UTC;F.parse=D.parse;
    return F;
  };
  global.Date=patch(real);
}
