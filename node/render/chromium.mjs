// The headless Chromium the render tools launch: Playwright's pinned build when
// it is installed, otherwise the browser the image ships. package.json pins
// playwright, and a Claude Code web image can carry a newer build under
// PLAYWRIGHT_BROWSERS_PATH, with `chromium` there linked to its binary; the
// pinned client then finds no executable and every shot fails (the snag
// pinned-playwright-misses-the-image-browser). Launching the image's binary by
// path, as the environment's own instructions direct, renders the same pages.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/** The image's Chromium, `$PLAYWRIGHT_BROWSERS_PATH/chromium`, when it exists. */
export function imageBrowser(env = process.env) {
  const p = env.PLAYWRIGHT_BROWSERS_PATH && path.join(env.PLAYWRIGHT_BROWSERS_PATH, 'chromium');
  return p && existsSync(p) ? p : null;
}

/** chromium.launch(options), retried on the image's browser when the pinned build is missing. */
export async function launch(options = {}, { browserType = chromium, env = process.env, log = console.error } = {}) {
  try {
    return await browserType.launch(options);
  } catch (error) {
    const fallback = imageBrowser(env);
    if (options.executablePath || !fallback || !/Executable doesn't exist/.test(String(error?.message))) throw error;
    log(`chromium: the pinned Playwright build is not installed; launching ${fallback}`);
    return browserType.launch({ ...options, executablePath: fallback });
  }
}
