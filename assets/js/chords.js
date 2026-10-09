// Cifra Fox — Chords & ChordPro Engine
(function (global) {
  'use strict';

  // Chromatic scales
  const chromaticScaleSharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const chromaticScaleFlat  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function transposeNote(note, semitones, preferFlat = false) {
    if (!note || semitones === 0) return note;

    let useFlat = preferFlat || note.includes('b') || note === 'F' || note === 'Bb' || note === 'Eb';
    if (note.includes('#')) useFlat = false;

    let scale = useFlat ? chromaticScaleFlat : chromaticScaleSharp;
    let idx = scale.indexOf(note);
    if (idx === -1) {
      const altScale = useFlat ? chromaticScaleSharp : chromaticScaleFlat;
      idx = altScale.indexOf(note);
      if (idx !== -1) {
        scale = altScale;
      }
    }
    if (idx === -1) return note;

    let newIdx = (idx + semitones) % 12;
    if (newIdx < 0) newIdx += 12;
    return scale[newIdx];
  }

  function transposeChordToken(token, semitones, preferFlat = false) {
    if (!token || semitones === 0) return token;

    // Transpose root note at start of token (e.g., "G7M" -> root "G", ext "7M")
    // and bass note after slash (e.g., "D/F#" -> root "D", bass "F#")
    return token
      .replace(/^([A-G][b#]?)/, (_, root) => transposeNote(root, semitones, preferFlat))
      .replace(/\/([A-G][b#]?)/, (_, bass) => '/' + transposeNote(bass, semitones, preferFlat));
  }

  function transposeChordString(chordStr, semitones, preferFlat = false) {
    if (!chordStr || semitones === 0) return chordStr;
    // Split preserving whitespaces for chord lines with multiple chords
    return chordStr.split(/(\s+)/).map(part => {
      if (/^\s+$/.test(part) || !part) return part;
      return transposeChordToken(part, semitones, preferFlat);
    }).join('');
  }

  function parseLineToSegments(line) {
    // Parse ChordPro line into segments of { chord, text }
    const segments = [];
    const regex = /\[(.*?)\]/g;
    let lastIndex = 0;
    let match;

    if (!line.includes('[')) {
      return [{ chord: '', text: line }];
    }

    while ((match = regex.exec(line)) !== null) {
      const chord = match[1];
      const textBefore = line.slice(lastIndex, match.index);
      if (textBefore && segments.length === 0) {
        segments.push({ chord: '', text: textBefore });
      } else if (textBefore && segments.length > 0) {
        segments[segments.length - 1].text += textBefore;
      }

      segments.push({ chord: chord, text: '' });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      const remainingText = line.slice(lastIndex);
      if (segments.length > 0) {
        segments[segments.length - 1].text += remainingText;
      } else {
        segments.push({ chord: '', text: remainingText });
      }
    }

    return segments;
  }

  function parseChordProToSections(chordproText) {
    if (!chordproText) return [];
    const lines = chordproText.split('\n');
    const sections = [];
    let currentSection = { tag: 'Geral', lines: [] };

    lines.forEach(rawLine => {
      const trimmed = rawLine.trim();
      const tagMatch = trimmed.match(/^\[(Intro|Primeira Parte|Segunda Parte|Terceira Parte|Quarta Parte|Quinta Parte|Sexta Parte|Refrão|Refrão Final|Pós-Refrão|Interlúdio|Ponte|Solo|Outro|Final|Verso.*?)\]$/i);

      if (tagMatch) {
        if (currentSection.lines.length > 0 || currentSection.tag !== 'Geral') {
          sections.push(currentSection);
        }
        currentSection = { tag: tagMatch[1], lines: [] };
      } else {
        currentSection.lines.push(rawLine);
      }
    });

    if (currentSection.lines.length > 0 || sections.length === 0) {
      sections.push(currentSection);
    }

    return sections;
  }

  function reconstructChordPro(sections) {
    return sections.map(sec => {
      const header = (sec.tag && sec.tag !== 'Geral') ? `[${sec.tag}]\n` : '';
      return header + sec.lines.join('\n');
    }).join('\n\n');
  }

  // Export
  const ChordsEngine = {
    chromaticScaleSharp,
    chromaticScaleFlat,
    escapeHtml,
    transposeNote,
    transposeChordToken,
    transposeChordString,
    parseLineToSegments,
    parseChordProToSections,
    reconstructChordPro
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChordsEngine;
  } else {
    global.ChordsEngine = ChordsEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
