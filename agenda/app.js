// Agenda App — Frontend Controller
(function () {
  'use strict';

  let agendaData = {
    members: [],
    availability: [],
    confirmedRehearsals: []
  };

  let activeTab = 'windows'; // 'windows', 'week', 'day'
  let selectedDate = null;
  let draftSlots = [];

  const REPO_OWNER = 'foxnove';
  const REPO_NAME = 'mesmo-tarde';

  async function loadData() {
    try {
      const resp = await fetch('data.json?t=' + Date.now());
      if (resp.ok) {
        agendaData = await resp.json();
      }
    } catch (e) {
      console.warn('Could not fetch data.json, falling back to local defaults:', e);
    }

    renderConfirmedRehearsals();
    setupDateSelector();
    renderActiveTab();
  }

  function renderConfirmedRehearsals() {
    const container = document.getElementById('confirmedContainer');
    if (!container) return;
    container.innerHTML = '';

    const list = agendaData.confirmedRehearsals || [];
    if (list.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'confirmed-card';

      const badge = document.createElement('span');
      badge.className = 'confirmed-badge';
      badge.textContent = '🎸 ENSAIO CONFIRMADO';
      card.appendChild(badge);

      const title = document.createElement('div');
      title.className = 'confirmed-title';
      title.textContent = item.title || 'Ensaio Geral Oficial';
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'confirmed-meta';

      const dateItem = document.createElement('span');
      dateItem.className = 'meta-item';
      dateItem.textContent = `📅 ${AgendaEngine.formatDateDisplay(item.date)}`;
      meta.appendChild(dateItem);

      const timeItem = document.createElement('span');
      timeItem.className = 'meta-item';
      timeItem.textContent = `⏰ ${item.startTime} às ${item.endTime}`;
      meta.appendChild(timeItem);

      if (item.location) {
        const locItem = document.createElement('span');
        locItem.className = 'meta-item';
        locItem.textContent = `📍 ${item.location}`;
        meta.appendChild(locItem);
      }

      card.appendChild(meta);

      if (item.notes) {
        const notes = document.createElement('div');
        notes.className = 'confirmed-notes';
        notes.textContent = `Observação: ${item.notes}`;
        card.appendChild(notes);
      }

      container.appendChild(card);
    });
  }

  // Collect all unique dates from availability and confirmed rehearsals
  function getAllDates() {
    const dates = new Set();

    (agendaData.availability || []).forEach(entry => {
      (entry.slots || []).forEach(slot => {
        if (slot.date) dates.add(slot.date);
      });
    });

    (agendaData.confirmedRehearsals || []).forEach(r => {
      if (r.date) dates.add(r.date);
    });

    // If empty, offer upcoming 7 days
    if (dates.size === 0) {
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        dates.add(d.toISOString().slice(0, 10));
      }
    }

    return Array.from(dates).sort();
  }

  function setupDateSelector() {
    const dates = getAllDates();
    if (!selectedDate && dates.length > 0) {
      selectedDate = dates[0];
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderActiveTab();
  }

  function renderActiveTab() {
    const container = document.getElementById('tabContentContainer');
    if (!container) return;
    container.innerHTML = '';

    if (activeTab === 'windows') {
      renderBestWindows(container);
    } else if (activeTab === 'day') {
      renderDayView(container);
    } else if (activeTab === 'week') {
      renderWeekView(container);
    }
  }

  // TAB 1: Melhores Horários (Best Intersection Windows)
  function renderBestWindows(container) {
    const dates = getAllDates();
    let totalWindows = 0;

    const wrapper = document.createElement('div');

    dates.forEach(dateStr => {
      const windows = AgendaEngine.calculateIntersectionsForDate(
        dateStr,
        agendaData.members,
        agendaData.availability
      );

      if (windows.length === 0) return;
      totalWindows += windows.length;

      const dateHeader = document.createElement('div');
      dateHeader.style.margin = '24px 0 12px';
      dateHeader.style.display = 'flex';
      dateHeader.style.alignItems = 'center';
      dateHeader.style.gap = '8px';

      const dateTitle = document.createElement('h3');
      dateTitle.style.fontSize = '16px';
      dateTitle.style.fontWeight = '800';
      dateTitle.textContent = AgendaEngine.formatDateDisplay(dateStr);
      dateHeader.appendChild(dateTitle);

      wrapper.appendChild(dateHeader);

      const grid = document.createElement('div');
      grid.className = 'windows-grid';

      windows.forEach(w => {
        const card = document.createElement('div');
        card.className = 'window-card ' + (w.isIdeal ? 'ideal' : '');

        const top = document.createElement('div');
        top.className = 'card-top';

        const info = document.createElement('div');
        const dt = document.createElement('div');
        dt.className = 'card-date';
        dt.textContent = `${w.durationMinutes} minutos de ensaio`;

        const tm = document.createElement('div');
        tm.className = 'card-time';
        tm.textContent = `${w.startTime} – ${w.endTime}`;

        info.appendChild(dt);
        info.appendChild(tm);
        top.appendChild(info);

        if (w.isIdeal) {
          const badge = document.createElement('span');
          badge.className = 'badge-ideal';
          badge.textContent = '✅ HORÁRIO IDEAL';
          top.appendChild(badge);
        } else {
          const badge = document.createElement('span');
          badge.className = 'badge-score';
          badge.textContent = `${w.availableCount}/${w.totalActiveMembers} disponíveis`;
          top.appendChild(badge);
        }

        card.appendChild(top);

        // Meter
        const meter = document.createElement('div');
        meter.className = 'attendance-meter';
        const fill = document.createElement('div');
        fill.className = 'attendance-fill ' + (w.isIdeal ? '' : 'partial');
        fill.style.width = `${w.percent}%`;
        meter.appendChild(fill);
        card.appendChild(meter);

        // Musician list
        const mList = document.createElement('div');
        mList.className = 'musicians-list';

        w.availableMembers.forEach(m => {
          const row = document.createElement('div');
          row.className = 'musician-row';
          row.innerHTML = `
            <div>
              <span class="musician-name">${m.name}</span>
              <span class="musician-instrument">${m.instrument}</span>
            </div>
            <span class="status-pill available">🟢 Disponível</span>
          `;
          mList.appendChild(row);
        });

        w.maybeMembers.forEach(m => {
          const row = document.createElement('div');
          row.className = 'musician-row';
          row.innerHTML = `
            <div>
              <span class="musician-name">${m.name}</span>
              <span class="musician-instrument">${m.instrument}</span>
            </div>
            <span class="status-pill maybe">🟡 Talvez</span>
          `;
          mList.appendChild(row);
        });

        w.unavailableMembers.forEach(m => {
          const row = document.createElement('div');
          row.className = 'musician-row';
          row.innerHTML = `
            <div>
              <span class="musician-name">${m.name}</span>
              <span class="musician-instrument">${m.instrument}</span>
            </div>
            <span class="status-pill unavailable">🔴 Indisponível</span>
          `;
          mList.appendChild(row);
        });

        card.appendChild(mList);
        grid.appendChild(card);
      });

      wrapper.appendChild(grid);
    });

    if (totalWindows === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <h3>Nenhum horário comum calculado ainda</h3>
        <p>Clique em <strong>"Registrar Disponibilidade"</strong> para adicionar seus dias livres.</p>
      `;
      container.appendChild(empty);
    } else {
      container.appendChild(wrapper);
    }
  }

  // TAB 2: Visualização por Dia
  function renderDayView(container) {
    const dates = getAllDates();
    const selectorRow = document.createElement('div');
    selectorRow.className = 'day-selector-row';

    dates.forEach(d => {
      const parts = d.split('-');
      const chip = document.createElement('div');
      chip.className = 'day-chip ' + (d === selectedDate ? 'active' : '');
      chip.onclick = () => {
        selectedDate = d;
        renderActiveTab();
      };

      const dayName = document.createElement('div');
      dayName.className = 'day-name';
      const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const shortDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
      dayName.textContent = shortDays[dt.getDay()];

      const dayNum = document.createElement('div');
      dayNum.className = 'day-num';
      dayNum.textContent = parts[2];

      chip.appendChild(dayName);
      chip.appendChild(dayNum);
      selectorRow.appendChild(chip);
    });

    container.appendChild(selectorRow);

    // Timeline card for selected date
    const card = document.createElement('div');
    card.className = 'timeline-card';

    const header = document.createElement('h3');
    header.style.fontSize = '18px';
    header.style.fontWeight = '800';
    header.style.marginBottom = '16px';
    header.textContent = AgendaEngine.formatDateDisplay(selectedDate);
    card.appendChild(header);

    // List each member and their slot on this day
    const activeMembers = (agendaData.members || []).filter(m => m.active !== false);
    const mContainer = document.createElement('div');
    mContainer.style.display = 'flex';
    mContainer.style.flexDirection = 'column';
    mContainer.style.gap = '12px';

    activeMembers.forEach(member => {
      const user = member.github.toLowerCase();
      const userEntry = (agendaData.availability || []).find(e => (e.github || '').toLowerCase() === user);
      const userSlots = userEntry ? (userEntry.slots || []).filter(s => s.date === selectedDate) : [];

      const memberBlock = document.createElement('div');
      memberBlock.style.background = 'rgba(0, 0, 0, 0.25)';
      memberBlock.style.borderRadius = '8px';
      memberBlock.style.padding = '12px 14px';

      const mHeader = document.createElement('div');
      mHeader.style.display = 'flex';
      mHeader.style.justifyContent = 'space-between';
      mHeader.style.alignItems = 'center';
      mHeader.innerHTML = `
        <div>
          <strong style="font-size: 14px;">${member.name}</strong>
          <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${member.instrument}</span>
        </div>
        <span style="font-size: 11px; color: var(--text-muted);">@${member.github}</span>
      `;
      memberBlock.appendChild(mHeader);

      if (userSlots.length === 0) {
        const noSlot = document.createElement('div');
        noSlot.style.fontSize = '12px';
        noSlot.style.color = 'var(--text-dim)';
        noSlot.style.marginTop = '6px';
        noSlot.textContent = 'Não informou disponibilidade para este dia.';
        memberBlock.appendChild(noSlot);
      } else {
        const slotsRow = document.createElement('div');
        slotsRow.style.display = 'flex';
        slotsRow.style.flexWrap = 'wrap';
        slotsRow.style.gap = '8px';
        slotsRow.style.marginTop = '8px';

        userSlots.forEach(s => {
          const pill = document.createElement('span');
          pill.className = 'status-pill ' + s.status;
          const statusIcon = s.status === 'available' ? '🟢' : (s.status === 'maybe' ? '🟡' : '🔴');
          pill.textContent = `${statusIcon} ${s.startTime} às ${s.endTime}${s.note ? ' (' + s.note + ')' : ''}`;
          slotsRow.appendChild(pill);
        });
        memberBlock.appendChild(slotsRow);
      }

      mContainer.appendChild(memberBlock);
    });

    card.appendChild(mContainer);
    container.appendChild(card);
  }

  // TAB 3: Visualização da Semana
  function renderWeekView(container) {
    const dates = getAllDates();
    const activeMembers = (agendaData.members || []).filter(m => m.active !== false);

    const tableWrapper = document.createElement('div');
    tableWrapper.style.overflowX = 'auto';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';

    // Head
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border-color); color: var(--text-muted);">MÚSICO</th>`;

    dates.forEach(d => {
      const parts = d.split('-');
      const th = document.createElement('th');
      th.style.padding = '10px 8px';
      th.style.textAlign = 'center';
      th.style.borderBottom = '1px solid var(--border-color)';
      th.innerHTML = `<span style="font-size: 11px; color: var(--text-muted);">${parts[2]}/${parts[1]}</span>`;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    activeMembers.forEach(member => {
      const user = member.github.toLowerCase();
      const userEntry = (agendaData.availability || []).find(e => (e.github || '').toLowerCase() === user);

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';

      const nameTd = document.createElement('td');
      nameTd.style.padding = '12px 10px';
      nameTd.innerHTML = `<strong>${member.name}</strong><br><span style="font-size: 10px; color: var(--text-muted);">${member.instrument}</span>`;
      tr.appendChild(nameTd);

      dates.forEach(d => {
        const td = document.createElement('td');
        td.style.padding = '8px 4px';
        td.style.textAlign = 'center';

        const slots = userEntry ? (userEntry.slots || []).filter(s => s.date === d) : [];
        if (slots.length === 0) {
          td.innerHTML = `<span style="color: var(--text-dim); font-size: 11px;">—</span>`;
        } else {
          slots.forEach(s => {
            const icon = s.status === 'available' ? '🟢' : (s.status === 'maybe' ? '🟡' : '🔴');
            const item = document.createElement('div');
            item.style.fontSize = '10.5px';
            item.style.fontWeight = '700';
            item.style.whiteSpace = 'nowrap';
            item.textContent = `${icon} ${s.startTime}-${s.endTime}`;
            td.appendChild(item);
          });
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
  }

  // Availability Registration Modal
  function openRecordModal() {
    const modal = document.getElementById('recordModal');
    draftSlots = [];
    renderDraftSlots();

    // Default date to today or tomorrow
    const inputDate = document.getElementById('slotDateInput');
    if (inputDate && !inputDate.value) {
      inputDate.value = new Date().toISOString().slice(0, 10);
    }

    if (modal) modal.showModal();
  }

  function addDraftSlot() {
    const dateInput = document.getElementById('slotDateInput');
    const startInput = document.getElementById('slotStartInput');
    const endInput = document.getElementById('slotEndInput');
    const statusInput = document.getElementById('slotStatusInput');
    const noteInput = document.getElementById('slotNoteInput');

    const date = dateInput ? dateInput.value : '';
    const startTime = startInput ? startInput.value : '';
    const endTime = endInput ? endInput.value : '';
    const status = statusInput ? statusInput.value : 'available';
    const note = noteInput ? noteInput.value.trim() : '';

    if (!date || !startTime || !endTime) {
      alert('Por favor, informe data, horário de início e fim.');
      return;
    }

    if (AgendaEngine.timeToMinutes(endTime) <= AgendaEngine.timeToMinutes(startTime)) {
      alert('O horário final deve ser posterior ao horário inicial.');
      return;
    }

    draftSlots.push({
      date,
      startTime,
      endTime,
      status,
      note
    });

    renderDraftSlots();

    if (noteInput) noteInput.value = '';
  }

  function removeDraftSlot(idx) {
    draftSlots.splice(idx, 1);
    renderDraftSlots();
  }

  function renderDraftSlots() {
    const listEl = document.getElementById('draftSlotsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (draftSlots.length === 0) {
      listEl.innerHTML = `<div style="color: var(--text-dim); font-size: 11.5px; text-align: center; padding: 10px;">Nenhum horário adicionado ainda. Preencha acima e clique em "Adicionar Horário".</div>`;
      return;
    }

    draftSlots.forEach((slot, idx) => {
      const item = document.createElement('div');
      item.className = 'slot-item';

      const icon = slot.status === 'available' ? '🟢' : (slot.status === 'maybe' ? '🟡' : '🔴');
      const text = document.createElement('span');
      text.textContent = `${icon} ${slot.date} das ${slot.startTime} às ${slot.endTime}${slot.note ? ' — ' + slot.note : ''}`;

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.style.background = 'none';
      btnDel.style.border = 'none';
      btnDel.style.color = '#ef4444';
      btnDel.style.cursor = 'pointer';
      btnDel.textContent = '✕';
      btnDel.onclick = () => removeDraftSlot(idx);

      item.appendChild(text);
      item.appendChild(btnDel);
      listEl.appendChild(item);
    });
  }

  function submitAvailabilityToGithub() {
    if (draftSlots.length === 0) {
      alert('Por favor, adicione pelo menos um horário antes de prosseguir.');
      return;
    }

    // Build structured markdown & JSON body
    const jsonBlock = JSON.stringify(draftSlots, null, 2);
    let readableText = `### Minha Disponibilidade de Ensaios\n\n`;

    draftSlots.forEach(s => {
      const statusLabel = s.status === 'available' ? '🟢 DISPONÍVEL' : (s.status === 'maybe' ? '🟡 TALVEZ' : '🔴 INDISPONÍVEL');
      readableText += `- Data: **${s.date}** | Horário: **${s.startTime} - ${s.endTime}** | Status: **${statusLabel}**${s.note ? ' | Obs: ' + s.note : ''}\n`;
    });

    readableText += `\n<!-- DADOS ESTRUTURADOS -->\n\`\`\`json\n${jsonBlock}\n\`\`\`\n`;

    const title = `Disponibilidade - ${draftSlots[0].date}`;
    const issueUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/new?labels=agenda,disponibilidade&title=${encodeURIComponent(title)}&body=${encodeURIComponent(readableText)}`;

    // Open GitHub Issue in new tab
    window.open(issueUrl, '_blank', 'noopener,noreferrer');

    const modal = document.getElementById('recordModal');
    if (modal) modal.close();
  }

  // Global exposure
  window.AgendaApp = {
    loadData,
    switchTab,
    openRecordModal,
    addDraftSlot,
    submitAvailabilityToGithub
  };

  window.switchTab = switchTab;
  window.openRecordModal = openRecordModal;
  window.addDraftSlot = addDraftSlot;
  window.submitAvailabilityToGithub = submitAvailabilityToGithub;

  document.addEventListener('DOMContentLoaded', loadData);
})();
