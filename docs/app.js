// GNOME Quick Themer — GitHub Pages Application Script

document.addEventListener('DOMContentLoaded', () => {
  const presets = window.QUICK_THEMER_PRESETS || {};
  const presetKeys = Object.keys(presets);

  // Default featured presets for top strip
  const featuredNames = [
    'Tokyo Night',
    'Catppuccin Mocha',
    'Everforest Dark',
    'Nord Dark',
    'Dracula',
    'Rosé Pine',
    'Cyberpunk 2077',
    'Adwaita Dark (GNOME Default)',
    'Adwaita Light (GNOME Default)'
  ];

  // 1. Setup Theme Simulator Strip
  const strip = document.getElementById('presetStrip');
  if (strip) {
    featuredNames.forEach((name, idx) => {
      const p = presets[name];
      if (!p) return;
      const chip = document.createElement('button');
      chip.className = `preset-chip ${idx === 0 ? 'active' : ''}`;
      chip.setAttribute('data-preset', name);
      chip.innerHTML = `
        <span class="chip-swatch" style="background: ${p.accent_color}"></span>
        <span>${p.theme_name || name}</span>
      `;
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        applyPresetToSimulator(p);
      });
      strip.appendChild(chip);
    });
  }

  // Initial apply of first featured preset
  if (featuredNames.length > 0 && presets[featuredNames[0]]) {
    applyPresetToSimulator(presets[featuredNames[0]]);
  }

  // 2. Simulator Theme Applier
  function applyPresetToSimulator(p) {
    const win = document.getElementById('adwWindow');
    const wall = document.getElementById('desktopWallpaper');
    const swatch = document.getElementById('topbarSwatch');
    const themeLabel = document.getElementById('windowThemeTitle');

    if (themeLabel) {
      themeLabel.textContent = `Quick Themer Studio — ${p.theme_name || 'Personalizado'}`;
    }

    if (swatch) {
      swatch.style.background = p.accent_color;
    }

    if (win) {
      win.style.setProperty('--window-bg', p.window_bg);
      win.style.setProperty('--sidebar-bg', p.sidebar_bg);
      win.style.setProperty('--headerbar-bg', p.headerbar_bg);
      win.style.setProperty('--surface-elevated', p.surface_elevated);
      win.style.setProperty('--accent-color', p.accent_color);
      win.style.setProperty('--accent-fg', p.accent_fg);
      win.style.setProperty('--text-primary', p.text_primary);
      win.style.setProperty('--text-muted', p.text_muted);
      win.style.setProperty('--border-color', p.border_color);
      win.style.setProperty('--window-radius', `${p.window_radius || 12}px`);
      win.style.setProperty('--button-radius', `${p.button_radius || 8}px`);
      win.style.setProperty('--border-width', `${p.border_width || 1}px`);
    }

    // Dynamic SVG background wallpaper matching theme colors
    if (wall) {
      const bg = encodeURIComponent(p.window_bg || '#1e1e1e');
      const sbg = encodeURIComponent(p.sidebar_bg || '#161616');
      const acc = encodeURIComponent(p.accent_color || '#3584e4');
      const sec = encodeURIComponent(p.accent_secondary || p.accent_color || '#1c71d8');
      
      const svgBg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${sbg}" />
            <stop offset="100%" stop-color="${bg}" />
          </linearGradient>
          <linearGradient id="wave1" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${acc}" stop-opacity="0.25" />
            <stop offset="100%" stop-color="${sec}" stop-opacity="0.05" />
          </linearGradient>
          <linearGradient id="wave2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${sec}" stop-opacity="0.3" />
            <stop offset="100%" stop-color="${acc}" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(%23bgGrad)" />
        <path d="M0,450 C320,300 480,600 800,450 C1120,300 1280,620 1920,400 L1920,1080 L0,1080 Z" fill="url(%23wave1)" />
        <path d="M0,600 C400,450 650,750 1100,550 C1550,350 1700,600 1920,500 L1920,1080 L0,1080 Z" fill="url(%23wave2)" />
      </svg>`;
      
      wall.style.backgroundImage = `url("${svgBg}")`;
    }

    // Update active color dots in the demo card
    const swatchList = document.getElementById('demoColorSwatches');
    if (swatchList) {
      swatchList.innerHTML = `
        <div class="color-sample"><span class="color-dot" style="background: ${p.accent_color}"></span> ${p.accent_color}</div>
        <div class="color-sample"><span class="color-dot" style="background: ${p.window_bg}"></span> ${p.window_bg}</div>
        <div class="color-sample"><span class="color-dot" style="background: ${p.sidebar_bg}"></span> ${p.sidebar_bg}</div>
        <div class="color-sample"><span class="color-dot" style="background: ${p.headerbar_bg}"></span> ${p.headerbar_bg}</div>
      `;
    }
  }

  // 3. Render 26 Presets in Catalog Grid
  const catalogGrid = document.getElementById('presetsGrid');
  const searchInput = document.getElementById('catalogSearch');
  const catalogTabs = document.querySelectorAll('.catalog-tab');

  let currentFilter = 'all';

  function renderCatalog(filter = 'all', query = '') {
    if (!catalogGrid) return;
    catalogGrid.innerHTML = '';

    const q = query.toLowerCase().trim();

    presetKeys.forEach(key => {
      const p = presets[key];
      const isDark = (p.color_scheme || 'dark').toLowerCase() === 'dark';

      // Check scheme filter
      if (filter === 'dark' && !isDark) return;
      if (filter === 'light' && isDark) return;

      // Check search query
      if (q && !key.toLowerCase().includes(q) && !(p.theme_name || '').toLowerCase().includes(q)) {
        return;
      }

      const card = document.createElement('div');
      card.className = 'theme-card';
      card.innerHTML = `
        <div class="theme-card-header">
          <span class="theme-card-title">${key}</span>
          <span class="theme-card-badge ${isDark ? 'dark' : 'light'}">${isDark ? 'Oscuro' : 'Claro'}</span>
        </div>
        <div class="theme-card-palette">
          <span class="palette-dot" style="background: ${p.accent_color}" title="Accent: ${p.accent_color}"></span>
          <span class="palette-dot" style="background: ${p.window_bg}" title="Window: ${p.window_bg}"></span>
          <span class="palette-dot" style="background: ${p.sidebar_bg}" title="Sidebar: ${p.sidebar_bg}"></span>
          <span class="palette-dot" style="background: ${p.headerbar_bg}" title="Headerbar: ${p.headerbar_bg}"></span>
        </div>
        <button class="theme-card-action">Simular tema</button>
      `;

      card.querySelector('.theme-card-action').addEventListener('click', () => {
        applyPresetToSimulator(p);
        // Scroll smoothly to simulator
        const simSection = document.getElementById('simulator');
        if (simSection) {
          simSection.scrollIntoView({ behavior: 'smooth' });
        }
      });

      catalogGrid.appendChild(card);
    });

    if (catalogGrid.children.length === 0) {
      catalogGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--adw-text-muted); padding: 2rem;">No se encontraron paletas que coincidan con la búsqueda.</p>`;
    }
  }

  renderCatalog();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderCatalog(currentFilter, e.target.value);
    });
  }

  catalogTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      catalogTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderCatalog(currentFilter, searchInput ? searchInput.value : '');
    });
  });

  // 4. Distro Tabs Switcher
  const distroTabs = document.querySelectorAll('.distro-tab');
  const distroContents = document.querySelectorAll('.distro-tab-content');

  distroTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      distroTabs.forEach(t => t.classList.remove('active'));
      distroContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-distro');
      const content = document.getElementById(`distro-${target}`);
      if (content) content.classList.add('active');
    });
  });

  // 5. Copy Buttons
  document.querySelectorAll('[data-copy-target]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy-target');
      const targetElem = document.getElementById(targetId);
      const textToCopy = targetElem ? targetElem.textContent.replace(/^\$\s*/, '') : btn.getAttribute('data-copy-text');
      
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = `✓ Copiado`;
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = originalText;
        }, 2200);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    });
  });

  // 6. Screenshot Lightbox Modal
  const modal = document.getElementById('galleryModal');
  const modalImg = document.getElementById('modalImg');
  const modalCaption = document.getElementById('modalCaption');
  const modalClose = document.getElementById('modalClose');

  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', () => {
      const img = card.querySelector('img');
      const title = card.querySelector('h4').textContent;
      if (img && modal && modalImg) {
        modalImg.src = img.src;
        modalCaption.textContent = title;
        modal.classList.add('open');
      }
    });
  });

  if (modalClose && modal) {
    modalClose.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // 7. Site Scheme Toggle (Light / Dark website mode)
  const siteSchemeToggle = document.getElementById('toggleSiteScheme');
  if (siteSchemeToggle) {
    siteSchemeToggle.addEventListener('click', () => {
      const current = document.body.getAttribute('data-site-scheme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-site-scheme', next);
      siteSchemeToggle.innerHTML = next === 'light' ? '🌙' : '☀️';
    });
  }
});
