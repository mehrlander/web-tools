(() => {
  let jszipMod;

  const loadZip = async () => {
    if (typeof JSZip !== 'undefined') return JSZip;
    jszipMod ??= await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm').then(m => m.default);
    return jszipMod;
  };

  const triggerDownload = (blob, filename) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 150);
  };

  const pickFile = (accept) => new Promise((resolve, reject) => {
    const f = Object.assign(document.createElement('input'), { type: 'file', accept });
    f.onchange = () => f.files[0] ? resolve(f.files[0]) : reject(new Error('No file selected'));
    f.oncancel = () => reject(new Error('Cancelled'));
    f.click();
  });

  let copyAbort = null;
  let pasteAbort = null;

  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    const success = document.execCommand('copy');
    document.body.removeChild(ta);
    return success;
  };

  const fallbackPaste = () => new Promise((resolve) => {
    const ta = document.createElement('textarea');
    ta.setAttribute('inputmode', 'none');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    setTimeout(() => {
      const ok = document.execCommand('paste');
      setTimeout(() => {
        const value = ok ? ta.value : null;
        ta.remove();
        resolve(value);
      }, 50);
    }, 0);
  });

  const io = {
    pick: async (accept = '*/*') => (await pickFile(accept)).arrayBuffer(),

    pickText: async (accept = '.txt,.json,.csv') => (await pickFile(accept)).text(),

    save: (data, filename = 'download.bin', type = 'application/octet-stream') => {
      const blob = data instanceof Blob ? data : new Blob([data], { type });
      triggerDownload(blob, filename);
    },

    saveJson: (data, filename = 'data.json', space = 2) => {
      const blob = new Blob([JSON.stringify(data, null, space)], { type: 'application/json' });
      triggerDownload(blob, filename);
    },

    saveZip: async (files, filename = 'archive.zip') => {
      const JSZip = await loadZip();
      const zip = new JSZip();

      const resolved = await Promise.all(files.map(async ({ path, data, url }) => ({
        path,
        content: data ?? await fetch(url).then(r => r.blob())
      })));
      for (const { path, content } of resolved) zip.file(path, content);

      triggerDownload(await zip.generateAsync({ type: 'blob' }), filename);
    },

    show: (data, type = 'application/pdf') => {
      const blob = data instanceof Blob ? data : new Blob([data], { type });
      window.open(URL.createObjectURL(blob), '_blank', 'width=1000,height=800,resizable');
    },

    copy: async (text) => {
      if (!document.hasFocus()) {
        if (copyAbort) copyAbort.abort();
        copyAbort = new AbortController();

        console.log("%c🖱️ Click the page document to copy...", "color: orange; font-weight: bold;");

        return new Promise((resolve) => {
          document.addEventListener('click', async () => {
            copyAbort = null;
            await io.copy(text);
            resolve();
          }, { once: true, signal: copyAbort.signal });
        });
      }

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          console.log("%c✅ Copied via Navigator API", "color: green; font-weight: bold;");
          return true;
        } catch (err) {}
      }

      if (fallbackCopy(text)) {
        console.log("%c✅ Copied via Legacy DOM", "color: green; font-weight: bold;");
        return true;
      } else {
        console.error("❌ Copy failed.");
        return false;
      }
    },

    paste: async () => {
      if (!document.hasFocus()) {
        if (pasteAbort) pasteAbort.abort();
        pasteAbort = new AbortController();

        console.log("%c🖱️ Click the page document to paste...", "color: orange; font-weight: bold;");

        return new Promise((resolve) => {
          document.addEventListener('click', async () => {
            pasteAbort = null;
            resolve(await io.paste());
          }, { once: true, signal: pasteAbort.signal });
        });
      }

      if (navigator.clipboard?.readText && window.isSecureContext) {
        try {
          const text = await navigator.clipboard.readText();
          console.log("%c✅ Pasted via Navigator API", "color: green; font-weight: bold;");
          return text;
        } catch (err) {}
      }

      const text = await fallbackPaste();
      if (text != null) {
        console.log("%c✅ Pasted via Legacy DOM", "color: green; font-weight: bold;");
        return text;
      }

      console.error("❌ Paste failed.");
      throw new Error('Paste unavailable in this context');
    }
  };

  window.io = io;
})();
