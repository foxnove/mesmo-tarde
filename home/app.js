import { nextTrackIndex } from './playback.mjs';

const $ = id => document.getElementById(id);
const audio = $('audio');
const seek = $('seek');
let tracks = [];
let current = 0;
let shuffle = false;
let repeat = false;
let playRequest = 0;
const history = [];

function time(seconds) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function icon(button, name) {
  button.querySelector('use').setAttribute('href', `#i-${name}`);
}

function preference(key, fallback) {
  try { return localStorage.getItem(`mesmo-tarde-${key}`) ?? fallback; }
  catch { return fallback; }
}

function savePreference(key, value) {
  try { localStorage.setItem(`mesmo-tarde-${key}`, String(value)); }
  catch { /* Listening also works with storage disabled. */ }
}

function error(message = '') {
  $('player-error').textContent = message;
  $('player-error').hidden = !message;
}

function renderPlayback() {
  const playing = !audio.paused && !audio.ended;
  document.body.classList.toggle('is-playing', playing);
  icon($('play'), playing ? 'pause' : 'play');
  icon($('album-play'), playing ? 'pause' : 'play');
  $('play').setAttribute('aria-label', playing ? 'Pausar música' : 'Reproduzir música');
  $('album-play').querySelector('span').textContent = playing ? 'Pausar' : 'Ouvir álbum';
  $('playing-label').textContent = playing ? 'TOCANDO AGORA' : 'PRONTO PARA OUVIR';
  document.querySelectorAll('.track').forEach((row, index) => {
    const active = index === current;
    row.classList.toggle('is-current', active);
    const button = row.querySelector('button');
    button.setAttribute('aria-label', `${active && playing ? 'Pausar' : 'Reproduzir'} ${tracks[index].title}`);
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
    const number = row.querySelector('.track-number');
    if (active && playing) {
      number.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-pause"/></svg>';
    } else number.textContent = String(index + 1).padStart(2, '0');
  });
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

function renderProgress() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : tracks[current]?.duration || 0;
  const position = audio.currentTime || 0;
  const ratio = duration ? Math.min(1, position / duration) : 0;
  seek.value = String(Math.round(ratio * 1000));
  seek.style.setProperty('--progress', `${ratio * 100}%`);
  seek.setAttribute('aria-valuetext', `${time(position)} de ${time(duration)}`);
  $('elapsed').textContent = time(position);
  $('duration').textContent = time(duration);
  if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && Number.isFinite(audio.duration) && audio.duration > 0) {
    try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(position, audio.duration) }); }
    catch { /* Some browsers expose the API without full audio support. */ }
  }
}

function requestPlay() {
  if (!tracks.length) return;
  const request = ++playRequest;
  error();
  // Keep play() inside the user's gesture, including track changes on iPhone.
  audio.play().catch(reason => {
    if (request !== playRequest || reason.name === 'AbortError') return;
    error(reason.name === 'NotAllowedError' ? 'Toque em reproduzir para ouvir esta música.' : 'Não foi possível tocar esta faixa. Tente novamente ou escolha outra música.');
    renderPlayback();
  });
}

function togglePlay() {
  if (audio.paused || audio.ended) requestPlay();
  else { playRequest++; audio.pause(); }
}

function selectTrack(index, play = false, remember = true) {
  if (!tracks[index]) return;
  if (remember && current !== index) history.push(current);
  if (history.length > 100) history.shift();
  playRequest++;
  current = index;
  const track = tracks[current];
  audio.src = new URL(`../mp3/${encodeURIComponent(track.file)}`, location.href).href;
  audio.load();
  error();
  $('now-title').textContent = track.title;
  $('track-counter').textContent = `${String(current + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}`;
  renderProgress();
  renderPlayback();
  if ('mediaSession' in navigator && 'MediaMetadata' in window) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title, artist: 'Diego Fox', album: 'Mesmo Tarde',
      artwork: [{ src: new URL('../CAPA%20FINAL.png', location.href).href, sizes: '1024x1024', type: 'image/png' }]
    });
  }
  if (play) requestPlay();
}

function next(ended = false) {
  const index = nextTrackIndex(current, tracks.length, { shuffle, repeat, ended });
  if (index === null) { renderPlayback(); return; }
  selectTrack(index, ended || !audio.paused);
}

function previous() {
  if (!tracks.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; renderProgress(); return; }
  const index = shuffle && history.length ? history.pop() : (current - 1 + tracks.length) % tracks.length;
  selectTrack(index, !audio.paused, false);
}

function renderVolume() {
  const value = audio.muted ? 0 : audio.volume;
  $('volume').value = String(value);
  $('volume').style.setProperty('--progress', `${value * 100}%`);
  $('volume').setAttribute('aria-valuetext', `${Math.round(value * 100)}%`);
  icon($('mute'), value === 0 ? 'muted' : 'volume');
  $('mute').setAttribute('aria-label', value === 0 ? 'Ativar som' : 'Silenciar música');
}

function renderTracks() {
  const fragment = document.createDocumentFragment();
  tracks.forEach((track, index) => {
    const row = document.createElement('li');
    row.className = 'track';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'track-button';
    const number = document.createElement('span');
    number.className = 'track-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('span');
    title.className = 'track-name';
    title.textContent = track.title;
    if (track.subtitle) {
      const subtitle = document.createElement('span');
      subtitle.className = 'track-subtitle';
      subtitle.textContent = `(${track.subtitle})`;
      title.append(subtitle);
    }
    const duration = document.createElement('span');
    duration.className = 'track-duration';
    duration.textContent = time(track.duration);
    button.append(number, title, duration);
    button.addEventListener('click', () => index === current ? togglePlay() : selectTrack(index, true));
    row.append(button);
    if (track.lyrics) {
      const link = document.createElement('a');
      link.className = 'track-cifra';
      link.href = `../${encodeURIComponent(track.lyrics)}`;
      link.setAttribute('aria-label', `Ver cifra de ${track.title}`);
      link.title = `Cifra de ${track.title}`;
      link.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-book"/></svg>';
      row.append(link);
    }
    fragment.append(row);
  });
  $('track-list').replaceChildren(fragment);
  const seconds = tracks.reduce((sum, track) => sum + track.duration, 0);
  $('album-meta').textContent = `${tracks.length} faixas · ${Math.floor(seconds / 60)} min`;
}

async function loadAlbum() {
  $('retry-load').hidden = true;
  $('load-status').textContent = 'Preparando as músicas…';
  try {
    const response = await fetch(new URL('./tracks.json', import.meta.url));
    if (!response.ok) throw new Error('Playlist unavailable');
    const manifest = await response.json();
    if (!Array.isArray(manifest) || !manifest.length || manifest.some(t => !t.file || !t.title || !Number.isFinite(t.duration))) throw new Error('Invalid playlist');
    tracks = manifest;
    renderTracks();
    $('load-status').textContent = '';
    for (const id of ['album-play', 'shuffle', 'repeat', 'play', 'previous', 'next', 'seek', 'mute', 'volume']) $(id).disabled = false;
    selectTrack(0);
  } catch {
    $('load-status').textContent = 'Não foi possível carregar o álbum. Confira sua conexão e tente novamente.';
    $('retry-load').hidden = false;
  }
}

$('play').addEventListener('click', togglePlay);
$('album-play').addEventListener('click', togglePlay);
$('next').addEventListener('click', () => next());
$('previous').addEventListener('click', previous);
$('retry-load').addEventListener('click', loadAlbum);
$('shuffle').addEventListener('click', () => {
  shuffle = !shuffle;
  history.length = 0;
  $('shuffle').setAttribute('aria-pressed', String(shuffle));
});
$('repeat').addEventListener('click', () => {
  repeat = !repeat;
  $('repeat').setAttribute('aria-pressed', String(repeat));
});
seek.addEventListener('input', () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = Number(seek.value) / 1000 * audio.duration;
    renderProgress();
  }
});
$('volume').addEventListener('input', () => {
  audio.volume = Number($('volume').value);
  audio.muted = false;
  savePreference('volume', audio.volume);
  renderVolume();
});
$('mute').addEventListener('click', () => {
  if (audio.volume === 0) { audio.volume = 0.8; audio.muted = false; }
  else audio.muted = !audio.muted;
  renderVolume();
});
const storedVolume = Number(preference('volume', '0.8'));
audio.volume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(1, storedVolume)) : 0.8;
audio.addEventListener('play', renderPlayback);
audio.addEventListener('pause', renderPlayback);
audio.addEventListener('loadedmetadata', renderProgress);
audio.addEventListener('timeupdate', renderProgress);
audio.addEventListener('volumechange', renderVolume);
audio.addEventListener('ended', () => next(true));
audio.addEventListener('error', () => {
  if (!tracks.length) return;
  error('Esta faixa não carregou. Toque em reproduzir para tentar novamente ou escolha outra.');
  renderPlayback();
});
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest('button, a, input, textarea, select, summary, [contenteditable]')) return;
  event.preventDefault();
  togglePlay();
});

if ('mediaSession' in navigator) {
  for (const [action, handler] of Object.entries({
    play: requestPlay,
    pause: () => { playRequest++; audio.pause(); },
    previoustrack: previous,
    nexttrack: () => next(),
    seekto: details => { if (Number.isFinite(details.seekTime) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(details.seekTime, audio.duration)); }
  })) {
    try { navigator.mediaSession.setActionHandler(action, handler); }
    catch { /* Unsupported lock-screen controls are optional. */ }
  }
}

// The background is independent of the music and has no audio track.
const video = $('city-video');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = navigator.connection?.saveData === true;
let motionWanted = !reducedMotion.matches && !saveData && preference('motion', 'on') !== 'off';

function renderMotion() {
  const playing = !video.paused;
  $('motion-toggle').setAttribute('aria-pressed', String(playing));
  $('motion-toggle').setAttribute('aria-label', playing ? 'Pausar animação de fundo' : 'Reproduzir animação de fundo');
  $('motion-label').textContent = playing ? 'Pausar movimento' : 'Ativar movimento';
}

function startMotion() {
  if (!motionWanted || document.hidden) return;
  if (!video.getAttribute('src')) video.src = new URL('./assets/cidade-noturna.mp4', import.meta.url).href;
  video.muted = true;
  video.play().catch(() => { renderMotion(); });
}

$('motion-toggle').addEventListener('click', () => {
  motionWanted = video.paused;
  savePreference('motion', motionWanted ? 'on' : 'off');
  if (motionWanted) startMotion();
  else video.pause();
  renderMotion();
});
video.addEventListener('play', renderMotion);
video.addEventListener('pause', renderMotion);
video.addEventListener('error', () => { motionWanted = false; video.pause(); renderMotion(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) video.pause();
  else startMotion();
});
reducedMotion.addEventListener('change', event => {
  if (event.matches) { motionWanted = false; video.pause(); renderMotion(); }
});
renderVolume();
renderMotion();
startMotion();
loadAlbum();
