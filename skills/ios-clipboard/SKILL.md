---
name: ios-clipboard
description: Copy and paste on iOS Safari. Use when building web apps that need clipboard access on iPhone or iPad, especially in data URL contexts (bookmarklets, paste-and-run pages) where the modern clipboard API is unavailable.
---

# iOS Clipboard

iOS Safari requires user confirmation for paste in every context. The user always sees an edit-menu pill (Paste / Speak) and taps Paste to confirm. There is no way to bypass that pill, and there is no separate "Allow Paste" modal: just the pill, in every paste path.

The decision is which paste path to use. The textarea trick works everywhere. `navigator.clipboard.readText()` is undefined on data URLs and throws. Given that, default to the textarea.

## Paste

```html
<textarea id="buf" class="absolute opacity-0 -top-[1000px]" inputmode="none"></textarea>
```

```javascript
function paste(callback) {
  const buf = document.getElementById('buf');
  buf.value = '';
  buf.focus();
  setTimeout(() => {
    document.execCommand('paste');
    setTimeout(() => {
      callback(buf.value);
      buf.value = '';
    }, 50);
  }, 0);
}

button.addEventListener('click', () => paste(text => {
  destination.innerText = text;
}));
```

User flow: tap button, edit-menu pill appears, tap Paste, callback fires.

The textarea attributes each earn their keep:

- `opacity-0` plus offscreen positioning. Element must be focusable, which rules out `display:none` and `visibility:hidden`.
- `inputmode="none"` suppresses the soft keyboard. Without it, the keyboard pops on every paste. Mechanism still works, just looks ugly.
- Don't use `readonly`. It focuses fine but `execCommand('paste')` returns empty, and iOS zooms toward the readonly element.

The nested timeouts let focus settle and the paste complete before the read.

## Copy

On https:

```javascript
await navigator.clipboard.writeText(text);
```

Silent, no menu. This is the one operation iOS doesn't gate.

On data URLs (where `navigator.clipboard` is undefined), use the textarea:

```javascript
buf.value = text;
buf.focus();
buf.select();
document.execCommand('copy');
buf.value = '';
```

Or just use ClipboardJS, which handles both contexts internally and is a fine default if it's already in the bundle.

ClipboardJS's success event hands you `clearSelection()`. Only call it when you copied from a visible selection that needs clearing. Its first act is to focus the trigger, and it never blurs, so a script-driven focus ring lands on your button (a plain tap leaves none). Copying a plain string via the `text` option leaves nothing to clear: skip it. If you do need it, blur the trigger right after.

## Don't bother trying

- Bypassing the paste pill. Not possible. iOS gates clipboard reads behind a user gesture plus visible confirmation in every path.
- `navigator.clipboard.readText()` instead of the textarea. Works on https with the same pill, but undefined on data URLs. The textarea covers both with identical UX.
- Document-level paste listener as the trigger. Listener fires when paste lands on a focused editable, but you still need that focused editable. The textarea is the trigger.
- Long-tap paste on plain divs. iOS only offers Paste in editable contexts (textarea, input, contenteditable).
- Auto-focus on load to skip a tap. Doesn't reliably trigger the pill, and creates other UX problems.

## Why default to the textarea on https

Both paths work on https with the same pill. Use the textarea anyway, so the same code covers data URL contexts where `readText()` is undefined. One path, two contexts.
