import {
  inferType,
  JAVA_TYPES,
  parseColumns,
  safeFieldName,
  toCamelCase,
  toPascalCase,
  TS_TYPES
} from './parser.js';

import {
  openModal as buildersOpenModal,
  updateModalPreview as buildersUpdateModalPreview,
  buildOutput,
  buildTable
} from './builders.js';

import {
  initAllAnimations
} from './animations.js';

// ════════════════════════════════════════════════
//  GLOBAL STATE
// ════════════════════════════════════════════════
export let currentLang = 'ts';
export let columnRows = [];   // { original, processed, camel, type, optional, length, precision, scale, anns }
export let includeOrm = false;
export let includeValid = false;
export let editingIdx = -1;
export let activeModalTab = 'jpa';
export let filterQuery = '';

// Helper mapping getters for developers
export function getPascalName() {
  const entityName = document.getElementById('entityName').value.trim() || 'MyEntity';
  return toPascalCase(entityName.replace(/\s+/g, '_'));
}

// ════════════════════════════════════════════════
//  THEME MANAGEMENT
// ════════════════════════════════════════════════
export function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeBtn();
}

export function updateThemeBtn() {
  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.textContent = document.body.classList.contains('light-theme') ? '☾ dark' : '☀ light';
  }
}

// ════════════════════════════════════════════════
//  RENDER PIPELINE
// ════════════════════════════════════════════════
export function render() {
  const columnInput = document.getElementById('columnInput');
  const removePrefix = document.getElementById('removePrefix');
  if (!columnInput || !removePrefix) return;

  const rawVal = columnInput.value;
  const prefixVal = removePrefix.value.trim();

  // Run parser
  columnRows = parseColumns(rawVal, prefixVal, currentLang, columnRows);

  // Invoke DOM render builders
  buildTable({ columnRows, currentLang, filterQuery });
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
}

// ════════════════════════════════════════════════
//  FILTERING
// ════════════════════════════════════════════════
export function filterRows(q) {
  filterQuery = q.toLowerCase();
  buildTable({ columnRows, currentLang, filterQuery });
}

// ════════════════════════════════════════════════
//  ROW MUTATION HANDLERS
// ════════════════════════════════════════════════
export function updateRow(i, key, val) {
  columnRows[i][key] = val;
  // Reset field size/precision/scale upon type alteration
  if (key === 'type') {
    columnRows[i].length = null;
    columnRows[i].precision = null;
    columnRows[i].scale = null;
    buildTable({ columnRows, currentLang, filterQuery });
  }
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
}

export function updateRowLen(i, key, val) {
  const num = val === '' ? null : parseInt(val, 10);
  columnRows[i][key] = isNaN(num) ? null : num;

  // Keep annotation settings modal schema synchronized
  if (key === 'length') columnRows[i].anns.columnLength = num || 255;
  if (key === 'precision') columnRows[i].anns.columnPrecision = num || 0;
  if (key === 'scale') columnRows[i].anns.columnScale = num || 0;

  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
}

export function updateAnnField(i, key, val) {
  columnRows[i].anns[key] = val;
  buildTable({ columnRows, currentLang, filterQuery });
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
}

// ════════════════════════════════════════════════
//  CLEAR STATE & RESET Form inputs
// ════════════════════════════════════════════════
export function clearAll() {
  document.getElementById('columnInput').value = '';
  document.getElementById('entityName').value = 'MyEntity';
  document.getElementById('removePrefix').value = '';
  document.getElementById('mapSearch').value = '';
  filterQuery = '';
  columnRows = [];
  buildTable({ columnRows, currentLang, filterQuery });
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
}

// ════════════════════════════════════════════════
//  MODAL INTERACTIONS
// ════════════════════════════════════════════════
export function openModal(idx) {
  editingIdx = idx;
  activeModalTab = activeModalTab || 'jpa';
  buildersOpenModal(idx, columnRows, activeModalTab);
}

export function updateModalPreview(idx) {
  buildersUpdateModalPreview(idx, columnRows);
}

export function switchModalTab(tab) {
  activeModalTab = tab;
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.pane === tab));
  document.querySelectorAll('.modal-tab-pane').forEach(p => p.classList.toggle('active', p.id === 'mpane-' + tab));
}

export function setAnn(key, val) {
  if (editingIdx < 0) return;
  columnRows[editingIdx].anns[key] = val;
  buildTable({ columnRows, currentLang, filterQuery });
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
  updateModalPreview(editingIdx);
}

export function setAnnAndMirror(annKey, val, rowKey) {
  if (editingIdx < 0) return;
  columnRows[editingIdx].anns[annKey] = val;
  columnRows[editingIdx][rowKey] = val || null;
  buildTable({ columnRows, currentLang, filterQuery });
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
  updateModalPreview(editingIdx);
}

export function toggleIsId(idx, checked) {
  columnRows[idx].anns.isId = checked;
  buildTable({ columnRows, currentLang, filterQuery });
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
  updateModalPreview(idx);
}

export function setRelType(val) {
  setAnn('relType', val);
  openModal(editingIdx);
}

export function toggleSizeInputs(on) {
  const el = document.getElementById('sizeInputs');
  if (el) el.style.display = on ? 'flex' : 'none';
  if (!on) { setAnn('sizeMin', ''); setAnn('sizeMax', ''); }
}

export function toggleMinMax(on) {
  const el = document.getElementById('minMaxInputs');
  if (el) el.style.display = on ? 'flex' : 'none';
  if (!on) { setAnn('minVal', ''); setAnn('maxVal', ''); }
}

export function togglePatternInput(on) {
  const el = document.getElementById('patInput');
  if (el) el.style.display = on ? 'flex' : 'none';
  if (!on) setAnn('pattern', '');
}

export function closeModal(e) {
  if (e.target === document.getElementById('annModal')) {
    closeModalDirect();
  }
}

export function closeModalDirect() {
  document.getElementById('annModal').classList.remove('open');
  editingIdx = -1;
}

// ════════════════════════════════════════════════
//  CLIPBOARD COPY / EXPORT CODE AS FILE
// ════════════════════════════════════════════════
export function copyCode() {
  const el = document.getElementById('codeOutput');
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.line-num').forEach(n => n.remove());
  const rawText = clone.textContent;

  navigator.clipboard.writeText(rawText).then(() => {
    const btn = document.getElementById('copyBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ copied!';
    btn.style.color = 'var(--accent)';
    btn.style.borderColor = 'var(--accent)';
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2000);
  });
}

export function downloadCode() {
  const el = document.getElementById('codeOutput');
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.line-num').forEach(n => n.remove());
  const rawText = clone.textContent;

  const ext = currentLang === 'ts' ? 'ts' : 'java';
  const fn = `${getPascalName()}.${ext}`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rawText], { type: 'text/plain' }));
  a.download = fn;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ════════════════════════════════════════════════
//  JAVA ORM TOGGLES
// ════════════════════════════════════════════════
export function handleOrmClick() {
  if (currentLang === 'ts') return;
  toggleOrm(!includeOrm);
}

export function handleValidClick() {
  if (currentLang === 'ts') return;
  includeValid = !includeValid;
  document.getElementById('validTrack').classList.toggle('on', includeValid);
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
}

export function toggleOrm(on) {
  includeOrm = on;
  document.getElementById('ormTrack').classList.toggle('on', on);
  document.getElementById('ormInfo').classList.toggle('show', on);
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
}

// ════════════════════════════════════════════════
//  LANGUAGE TOGGLE SWITCH
// ════════════════════════════════════════════════
export function switchLang(lang) {
  currentLang = lang;
  document.getElementById('tab-ts').classList.toggle('active', lang === 'ts');
  document.getElementById('tab-java').classList.toggle('active', lang === 'java');

  const ormSection = document.getElementById('ormSection');
  const ormRow = document.getElementById('ormToggleRow');
  const validRow = document.getElementById('validToggleRow');
  const isTs = lang === 'ts';

  ormSection.style.opacity = isTs ? '0.4' : '1';
  ormRow.style.opacity = isTs ? '0.4' : '1';
  ormRow.style.pointerEvents = isTs ? 'none' : 'auto';
  validRow.style.opacity = isTs ? '0.4' : '1';
  validRow.style.pointerEvents = isTs ? 'none' : 'auto';

  if (isTs && includeOrm) toggleOrm(false);
  if (isTs && includeValid) {
    includeValid = false;
    document.getElementById('validTrack').classList.remove('on');
  }

  const newTypes = lang === 'ts' ? TS_TYPES : JAVA_TYPES;
  columnRows.forEach(row => {
    if (!newTypes.includes(row.type)) {
      row.type = inferType(row.processed, lang);
    }
    // Re-apply reserved keyword safeguard for the new language
    const camelRaw = toCamelCase(row.processed);
    row.camel = safeFieldName(camelRaw, lang);
  });

  buildTable({ columnRows, currentLang, filterQuery });
  buildOutput({
    columnRows,
    currentLang,
    getPascalNameFn: getPascalName,
    includeOrm,
    includeValid
  });
}

// ════════════════════════════════════════════════
//  BRIDGE REGISTRATION TO WINDOW GLOBAL SCOPE
// ════════════════════════════════════════════════
function registerGlobalBridge() {
  window.render = render;
  window.toggleTheme = toggleTheme;
  window.switchLang = switchLang;
  window.clearAll = clearAll;
  window.filterRows = filterRows;
  window.copyCode = copyCode;
  window.downloadCode = downloadCode;
  window.closeModal = closeModal;
  window.closeModalDirect = closeModalDirect;
  window.switchModalTab = switchModalTab;
  window.handleOrmClick = handleOrmClick;
  window.handleValidClick = handleValidClick;

  // Row and Annotation Dynamic builders
  window.updateRow = updateRow;
  window.updateRowLen = updateRowLen;
  window.updateAnnField = updateAnnField;
  window.openModal = openModal;
  window.toggleIsId = toggleIsId;
  window.setAnn = setAnn;
  window.setAnnAndMirror = setAnnAndMirror;
  window.setRelType = setRelType;
  window.toggleSizeInputs = toggleSizeInputs;
  window.toggleMinMax = toggleMinMax;
  window.togglePatternInput = togglePatternInput;
}

// ════════════════════════════════════════════════
//  INITIALIZATION
// ════════════════════════════════════════════════
(function init() {
  // Theme load
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
  }
  updateThemeBtn();

  // Register Global Bridge before first render!
  registerGlobalBridge();

  // Load animation listeners
  initAllAnimations();

  // Initialize display elements opacity
  const ormSection = document.getElementById('ormSection');
  const ormRow = document.getElementById('ormToggleRow');
  const validRow = document.getElementById('validToggleRow');
  if (ormSection && ormRow && validRow) {
    ormSection.style.opacity = '0.4';
    ormRow.style.opacity = '0.4';
    ormRow.style.pointerEvents = 'none';
    validRow.style.opacity = '0.4';
    validRow.style.pointerEvents = 'none';
  }

  // Pre-load example SQL columns
  const demo = `USER_ID\nFIRST_NAME\nLAST_NAME\nEMAIL\nPHONE_NUMBER\nCREATED_AT\nIS_ACTIVE\nTOTAL_AMOUNT`;
  const columnInput = document.getElementById('columnInput');
  if (columnInput) {
    columnInput.value = demo;
  }
  render();
})();
