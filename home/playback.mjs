/** Pick the next track; null means playback should stop at the album boundary. */
export function nextTrackIndex(current, count, { shuffle = false, repeat = false, ended = false, random = Math.random } = {}) {
  if (count < 1) return null;
  if (count === 1) return ended && !repeat ? null : 0;
  if (shuffle) {
    const pick = Math.floor(random() * (count - 1));
    return pick >= current ? pick + 1 : pick;
  }
  if (current + 1 < count) return current + 1;
  return ended && !repeat ? null : 0;
}
