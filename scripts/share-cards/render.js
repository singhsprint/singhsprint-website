// Renders out/html/*.html to 1200x630 JPEGs. Needs Playwright.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const dir = process.argv[2]; const files = fs.readdirSync(dir + '/html').filter(f => f.endsWith('.html'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const f of files) {
    await p.goto('file://' + path.resolve(dir, 'html', f)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(dir, f.replace('.html', '.jpg')), type: 'jpeg', quality: 86 });
  }
  await b.close(); console.log(files.length);
})();
