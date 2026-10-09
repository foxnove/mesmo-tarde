// Cifra Fox — Audio Player Engine
(function (global) {
  'use strict';

  let isAudioPlaying = false;
  let mainAudio = null;
  let btnMainPlay = null;
  let scrubBar = null;
  let curTimeText = null;
  let durTimeText = null;
  let volSlider = null;
  let btnMute = null;
  let playerTrackTitle = null;

  function formatAudioTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function initPlayerElements() {
    mainAudio = document.getElementById('mainAudioPlayer');
    btnMainPlay = document.getElementById('btnMainPlay');
    scrubBar = document.getElementById('audioProgress');
    curTimeText = document.getElementById('curAudioTime');
    durTimeText = document.getElementById('totalAudioTime');
    volSlider = document.getElementById('volSlider');
    btnMute = document.getElementById('btnMute');
    playerTrackTitle = document.getElementById('playerTrackTitle');

    if (!mainAudio) return;

    if (volSlider) {
      volSlider.oninput = () => {
        if (!mainAudio) return;
        mainAudio.volume = parseFloat(volSlider.value);
        mainAudio.muted = false;
        if (btnMute) {
          btnMute.innerText = mainAudio.volume === 0 ? '🔇' : (mainAudio.volume > 0.5 ? '🔊' : '🔉');
        }
      };
    }

    if (scrubBar) {
      scrubBar.oninput = () => {
        if (mainAudio && mainAudio.duration) {
          mainAudio.currentTime = (parseFloat(scrubBar.value) / 100) * mainAudio.duration;
        }
      };
    }

    mainAudio.onloadedmetadata = () => {
      if (durTimeText) durTimeText.innerText = formatAudioTime(mainAudio.duration);
    };

    mainAudio.ontimeupdate = () => {
      if (mainAudio && mainAudio.duration) {
        if (scrubBar) scrubBar.value = (mainAudio.currentTime / mainAudio.duration) * 100;
        if (curTimeText) curTimeText.innerText = formatAudioTime(mainAudio.currentTime);
      }
    };

    mainAudio.onplay = () => {
      isAudioPlaying = true;
      if (btnMainPlay) btnMainPlay.innerText = '⏸';
    };

    mainAudio.onpause = () => {
      isAudioPlaying = false;
      if (btnMainPlay) btnMainPlay.innerText = '▶';
    };

    mainAudio.onended = () => {
      nextSong();
    };
  }

  function updatePlayerUIForCurrentSong() {
    if (!mainAudio) initPlayerElements();
    if (typeof songs === 'undefined' || !Array.isArray(songs) || songs.length === 0) return;
    const song = songs[currentSongIndex];
    if (!song) return;

    if (playerTrackTitle) {
      playerTrackTitle.innerText = String(currentSongIndex + 1).padStart(2, '0') + '. ' + song.title;
    }

    const targetSrc = 'mp3/' + encodeURIComponent(song.mp3);
    const curSrc = mainAudio ? mainAudio.getAttribute('src') : null;
    if (mainAudio && curSrc !== targetSrc) {
      mainAudio.src = targetSrc;
      mainAudio.load();
      if (scrubBar) scrubBar.value = 0;
      if (curTimeText) curTimeText.innerText = '0:00';
      if (durTimeText) durTimeText.innerText = '--:--';
      if (isAudioPlaying) {
        mainAudio.play().catch(e => {
          // Autoplay policy or interaction needed
          if (btnMainPlay) btnMainPlay.innerText = '▶';
          isAudioPlaying = false;
        });
      }
    }
  }

  function toggleMainPlay() {
    if (!mainAudio) initPlayerElements();
    if (!mainAudio) return;

    if (mainAudio.paused) {
      mainAudio.play().then(() => {
        isAudioPlaying = true;
        if (btnMainPlay) btnMainPlay.innerText = '⏸';
      }).catch(err => {
        console.warn('Audio play error:', err);
      });
    } else {
      mainAudio.pause();
      isAudioPlaying = false;
      if (btnMainPlay) btnMainPlay.innerText = '▶';
    }
  }

  function nextSong() {
    if (typeof songs === 'undefined' || !songs.length) return;
    const nextIdx = (currentSongIndex + 1) % songs.length;
    if (typeof selectSong === 'function') {
      selectSong(nextIdx);
    }
  }

  function prevSong() {
    if (!mainAudio) initPlayerElements();
    if (mainAudio && mainAudio.currentTime > 3) {
      mainAudio.currentTime = 0;
      return;
    }
    if (typeof songs === 'undefined' || !songs.length) return;
    const prevIdx = (currentSongIndex - 1 + songs.length) % songs.length;
    if (typeof selectSong === 'function') {
      selectSong(prevIdx);
    }
  }

  function toggleMute() {
    if (!mainAudio) initPlayerElements();
    if (!mainAudio) return;
    mainAudio.muted = !mainAudio.muted;
    if (btnMute) {
      btnMute.innerText = mainAudio.muted ? '🔇' : (mainAudio.volume > 0.5 ? '🔊' : '🔉');
    }
  }

  // Global exposure
  global.initPlayerElements = initPlayerElements;
  global.updatePlayerUIForCurrentSong = updatePlayerUIForCurrentSong;
  global.toggleMainPlay = toggleMainPlay;
  global.nextSong = nextSong;
  global.prevSong = prevSong;
  global.toggleMute = toggleMute;
  global.formatAudioTime = formatAudioTime;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      formatAudioTime,
      toggleMainPlay,
      nextSong,
      prevSong,
      toggleMute
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
