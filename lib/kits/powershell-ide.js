// kits/powershell-ide.js -- Pure PowerShell and XAML intelligence for the
// Web Tools IDE experience. No Alpine, no DOM opinions, zero external dependencies.
//
// Extracts AST symbols, functions, parameters, doc comments, dot-sourced companions,
// module imports, and WPF event bindings; pairs XAML controls with controller code;
// provides syntax highlighting; formats no-direct-sync transfer commands; and catalogs
// distilled patterns from the PowerShell GUI Cookbook and ISEScriptingGeek.
(() => {
  // ── PowerShell Parser & Symbol Extraction ──────────────────────────────────

  const RX_COMMENT_HELP = /<#\s*([\s\S]*?)\s*#>/;
  const RX_FILE_HEADER = /^\s*#\s*@file\s+([^\r\n]+)/im;

  function parseScript(source) {
    const text = String(source || '');
    const lines = text.split(/\r?\n/);
    const functions = [];
    const dotSources = [];
    const imports = [];
    const assemblies = [];
    const eventHandlers = [];
    const controls = new Set();
    const variables = new Set();

    // Check for # @file header
    const fileHeaderMatch = text.match(RX_FILE_HEADER);
    const declaredFile = fileHeaderMatch ? fileHeaderMatch[1].trim() : '';

    // File-level comment help
    let fileSynopsis = '';
    const fileHelpMatch = text.match(RX_COMMENT_HELP);
    if (fileHelpMatch) {
      const synMatch = fileHelpMatch[1].match(/\.SYNOPSIS\s+([\s\S]*?)(?=\r?\n\s*\.[A-Z]+|\s*$)/i);
      if (synMatch) fileSynopsis = synMatch[1].trim();
    }

    let inCommentBlock = false;
    let commentBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track block comments
      if (!inCommentBlock && trimmed.startsWith('<#')) {
        inCommentBlock = true;
        commentBuffer = [line];
        if (trimmed.endsWith('#>') && trimmed.length > 3) {
          inCommentBlock = false;
        }
        continue;
      }
      if (inCommentBlock) {
        commentBuffer.push(line);
        if (trimmed.includes('#>')) {
          inCommentBlock = false;
        }
        continue;
      }

      // Single line comments
      if (trimmed.startsWith('#')) {
        commentBuffer.push(line);
        continue;
      }

      // Blank lines reset commentBuffer if not inside a block comment
      if (trimmed.length === 0 && !inCommentBlock) {
        commentBuffer = [];
        continue;
      }

      // Function or Filter declaration
      const fnMatch = line.match(/^\s*(?:function|filter|workflow)\s+([A-Za-z0-9_-]+(?:\\[A-Za-z0-9_-]+)?)/i);
      if (fnMatch) {
        const name = fnMatch[1];
        let synopsis = '';
        if (commentBuffer.length > 0) {
          const commentText = commentBuffer.join('\n');
          const syn = commentText.match(/\.SYNOPSIS\s+([\s\S]*?)(?=\r?\n\s*\.[A-Z]+|\s*#>|\s*$)/i);
          if (syn) {
            synopsis = syn[1].replace(/^[ \t]*#[ \t]?/gm, '').trim();
          } else {
            synopsis = commentBuffer.map(c => c.replace(/^\s*#\s?/, '')).join(' ').trim();
          }
        }

        // Lookahead for param block
        const params = [];
        let pLine = i;
        let paramBlock = '';
        if (line.includes('(') && line.includes(')')) {
          paramBlock = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
        } else {
          for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
            if (lines[j].trim().startsWith('param')) {
              let parenDepth = 0;
              for (let k = j; k < Math.min(j + 30, lines.length); k++) {
                paramBlock += ' ' + lines[k];
                parenDepth += (lines[k].match(/\(/g) || []).length;
                parenDepth -= (lines[k].match(/\)/g) || []).length;
                if (parenDepth <= 0 && lines[k].includes(')')) break;
              }
              break;
            }
            if (lines[j].trim().startsWith('{')) break;
          }
        }

        if (paramBlock) {
          // Strip attribute parameter expressions like [Parameter(Mandatory = $true)]
          const cleanParams = paramBlock.replace(/\[[A-Za-z0-9_]+\([^)]*\)\]/g, '');
          const pMatches = cleanParams.matchAll(/(?:\[([A-Za-z0-9_.[\]]+)\]\s*)?\$([A-Za-z0-9_]+)(?:\s*=\s*([^,)\r\n]+))?/g);
          for (const pm of pMatches) {
            const pName = pm[2];
            if (pName && !['this', '_', 'args', 'true', 'false', 'null', 'psboundparameters'].includes(pName.toLowerCase())) {
              params.push({
                name: pName,
                type: pm[1] || 'object',
                defaultValue: pm[3] ? pm[3].trim() : null
              });
            }
          }
        }

        const isExported = !name.startsWith('_') && !name.toLowerCase().startsWith('internal');

        if (!synopsis) {
          // Lookahead inside function body for <# ... .SYNOPSIS ... #>
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            const bodyLine = lines[j].trim();
            if (bodyLine.startsWith('<#')) {
              let block = '';
              for (let k = j; k < Math.min(j + 20, lines.length); k++) {
                block += lines[k] + '\n';
                if (lines[k].includes('#>')) break;
              }
              const syn = block.match(/\.SYNOPSIS\s+([\s\S]*?)(?=\r?\n\s*\.[A-Z]+|\s*#>)/i);
              if (syn) {
                synopsis = syn[1].replace(/^[ \t]*#[ \t]?/gm, '').trim();
              }
              break;
            }
            if (bodyLine.length > 0 && !bodyLine.startsWith('{') && !bodyLine.startsWith('param')) {
              break;
            }
          }
        }

        functions.push({
          name,
          line: i + 1,
          kind: line.match(/^\s*filter\b/i) ? 'filter' : 'function',
          isExported,
          synopsis,
          params
        });
        commentBuffer = [];
      } else if (trimmed.length > 0) {
        commentBuffer = [];
      }

      // Dot-sourcing: . $PSScriptRoot\Something.ps1 or . .\Something.ps1
      const dotMatch = line.match(/^\s*\.\s+["']?(\$PSScriptRoot[\\/][^"'\r\n]+|\.[\\/][^"'\r\n]+|[^"'\s;]+\.ps1)["']?/i);
      if (dotMatch) {
        const rawPath = dotMatch[1].trim();
        const norm = rawPath.replace(/^\$PSScriptRoot[\\/]/i, '').replace(/^\.[\\/]/, '').replace(/\\/g, '/');
        dotSources.push({ line: i + 1, raw: rawPath, resolved: norm });
      }

      // Import-Module: Import-Module Bookmarks -Force
      const impMatch = line.match(/\bImport-Module\s+([A-Za-z0-9_.-]+)/i);
      if (impMatch) {
        imports.push({ line: i + 1, module: impMatch[1] });
      }

      // Add-Type or Assemblies
      const assyMatch = line.match(/Add-Type\s+-AssemblyName\s+([A-Za-z0-9_., ]+)/i);
      if (assyMatch) {
        assemblies.push({ line: i + 1, name: assyMatch[1].trim() });
      }

      // WPF event handlers: $btnSearch.Add_Click({ ... })
      const evMatch = line.match(/\$([A-Za-z0-9_]+)\.Add_([A-Za-z0-9_]+)\s*\(/i);
      if (evMatch) {
        eventHandlers.push({
          line: i + 1,
          control: evMatch[1],
          event: evMatch[2]
        });
        controls.add(evMatch[1]);
      }

      // $window.FindName('ControlName') or $form.FindName("ControlName")
      const findMatch = line.match(/\$(?:window|form|root|ui|view)\.FindName\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/i);
      if (findMatch) {
        controls.add(findMatch[1]);
      }

      // Variable matches
      const varMatches = line.matchAll(/\$([A-Za-z0-9_]+)\b/g);
      for (const vm of varMatches) {
        const vname = vm[1];
        if (!['true', 'false', 'null', 'args', '_', 'this', 'PSScriptRoot', 'PSCommandPath'].includes(vname)) {
          variables.add(vname);
        }
      }
    }

    const compatibility = validatePs51Compatibility(text);

    return {
      declaredFile,
      fileSynopsis,
      lineCount: lines.length,
      functions,
      dotSources,
      imports,
      assemblies,
      eventHandlers,
      referencedControls: Array.from(controls).sort(),
      variables: Array.from(variables).sort(),
      compatibility
    };
  }

  // ── Windows PowerShell 5.1 Compatibility Validator ────────────────────────
  // Scans PowerShell code for language constructs introduced in PowerShell Core 6/7+
  // that cause syntax errors in Windows PowerShell 5.1 and .NET 4.5+:
  //  1. Ternary operators: <cond> ? <if-true> : <if-false>
  //  2. Null-coalescing operators: ?? and ??=
  //  3. Pipeline chain operators: && and ||

  function maskCodeLine(line) {
    const chars = line.split('');
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let openedBlockComment = false;

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const next = i + 1 < chars.length ? chars[i + 1] : '';

      if (!inSingleQuote && !inDoubleQuote) {
        if (c === '<' && next === '#') {
          chars[i] = ' ';
          chars[i + 1] = ' ';
          i++;
          let closed = false;
          for (let j = i + 1; j < chars.length; j++) {
            if (chars[j] === '#' && j + 1 < chars.length && chars[j + 1] === '>') {
              chars[j] = ' ';
              chars[j + 1] = ' ';
              i = j + 1;
              closed = true;
              break;
            }
            chars[j] = ' ';
          }
          if (!closed) {
            openedBlockComment = true;
            break;
          }
          continue;
        }

        if (c === '#') {
          for (let j = i; j < chars.length; j++) chars[j] = ' ';
          break;
        }

        if (c === "'") {
          inSingleQuote = true;
          chars[i] = ' ';
          continue;
        }
        if (c === '"') {
          inDoubleQuote = true;
          chars[i] = ' ';
          continue;
        }
      } else if (inSingleQuote) {
        if (c === "'") {
          if (next === "'") {
            chars[i] = ' ';
            chars[i + 1] = ' ';
            i++;
            continue;
          }
          inSingleQuote = false;
        }
        chars[i] = ' ';
      } else if (inDoubleQuote) {
        if (c === '`' && (next === '"' || next === '`')) {
          chars[i] = ' ';
          chars[i + 1] = ' ';
          i++;
          continue;
        }
        if (c === '"') {
          if (next === '"') {
            chars[i] = ' ';
            chars[i + 1] = ' ';
            i++;
            continue;
          }
          inDoubleQuote = false;
        }
        chars[i] = ' ';
      }
    }

    return { text: chars.join(''), openedBlockComment };
  }

  function detectTernary(stripped) {
    for (let i = 0; i < stripped.length; i++) {
      if (stripped[i] === '?') {
        const prevChar = i > 0 ? stripped[i - 1] : '';
        const nextChar = i + 1 < stripped.length ? stripped[i + 1] : '';
        if (prevChar === '?' || nextChar === '?') continue;

        let beforeIdx = i - 1;
        while (beforeIdx >= 0 && /\s/.test(stripped[beforeIdx])) beforeIdx--;
        const beforeNonWs = beforeIdx >= 0 ? stripped[beforeIdx] : '';

        if (beforeNonWs === '|' || beforeNonWs === '{' || beforeNonWs === ';' || beforeNonWs === '') continue;

        let afterIdx = i + 1;
        while (afterIdx < stripped.length && /\s/.test(stripped[afterIdx])) afterIdx++;
        const afterNonWs = afterIdx < stripped.length ? stripped[afterIdx] : '';
        if (afterNonWs === '{') continue;

        for (let j = i + 1; j < stripped.length; j++) {
          const c = stripped[j];
          if (c === ';') break;
          if (c === ':') {
            const prevColon = j > 0 ? stripped[j - 1] : '';
            const nextColon = j + 1 < stripped.length ? stripped[j + 1] : '';
            if (prevColon === ':' || nextColon === ':') continue;
            if (nextColon === '/' || nextColon === '\\') continue;
            if (/[A-Za-z0-9_$]/.test(prevColon)) continue;
            return { col: i + 1 };
          }
        }
      }
    }
    return null;
  }

  function validatePs51Compatibility(source) {
    const text = String(source || '');
    const issues = [];
    const lines = text.split(/\r?\n/);

    let inBlockComment = false;
    let inHereStringSingle = false;
    let inHereStringDouble = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const originalLine = lines[lineIdx];
      let line = originalLine;
      const lineNum = lineIdx + 1;

      if (inHereStringSingle) {
        if (/^'@\s*$/.test(line)) inHereStringSingle = false;
        continue;
      }
      if (inHereStringDouble) {
        if (/^"@\s*$/.test(line)) inHereStringDouble = false;
        continue;
      }

      if (/@'\s*$/.test(line)) {
        inHereStringSingle = true;
        continue;
      }
      if (/@"\s*$/.test(line)) {
        inHereStringDouble = true;
        continue;
      }

      if (inBlockComment) {
        if (line.includes('#>')) {
          line = line.slice(line.indexOf('#>') + 2);
          inBlockComment = false;
        } else {
          continue;
        }
      }

      const masked = maskCodeLine(line);
      if (masked.openedBlockComment) inBlockComment = true;

      const stripped = masked.text;

      // 1. Null-coalescing assignment ??=
      const rxAssign = /\?\?=/g;
      let m;
      while ((m = rxAssign.exec(stripped)) !== null) {
        issues.push({
          line: lineNum,
          col: m.index + 1,
          rule: 'null-coalescing-assignment',
          message: "Null-coalescing assignment '??=' requires PowerShell 7+. Use 'if ($null -eq $var) { $var = ... }' for Windows PowerShell 5.1 compatibility.",
          snippet: originalLine.trim()
        });
      }

      // 2. Null-coalescing ?? (not followed by =)
      const rxCoalesce = /\?\?(?!=)/g;
      while ((m = rxCoalesce.exec(stripped)) !== null) {
        issues.push({
          line: lineNum,
          col: m.index + 1,
          rule: 'null-coalescing',
          message: "Null-coalescing operator '??' requires PowerShell 7+. Use 'if ($null -ne $a) { $a } else { $b }' for Windows PowerShell 5.1 compatibility.",
          snippet: originalLine.trim()
        });
      }

      // 3. Pipeline chain operators && and ||
      const rxChainAnd = /&&/g;
      while ((m = rxChainAnd.exec(stripped)) !== null) {
        issues.push({
          line: lineNum,
          col: m.index + 1,
          rule: 'pipeline-chain',
          message: "Pipeline chain operator '&&' requires PowerShell 7+. In Windows PowerShell 5.1, test '$?' or '$LASTEXITCODE'.",
          snippet: originalLine.trim()
        });
      }

      const rxChainOr = /\|\|/g;
      while ((m = rxChainOr.exec(stripped)) !== null) {
        issues.push({
          line: lineNum,
          col: m.index + 1,
          rule: 'pipeline-chain',
          message: "Pipeline chain operator '||' requires PowerShell 7+. In Windows PowerShell 5.1, test '-not $?' or '$LASTEXITCODE -ne 0'.",
          snippet: originalLine.trim()
        });
      }

      // 4. Ternary operator <cond> ? <true> : <false>
      const ternaryMatch = detectTernary(stripped);
      if (ternaryMatch) {
        issues.push({
          line: lineNum,
          col: ternaryMatch.col,
          rule: 'ternary-operator',
          message: "Ternary operator '? :' requires PowerShell 7+. Use 'if (...) { ... } else { ... }' for Windows PowerShell 5.1 compatibility.",
          snippet: originalLine.trim()
        });
      }
    }

    return issues;
  }

  // ── Smart Hash Extractor ──────────────────────────────────────────────────
  function extractSha256(text) {
    if (!text) return null;
    const match = String(text).match(/\b([A-Fa-f0-9]{64})\b/);
    return match ? match[1].toLowerCase() : null;
  }

  // ── Succinct Mode: Comment Stripper ───────────────────────────────────────
  function stripComments(source) {
    const text = String(source || '');
    const lines = text.split(/\r?\n/);
    const result = [];
    let inBlockComment = false;
    let inHereStringSingle = false;
    let inHereStringDouble = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (inHereStringSingle) {
        result.push(line);
        if (/^'@\s*$/.test(line)) inHereStringSingle = false;
        continue;
      }
      if (inHereStringDouble) {
        result.push(line);
        if (/^"@\s*$/.test(line)) inHereStringDouble = false;
        continue;
      }

      if (/@'\s*$/.test(line)) {
        inHereStringSingle = true;
        result.push(line);
        continue;
      }
      if (/@"\s*$/.test(line)) {
        inHereStringDouble = true;
        result.push(line);
        continue;
      }

      if (inBlockComment) {
        if (line.includes('#>')) {
          const remainder = line.slice(line.indexOf('#>') + 2).trimEnd();
          inBlockComment = false;
          if (remainder.trim()) result.push(remainder);
        }
        continue;
      }

      if (line.includes('<#')) {
        const startIdx = line.indexOf('<#');
        const before = line.slice(0, startIdx);
        if (line.includes('#>', startIdx)) {
          const endIdx = line.indexOf('#>', startIdx) + 2;
          const after = line.slice(endIdx);
          const cleaned = (before + after).trimEnd();
          if (cleaned.trim()) result.push(cleaned);
        } else {
          inBlockComment = true;
          if (before.trim()) result.push(before.trimEnd());
        }
        continue;
      }

      const commentIdx = findSingleCommentIndex(line);
      if (commentIdx !== -1) {
        const cleaned = line.slice(0, commentIdx).trimEnd();
        if (cleaned.trim().length > 0) {
          result.push(cleaned);
        }
      } else {
        if (line.trim().length > 0) {
          result.push(line.trimEnd());
        } else if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('');
        }
      }
    }

    return result.join('\n').trim();
  }

  // ── XAML Parser & Control Extraction ───────────────────────────────────────

  function parseXaml(source) {
    const text = String(source || '');
    const lines = text.split(/\r?\n/);
    const controls = [];
    const dynamicResources = new Set();
    const staticResources = new Set();
    const eventAttributes = [];

    // Extract tags with Name or x:Name
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // DynamicResource & StaticResource
      const dynMatches = line.matchAll(/\{DynamicResource\s+([A-Za-z0-9_.-]+)\}/g);
      for (const dm of dynMatches) dynamicResources.add(dm[1]);

      const statMatches = line.matchAll(/\{StaticResource\s+([A-Za-z0-9_.-]+)\}/g);
      for (const sm of statMatches) staticResources.add(sm[1]);

      // Element with x:Name or Name
      const elemMatch = line.match(/<([A-Za-z0-9_:]+)\b([^>]*)/);
      if (elemMatch) {
        const tag = elemMatch[1].replace(/^[A-Za-z0-9_]+:/, ''); // strip namespace like controls:
        const attrs = elemMatch[2];
        const nameMatch = attrs.match(/(?:x:)?Name\s*=\s*["']([A-Za-z0-9_]+)["']/);
        if (nameMatch) {
          const name = nameMatch[1];
          // Title or Header or Content attribute if present
          const titleMatch = attrs.match(/\b(?:Title|Header|Content|Text|ToolTip)\s*=\s*["']([^"']+)["']/);
          const label = titleMatch ? titleMatch[1] : '';

          controls.push({
            name,
            tag,
            line: i + 1,
            label
          });
        }

        // Check for direct event attributes: Click="...", SelectionChanged="..."
        const evMatches = attrs.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*=\s*["']([A-Za-z0-9_]+)["']/g);
        for (const evMatch of evMatches) {
          if (['Click', 'SelectionChanged', 'TextChanged', 'KeyDown', 'Loaded', 'Closing', 'MouseDoubleClick'].includes(evMatch[1])) {
            eventAttributes.push({
              event: evMatch[1],
              handler: evMatch[2],
              tag,
              line: i + 1
            });
          }
        }
      }
    }

    // Root tag inspection (Window, UserControl, Grid, etc.)
    const rootTagMatch = text.match(/<([A-Za-z0-9_:]+)\b/);
    const rootTag = rootTagMatch ? rootTagMatch[1].replace(/^[A-Za-z0-9_]+:/, '') : 'Unknown';

    return {
      rootTag,
      lineCount: lines.length,
      controls,
      dynamicResources: Array.from(dynamicResources).sort(),
      staticResources: Array.from(staticResources).sort(),
      eventAttributes
    };
  }

  // ── XAML + PowerShell Cross-Referencing ─────────────────────────────────────

  function crossReference(xamlInfo, psInfo) {
    if (!xamlInfo || !psInfo) return { wired: [], unwired: [], unmapped: [], summary: 'No companion pair' };

    const xamlControlNames = new Set(xamlInfo.controls.map(c => c.name.toLowerCase()));
    const psReferencedLower = new Map();
    for (const c of psInfo.referencedControls) psReferencedLower.set(c.toLowerCase(), c);
    for (const v of psInfo.variables) psReferencedLower.set(v.toLowerCase(), v);

    const wired = [];
    const unwired = [];

    for (const ctrl of xamlInfo.controls) {
      const match = psReferencedLower.get(ctrl.name.toLowerCase());
      const handlers = psInfo.eventHandlers.filter(h => h.control.toLowerCase() === ctrl.name.toLowerCase());
      if (match || handlers.length > 0) {
        wired.push({
          name: ctrl.name,
          tag: ctrl.tag,
          line: ctrl.line,
          events: handlers.map(h => h.event)
        });
      } else {
        unwired.push({
          name: ctrl.name,
          tag: ctrl.tag,
          line: ctrl.line
        });
      }
    }

    // Controls referenced in PS but missing in XAML
    const unmapped = [];
    for (const ctrl of psInfo.referencedControls) {
      if (!xamlControlNames.has(ctrl.toLowerCase())) {
        unmapped.push(ctrl);
      }
    }

    return {
      wired,
      unwired,
      unmapped,
      themeResourceCount: xamlInfo.dynamicResources.length,
      isFullyThemed: xamlInfo.dynamicResources.length > 0 && xamlInfo.staticResources.length === 0
    };
  }

  // ── No-Direct-Sync Transfer Helpers ────────────────────────────────────────

  function generateTransferHelper(item, text) {
    if (!item) return { verifyCmd: '', installCmd: '', headerSnippet: '' };

    const destRel = item.installs === '' ? item.name : (item.installs || item.name);
    const winPath = `$HOME\\Documents\\WindowsPowerShell\\${destRel.replace(/\//g, '\\')}`;

    // 1. Verification command: hash the file on the local machine
    const verifyCmd = `Get-FileHash -Path "${winPath}" -Algorithm SHA256 | Select-Object -ExpandProperty Hash`;

    // 2. PowerShell code to place the file directly into place
    const escapedText = (text || '').replace(/'/g, "''");
    const installCmd = `$dest = "${winPath}";\n` +
      `$dir = Split-Path -Parent $dest;\n` +
      `if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null };\n` +
      `Set-Content -LiteralPath $dest -Value @'\n${escapedText}\n'@ -Encoding UTF8;\n` +
      `Write-Host "Wrote $($dest) - SHA256: $((Get-FileHash $dest -Algorithm SHA256).Hash)" -ForegroundColor Green`;

    // 3. Header snippet with # @file for clipboard correspondence
    const headerSnippet = `# @file ${item.path}\n${text || ''}`;

    return {
      winPath,
      verifyCmd,
      installCmd,
      headerSnippet
    };
  }

  // ── Syntax Coloring & Highlighting ─────────────────────────────────────────

  const esc = s => (typeof window !== 'undefined' && typeof window.esc === 'function' ? window.esc(s) : String(s || ''));

  function highlightPowerShell(source) {
    const text = String(source || '');
    const lines = text.split(/\r?\n/);
    const renderedLines = [];

    let inBlockComment = false;

    for (let idx = 0; idx < lines.length; idx++) {
      const rawLine = lines[idx];
      let line = rawLine;
      let out = '';

      if (inBlockComment) {
        if (line.includes('#>')) {
          const endIdx = line.indexOf('#>') + 2;
          out += `<span class="text-base-content/40 italic">${esc(line.slice(0, endIdx))}</span>`;
          line = line.slice(endIdx);
          inBlockComment = false;
        } else {
          renderedLines.push(`<span class="text-base-content/40 italic">${esc(line)}</span>`);
          continue;
        }
      }

      // Check block comment start
      if (!inBlockComment && line.includes('<#')) {
        const startIdx = line.indexOf('<#');
        out += highlightLineTokens(line.slice(0, startIdx));
        if (line.includes('#>', startIdx)) {
          const endIdx = line.indexOf('#>', startIdx) + 2;
          out += `<span class="text-base-content/40 italic">${esc(line.slice(startIdx, endIdx))}</span>`;
          line = line.slice(endIdx);
        } else {
          out += `<span class="text-base-content/40 italic">${esc(line.slice(startIdx))}</span>`;
          inBlockComment = true;
          renderedLines.push(out);
          continue;
        }
      }

      // Single line comment
      const commentIdx = findSingleCommentIndex(line);
      if (commentIdx !== -1) {
        out += highlightLineTokens(line.slice(0, commentIdx));
        out += `<span class="text-base-content/40 italic">${esc(line.slice(commentIdx))}</span>`;
      } else {
        out += highlightLineTokens(line);
      }

      renderedLines.push(out || '&nbsp;');
    }

    return renderedLines.map((l, i) => `
      <div class="flex hover:bg-base-200/40 px-2 py-0.5" id="ps-L${i + 1}">
        <span class="font-mono text-xs text-base-content/30 w-10 shrink-0 select-none text-right pr-3 tabular-nums">${i + 1}</span>
        <span class="font-mono text-sm leading-relaxed whitespace-pre grow">${l}</span>
      </div>`).join('');
  }

  function findSingleCommentIndex(line) {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
      else if (c === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
      else if (c === '#' && !inSingleQuote && !inDoubleQuote) return i;
    }
    return -1;
  }

  const PS_KEYWORDS = new Set([
    'begin', 'break', 'catch', 'class', 'continue', 'data', 'do', 'dynamicparam',
    'else', 'elseif', 'end', 'enum', 'exit', 'filter', 'finally', 'for', 'foreach',
    'from', 'function', 'hidden', 'if', 'in', 'inlinescript', 'interface', 'module',
    'parallel', 'param', 'process', 'return', 'sequence', 'static', 'switch', 'throw',
    'trap', 'try', 'until', 'using', 'var', 'while', 'workflow'
  ]);

  function highlightLineTokens(str) {
    if (!str) return '';
    const tokenRe = /(@"[^"\n]*"@|@'[^'\n]*'@|"[^"\n]*"|'[^'\n]*'|\$[A-Za-z0-9_:]+|-[A-Za-z0-9_]+|\[[A-Za-z0-9_.[\]]+\]|\b[A-Za-z0-9_]+-[A-Za-z0-9_]+\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[^\sA-Za-z0-9_$\-[@'"]+|\s+)/g;
    let html = '';
    let match;

    while ((match = tokenRe.exec(str)) !== null) {
      const token = match[0];
      const lower = token.toLowerCase();

      if (token.startsWith('"') || token.startsWith("'") || token.startsWith("@'") || token.startsWith('@"')) {
        html += `<span class="text-success font-medium">${esc(token)}</span>`;
      } else if (token.startsWith('$')) {
        html += `<span class="text-primary font-semibold">${esc(token)}</span>`;
      } else if (token.startsWith('-') && token.length > 1 && !/\d/.test(token[1])) {
        html += `<span class="text-warning">${esc(token)}</span>`;
      } else if (token.startsWith('[') && token.endsWith(']')) {
        html += `<span class="text-secondary">${esc(token)}</span>`;
      } else if (PS_KEYWORDS.has(lower)) {
        html += `<span class="text-error font-bold">${esc(token)}</span>`;
      } else if (token.includes('-') && /^[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(token)) {
        html += `<span class="text-info font-medium">${esc(token)}</span>`;
      } else {
        html += esc(token);
      }
    }
    return html;
  }

  function highlightXaml(source) {
    const text = String(source || '');
    const lines = text.split(/\r?\n/);
    const renderedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      let formatted = esc(raw);

      // Comments: &lt;!-- ... --&gt;
      formatted = formatted.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-base-content/40 italic">$1</span>');

      // Tags: &lt;/?([A-Za-z0-9_:]+)
      formatted = formatted.replace(/&lt;(\/?[A-Za-z0-9_:]+)/g, '&lt;<span class="text-primary font-bold">$1</span>');

      // Attributes: ([A-Za-z0-9_:]+)=&quot;...&quot;
      formatted = formatted.replace(/([A-Za-z0-9_:]+)=(&quot;[^&]*&quot;)/g,
        '<span class="text-warning">$1</span>=<span class="text-success">$2</span>');

      // Closing /&gt; or &gt;
      formatted = formatted.replace(/(\/?&gt;)/g, '<span class="text-primary font-bold">$1</span>');

      // DynamicResource
      formatted = formatted.replace(/(\{DynamicResource\s+[^}]+\})/g, '<span class="badge badge-xs badge-info font-mono">$1</span>');

      renderedLines.push(`
        <div class="flex hover:bg-base-200/40 px-2 py-0.5" id="xaml-L${i + 1}">
          <span class="font-mono text-xs text-base-content/30 w-10 shrink-0 select-none text-right pr-3 tabular-nums">${i + 1}</span>
          <span class="font-mono text-sm leading-relaxed whitespace-pre grow">${formatted || '&nbsp;'}</span>
        </div>`);
    }

    return renderedLines.join('');
  }

  // ── Curated Patterns & Snippets Catalog ────────────────────────────────────

  const SNIPPETS = [
    {
      id: 'wpf-theme',
      title: 'WPF DynamicResource Theme Integration',
      category: 'GUI & Layout',
      summary: 'Consistent styling via DynamicResource tied to shared Theme.xaml.',
      code: `@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Themed Window" Height="450" Width="700"
        Background="{DynamicResource BackgroundBrush}">
    <Grid Margin="12">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
        </Grid.RowDefinitions>
        <Border Background="{DynamicResource HeaderBackgroundBrush}" Padding="8" CornerRadius="4">
            <TextBlock Text="Themed Application" Foreground="{DynamicResource ForegroundBrush}" FontWeight="Bold"/>
        </Border>
        <DataGrid Grid.Row="1" Margin="0,8,0,0" AutoGenerateColumns="True"
                  Background="{DynamicResource ControlBackgroundBrush}"
                  Foreground="{DynamicResource ForegroundBrush}"/>
    </Grid>
</Window>
'@`
    },
    {
      id: 'form-f1-navigation',
      title: 'WPF F1 Controller & Web Tools Navigation',
      category: 'GUI & Layout',
      summary: 'Binds F1 to launch the controller script in ISE and Ctrl+F1 to open its Web Tools address.',
      code: `@'
function Register-FormHelpNavigation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [System.Windows.Window]$Window,
        [string]$ScriptPath = $PSCommandPath,
        [string]$WebToolsUrl
    )
    $Window.Add_KeyDown({
        param($sender, $e)
        if ($e.Key -eq [System.Windows.Input.Key]::F1) {
            $e.Handled = $true
            if ([System.Windows.Input.Keyboard]::Modifiers -band [System.Windows.Input.ModifierKeys]::Control) {
                if ($WebToolsUrl) { [System.Diagnostics.Process]::Start($WebToolsUrl) }
            } else {
                if ($ScriptPath -and (Test-Path $ScriptPath)) {
                    Start-Process powershell_ise.exe -ArgumentList @('-File', $ScriptPath)
                }
            }
        }
    })
}
'@`
    },
    {
      id: 'browser-silent',
      title: 'WebBrowser ActiveX Silent Reflection',
      category: 'Browser Integration',
      summary: 'Silences noisy IE/ActiveX script errors inside the WPF WebBrowser control via reflection.',
      code: `@'
$browser = New-Object System.Windows.Controls.WebBrowser
$browser.Add_Navigated({
    param($sender, $e)
    try {
        $axIWebBrowser2 = $sender.GetType().GetProperty(
            "AxIWebBrowser2",
            [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic
        ).GetValue($sender, $null)
        if ($axIWebBrowser2) {
            $axIWebBrowser2.GetType().InvokeMember(
                "Silent",
                [System.Reflection.BindingFlags]::SetProperty,
                $null,
                $axIWebBrowser2,
                [object[]]@($true)
            )
        }
    } catch {
        Write-Warning "Could not silence WebBrowser: $_"
    }
})
'@`
    },
    {
      id: 'runspace-threading',
      title: 'Runspace UI Multi-Threading (Non-Locking)',
      category: 'Concurrency',
      summary: 'Runs background jobs in a separate runspace without freezing the WPF dispatcher.',
      code: `@'
$syncHash = [hashtable]::Synchronized(@{
    Window = $window
    Data   = $null
    Done   = $false
})

$runspace = [runspacefactory]::CreateRunspace()
$runspace.ApartmentState = "STA"
$runspace.ThreadOptions = "ReuseThread"
$runspace.Open()
$runspace.SessionStateProxy.SetVariable("Sync", $syncHash)

$ps = [powershell]::Create()
$ps.Runspace = $runspace
[void]$ps.AddScript({
    Start-Sleep -Seconds 2
    $Sync.Data = Get-Process | Select-Object -First 20
    $Sync.Done = $true
    $Sync.Window.Dispatcher.Invoke([action]{
        $Sync.Window.FindName("ResultGrid").ItemsSource = $Sync.Data
    })
})

[void]$ps.BeginInvoke()
'@`
    },
    {
      id: 'group-serialized',
      title: 'Group-Serialized (Deep Equality Grouping)',
      category: 'Data & Utilities',
      summary: 'Groups PSCustomObjects and hashtables by deep property equality via JSON serialization.',
      code: `@'
function Group-Serialized {
    [CmdletBinding()]
    param(
        [Parameter(ValueFromPipeline = $true)]
        [psobject[]]$InputObject,
        [Parameter(Position = 0)]
        [string[]]$Property
    )
    process {
        foreach ($item in $InputObject) {
            $keyObj = [ordered]@{}
            if ($Property) {
                foreach ($p in $Property) { $keyObj[$p] = $item.$p }
            } else {
                $keyObj = $item
            }
            $key = ($keyObj | ConvertTo-Json -Compress -Depth 4)
            [PSCustomObject]@{
                Key   = $key
                Item  = $item
            }
        }
    }
}
'@`
    },
    {
      id: 'comment-help',
      title: 'Comment-Based Help Template',
      category: 'Documentation',
      summary: 'Standardized comment-based help block for functions and cmdlets.',
      code: `@'
<#
.SYNOPSIS
    Short one-line summary of what this function does.

.DESCRIPTION
    Detailed description of the function, rationale, and runtime considerations.

.PARAMETER Path
    Specifies a path to one or more locations.

.PARAMETER Force
    Forces the operation without interactive confirmation.

.EXAMPLE
    Get-ItemReport -Path "C:\Data" -Force
    Demonstrates standard invocation.

.NOTES
    Author: Web Tools User
    Architecture: wps module companion
#>
'@`
    },
    {
      id: 'ise-ast-profile',
      title: 'Get-ASTScriptProfile (ISE Scripting Geek)',
      category: 'Script Analysis',
      summary: 'Analyzes PowerShell scripts using the System.Management.Automation AST parser.',
      code: `@'
function Get-ASTScriptProfile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [string]$Path
    )
    process {
        $content = Get-Content -LiteralPath $Path -Raw
        $tokens = $null
        $errors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseInput(
            $content,
            [ref]$tokens,
            [ref]$errors
        )
        [PSCustomObject]@{
            Path        = $Path
            Functions   = @($ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)).Count
            Commands    = @($ast.FindAll({ $args[0] -is [System.Management.Automation.Language.CommandAst] }, $true)).Count
            Parameters  = @($ast.FindAll({ $args[0] -is [System.Management.Automation.Language.ParameterAst] }, $true)).Count
            Errors      = $errors.Count
        }
    }
}
'@`
    }
  ];

  window.PowerShellIde = {
    parseScript,
    parseXaml,
    crossReference,
    generateTransferHelper,
    highlightPowerShell,
    highlightXaml,
    validatePs51Compatibility,
    extractSha256,
    stripComments,
    SNIPPETS
  };
})();
