// The archive stays unchanged. These adaptations make each preview use one local sample.
function replace(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`The archived ${label} source no longer matches its preview adapter.`);
  return source.replace(pattern, replacement);
}

function scriptJSON(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => (
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  ));
}

function objectTree(source) {
  source = source.slice(0, source.indexOf('</html>') + '</html>'.length);
  return replace(source, /\/\/ Show initial demo\s*\$\(document\)\.ready\(function\(\) \{\s*showSimpleObject\(\);\s*\}\);/,
    '$(document).ready(function() { displayTree(__gallerySample); });', 'Object Tree');
}

function previewTree(source) {
  source = replace(source, /document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\n\}\);/,
    `document.addEventListener('DOMContentLoaded', () => {
      document.querySelector('#github-tree .tree-inner').appendChild(new JsonTreeView(__gallerySample).element);
      document.getElementById('starwars-tree').remove();
      document.querySelector('#github-tree .collapsible')?.click();
    });`, 'Preview Tree');
  return source
    .replaceAll('${key}', '${__galleryEscape(key)}')
    .replaceAll('${value}', '${__galleryEscape(value)}')
    .replaceAll('${JSON.stringify(value)}', '${__galleryEscape(JSON.stringify(value))}')
    .replaceAll("typeof v === 'object' ?", "v !== null && typeof v === 'object' ?");
}

function foldingEditor(source, sample) {
  source = replace(source, /const jsonSample = `[\s\S]*?`;/,
    () => `const jsonSample = ${scriptJSON(JSON.stringify(sample, null, 2))};`, 'Folding Editor');
  return source
    .replaceAll('$(`<span class="fold-widget-item">${item.value}</span>`)', '$(\'<span class="fold-widget-item"></span>\').text(item.value)')
    .replaceAll('$(`<span class="fold-widget-item">${item}</span>`)', '$(\'<span class="fold-widget-item"></span>\').text(item)')
    .replace("typeof item === 'object' && item.key && item.value", "typeof item === 'object' && item !== null && 'key' in item")
    .replaceAll('${prop}', '${__galleryEscape(prop)}')
    .replaceAll('${path}', '${__galleryEscape(path)}');
}

function multiView(source) {
  source = source.replace(/<select id="api-select"[\s\S]*?<\/select>/, '');
  source = replace(source, /function fetchAPI\(apiUrl\) \{[\s\S]*?(?=            function updateView)/,
    `function displayData(data) {
                $('#raw-json-content').text(JSON.stringify(data, null, 2));
                Prism.highlightElement($('#raw-json-content')[0]);
                initializeJSONEditor(data);
                initializeFancyTree(data);
                updateView();
            }

`, 'Multi View data loader');
  source = replace(source, /\$\('#api-select'\)\.change\(function\(\) \{[\s\S]*?\n            \}\);/,
    '', 'Multi View API selector');
  source = replace(source, /fetchAPI\('https:\/\/api.github.com\/repositories'\);/,
    'displayData(__gallerySample);', 'Multi View startup');
  return source
    .replace('tree.fancytree("destroy")', '$("#tree").fancytree("destroy")')
    .replace('source: convertToFancyTreeFormat(data),', 'source: convertToFancyTreeFormat(data),\n                    escapeTitles: true,');
}

function launchPaths(source, sample) {
  if (!Array.isArray(sample) || sample.some(row => !row || typeof row !== 'object' || Array.isArray(row) || !('name' in row) || !('date_utc' in row))) {
    throw new Error('Launch paths needs an array of objects with name and date_utc fields.');
  }
  source = replace(source, /fetch\('https:\/\/api.spacexdata.com\/v4\/launches'\)[\s\S]*?\n        \}\);/,
    `const launches = __gallerySample;
      rawLaunches = launches;
      editor.set(launches);
      initializeTree(processLaunches(launches));
      launches.forEach(launch => extractPaths(launch));
      allPaths = [...new Map(allPaths.map(entry => [entry.path, entry])).values()];
      updatePathSelector();`, 'Launch Paths startup');
  source = source
    .replaceAll('${displayValue}', '${__galleryEscape(displayValue)}')
    .replaceAll('${path}', '${__galleryEscape(path)}')
    .replace('${date} - ${launch.name}', '${date} - ${__galleryEscape(launch.name)}');
  // Keep the source's year grouping, but let selected fields appear in its detail row.
  return replace(source, /title: `<strong>Details:<\/strong><br>[\s\S]*?\$\{launch.flight_number \? `Flight Number: \$\{launch.flight_number\}` : ''\}`/,
    `title: Object.entries(launch).map(([key, value]) => '<strong>' + __galleryEscape(key) + ':</strong> ' + __galleryEscape(typeof value === 'string' ? value : JSON.stringify(value))).join('<br>')`,
    'Launch Paths details');
}

function svgExplorer(source) {
  source = replace(source, /async function fetchLaunchData\(\) \{[\s\S]*?(?=    function renderTree)/,
    `function fetchLaunchData() {
      document.getElementById('loading').style.display = 'none';
      root = d3.hierarchy(createTreeData(__gallerySample));
      renderTree(root);
    }

`, 'SVG Explorer data loader');
  source = replace(source, /nodeUpdate\.select\('linearGradient'\)\s*\.transition\(\)/,
    `nodeUpdate.select('linearGradient').selectAll('stop')
          .attr('stop-color', function(_, index) {
            const colors = getNodeFill(this.parentNode.__data__);
            return index < 2 ? colors.key : colors.value;
          });

        nodeUpdate.select('linearGradient')
          .transition()`, 'SVG Explorer selection colors');
  return source
    .replaceAll('${node.data.name}', '${__galleryEscape(node.data.name)}')
    .replaceAll("${node.data.value || 'N/A'}", "${__galleryEscape(node.data.value ?? 'N/A')}")
    .replace('rootNode.children.forEach(collapse);', 'rootNode.children?.forEach(collapse);');
}

export function prepareExample(id, source, sample) {
  source = source.replace(/\r\n/g, '\n');
  const adapters = {
    'object-tree': objectTree,
    'preview-tree': previewTree,
    'folding-editor': foldingEditor,
    'multi-view': multiView,
    'launch-paths': launchPaths,
    'svg-explorer': svgExplorer,
  };
  if (!adapters[id]) throw new Error(`Unknown JSON example: ${id}`);
  source = adapters[id](source, sample);
  if (/\bfetch\s*\(|\$\.(?:ajax|getJSON)\s*\(/.test(source)) {
    throw new Error('The preview still contains an API request.');
  }
  const bootstrap = `<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<script>
const __gallerySample = ${scriptJSON(sample)};
const __galleryEscape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
</script>`;
  if (!/<html[\s>]/i.test(source)) source = '<html><head>' + source;
  if (!/<!doctype\s/i.test(source)) source = '<!doctype html>' + source;
  source = source.replace(/<head(?:\s[^>]*)?>/i, match => match + bootstrap);
  return source;
}
