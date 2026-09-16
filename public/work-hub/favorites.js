(() => {
  const style = document.createElement('style');
  style.id = 'workhub-favorites-style';
  style.textContent = `
    .favorite-block{margin:8px 0 13px;padding:12px;border-radius:14px;border:1px solid #40577d;background:linear-gradient(135deg,#11233b,#152e4f)}
    .favorite-block.lotte{border-color:#a55a67;background:linear-gradient(135deg,#251821,#44202b)}
    .favorite-block.chelsea{border-color:#3e6edf;background:linear-gradient(135deg,#0b2353,#103a88)}
    .favorite-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .favorite-head small{font-size:8px;letter-spacing:1.3px;color:#91a9ca;font-weight:900}
    .favorite-head b{font-size:14px;color:white}
    .favorite-chip{font-size:8px;border:1px solid rgba(255,255,255,.22);color:#dce8ff;padding:4px 7px;border-radius:999px}
    .favorite-score{background:rgba(7,16,29,.5);border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:10px;margin-top:6px}
    .favorite-score .scoretop{font-size:9px;color:#9fb0c9}
    .favorite-score .team{font-size:12px}.favorite-score .score{font-size:18px}
    .fav-result{font-size:8px;font-weight:950;padding:3px 6px;border-radius:6px;background:#1d2c45;color:#c9d5e7}
    .fav-result.win{background:#123d2e;color:#72ddb0}.fav-result.loss{background:#4a2026;color:#ff9da5}.fav-result.draw{background:#3b3521;color:#e7cd6c}
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const originalLiveContent = liveContent;
  const kfmt = (g) => {
    const status = g.status === 'live' ? (g.statusInfo || 'LIVE') : g.status === 'final' ? '종료' : g.status === 'scheduled' ? g.time : g.status;
    return `<div class="favorite-score ${g.status==='live'?'livegame':''}"><div class="scoretop"><span>${esc(g.date||'')} · ${esc(g.stadium||'KBO')}</span><span>${esc(status)}</span></div><div class="teams"><div class="team">${esc(g.away)}</div><div class="score">${g.awayScore ?? '-'}</div><div class="team">${esc(g.home)}</div><div class="score">${g.homeScore ?? '-'}</div></div></div>`;
  };
  const soccerFmt = (g) => {
    const time = new Date(g.date).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const status = g.state === 'in' ? (g.detail || 'LIVE') : g.state === 'post' ? `종료 · ${time}` : time;
    return `<div class="favorite-score ${g.state==='in'?'livegame':''}"><div class="scoretop"><span>${esc(g.leagueName||'FOOTBALL')}</span><span>${esc(status)}</span></div><div class="teams"><div class="team">${g.away?.logo?`<img src="${g.away.logo}" alt="">`:''}${esc(g.away?.name||'-')}</div><div class="score">${g.away?.score ?? '-'}</div><div class="team">${g.home?.logo?`<img src="${g.home.logo}" alt="">`:''}${esc(g.home?.name||'-')}</div><div class="score">${g.home?.score ?? '-'}</div></div>${g.koreanPlayers?.length?`<span class="watchtag">🇰🇷 ${g.koreanPlayers.join(' · ')}</span>`:''}</div>`;
  };

  liveContent = function(){
    if (liveTab === 'market') return originalLiveContent();
    if (liveTab === 'kbo') {
      const games = sports?.kbo || [];
      const fav = sports?.favorites?.lotte || [];
      return `<div class="favorite-block lotte"><div class="favorite-head"><div><small>FAVORITE TEAM · KBO</small><b>롯데 자이언츠</b></div><span class="favorite-chip">최근 결과 / 다음 경기</span></div>${fav.length?fav.slice(0,4).map(kfmt).join(''):'<div class="empty">최근 롯데 경기 데이터 없음</div>'}</div><div class="section-title"><b>최근 KBO · 오늘 포함</b><span>${games.length}경기</span></div><div class="score-list">${games.length?games.slice(0,16).map(kfmt).join(''):'<div class="empty">KBO 경기 데이터 없음</div>'}</div><div class="note">최근 3일 + 오늘/다음 경기 · NAVER Sports 실데이터</div>`;
    }
    const epl = sports?.soccer?.epl || [];
    const chelsea = sports?.favorites?.chelsea || [];
    const korean = sports?.soccer?.korean || [];
    return `<div class="favorite-block chelsea"><div class="favorite-head"><div><small>FAVORITE TEAM · EPL</small><b>CHELSEA FC</b></div><span class="favorite-chip">최근 결과 / 다음 경기</span></div>${chelsea.length?chelsea.slice(0,4).map(soccerFmt).join(''):'<div class="empty">조회 기간 내 첼시 경기 없음</div>'}</div><div class="section-title"><b>EPL · 최근/예정</b><span>${epl.length}경기</span></div><div class="score-list">${epl.slice(0,12).map(soccerFmt).join('')||'<div class="empty">EPL 경기 데이터 없음</div>'}</div><div class="section-title"><b>KOREAN PLAYER WATCH</b><span>해외파 주요팀</span></div><div class="score-list">${korean.slice(0,10).map(soccerFmt).join('')||'<div class="empty">조회 기간 내 해외파 소속팀 경기 없음</div>'}</div><div class="note">첼시 우선 · EPL + 한국 선수 주요 소속팀 · ESPN Scoreboard</div>`;
  };

  if (typeof render === 'function') render();
})();
