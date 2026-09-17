const agentCss=document.createElement('link');agentCss.rel='stylesheet';agentCss.href='agent.css';document.head.appendChild(agentCss);

const STORAGE_KEY = 'taclog-data-v1';
const DEFAULT_TAGS = ['Aラッシュ','Bラッシュ','Mid','デフォルト','ラーク','フェイク','OP','エコ'];

const state = loadState();
let currentRounds = Array.isArray(state.draft.rounds) ? state.draft.rounds.map(r => ({...r})) : [];
let agents = [];
let selectedAgent = null;
let lastMemoTarget = null;

const titles = { memo:'作戦メモ', match:'試合', history:'履歴', stats:'統計', settings:'設定' };

function defaultState(){
  return {
    memo:{team:'',player:'',teamAgents:[],playerAgents:[]},
    quickTags:[...DEFAULT_TAGS],
    draft:{agents:[],rounds:[]},
    matches:[],
    settings:{compact:false}
  };
}

function loadState(){
  try{
    const base=defaultState();
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return base;
    const parsed=JSON.parse(raw);
    return {
      ...base,
      ...parsed,
      memo:{...base.memo,...(parsed.memo||{})},
      draft:{...base.draft,...(parsed.draft||{})},
      quickTags:Array.isArray(parsed.quickTags)&&parsed.quickTags.length?parsed.quickTags:base.quickTags,
      settings:{...base.settings,...(parsed.settings||{})}
    };
  }catch{return defaultState();}
}

function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function saveDraft(){ state.draft.rounds=currentRounds.map(r=>({...r})); saveState(); }

function showToast(message){
  const old=document.querySelector('.toast'); if(old) old.remove();
  const toast=document.createElement('div'); toast.className='toast'; toast.innerHTML=`<strong>●</strong> ${escapeHtml(message)}`;
  document.body.appendChild(toast); setTimeout(()=>toast.remove(),1800);
}

function switchTab(tab){
  document.querySelectorAll('.nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.id===tab));
  document.getElementById('pageTitle').textContent=titles[tab];
  document.querySelector('.sidebar').classList.remove('open');
  if(tab==='history') renderHistory(); if(tab==='stats') renderStats();
}

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
document.getElementById('mobileMenu').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));

const teamMemo=document.getElementById('teamMemo');
const playerMemo=document.getElementById('playerMemo');
teamMemo.value=state.memo.team; playerMemo.value=state.memo.player; lastMemoTarget=teamMemo;
[teamMemo,playerMemo].forEach(el=>el.addEventListener('focus',()=>{lastMemoTarget=el;}));

document.getElementById('saveMemo').addEventListener('click',()=>{
  state.memo.team=teamMemo.value.trim(); state.memo.player=playerMemo.value.trim(); saveState(); showToast('作戦メモを保存しました');
});

function renderQuickTags(){
  const box=document.getElementById('quickTags');
  box.innerHTML=state.quickTags.map((tag,i)=>`<button data-tag-index="${i}">${escapeHtml(tag)}</button>`).join('');
  box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const tag=state.quickTags[Number(btn.dataset.tagIndex)];
    const target=lastMemoTarget||teamMemo;
    target.value=target.value.trim()?`${target.value.trim()} #${tag}`:`#${tag}`;
    target.focus();
  }));
}

function renderTagEditor(){
  const list=document.getElementById('tagEditorList');
  list.innerHTML=state.quickTags.map((tag,i)=>`<div class="tag-editor-row"><input value="${escapeAttr(tag)}" data-tag-edit="${i}" /><button class="tag-delete" data-tag-delete="${i}" aria-label="削除">×</button></div>`).join('');
  list.querySelectorAll('[data-tag-edit]').forEach(input=>input.addEventListener('input',()=>{
    const i=Number(input.dataset.tagEdit); state.quickTags[i]=input.value; saveState(); renderQuickTags();
  }));
  list.querySelectorAll('[data-tag-delete]').forEach(btn=>btn.addEventListener('click',()=>{
    state.quickTags.splice(Number(btn.dataset.tagDelete),1); saveState(); renderQuickTags(); renderTagEditor();
  }));
}

document.getElementById('toggleTagEditor').addEventListener('click',()=>{
  const editor=document.getElementById('tagEditor'); editor.classList.toggle('hidden');
  document.getElementById('toggleTagEditor').textContent=editor.classList.contains('hidden')?'タグを編集':'編集を閉じる';
  if(!editor.classList.contains('hidden')) renderTagEditor();
});

document.getElementById('addQuickTag').addEventListener('click',()=>{
  const input=document.getElementById('newTagInput'); const value=input.value.trim(); if(!value) return;
  state.quickTags.push(value); input.value=''; saveState(); renderQuickTags(); renderTagEditor();
});
document.getElementById('newTagInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('addQuickTag').click();}});

async function loadAgents(){
  try{
    let res=await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=ja-JP');
    if(!res.ok) throw new Error('ja fetch failed');
    let json=await res.json();
    agents=(json.data||[]).filter(a=>a.isPlayableCharacter).map(a=>({uuid:a.uuid,name:a.displayName,icon:a.displayIcon}));
  }catch{
    try{
      const res=await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
      const json=await res.json();
      agents=(json.data||[]).filter(a=>a.isPlayableCharacter).map(a=>({uuid:a.uuid,name:a.displayName,icon:a.displayIcon}));
    }catch{
      document.querySelectorAll('.agent-library-grid').forEach(el=>{el.className='agent-library-grid loading-agents';el.textContent='エージェント画像を読み込めませんでした。通信状況を確認してください。';});
      return;
    }
  }
  agents.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  renderAgentLibrary('memoAgentLibrary','memoAgentSearch');
  renderAgentLibrary('matchAgentLibrary','matchAgentSearch');
  renderAllDropZones();
}

function renderAgentLibrary(containerId,searchId){
  const container=document.getElementById(containerId); const search=document.getElementById(searchId);
  const draw=()=>{
    const q=(search.value||'').trim().toLowerCase();
    const filtered=agents.filter(a=>a.name.toLowerCase().includes(q));
    container.className='agent-library-grid';
    container.innerHTML=filtered.map(a=>`<button class="agent-card ${selectedAgent?.uuid===a.uuid?'selected':''}" draggable="true" data-agent="${a.uuid}" title="${escapeAttr(a.name)}"><img src="${escapeAttr(a.icon)}" alt="${escapeAttr(a.name)}" loading="lazy" /><span>${escapeHtml(a.name)}</span></button>`).join('');
    container.querySelectorAll('.agent-card').forEach(card=>{
      card.addEventListener('dragstart',e=>{
        const agent=agents.find(a=>a.uuid===card.dataset.agent); if(!agent) return;
        e.dataTransfer.effectAllowed='copy'; e.dataTransfer.setData('application/x-taclog-agent',JSON.stringify(agent)); e.dataTransfer.setData('text/plain',agent.name);
      });
      card.addEventListener('click',()=>{
        const agent=agents.find(a=>a.uuid===card.dataset.agent); if(!agent) return;
        selectedAgent=selectedAgent?.uuid===agent.uuid?null:agent;
        document.querySelectorAll('.agent-card').forEach(el=>el.classList.toggle('selected',selectedAgent?.uuid===el.dataset.agent));
        if(selectedAgent) showToast(`${selectedAgent.name}を選択中：追加先をタップ`);
      });
    });
  };
  search.addEventListener('input',draw); draw();
}

function getAgentFromDrag(e){
  try{const raw=e.dataTransfer.getData('application/x-taclog-agent');return raw?JSON.parse(raw):null;}catch{return null;}
}

function agentExists(list,agent){return list.some(a=>a.uuid===agent.uuid);}
function addAgentToList(list,agent,max=99){
  if(!agent||agentExists(list,agent)) return false;
  if(list.length>=max){showToast(`最大${max}人までです`);return false;}
  list.push({uuid:agent.uuid,name:agent.name,icon:agent.icon}); return true;
}

function addAgentToTarget(target,agent){
  if(!agent) return;
  let changed=false;
  if(target==='teamMemoAgents') changed=addAgentToList(state.memo.teamAgents,agent,5);
  if(target==='playerMemoAgents') changed=addAgentToList(state.memo.playerAgents,agent,5);
  if(target==='matchAgents') changed=addAgentToList(state.draft.agents,agent,5);
  if(target==='roundNote'){
    const input=document.getElementById('roundNote'); input.value=input.value.trim()?`${input.value.trim()} @${agent.name}`:`@${agent.name}`; input.focus(); changed=true;
  }
  if(changed){saveState();renderAllDropZones();if(target!=='roundNote')showToast(`${agent.name}を追加しました`);}
}

function renderDropZone(id,list){
  const zone=document.getElementById(id); if(!zone) return;
  if(!list.length){zone.innerHTML=`<span class="drop-hint">${id==='matchAgents'?'ここに敵エージェントをドロップ':'ここにエージェントをドロップ'}</span>`;return;}
  zone.innerHTML=list.map((a,i)=>`<div class="agent-chip"><img src="${escapeAttr(a.icon)}" alt="${escapeAttr(a.name)}" /><span>${escapeHtml(a.name)}</span><button class="agent-chip-remove" data-remove-agent="${i}" aria-label="${escapeAttr(a.name)}を削除">×</button></div>`).join('');
  zone.querySelectorAll('[data-remove-agent]').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation(); list.splice(Number(btn.dataset.removeAgent),1); saveState(); renderAllDropZones();
  }));
}

function renderAllDropZones(){
  renderDropZone('teamMemoAgents',state.memo.teamAgents); renderDropZone('playerMemoAgents',state.memo.playerAgents); renderDropZone('matchAgents',state.draft.agents);
}

function setupDropZone(el,target){
  ['dragenter','dragover'].forEach(type=>el.addEventListener(type,e=>{e.preventDefault();el.classList.add('drag-over');if(e.dataTransfer)e.dataTransfer.dropEffect='copy';}));
  ['dragleave','drop'].forEach(type=>el.addEventListener(type,()=>el.classList.remove('drag-over')));
  el.addEventListener('drop',e=>{e.preventDefault();addAgentToTarget(target,getAgentFromDrag(e));});
  el.addEventListener('click',e=>{if(e.target.closest('.agent-chip-remove')) return;if(selectedAgent){addAgentToTarget(target,selectedAgent);}});
}

setupDropZone(document.getElementById('teamMemoAgents'),'teamMemoAgents');
setupDropZone(document.getElementById('playerMemoAgents'),'playerMemoAgents');
setupDropZone(document.getElementById('matchAgents'),'matchAgents');
setupDropZone(document.getElementById('roundAgentDrop'),'roundNote');

function setupTextareaAgentDrop(textarea,target){
  textarea.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
  textarea.addEventListener('drop',e=>{
    e.preventDefault(); const agent=getAgentFromDrag(e); if(!agent) return;
    addAgentToTarget(target,agent); textarea.value=textarea.value.trim()?`${textarea.value.trim()} @${agent.name}`:`@${agent.name}`; textarea.focus();
  });
}
setupTextareaAgentDrop(teamMemo,'teamMemoAgents'); setupTextareaAgentDrop(playerMemo,'playerMemoAgents');

const roundList=document.getElementById('roundList');
function renderRounds(){
  if(!currentRounds.length){roundList.className='round-list empty-state';roundList.textContent='まだラウンド記録がありません。';return;}
  roundList.className='round-list';
  roundList.innerHTML=currentRounds.map((round,index)=>`<div class="round-row"><span class="round-no">R${index+1}</span><span class="round-site">${escapeHtml(round.site)}</span><span class="round-plan">${escapeHtml(round.plan)}</span><span class="round-note">${escapeHtml(round.note||'—')}</span><button class="round-delete" data-index="${index}" aria-label="削除">×</button></div>`).join('');
  roundList.querySelectorAll('.round-delete').forEach(btn=>btn.addEventListener('click',()=>{currentRounds.splice(Number(btn.dataset.index),1);saveDraft();renderRounds();}));
}

document.getElementById('addRound').addEventListener('click',()=>{
  currentRounds.push({site:document.getElementById('siteSelect').value,plan:document.getElementById('planSelect').value,note:document.getElementById('roundNote').value.trim()});
  document.getElementById('roundNote').value=''; saveDraft(); renderRounds();
});
document.getElementById('roundNote').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('addRound').click();}});
document.getElementById('clearRounds').addEventListener('click',()=>{currentRounds=[];saveDraft();renderRounds();showToast('ラウンド記録をクリアしました');});

document.getElementById('finishMatch').addEventListener('click',()=>{
  const ourScore=Number(document.getElementById('ourScore').value||0); const enemyScore=Number(document.getElementById('enemyScore').value||0); let result=document.getElementById('resultSelect').value;
  if(!result) result=ourScore>enemyScore?'WIN':ourScore<enemyScore?'LOSS':'DRAW';
  const match={id:Date.now(),createdAt:new Date().toISOString(),map:document.getElementById('mapSelect').value,side:document.getElementById('sideSelect').value,result,ourScore,enemyScore,agents:state.draft.agents.map(a=>({...a})),rounds:currentRounds.map(r=>({...r})),memoSnapshot:{team:teamMemo.value.trim(),player:playerMemo.value.trim(),teamAgents:state.memo.teamAgents.map(a=>({...a})),playerAgents:state.memo.playerAgents.map(a=>({...a}))}};
  state.matches.unshift(match); state.memo.team=teamMemo.value.trim(); state.memo.player=playerMemo.value.trim(); state.draft.agents=[]; state.draft.rounds=[]; currentRounds=[]; saveState();
  document.getElementById('ourScore').value=0;document.getElementById('enemyScore').value=0;document.getElementById('resultSelect').value='';renderRounds();renderAllDropZones();renderHistory();showToast('試合を履歴に保存しました');switchTab('history');
});

function renderHistory(){
  const list=document.getElementById('historyList');
  if(!state.matches.length){list.className='history-list empty-state';list.textContent='保存された試合はまだありません。';return;}
  list.className='history-list';
  list.innerHTML=state.matches.map(match=>{
    const date=new Date(match.createdAt).toLocaleDateString('ja-JP',{month:'2-digit',day:'2-digit'}); const roundText=`${(match.rounds||[]).length}ラウンド記録 / ${escapeHtml(match.side)}スタート`;
    const icons=(match.agents||[]).map(a=>`<img src="${escapeAttr(a.icon)}" alt="${escapeAttr(a.name)}" title="${escapeAttr(a.name)}" />`).join('');
    return `<div class="history-item" data-id="${match.id}"><div><div class="history-map">${escapeHtml(match.map)}</div><div class="history-meta">${date}</div>${icons?`<div class="history-agents">${icons}</div>`:''}</div><div class="history-meta">${roundText}<br>${match.ourScore} - ${match.enemyScore}</div><span class="result ${match.result}">${match.result}</span></div>`;
  }).join('');
}
document.getElementById('clearHistory').addEventListener('click',()=>{if(!state.matches.length)return;if(!confirm('保存した試合履歴をすべて削除しますか？'))return;state.matches=[];saveState();renderHistory();renderStats();showToast('試合履歴を削除しました');});

function renderStats(){
  const rounds=state.matches.flatMap(match=>match.rounds||[]); const rush=rounds.filter(r=>r.plan==='ラッシュ').length; const lurk=rounds.filter(r=>r.plan==='ラーク').length;
  document.getElementById('statMatches').textContent=state.matches.length;document.getElementById('statRounds').textContent=rounds.length;document.getElementById('statRush').textContent=rounds.length?`${Math.round(rush/rounds.length*100)}%`:'0%';document.getElementById('statLurk').textContent=rounds.length?`${Math.round(lurk/rounds.length*100)}%`:'0%';
  const counts={A:0,B:0,Mid:0,その他:0};rounds.forEach(r=>{counts[r.site]=(counts[r.site]||0)+1;});const total=rounds.length||1;
  document.getElementById('siteBars').innerHTML=Object.entries(counts).map(([site,count])=>{const percent=Math.round(count/total*100);return `<div class="bar-row"><span>${site}</span><div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div><span class="bar-value">${percent}%</span></div>`;}).join('');
}

const compactToggle=document.getElementById('compactToggle'); compactToggle.checked=state.settings.compact;document.body.classList.toggle('compact-mode',state.settings.compact);
compactToggle.addEventListener('change',()=>{state.settings.compact=compactToggle.checked;document.body.classList.toggle('compact-mode',compactToggle.checked);saveState();});
document.getElementById('resetData').addEventListener('click',()=>{if(!confirm('メモ・履歴・設定をすべて削除します。よろしいですか？'))return;localStorage.removeItem(STORAGE_KEY);location.reload();});

function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function escapeAttr(value){return escapeHtml(value);}

renderQuickTags();renderRounds();renderHistory();renderStats();renderAllDropZones();loadAgents();
