/* =========================================================
   Boot / intro sequence
   ---------------------------------------------------------
   1. "Click to power on" prompt (waits for first click)
   2. BIOS / POST text streams line by line
   3. Windows-95-style splash with a filling progress bar
   4. Fade out -> reveal desktop, type out "PAUL NGUYEN",
      then stagger the welcome nav tiles in.
   ========================================================= */
(function () {
  const screen = document.getElementById('boot-screen');
  if (!screen) return;

  const powerPrompt = document.getElementById('boot-power');
  const postEl = document.getElementById('boot-post');
  const progressBar = document.getElementById('boot-progress-bar');

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- prep the welcome window so it reveals *after* boot ----
  const nameEl = document.querySelector('#window-welcome .pixel-name');
  const eyebrowEl = document.querySelector('#window-welcome .eyebrow');
  const roleEl = document.querySelector('#window-welcome .role');
  const tiles = Array.from(
    document.querySelectorAll('#window-welcome .button-grid .nav-tile')
  );

  if (nameEl) nameEl.textContent = '';
  [eyebrowEl, roleEl].forEach((el) => el && el.classList.add('reveal-pending'));
  tiles.forEach((t) => t.classList.add('tile-pending'));

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  // ---------------- BIOS / POST ----------------
  const POST_LINES = [
    'PN BIOS v4.51PG',
    'Copyright (C) 1984-1998, Nguyen Software, Inc.',
    '',
    'Main Processor  : Pentium(R) 133MHz',
    'Memory Test     : 65536K OK',
    '',
    'Detecting IDE drives ...',
    '  Primary Master   : PAUL_NGUYEN.EXE',
    '  Primary Slave    : PORTFOLIO.DAT',
    '  Secondary Master : MINESWEEPER.EXE',
    '',
    'Boot from Hard Disk ...',
  ];

  async function runPost() {
    screen.classList.remove('phase-power');
    screen.classList.add('phase-post');

    const caret = '<span class="boot-cursor"></span>';
    let text = '';
    for (const line of POST_LINES) {
      text += line + '\n';
      postEl.innerHTML = text + caret;
      // blank lines flash by; the memory line lingers a touch longer
      await wait(reduceMotion ? 40 : line === '' ? 90 : 200);
    }
    await wait(reduceMotion ? 120 : 550);
  }

  // ---------------- Win95 splash ----------------
  async function runSplash() {
    screen.classList.remove('phase-post');
    screen.classList.add('phase-splash');
    // let the layout settle, then fill the bar
    await wait(60);
    const total = reduceMotion ? 250 : 2200;
    progressBar.style.transition = `width ${total}ms linear`;
    progressBar.style.width = '100%';
    await wait(total + 250);
  }

  // ---------------- fade to desktop ----------------
  async function fadeOut() {
    screen.classList.add('boot-hidden');
    await wait(650);
    screen.classList.add('boot-gone');
  }

  // ---------------- welcome reveal ----------------
  async function typeName() {
    if (!nameEl) return;
    // caret lives inside the heading while typing
    const caret = document.createElement('span');
    caret.className = 'type-caret';

    const segments = [
      { text: 'PAUL', br: true },
      { text: 'NGUYEN', br: false },
    ];

    nameEl.appendChild(caret);
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      for (const ch of seg.text) {
        caret.insertAdjacentText('beforebegin', ch);
        await wait(reduceMotion ? 0 : 130);
      }
      if (seg.br) caret.insertAdjacentElement('beforebegin', document.createElement('br'));
    }
    // stop blinking, hold a beat, then hide caret
    await wait(reduceMotion ? 0 : 450);
    caret.classList.add('caret-done');
  }

  function revealEl(el) {
    if (!el) return;
    el.classList.remove('reveal-pending');
    el.classList.add('reveal-in');
  }

  let revealed = false;
  async function revealWelcome() {
    if (revealed) return;
    revealed = true;
    revealEl(eyebrowEl);
    await typeName();
    revealEl(roleEl);
    await wait(reduceMotion ? 0 : 150);
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      t.classList.remove('tile-pending');
      t.classList.add('tile-in');
      await wait(reduceMotion ? 0 : 90);
    }
  }

  // ---------------- sequence driver ----------------
  let started = false;
  async function boot() {
    if (started) return;
    started = true;
    await runPost();
    if (skipped) return;
    await runSplash();
    if (skipped) return;
    await fadeOut();
    if (skipped) return;
    await revealWelcome();
  }

  // Kick off on the first click (fulfils "when the page is first clicked"),
  // and let a click during boot skip ahead to the desktop.
  let skipped = false;
  function skip() {
    if (skipped) return;
    skipped = true;
    screen.classList.add('boot-gone');
    revealWelcome();
  }

  // A single handler so one click does exactly one thing:
  // the first click powers on; any later click skips ahead.
  screen.addEventListener('click', () => {
    if (!started) {
      boot();
    } else if (!revealed) {
      skip();
    }
  });
})();
