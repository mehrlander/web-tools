import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const artDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';

  // Desktop crops (1280px wide)
  const dPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const desktopShots = [
    { in: 'tools/.preview/desktop-chrono-rail.png', outCard: 'desktop-card-chrono-rail.png' },
    { in: 'tools/.preview/desktop-chrono-bar.png', outCard: 'desktop-card-chrono-bar.png' }
  ];

  for (const s of desktopShots) {
    if (fs.existsSync(s.in)) {
      const b64 = fs.readFileSync(s.in).toString('base64');
      await dPage.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff;"><img id="pic" src="data:image/png;base64,${b64}" style="width:1280px;display:block;" /></body></html>`);
      await dPage.waitForTimeout(200);

      // On desktop, the card with topics is around x=20, y=650, width=650, height=150
      await dPage.screenshot({
        path: path.join(artDir, s.outCard),
        clip: { x: 20, y: 650, width: 620, height: 150 }
      });
      console.log('Saved', s.outCard);
    }
  }
  await dPage.close();

  await browser.close();
}

run().catch(console.error);
