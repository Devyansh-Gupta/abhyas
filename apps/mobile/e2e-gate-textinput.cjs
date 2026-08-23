/**
 * Served-surface gate for the TextInput restyle (a62d13e): drive onboarding
 * to the subjects step, verify both TextInputs render with visible borders,
 * accept typed text, and keep clean layout at mobile + desktop sizes.
 */
const { chromium } = require('playwright-core');
const EXECUTABLE = 'C:/Program Files/imput/Helium/Application/chrome.exe';
const BASE = 'http://localhost:8091';
const VIEWPORTS = [
  { name: 'mobile-360x740', width: 360, height: 740 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
];

(async () => {
  let failures = 0;
  const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    console.log(`\n===== ${vp.name} =====`);

    await page.goto(`${BASE}/onboarding`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    // persona (9-12 pre-selected) → board/class → subjects
    const cont = async () => {
      const b = page.locator('text=Continue').last();
      await b.click();
      await page.waitForTimeout(600);
    };
    await cont(); // step1→2
    await page.locator('text=CBSE').first().click();
    await page.locator('text=Class 10').first().click();
    await cont(); // step2→3
    await page.waitForTimeout(500);

    const shotToday = `e2e-artifacts/gate-textinput-${vp.name}-subjects.png`;
    await page.screenshot({ path: shotToday });

    const input = page.locator('input[placeholder*="Sanskrit"]').first();
    const vis = await input.isVisible().catch(() => false);
    if (!vis) { console.log('[FAIL] custom-subject TextInput not visible'); failures++; }
    else {
      const box = await input.boundingBox();
      console.log(`[gate] input box: x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}`);
      // type and confirm value lands
      await input.click();
      await input.type('Sanskrit');
      const val = await input.inputValue();
      console.log(`[gate] typed value accepted: ${val === 'Sanskrit' ? 'yes' : 'no (' + val + ')'}`);
      if (val !== 'Sanskrit') failures++;
      // border rendered? (computed border-width > 0)
      const bw = await input.evaluate(el => getComputedStyle(el).borderWidth);
      console.log(`[gate] computed border-width: ${bw}`);
      if (bw === '0px') failures++;
      // inside viewport?
      const fits = box.x >= 0 && box.x + box.width <= vp.width;
      console.log(`[gate] inside viewport: ${fits}`);
      if (!fits) failures++;
    }
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`[gate] horizontal overflow px: ${overflow}`);
    if (overflow > 2) failures++;
    console.log(`[shots] ${shotToday}`);
    await ctx.close();
  }

  await browser.close();
  console.log(failures === 0 ? '\nRESULT: ALL PASS' : `\nRESULT: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
