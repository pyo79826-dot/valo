const STORAGE_KEY = 'taclog-data-v1';

const state = loadState();
let currentRounds = [];

const titles = {
  memo: '作戦メモ',
  match: '試合',
  history: '履歴',
  stats: '統計',
  settings: '設定'
};

function defaultState() {
  return {
    memo: { team: '', player: '' },
    matches: [],
    settings: { compact: false }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      memo: { ...defaultState().memo, ...(parsed.memo || {}) },
      settings: { ...defaultState().settings, ...(parsed.settings || {}) }
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>●</strong> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tab);
  });
  document.getElementById('pageTitle').textContent = titles[tab];
  document.querySelector('.sidebar').classList.remove('open');
  if (tab === 'history') renderHistory();
  if (tab === 'stats') renderStats();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('mobileMenu').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
});

// Memo
const teamMemo = document.getElementById('teamMemo');
const playerMemo = document.getElementById('playerMemo');
teamMemo.value = state.memo.team;
playerMemo.value = state.memo.player;

document.getElementById('saveMemo').addEventListener('click', () => {
  state.memo.team = teamMemo.value.trim();
  state.memo.player = playerMemo.value.trim();
  saveState();
  showToast('作戦メモを保存しました');
});

document.querySelectorAll('#quickTags button').forEach(btn => {
  btn.addEventListener('click', () => {
    const tag = `#${btn.textContent}`;
    teamMemo.value = teamMemo.value.trim()
      ? `${teamMemo.value.trim()} ${tag}`
      : tag;
    teamMemo.focus();
  });
});

// Round log
const roundList = document.getElementById('roundList');

function renderRounds() {
  if (!currentRounds.length) {
    roundList.className = 'round-list empty-state';
    roundList.textContent = 'まだラウンド記録がありません。';
    return;
  }
  roundList.className = 'round-list';
  roundList.innerHTML = currentRounds.map((round, index) => `
    <div class="round-row">
      <span class="round-no">R${index + 1}</span>
      <span class="round-site">${escapeHtml(round.site)}</span>
      <span class="round-plan">${escapeHtml(round.plan)}</span>
      <span class="round-note">${escapeHtml(round.note || '—')}</span>
      <button class="round-delete" data-index="${index}" aria-label="削除">×</button>
    </div>
  `).join('');

  roundList.querySelectorAll('.round-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      currentRounds.splice(Number(btn.dataset.index), 1);
      renderRounds();
    });
  });
}

document.getElementById('addRound').addEventListener('click', () => {
  currentRounds.push({
    site: document.getElementById('siteSelect').value,
    plan: document.getElementById('planSelect').value,
    note: document.getElementById('roundNote').value.trim()
  });
  document.getElementById('roundNote').value = '';
  renderRounds();
});

document.getElementById('roundNote').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    document.getElementById('addRound').click();
  }
});

document.getElementById('clearRounds').addEventListener('click', () => {
  currentRounds = [];
  renderRounds();
  showToast('ラウンド記録をクリアしました');
});

document.getElementById('finishMatch').addEventListener('click', () => {
  const ourScore = Number(document.getElementById('ourScore').value || 0);
  const enemyScore = Number(document.getElementById('enemyScore').value || 0);
  let result = document.getElementById('resultSelect').value;

  if (!result) {
    result = ourScore > enemyScore ? 'WIN' : ourScore < enemyScore ? 'LOSS' : 'DRAW';
  }

  const match = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    map: document.getElementById('mapSelect').value,
    side: document.getElementById('sideSelect').value,
    result,
    ourScore,
    enemyScore,
    rounds: currentRounds.map(round => ({ ...round })),
    memoSnapshot: {
      team: teamMemo.value.trim(),
      player: playerMemo.value.trim()
    }
  };

  state.matches.unshift(match);
  state.memo.team = teamMemo.value.trim();
  state.memo.player = playerMemo.value.trim();
  saveState();

  currentRounds = [];
  document.getElementById('ourScore').value = 0;
  document.getElementById('enemyScore').value = 0;
  document.getElementById('resultSelect').value = '';
  renderRounds();
  renderHistory();
  showToast('試合を履歴に保存しました');
  switchTab('history');
});

// History
function renderHistory() {
  const list = document.getElementById('historyList');
  if (!state.matches.length) {
    list.className = 'history-list empty-state';
    list.textContent = '保存された試合はまだありません。';
    return;
  }

  list.className = 'history-list';
  list.innerHTML = state.matches.map(match => {
    const date = new Date(match.createdAt).toLocaleDateString('ja-JP', {
      month: '2-digit', day: '2-digit'
    });
    const roundText = `${match.rounds.length}ラウンド記録 / ${escapeHtml(match.side)}スタート`;
    return `
      <div class="history-item" data-id="${match.id}">
        <div><div class="history-map">${escapeHtml(match.map)}</div><div class="history-meta">${date}</div></div>
        <div class="history-meta">${roundText}<br>${match.ourScore} - ${match.enemyScore}</div>
        <span class="result ${match.result}">${match.result}</span>
      </div>
    `;
  }).join('');
}

document.getElementById('clearHistory').addEventListener('click', () => {
  if (!state.matches.length) return;
  if (!confirm('保存した試合履歴をすべて削除しますか？')) return;
  state.matches = [];
  saveState();
  renderHistory();
  renderStats();
  showToast('試合履歴を削除しました');
});

// Stats
function renderStats() {
  const rounds = state.matches.flatMap(match => match.rounds || []);
  const rush = rounds.filter(r => r.plan === 'ラッシュ').length;
  const lurk = rounds.filter(r => r.plan === 'ラーク').length;

  document.getElementById('statMatches').textContent = state.matches.length;
  document.getElementById('statRounds').textContent = rounds.length;
  document.getElementById('statRush').textContent = rounds.length ? `${Math.round(rush / rounds.length * 100)}%` : '0%';
  document.getElementById('statLurk').textContent = rounds.length ? `${Math.round(lurk / rounds.length * 100)}%` : '0%';

  const counts = { A: 0, B: 0, Mid: 0, その他: 0 };
  rounds.forEach(round => { counts[round.site] = (counts[round.site] || 0) + 1; });
  const total = rounds.length || 1;
  document.getElementById('siteBars').innerHTML = Object.entries(counts).map(([site, count]) => {
    const percent = Math.round(count / total * 100);
    return `
      <div class="bar-row">
        <span>${site}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
        <span class="bar-value">${percent}%</span>
      </div>
    `;
  }).join('');
}

// Settings
const compactToggle = document.getElementById('compactToggle');
compactToggle.checked = state.settings.compact;
document.body.classList.toggle('compact-mode', state.settings.compact);
compactToggle.addEventListener('change', () => {
  state.settings.compact = compactToggle.checked;
  document.body.classList.toggle('compact-mode', compactToggle.checked);
  saveState();
});

document.getElementById('resetData').addEventListener('click', () => {
  if (!confirm('メモ・履歴・設定をすべて削除します。よろしいですか？')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

renderRounds();
renderHistory();
renderStats();
