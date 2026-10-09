import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

async function crop() {
  const browser = await chromium.launch();
  const artDir = 'C:/Users/mehrl/.gemini/antigravity/brain/26c2bc15-08fb-4950-ad6e-f28d365ccfec';

  // 1. Mobile crops (430px wide)
  const mPage = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const mB64 = fs.readFileSync('tools/.preview/fixed-chrono-bar.png').toString('base64');
  await mPage.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff;"><img src="data:image/png;base64,${mB64}" style="width:430px;display:block;"></body></html>`);
  await mPage.waitForTimeout(200);

  // Card 1: Reviewing Status Marker Misuse (entire card with topics)
  await mPage.screenshot({
    path: path.join(artDir, 'fixed-card1-mobile.png'),
    clip: { x: 14, y: 512, width: 402, height: 165 }
  });

  // Card 2: Waiting View Deck (staircase with 5 topics)
  await mPage.screenshot({
    path: path.join(artDir, 'fixed-card2-mobile.png'),
    clip: { x: 14, y: 780, width: 402, height: 215 }
  });

  // 2. Desktop crops (1280px wide)
  const dPage = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  const dB64 = fs.readFileSync('tools/.preview/fixed-desktop-chrono-bar.png').toString('base64');
  await dPage.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fff;"><img src="data:image/png;base64,${dB64}" style="width:1280px;display:block;"></body></html>`);
  await dPage.waitForTimeout(200);

  // Card 1 on desktop (topics area + card context)
  await dPage.screenshot({
    path: path.join(artDir, 'fixed-card1-desktop.png'),
    clip: { x: 18, y: 535, width: 920, height: 75 }
  });

  // Card 2 on desktop (staircase with topics)
  await dPage.screenshot({
    path: path.join(artDir, 'fixed-card2-desktop.png'),
    clip: { x: 18, y: 815, width: 920, height: 215 }
  });

  await browser.close();
  console.log('Saved fixed crops to artifacts');
}

crop().catch(console.error);
