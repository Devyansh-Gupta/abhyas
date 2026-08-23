/**
 * Plan-tab headless walk (master-plan row: "Plan tab — week strip + timetable editor").
 * Usage: node e2e-plan.cjs  (serve dist first: `npx serve -sl 8085 ./dist`)
 * Toolchain per docs/MASTER-PLAN.md / e2e-onboarding.cjs:
 *   expo export web -> serve -s -> playwright-core driving Helium Chromium.
 *
 * Walk: onboarding seeds topics -> Plan tab -> week strip renders 7 days ->
 * add a class period → derived study plan re-solves SAME RENDER (no reload) ->
 * cancel restores -> move (+1d) shifts the period off today.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const EXECUTABLE = 'C:/Program Files/imput/Helium/Application/chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:8085';
const ART = path.join(__dirname, 'e2e-artifacts');

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
  let reloads = 0;
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('load', () => { reloads++; });

  try {
    // ---- seed via onboarding (same flow as e2e-onboarding.cjs, condensed) ----
    await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
    await page.getByText("Who's studying?", { exact: false }).first().waitFor({ timeout: 20000 });
    await page.getByText('Continue', { exact: true }).click();
    await page.getByText('Your board & class').waitFor({ timeout: 10000 });
    await page.getByText('CBSE', { exact: true }).click();
    await page.getByText('Class 10', { exact: true }).click();
    await page.getByText('Continue', { exact: true }).click();
    for (const label of ['Your subjects', 'How far has school reached?', 'Any recent scores?']) {
      await page.getByText(label, { exact: false }).first().waitFor({ timeout: 10000 });
      await page.getByText('Continue', { exact: true }).click();
    }
    await page.getByText('Upcoming exams?').waitFor({ timeout: 10000 });
    await page
      .getByText('Enter Abhyas →', { exact: false })
      .or(page.getByText('Continue', { exact: true })).first().click();
    await page.getByText('How well do you remember what you study?').waitFor({ timeout: 10000 });
    await page.getByText('🚶 About average').click();
    await page.getByText('Enter Abhyas →', { exact: false }).click();
    await page.waitForURL(u => !u.pathname.includes('onboarding'), { timeout: 15000 });
    await page.getByText("Today's plan", { exact: false }).waitFor({ timeout: 15000 });
    pass('1.onboarding-seed', 'onboarding complete, Today seeded');

    // ---- Plan tab ----
    // client-side tab navigation ONLY — a real goto() would reload the page and
    // wipe the memory-only store (that's what step 8 proves we never trigger).
    await page.getByText('Plan', { exact: true }).last().click();
    await page.getByText('Week strip & timetable', { exact: false }).waitFor({ timeout: 15000 });
    const chips = await page.locator('[aria-label^="day-chip-"]').count();
    chips === 7
      ? pass('2.week-strip', `7 day chips rendered`)
      : fail('2.week-strip', `expected 7 day chips, got ${chips}`);

    const freeMinRe = /Free study (\d+)h(?:(\d+)m)?/;
    const readState = async () => {
      const body = await page.locator('body').innerText();
      const m = body.match(freeMinRe);
      const free = m ? Number(m[1]) * 60 + Number(m[2] || 0) : null;
      const blocks = [...body.matchAll(/(\d{2}:\d{2})\n([^\n]+) — (?:revise|focus)/g)]
        .map(x => `${x[1]} ${x[2]}`);
      return { free, blockCount: blocks.length, blocks };
    };

    const before = await readState();
    if (before.free === 390 && before.blockCount > 0) {
      pass('3.derived-baseline',
        `empty timetable: ${before.blockCount} derived blocks, free=${before.free}min (full window)`);
    } else {
      fail('3.derived-baseline', `free=${before.free}, blocks=${before.blockCount}; body=` +
        (await page.locator('body').innerText()).slice(0, 300));
    }
    await shot(page, 'plan-01-baseline.png');

    // same-frame sentinel: survives only if no page reload happens below
    await page.evaluate(() => { window.__planWalkNoReload = 1; });

    // ---- ADD a class period (Thu 17:30–18:30) → plan re-solves same frame ----
    await page.getByText('＋ Add class', { exact: true }).click();
    await page.getByText('17:30–18:30', { exact: true }).waitFor({ timeout: 5000 });
    const afterAdd = await readState();
    if (afterAdd.free === before.free - 60 && afterAdd.blocks.join('|') !== before.blocks.join('|')) {
      pass('4.add-resolves',
        `period added: free ${before.free}→${afterAdd.free}min, derived blocks re-solved without reload`);
    } else {
      fail('4.add-resolves',
        `free ${before.free}→${afterAdd.free} (want -60); blocksChanged=${afterAdd.blocks.join('|') !== before.blocks.join('|')}`);
    }
    await shot(page, 'plan-02-added.png');

    // ---- CANCEL the period → capacity + derived plan restore ----
    await page.getByText('Cancel', { exact: true }).click();
    await page.waitForFunction(
      prev => !document.body.innerText.includes('17:30–18:30'),
      null,
      { timeout: 5000 },
    ).catch(() => {});
    const afterCancel = await readState();
    if (afterCancel.free === before.free &&
        afterCancel.blockCount === before.blockCount &&
        afterCancel.blocks.join('|') === before.blocks.join('|')) {
      pass('5.cancel-restores',
        `cancel removed the period; plan restored exactly (${afterCancel.blockCount} blocks, free=${afterCancel.free}min)`);
    } else {
      fail('5.cancel-restores',
        `free=${afterCancel.free} (want ${before.free}), blocks=${afterCancel.blockCount} (want ${before.blockCount})`);
    }
    await shot(page, 'plan-03-cancelled.png');

    // ---- MOVE across weekdays (+1d): leaves Thursday, appears on Friday ----
    await page.getByText('＋ Add class', { exact: true }).click();
    await page.getByText('17:30–18:30', { exact: true }).waitFor({ timeout: 5000 });
    await page.getByText('+1d', { exact: true }).click();
    await page.waitForFunction(
      prev => !document.body.innerText.includes('17:30–18:30'),
      null,
      { timeout: 5000 },
    ).catch(() => {});
    const afterMove = await readState();
    if (afterMove.free === before.free) {
      pass('6.move-off-day', `+1d moved the period off Thu; Thu capacity restored (${afterMove.free}min)`);
    } else {
      fail('6.move-off-day', `free=${afterMove.free} (want ${before.free})`);
    }
    // Friday chip is index 1 → weekdayFor(1)=5=Fri
    await page.locator('[aria-label="day-chip-1"]').click();
    await page.getByText('Classes · Fri', { exact: false }).waitFor({ timeout: 5000 });
    const friHasPeriod = (await page.locator('body').innerText()).includes('17:30–18:30');
    friHasPeriod
      ? pass('7.moved-period-visible-fri', 'moved period renders under Fri in the week strip')
      : fail('7.moved-period-visible-fri', 'period not found on Fri after +1d move');
    await shot(page, 'plan-04-moved-to-fri.png');

    // ---- same-frame proof: no reload since sentinel ----
    const sentinel = await page.evaluate(() => window.__planWalkNoReload);
    const navs = reloads;
    sentinel === 1 && navs <= 1 // 1 load = initial /plan navigation itself
      ? pass('8.same-frame-no-reload', `no page reload during any edit (loads=${navs})`)
      : fail('8.same-frame-no-reload', `sentinel=${sentinel}, loads=${navs}`);
  } catch (e) {
    fail('walk-aborted', e.message.split('\n')[0]);
    await shot(page, 'plan-99-abort.png').catch(() => {});
  }

  if (errors.length) console.log(`\n[console-errors]\n${errors.slice(0, 5).join('\n')}`);
  console.log(`\nRESULT: ${failed === 0 ? 'ALL PASS' : 'FAILED'} (${passed} passed, ${failed} failed)`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
