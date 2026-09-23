// Literal property segments and null array wildcards keep field IDs independent of row order.
export function kindOf(value) {
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}

function fieldLabel(segments) {
  let label = '';
  for (const [index, segment] of segments.entries()) {
    if (segment === null) {
      // The top-level array contains rows, so their field labels need no leading [].
      if (index !== 0) label += '[]';
    } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
      label += (label ? '.' : '') + segment;
    } else {
      label += `[${JSON.stringify(segment)}]`;
    }
  }
  return label || 'Value';
}

function compareSegments(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] === right[index]) continue;
    if (left[index] === null) return -1;
    if (right[index] === null) return 1;
    return left[index] < right[index] ? -1 : 1;
  }
  return left.length - right.length;
}

/** Collect the union of paths and value types across every array item. */
export function collectFields(data) {
  const fields = new Map();
  function visit(value, segments) {
    const type = kindOf(value);
    // The root container is already represented by the whole-document choice.
    // Empty containers and primitive roots still need a selectable field.
    if (segments.length || (type !== 'array' && type !== 'object') || Object.keys(value).length === 0) {
      const id = JSON.stringify(segments);
      if (!fields.has(id)) fields.set(id, { id, label: fieldLabel(segments), segments, types: new Set() });
      fields.get(id).types.add(type);
    }
    if (type === 'array') {
      for (const item of value) visit(item, [...segments, null]);
    } else if (type === 'object') {
      for (const [key, item] of Object.entries(value)) visit(item, [...segments, key]);
    }
  }
  visit(data, []);
  return [...fields.values()]
    .sort((left, right) => compareSegments(left.segments, right.segments))
    .map(field => ({ ...field, types: [...field.types].sort() }));
}

function cloneJSON(value) {
  if (Array.isArray(value)) return value.map(cloneJSON);
  if (value !== null && typeof value === 'object') {
    // fromEntries defines __proto__ as an own property instead of invoking its setter.
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJSON(item)]));
  }
  return value;
}

function placeholder(value) {
  if (Array.isArray(value)) return value.map(placeholder);
  return value !== null && typeof value === 'object' ? {} : null;
}

function selectorNode() {
  return { selected: false, children: new Map() };
}

/** Retain selected subtrees and their ancestors without mutating or sharing input containers. */
export function projectFields(data, selectedIds = []) {
  const ids = [...selectedIds];
  if (ids.length === 0) return cloneJSON(data);
  const selector = selectorNode();
  for (const id of ids) {
    let segments;
    try {
      segments = JSON.parse(id);
    } catch {
      throw new TypeError('A field ID must encode an array of property names and null wildcards.');
    }
    if (!Array.isArray(segments) || segments.some(segment => segment !== null && typeof segment !== 'string')) {
      throw new TypeError('A field ID must encode an array of property names and null wildcards.');
    }
    let node = selector;
    for (const segment of segments) {
      if (!node.children.has(segment)) node.children.set(segment, selectorNode());
      node = node.children.get(segment);
    }
    node.selected = true;
  }

  const missing = Symbol('unselected');
  function project(value, node) {
    if (node.selected) return cloneJSON(value);
    if (Array.isArray(value)) {
      const itemSelector = node.children.get(null);
      if (!itemSelector) return missing;
      return value.map(item => {
        const result = project(item, itemSelector);
        return result === missing ? placeholder(item) : result;
      });
    }
    if (value !== null && typeof value === 'object') {
      const entries = [];
      for (const [key, item] of Object.entries(value)) {
        const childSelector = node.children.get(key);
        if (!childSelector) continue;
        const result = project(item, childSelector);
        if (result !== missing) entries.push([key, result]);
      }
      return Object.fromEntries(entries);
    }
    return missing;
  }
  const result = project(data, selector);
  return result === missing ? placeholder(data) : result;
}
