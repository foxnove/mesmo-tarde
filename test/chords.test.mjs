import assert from 'node:assert/strict';
import test from 'node:test';
import ChordsEngine from '../assets/js/chords.js';

test('Chords transposition preserves chord qualities and extensions', () => {
  // Transposition step +1
  assert.equal(ChordsEngine.transposeChordString('G7M', 1), 'G#7M');
  assert.equal(ChordsEngine.transposeChordString('Bb7M', 1), 'B7M');
  assert.equal(ChordsEngine.transposeChordString('C#m7', 1), 'Dm7');
  assert.equal(ChordsEngine.transposeChordString('F#m', 1), 'Gm');
  assert.equal(ChordsEngine.transposeChordString('D/F#', 1), 'D#/G');
  assert.equal(ChordsEngine.transposeChordString('Asus4', 1), 'A#sus4');
  assert.equal(ChordsEngine.transposeChordString('Bdim', 1), 'Cdim');
  assert.equal(ChordsEngine.transposeChordString('Eaug', 1), 'Faug');
  assert.equal(ChordsEngine.transposeChordString('Cadd9', 1), 'C#add9');

  // Transposition step -1
  assert.equal(ChordsEngine.transposeChordString('G7M', -1), 'F#7M');
  assert.equal(ChordsEngine.transposeChordString('Bb7M', -1), 'A7M');
  assert.equal(ChordsEngine.transposeChordString('C#m7', -1), 'Cm7');
  assert.equal(ChordsEngine.transposeChordString('F#m', -1), 'Fm');
  assert.equal(ChordsEngine.transposeChordString('D/F#', -1), 'C#/F');
  assert.equal(ChordsEngine.transposeChordString('Asus4', -1), 'G#sus4');
  assert.equal(ChordsEngine.transposeChordString('Bdim', -1), 'A#dim');
  assert.equal(ChordsEngine.transposeChordString('Eaug', -1), 'D#aug');
  assert.equal(ChordsEngine.transposeChordString('Cadd9', -1), 'Badd9');

  // Multi-chord line with spaces
  assert.equal(ChordsEngine.transposeChordString('Bb7M  A7  Bb7M  A7', 1), 'B7M  A#7  B7M  A#7');
  assert.equal(ChordsEngine.transposeChordString('Bb7M  A7  Bb7M  A7', -1), 'A7M  G#7  A7M  G#7');
});

test('ChordPro parser correctly splits tags and lines', () => {
  const sample = '[Intro]\nBb7M  A7\n\n[Primeira Parte]\n[Bb7M] Ah, Deus dará[A7]';
  const sections = ChordsEngine.parseChordProToSections(sample);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].tag, 'Intro');
  assert.equal(sections[1].tag, 'Primeira Parte');

  const segments = ChordsEngine.parseLineToSegments(sections[1].lines[0]);
  assert.equal(segments[0].chord, 'Bb7M');
  assert.equal(segments[0].text, ' Ah, Deus dará');
  assert.equal(segments[1].chord, 'A7');
});

test('XSS escape helper correctly sanitizes HTML characters', () => {
  assert.equal(ChordsEngine.escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(ChordsEngine.escapeHtml('Rock & Roll'), 'Rock &amp; Roll');
});
