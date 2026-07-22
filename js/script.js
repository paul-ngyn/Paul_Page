/* =========================================================
   Window manager: dragging, focus, minimize/maximize/close,
   taskbar, start menu, clock.
   ========================================================= */
(function () {
  const desktop = document.getElementById('desktop');
  const taskbarItems = document.getElementById('taskbar-items');
  const startBtn = document.getElementById('start-btn');
  const startMenu = document.getElementById('start-menu');
  const clockEl = document.getElementById('taskbar-clock');

  const wins = Array.from(document.querySelectorAll('.win'));
  let zTop = 10;
  const taskbarBtns = new Map(); // win id -> taskbar button element

  const titleFor = (win) => win.dataset.taskbarLabel || win.querySelector('.title-text').textContent.trim();

  function bringToFront(win) {
    zTop += 1;
    win.style.zIndex = zTop;
    taskbarBtns.forEach((btn, id) => btn.classList.toggle('active', id === win.id));
  }

  function openWindow(win) {
    win.classList.remove('hidden');
    ensureTaskbarBtn(win);
    bringToFront(win);
  }

  function closeWindow(win) {
    win.classList.add('hidden');
    win.classList.remove('maximized');
    const btn = taskbarBtns.get(win.id);
    if (btn) { btn.remove(); taskbarBtns.delete(win.id); }
  }

  function minimizeWindow(win) {
    win.classList.add('hidden');
    ensureTaskbarBtn(win); // keep it available to restore
  }

  function toggleMaximize(win) {
    win.classList.toggle('maximized');
  }

  function ensureTaskbarBtn(win) {
    if (taskbarBtns.has(win.id)) return;
    const btn = document.createElement('button');
    btn.className = 'taskbar-item';
    btn.textContent = titleFor(win);
    btn.addEventListener('click', () => {
      if (win.classList.contains('hidden')) {
        openWindow(win);
      } else if (Number(win.style.zIndex) === zTop) {
        minimizeWindow(win);
      } else {
        bringToFront(win);
      }
    });
    taskbarItems.appendChild(btn);
    taskbarBtns.set(win.id, btn);
  }

  // ---- wire up every window's chrome ----
  wins.forEach((win) => {
    const titlebar = win.querySelector('.titlebar');

    win.addEventListener('mousedown', () => bringToFront(win));

    titlebar.querySelector('[data-action="close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      closeWindow(win);
    });
    titlebar.querySelector('[data-action="minimize"]').addEventListener('click', (e) => {
      e.stopPropagation();
      minimizeWindow(win);
    });
    titlebar.querySelector('[data-action="maximize"]').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMaximize(win);
    });

    // dragging
    let dragging = false, offsetX = 0, offsetY = 0;
    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tb-btn')) return;
      if (win.classList.contains('maximized')) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      bringToFront(win);
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const desktopRect = desktop.getBoundingClientRect();
      let left = e.clientX - desktopRect.left - offsetX + desktop.scrollLeft;
      let top = e.clientY - desktopRect.top - offsetY + desktop.scrollTop;
      left = Math.max(0, left);
      top = Math.max(0, top);
      win.style.left = left + 'px';
      win.style.top = top + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    // touch support (basic)
    titlebar.addEventListener('touchstart', (e) => {
      if (e.target.closest('.tb-btn')) return;
      if (win.classList.contains('maximized')) return;
      const t = e.touches[0];
      dragging = true;
      const rect = win.getBoundingClientRect();
      offsetX = t.clientX - rect.left;
      offsetY = t.clientY - rect.top;
      bringToFront(win);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      const desktopRect = desktop.getBoundingClientRect();
      let left = t.clientX - desktopRect.left - offsetX + desktop.scrollLeft;
      let top = t.clientY - desktopRect.top - offsetY + desktop.scrollTop;
      win.style.left = Math.max(0, left) + 'px';
      win.style.top = Math.max(0, top) + 'px';
    }, { passive: true });
    window.addEventListener('touchend', () => { dragging = false; });
  });

  // ---- open triggers (desktop icons, nav tiles, start menu) ----
  document.querySelectorAll('[data-open]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const win = document.getElementById(trigger.dataset.open);
      if (!win) return;
      openWindow(win);
      startMenu.classList.add('hidden');
      startBtn.classList.remove('open');
      if (win.id === 'window-minesweeper' && window.__resetMinesweeper) {
        // don't auto-reset an in-progress game on repeat opens
      }
    });
  });

  // welcome window starts open on load
  const welcome = document.getElementById('window-welcome');
  ensureTaskbarBtn(welcome);
  bringToFront(welcome);

  // ---- start menu ----
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startMenu.classList.toggle('hidden');
    startBtn.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!startMenu.contains(e.target) && e.target !== startBtn) {
      startMenu.classList.add('hidden');
      startBtn.classList.remove('open');
    }
  });

  // ---- clock ----
  function updateClock() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    clockEl.textContent = `${h}:${m} ${ampm}`;
  }
  updateClock();
  setInterval(updateClock, 1000 * 15);

  // ---- About Me photo dropzone ----
  const photoDrop = document.getElementById('photo-drop');
  const photoInput = document.getElementById('photo-input');
  if (photoDrop && photoInput) {
    photoDrop.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        photoDrop.innerHTML = '';
        const img = document.createElement('img');
        img.src = reader.result;
        img.alt = 'Profile photo';
        photoDrop.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
    ['dragover', 'dragenter'].forEach(evt =>
      photoDrop.addEventListener(evt, (e) => { e.preventDefault(); photoDrop.style.background = '#eef'; })
    );
    ['dragleave', 'drop'].forEach(evt =>
      photoDrop.addEventListener(evt, (e) => { e.preventDefault(); photoDrop.style.background = ''; })
    );
    photoDrop.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      photoInput.files = e.dataTransfer.files;
      photoInput.dispatchEvent(new Event('change'));
    });
  }
})();
