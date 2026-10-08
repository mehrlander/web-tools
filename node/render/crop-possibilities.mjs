import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const artifactDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';
const previewDir = 'tools/.preview';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

  const shots = [
    { src: path.join(previewDir, 'shot-chrono-bar.png'), out: 'cropped-chrono-bar.png' },
    { src: path.join(previewDir, 'shot-chrono-ticks.png'), out: 'cropped-chrono-ticks.png' },
    { src: path.join(previewDir, 'shot-chrono-rail.png'), out: 'cropped-chrono-rail.png' },
    { src: path.join(previewDir, 'shot-chrono-hops.png'), out: 'cropped-chrono-hops.png' }
  ];

  for (const item of shots) {
    if (fs.existsSync(item.src)) {
      const b64 = fs.readFileSync(item.src).toString('base64');
      await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff;"><img id="pic" src="data:image/png;base64,${b64}" style="width:430px;display:block;" /></body></html>`);
      await page.waitForTimeout(200);

      const outCard = path.join(artifactDir, item.out);
      await page.screenshot({
        path: outCard,
        clip: { x: 14, y: 780, width: 402, height: 120 }
      });
      console.log(`Saved ${outCard}`);
    }
  }

  await browser.close();
}

run().catch(console.error);
