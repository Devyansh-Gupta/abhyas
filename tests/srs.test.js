/* SRS golden tests: the memory engine's rating transitions, against real shipped code.
   Contract (PRD §7 / decision-proposals #1): Shaky drops a box (floored at 1),
   Getting-there holds, Solid promotes; dueIn always reschedules via INTERVALS[box];
   box≥5 ⇒ mastered ⇒ dueIn 99 (out of rotation); one rating per session. */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/Admin/Documents/Projects/StudySync/prototype/studysync-concept.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let code = scripts.join('\n');
code += `
;globalThis.__t = {
  get TOPICS(){ return TOPICS }, get ti(){ return ti }, set ti(v){ ti = v },
  get INTERVALS(){ return INTERVALS }, get sessionLog(){ return sessionLog },
  get preset(){ return preset },
  rateConf,
};`;

function makeEl(){ const el = { value:'', dataset:{}, style:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){}, onclick:null, closest(){return null} };
  let _t='', _h='';
  Object.defineProperty(el,'textContent',{ get(){return _t}, set(v){_t=String(v)} });
  Object.defineProperty(el,'innerHTML',{ get(){return _h}, set(v){_h=String(v)} });
  return el; }
const els = {};
const documentStub = {
  getElementById: id => (els[id] = els[id] || makeEl()),
  querySelector: () => null, querySelectorAll: () => [], addEventListener(){},
  body: makeEl(),
};
const ctx = vm.createContext({
  document: documentStub,
  localStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
  location:{search:'',href:'x'}, history:{replaceState(){}},
  setTimeout: ()=>0, clearTimeout(){}, clearInterval(){}, setInterval: ()=>0,
  console, JSON, Math, Date, URLSearchParams,
});
vm.runInContext(code, ctx);
documentStub.getElementById('streakN').textContent = '12';
const T = ctx.__t;
const find = name => T.TOPICS.find(t => t.name === name);

let pass=0, fail=0;
function eq(name, actual, expected){
  const ok = Object.is(actual, expected);
  ok?pass++:fail++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${name}` + (ok?'':`   [actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}]`));
}

console.log('— Solid promotes + reschedules by INTERVALS —');
const q = find('Quadratic Equations');
q.box = 1; q.dueIn = 0; T.ti = T.TOPICS.indexOf(q);
const logLen = T.sessionLog.length;
T.rateConf(3);
eq('Solid on box1 → box2', q.box, 2);
eq('dueIn = INTERVALS[2] = 3', q.dueIn, T.INTERVALS[2]);
eq('session logged', T.sessionLog.length, logLen+1);

console.log('— Getting-there holds pace —');
q.box = 2; q.dueIn = 0; T.rateConf._busy = false;
T.rateConf(2);
eq('rating 2 keeps box2', q.box, 2);
eq('dueIn re-pinned to INTERVALS[2]', q.dueIn, T.INTERVALS[2]);

console.log('— Shaky drops, floored at box1 —');
T.rateConf._busy = false;
T.rateConf(1);
eq('Shaky on box2 → box1', q.box, 1);
eq('dueIn = INTERVALS[1] = 1', q.dueIn, T.INTERVALS[1]);
T.rateConf._busy = false;
T.rateConf(1);
eq('Shaky on box1 floors at box1', q.box, 1);

console.log('— mastery ceiling: box5 leaves rotation —');
q.box = 4; q.dueIn = 7; T.rateConf._busy = false;
T.rateConf(3);
eq('Solid on box4 → box5 (mastered)', q.box, 5);
eq('mastered topics exit rotation (dueIn 99)', q.dueIn, 99);

console.log('— double-tap guard: one rating per session —');
q.box = 1; q.dueIn = 0;
T.rateConf._busy = false;            // fresh session (browser: >800ms since last rating)
const logLen2 = T.sessionLog.length;
T.rateConf(3);                       // first tap: counts, arms the guard
T.rateConf(1);                       // immediate second tap must be swallowed
eq('second tap ignored (box still 2)', q.box, 2);
eq('only ONE session logged', T.sessionLog.length - logLen2, 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
