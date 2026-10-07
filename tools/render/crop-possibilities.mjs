import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const artifactDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';
const previewDir = 'tools/.preview';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

  const extraShots = [
    { src: path.join(previewDir, 'possibility-databar-nonum.png'), out: 'cropped-databar-nonum.png', artFull: 'possibility-databar-nonum.png' },
    { src: path.join(previewDir, 'possibility-databar-withnum.png'), out: 'cropped-databar-withnum.png', artFull: 'possibility-databar-withnum.png' }
  ];

  for (const item of extraShots) {
    if (fs.existsSync(item.src)) {
      fs.copyFileSync(item.src, path.join(artifactDir, item.artFull));
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
