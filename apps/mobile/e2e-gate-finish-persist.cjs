/**
 * Served-surface gate for the onboarding finish→persist fix (3984da9).
 * Walks the FULL onboarding at two viewport sizes and asserts the post-finish
 * Today screen renders derived blocks (the surface this change affects).
 */
const { chromium } = require('playwright-core');
const EXECUTABLE = 'C:/Program Files/imput/Helium/Application/chrome.exe';
const BASE = 'http://localhost:8092';

async function walkViewport(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  let fails = 0;
  console.log(`\n===== ${vp.name} =====`);

  await page.goto(`${BASE}/onboarding`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const tap = async (sel) => { await page.locator(sel).last().click(); await page.waitForTimeout(450); };
  // step 1 persona: 9-12 pre-selected
  await page.locator('text=Continue').last().click(); await page.waitForTimeout(500);
  // step 2 board & class
  await page.locator('text=CBSE').first().click();
  await page.locator('text=Class 10').first().click();
  await page.locator('text=Continue').last().click(); await page.waitForTimeout(500);
  // step 3 subjects: all pre-ticked → continue
  await page.locator('text=Continue').last().click(); await page.waitForTimeout(500);
  // step 4 coverage: set Math to Half then continue
  await page.locator('text=Half').first().click(); await page.waitForTimeout(300);
  await page.locator('text=Continue').last().click(); await page.waitForTimeout(500);
  // step 5 baseline (optional) skip
  await page.locator('text=Continue').last().click(); await page.waitForTimeout(500);
  // step 6 exams skip
  await page.locator('text=Continue').last().click(); await page.waitForTimeout(500);
  // step 7 style dial: About average, then Enter
  await page.locator('text=About average').first().click(); await page.waitForTimeout(300);
  await page.locator('text=Enter Abhyas').last().click();
  await page.waitForTimeout(1500);

  // Post-finish surface: Today must show derived blocks, NOT the empty state.
  const body = await page.evaluate(() => document.body.innerText);
  const blocks = (body.match(/(\d+) blocks/) || [])[1];
  const onToday = /TODAY'S PLAN/.test(body);
  const noEmptyState = !body.includes('Start setup');
  console.log(`[gate] landed on Today: ${onToday}`);
  console.log(`[gate] derived block count: ${blocks}`);
  console.log(`[gate] empty-state absent: ${noEmptyState}`);
  if (!onToday) fails++;
  if (!blocks || blocks === '0') { console.log('[FAIL] zero derived blocks after onboarding'); fails++; }
  if (!noEmptyState) fails++;

  // topic names from the CBSE preset should render
  const hasTopic = /Trigonometry|Life Processes|Electricity|Light/.test(body);
  console.log(`[gate] seeded topic visible: ${hasTopic}`);
  if (!hasTopic) fails++;

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`[gate] horizontal overflow px: ${overflow}`);
  if (overflow > 2) fails++;

  const shot = `e2e-artifacts/gate-finish-${vp.name}-today.png`;
  await page.screenshot({ path: shot });
  console.log(`[shots] ${shot}`);

  await ctx.close();
  return fails;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
  let total = 0;
  for (const vp of [
    { name: 'mobile-360x740', width: 360, height: 740 },
    { name: 'desktop-1280x800', width: 1280, height: 800 },
  ]) {
    try { total += await walkViewport(browser, vp); }
    catch (e) { console.log(`[${vp.name}] walker error: ${e.message}`); total++; }
  }
  await browser.close();
  console.log(total === 0 ? '\nRESULT: ALL PASS' : `\nRESULT: ${total} FAILURE(S)`);
  process.exit(total === 0 ? 0 : 1);
})();
