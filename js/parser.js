// ════════════════════════════════════════════════
//  CONSTANTS & TYPES
// ════════════════════════════════════════════════
export const TS_TYPES = ['string', 'number', 'Date', 'boolean', 'any'];
export const JAVA_TYPES = ['String', 'Long', 'Integer', 'Double', 'BigDecimal', 'LocalDateTime', 'LocalDate', 'Date', 'Boolean', 'Object', 'List', 'Set'];

// Reserved keywords that must not be used as field names
export const TS_RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if',
  'import', 'in', 'instanceof', 'let', 'new', 'null', 'return', 'super', 'switch', 'this',
  'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'interface', 'implements', 'package', 'private', 'protected', 'public', 'static', 'abstract'
]);

export const JAVA_RESERVED = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
  'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final',
  'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int',
  'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public',
  'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while'
]);

// Only treat IS_/HAS_/CAN_ prefixes as boolean when the part after prefix is NOT a non-boolean noun
export const BOOL_FALSE_POSITIVE_SUFFIXES = /^(DATE|DN|DT|SN|ID|NO|NUM|SUANCE|SUE|SN_NUMBER|BN|SSAN|IP|BAN|SLAMIC)/;

// ════════════════════════════════════════════════
//  NAMING UTILITIES
// ════════════════════════════════════════════════
export function toCamelCase(str) {
  if (str.includes('_')) {
    return str.toLowerCase().replace(/[_]+(.)/g, (_, c) => c.toUpperCase());
  }
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function toPascalCase(str) {
  const c = toCamelCase(str);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function toSnakeUpper(str) {
  return str.replace(/([A-Z])/g, s => '_' + s).replace(/^_/, '').toUpperCase();
}

export function safeFieldName(name, lang = 'ts') {
  const reserved = lang === 'ts' ? TS_RESERVED : JAVA_RESERVED;
  if (reserved.has(name)) return name + 'Value';
  return name;
}

// ════════════════════════════════════════════════
//  TYPE INFERENCE PURE LOGIC
// ════════════════════════════════════════════════
export function isBooleanColumn(upper) {
  const m = upper.match(/^(?:IS_|HAS_|CAN_)(.*)$/);
  if (!m) return false;
  // If the suffix starts with something that looks like a non-boolean noun, skip
  if (BOOL_FALSE_POSITIVE_SUFFIXES.test(m[1])) return false;
  return true;
}

export function inferTypeTs(col) {
  const u = col.toUpperCase();
  if (isBooleanColumn(u)) return 'boolean';
  if (/(_ID$|_NO$|VERSION$)/.test(u)) return 'number';
  if (/(_DATE$|_AT$|_TIME$|_DT$)/.test(u)) return 'Date';
  if (/(_AMOUNT$|_PRICE$|_TOTAL$|_BALANCE$|_RATE$)/.test(u)) return 'number';
  return 'string';
}

export function inferTypeJava(col) {
  const u = col.toUpperCase();
  if (isBooleanColumn(u)) return 'Boolean';
  if (/_ID$/.test(u)) return 'Long';
  if (/(_NO$|VERSION$|_COUNT$|_QTY$|_SEQ$)/.test(u)) return 'Integer';
  if (/(_DATE$|_AT$|_DATETIME$|_DT$)/.test(u)) return 'LocalDateTime';
  if (/_TIME$/.test(u)) return 'LocalDateTime';
  if (/_DATE_ONLY$/.test(u)) return 'LocalDate';
  if (/(_AMOUNT$|_PRICE$|_TOTAL$|_BALANCE$|_RATE$)/.test(u)) return 'BigDecimal';
  if (/(_EMAIL$|_MAIL$)/.test(u)) return 'String';
  if (/_CODE$/.test(u)) return 'String';
  return 'String';
}

export function inferType(col, lang = 'ts') {
  return lang === 'ts' ? inferTypeTs(col) : inferTypeJava(col);
}

// ════════════════════════════════════════════════
//  ANNOTATION DEFAULTS
// ════════════════════════════════════════════════
export function defaultAnns() {
  return {
    isId: false,
    isTransient: false,
    generatedValue: 'IDENTITY',
    columnNullable: true,
    columnUnique: false,
    columnInsertable: true,
    columnUpdatable: true,
    columnLength: 255,
    columnPrecision: 0,
    columnScale: 0,
    notNull: false,
    notBlank: false,
    sizeMin: '',
    sizeMax: '',
    minVal: '',
    maxVal: '',
    email: false,
    pattern: '',
    relType: 'none',
    fetchType: 'LAZY',
    enumType: 'STRING',
    mappedBy: '',
    cascade: '',
  };
}

export function hasNonDefaultAnns(a) {
  return a.isId || a.columnUnique || !a.columnNullable || a.columnLength !== 255
    || a.notNull || a.notBlank || a.sizeMin || a.sizeMax || a.minVal || a.maxVal
    || a.email || a.pattern || a.relType !== 'none'
    || a.generatedValue !== 'IDENTITY' || !a.columnInsertable || !a.columnUpdatable
    || a.columnPrecision > 0 || a.columnScale > 0;
}

// ════════════════════════════════════════════════
//  SQL JUNK STRIPPING
// ════════════════════════════════════════════════
export function stripSqlLine(raw) {
  // 1. Remove inline SQL comments  -- …
  let line = raw.replace(/--.*$/, '').trim();
  // 2. Remove inline block comments /* … */
  line = line.replace(/\/\*.*?\*\//g, '').trim();
  // 3. Extract length / precision / scale from the data type portion BEFORE removing it
  let parsedLength = null;
  let parsedPrecision = null;
  let parsedScale = null;

  // Match data types with parentheses: VARCHAR(150), DECIMAL(10,2), NUMERIC(8,4)
  const typeWithArgs = line.match(/\b(?:VARCHAR2?|NVARCHAR2?|CHAR|NCHAR|CHARACTER VARYING|VARBINARY|BINARY)\s*\(\s*(\d+)\s*\)/i);
  if (typeWithArgs) {
    parsedLength = parseInt(typeWithArgs[1], 10);
  }
  const typeWithPrec = line.match(/\b(?:DECIMAL|NUMERIC|NUMBER|FLOAT|DOUBLE PRECISION|REAL)\s*\(\s*(\d+)\s*(?:,\s*(\d+))?\s*\)/i);
  if (typeWithPrec) {
    parsedPrecision = parseInt(typeWithPrec[1], 10);
    if (typeWithPrec[2] !== undefined) parsedScale = parseInt(typeWithPrec[2], 10);
  }

  // 4. Remove SQL data types (with optional parenthesized args)
  line = line.replace(/\b(BIGINT|INT8|INT4|INT2|SMALLINT|TINYINT|MEDIUMINT|INTEGER|INT|SERIAL|BIGSERIAL|SMALLSERIAL|FLOAT8|FLOAT4|FLOAT|DOUBLE\s+PRECISION|DOUBLE|REAL|DECIMAL|NUMERIC|NUMBER|BOOLEAN|BOOL|BIT|CHAR|NCHAR|CHARACTER\s+VARYING|VARBINARY|BINARY|VARCHAR2?|NVARCHAR2?|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|CLOB|BLOB|BYTEA|UUID|JSON|JSONB|XML|DATE|DATETIME|TIMESTAMP(?:\s+WITH(?:OUT)?\s+TIME\s+ZONE)?|TIME|YEAR|INTERVAL|MONEY|CIDR|INET|MACADDR)\s*(?:\([^)]*\))?/gi, '').trim();

  // 5. Remove SQL constraints / keywords
  line = line.replace(/\b(NOT\s+NULL|NULL|DEFAULT\s+\S+|PRIMARY\s+KEY|UNIQUE|AUTO_INCREMENT|AUTOINCREMENT|IDENTITY(?:\s*\([^)]*\))?|GENERATED\s+\w+|REFERENCES\s+\S+(?:\s*\([^)]*\))?|CHECK\s*\([^)]*\)|CONSTRAINT\s+\S+|ON\s+DELETE\s+\w+|ON\s+UPDATE\s+\w+|COMMENT\s+'[^']*'|COLLATE\s+\S+|CHARACTER\s+SET\s+\S+|UNSIGNED|ZEROFILL|INVISIBLE|VIRTUAL|STORED|PERSISTENT)\b/gi, '').trim();

  // 6. Remove trailing comma and any remaining non-identifier characters from the end
  line = line.replace(/[,;]+$/, '').trim();

  // 7. Take only the first token (the column name)
  const firstToken = line.split(/\s+/)[0] || '';

  // 8. Strip any remaining non-identifier characters (keep letters, digits, underscore, dollar)
  const colName = firstToken.replace(/[^A-Za-z0-9_$]/g, '');

  return { colName, parsedLength, parsedPrecision, parsedScale };
}

// ════════════════════════════════════════════════
//  MAIN PARSE PIPELINE
// ════════════════════════════════════════════════
export function parseColumns(columnInputVal, removePrefixVal, currentLang, existingRows = []) {
  const lines = columnInputVal.split('\n').map(l => l.trim()).filter(Boolean);
  const prev = {};
  existingRows.forEach(r => { prev[r.original] = r; });

  return lines.map((line, i) => {
    // Strip SQL junk to get clean column name + auto-detected length/precision/scale
    const { colName, parsedLength, parsedPrecision, parsedScale } = stripSqlLine(line);
    if (!colName) return null;  // skip blank/comment-only lines

    const origKey = line;
    const p = prev[origKey] || prev[colName];

    let proc = colName;
    if (removePrefixVal && proc.toUpperCase().startsWith(removePrefixVal.toUpperCase())) {
      proc = proc.substring(removePrefixVal.length);
    }

    const types = currentLang === 'ts' ? TS_TYPES : JAVA_TYPES;
    let type = p ? p.type : inferType(proc, currentLang);
    if (!types.includes(type)) type = inferType(proc, currentLang);

    const anns = p ? p.anns : defaultAnns();
    if (i === 0 && !p) anns.isId = true;

    // Apply auto-extracted length/precision only when no prior user state
    if (!p) {
      if (parsedLength !== null) anns.columnLength = parsedLength;
      if (parsedPrecision !== null) anns.columnPrecision = parsedPrecision;
      if (parsedScale !== null) anns.columnScale = parsedScale;
    }

    // Inline length / precision state (separate from ann modal, reactive from table)
    const rowLength = p ? p.length : (parsedLength !== null ? parsedLength : null);
    const rowPrecision = p ? p.precision : (parsedPrecision !== null ? parsedPrecision : null);
    const rowScale = p ? p.scale : (parsedScale !== null ? parsedScale : null);

    // Apply reserved-keyword safeguard
    const camelRaw = toCamelCase(proc);
    const camel = safeFieldName(camelRaw, currentLang);

    return {
      original: origKey,
      colName: colName,   // cleaned name
      processed: proc,
      camel,
      type,
      optional: p ? p.optional : false,
      length: rowLength,
      precision: rowPrecision,
      scale: rowScale,
      anns
    };
  }).filter(Boolean);
}
