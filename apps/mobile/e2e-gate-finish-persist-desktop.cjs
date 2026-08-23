/** Desktop-only finish→persist gate (fresh browser; Helium dies after long walks). */
const { chromium } = require('playwright-core');
const EXECUTABLE = 'C:/Program Files/imput/Helium/Application/chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8092/onboarding', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  const tap = async (sel) => { await page.locator(sel).last().click(); await page.waitForTimeout(400); };
  await page.locator('text=Continue').last().click(); await page.waitForTimeout(450);
  await page.locator('text=CBSE').first().click();
  await page.locator('text=Class 10').first().click();
  await tap('text=Continue');
  await tap('text=Continue');                       // subjects pre-ticked
  await page.locator('text=Half').first().click();
  await tap('text=Continue');                       // coverage
  await tap('text=Continue');                       // baseline skip
  await tap('text=Continue');                       // exams skip
  await page.locator('text=About average').first().click();
  await tap('text=Enter Abhyas');
  await page.waitForTimeout(1200);
  const body = await page.evaluate(() => document.body.innerText);
  const blocks = (body.match(/(\d+) blocks/) || [])[1];
  const onToday = /TODAY'S PLAN/.test(body);
  const hasTopic = /Trigonometry|Life Processes|Electricity|Light/.test(body);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`[gate] landed on Today: ${onToday} | blocks: ${blocks} | topic visible: ${hasTopic} | overflow: ${overflow}px`);
  await page.screenshot({ path: 'e2e-artifacts/gate-finish-desktop-1280x800-today.png' });
  const pass = onToday && Number(blocks) > 0 && hasTopic && overflow <= 2;
  console.log(pass ? 'DESKTOP LEG: ALL PASS' : 'DESKTOP LEG: FAIL');
  process.exit(pass ? 0 : 1);
})();
