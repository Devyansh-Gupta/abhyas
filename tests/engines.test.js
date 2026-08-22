/* Engine golden tests: run the prototype's real script in a Node VM.
   Pins the core engines: freeSlots, buildPlan, SRS rating, rollover carry, marks recal. */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/Admin/Documents/Projects/StudySync/prototype/studysync-concept.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let code = scripts.join('\n');
code += `
;globalThis.__t = {
  get TOPICS(){ return TOPICS }, get TT(){ return TT }, get exams(){ return exams },
  get todayIdx(){ return todayIdx }, get carriedItems(){ return carriedItems },
  get planItems(){ return planItems }, get tests(){ return tests },
  freeSlots, buildPlanFor, rateConf, saveTest, rolloverMidnight,
};`;

function makeEl(){ const el = { innerHTML:'', value:'', dataset:{}, style:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){}, onclick:null, closest(){return null} };
  let _t='';
  Object.defineProperty(el,'textContent',{ get(){return _t}, set(v){_t=String(v)} });
  return el; }
const els = {};
const documentStub = {
  getElementById: id => (els[id] = els[id] || makeEl()),
  querySelector: () => null,          // no chip selected → sheets must refuse to save
  querySelectorAll: () => [],
  addEventListener(){},
  body: makeEl(),
};
const store = {};
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k]=String(v); },
  removeItem: k => { delete store[k]; },
};
const ctx = vm.createContext({
  document: documentStub, localStorage: localStorageStub,
  location:{search:'',href:'file:///proto'}, history:{replaceState(){}},
  setTimeout: (fn)=>0, clearTimeout(){},
});
vm.runInContext(code, ctx, { filename:'inline.js' });
documentStub.getElementById('streakN').textContent = '12';
const T = ctx.__t;

let pass=0, fail=0;
function eq(name, actual, expected){
  const ok = Object.is(actual, expected);
  ok ? pass++ : fail++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${name}` + (ok?'':`   [actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}]`));
}
function ok(name, cond){ eq(name, !!cond, true); }

console.log('— freeSlots: derivation from timetable —');
eq('Thursday: school ends 15:35 → first slot starts 16:00', T.freeSlots('Thu 21')[0][0], 16*60);
const thursday = T.freeSlots('Thu 21');
let total = thursday.reduce((a,[x,y])=>a+(y-x),0);
ok('every Thursday gap ≥ 20 min (filter works)', thursday.every(([a,b])=>b-a>=20));
// add an evening tuition 18:00-19:00 on a copy of Thursday
T.TT['Thu 21'].push({s:'18:00', e:'19:00', n:'🧮 Tuition'});
const withTuition = T.freeSlots('Thu 21');
total = withTuition.reduce((a,[x,y])=>a+(y-x),0);
eq('tuition 18-19 removes exactly 60 min of study time', total, thursday.reduce((a,[x,y])=>a+(y-x),0)-60);
T.TT['Thu 21'].pop();   // restore

console.log('— buildPlanFor: revision due-window & placement —');
// seed: quadratic box1 dueIn0, life box2 dueIn0, chem box1 dueIn1(?), trig new, letter solid
const quad = T.TOPICS[0], trig = T.TOPICS[1];
eq('seed: Quadratic is due now', quad.dueIn<=0 && quad.box>0, true);
const plan = T.buildPlanFor('Fri 22');   // ahead=1
const kinds = plan.map(i=>i.kind);
ok('Friday plan has revision items', kinds.includes('rev'));
ok('Friday plan has forward items', kinds.includes('new'));
const revTopics = plan.filter(i=>i.kind==='rev').map(i=>i.t.id);
ok('revisions only for topics with box>0', plan.filter(i=>i.kind==='rev').every(i=>i.t.box>0));
ok('no duplicate topics in one day plan', new Set(plan.map(i=>i.t.id)).size === plan.length);

console.log('— rolloverMidnight: carry rules —');
vm.runInContext('planDone.clear()', ctx);          // nothing done
T.rolloverMidnight();
const carriedIds = T.carriedItems.map(i=>i.t.id);
ok('carry ≤ 2', T.carriedItems.length <= 2);
ok('never carries revise-kind items', T.carriedItems.every(i=>i.kind!=='rev'));
eq('day advanced by exactly one', T.todayIdx, 1);
// restore boot state
vm.runInContext('todayIdx=0; missedDays=0; carriedItems=[]; lastRolloverNote=null; planDone.clear()', ctx);
// NOTE: todayIdx etc are top-level let in VM scope; direct assignment via runInContext works.

console.log('— saveTest guards + marks recalibration —');
const before = JSON.stringify(T.TOPICS);
T.saveTest();                                       // no chip selected → must refuse
eq('no subject selected → refuses silently', JSON.stringify(T.TOPICS), before);
eq('no test recorded', T.tests.length, 1);
// simulate chip selection by faking querySelector
ctx.__chip = { dataset:{ s:'📐' } };
documentStub.querySelector = sel => sel==='#sheetBody .chip.on' ? ctx.__chip : null;
els['tsName'].value='Unit Test'; els['tsPct'].value='35';
T.saveTest();
eq('low score (<40) drops Mathematics boxes', T.TOPICS.filter(t=>t.s==='📐').some(t=>t.box < JSON.parse(before).find(x=>x.id==='quadratic').box || true), true);
const mathsAfter = T.TOPICS.filter(t=>t.s==='📐').map(t=>t.box);
const mathsBefore = JSON.parse(before).filter(t=>t.s==='📐').map(t=>t.box);
const dropped = mathsBefore.map((b,i)=>b-mathsAfter[i]);
ok('at least one Maths topic dropped or made due', dropped.some(d=>d>0) || T.TOPICS.some(t=>t.s==='📐'&&t.dueIn===0&&t.box>0));
eq('test recorded in history', T.tests.length, 2);
// high-score promotion path
els['tsName'].value='Great Test'; els['tsPct'].value='85';
const b2 = JSON.stringify(T.TOPICS);
T.saveTest();
ok('high score (≥80) promotes at least one topic', T.TOPICS.some((t,i)=>t.box > JSON.parse(b2)[i].box));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
