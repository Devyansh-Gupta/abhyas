/** Onboarding walk v4 — steps verified against real wizard flow (7 steps). */
const { chromium } = require('playwright-core');
const EXECUTABLE = 'C:/Program Files/imput/Helium/Application/chrome.exe';
const BASE = 'http://localhost:8093';

async function clickContinue(page) {
  const btn = page.getByText(/^Continue/i).last();
  for (let i = 0; i < 25; i++) {
    if (await btn.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(200);
  }
  await btn.click();
  await page.waitForTimeout(700);
}

async function onboard(page) {
  await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  // S1 persona → S2 board/class
  await clickContinue(page);
  await page.getByText('CBSE', { exact: true }).first().click();
  await page.getByText('Class 10', { exact: true }).first().click();
  await clickContinue(page); // → S3 subjects (pre-ticked)
  await clickContinue(page); // → S4 coverage
  await page.getByText('Half', { exact: true }).first().click().catch(() => {});
  await clickContinue(page); // → S5 baseline (has Continue, not Skip)
  await clickContinue(page); // → S6 exams
  await clickContinue(page); // → S7 style
  await page.getByText(/average/i).first().click().catch(() => {});
  await page.waitForTimeout(200);
  const enter = page.getByText(/^Enter/i).first();
  for (let i = 0; i < 15; i++) {
    if (await enter.isVisible().catch(() => false)) break;
    await page.waitForTimeout(300);
  }
  await enter.click();
  await page.waitForTimeout(1200);
}

async function runLeg(name, viewport) {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
  try {
    const page = await browser.newPage({ viewport });
    await onboard(page);
    await page.screenshot({ path: `e2e-artifacts/gate-uxc1-${name}-today.png` });
    const body1 = await page.textContent('body');
    if (/Start setup/i.test(body1) || /STEP \d/i.test(body1)) {
      console.log(`[${name}] FAIL: onboarding did not complete`);
      process.exitCode = 1;
      return;
    }
    const start = page.getByText('Start →').first();
    if (!(await start.isVisible().catch(() => false))) {
      console.log(`[${name}] FAIL: hero Start not visible after onboarding`);
      process.exitCode = 1;
      return;
    }
    await start.click();
    await page.waitForTimeout(1400);
    const body2 = await page.textContent('body');
    const unbound = /no topic bound/i.test(body2);
    await page.screenshot({ path: `e2e-artifacts/gate-uxc1-${name}-focus.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (unbound) {
      console.log(`[${name}] FAIL: Focus unbound after hero Start`);
      process.exitCode = 1;
    } else if (overflow > 0) {
      console.log(`[${name}] FAIL: ${overflow}px overflow on Focus`);
      process.exitCode = 1;
    } else {
      console.log(`[${name}] PASS: hero Start → bound session | overflow 0px`);
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  await runLeg('mobile-360x740', { width: 360, height: 740 });
  await runLeg('desktop-1280x800', { width: 1280, height: 800 });
})();
