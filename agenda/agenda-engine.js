// Agenda Engine — Interval Intersection and Issue Parser
(function (global) {
  'use strict';

  function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    const total = Math.max(0, Math.min(1440, Math.floor(mins)));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const dayOfWeek = days[d.getDay()];
        return `${dayOfWeek}, ${parts[2]} de ${months[d.getMonth()]}`;
      }
    } catch (e) {}
    return dateStr;
  }

  // Real Interval Intersection Algorithm
  function calculateIntersectionsForDate(dateStr, members = [], availabilityList = [], expectedMembers = members.filter(m => m.active !== false).length) {
    const activeMembers = members.filter(m => m.active !== false);
    if (activeMembers.length === 0) return [];

    // Collect all musician slots on this specific date
    const memberSlotsMap = new Map();
    activeMembers.forEach(m => {
      memberSlotsMap.set(m.github.toLowerCase(), []);
    });

    availabilityList.forEach(entry => {
      const user = (entry.github || '').toLowerCase();
      if (!memberSlotsMap.has(user)) return;

      const slots = (entry.slots || []).filter(s => s.date === dateStr);
      slots.forEach(slot => {
        const start = timeToMinutes(slot.startTime);
        const end = timeToMinutes(slot.endTime);
        if (end > start) {
          memberSlotsMap.get(user).push({
            start,
            end,
            status: slot.status || 'available', // available, maybe, unavailable
            note: slot.note || ''
          });
        }
      });
    });

    // Collect all boundary points
    const timePoints = new Set();
    memberSlotsMap.forEach(slots => {
      slots.forEach(s => {
        timePoints.add(s.start);
        timePoints.add(s.end);
      });
    });

    const sortedPoints = Array.from(timePoints).sort((a, b) => a - b);
    if (sortedPoints.length < 2) return [];

    // For every elementary interval between adjacent boundary points
    const elementaryIntervals = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i];
      const end = sortedPoints[i + 1];
      const mid = (start + end) / 2;

      const availableMembers = [];
      const maybeMembers = [];
      const unavailableMembers = [];
      const missingMembers = [];

      activeMembers.forEach(member => {
        const user = member.github.toLowerCase();
        const slots = memberSlotsMap.get(user) || [];
        // Explicit absence wins over contradictory overlapping answers.
        const matches = slots.filter(s => s.start <= mid && s.end >= mid);
        const matchingSlot = matches.find(s => s.status === 'unavailable') || matches.find(s => s.status === 'maybe') || matches[0];

        if (matchingSlot) {
          if (matchingSlot.status === 'available') {
            availableMembers.push(member);
          } else if (matchingSlot.status === 'maybe') {
            maybeMembers.push(member);
          } else {
            unavailableMembers.push(member);
          }
        } else {
          missingMembers.push(member);
        }
      });

      elementaryIntervals.push({
        start,
        end,
        availableMembers,
        maybeMembers,
        unavailableMembers,
        missingMembers
      });
    }

    // Merge consecutive elementary intervals that share the identical member states
    const merged = [];
    if (elementaryIntervals.length > 0) {
      let current = { ...elementaryIntervals[0] };

      for (let i = 1; i < elementaryIntervals.length; i++) {
        const next = elementaryIntervals[i];
        const sameAvail = current.availableMembers.length === next.availableMembers.length &&
          current.availableMembers.every(m => next.availableMembers.some(n => n.github === m.github));
        const sameMaybe = current.maybeMembers.length === next.maybeMembers.length &&
          current.maybeMembers.every(m => next.maybeMembers.some(n => n.github === m.github));
        const sameMissing = current.missingMembers.length === next.missingMembers.length &&
          current.missingMembers.every(m => next.missingMembers.some(n => n.github === m.github));

        if (sameAvail && sameMaybe && sameMissing) {
          // Merge
          current.end = next.end;
        } else {
          merged.push(current);
          current = { ...next };
        }
      }
      merged.push(current);
    }

    // Filter and compute scores
    const totalActive = Math.max(activeMembers.length, expectedMembers);
    const results = merged
      .filter(inv => inv.end - inv.start >= 30) // Minimum 30 min block
      .map(inv => {
        const availCount = inv.availableMembers.length;
        const maybeCount = inv.maybeMembers.length;
        const durationMinutes = inv.end - inv.start;
        const score = (availCount * 1.0) + (maybeCount * 0.5);
        const percent = Math.round((availCount / totalActive) * 100);
        const isIdeal = availCount === totalActive;

        return {
          date: dateStr,
          startTime: minutesToTime(inv.start),
          endTime: minutesToTime(inv.end),
          startMinutes: inv.start,
          endMinutes: inv.end,
          durationMinutes,
          availableMembers: inv.availableMembers,
          maybeMembers: inv.maybeMembers,
          unavailableMembers: inv.unavailableMembers,
          missingMembers: inv.missingMembers,
          awaitingCount: totalActive - inv.availableMembers.length - inv.maybeMembers.length - inv.unavailableMembers.length,
          availableCount: availCount,
          maybeCount,
          totalActiveMembers: totalActive,
          percent,
          score,
          isIdeal
        };
      })
      .filter(item => item.availableCount > 0 || item.maybeCount > 0);

    // Sort: ideal first, then highest score, then longest duration
    results.sort((a, b) => {
      if (a.isIdeal !== b.isIdeal) return a.isIdeal ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return b.durationMinutes - a.durationMinutes;
    });

    return results;
  }

  function validateSlot(slot) {
    if (!slot || typeof slot !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(slot.date || '')) return false;
    const date = new Date(slot.date + 'T12:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== slot.date) return false;
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(slot.startTime || '') || !timePattern.test(slot.endTime || '')) return false;
    return timeToMinutes(slot.endTime) > timeToMinutes(slot.startTime) &&
      ['available', 'maybe', 'unavailable'].includes(slot.status || 'available') &&
      (slot.note === undefined || typeof slot.note === 'string');
  }

  function cleanSlots(slots) {
    return slots.filter(validateSlot).map(s => ({ date: s.date, startTime: s.startTime,
      endTime: s.endTime, status: s.status || 'available', note: (s.note || '').slice(0, 500) }));
  }

  // A shared parser keeps the published snapshot and live agenda consistent.
  function buildAgendaData(members, issues, expectedMembers = 5) {
    const allowed = new Map(members.filter(m => m.active !== false).map(m => [m.github.toLowerCase(), m]));
    const entries = new Map();
    const confirmedRehearsals = [];
    const ordered = issues.filter(i => !i.pull_request && i.state !== 'closed').sort((a, b) =>
      String(a.updated_at || '').localeCompare(String(b.updated_at || '')) || a.number - b.number);
    for (const issue of ordered) {
      const login = (issue.user?.login || '').toLowerCase();
      const labels = (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase());
      if (labels.includes('ensaio-confirmado')) {
        if (login === 'foxnove') {
          const rehearsal = parseConfirmedRehearsalBody(issue.body, login, issue.number, issue.html_url);
          if (rehearsal && validateSlot({ ...rehearsal, status: 'available' })) confirmedRehearsals.push(rehearsal);
        }
        continue;
      }
      if (!allowed.has(login) || !(labels.includes('disponibilidade') || /^(?:\[Disponibilidade\]:|Disponibilidade\s*-)/i.test(issue.title || ''))) continue;
      const slots = parseAvailabilityIssueBody(issue.body);
      if (!slots.length) continue;
      if (!entries.has(login)) {
        const member = allowed.get(login);
        entries.set(login, { github: member.github, name: member.name, instrument: member.instrument, slots: [] });
      }
      const entry = entries.get(login);
      // Each issue is an independent answer. Keep all dates, suppress duplicate intervals.
      for (const slot of slots) {
        const duplicate = entry.slots.findIndex(s => s.date === slot.date && s.startTime === slot.startTime && s.endTime === slot.endTime);
        if (duplicate >= 0) entry.slots[duplicate] = slot;
        else entry.slots.push(slot);
      }
      entry.issueNumber = issue.number;
      entry.issueUrl = issue.html_url;
      entry.updatedAt = issue.updated_at;
    }
    const availability = Array.from(entries.values());
    availability.forEach(entry => entry.slots.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)));
    return { generatedAt: new Date().toISOString(), expectedMembers,
      members: members.filter(m => entries.has(m.github.toLowerCase())), availability, confirmedRehearsals };
  }

  // Parse structured GitHub Issue markdown into availability slots
  function parseAvailabilityIssueBody(bodyText) {
    if (!bodyText || typeof bodyText !== 'string') return [];
    const slots = [];

    // Approach 1: JSON block ```json ... ```
    const jsonMatch = bodyText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) {
          return cleanSlots(parsed);
        }
      } catch (e) {}
    }

    // Approach 2: Markdown lines
    // Example format:
    // - Data: 2026-10-16 | Horário: 18:00 - 22:00 | Status: DISPONÍVEL | Obs: ...
    const lines = bodyText.replace(/\*\*/g, '').split('\n');
    for (const line of lines) {
      const dateMatch = line.match(/(?:Data:\s*|###\s*)(\d{4}-\d{2}-\d{2})/);
      const timeMatch = line.match(/(\d{1,2}:\d{2})\s*(?:-|–|a|às|to)\s*(\d{1,2}:\d{2})/);

      let status = 'available';
      if (/INDISPON[IÍ]VEL|RED|🔴/i.test(line)) {
        status = 'unavailable';
      } else if (/TALVEZ|MAYBE|YELLOW|🟡/i.test(line)) {
        status = 'maybe';
      }

      const noteMatch = line.match(/(?:Obs(?:ervação)?:\s*)(.*)$/i);
      const note = noteMatch ? noteMatch[1].trim() : '';

      if (dateMatch && timeMatch) {
        slots.push({
          date: dateMatch[1],
          startTime: timeMatch[1].padStart(5, '0'),
          endTime: timeMatch[2].padStart(5, '0'),
          status,
          note
        });
      }
    }

    return cleanSlots(slots);
  }

  // Parse confirmed rehearsal issue body
  function parseConfirmedRehearsalBody(bodyText, authorLogin, issueNumber, issueUrl) {
    if (!bodyText || typeof bodyText !== 'string') return null;

    // Check JSON block
    const jsonMatch = bodyText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.date && parsed.startTime && parsed.endTime) {
          return {
            id: 'ensaio-' + issueNumber,
            title: parsed.title || 'Ensaio Confirmado',
            date: parsed.date,
            startTime: parsed.startTime,
            endTime: parsed.endTime,
            location: parsed.location || 'A definir',
            notes: parsed.notes || '',
            issueNumber,
            issueUrl,
            author: authorLogin
          };
        }
      } catch (e) {}
    }

    // Line regex parsing
    const dateMatch = bodyText.match(/(?:Data:\s*|###\s*Data\s*)(\d{4}-\d{2}-\d{2})/i);
    const timeMatch = bodyText.match(/(\d{1,2}:\d{2})\s*(?:-|–|a|às)\s*(\d{1,2}:\d{2})/);
    const locMatch = bodyText.match(/(?:Local:\s*)([^\n]+)/i);
    const notesMatch = bodyText.match(/(?:Observa[çc][õo]es?:\s*)([^\n]+)/i);

    if (dateMatch && timeMatch) {
      return {
        id: 'ensaio-' + issueNumber,
        title: 'Ensaio Confirmado',
        date: dateMatch[1],
        startTime: timeMatch[1].padStart(5, '0'),
        endTime: timeMatch[2].padStart(5, '0'),
        location: locMatch ? locMatch[1].trim() : 'Estúdio da Banda',
        notes: notesMatch ? notesMatch[1].trim() : '',
        issueNumber,
        issueUrl,
        author: authorLogin
      };
    }

    return null;
  }

  const AgendaEngine = {
    timeToMinutes,
    minutesToTime,
    formatDateDisplay,
    calculateIntersectionsForDate,
    validateSlot,
    buildAgendaData,
    parseAvailabilityIssueBody,
    parseConfirmedRehearsalBody
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgendaEngine;
  } else {
    global.AgendaEngine = AgendaEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
