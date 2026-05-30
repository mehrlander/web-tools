(() => {
  if (!window.GH) {
    throw new Error('gh-store.js requires window.GH (load gh-fetch.js first)');
  }

  const utf8ToBase64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  window.GH.prototype.save = async function(path, value, message) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const content = utf8ToBase64(text);
    const msg = message || `update ${path}`;

    this._shas ||= {};

    const put = () => {
      const body = { message: msg, content };
      if (this._shas[path]) body.sha = this._shas[path];
      return this.req('contents/' + path, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
    };

    let res;
    try {
      res = await put();
    } catch (e) {
      // 409 = stale SHA (someone else wrote since we last read).
      // 422 = file exists but no SHA in body. Both recover the same way:
      // refetch the current SHA and retry once.
      if (e.status !== 409 && e.status !== 422) throw e;
      const cur = await this.get(path);
      this._shas[path] = cur.sha;
      res = await put();
    }
    this._shas[path] = res.content.sha;
    return res;
  };
})();
