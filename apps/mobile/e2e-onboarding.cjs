/**
 * F29 headless onboarding walk (issue #4).
 * Usage: node e2e-onboarding.cjs  (serve dist first: `npx serve -sl 8085 ./dist`)
 * Toolchain per docs/MASTER-PLAN.md: expo export web -> serve -s -> playwright-core
 * driving Helium Chromium (`C:/Program Files/imput/Helium`).
 *
 * Walk: persona -> CBSE Class 10 -> subjects pre-ticked from presets ->
 * coverage -> baseline(skip) -> exams(skip) -> learning-style dial ->
 * completion lands on Today seeded with preset CBSE-10 topics.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const EXECUTABLE = 'C:/Program Files/imput/Helium/Application/chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:8085';
const ART = path.join(__dirname, 'e2e-artifacts');

// All CBSE class-10 preset topic names, read live from packages/presets data
const PRESET_DIR = path.join(__dirname, '..', '..', 'packages', 'presets', 'data', 'cbse', 'class10');
const KNOWN_TOPICS = fs.readdirSync(PRESET_DIR)
  .filter(f => f.endsWith('.json'))
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(PRESET_DIR, f), 'utf8')).topics
    .map(t => t.name));

let passed = 0, failed = 0;
function pass(step, detail) { passed++; console.log(`[PASS] ${step}${detail ? ' — ' + detail : ''}`); }
function fail(step, detail) { failed++; console.log(`[FAIL] ${step}${detail ? ' — ' + detail : ''}`); }
async function shot(page, name) {
  try { await page.screenshot({ path: path.join(ART, name), fullPage: false }); } catch {}
}

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--coep-required=false'],
  });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    // STEP 1: persona
    await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
    await page.getByText("Who's studying?", { exact: false }).first().waitFor({ timeout: 20000 });
    pass('1.persona', 'onboarding route renders persona screen');
    await shot(page, '01-persona.png');
    await page.getByText('Continue', { exact: true }).click();

    // STEP 2: board & class
    await page.getByText('Your board & class').waitFor({ timeout: 10000 });
    await page.getByText('CBSE', { exact: true }).click();
    await page.getByText('Class 10', { exact: true }).click();
    const cont2 = page.getByText('Continue', { exact: true });
    const color = await cont2.evaluate(el => getComputedStyle(el).color);
    // ok=true renders text-white (#fff); disabled renders text-dim
    /rgb\(255,\s*255,\s*255\)/.test(color)
      ? pass('2.board-class', 'CBSE + Class 10 selected, Continue enabled')
      : fail('2.board-class', `Continue not enabled (color="${color}")`);
    await shot(page, '02-board.png');
    await cont2.click();

    // STEP 3: subjects pre-ticked
    await page.getByText('Your subjects').waitFor({ timeout: 10000 });
    const expected = ['Mathematics', 'Science', 'English', 'Social Science'];
    const missing = [];
    for (const name of expected) {
      const row = page.getByText(name, { exact: true }).first();
      if (!(await row.isVisible().catch(() => false))) missing.push(name);
      else {
        const strike = await row.evaluate(el =>
          getComputedStyle(el).textDecorationLine.includes('line-through'));
        if (strike) missing.push(`${name} (struck-through)`);
      }
    }
    missing.length === 0
      ? pass('3.subjects-pre-ticked', expected.join(', '))
      : fail('3.subjects-pre-ticked', `missing/removed: ${missing.join(', ')}`);
    await shot(page, '03-subjects.png');
    await page.getByText('Continue', { exact: true }).click();

    // STEP 4: coverage chips
    await page.getByText('How far has school reached?').waitFor({ timeout: 10000 });
    pass('4.coverage', 'coverage screen rendered (skippable by design)');
    await shot(page, '04-coverage.png');
    await page.getByText('Continue', { exact: true }).click();

    // STEP 5: baseline (optional, skip)
    await page.getByText('Any recent scores?', { exact: false }).waitFor({ timeout: 10000 });
    pass('5.baseline', 'optional baseline screen rendered, skipped');
    await shot(page, '05-baseline.png');
    await page.getByText('Continue', { exact: true }).click();

    // STEP 6: exams (optional, skip)
    await page.getByText('Upcoming exams?').waitFor({ timeout: 10000 });
    pass('6.exams', 'exams screen rendered, skipped');
    await shot(page, '06-exams.png');
    await page.getByText('Enter Abhyas →', { exact: false }).or(page.getByText('Continue', { exact: true })).first().click();

    // STEP 7: learning-style dial
    await page.getByText('How well do you remember what you study?').waitFor({ timeout: 10000 });
    await page.getByText('🚶 About average').click();
    pass('7.style-dial', '"About average" selected');
    await shot(page, '07-style.png');
    await page.getByText('Enter Abhyas →', { exact: false }).click();

    // STEP 8: lands on Today, seeded with preset topics
    await page.waitForURL(u => !u.pathname.includes('onboarding'), { timeout: 15000 });
    await page.getByText("Today's plan", { exact: false }).waitFor({ timeout: 15000 });
    const body = await page.locator('body').innerText();
    const hit = KNOWN_TOPICS.find(t => body.includes(t));
    if (hit) {
      pass('8.today-seeded', `landed on Today; preset topic rendered: "${hit}"`);
    } else {
      fail('8.today-seeded', `no known CBSE-10 topic found on Today. body=${body.slice(0, 400)}`);
    }
    await shot(page, '08-today.png');
  } catch (e) {
    fail('walk-aborted', e.message.split('\n')[0]);
    await shot(page, '99-abort.png').catch(() => {});
  }

  if (errors.length) console.log(`\n[console-errors]\n${errors.slice(0, 5).join('\n')}`);
  console.log(`\nRESULT: ${failed === 0 ? 'ALL PASS' : 'FAILED'} (${passed} passed, ${failed} failed)`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
