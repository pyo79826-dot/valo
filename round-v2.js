(() => {
  const roundBuilder = document.querySelector('.round-builder.with-round-number');
  const roundListEl = document.getElementById('roundList');
  const currentRoundInputEl = document.getElementById('currentRound');
  if (!roundBuilder || !roundListEl || !currentRoundInputEl) return;

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = 'round-v2.css';
  document.head.appendChild(styleLink);

  const siteSelectEl = document.getElementById('siteSelect');
  if (siteSelectEl && ![...siteSelectEl.options].some(option => option.value === 'C')) {
    const option = document.createElement('option');
    option.value = 'C';
    option.textContent = 'C';
    const midOption = [...siteSelectEl.options].find(item => item.value === 'Mid');
    siteSelectEl.insertBefore(option, midOption || null);
  }

  function blankPlacements() {
    return { A: [], B: [], C: [] };
  }

  function normalizePlacements(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      A: Array.isArray(source.A) ? source.A : [],
      B: Array.isArray(source.B) ? source.B : [],
      C: Array.isArray(source.C) ? source.C : []
    };
  }

  if (!state.draft.roundPlacements) state.draft.roundPlacements = blankPlacements();
  state.draft.roundPlacements = normalizePlacements(state.draft.roundPlacements);
  if (typeof state.draft.roundResult !== 'string') state.draft.roundResult = '';

  currentRounds = currentRounds.map(round => ({
    ...round,
    result: typeof round.result === 'string' ? round.result : '',
    placements: normalizePlacements(round.placements)
  }));
  saveState();

  const resultField = document.createElement('div');
  resultField.className = 'round-result-field';
  resultField.innerHTML = `
    <label for="roundResult">勝敗</label>
    <select id="roundResult">
      <option value="">未記録</option>
      <option value="WIN">WIN</option>
      <option value="LOSS">LOSS</option>
    </select>
  `;

  const oldAddButton = document.getElementById('addRound');
  roundBuilder.insertBefore(resultField, oldAddButton);
  const roundResultEl = document.getElementById('roundResult');
  roundResultEl.value = state.draft.roundResult || '';
  roundResultEl.addEventListener('change', () => {
    state.draft.roundResult = roundResultEl.value;
    saveState();
  });

  const placementEditor = document.createElement('div');
  placementEditor.className = 'round-placement-editor';
  placementEditor.innerHTML = `
    <div class="round-placement-head">
      <div>
        <strong>エージェント配置</strong>
        <span>一覧からA / B / Cへドラッグ。スマホはエージェント選択→サイトをタップ。</span>
      </div>
      <button type="button" class="ghost-btn" id="clearRoundPlacements">配置をクリア</button>
    </div>
    <div class="round-site-grid">
      <div class="round-site-zone" data-round-site="A"><div class="round-site-label">A</div><div class="round-site-agents" data-round-site-agents="A"></div></div>
      <div class="round-site-zone" data-round-site="B"><div class="round-site-label">B</div><div class="round-site-agents" data-round-site-agents="B"></div></div>
      <div class="round-site-zone" data-round-site="C"><div class="round-site-label">C</div><div class="round-site-agents" data-round-site-agents="C"></div></div>
    </div>
  `;
  roundBuilder.insertAdjacentElement('afterend', placementEditor);

  function removeRoundAgentEverywhere(uuid) {
    Object.values(state.draft.roundPlacements).forEach(list => {
      const index = list.findIndex(agent => agent.uuid === uuid);
      if (index !== -1) list.splice(index, 1);
    });
  }

  function placeRoundAgent(site, agent) {
    if (!agent || !['A', 'B', 'C'].includes(site)) return;
    removeRoundAgentEverywhere(agent.uuid);
    state.draft.roundPlacements[site].push({ uuid: agent.uuid, name: agent.name, icon: agent.icon });
    saveState();
    renderRoundPlacementEditor();
    showToast(`${agent.name} → ${site}`);
  }

  function renderRoundPlacementEditor() {
    ['A', 'B', 'C'].forEach(site => {
      const container = placementEditor.querySelector(`[data-round-site-agents="${site}"]`);
      const list = state.draft.roundPlacements[site] || [];
      if (!list.length) {
        container.innerHTML = `<span class="round-site-empty">${site}にドロップ</span>`;
        return;
      }
      container.innerHTML = list.map((agent, index) => `
        <div class="round-place-chip">
          <img src="${escapeAttr(agent.icon)}" alt="${escapeAttr(agent.name)}" title="${escapeAttr(agent.name)}" />
          <span>${escapeHtml(agent.name)}</span>
          <button type="button" data-round-remove-site="${site}" data-round-remove-index="${index}" aria-label="${escapeAttr(agent.name)}を配置から削除">×</button>
        </div>
      `).join('');
    });

    placementEditor.querySelectorAll('[data-round-remove-site]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const site = button.dataset.roundRemoveSite;
        state.draft.roundPlacements[site].splice(Number(button.dataset.roundRemoveIndex), 1);
        saveState();
        renderRoundPlacementEditor();
      });
    });
  }

  placementEditor.querySelectorAll('[data-round-site]').forEach(zone => {
    zone.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('drag-over');
      placeRoundAgent(zone.dataset.roundSite, getAgentFromDrag(event));
    });
    zone.addEventListener('click', event => {
      if (event.target.closest('[data-round-remove-site]')) return;
      if (!selectedAgent) return;
      placeRoundAgent(zone.dataset.roundSite, selectedAgent);
      selectedAgent = null;
      document.querySelectorAll('.agent-card').forEach(card => card.classList.remove('selected'));
    });
  });

  document.getElementById('clearRoundPlacements').addEventListener('click', () => {
    state.draft.roundPlacements = blankPlacements();
    saveState();
    renderRoundPlacementEditor();
  });

  function miniPlacement(site, list) {
    const agentsHere = Array.isArray(list) ? list : [];
    const icons = agentsHere.length
      ? agentsHere.map(agent => `<img src="${escapeAttr(agent.icon)}" alt="${escapeAttr(agent.name)}" title="${escapeAttr(agent.name)}" />`).join('')
      : '<span>—</span>';
    return `<div class="round-log-site"><b>${site}</b><div>${icons}</div></div>`;
  }

  renderRounds = function () {
    if (!currentRounds.length) {
      roundListEl.className = 'round-list empty-state';
      roundListEl.textContent = 'まだラウンド記録がありません。';
      return;
    }

    roundListEl.className = 'round-list round-list-rich';
    roundListEl.innerHTML = currentRounds.map((round, index) => {
      const placements = normalizePlacements(round.placements);
      const resultClass = round.result === 'WIN' ? 'win' : round.result === 'LOSS' ? 'loss' : 'none';
      const resultText = round.result || '—';
      return `
        <article class="round-log-card">
          <div class="round-log-top">
            <div class="round-log-number">R${escapeHtml(round.roundNumber ?? index + 1)}</div>
            <span class="round-result-badge ${resultClass}">${escapeHtml(resultText)}</span>
            <span class="round-log-target">${escapeHtml(round.site || '—')}</span>
            <span class="round-log-plan">${escapeHtml(round.plan || '—')}</span>
            <button type="button" class="round-delete" data-index="${index}" aria-label="削除">×</button>
          </div>
          <div class="round-log-note">${escapeHtml(round.note || 'メモなし')}</div>
          <div class="round-log-placements">
            ${miniPlacement('A', placements.A)}
            ${miniPlacement('B', placements.B)}
            ${miniPlacement('C', placements.C)}
          </div>
        </article>
      `;
    }).join('');

    roundListEl.querySelectorAll('.round-delete').forEach(button => {
      button.addEventListener('click', () => {
        currentRounds.splice(Number(button.dataset.index), 1);
        saveState();
        renderRounds();
      });
    });
  };

  const newAddButton = oldAddButton.cloneNode(true);
  oldAddButton.replaceWith(newAddButton);
  newAddButton.addEventListener('click', () => {
    const roundNumber = Math.max(1, Number(currentRoundInputEl.value) || 1);
    currentRounds.push({
      roundNumber,
      result: roundResultEl.value,
      site: document.getElementById('siteSelect').value,
      plan: document.getElementById('planSelect').value,
      note: document.getElementById('roundNote').value.trim(),
      placements: {
        A: state.draft.roundPlacements.A.map(agent => ({ ...agent })),
        B: state.draft.roundPlacements.B.map(agent => ({ ...agent })),
        C: state.draft.roundPlacements.C.map(agent => ({ ...agent }))
      }
    });

    document.getElementById('roundNote').value = '';
    state.draft.currentRound = roundNumber + 1;
    state.draft.roundResult = '';
    state.draft.roundPlacements = blankPlacements();
    currentRoundInputEl.value = state.draft.currentRound;
    roundResultEl.value = '';
    saveState();
    renderRoundPlacementEditor();
    renderRounds();
  });

  const oldClearButton = document.getElementById('clearRounds');
  const newClearButton = oldClearButton.cloneNode(true);
  oldClearButton.replaceWith(newClearButton);
  newClearButton.addEventListener('click', () => {
    currentRounds = [];
    state.draft.currentRound = 1;
    state.draft.roundResult = '';
    state.draft.roundPlacements = blankPlacements();
    currentRoundInputEl.value = 1;
    roundResultEl.value = '';
    saveState();
    renderRoundPlacementEditor();
    renderRounds();
    showToast('ラウンド記録をクリアしました');
  });

  const finishButton = document.getElementById('finishMatch');
  finishButton.addEventListener('click', () => {
    state.draft.roundResult = '';
    state.draft.roundPlacements = blankPlacements();
    roundResultEl.value = '';
    saveState();
    renderRoundPlacementEditor();
  });

  renderRoundPlacementEditor();
  renderRounds();
})();
