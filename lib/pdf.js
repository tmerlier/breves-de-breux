// Génère un PDF à partir d'une page HTML déjà paginée par Paged.js.
// Brique volontairement isolée : c'est la seule à réécrire pour une future
// génération serverless (ex. @sparticuz/chromium sur Vercel).
const puppeteer = require('puppeteer');

// Charge `url`, attend la fin de pagination Paged.js, écrit le PDF dans
// `outputPath`. Lance Chromium à la demande et le ferme dans tous les cas.
async function generatePdf({ url, outputPath }) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    // Paged.js positionne window.__PAGEDJS_DONE__ via PagedConfig.after.
    await page.waitForFunction(() => window.__PAGEDJS_DONE__ === true, {
      timeout: 60000,
    });
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return outputPath;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf };
