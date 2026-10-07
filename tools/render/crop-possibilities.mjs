import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const artifactDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  const modes = ['ticks', 'bar', 'databar', 'pips', 'weight'];

  for (const m of modes) {
    const src = path.join(artifactDir, `possibility-${m}.png`).replace(/\\/g, '/');
    const b64 = fs.readFileSync(src).toString('base64');
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff;"><img id="pic" src="data:image/png;base64,${b64}" style="width:430px;display:block;" /></body></html>`);
    await page.waitForTimeout(200);

    // Topic card area on possibility shots: around y=780 to 900
    // And also the full second card: y=700 to 900
    const outCard = path.join(artifactDir, `cropped-${m}.png`);
    await page.screenshot({
      path: outCard,
      clip: { x: 14, y: 780, width: 402, height: 120 }
    });
    console.log(`Saved ${outCard}`);
  }

  // Also crop the default dot mode from topics-desktop-dot.png
  const dotDesktopSrc = path.join(artifactDir, 'topics-desktop-dot.png');
  if (fs.existsSync(dotDesktopSrc)) {
    const b64 = fs.readFileSync(dotDesktopSrc).toString('base64');
    const dPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await dPage.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff;"><img id="pic" src="data:image/png;base64,${b64}" style="width:1280px;display:block;" /></body></html>`);
    await dPage.waitForTimeout(200);
    const outDot = path.join(artifactDir, 'cropped-dot.png');
    await dPage.screenshot({
      path: outDot,
      clip: { x: 20, y: 655, width: 500, height: 245 }
    });
    console.log(`Saved ${outDot}`);
    await dPage.close();
  }

  await browser.close();
}

run().catch(console.error);
