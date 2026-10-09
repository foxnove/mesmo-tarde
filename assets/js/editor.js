// Cifra Fox — Chord & Song Interactive Editor
(function (global) {
  'use strict';

  let activeChordRef = null;
  let activeAddWordRef = null;
  let draggedChordData = null;
  let activeBlockEditIndex = null;

  function loadSongsFromStorage() {
    try {
      const saved = localStorage.getItem('cifra_fox_songs_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 13) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Falha ao carregar cifras salvas localmente:', e);
    }
    return null;
  }

  function saveSongsToStorage() {
    try {
      if (global.songs && Array.isArray(global.songs) && global.songs.length === 13) {
        localStorage.setItem('cifra_fox_songs_v2', JSON.stringify(global.songs));
      }
    } catch (e) {
      console.warn('Falha ao salvar cifras localmente:', e);
    }
  }

  function saveCurrentEdits() {
    saveSongsToStorage();
    if (typeof showToast === 'function') {
      showToast('💾 Alterações salvas com sucesso no seu navegador!', 'success');
    }
  }

  function resetCurrentSongToDefault() {
    if (!confirm('Deseja restaurar a versão oficial desta música? Todas as edições locais não salvas no GitHub serão descartadas.')) return;

    let officialSong = null;
    if (window.SONGS_DATABASE && Array.isArray(window.SONGS_DATABASE)) {
      officialSong = window.SONGS_DATABASE[global.currentSongIndex];
    } else if (typeof DEFAULT_SONGS !== 'undefined' && Array.isArray(DEFAULT_SONGS)) {
      officialSong = DEFAULT_SONGS[global.currentSongIndex];
    }

    if (officialSong) {
      global.songs[global.currentSongIndex] = JSON.parse(JSON.stringify(officialSong));
      saveSongsToStorage();
      if (typeof updateSongView === 'function') updateSongView();
      if (typeof showToast === 'function') {
        showToast('Música restaurada para a versão oficial!', 'info');
      }
    }
  }

  function exportBackupJson() {
    if (!global.songs) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(global.songs, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "cifra_fox_backup_" + new Date().toISOString().slice(0, 10) + ".json");
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
  }

  function triggerImportBackup() {
    const fileInput = document.getElementById('backupFileInput');
    if (fileInput) fileInput.click();
  }

  function handleImportBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (Array.isArray(parsed) && parsed.length === 13) {
          global.songs = parsed;
          saveSongsToStorage();
          if (typeof renderTrackLists === 'function') renderTrackLists();
          if (typeof updateSongView === 'function') updateSongView();
          if (typeof showToast === 'function') {
            showToast('Backup importado com sucesso!', 'success');
          }
        } else {
          alert('Arquivo de backup inválido: deve conter exatamente 13 músicas.');
        }
      } catch (err) {
        alert('Erro ao processar arquivo JSON de backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // Chord Editor Modal
  function openChordEditor(secIdx, lineIdx, segIdx, chord, text) {
    activeChordRef = { secIdx, lineIdx, segIdx, chord };
    const modal = document.getElementById('chordModal');
    const nameInput = document.getElementById('chordNameInput');
    if (nameInput) nameInput.value = chord;

    updateChordPositionFeedback(text);
    if (modal) modal.showModal();
  }

  function updateChordPositionFeedback(text) {
    const feedback = document.getElementById('chordPositionFeedback');
    if (!feedback) return;
    const cleanWord = (text || '').trim();
    if (cleanWord) {
      feedback.textContent = `📍 Cifra posicionada exatamente sobre: "${cleanWord}"`;
    } else {
      feedback.textContent = `📍 Cifra em linha de acordes ou espaço livre`;
    }
  }

  function appendChordSuffix(suffix) {
    const input = document.getElementById('chordNameInput');
    if (!input) return;
    input.value += suffix;
    previewChordNameChange(input.value);
  }

  function previewChordNameChange(newChord) {
    if (!activeChordRef) return;
    activeChordRef.chord = newChord.trim();
  }

  function confirmChordEdit() {
    if (!activeChordRef) return;
    const input = document.getElementById('chordNameInput');
    const newName = input ? input.value.trim() : '';
    if (!newName) {
      deleteActiveChord();
      return;
    }

    const song = global.songs[global.currentSongIndex];
    const sections = ChordsEngine.parseChordProToSections(song.chordpro);
    const sec = sections[activeChordRef.secIdx];
    if (!sec) return;

    const line = sec.lines[activeChordRef.lineIdx];
    const segments = ChordsEngine.parseLineToSegments(line);

    if (segments[activeChordRef.segIdx]) {
      segments[activeChordRef.segIdx].chord = newName;
      sec.lines[activeChordRef.lineIdx] = segments.map(s => (s.chord ? `[${s.chord}]` : '') + (s.text || '')).join('');
      song.chordpro = ChordsEngine.reconstructChordPro(sections);
      saveSongsToStorage();
      if (typeof updateSongView === 'function') updateSongView();
      if (typeof showToast === 'function') {
        showToast('Cifra atualizada para ' + newName, 'success');
      }
    }

    const modal = document.getElementById('chordModal');
    if (modal) modal.close();
  }

  function deleteActiveChord() {
    if (!activeChordRef) return;
    const song = global.songs[global.currentSongIndex];
    const sections = ChordsEngine.parseChordProToSections(song.chordpro);
    const sec = sections[activeChordRef.secIdx];
    if (!sec) return;

    const line = sec.lines[activeChordRef.lineIdx];
    const segments = ChordsEngine.parseLineToSegments(line);

    if (segments[activeChordRef.segIdx]) {
      segments[activeChordRef.segIdx].chord = '';
      sec.lines[activeChordRef.lineIdx] = segments.map(s => (s.chord ? `[${s.chord}]` : '') + (s.text || '')).join('');
      song.chordpro = ChordsEngine.reconstructChordPro(sections);
      saveSongsToStorage();
      if (typeof updateSongView === 'function') updateSongView();
      if (typeof showToast === 'function') {
        showToast('Cifra removida!', 'info');
      }
    }

    const modal = document.getElementById('chordModal');
    if (modal) modal.close();
  }

  function nudgeActiveChord(direction) {
    if (!activeChordRef) return;
    const song = global.songs[global.currentSongIndex];
    const sections = ChordsEngine.parseChordProToSections(song.chordpro);
    const sec = sections[activeChordRef.secIdx];
    if (!sec) return;

    const line = sec.lines[activeChordRef.lineIdx];
    const segments = ChordsEngine.parseLineToSegments(line);

    const curSegIdx = activeChordRef.segIdx;
    const curChord = activeChordRef.chord || (segments[curSegIdx] ? segments[curSegIdx].chord : '');

    if (direction === 'word_prev' || direction === 'char_left') {
      if (curSegIdx > 0) {
        segments[curSegIdx].chord = '';
        segments[curSegIdx - 1].chord = curChord;
        activeChordRef.segIdx = curSegIdx - 1;
        updateChordPositionFeedback(segments[curSegIdx - 1].text);
      } else {
        if (typeof showToast === 'function') showToast('Já está na primeira palavra da linha!', 'info');
        return;
      }
    } else if (direction === 'word_next' || direction === 'char_right') {
      if (curSegIdx < segments.length - 1) {
        segments[curSegIdx].chord = '';
        segments[curSegIdx + 1].chord = curChord;
        activeChordRef.segIdx = curSegIdx + 1;
        updateChordPositionFeedback(segments[curSegIdx + 1].text);
      } else {
        if (typeof showToast === 'function') showToast('Já está na última palavra da linha!', 'info');
        return;
      }
    }

    sec.lines[activeChordRef.lineIdx] = segments.map(s => (s.chord ? `[${s.chord}]` : '') + (s.text || '')).join('');
    song.chordpro = ChordsEngine.reconstructChordPro(sections);
    saveSongsToStorage();
    if (typeof updateSongView === 'function') updateSongView();
  }

  function handleChordDrop(targetSecIdx, targetLineIdx, targetSegIdx) {
    if (!draggedChordData) return;
    const song = global.songs[global.currentSongIndex];
    const sections = ChordsEngine.parseChordProToSections(song.chordpro);

    // Source
    const srcSec = sections[draggedChordData.secIdx];
    if (!srcSec) return;
    const srcLine = srcSec.lines[draggedChordData.lineIdx];
    const srcSegs = ChordsEngine.parseLineToSegments(srcLine);
    if (srcSegs[draggedChordData.segIdx]) {
      srcSegs[draggedChordData.segIdx].chord = '';
    }
    srcSec.lines[draggedChordData.lineIdx] = srcSegs.map(s => (s.chord ? `[${s.chord}]` : '') + (s.text || '')).join('');

    // Target
    const tgtSec = sections[targetSecIdx];
    if (!tgtSec) return;
    const tgtLine = tgtSec.lines[targetLineIdx];
    const tgtSegs = ChordsEngine.parseLineToSegments(tgtLine);
    if (tgtSegs[targetSegIdx]) {
      tgtSegs[targetSegIdx].chord = draggedChordData.chord;
    }
    tgtSec.lines[targetLineIdx] = tgtSegs.map(s => (s.chord ? `[${s.chord}]` : '') + (s.text || '')).join('');

    song.chordpro = ChordsEngine.reconstructChordPro(sections);
    saveSongsToStorage();
    if (typeof updateSongView === 'function') updateSongView();
    if (typeof showToast === 'function') {
      showToast('Cifra ' + draggedChordData.chord + ' movida com sucesso!', 'success');
    }
    draggedChordData = null;
  }

  // Add Chord Modal
  function openAddChordModal(secIdx, lineIdx, segIdx, targetWord) {
    activeAddWordRef = { secIdx, lineIdx, segIdx };
    const modal = document.getElementById('addChordModal');
    const display = document.getElementById('targetWordDisplay');
    if (display) display.textContent = targetWord || '[início da linha]';

    const input = document.getElementById('newChordInput');
    if (input) input.value = '';

    renderKeyChordSuggestions();
    if (modal) modal.showModal();
  }

  function renderKeyChordSuggestions() {
    const song = global.songs[global.currentSongIndex];
    const suggestionsEl = document.getElementById('commonChordsSuggestions');
    if (!suggestionsEl || !song) return;
    suggestionsEl.innerHTML = '';

    const sampleChords = [song.tom, 'Em', 'Am', 'C', 'D', 'G', 'F', 'B7', 'A7', 'D7M', 'G7M'];
    sampleChords.forEach(ch => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.textContent = ch;
      btn.onclick = () => {
        const input = document.getElementById('newChordInput');
        if (input) input.value = ch;
      };
      suggestionsEl.appendChild(btn);
    });
  }

  function confirmAddChord(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!activeAddWordRef) return;

    const input = document.getElementById('newChordInput');
    const newChord = input ? input.value.trim() : '';
    if (!newChord) return;

    const song = global.songs[global.currentSongIndex];
    const sections = ChordsEngine.parseChordProToSections(song.chordpro);
    const sec = sections[activeAddWordRef.secIdx];
    if (!sec) return;

    const line = sec.lines[activeAddWordRef.lineIdx];
    const segments = ChordsEngine.parseLineToSegments(line);

    if (segments[activeAddWordRef.segIdx]) {
      segments[activeAddWordRef.segIdx].chord = newChord;
      sec.lines[activeAddWordRef.lineIdx] = segments.map(s => (s.chord ? `[${s.chord}]` : '') + (s.text || '')).join('');
      song.chordpro = ChordsEngine.reconstructChordPro(sections);
      saveSongsToStorage();
      if (typeof updateSongView === 'function') updateSongView();
      if (typeof showToast === 'function') {
        showToast('Cifra ' + newChord + ' inserida com sucesso!', 'success');
      }
    }

    const modal = document.getElementById('addChordModal');
    if (modal) modal.close();
  }

  function deleteSection(secIdx) {
    if (!confirm('Deseja realmente remover esta seção?')) return;
    const song = global.songs[global.currentSongIndex];
    const sections = ChordsEngine.parseChordProToSections(song.chordpro);
    sections.splice(secIdx, 1);
    song.chordpro = ChordsEngine.reconstructChordPro(sections);
    saveSongsToStorage();
    if (typeof updateSongView === 'function') updateSongView();
    if (typeof showToast === 'function') {
      showToast('Seção removida.', 'info');
    }
  }

  // ChordPro Text Editor Modal
  function openTextEditor() {
    activeBlockEditIndex = null;
    const modal = document.getElementById('textEditorModal');
    const song = global.songs[global.currentSongIndex];
    const titleEl = document.getElementById('textEditorTitle');
    if (titleEl && song) titleEl.textContent = '📝 Editor Completo: ' + song.title;

    const textarea = document.getElementById('chordproTextarea');
    if (textarea && song) textarea.value = song.chordpro;
    updateTextEditorPreview();
    if (modal) modal.showModal();
  }

  function openBlockTextEditor(secIdx) {
    activeBlockEditIndex = secIdx;
    const song = global.songs[global.currentSongIndex];
    const sections = ChordsEngine.parseChordProToSections(song.chordpro);
    const sec = sections[secIdx];
    if (!sec) return;

    const modal = document.getElementById('textEditorModal');
    const titleEl = document.getElementById('textEditorTitle');
    if (titleEl) titleEl.textContent = '✏️ Editar Bloco [' + sec.tag + ']';

    const textarea = document.getElementById('chordproTextarea');
    if (textarea) textarea.value = `[${sec.tag}]\n${sec.lines.join('\n')}`;
    updateTextEditorPreview();
    if (modal) modal.showModal();
  }

  // Safe DOM-based preview avoiding direct innerHTML vulnerabilities
  function updateTextEditorPreview() {
    const textarea = document.getElementById('chordproTextarea');
    const previewEl = document.getElementById('editorLivePreview');
    if (!textarea || !previewEl) return;

    const text = textarea.value;
    const sections = ChordsEngine.parseChordProToSections(text);
    previewEl.innerHTML = '';

    sections.forEach(sec => {
      const secDiv = document.createElement('div');
      secDiv.style.marginBottom = '12px';

      const tagSpan = document.createElement('span');
      tagSpan.style.color = '#0284c7';
      tagSpan.style.fontWeight = 'bold';
      tagSpan.textContent = `[${sec.tag}]`;
      secDiv.appendChild(tagSpan);
      secDiv.appendChild(document.createElement('br'));

      sec.lines.forEach(line => {
        const lineDiv = document.createElement('div');
        lineDiv.style.display = 'flex';
        lineDiv.style.flexWrap = 'wrap';
        lineDiv.style.alignItems = 'flex-end';
        lineDiv.style.marginBottom = '2px';

        const segs = ChordsEngine.parseLineToSegments(line);
        segs.forEach(s => {
          const segSpan = document.createElement('span');
          segSpan.style.display = 'inline-flex';
          segSpan.style.flexDirection = 'column';
          segSpan.style.whiteSpace = 'pre';

          const chordSpan = document.createElement('span');
          chordSpan.style.color = 'var(--primary)';
          chordSpan.style.fontWeight = 'bold';
          chordSpan.style.minHeight = '14px';
          chordSpan.textContent = s.chord || ' ';

          const textSpan = document.createElement('span');
          textSpan.textContent = s.text || '';

          segSpan.appendChild(chordSpan);
          segSpan.appendChild(textSpan);
          lineDiv.appendChild(segSpan);
        });

        secDiv.appendChild(lineDiv);
      });

      previewEl.appendChild(secDiv);
    });
  }

  function saveTextEditorContent() {
    const textarea = document.getElementById('chordproTextarea');
    if (!textarea) return;
    const newText = textarea.value;
    const song = global.songs[global.currentSongIndex];
    if (!song) return;

    if (activeBlockEditIndex === null) {
      song.chordpro = newText;
    } else {
      const fullSections = ChordsEngine.parseChordProToSections(song.chordpro);
      const editedBlock = ChordsEngine.parseChordProToSections(newText)[0];
      if (editedBlock) {
        fullSections[activeBlockEditIndex] = editedBlock;
        song.chordpro = ChordsEngine.reconstructChordPro(fullSections);
      }
    }

    saveSongsToStorage();
    if (typeof updateSongView === 'function') updateSongView();
    const modal = document.getElementById('textEditorModal');
    if (modal) modal.close();
    if (typeof showToast === 'function') {
      showToast('Cifra atualizada e salva com sucesso!', 'success');
    }
  }

  // Global exposure
  global.EditorEngine = {
    loadSongsFromStorage,
    saveSongsToStorage,
    saveCurrentEdits,
    resetCurrentSongToDefault,
    exportBackupJson,
    triggerImportBackup,
    handleImportBackup,
    openChordEditor,
    updateChordPositionFeedback,
    appendChordSuffix,
    previewChordNameChange,
    confirmChordEdit,
    deleteActiveChord,
    nudgeActiveChord,
    handleChordDrop,
    openAddChordModal,
    renderKeyChordSuggestions,
    confirmAddChord,
    deleteSection,
    openTextEditor,
    openBlockTextEditor,
    updateTextEditorPreview,
    saveTextEditorContent,
    setDraggedChordData: (data) => { draggedChordData = data; },
    getDraggedChordData: () => draggedChordData
  };

  // Wire to window
  global.saveCurrentEdits = saveCurrentEdits;
  global.resetCurrentSongToDefault = resetCurrentSongToDefault;
  global.exportBackupJson = exportBackupJson;
  global.triggerImportBackup = triggerImportBackup;
  global.handleImportBackup = handleImportBackup;
  global.openChordEditor = openChordEditor;
  global.appendChordSuffix = appendChordSuffix;
  global.previewChordNameChange = previewChordNameChange;
  global.confirmChordEdit = confirmChordEdit;
  global.deleteActiveChord = deleteActiveChord;
  global.nudgeActiveChord = nudgeActiveChord;
  global.handleChordDrop = handleChordDrop;
  global.openAddChordModal = openAddChordModal;
  global.confirmAddChord = confirmAddChord;
  global.deleteSection = deleteSection;
  global.openTextEditor = openTextEditor;
  global.openBlockTextEditor = openBlockTextEditor;
  global.updateTextEditorPreview = updateTextEditorPreview;
  global.saveTextEditorContent = saveTextEditorContent;
  global.loadSongsFromStorage = loadSongsFromStorage;
  global.saveSongsToStorage = saveSongsToStorage;

})(typeof window !== 'undefined' ? window : globalThis);
