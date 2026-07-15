(() => {
  if (!window.GH) {
    throw new Error('gh-store.js requires window.GH (load gh-fetch.js first)');
  }

  const bytesToBase64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  const utf8ToBase64 = (str) => bytesToBase64(new TextEncoder().encode(str));

  // Commit already-base64 content to a path, recovering once from a stale SHA.
  // The text and byte savers below differ only in how they reach this base64.
  async function putContent(gh, path, content, message) {
    const msg = message || `update ${path}`;
    gh._shas ||= {};
    const put = () => {
      const body = { message: msg, content };
      if (gh._shas[path]) body.sha = gh._shas[path];
      return gh.req('contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
    };
    let res;
    try {
      res = await put();
    } catch (e) {
      // 409 = stale SHA (someone else wrote since we last read).
      // 422 = file exists but no SHA in body. Both recover the same way:
      // refetch the current SHA and retry once.
      if (e.status !== 409 && e.status !== 422) throw e;
      const cur = await gh.get(path);
      gh._shas[path] = cur.sha;
      res = await put();
    }
    gh._shas[path] = res.content.sha;
    return res;
  }

  // Text (or JSON.stringify'd) content. Unchanged interface.
  window.GH.prototype.save = function(path, value, message) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return putContent(this, path, utf8ToBase64(text), message);
  };

  // Raw bytes (Uint8Array/ArrayBuffer): the binary-safe sibling of save(), for
  // committing a dropped file whose bytes must survive untouched (an image, a
  // zip). Text through here would work too, but save() is the clearer path.
  window.GH.prototype.saveBytes = function(path, bytes, message) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return putContent(this, path, bytesToBase64(u8), message);
  };
})();
