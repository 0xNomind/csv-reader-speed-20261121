// Dependency-free ES module implementing csv-reader 1.0.0 semantics.
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = len > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  function readUnquoted(prefix) {
    let value = prefix;
    let added = 0;
    let segStart = pos;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 44) {
        if (pos > segStart) {
          value += text.slice(segStart, pos);
          added += pos - segStart;
        }
        pos += 1;
        return { value, ended: 1, added };
      }
      if (c === 10) {
        if (pos > segStart) {
          value += text.slice(segStart, pos);
          added += pos - segStart;
        }
        pos += 1;
        line += 1;
        return { value, ended: 2, added };
      }
      if (c === 13) {
        if (pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
          if (pos > segStart) {
            value += text.slice(segStart, pos);
            added += pos - segStart;
          }
          pos += 2;
          line += 1;
          return { value, ended: 2, added };
        }
        if (pos > segStart) {
          value += text.slice(segStart, pos);
          added += pos - segStart;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos += 1;
        segStart = pos;
        continue;
      }
      pos += 1;
    }
    if (pos > segStart) {
      value += text.slice(segStart, pos);
      added += pos - segStart;
    }
    return { value, ended: 0, added };
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    let segStart = pos;
    let closed = false;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 34) {
        if (pos + 1 < len && text.charCodeAt(pos + 1) === 34) {
          value += text.slice(segStart, pos + 1);
          pos += 2;
          segStart = pos;
          continue;
        }
        if (pos > segStart) value += text.slice(segStart, pos);
        pos += 1;
        closed = true;
        break;
      }
      if (c === 13) {
        if (pos > segStart) value += text.slice(segStart, pos);
        value += '\n';
        line += 1;
        pos += pos + 1 < len && text.charCodeAt(pos + 1) === 10 ? 2 : 1;
        segStart = pos;
        continue;
      }
      if (c === 10) line += 1;
      pos += 1;
    }
    if (!closed) {
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }
    if (pos >= len) return { value, ended: 0 };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: 1 };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: 2 };
    }
    if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: 2 };
    }
    const junk = readUnquoted(value);
    if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
  }

  while (true) {
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = pos < len && text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === 1);

    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
