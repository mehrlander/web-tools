// Where web-tools' screenshots are kept: web-tools-private's thumbs/, in the
// checkout beside this one. A page or a UI unit can show private data, so no
// screenshot is committed to this public repository. The galleries read the
// files with the viewer's token: pages/index.html, the app's Pages view and
// the Map view's units.
//
// pages-shots.mjs, ui-recipes.mjs (for ui-shots.mjs) and component-shots.mjs
// write here; pages-index.mjs names each page's shot with pageShot, which
// must agree with app/index.html's catalogThumbPath.

import path from 'node:path';
import { existsSync } from 'node:fs';
import { repoRoot } from '../repo-root.mjs';

export const SHOT_REPO = 'mehrlander/web-tools-private';
export const STORE_ROOT = path.resolve(repoRoot, '..', 'web-tools-private');

// A gallery page's shot, as a path in the store: the page's source path with
// .html swapped for .png, under thumbs/mehrlander/web-tools/.
export const pageShot = (src) =>
  `thumbs/mehrlander/web-tools/${String(src).replace(/\\/g, '/').replace(/\.html$/, '.png')}`;

// The folder of web-tools' UI-unit and component shots, in the store.
export const UNIT_SHOTS = 'thumbs/mehrlander/web-tools/ui-units';

export const storeReady = () => existsSync(path.join(STORE_ROOT, '.git'));

// Stops a writer when the store is not checked out beside this one, so a shot
// is never written into this repository instead.
export function requireStore(who) {
  if (storeReady()) return;
  console.error(`${who}: screenshots go to ${SHOT_REPO}'s thumbs/, and no checkout of it sits beside this one (${STORE_ROOT}).`);
  process.exit(2);
}
