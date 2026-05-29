// ════════════════════════════════════════════════
//  PIAB LOGO CLICK & PARTICLES POPUP ANIMATION
// ════════════════════════════════════════════════
let slapTimeout = null;
const PIAB_WORDS = ['เปี๊ยะ!', 'ปั๊บ!', 'ฉาด!', 'โป้ก!', 'แปะ!', 'ตึง!', 'Ctrl+C', 'Ctrl+V', 'Copy!', 'Paste!'];

export function slapLogo() {
  const mark = document.querySelector('.logo-mark');
  const piab = document.getElementById('logoPiab');
  const logoContainer = document.querySelector('.logo');
  if (!mark || !piab) return;

  // 1. Random word inside the logo mark badge
  const chosenWord = PIAB_WORDS[Math.floor(Math.random() * PIAB_WORDS.length)];
  piab.textContent = chosenWord;

  mark.classList.remove('slapping');
  void mark.offsetWidth; // Force CSS repaint / reflow
  mark.classList.add('slapping');

  clearTimeout(slapTimeout);
  slapTimeout = setTimeout(() => mark.classList.remove('slapping'), 600);

  // 2. Generate flying text particle popped in random bottom-right angles (0 to 90 deg)
  if (logoContainer) {
    const POP_WORDS = [
      'เปี๊ยะ!', 'ปั๊บ!', 'ฉาด!', 'โป้ก!', 'แปะ!',
      'ตึง!', 'Ctrl+C', 'Ctrl+V', 'Copy!', 'Paste!'
    ];

    const randomPopWord = POP_WORDS[Math.floor(Math.random() * POP_WORDS.length)];
    const popEl = document.createElement('div');
    popEl.className = 'slap-popup-text';
    popEl.textContent = randomPopWord;

    // Angle restricted to 0 to 90 degrees (right and downward direction only)
    const angle = Math.random() * (Math.PI / 2);
    const distance1 = 40 + Math.random() * 30; // Stage 1 throw distance
    const distance2 = distance1 + 35 + Math.random() * 35; // Stage 2 fadeout distance

    const tx = Math.cos(angle) * distance1;
    const ty = Math.sin(angle) * distance1;
    const tx2 = Math.cos(angle) * distance2;
    const ty2 = Math.sin(angle) * distance2;
    const rot = -10 + Math.random() * 30; // Subtle text spin

    // Propagate inline styles to CSS vars
    popEl.style.setProperty('--tx', `${tx}px`);
    popEl.style.setProperty('--ty', `${ty}px`);
    popEl.style.setProperty('--tx2', `${tx2}px`);
    popEl.style.setProperty('--ty2', `${ty2}px`);
    popEl.style.setProperty('--rot', `${rot}deg`);

    // Place origin slightly off-center to prevent clipping
    popEl.style.left = '25px';
    popEl.style.top = '20px';

    logoContainer.appendChild(popEl);

    setTimeout(() => {
      popEl.remove();
    }, 550);
  }
}

// Register slapLogo on window for backward-compatibility with inline HTML onclick attributes
window.slapLogo = slapLogo;

// ════════════════════════════════════════════════
//  PANEL RESIZE HANDLERS (DRAG AND DROP LAYOUTS)
// ════════════════════════════════════════════════

// 1. Horizontal panel resizer (Left sidebar ↔ Content)
export function initPanelResizer() {
  const resizer = document.getElementById('panelResizer');
  const leftPanel = document.getElementById('leftPanel');
  if (!resizer || !leftPanel) return;

  let dragging = false;
  let startX = 0;
  let startW = 0;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.clientX;
    startW = leftPanel.offsetWidth;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const newW = Math.max(200, Math.min(500, startW + e.clientX - startX));
    leftPanel.style.width = newW + 'px';
    document.documentElement.style.setProperty('--left-w', newW + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      resizer.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// 2. Vertical panel resizer (Mapping columns table ↕ Output editor)
export function initMapResizer() {
  const handle = document.getElementById('mapResize');
  const mapWrap = document.getElementById('mapWrap');
  if (!handle || !mapWrap) return;

  let dragging = false;
  let startY = 0;
  let startH = 0;

  handle.addEventListener('mousedown', e => {
    dragging = true;
    startY = e.clientY;
    startH = mapWrap.offsetHeight;
    handle.classList.add('active');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const newH = Math.max(80, Math.min(600, startH + e.clientY - startY));
    mapWrap.style.height = newH + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// Initialize listeners immediately upon DOM content load
export function initAllAnimations() {
  initPanelResizer();
  initMapResizer();
}
