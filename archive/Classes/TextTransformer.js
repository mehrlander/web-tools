class TextTransformer {
  constructor(text, options = { compress: true, wrapBookmarklet: false }) {
    this.originalText = text;
    this.options = options;
    this.brotli = null;
    this.initialized = false;
  }

  // Template for opening HTML content in a popup window
  popupTemplate = `javascript: (() => {
        let w = window.open('about:blank', '', 'GeneratedWindow', 'width=800,height=600');
        w.document.write(__UNCOMPRESSED__);
        w.document.close();
      })()`;

  // Template for compressed bookmarklets
  bookmarkletTemplate = 'javascript:(async function(){const s=\'__COMPRESSED__\';try{const m=await(await import(\'https://unpkg.com/brotli-wasm@3.0.0/index.web.js?module\')).default;const b=atob(s);const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);const d=new TextDecoder().decode(m.decompress(a));eval(d)}catch(e){console.error(e)}})();';

  async init() {
    this.brotli = await this.fetchBrotli();
    this.initialized = true;
  }

  async fetchBrotli() {
    return await (await import('https://unpkg.com/brotli-wasm@3.0.0/index.web.js?module')).default;
  }

  isBase64(str) {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }

  isValidJavaScript(code) {
    try {
      new Function(code);
      return true;
    } catch (e) {
      return false;
    }
  }

  getFormat(input) {
    if (input.startsWith('javascript:(async function(){const s=')) return 'compressedBookmarklet';
    if (input.startsWith('javascript:')) return 'bookmarklet';
    if (this.isBase64(input)) return 'compressed';
    if ((/\b(function|const|let|var|import|export|class)\b/.test(input)) && this.isValidJavaScript(input)) return 'javascript';
    return 'rawText';
  }

  getSize(str) {
    return new Blob([str]).size;
  }

  async fromBase64(base64) {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(this.brotli.decompress(bytes));
    } catch (e) {
      console.error('Decompression failed:', e);
      return null;
    }
  }

  async process() {
    if (!this.initialized) {
      throw new Error('TextTransformer not initialized. Call init() first.');
    }

    const inputFormat = this.getFormat(this.originalText);
    let outputFormat = inputFormat;

    // Initialize transformation result object
    const transformationResult = {
      inputFormat,
      outputFormat,
      formats: {
        rawText: null,
        javascript: null,
        html: null,
        compressed: null,
        bookmarklet: null,
        compressedBookmarklet: null
      },
      metrics: {
        originalSize: 0,
        finalSize: 0,
        compressionRatio: 0
      }
    };

    // First handle decompression cases
    if (inputFormat === 'compressedBookmarklet') {
      transformationResult.formats.compressedBookmarklet = this.originalText;

      const match = this.originalText.match(/const\s+s\s*=\s*'([^']+)'/);
      if (match) {
        const decompressed = await this.fromBase64(match[1]);
        // The decompressed content could be any format
        const decompressedFormat = this.getFormat(decompressed);
        transformationResult.formats[decompressedFormat] = decompressed;
        outputFormat = decompressedFormat;
      }
    } else if (inputFormat === 'compressed') {
      transformationResult.formats.compressed = this.originalText;

      const decompressed = await this.fromBase64(this.originalText);
      const decompressedFormat = this.getFormat(decompressed);
      transformationResult.formats[decompressedFormat] = decompressed;
      outputFormat = decompressedFormat;
    } else {
      // Store input in its format slot
      transformationResult.formats[inputFormat] = this.originalText;

      // Handle bookmarklet creation regardless of compression
      if (this.options.wrapBookmarklet) {
        if (inputFormat === 'javascript') {
          transformationResult.formats.bookmarklet = `javascript:${this.originalText}`;
          outputFormat = 'bookmarklet';
        } else if (inputFormat !== 'bookmarklet') {  // Don't wrap if already a bookmarklet
          const escapedContent = JSON.stringify(this.originalText);
          transformationResult.formats.bookmarklet = this.popupTemplate.replace('__UNCOMPRESSED__', escapedContent);
          outputFormat = 'bookmarklet';
        }
      }

      // Handle compression if requested
      if (this.options.compress) {
        const compressString = (str) => {
          const inputBuffer = new TextEncoder().encode(str);
          const compressed = this.brotli.compress(inputBuffer);
          return btoa(Array.from(compressed).map(byte => String.fromCharCode(byte)).join(''));
        };

        // For non-javascript, non-bookmarklet content, create wrapped version first
        if (inputFormat !== 'javascript' && inputFormat !== 'bookmarklet') {
          const escapedContent = JSON.stringify(this.originalText);
          transformationResult.formats.bookmarklet = this.popupTemplate.replace('__UNCOMPRESSED__', escapedContent);
        }

        // Compress the appropriate content
        const toCompress = transformationResult.formats.bookmarklet || this.originalText;
        transformationResult.formats.compressed = compressString(toCompress);
        outputFormat = 'compressed';

        // Create compressed bookmarklet if requested
        if (this.options.wrapBookmarklet) {
          transformationResult.formats.compressedBookmarklet = this.bookmarkletTemplate.replace(
            '__COMPRESSED__',
            transformationResult.formats.compressed
          );
          outputFormat = 'compressedBookmarklet';
        }

        // Calculate metrics
        transformationResult.metrics.originalSize = this.getSize(this.originalText);
        transformationResult.metrics.finalSize = this.getSize(transformationResult.formats[outputFormat]);
        transformationResult.metrics.compressionRatio = (
          (1 - (transformationResult.metrics.finalSize / transformationResult.metrics.originalSize)) * 100
        ).toFixed(1);
      }
    }

    transformationResult.outputFormat = outputFormat;
    return transformationResult;
  }
}
