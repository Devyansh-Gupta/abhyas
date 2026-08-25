const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launchPersistentContext(
    'C:/Users/Admin/Documents/Projects/StudySync/.auth-profile',
    { executablePath: 'C:/Program Files/imput/Helium/Application/chrome.exe',
      headless: false, viewport: { width: 1280, height: 900 } }
  );
  const page = await browser.newPage();
  await page.goto('https://supabase.com/signup');
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  const googleBtn = page.locator('text=Continue with Google').first();
  const vis = await googleBtn.isVisible().catch(() => false);
  console.log('Google btn visible:', vis);
  if (vis) {
    await googleBtn.click();
    await page.waitForTimeout(6000);
    console.log('after-click URL:', page.url());
    const body = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log('PAGE TEXT:', body.replace(/\n+/g, ' | '));
    await page.screenshot({ path: 'C:/Users/Admin/Documents/Projects/StudySync/.auth-profile/signup-state.png' });
  }
})();
