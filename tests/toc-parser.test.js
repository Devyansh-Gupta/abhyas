/* TOC parser golden tests: run onboarding-flow.html's real script in a Node VM.
   The parser is the T2 (paste-your-textbook) acquisition tier's core — historically
   buggy (F4: newline-stripped paste), so its contract is pinned here. */
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/Admin/Documents/Projects/StudySync/prototype/onboarding-flow.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let code = scripts.join('\n');
// export shim: expose the parse result the same way the UI reads it (tocOut innerHTML),
// plus a helper that returns parsed topic names by re-running the same pipeline.
code += `
;globalThis.__t = {
  get cur(){ return cur },
  parseToc,
  // test hook: parse raw text → array of topic names using the SAME code path
  parseTocRaw(raw){
    document.getElementById('tocBox').value = raw;
    parseToc();
    const out = document.getElementById('tocOut').innerHTML;
    const names = [...out.matchAll(/<b>([^<]+)<\\/b><span class="n">new<\\/span>/g)].map(m=>m[1]);
    const head = out.match(/<b>(\\d+) topics? detected<\\/b>/);
    return { count: head ? +head[1] : 0, names };
  },
};`;

function makeEl(){ const el = { value:'', dataset:{}, style:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){}, onclick:null };
  let _t='', _h='';
  Object.defineProperty(el,'textContent',{ get(){return _t}, set(v){_t=String(v)} });
  Object.defineProperty(el,'innerHTML',{ get(){return _h}, set(v){_h=String(v)} });
  return el; }
const els = {};
const steps = [makeEl(),makeEl(),makeEl(),makeEl(),makeEl(),makeEl(),makeEl()];
const ctx = vm.createContext({
  document: {
    getElementById: id => {
      els[id] = els[id] || makeEl();
      if(id==='tocBox' && !('value' in els[id])) {} // value already settable
      return els[id];
    },
    querySelector: () => null,
    querySelectorAll: sel => sel==='.step' ? steps : [],
    addEventListener(){}, body: makeEl(),
  },
  localStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
  location:{search:'',href:'x'}, history:{replaceState(){}},
  setTimeout, clearTimeout, console, JSON, Math, Date, URLSearchParams,
});
vm.runInContext(code, ctx);
const P = raw => ctx.__t.parseTocRaw(raw);

let pass=0, fail=0;
function eq(name, actual, expected){
  const ok = JSON.stringify(actual)===JSON.stringify(expected);
  ok?pass++:fail++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${name}` + (ok?'':`   [actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}]`));
}

console.log('— canonical inputs —');
eq('numbered lines', P('1. Quadratic Equations\n2. Trigonometry\n3. Linear Equations'),
   {count:3, names:['Quadratic Equations','Trigonometry','Linear Equations']});
eq('paren style', P('1) Photosynthesis\n2) Respiration'), {count:2, names:['Photosynthesis','Respiration']});

console.log('— hostile real-world input (F4 regression) —');
eq('newline-stripped paste with inline numbering',
   P('1. Chemical Reactions 2. Acids and Bases 3. Metals and Non-metals 4. Life Processes'),
   {count:4, names:['Chemical Reactions','Acids and Bases','Metals and Non-metals','Life Processes']});
eq('mangled spacing: pre-number fragment preserved, not eaten',
   P('quadratic equations 4. Quadratic Equations 5. Polynomials'),
   {count:3, names:['quadratic equations','Quadratic Equations','Polynomials']});

console.log('— edge cases —');
eq('empty input', P(''), {count:0, names:[]});
eq('whitespace only', P('   \n  '), {count:0, names:[]});
eq('trailing punctuation stripped', P('1. Nationalism in India.\n2) Resources & Development]'),
   {count:2, names:['Nationalism in India','Resources & Development']});
eq('two-digit numbers', P('10. Heredity and Evolution\n11. Our Environment'),
   {count:2, names:['Heredity and Evolution','Our Environment']});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
