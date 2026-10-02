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


    /* weekly home hero - original Work Hub mascot, not a Kakao character */
    .workhub-home-hero{
      position:relative;min-height:164px;margin:0 0 16px;padding:26px 250px 24px 26px;
      display:flex;align-items:center;overflow:hidden;
      background:linear-gradient(118deg,#fff9bf 0%,#fff4a0 58%,#fee500 100%);
      border:1px solid #f4e26a;border-radius:22px;box-shadow:none;
    }
    .workhub-home-hero:before{
      content:'';position:absolute;width:260px;height:260px;right:-60px;top:-120px;border-radius:50%;
      background:rgba(255,255,255,.42)
    }
    .workhub-home-hero:after{
      content:'';position:absolute;width:140px;height:140px;right:170px;bottom:-95px;border-radius:50%;
      background:rgba(255,255,255,.28)
    }
    .workhub-home-copy{position:relative;z-index:2;max-width:780px}
    .workhub-home-kicker{
      display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(25,25,25,.09);
      color:#3b3500;font-size:10px;font-weight:850;letter-spacing:.8px
    }
    .workhub-home-copy h2{
      margin:10px 0 7px;color:#191919;font-family:inherit!important;font-size:28px!important;
      line-height:1.25;font-weight:850!important;letter-spacing:-1.1px
    }
    .workhub-home-copy p{margin:0;color:#5c5600;font-size:13px;line-height:1.65}
    .workhub-home-copy p b{color:#191919}
    .workhub-mascot-scene{position:absolute;right:24px;bottom:0;width:208px;height:150px;z-index:3}
    .workhub-mascot{
      position:absolute;right:24px;bottom:-5px;width:92px;height:92px;border-radius:34px 34px 28px 28px;
      background:#191919;box-shadow:0 10px 22px rgba(0,0,0,.12)
    }
    .workhub-mascot:before{
      content:'';position:absolute;left:13px;top:-16px;width:28px;height:34px;border-radius:18px 18px 8px 18px;
      background:#191919;transform:rotate(-18deg)
    }
    .workhub-mascot:after{
      content:'';position:absolute;right:12px;top:-12px;width:25px;height:30px;border-radius:18px 18px 18px 7px;
      background:#191919;transform:rotate(15deg)
    }
    .mascot-eye{position:absolute;top:34px;width:7px;height:9px;border-radius:50%;background:#fff}
    .mascot-eye.one{left:27px}.mascot-eye.two{right:27px}
    .mascot-smile{
      position:absolute;left:50%;top:50px;width:20px;height:10px;transform:translateX(-50%);
      border-bottom:3px solid #fff;border-radius:0 0 20px 20px
    }
    .mascot-arm{
      position:absolute;left:-18px;bottom:18px;width:30px;height:13px;background:#191919;border-radius:999px;
      transform:rotate(-24deg)
    }
    .mascot-note{
      position:absolute;right:91px;bottom:12px;width:65px;height:78px;padding:14px 11px 8px;
      border-radius:12px;background:#fff;box-shadow:0 8px 18px rgba(0,0,0,.12);transform:rotate(-7deg)
    }
    .mascot-note:before{content:'✓';position:absolute;right:8px;top:6px;color:#191919;font-size:15px;font-weight:900}
    .mascot-note i{display:block;width:80%;height:5px;margin:7px 0;border-radius:999px;background:#e7e7e7}
    .mascot-note i:nth-child(2){width:62%}.mascot-note i:nth-child(3){width:72%}
    .mascot-bubble{
      position:absolute;right:80px;top:3px;min-width:86px;padding:8px 10px;border-radius:12px 12px 3px 12px;
      background:#fff;color:#555;font-size:10px;line-height:1.35;box-shadow:0 5px 14px rgba(0,0,0,.08)
    }
    .mascot-bubble b{color:#191919;font-size:15px}

    /* weekly ledger: simple status-first view, no daily cells */
    .ledger-metrics{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:12px!important;margin-bottom:16px!important}
    .ledger-metric{padding:15px 17px!important;min-height:82px}
    .ledger-metric span{font-size:12px!important;color:#767676!important}
    .ledger-metric strong{margin-top:6px!important;font-size:29px!important;line-height:1!important}
    .ledger-metric.issue-metric strong{color:#d75a54!important}
    .ledger-grid{min-width:0!important}
    .ledger-grid-head,.ledger-task-row{
      grid-template-columns:minmax(380px,1fr) minmax(280px,330px) 190px!important;
      gap:12px!important;align-items:center!important
    }
    .ledger-grid-head{
      padding:4px 12px 9px!important;text-align:left!important;font-size:11px!important;
      letter-spacing:0!important
    }
    .ledger-grid-head>div:nth-child(2){text-align:center!important}
    .ledger-grid-head>div:nth-child(3){text-align:right!important;padding-right:8px}
    .ledger-task-row{
      min-height:78px;margin:8px 0!important;padding:12px 13px!important;border-radius:16px!important;
      transition:background .15s ease,border-color .15s ease,transform .15s ease!important
    }
    .ledger-task-row:hover{transform:translateY(-1px)!important}
    .ledger-task-row.is-doing{background:#fffbe2!important;border-color:#f5e98a!important}
    .ledger-task-row.is-done{background:#ebf8f0!important;border-color:#d4eddd!important}
    .ledger-task-row.is-blocked{background:#fff0ed!important;border-color:#f5d7d2!important}
    body.dark .ledger-task-row.is-doing{background:#393616!important;border-color:#5b5420!important}
    body.dark .ledger-task-row.is-done{background:#203329!important;border-color:#31503e!important}
    body.dark .ledger-task-row.is-blocked{background:#3a2624!important;border-color:#57332f!important}
    .ledger-task-main{padding:2px 4px!important}
    .ledger-task-main strong{
      font-size:16px!important;line-height:1.5!important;font-weight:800!important;letter-spacing:-.35px!important
    }
    .ledger-task-meta{margin-top:7px!important;gap:6px!important}
    .ledger-task-meta span{font-size:10px!important;padding:5px 8px!important}
    .ledger-task-meta .issue-badge{background:#ffe0dc!important;color:#a84740!important}
    .ledger-state-group{
      display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:4px;background:#f2f2f2;border-radius:13px
    }
    body.dark .ledger-state-group{background:#303030}
    .ledger-state-btn{
      min-height:38px;border:0;border-radius:10px;background:transparent;color:#8a8a8a;
      font-size:11px;font-weight:800;cursor:pointer;transition:background .14s ease,color .14s ease,box-shadow .14s ease
    }
    .ledger-state-btn:hover{background:#fff;color:#444}
    body.dark .ledger-state-btn:hover{background:#3c3c3c;color:#eee}
    .ledger-state-btn.active.todo{background:#fff!important;color:#555!important;box-shadow:0 1px 5px rgba(0,0,0,.07)}
    .ledger-state-btn.active.doing{background:#fee500!important;color:#191919!important;box-shadow:none}
    .ledger-state-btn.active.done{background:#ccefd9!important;color:#216542!important;box-shadow:none}
    body.dark .ledger-state-btn.active.todo{background:#424242!important;color:#eee!important}
    body.dark .ledger-state-btn.active.doing{background:#fee500!important;color:#191919!important}
    body.dark .ledger-state-btn.active.done{background:#315c42!important;color:#b8efcb!important}
    .ledger-task-actions{padding:0!important;gap:6px!important;flex-wrap:nowrap!important}
    .ledger-task-actions button{padding:8px 9px!important;font-size:11px!important;white-space:nowrap!important}
    .ledger-task-actions .ledger-carry{background:#fff4a3!important}
    .ledger-week-head{padding:20px 22px!important}
    .ledger-week-title b{font-size:22px!important}
    .ledger-week-title span{margin-top:5px!important;font-size:12px!important;line-height:1.5}
    .ledger-area>summary{padding:17px 20px!important}
    .ledger-area>summary b{font-size:16px!important}
    .ledger-area-body{padding:14px 16px 18px!important}
    .ledger-area-quick{grid-template-columns:220px minmax(300px,1fr) 155px auto!important;gap:9px!important;margin-bottom:14px!important}
    .ledger-area-quick select,.ledger-area-quick input{min-height:42px!important;font-size:13px!important}
    .ledger-area-quick button{min-height:42px!important;font-size:12px!important}

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

    /* live center - BokDesk / Kakao light UI */
    #workhub-live-root .special-hero{
      min-height:auto!important;padding:24px 26px!important;
      background:linear-gradient(135deg,#fffbd5 0%,#ffffff 72%)!important;
      border:1px solid #f0e58d!important;border-top:1px solid #f0e58d!important;
      border-radius:22px!important;box-shadow:none!important;
    }
    #workhub-live-root .special-kicker{
      display:inline-flex!important;align-items:center!important;
      padding:6px 9px!important;border-radius:999px!important;
      background:#191919!important;color:#fff!important;
      font-size:9px!important;line-height:1!important;letter-spacing:1.05px!important;
    }
    #workhub-live-root .special-hero h2{
      margin:8px 0 5px!important;color:var(--ink)!important;
      font-family:inherit!important;font-size:28px!important;font-style:normal!important;
      font-weight:850!important;letter-spacing:-1.1px!important;
    }
    #workhub-live-root .special-hero p{
      color:var(--muted)!important;font-size:13px!important;line-height:1.6!important;
    }
    #workhub-live-root .special-count{
      border:0!important;border-radius:999px!important;background:var(--kakao-yellow)!important;
      color:var(--kakao-black)!important;padding:9px 13px!important;
      font-size:11px!important;font-weight:850!important;
    }

    #workhub-live-root .live-stage{margin-top:14px!important}
    #workhub-live-root .live{
      background:var(--card)!important;color:var(--ink)!important;
      border:1px solid var(--line)!important;border-radius:20px!important;
      box-shadow:none!important;overflow:hidden!important;
    }
    #workhub-live-root .live.expanded{
      background:var(--card)!important;color:var(--ink)!important;
      border:1px solid var(--line)!important;border-radius:24px!important;
      box-shadow:0 24px 70px rgba(0,0,0,.14)!important;
    }
    #workhub-live-root .livehead{
      padding:18px 20px!important;background:#fff!important;
      border-bottom:1px solid var(--line)!important;
    }
    body.dark #workhub-live-root .livehead{background:var(--card)!important}
    #workhub-live-root .livehead b{
      color:var(--ink)!important;font-family:inherit!important;font-size:18px!important;
      font-style:normal!important;letter-spacing:-.5px!important;font-weight:850!important;
    }
    #workhub-live-root .livehead b:before{
      content:'';display:inline-block;width:8px;height:8px;margin-right:8px;
      border-radius:50%;background:#ff5d5d;box-shadow:0 0 0 4px rgba(255,93,93,.10);
      vertical-align:2px;
    }
    #workhub-live-root .livehead span{
      margin-top:3px!important;color:#999!important;font-size:10px!important;
    }
    #workhub-live-root .livetools{gap:7px!important}
    #workhub-live-root .livetools button{
      width:34px!important;height:34px!important;border:0!important;border-radius:10px!important;
      background:#f3f3f3!important;color:#555!important;font-size:15px!important;
      box-shadow:none!important;
    }
    #workhub-live-root .livetools button:hover{
      background:var(--kakao-yellow)!important;color:var(--kakao-black)!important;
    }

    #workhub-live-root .livetabs{
      display:flex!important;grid-template-columns:none!important;gap:7px!important;
      padding:12px 18px!important;background:#fafafa!important;
      border-bottom:1px solid var(--line)!important;max-width:none!important;
    }
    body.dark #workhub-live-root .livetabs{background:#202020!important}
    #workhub-live-root .livetabs button{
      flex:0 0 auto!important;border:0!important;border-radius:999px!important;
      background:#eeeeee!important;color:#777!important;
      padding:8px 13px!important;font-size:10px!important;font-weight:850!important;
      box-shadow:none!important;
    }
    body.dark #workhub-live-root .livetabs button{background:#303030!important;color:#aaa!important}
    #workhub-live-root .livetabs button.active{
      background:var(--kakao-yellow)!important;color:var(--kakao-black)!important;
      border:0!important;
    }

    #workhub-live-root .livebody{
      padding:15px 18px 20px!important;background:var(--card)!important;color:var(--ink)!important;
    }
    #workhub-live-root .indices{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin:0 0 12px!important;
    }
    #workhub-live-root .index{
      background:#fafafa!important;border:1px solid var(--line)!important;
      border-radius:16px!important;padding:15px!important;
    }
    body.dark #workhub-live-root .index{background:#292929!important}
    #workhub-live-root .index:first-child{background:#fffbe3!important;border-color:#f4e79b!important}
    body.dark #workhub-live-root .index:first-child{background:#383515!important;border-color:#514b1f!important}
    #workhub-live-root .index span{color:#999!important;font-size:10px!important;font-weight:750!important}
    #workhub-live-root .index strong{
      color:var(--ink)!important;font-family:inherit!important;font-size:22px!important;
      letter-spacing:-.7px!important;font-weight:850!important;
    }
    #workhub-live-root .index em{font-style:normal!important;font-size:11px!important;font-weight:850!important}

    #workhub-live-root .hyundai{
      margin-bottom:12px!important;padding:14px 16px!important;
      background:linear-gradient(135deg,#fff4a8,#fffbe2)!important;
      border:0!important;border-radius:16px!important;color:#191919!important;
    }
    body.dark #workhub-live-root .hyundai{background:#3b3718!important;color:#f5f5f5!important}
    #workhub-live-root .hyundai small{color:#8a7b00!important;font-size:9px!important;letter-spacing:.65px!important}
    body.dark #workhub-live-root .hyundai small{color:#e7d653!important}
    #workhub-live-root .hyundai b{font-size:15px!important;font-weight:850!important}
    #workhub-live-root .hyundai strong{font-size:19px!important;font-weight:900!important}

    #workhub-live-root .market-title,
    #workhub-live-root .section-title{
      margin:16px 2px 7px!important;color:var(--ink)!important;
    }
    #workhub-live-root .market-title b,
    #workhub-live-root .section-title b{
      color:var(--ink)!important;font-size:13px!important;font-weight:850!important;
    }
    #workhub-live-root .market-title span,
    #workhub-live-root .section-title span{
      color:#aaa!important;font-size:9px!important;
    }
    #workhub-live-root .market-list{gap:0 22px!important}
    #workhub-live-root .stock{
      grid-template-columns:24px minmax(0,1fr) 92px 60px!important;
      gap:8px!important;padding:11px 7px!important;
      border-top:1px solid var(--line)!important;color:var(--ink)!important;font-size:11px!important;
    }
    #workhub-live-root .stock:first-child{border-top:0!important}
    #workhub-live-root .stock .rank{color:#aaa!important;font-weight:750!important}
    #workhub-live-root .stock b{color:var(--ink)!important;font-size:12px!important;font-weight:800!important}
    #workhub-live-root .stock .price{color:var(--ink)!important;font-weight:750!important}
    #workhub-live-root .stock.focus{
      background:#fffbe3!important;border-radius:10px!important;
      padding-left:9px!important;padding-right:9px!important;
    }
    body.dark #workhub-live-root .stock.focus{background:#383515!important}
    #workhub-live-root .up{color:#e85a5f!important}
    #workhub-live-root .down{color:#4c7fd6!important}
    #workhub-live-root .flat{color:#999!important}

    #workhub-live-root .score-list{gap:10px!important}
    #workhub-live-root .scoregame{
      margin:0!important;padding:14px!important;
      background:#fafafa!important;border:1px solid var(--line)!important;
      border-radius:16px!important;color:var(--ink)!important;box-shadow:none!important;
    }
    body.dark #workhub-live-root .scoregame{background:#292929!important}
    #workhub-live-root .scoregame.livegame{
      border-color:#f1d900!important;box-shadow:inset 4px 0 var(--kakao-yellow)!important;
    }
    #workhub-live-root .scoretop{
      margin-bottom:9px!important;color:#999!important;font-size:9px!important;font-weight:700!important;
    }
    #workhub-live-root .team{
      color:var(--ink)!important;font-size:12px!important;font-weight:800!important;
    }
    #workhub-live-root .team img{width:22px!important;height:22px!important}
    #workhub-live-root .score{color:var(--ink)!important;font-size:18px!important;font-weight:900!important}
    #workhub-live-root .watchtag{
      margin-top:9px!important;padding:5px 8px!important;border-radius:999px!important;
      background:#fff3a5!important;color:#665900!important;font-size:9px!important;font-weight:800!important;
    }
    body.dark #workhub-live-root .watchtag{background:#4a451b!important;color:#f8e45e!important}
    #workhub-live-root .note{
      padding:12px 3px 2px!important;color:#aaa!important;font-size:9px!important;line-height:1.55!important;
    }
    #workhub-live-root .empty{
      color:#999!important;background:#fafafa!important;border:1px dashed #e5e5e5!important;
      border-radius:14px!important;padding:34px 12px!important;
    }
    body.dark #workhub-live-root .empty{background:#292929!important;border-color:#3b3b3b!important}
    #liveBackdrop.backdrop{
      background:rgba(25,25,25,.36)!important;backdrop-filter:blur(6px)!important;
    }

    @media(max-width:700px){
      #workhub-live-root .special-hero{padding:20px!important;border-radius:18px!important}
      #workhub-live-root .special-hero h2{font-size:24px!important}
      #workhub-live-root .livetabs{overflow-x:auto!important;padding:10px 12px!important}
      #workhub-live-root .livebody{padding:12px!important}
      #workhub-live-root .indices{grid-template-columns:1fr!important}
      #workhub-live-root .stock{grid-template-columns:22px minmax(0,1fr) 76px 52px!important}
    }

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

    @media(max-width:1280px){
      .ledger-grid-head,.ledger-task-row{grid-template-columns:minmax(300px,1fr) 270px 176px!important}
      .ledger-area-quick{grid-template-columns:190px minmax(240px,1fr) 145px auto!important}
    }
    @media(max-width:1040px){
      .ledger-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .ledger-grid-head{display:none!important}
      .ledger-task-row{grid-template-columns:1fr!important;gap:10px!important}
      .ledger-state-group{max-width:430px}
      .ledger-task-actions{justify-content:flex-start!important}
      .workhub-home-hero{padding-right:210px!important}
      .workhub-mascot-scene{right:4px;transform:scale(.88);transform-origin:right bottom}
    }
    @media(max-width:900px){
      header{background:var(--card)!important}
      .ledger-hero,.memo-hero{border-radius:16px!important}
      .ledger-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .ledger-area-quick{grid-template-columns:1fr!important}
      .workhub-home-hero{min-height:190px;padding:22px 150px 22px 20px!important}
      .workhub-home-copy h2{font-size:23px!important}
      .workhub-home-copy p{font-size:12px!important}
      .workhub-mascot-scene{right:-25px;transform:scale(.68)}
    }
  `;
  document.head.appendChild(style);
})();