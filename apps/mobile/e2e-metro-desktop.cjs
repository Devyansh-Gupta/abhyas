/** Desktop-leg evidence for the Metro-loop session: render Today at 1280x800
 *  over HTTP from the current build (same commit as the emulator run). */
const { chromium } = require('playwright-core');
const EXECUTABLE = 'C:/Program Files/imput/Helium/Application/chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:8094/(tabs)', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body');
    const hasPlan = /Today's plan/i.test(body);
    const blocks = (body.match(/focus|revise/gi) || []).length;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.screenshot({ path: 'e2e-artifacts/metro-desktop-1280x800-today.png' });
    console.log(`[desktop] plan header: ${hasPlan} | block-ish strings: ${blocks} | overflow: ${overflow}px`);
    if (!hasPlan || overflow > 0) process.exitCode = 1;
    else console.log('[desktop] PASS — rendered surface clean at 1280x800');
  } finally {
    await browser.close();
  }
})();
