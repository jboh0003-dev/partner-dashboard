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
    .day-section{margin:12px 0 16px}.day-section+.day-section{padding-top:12px;border-top:1px solid #21344f}
    .day-label{display:flex;align-items:center;justify-content:space-between;margin:0 2px 7px}
    .day-label b{font-size:13px;color:#f0f5ff}.day-label span{font-size:9px;color:#7890b0}
    .favorite-summary{display:grid;gap:7px}
    .fav-summary-row{display:grid;grid-template-columns:54px 1fr auto;gap:8px;align-items:center;padding:8px 9px;border-radius:9px;background:rgba(7,16,29,.42);border:1px solid rgba(255,255,255,.08)}
    .fav-summary-row strong{font-size:10px;color:#9fb6d7}.fav-summary-row b{font-size:11px;color:#fff;word-break:keep-all}.fav-summary-row em{font-style:normal;font-size:9px;color:#a8b8ce;text-align:right}
    .cancelled-game{border-color:#8f3a43!important;background:#2d171d!important}.cancelled-game .scoretop span:last-child{color:#ff8790!important;font-weight:950}
    .postponed-game{border-color:#7f6531!important;background:#2b2517!important}.postponed-game .scoretop span:last-child{color:#f0c96b!important;font-weight:950}
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const originalLiveContent = liveContent;
  const kStatus = (g) => {
    if (g.status === 'cancelled') return g.cancelReason || g.statusInfo || '경기 취소';
    if (g.status === 'postponed') return g.cancelReason || g.statusInfo || '경기 연기';
    if (g.status === 'live') return g.statusInfo || 'LIVE';
    if (g.status === 'final') return '종료';
    return g.time || '경기전';
  };
  const kfmt = (g) => {
    const cls = g.status==='live'?'livegame':g.status==='cancelled'?'cancelled-game':g.status==='postponed'?'postponed-game':'';
    const scoreAway = ['cancelled','postponed'].includes(g.status) ? '-' : (g.awayScore ?? '-');
    const scoreHome = ['cancelled','postponed'].includes(g.status) ? '-' : (g.homeScore ?? '-');
    return `<div class="favorite-score ${cls}"><div class="scoretop"><span>${esc(g.stadium||'KBO')}</span><span>${esc(kStatus(g))}</span></div><div class="teams"><div class="team">${esc(g.away)}</div><div class="score">${scoreAway}</div><div class="team">${esc(g.home)}</div><div class="score">${scoreHome}</div></div></div>`;
  };
  const lotteLine = (label,g,emptyText) => {
    if (!g) return `<div class="fav-summary-row"><strong>${label}</strong><b>${emptyText}</b><em>-</em></div>`;
    const matchup = `${g.away} vs ${g.home}`;
    const result = g.status==='final' ? `${g.awayScore ?? '-'} : ${g.homeScore ?? '-'}` : kStatus(g);
    return `<div class="fav-summary-row"><strong>${label}</strong><b>${esc(matchup)}</b><em>${esc(g.date.slice(5).replace('-','/'))} · ${esc(result)}</em></div>`;
  };
  const soccerFmt = (g) => {
    const time = new Date(g.date).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const status = g.state === 'in' ? (g.detail || 'LIVE') : g.state === 'post' ? `종료 · ${time}` : time;
    return `<div class="favorite-score ${g.state==='in'?'livegame':''}"><div class="scoretop"><span>${esc(g.leagueName||'FOOTBALL')}</span><span>${esc(status)}</span></div><div class="teams"><div class="team">${g.away?.logo?`<img src="${g.away.logo}" alt="">`:''}${esc(g.away?.name||'-')}</div><div class="score">${g.away?.score ?? '-'}</div><div class="team">${g.home?.logo?`<img src="${g.home.logo}" alt="">`:''}${esc(g.home?.name||'-')}</div><div class="score">${g.home?.score ?? '-'}</div></div>${g.koreanPlayers?.length?`<span class="watchtag">🇰🇷 ${g.koreanPlayers.join(' · ')}</span>`:''}</div>`;
  };

  liveContent = function(){
    if (liveTab === 'market') return originalLiveContent();
    if (liveTab === 'kbo') {
      const days = sports?.kboDays || {};
      const fav = sports?.favorites?.lotteSummary || {};
      const todayGames = days.today?.games || [];
      const yesterdayGames = days.yesterday?.games || [];
      const tomorrowGames = days.tomorrow?.games || [];
      const section = (title, date, games, empty) => `<div class="day-section"><div class="day-label"><b>${title}</b><span>${esc((date||'').slice(5).replace('-','/'))} · ${games.length}경기</span></div><div class="score-list">${games.length?games.map(kfmt).join(''):`<div class="empty">${empty}</div>`}</div></div>`;
      return `<div class="favorite-block lotte"><div class="favorite-head"><div><small>FAVORITE TEAM · KBO</small><b>롯데 자이언츠</b></div><span class="favorite-chip">LOTTE TRACKER</span></div><div class="favorite-summary">${lotteLine('최근',fav.previous,'최근 경기 없음')}${lotteLine('오늘',fav.today,'오늘 경기 없음 · 휴식일')}${lotteLine('다음',fav.next,'예정 경기 없음')}</div></div>${section('오늘 경기',days.today?.date,todayGames,'오늘 편성된 KBO 경기가 없습니다.')}${section('어제 경기',days.yesterday?.date,yesterdayGames,'어제 편성된 KBO 경기가 없습니다.')}${section('다음 경기',days.tomorrow?.date,tomorrowGames,'내일 편성된 KBO 경기가 없습니다.')}<div class="note">NAVER Sports 실데이터 · 취소/연기 상태 문구까지 확인 · 롯데 경기 우선 노출</div>`;
    }
    const epl = sports?.soccer?.epl || [];
    const chelsea = sports?.favorites?.chelsea || [];
    const korean = sports?.soccer?.korean || [];
    return `<div class="favorite-block chelsea"><div class="favorite-head"><div><small>FAVORITE TEAM · EPL</small><b>CHELSEA FC</b></div><span class="favorite-chip">최근 결과 / 다음 경기</span></div>${chelsea.length?chelsea.slice(0,4).map(soccerFmt).join(''):'<div class="empty">조회 기간 내 첼시 경기 없음</div>'}</div><div class="section-title"><b>EPL · 최근/예정</b><span>${epl.length}경기</span></div><div class="score-list">${epl.slice(0,12).map(soccerFmt).join('')||'<div class="empty">EPL 경기 데이터 없음</div>'}</div><div class="section-title"><b>KOREAN PLAYER WATCH</b><span>해외파 주요팀</span></div><div class="score-list">${korean.slice(0,10).map(soccerFmt).join('')||'<div class="empty">조회 기간 내 해외파 소속팀 경기 없음</div>'}</div><div class="note">첼시 우선 · EPL + 한국 선수 주요 소속팀 · ESPN Scoreboard</div>`;
  };

  if (typeof render === 'function') render();
})();
