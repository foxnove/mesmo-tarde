// Cifra Fox — Main Application Controller
(function (global) {
  'use strict';

  global.songs = [];
  global.currentSongIndex = 0;
  global.currentTranspose = 0;
  global.currentFontSize = 13;
  global.isTwoColumns = true;
  global.isEditModeActive = false;

  // Notification Toast Helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = type === 'success' ? '✅ ' : (type === 'error' ? '❌ ' : 'ℹ️ ');
    toast.textContent = icon + message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Transposition
  function transpose(step) {
    global.currentTranspose += step;
    const sign = global.currentTranspose > 0 ? '+' : '';
    const offsetEl = document.getElementById('transposeOffset');
    if (offsetEl) offsetEl.textContent = sign + global.currentTranspose;
    updateSongView();
  }

  // Font Size
  function adjustFontSize(delta) {
    global.currentFontSize = Math.max(10, Math.min(24, global.currentFontSize + delta));
    const container = document.getElementById('sheetContainer');
    if (container) container.style.fontSize = global.currentFontSize + 'px';
  }

  // Columns Toggle
  function toggleColumnsView() {
    global.isTwoColumns = !global.isTwoColumns;
    const body = document.getElementById('cifraBody');
    const btn = document.getElementById('btnToggleCols');
    if (body) {
      if (global.isTwoColumns) {
        body.classList.add('columns-2');
        if (btn) btn.textContent = '📑 2 Colunas';
      } else {
        body.classList.remove('columns-2');
        if (btn) btn.textContent = '📄 1 Coluna';
      }
    }
  }

  // Theme Toggle (Light / Dark)
  function initTheme() {
    const savedTheme = localStorage.getItem('cifra_fox_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const btn = document.getElementById('btnThemeToggle');
    if (btn) btn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('cifra_fox_theme', nextTheme);
    } catch (e) {}
    const btn = document.getElementById('btnThemeToggle');
    if (btn) btn.textContent = nextTheme === 'dark' ? '☀️' : '🌙';
  }

  // URL Routing & Song Deep Linking
  function findSongIndexFromTarget(target) {
    if (!target || !global.songs || !global.songs.length) return -1;
    target = target.toLowerCase().replace(/^[#?]/, '').trim();
    if (target.startsWith('musica=')) target = target.replace('musica=', '');
    if (target.startsWith('faixa=')) target = target.replace('faixa=', '');

    // 1. Exact match by id (e.g. "01_do_azul")
    let idx = global.songs.findIndex(s => s.id && s.id.toLowerCase() === target);
    if (idx !== -1) return idx;

    // 2. Match by track number (e.g. "1", "01")
    const num = parseInt(target, 10);
    if (!isNaN(num) && num >= 1 && num <= global.songs.length) {
      return num - 1;
    }

    // 3. Match normalized slug (e.g. "do-azul", "mesmo-tarde")
    const cleanTarget = target.replace(/[^a-z0-9]/g, '');
    idx = global.songs.findIndex(s => {
      const cleanId = (s.id || '').replace(/^[0-9]+_/, '').replace(/[^a-z0-9]/g, '');
      const cleanTitle = (s.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      return cleanId === cleanTarget || cleanTitle === cleanTarget;
    });
    return idx;
  }

  function syncSongFromUrl(isInitial = false) {
    const hash = window.location.hash;
    const search = window.location.search;
    let target = hash || search;

    if (search && !hash) {
      try {
        const p = new URLSearchParams(search);
        target = p.get('musica') || p.get('faixa') || '';
      } catch (e) {}
    }

    const idx = findSongIndexFromTarget(target);
    if (idx !== -1) {
      selectSong(idx, false);
    } else if (isInitial) {
      selectSong(0, false);
    }
  }

  function selectSong(index, updateHistory = true) {
    if (!global.songs || !global.songs.length) return;
    if (index < 0 || index >= global.songs.length) index = 0;

    // Reset autoscroll on track switch
    if (typeof resetAutoScroll === 'function') {
      resetAutoScroll();
    }

    global.currentSongIndex = index;
    global.currentTranspose = 0;
    const offsetEl = document.getElementById('transposeOffset');
    if (offsetEl) offsetEl.textContent = '0';

    const song = global.songs[global.currentSongIndex];
    if (song) {
      if (updateHistory) {
        history.pushState({ songIndex: index }, '', '#' + song.id);
      }
      document.title = song.title + ' — Diego Fox | Cifra Oficial';
    }

    renderTrackLists();
    updateSongView();
    if (typeof updatePlayerUIForCurrentSong === 'function') {
      updatePlayerUIForCurrentSong();
    }
  }

  function shareCurrentSongLink() {
    const song = global.songs[global.currentSongIndex];
    if (!song) return;

    const baseUrl = window.location.href.split('#')[0].split('?')[0];
    const songUrl = baseUrl + '#' + song.id;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(songUrl).then(() => {
        showToast('🔗 Link direto de "' + song.title + '" copiado!', 'success');
      }).catch(() => {
        prompt('Copie o link da música selecionada:', songUrl);
      });
    } else {
      prompt('Copie o link da música selecionada:', songUrl);
    }
  }

  function copyCurrentSong() {
    const song = global.songs[global.currentSongIndex];
    if (!song) return;
    const textToCopy = `${song.title} - Diego Fox\nÁlbum: ${song.album}\nTom: ${song.tom} | BPM: ${song.bpm}\n\n${song.chordpro}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Cifra copiada para a área de transferência!', 'success');
      }).catch(() => {
        showToast('Erro ao copiar cifra.', 'error');
      });
    }
  }

  // Auth UI Rendering
  function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    const banner = document.getElementById('artistEditBanner');
    if (!authSection) return;
    authSection.innerHTML = '';

    const isAuthed = global.GithubAuth && global.GithubAuth.isAuthenticated();

    if (isAuthed && global.isEditModeActive) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'user-status-bar';

      const badge = document.createElement('span');
      badge.className = 'badge-artist';
      badge.textContent = 'ARTISTA (foxnove)';

      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'btn btn-secondary';
      logoutBtn.style.padding = '4px 8px';
      logoutBtn.style.fontSize = '11px';
      logoutBtn.textContent = 'Sair do Modo Artista';
      logoutBtn.onclick = () => {
        if (global.GithubAuth) global.GithubAuth.handleLogout();
      };

      statusDiv.appendChild(badge);
      statusDiv.appendChild(logoutBtn);
      authSection.appendChild(statusDiv);

      if (banner) banner.style.display = 'block';
    } else {
      const loginBtn = document.createElement('button');
      loginBtn.className = 'btn btn-primary';
      loginBtn.title = 'Entrar no Modo Artista com Token GitHub';
      loginBtn.textContent = '🔑 Entrar no Modo Artista';
      loginBtn.onclick = () => {
        if (global.GithubAuth) global.GithubAuth.openLoginModal();
      };
      authSection.appendChild(loginBtn);

      if (banner) banner.style.display = 'none';
    }
  }

  // Render Track Lists
  function renderTrackLists() {
    const desktopEl = document.getElementById('desktopTrackList');
    const mobileEl = document.getElementById('mobileTrackList');
    if (!desktopEl || !mobileEl || !global.songs) return;

    desktopEl.innerHTML = '';
    mobileEl.innerHTML = '';

    global.songs.forEach((song, idx) => {
      // Desktop
      const dItem = document.createElement('div');
      dItem.className = 'track-item ' + (idx === global.currentSongIndex ? 'active' : '');
      dItem.onclick = () => selectSong(idx);

      const dLeft = document.createElement('div');
      dLeft.className = 'track-left';

      const dNum = document.createElement('span');
      dNum.className = 'track-num';
      dNum.textContent = String(idx + 1).padStart(2, '0');

      const dName = document.createElement('span');
      dName.className = 'track-name';
      dName.textContent = song.title;

      dLeft.appendChild(dNum);
      dLeft.appendChild(dName);

      const dTom = document.createElement('span');
      dTom.className = 'track-tom-tag';
      dTom.textContent = song.tom;

      dItem.appendChild(dLeft);
      dItem.appendChild(dTom);
      desktopEl.appendChild(dItem);

      // Mobile
      const mItem = document.createElement('div');
      mItem.className = 'mobile-pill ' + (idx === global.currentSongIndex ? 'active' : '');
      mItem.onclick = () => {
        selectSong(idx);
        mItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      };

      const mTitle = document.createElement('span');
      mTitle.textContent = `${idx + 1}. ${song.title}`;

      const mTom = document.createElement('span');
      mTom.className = 'pill-tom';
      mTom.textContent = song.tom;

      mItem.appendChild(mTitle);
      mItem.appendChild(mTom);
      mobileEl.appendChild(mItem);
    });
  }

  // Song View Rendering
  function updateSongView() {
    if (!global.songs || !global.songs.length) return;
    const song = global.songs[global.currentSongIndex];
    if (!song) return;

    const currentBaseTom = song.tom.split(" ")[0];
    const rootNoteMatch = currentBaseTom.match(/^[A-G][b#]?/);
    let displayTom = song.tom;
    if (rootNoteMatch && global.currentTranspose !== 0) {
      const root = rootNoteMatch[0];
      const rest = currentBaseTom.slice(root.length);
      displayTom = ChordsEngine.transposeNote(root, global.currentTranspose) + rest;
    }

    const titleEl = document.getElementById('songTitle');
    const artistEl = document.getElementById('songArtist');
    const curTomEl = document.getElementById('curTomDisplay');
    const headerTomBadge = document.getElementById('headerTomBadge');
    const curBpmEl = document.getElementById('curBpmDisplay');
    const headerBpmBadge = document.getElementById('headerBpmBadge');

    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = `${song.artist} • Álbum: ${song.album}`;
    if (curTomEl) curTomEl.textContent = displayTom;
    if (headerTomBadge) {
      headerTomBadge.innerHTML = '';
      headerTomBadge.appendChild(document.createTextNode('Tom: '));
      const strEl = document.createElement('strong');
      strEl.textContent = displayTom;
      headerTomBadge.appendChild(strEl);
    }
    if (curBpmEl) curBpmEl.textContent = song.bpm;
    if (headerBpmBadge) {
      headerBpmBadge.innerHTML = '';
      headerBpmBadge.appendChild(document.createTextNode('BPM: '));
      const strEl = document.createElement('strong');
      strEl.textContent = song.bpm;
      headerBpmBadge.appendChild(strEl);
    }

    const container = document.getElementById('cifraBody');
    if (!container) return;
    container.innerHTML = '';

    const sections = ChordsEngine.parseChordProToSections(song.chordpro);

    sections.forEach((sec, secIdx) => {
      const secBlock = document.createElement('div');
      secBlock.className = 'section-block';
      secBlock.dataset.secIdx = secIdx;

      // Section Header
      const headerRow = document.createElement('div');
      headerRow.className = 'section-header-row';

      const tagBadge = document.createElement('div');
      tagBadge.className = 'section-tag';
      tagBadge.textContent = sec.tag ? `[${sec.tag}]` : '[Seção]';
      headerRow.appendChild(tagBadge);

      if (global.isEditModeActive) {
        const editTools = document.createElement('div');
        editTools.className = 'section-edit-tools';

        const btnEditBlock = document.createElement('button');
        btnEditBlock.className = 'btn btn-secondary';
        btnEditBlock.style.padding = '2px 7px';
        btnEditBlock.style.fontSize = '10px';
        btnEditBlock.textContent = '✏️ Bloco';
        btnEditBlock.title = 'Editar texto deste bloco';
        btnEditBlock.onclick = () => {
          if (global.openBlockTextEditor) global.openBlockTextEditor(secIdx);
        };

        const btnDelBlock = document.createElement('button');
        btnDelBlock.className = 'btn btn-secondary';
        btnDelBlock.style.padding = '2px 7px';
        btnDelBlock.style.fontSize = '10px';
        btnDelBlock.textContent = '🗑️';
        btnDelBlock.title = 'Excluir bloco';
        btnDelBlock.onclick = () => {
          if (global.deleteSection) global.deleteSection(secIdx);
        };

        editTools.appendChild(btnEditBlock);
        editTools.appendChild(btnDelBlock);
        headerRow.appendChild(editTools);
      }

      secBlock.appendChild(headerRow);

      // Lines
      sec.lines.forEach((lineText, lineIdx) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'cifra-line';
        lineEl.dataset.secIdx = secIdx;
        lineEl.dataset.lineIdx = lineIdx;

        const segments = ChordsEngine.parseLineToSegments(lineText);

        segments.forEach((seg, segIdx) => {
          const segEl = document.createElement('span');
          segEl.className = 'cifra-seg';
          segEl.dataset.secIdx = secIdx;
          segEl.dataset.lineIdx = lineIdx;
          segEl.dataset.segIdx = segIdx;

          if (global.isEditModeActive) {
            segEl.ondragover = (e) => {
              e.preventDefault();
              segEl.classList.add('drag-target');
            };
            segEl.ondragleave = () => {
              segEl.classList.remove('drag-target');
            };
            segEl.ondrop = (e) => {
              e.preventDefault();
              segEl.classList.remove('drag-target');
              if (global.handleChordDrop) global.handleChordDrop(secIdx, lineIdx, segIdx);
            };
            segEl.onclick = (e) => {
              if (e.target.classList.contains('chord-badge')) return;
              if (global.openAddChordModal) global.openAddChordModal(secIdx, lineIdx, segIdx, seg.text.trim());
            };
          }

          // Chord box
          const chordBox = document.createElement('span');
          chordBox.className = 'chord-box';

          if (seg.chord) {
            const chordBadge = document.createElement('b');
            chordBadge.className = 'chord-badge';
            const transposed = ChordsEngine.transposeChordString(seg.chord, global.currentTranspose);
            chordBadge.textContent = transposed;

            if (global.isEditModeActive) {
              chordBadge.draggable = true;
              chordBadge.title = "Clique para editar ou arraste para outra palavra";
              chordBadge.ondragstart = () => {
                if (global.EditorEngine) {
                  global.EditorEngine.setDraggedChordData({ secIdx, lineIdx, segIdx, chord: seg.chord });
                }
                chordBadge.classList.add('dragging');
              };
              chordBadge.ondragend = () => {
                chordBadge.classList.remove('dragging');
              };
              chordBadge.onclick = (e) => {
                e.stopPropagation();
                if (global.openChordEditor) {
                  global.openChordEditor(secIdx, lineIdx, segIdx, seg.chord, seg.text);
                }
              };
            }
            chordBox.appendChild(chordBadge);
          } else {
            chordBox.innerHTML = '&nbsp;';
          }

          segEl.appendChild(chordBox);

          // Lyric text
          const lyricEl = document.createElement('span');
          lyricEl.className = 'lyric-text';
          lyricEl.textContent = seg.text;
          segEl.appendChild(lyricEl);

          lineEl.appendChild(segEl);
        });

        secBlock.appendChild(lineEl);
      });

      container.appendChild(secBlock);
    });
  }

  // App Initialization
  async function initApp() {
    // 1. Priority 1: Window SONGS_DATABASE (loaded via songs_data.js script tag)
    if (window.SONGS_DATABASE && Array.isArray(window.SONGS_DATABASE) && window.SONGS_DATABASE.length === 13) {
      global.songs = JSON.parse(JSON.stringify(window.SONGS_DATABASE));
    }

    // 2. Priority 2: HTTP/HTTPS fresh fetch
    if (window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
      try {
        const resp = await fetch('songs_data.json?t=' + Date.now());
        if (resp.ok) {
          const remote = await resp.json();
          if (Array.isArray(remote) && remote.length === 13) {
            global.songs = remote;
          }
        }
      } catch (e) {
        // Fallback to embedded/local
      }
    }

    // 3. Fallback: Local storage or DEFAULT_SONGS
    if (!global.songs || global.songs.length === 0) {
      const local = global.loadSongsFromStorage ? global.loadSongsFromStorage() : null;
      if (local && local.length === 13) {
        global.songs = local;
      } else if (typeof DEFAULT_SONGS !== 'undefined' && Array.isArray(DEFAULT_SONGS)) {
        global.songs = JSON.parse(JSON.stringify(DEFAULT_SONGS));
      }
    }

    // Initialize player elements
    if (typeof initPlayerElements === 'function') {
      initPlayerElements();
    }

    initTheme();
    renderTrackLists();
    syncSongFromUrl(true);
    updateAuthUI();

    // Dialog Backdrop Fallback for light-dismiss
    document.querySelectorAll('dialog').forEach(dlg => {
      dlg.addEventListener('click', (event) => {
        if (event.target !== dlg) return;
        const rect = dlg.getBoundingClientRect();
        const isInContent = (
          rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX && event.clientX <= rect.left + rect.width
        );
        if (!isInContent) dlg.close();
      });
    });

    // Theme toggle button click listener
    const btnTheme = document.getElementById('btnThemeToggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', toggleTheme);
    }

    // Browser navigation listeners
    window.addEventListener('popstate', () => syncSongFromUrl(false));
    window.addEventListener('hashchange', () => syncSongFromUrl(false));
  }

  // Global exposure
  global.showToast = showToast;
  global.transpose = transpose;
  global.adjustFontSize = adjustFontSize;
  global.toggleColumnsView = toggleColumnsView;
  global.toggleTheme = toggleTheme;
  global.selectSong = selectSong;
  global.shareCurrentSongLink = shareCurrentSongLink;
  global.copyCurrentSong = copyCurrentSong;
  global.updateAuthUI = updateAuthUI;
  global.renderTrackLists = renderTrackLists;
  global.updateSongView = updateSongView;
  global.initApp = initApp;

  // Auto boot when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})(typeof window !== 'undefined' ? window : globalThis);
