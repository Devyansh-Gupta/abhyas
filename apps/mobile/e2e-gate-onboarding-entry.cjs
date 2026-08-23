/**
 * OMH served-surface verification gate for the onboarding entry-point fix
 * (commit f8b8f98): Today must render a "Start setup →" button when the store
 * has no topics, and tapping it must land on the onboarding persona screen.
 * Runs against http://localhost:8090 at two viewport sizes.
 */
const { chromium } = require('playwright-core');

const HELIUM = 'C:/Program Files/imput/Helium';
const EXECUTABLE = `${HELIUM}/Application/chrome.exe`;
const BASE = 'http://localhost:8090';
const VIEWPORTS = [
  { name: 'mobile-360x740', width: 360, height: 740 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
  });
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

    console.log(`\n===== ${vp.name} (${vp.width}x${vp.height}) =====`);
    // Fresh state: clear any persisted localStorage from prior walks so we hit
    // the true first-launch path.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const shot1 = `e2e-artifacts/gate-${vp.name}-today.png`;
    await page.screenshot({ path: shot1 });

    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasWelcome = bodyText.includes('Set up your syllabus');
    const btn = page.locator('text=Start setup').first();
    const btnVisible = await btn.isVisible().catch(() => false);
    const btnBox = btnVisible ? await btn.boundingBox() : null;
    console.log(`[gate] welcome text present: ${hasWelcome}`);
    console.log(`[gate] "Start setup" button visible: ${btnVisible}`);
    if (btnBox) {
      const fits = btnBox.x >= 0 && btnBox.x + btnBox.width <= vp.width;
      console.log(`[gate] button box: x=${Math.round(btnBox.x)} w=${Math.round(btnBox.width)} — inside viewport: ${fits}`);
      if (!fits) failures++;
    } else if (btnVisible) {
      console.log('[gate] button visible but no box (layout anomaly)');
      failures++;
    }
    if (!btnVisible) failures++;
    if (!hasWelcome) failures++;

    // Text-layout sanity at this size: no horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    console.log(`[gate] horizontal overflow px: ${overflow}`);
    if (overflow > 2) failures++;

    // Interaction: tap through to onboarding
    if (btnVisible) {
      await btn.click();
      await page.waitForTimeout(2000);
      const url = page.url();
      const text = await page.evaluate(() => document.body.innerText);
      const landed = /onboarding/i.test(url) || /persona|learner|how do you learn/i.test(text);
      console.log(`[gate] after tap: url=${url} landed-on-onboarding=${landed}`);
      if (!landed) failures++;
      const shot2 = `e2e-artifacts/gate-${vp.name}-onboarding.png`;
      await page.screenshot({ path: shot2 });
      console.log(`[shots] ${shot1} | ${shot2}`);
    }

    if (errors.length) {
      console.log(`[gate] page errors: ${errors.slice(0, 3).join(' | ')}`);
      failures++;
    }
    await ctx.close();
  }

  await browser.close();
  console.log(`\nRESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures === 0 ? 0 : 1);
})();
