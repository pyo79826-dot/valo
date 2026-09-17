const mapStatsMaps=['Ascent','Bind','Haven','Lotus','Split','Sunset','Icebox','Breeze','Abyss','Corrode','Summit'];
const oldStatsFilter=document.getElementById('matchFilter');
const mapStatsFilter=oldStatsFilter.cloneNode(true);
oldStatsFilter.replaceWith(mapStatsFilter);

function populateMapFilter(){
  const previous=mapStatsFilter.value||'all';
  const savedMaps=state.matches.map(match=>match.map).filter(Boolean);
  const extraMaps=[...new Set(savedMaps.filter(map=>!mapStatsMaps.includes(map)))].sort((a,b)=>a.localeCompare(b,'ja'));
  const maps=[...mapStatsMaps,...extraMaps];

  mapStatsFilter.innerHTML=[
    '<option value="all">全マップ</option>',
    ...maps.map(map=>`<option value="${escapeAttr(map)}">${escapeHtml(map)}</option>`)
  ].join('');

  const validValues=new Set(['all',...maps]);
  mapStatsFilter.value=validValues.has(previous)?previous:'all';
}

renderStats=function(){
  populateMapFilter();

  const selectedMap=mapStatsFilter.value||'all';
  const matches=selectedMap==='all'
    ? state.matches
    : state.matches.filter(match=>match.map===selectedMap);
  const rounds=matches.flatMap(match=>match.rounds||[]);
  const rush=rounds.filter(round=>round.plan==='ラッシュ').length;
  const lurk=rounds.filter(round=>round.plan==='ラーク').length;
  const wins=matches.filter(match=>match.result==='WIN').length;
  const winRate=matches.length?Math.round(wins/matches.length*100):0;

  document.getElementById('statMatches').textContent=matches.length;
  document.getElementById('statRounds').textContent=rounds.length;
  document.getElementById('statRush').textContent=rounds.length?`${Math.round(rush/rounds.length*100)}%`:'0%';
  document.getElementById('statLurk').textContent=rounds.length?`${Math.round(lurk/rounds.length*100)}%`:'0%';

  if(selectedMap==='all'){
    document.getElementById('statsContextTitle').textContent='全マップの統計';
    document.getElementById('statsContextMeta').textContent=`${matches.length}試合 / 勝率 ${winRate}%`;
  }else{
    document.getElementById('statsContextTitle').textContent=`${selectedMap}の統計`;
    document.getElementById('statsContextMeta').textContent=`${matches.length}試合 / 勝率 ${winRate}%`;
  }

  const counts={A:0,B:0,Mid:0,その他:0};
  rounds.forEach(round=>{counts[round.site]=(counts[round.site]||0)+1;});
  const total=rounds.length||1;

  document.getElementById('siteBars').innerHTML=Object.entries(counts).map(([site,count])=>{
    const percent=Math.round(count/total*100);
    return `<div class="bar-row"><span>${site}</span><div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div><span class="bar-value">${percent}%</span></div>`;
  }).join('');
};

mapStatsFilter.addEventListener('change',renderStats);
renderStats();
