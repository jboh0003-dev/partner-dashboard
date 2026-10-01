(() => {
  'use strict';
  if (window.__workhubKakaoThemeLoaded) return;
  window.__workhubKakaoThemeLoaded = true;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#FEE500');

  const style = document.createElement('style');
  style.id = 'workhub-kakao-theme';
  style.textContent = `
    :root{
      --bg:#f7f7f7!important;
      --card:#ffffff!important;
      --ink:#191919!important;
      --muted:#777777!important;
      --line:#ececec!important;
      --nav:#ffffff!important;
      --brand:#191919!important;
      --green:#2f9e69!important;
      --red:#e65f5c!important;
      --amber:#d79a00!important;
      --orange:#ef7b45!important;
      --shadow:0 4px 18px rgba(0,0,0,.045)!important;
      --kakao-yellow:#fee500;
      --kakao-yellow-hover:#f4dc00;
      --kakao-black:#191919;
      --kakao-soft:#f3f3f3;
      --kakao-soft-yellow:#fff9cc;
      --kakao-radius:16px;
    }

    html,body,button,input,select,textarea{
      font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      letter-spacing:-.2px;
    }
    html,body{background:var(--bg)!important;color:var(--ink)!important}
    body{font-size:15px!important;line-height:1.55!important}
    body.dark{
      --bg:#171717!important;--card:#242424!important;--ink:#f5f5f5!important;
      --muted:#a2a2a2!important;--line:#343434!important;--nav:#1f1f1f!important;
      --brand:#f5f5f5!important;--shadow:none!important;--kakao-soft:#303030;--kakao-soft-yellow:#3b3718
    }

    /* shell / navigation */
    .side{
      background:var(--nav)!important;color:var(--ink)!important;
      border-right:1px solid var(--line)!important;box-shadow:none!important;
    }
    .brand{
      color:var(--ink)!important;font-family:inherit!important;font-weight:800!important;
      letter-spacing:-1px!important;
    }
    .brand small{color:#a0a0a0!important;letter-spacing:1.2px!important;font-weight:650!important}
    .nav button{
      color:#666!important;background:transparent!important;border:0!important;
      border-radius:12px!important;font-weight:700!important;box-shadow:none!important;
      transition:background .15s ease,color .15s ease,transform .15s ease;
    }
    .nav button:hover{background:var(--kakao-soft)!important;color:var(--ink)!important;transform:none!important}
    .nav button.active,
    #workhub-notes-nav.active,
    #workhub-monthly-nav.active,
    #workhub-history-nav.active,
    #workhub-arcade-nav.active{
      background:var(--kakao-yellow)!important;color:var(--kakao-black)!important;
      border:0!important;box-shadow:none!important;
    }
    .nav-divider{border-color:var(--line)!important}
    .nav-divider span{color:#aaa!important;background:var(--nav)!important;font-size:10px!important;letter-spacing:.4px!important}
    .account-nav button{
      background:var(--kakao-soft)!important;color:var(--ink)!important;border:0!important;
      border-radius:12px!important;font-weight:700!important;
    }

    .main{background:var(--bg)!important}
    header{
      background:rgba(255,255,255,.92)!important;border-bottom:1px solid var(--line)!important;
      box-shadow:none!important;backdrop-filter:blur(14px)!important;
    }
    body.dark header{background:rgba(23,23,23,.92)!important}
    .title{
      color:var(--ink)!important;font-family:inherit!important;font-size:28px!important;
      font-weight:800!important;letter-spacing:-1.1px!important;
    }
    .subclock{color:#8f8f8f!important;font-size:12px!important}
    .wrap,.ledger-special,.notes-root{max-width:1900px!important}

    /* common controls */
    .btn,.icon,.status,
    .ledger-week-nav button,.ledger-task-actions button,.ledger-controls button,
    .monthly-actions button,.calendar-nav button,.calendar-layer{
      border:0!important;background:var(--kakao-soft)!important;color:var(--ink)!important;
      border-radius:10px!important;box-shadow:none!important;font-weight:700!important;
    }
    .btn:hover,.icon:hover,.status:hover,
    .ledger-week-nav button:hover,.ledger-task-actions button:hover,.ledger-controls button:hover,
    .monthly-actions button:hover,.calendar-nav button:hover{
      background:#e9e9e9!important;color:var(--ink)!important;
    }
    body.dark .btn:hover,body.dark .icon:hover,body.dark .status:hover,
    body.dark .ledger-week-nav button:hover,body.dark .ledger-task-actions button:hover{
      background:#3a3a3a!important;
    }
    .btn.primary,
    .ledger-top-quick button,
    .monthly-form button,
    .history-copy,
    .vacation-add,
    #memoSave,
    .cloud-auth .btn.primary{
      background:var(--kakao-yellow)!important;border:0!important;color:var(--kakao-black)!important;
      font-weight:800!important;box-shadow:none!important;
    }
    .btn.primary:hover,.ledger-top-quick button:hover,.monthly-form button:hover,.history-copy:hover{
      background:var(--kakao-yellow-hover)!important;
    }
    input,.input,input[type=date],input[type=month],textarea,select,
    .ledger-top-quick input,.ledger-top-quick select,.ledger-area-quick input,.ledger-area-quick select,
    .monthly-form input,.monthly-form select{
      background:var(--kakao-soft)!important;color:var(--ink)!important;border:1px solid transparent!important;
      border-radius:12px!important;box-shadow:none!important;outline:none!important;
    }
    input:focus,textarea:focus,select:focus{
      background:var(--card)!important;border-color:var(--kakao-yellow)!important;
      box-shadow:0 0 0 3px rgba(254,229,0,.18)!important;
    }

    /* cards / panels */
    .metric,.panel,.lane,.task,.calendar-card,.favorite-card,.reportbox,
    .ledger-metric,.ledger-week,.ledger-area,.ledger-special .monthly-group,
    .history-metric,.history-group,.memo-composer,.memo-metric,.memo-bucket,
    .cloud-auth-card,.account-modal,.account-box,.account-section{
      background:var(--card)!important;border:1px solid var(--line)!important;
      border-radius:var(--kakao-radius)!important;box-shadow:none!important;
    }
    .metric strong,.ledger-metric strong,.history-metric strong,.memo-metric strong{
      color:var(--ink)!important;font-family:inherit!important;font-weight:800!important;
    }

    /* weekly ledger */
    .ledger-week{overflow:hidden!important}
    .ledger-week-head{
      background:#fff!important;border:0!important;border-bottom:1px solid var(--line)!important;
      padding:18px 20px!important;
    }
    body.dark .ledger-week-head{background:var(--card)!important}
    .ledger-week-title b{
      font-family:inherit!important;font-size:21px!important;font-weight:800!important;color:var(--ink)!important;
    }
    .ledger-week-title span{font-size:12px!important;color:var(--muted)!important}
    .ledger-top-quick{
      background:#fafafa!important;border-bottom:1px solid var(--line)!important;padding:14px!important;
    }
    body.dark .ledger-top-quick{background:#202020!important}
    .ledger-area{border:0!important;border-top:1px solid var(--line)!important;border-radius:0!important}
    .ledger-area:first-of-type{border-top:0!important}
    .ledger-area>summary{background:var(--card)!important;padding:15px 18px!important}
    .ledger-area[open]>summary{
      background:var(--kakao-soft-yellow)!important;border-bottom:1px solid var(--line)!important;
    }
    .ledger-area>summary b{font-size:15px!important;font-weight:800!important}
    .ledger-area>summary span{
      background:var(--kakao-yellow)!important;color:var(--kakao-black)!important;border:0!important;
      border-radius:999px!important;min-width:28px!important;height:28px!important;
    }
    .ledger-area-body{background:var(--card)!important;padding:12px 14px 16px!important}
    .ledger-area-quick button{
      background:#fff4a3!important;color:var(--kakao-black)!important;border:0!important;border-radius:10px!important;
    }
    .ledger-grid-head{color:#999!important;font-size:11px!important}
    .ledger-task-row{
      background:#fff!important;border:1px solid #eeeeee!important;border-left:0!important;
      border-radius:14px!important;padding:9px!important;box-shadow:none!important;
    }
    body.dark .ledger-task-row{background:#282828!important;border-color:#383838!important}
    .ledger-task-row:hover{border-color:#dedede!important;background:#fdfdfd!important}
    body.dark .ledger-task-row:hover{background:#2c2c2c!important;border-color:#444!important}
    .ledger-task-row.is-done{background:#f0faf4!important;border-color:#dcefe4!important}
    .ledger-task-row.is-blocked{background:#fff3f1!important;border-color:#f4ddd9!important}
    body.dark .ledger-task-row.is-done{background:#203129!important;border-color:#2e4638!important}
    body.dark .ledger-task-row.is-blocked{background:#352624!important;border-color:#4c3431!important}
    .ledger-task-main strong{font-size:14px!important;font-weight:750!important;color:var(--ink)!important}
    .ledger-task-meta span{
      background:#f5f5f5!important;border:0!important;color:#777!important;border-radius:999px!important;padding:4px 8px!important;
    }
    .ledger-task-meta span.primary{background:#fff3a5!important;color:#5c5200!important}
    body.dark .ledger-task-meta span{background:#333!important;color:#bbb!important}
    body.dark .ledger-task-meta span.primary{background:#4b4519!important;color:#f9e96c!important}
    .ledger-day{
      background:#f3f3f3!important;color:#aaa!important;border:0!important;border-radius:12px!important;
      min-height:48px!important;
    }
    .ledger-day:hover{background:#eaeaea!important}
    .ledger-day.today{box-shadow:inset 0 0 0 2px var(--kakao-yellow)!important}
    .ledger-day.doing{background:#fff5b5!important;color:#766600!important}
    .ledger-day.done{background:#dcf5e7!important;color:#26744b!important}
    body.dark .ledger-day{background:#333!important;color:#999!important}
    body.dark .ledger-day.doing{background:#4b4519!important;color:#f8e45e!important}
    body.dark .ledger-day.done{background:#233b2e!important;color:#7fd0a1!important}
    .ledger-task-actions .ledger-carry{background:#fff4a3!important;color:#5f5400!important}
    .ledger-task-actions .ledger-status{color:var(--ink)!important}

    /* monthly / history */
    .ledger-hero,.memo-hero{
      background:#fff!important;border:1px solid var(--line)!important;border-top:0!important;
      border-radius:20px!important;padding:24px!important;box-shadow:none!important;
    }
    body.dark .ledger-hero,body.dark .memo-hero{background:var(--card)!important}
    .ledger-hero h2,.memo-hero h2{
      font-family:inherit!important;font-size:30px!important;font-weight:800!important;color:var(--ink)!important;
      letter-spacing:-1px!important;
    }
    .ledger-kicker,.memo-kicker{
      display:inline-flex!important;background:var(--kakao-yellow)!important;color:var(--kakao-black)!important;
      border-radius:999px!important;padding:5px 9px!important;letter-spacing:.2px!important;font-size:10px!important;font-weight:800!important;
    }
    .ledger-controls b{font-family:inherit!important;font-weight:800!important}
    .monthly-form{
      background:var(--card)!important;border:1px solid var(--line)!important;border-radius:16px!important;
      padding:14px!important;
    }
    .monthly-group{border-radius:16px!important;overflow:hidden!important}
    .monthly-group-head{
      background:#fafafa!important;border-bottom:1px solid var(--line)!important;padding:14px 16px!important;
    }
    body.dark .monthly-group-head{background:#202020!important}
    .monthly-group-head b{font-weight:800!important}
    .monthly-row{border-color:var(--line)!important;padding:12px 15px!important}
    .monthly-status i{background:#bdbdbd!important}
    .monthly-status.doing i{background:#f0c000!important}
    .monthly-status.done i{background:#43a66f!important}
    .monthly-actions .to-week{background:#fff4a3!important;color:#5d5200!important}
    .history-summary{gap:8px!important}
    .history-month{
      background:var(--card)!important;border:1px solid var(--line)!important;border-radius:14px!important;
      box-shadow:none!important;
    }
    .history-month.active{background:var(--kakao-yellow)!important;border-color:var(--kakao-yellow)!important;color:var(--kakao-black)!important}
    .history-group>summary{
      background:#fafafa!important;color:var(--ink)!important;border:0!important;padding:14px 16px!important;
    }
    body.dark .history-group>summary{background:#202020!important}
    .history-area h4{color:var(--ink)!important;font-weight:800!important}
    .history-item{border-color:var(--line)!important}

    /* calendar */
    .calendar-card{overflow:visible!important}
    .calendar-head{border-bottom:1px solid var(--line)!important;padding:18px 20px!important}
    .calendar-head h3{font-size:20px!important;font-weight:800!important}
    .calendar-weekdays div{color:#999!important}
    .calendar-weekdays div:first-child{color:#e36b68!important}
    .calendar-weekdays div:last-child{color:#6d87b7!important}
    .cal-day{
      background:#fafafa!important;border:1px solid transparent!important;border-radius:14px!important;box-shadow:none!important;
    }
    body.dark .cal-day{background:#2b2b2b!important}
    .cal-day:hover{background:#f2f2f2!important;border-color:#e6e6e6!important;box-shadow:none!important}
    body.dark .cal-day:hover{background:#333!important;border-color:#444!important}
    .cal-day.today{outline:0!important;background:#fffbe1!important;box-shadow:inset 0 0 0 2px var(--kakao-yellow)!important}
    body.dark .cal-day.today{background:#383515!important}
    .cal-count{background:var(--kakao-yellow)!important;color:var(--kakao-black)!important}
    .calendar-layer{background:#f3f3f3!important}
    .calendar-layer.active{background:var(--kakao-yellow)!important;color:var(--kakao-black)!important}
    .cal-drag-chip.task{background:#e9f1ff!important;color:#39649c!important}
    .cal-drag-chip.note{background:#fff4a3!important;color:#635700!important}
    .cal-day.drag-over{outline:3px solid var(--kakao-yellow)!important;background:#fffbe8!important}

    /* task cards / status */
    .task{border-radius:14px!important;border-color:var(--line)!important;box-shadow:none!important}
    .tasktitle{font-size:15px!important;font-weight:750!important;color:var(--ink)!important}
    .chip{background:#f3f3f3!important;color:#777!important;border:0!important}
    body.dark .chip{background:#333!important;color:#bbb!important}
    .status{background:#f3f3f3!important;color:#777!important}
    .status.active.todo{background:#ececec!important;color:#555!important}
    .status.active.doing{background:#fff4a3!important;color:#665900!important}
    .status.active.done{background:#dff5e8!important;color:#25704a!important}
    .status.active.blocked{background:#ffe3df!important;color:#a94b44!important}
    .issue-note{background:#fff7e8!important;border:0!important;color:#85621c!important;border-radius:12px!important}

    /* memo */
    .memo-count{
      background:var(--kakao-yellow)!important;color:var(--kakao-black)!important;border:0!important;
      border-radius:999px!important;
    }
    .memo-composer textarea{background:#f7f7f7!important;border-radius:14px!important}
    body.dark .memo-composer textarea{background:#2b2b2b!important}
    .memo-bucket{border-top:1px solid var(--line)!important}
    .memo-bucket-head{background:#fafafa!important;border-bottom:1px solid var(--line)!important}
    body.dark .memo-bucket-head{background:#202020!important}
    .memo-bucket-count{background:var(--kakao-yellow)!important;color:var(--kakao-black)!important;border:0!important;border-radius:999px!important}
    .memo-day-item{background:#fffbe5!important;border:0!important;border-radius:14px!important}
    body.dark .memo-day-item{background:#383515!important}

    /* modal / cloud */
    .modalbg,.cloud-auth{backdrop-filter:blur(6px)!important}
    .modal,.account-modal{
      background:var(--card)!important;color:var(--ink)!important;border:0!important;
      border-radius:22px!important;box-shadow:0 18px 55px rgba(0,0,0,.16)!important;
    }
    .modal h2,.account-modal h2{font-family:inherit!important;font-weight:800!important}
    .cloud-pill{
      background:#f3f3f3!important;color:var(--ink)!important;border:0!important;border-radius:999px!important;
    }
    .workflow-undo{
      background:#191919!important;color:#fff!important;border:0!important;border-radius:14px!important;
    }
    .workflow-undo button{background:var(--kakao-yellow)!important;color:var(--kakao-black)!important;border:0!important}

    /* arcade keeps its own game visuals, but navigation follows the workspace */
    .arcade-hero,.arcade-game-card,.arcade-panel{
      border-radius:18px!important;border-color:var(--line)!important;box-shadow:none!important;
    }

    /* remove antique typography everywhere */
    .ledger-week-title b,.ledger-hero h2,.memo-hero h2,.ledger-controls b,
    .ledger-metric strong,.history-metric strong,.memo-metric strong,
    .calendar-label,.reportbox b,.reportcard b{
      font-family:inherit!important;
    }

    @media(max-width:900px){
      header{background:var(--card)!important}
      .ledger-hero,.memo-hero{border-radius:16px!important}
    }
  `;
  document.head.appendChild(style);
})();