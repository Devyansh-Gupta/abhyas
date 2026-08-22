/* Golden test v2: prototype's real script in a VM — streak break/earn semantics.
   Asserts ONLY on DOM text (what users see); prints diagnostics on mismatch. */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/Admin/Documents/Projects/StudySync/prototype/studysync-concept.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let code = scripts.join('\n');
code += `
;globalThis.__t = {
  get todayIdx(){ return todayIdx },
  get missedDays(){ return missedDays },
  get todayStats(){ return todayStats },
  get streakCounted(){ return streakCounted },
  bumpStreakCheck, advanceDay, persist,
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
  querySelector: () => null, querySelectorAll: () => [], addEventListener(){},
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
  setTimeout, clearTimeout, console, JSON, Math, Date, URLSearchParams,
});
vm.runInContext(code, ctx, { filename:'inline.js' });
documentStub.getElementById('streakN').textContent = '12';   // static HTML default

let pass=0, fail=0;
function eq(name, actual, expected){
  const ok = Object.is(actual, expected);
  ok ? pass++ : fail++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${name}` + (ok?'':`   [actual=${JSON.stringify(actual)} (${typeof actual}) expected=${JSON.stringify(expected)}]`));
}
const streakEl = () => documentStub.getElementById('streakN');
const S = () => streakEl().textContent;
const T = ctx.__t;

console.log('— boot —');
eq('seed streak is 12', S(), '12');
eq('day pointer Thursday (todayIdx 0)', T.todayIdx, 0);

console.log('— day 1 closes, no activity —');
T.advanceDay();
eq('advanced to Friday', T.todayIdx, 1);
eq('missedDays = 1', T.missedDays, 1);
eq('one miss forgiven — streak holds 12', S(), '12');

console.log('— day 2 closes, no activity —');
T.advanceDay();
eq('advanced to Saturday', T.todayIdx, 2);
eq('streak BROKE to 0', S(), '0');
eq('morning note flags the break', documentStub.getElementById('planSection').innerHTML.includes('Streak reset'), true);
eq('missed counter reset', T.missedDays, 0);

console.log('— earn again after the break —');
T.todayStats.blocks = 1;
T.bumpStreakCheck();
eq('re-earns 0 → 1', S(), '1');
T.advanceDay();
eq('earned day clears missed counter', T.missedDays, 0);
eq('streak holds at 1 into new day', S(), '1');

console.log('— earned rollover increments —');
T.todayStats.blocks = 1;
T.bumpStreakCheck();
T.advanceDay();
eq('streak 1 → 2 across earned day', S(), '2');

console.log('— persistence roundtrip —');
T.persist();
eq('store contains missedDays', store['abhyas_proto_v1'].includes('"missedDays"'), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
