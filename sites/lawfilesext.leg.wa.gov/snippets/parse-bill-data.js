(async () => {
  let resultData = null;
  try {
    const currentUrl = window.location.href;
    const htmUrl = currentUrl.replace(/\b(xml|pdf)\b/g, 'htm');
    const xmlUrl = currentUrl.replace(/htm|pdf/gi, 'xml');

    const billNumberMatch = htmUrl.match(/(\d+)(?:[.-][A-Za-z.]*)?\.htm$/);
    const baseBillNumber = billNumberMatch ? billNumberMatch[1] : null;

    const parentUrl = htmUrl.substring(0, htmUrl.lastIndexOf('/') + 1);
    const dirResponse = await fetch(parentUrl);
    if (!dirResponse.ok) throw new Error(`HTTP error fetching directory! status: ${dirResponse.status}`);
    const dirHtml = await dirResponse.text();
    const dirDoc = new DOMParser().parseFromString(dirHtml, 'text/html');

    const billVersions = [];
    if (baseBillNumber) {
      const links = dirDoc.querySelectorAll('a');
      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent.trim();
        const versionRegex = new RegExp(`${baseBillNumber}(?:[.-][A-Za-z.]*)?(?=\\.(xml|htm|pdf))`);
        const versionMatch = (href || text).match(versionRegex);
        if (versionMatch) {
          const version = versionMatch[0];
          if (!billVersions.includes(version)) billVersions.push(version);
        }
      });
    }

    const [htmlResponse, xmlText, cashCode, fxparserCode] = await Promise.all([
      fetch(htmUrl),
      fetch(xmlUrl).then(res => res.ok ? res.text() : null),
      fetch('https://unpkg.com/cash-dom').then(res => res.text()),
      fetch('https://cdnjs.cloudflare.com/ajax/libs/fast-xml-parser/4.5.1/fxparser.min.js').then(res => res.text())
    ]);

    if (!htmlResponse.ok) throw new Error(`HTTP error! status: ${htmlResponse.status}`);
    const html = await htmlResponse.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const getText = selector => doc.querySelector(selector)?.textContent.trim() || 'N/A';

    const getSponsors = () => {
      const span = doc.querySelector('div[style="margin-top:0.1in;"] span[style*="font-weight:bold"]');
      return span?.nextSibling?.textContent.trim() || 'N/A';
    };

    const getPrefiled = () => {
      const span = Array.from(doc.querySelectorAll('span')).find(s => s.textContent.trim().startsWith('Read first time'));
      if (!span) return { prefiled: 'N/A', firstRead: 'N/A', referredTo: 'N/A' };
      const spans = span.closest('div').querySelectorAll('span');
      const data = {};
      spans.forEach(s => {
        const t = s.textContent.trim();
        if (t.startsWith('Prefiled')) data.prefiled = t.replace('Prefiled ', '').trim();
        if (t.startsWith('Read first time')) data.firstRead = t.replace('Read first time ', '').trim();
        if (t.startsWith('Referred to')) data.referredTo = t.replace('Referred to ', '').trim();
      });
      return data;
    };

    const getTable = () => {
      const table = doc.querySelector('table');
      if (!table) return 'N/A';
      return Array.from(table.querySelectorAll('td, th')).map(cell => cell.textContent.trim()).filter(Boolean).join(', ');
    };

    const getTerms = () => {
      const text = doc.body.textContent || '';
      const words = text.toLowerCase().match(/[a-z]{3,}/g) || [];
      return [...new Set(words)].sort();
    };

    let xmlHeadingObj = null;
    if (xmlText) {
      eval(cashCode);
      eval(fxparserCode);
      
      const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
      const removeAttrs = ['indent', 'textAlign', 'width'];
      $(xmlDoc).find('*').each((i, el) => {
        removeAttrs.forEach(attr => {
          if (el.hasAttribute(attr)) el.removeAttribute(attr);
        });
      });
      $('TextRun, Value', xmlDoc).each((i, el) => {
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      });

      const updatedXml = new XMLSerializer().serializeToString(xmlDoc);
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@",
        ignoreDeclaration: true,
        removeNSPrefix: true
      });
      const parsed = parser.parse(updatedXml);
      xmlHeadingObj = parsed.Bill?.BillHeading || null;
    }

    const fullBillNumber = getText('div[style="font-weight:bold;text-align:center;"]');
    const numericBillNumber = fullBillNumber.match(/\d+/)?.[0] || 'N/A';

    resultData = {
      url: htmUrl,
      billVersions: billVersions.sort(),
      ...getPrefiled(),
      billNumber: fullBillNumber,
      numericBillNumber: numericBillNumber,
      table: getTable(),
      sponsors: getSponsors(),
      title: doc.querySelector('div[style*="text-indent:0.5in;margin-top:0.5in;"]')?.innerHTML.trim() || 'N/A',
      terms: getTerms(),
      xmlHeading: xmlHeadingObj
    };
  } catch (error) {
    resultData = { error: error.message, url: window.location.href };
  }
  console.log(resultData);
})();
