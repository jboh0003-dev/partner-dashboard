(() => {
  'use strict';
  if (document.getElementById('workhub-okestro-theme-style')) return;

  const style = document.createElement('style');
  style.id = 'workhub-okestro-theme-style';
  style.textContent = `
    :root{
      --bg:#f8fafc!important;
      --card:#ffffff!important;
      --ink:#0f172a!important;
      --muted:#64748b!important;
      --line:#e2e8f0!important;
      --brand:#2563eb!important;
      --primary:#2563eb!important;
      --primary-soft:#eff6ff!important;
      --green:#059669!important;
      --red:#dc2626!important;
      --amber:#d97706!important;
      --shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px -14px rgba(15,23,42,.16)!important;
      --radius:16px;
      color-scheme:light;
    }
    body.dark{
      --bg:#0f172a!important;
      --card:#111827!important;
      --ink:#f8fafc!important;
      --muted:#94a3b8!important;
      --line:#263244!important;
      --primary-soft:#172554!important;
      --shadow:0 10px 30px rgba(0,0,0,.22)!important;
      color-scheme:dark;
    }

    html,body{
      background:var(--bg)!important;color:var(--ink)!important;
      font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      font-size:15px!important;line-height:1.45!important;letter-spacing:-.01em!important;
    }
    button,input,select,textarea,.title,.brand,.ledger-week-title b,.ledger-hero h2,.memo-hero h2,
    .ledger-metric strong,.history-metric strong,.memo-metric strong,.calendar-label,.reportbox b,.reportcard b{
      font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
    }

    .shell{display:flex!important;min-height:100vh!important}
    .side{
      position:fixed!important;inset:0 auto 0 0!important;width:224px!important;height:100vh!important;
      padding:20px 12px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;
      background:#fff!important;border-right:1px solid #e2e8f0!important;color:#0f172a!important;
      overflow-y:auto!important;z-index:60!important;box-shadow:none!important
    }
    body.dark .side{background:#111827!important;border-color:#263244!important}
    .brand{
      padding:4px 12px 18px!important;margin:0!important;font-size:24px!important;line-height:1.1!important;
      font-weight:800!important;letter-spacing:-.8px!important;color:#0f172a!important
    }
    body.dark .brand{color:#fff!important}
    .brand small{
      display:block!important;margin:7px 0 0!important;font-size:9px!important;line-height:1.3!important;
      letter-spacing:.16em!important;color:#94a3b8!important;font-weight:700!important
    }
    .nav{display:flex!important;flex-direction:column!important;gap:2px!important;width:100%!important}
    .nav button{
      position:relative!important;width:100%!important;margin:0!important;padding:10px 12px!important;
      border:0!important;border-radius:10px!important;background:transparent!important;color:#64748b!important;
      text-align:left!important;font-size:13px!important;line-height:1.35!important;font-weight:650!important;
      box-shadow:none!important;transition:background .15s ease,color .15s ease!important
    }
    .nav button:hover{background:#f8fafc!important;color:#0f172a!important}
    .nav button.active{
      background:#eff6ff!important;color:#1e40af!important;font-weight:750!important
    }
    .nav button.active:before{
      content:'';position:absolute;left:0;top:50%;width:3px;height:22px;transform:translateY(-50%);
      border-radius:0 4px 4px 0;background:#2563eb
    }
    body.dark .nav button{color:#94a3b8!important}
    body.dark .nav button:hover{background:#1f2937!important;color:#fff!important}
    body.dark .nav button.active{background:#172554!important;color:#bfdbfe!important}
    .nav-divider{
      display:flex!important;align-items:center!important;gap:7px!important;margin:15px 9px 5px!important;
      color:#94a3b8!important;font-size:9px!important;font-weight:700!important;letter-spacing:.12em!important
    }
    .nav-divider:before,.nav-divider:after{content:'';height:1px;background:#e2e8f0!important;flex:1}
    .nav-divider span{white-space:nowrap;background:#fff!important;padding:0 3px!important}
    body.dark .nav-divider:before,body.dark .nav-divider:after{background:#334155!important}
    body.dark .nav-divider span{background:#111827!important}

    .main{margin-left:224px!important;width:calc(100% - 224px)!important;min-width:0!important}
    header{
      position:sticky!important;top:0!important;z-index:40!important;height:72px!important;padding:0 24px!important;
      display:flex!important;align-items:center!important;justify-content:space-between!important;
      background:rgba(255,255,255,.92)!important;border-bottom:1px solid #e2e8f0!important;
      backdrop-filter:blur(14px)!important
    }
    body.dark header{background:rgba(17,24,39,.92)!important;border-color:#263244!important}
    .title{font-size:25px!important;font-weight:800!important;letter-spacing:-.8px!important;color:var(--ink)!important}
    .subclock{margin-top:2px!important;font-size:10px!important;color:#94a3b8!important}
    .headtools{display:flex!important;gap:7px!important;align-items:center!important}
    .btn,.tabs button{
      border:1px solid #e2e8f0!important;background:#fff!important;color:#334155!important;
      border-radius:10px!important;padding:8px 11px!important;font-size:11px!important;font-weight:700!important;
      box-shadow:none!important;transition:.15s ease!important
    }
    .btn:hover,.tabs button:hover{background:#f8fafc!important;border-color:#cbd5e1!important}
    .btn.primary,.tabs button.active{
      background:#2563eb!important;border-color:#2563eb!important;color:#fff!important
    }
    body.dark .btn,body.dark .tabs button{background:#111827!important;border-color:#334155!important;color:#cbd5e1!important}

    .wrap{max-width:none!important;width:100%!important;margin:0!important;padding:16px 18px 28px!important}
    input,select,textarea,.input{
      border:1px solid #e2e8f0!important;background:#fff!important;color:#0f172a!important;
      border-radius:10px!important;outline:none!important;box-shadow:none!important
    }
    input:focus,select:focus,textarea:focus,.input:focus{
      border-color:#3b82f6!important;box-shadow:0 0 0 3px rgba(59,130,246,.12)!important
    }
    body.dark input,body.dark select,body.dark textarea,body.dark .input{
      background:#111827!important;color:#f8fafc!important;border-color:#334155!important
    }

    /* Dashboard hero: Partner Connect / Toss-like, no mascot or yellow theme */
    .workhub-home-hero{
      position:relative!important;min-height:112px!important;margin:0 0 12px!important;padding:22px 26px!important;
      display:flex!important;align-items:center!important;overflow:hidden!important;border-radius:18px!important;
      border:1px solid rgba(148,163,184,.16)!important;
      background:
        radial-gradient(420px 180px at 85% 0%,rgba(59,130,246,.38),transparent 58%),
        linear-gradient(125deg,#0f172a 0%,#172554 48%,#1d4ed8 100%)!important;
      box-shadow:0 8px 30px -20px rgba(15,23,42,.45)!important
    }
    .workhub-home-hero:before,.workhub-home-hero:after,.workhub-mascot-scene{display:none!important}
    .workhub-home-copy{max-width:780px!important}
    .workhub-home-kicker{
      display:inline-flex!important;padding:4px 8px!important;border-radius:999px!important;
      background:rgba(255,255,255,.1)!important;color:#bfdbfe!important;font-size:9px!important;
      font-weight:800!important;letter-spacing:.08em!important
    }
    .workhub-home-copy h2{
      margin:8px 0 5px!important;color:#fff!important;font-size:24px!important;font-weight:800!important;
      line-height:1.2!important;letter-spacing:-.8px!important
    }
    .workhub-home-copy p{margin:0!important;color:#dbeafe!important;font-size:11px!important;line-height:1.55!important}
    .workhub-home-copy p b{color:#fff!important}

    /* KPI */
    .ledger-metrics{
      display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;
      gap:10px!important;margin:0 0 12px!important
    }
    .ledger-metric{
      min-height:72px!important;padding:12px 14px!important;border:1px solid #e2e8f0!important;border-radius:14px!important;
      background:#fff!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important
    }
    body.dark .ledger-metric{background:#111827!important;border-color:#263244!important}
    .ledger-metric span{display:block!important;color:#64748b!important;font-size:10px!important;font-weight:700!important}
    .ledger-metric strong{display:block!important;margin-top:4px!important;color:#0f172a!important;font-size:24px!important;font-weight:800!important}
    body.dark .ledger-metric strong{color:#f8fafc!important}
    .ledger-metric.issue-metric strong{color:#dc2626!important}

    /* Weekly quadrant board */
    .ledger-week{
      border:1px solid #e2e8f0!important;border-radius:16px!important;background:#fff!important;
      overflow:hidden!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important
    }
    body.dark .ledger-week{background:#111827!important;border-color:#263244!important}
    .ledger-week-head{
      display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;
      padding:12px 14px!important;border:0!important;border-bottom:1px solid #e2e8f0!important;background:#fff!important
    }
    body.dark .ledger-week-head{background:#111827!important;border-color:#263244!important}
    .ledger-week-title b{font-size:17px!important;font-weight:800!important;color:var(--ink)!important}
    .ledger-week-title span{display:block!important;margin-top:3px!important;color:#64748b!important;font-size:10px!important}
    .ledger-week-nav{display:flex!important;gap:5px!important;align-items:center!important}
    .ledger-week-nav button{
      border:1px solid #e2e8f0!important;background:#fff!important;color:#475569!important;border-radius:9px!important;
      padding:6px 9px!important;font-size:9px!important;font-weight:700!important;cursor:pointer!important
    }
    .ledger-week-nav button:hover{border-color:#bfdbfe!important;background:#eff6ff!important;color:#1d4ed8!important}
    body.dark .ledger-week-nav button{background:#111827!important;border-color:#334155!important;color:#cbd5e1!important}
    .ledger-top-quick{
      display:grid!important;grid-template-columns:190px minmax(320px,1fr) 135px 64px!important;
      gap:7px!important;padding:9px 10px!important;border-bottom:1px solid #e2e8f0!important;background:#f8fafc!important
    }
    body.dark .ledger-top-quick{background:#0f172a!important;border-color:#263244!important}
    .ledger-top-quick select,.ledger-top-quick input{min-height:34px!important;padding:6px 9px!important;font-size:10px!important}
    .ledger-top-quick button{
      min-height:34px!important;border:0!important;border-radius:9px!important;background:#2563eb!important;color:#fff!important;
      font-size:10px!important;font-weight:800!important;cursor:pointer!important
    }
    .ledger-board{
      display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;
      padding:10px!important;background:#f8fafc!important;align-items:start!important
    }
    body.dark .ledger-board{background:#0f172a!important}
    .ledger-board .ledger-area{
      margin:0!important;border:1px solid #e2e8f0!important;border-radius:14px!important;overflow:hidden!important;
      background:#fff!important;align-self:start!important;box-shadow:0 1px 2px rgba(15,23,42,.025)!important
    }
    body.dark .ledger-board .ledger-area{background:#111827!important;border-color:#263244!important}
    .ledger-board .ledger-area>summary{
      list-style:none!important;display:flex!important;align-items:center!important;justify-content:space-between!important;
      min-height:40px!important;padding:9px 12px!important;cursor:pointer!important;
      border:0!important;border-bottom:1px solid #e2e8f0!important;background:#fff!important
    }
    .ledger-board .ledger-area>summary::-webkit-details-marker{display:none!important}
    body.dark .ledger-board .ledger-area>summary{background:#111827!important;border-color:#263244!important}
    .ledger-board .ledger-area>summary b{font-size:12px!important;font-weight:800!important;color:#0f172a!important}
    body.dark .ledger-board .ledger-area>summary b{color:#f8fafc!important}
    .ledger-board .ledger-area>summary span{
      min-width:22px!important;height:22px!important;display:grid!important;place-items:center!important;
      border-radius:999px!important;border:0!important;background:#eff6ff!important;color:#2563eb!important;
      font-size:9px!important;font-weight:800!important
    }
    .ledger-board .ledger-area-body{padding:5px 7px 7px!important}
    .ledger-grid{min-width:0!important}
    .ledger-grid-head{display:none!important}
    .ledger-board .ledger-task-row{
      display:grid!important;grid-template-columns:minmax(0,1fr) 205px!important;
      grid-template-areas:"main status" "main actions"!important;
      gap:4px 8px!important;align-items:center!important;min-height:58px!important;
      margin:4px 0!important;padding:7px 8px!important;border:1px solid #e2e8f0!important;border-left:3px solid #cbd5e1!important;
      border-radius:11px!important;background:#fff!important;box-shadow:none!important;transition:.15s ease!important
    }
    .ledger-board .ledger-task-row:hover{border-color:#bfdbfe!important;background:#f8fbff!important;transform:none!important}
    .ledger-board .ledger-task-row.is-doing{background:#eff6ff!important;border-color:#bfdbfe!important;border-left-color:#2563eb!important}
    .ledger-board .ledger-task-row.is-done{background:#f0fdf4!important;border-color:#bbf7d0!important;border-left-color:#10b981!important}
    .ledger-board .ledger-task-row.is-blocked{background:#fff7ed!important;border-color:#fed7aa!important;border-left-color:#f97316!important}
    body.dark .ledger-board .ledger-task-row{background:#111827!important;border-color:#263244!important}
    body.dark .ledger-board .ledger-task-row.is-doing{background:#172554!important;border-color:#1e3a8a!important}
    body.dark .ledger-board .ledger-task-row.is-done{background:#052e24!important;border-color:#065f46!important}
    body.dark .ledger-board .ledger-task-row.is-blocked{background:#431407!important;border-color:#7c2d12!important}
    .ledger-board .ledger-task-main{grid-area:main!important;min-width:0!important;max-width:none!important;padding:0 2px!important}
    .ledger-board .ledger-task-main strong{
      display:block!important;font-size:12px!important;line-height:1.35!important;font-weight:750!important;
      color:#0f172a!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:keep-all!important
    }
    body.dark .ledger-board .ledger-task-main strong{color:#f8fafc!important}
    .ledger-board .ledger-task-meta{display:flex!important;gap:4px!important;flex-wrap:wrap!important;margin-top:4px!important}
    .ledger-board .ledger-task-meta span{
      border:0!important;border-radius:999px!important;padding:2px 6px!important;background:#f1f5f9!important;color:#64748b!important;
      font-size:8px!important;font-weight:650!important
    }
    .ledger-board .ledger-task-meta span.primary{background:#eff6ff!important;color:#1d4ed8!important}
    .ledger-board .ledger-task-meta .issue-badge{background:#fff7ed!important;color:#c2410c!important}
    .ledger-board .ledger-state-group{
      grid-area:status!important;display:grid!important;grid-template-columns:repeat(3,1fr)!important;
      width:auto!important;gap:2px!important;padding:2px!important;border-radius:9px!important;background:#f1f5f9!important
    }
    body.dark .ledger-board .ledger-state-group{background:#1f2937!important}
    .ledger-board .ledger-state-btn{
      min-height:26px!important;border:0!important;border-radius:7px!important;background:transparent!important;color:#94a3b8!important;
      font-size:8px!important;font-weight:750!important;cursor:pointer!important;box-shadow:none!important
    }
    .ledger-board .ledger-state-btn.active.todo{background:#fff!important;color:#475569!important}
    .ledger-board .ledger-state-btn.active.doing{background:#2563eb!important;color:#fff!important}
    .ledger-board .ledger-state-btn.active.done{background:#10b981!important;color:#fff!important}
    body.dark .ledger-board .ledger-state-btn.active.todo{background:#334155!important;color:#e2e8f0!important}
    .ledger-board .ledger-task-actions{
      grid-area:actions!important;display:flex!important;justify-content:flex-end!important;gap:3px!important;width:auto!important;padding:0!important
    }
    .ledger-board .ledger-task-actions button{
      border:1px solid #e2e8f0!important;border-radius:7px!important;background:#fff!important;color:#64748b!important;
      padding:4px 6px!important;font-size:8px!important;font-weight:700!important;cursor:pointer!important
    }
    .ledger-board .ledger-task-actions button:hover{background:#f8fafc!important;color:#0f172a!important}
    .ledger-board .ledger-task-actions .ledger-carry{background:#eff6ff!important;border-color:#dbeafe!important;color:#1d4ed8!important}
    .ledger-empty{padding:12px!important;text-align:center!important;color:#94a3b8!important;font-size:9px!important}

    /* Monthly/history/notes use the same Connect surfaces */
    .ledger-special{max-width:none!important;margin:0!important;padding:16px 18px 28px!important}
    .ledger-hero,.memo-hero,.panel,.reportcard,.calendar-card,.monthly-group,.history-month,.history-group,.memo-card,.cloud-card,.account-modal,.friends-modal,.friend-home,.guestbook-modal{
      border:1px solid #e2e8f0!important;border-radius:16px!important;background:#fff!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important
    }
    body.dark .ledger-hero,body.dark .memo-hero,body.dark .panel,body.dark .reportcard,body.dark .calendar-card,
    body.dark .monthly-group,body.dark .history-month,body.dark .history-group,body.dark .memo-card,
    body.dark .cloud-card,body.dark .account-modal,body.dark .friends-modal,body.dark .friend-home,body.dark .guestbook-modal{
      background:#111827!important;border-color:#263244!important
    }
    .ledger-hero,.memo-hero{padding:20px!important;background:linear-gradient(135deg,#fff,#f8fafc)!important}
    body.dark .ledger-hero,body.dark .memo-hero{background:#111827!important}
    .ledger-hero h2,.memo-hero h2{font-size:25px!important;font-weight:800!important;color:var(--ink)!important}
    .ledger-kicker,.memo-kicker{
      display:inline-flex!important;border-radius:999px!important;padding:4px 8px!important;background:#eff6ff!important;
      color:#2563eb!important;font-size:9px!important;font-weight:800!important;letter-spacing:.04em!important
    }
    .monthly-form{border:1px solid #e2e8f0!important;border-radius:14px!important;background:#fff!important}
    .monthly-group-head,.history-group>summary{background:#f8fafc!important;border-color:#e2e8f0!important}
    .history-month.active{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important}

    /* Feature modules: normalize every late-injected legacy surface to the same Connect system */
    #workhub-live-nav.active,#workhub-arcade-nav.active,#workhub-notes-nav.active,#workhub-monthly-nav.active,#workhub-history-nav.active,
    #friendsManageBtn.active,#accountManageBtn.active{
      background:#eff6ff!important;border-color:transparent!important;color:#1e40af!important;
      box-shadow:none!important
    }
    .special-root,.notes-root,.ledger-special{max-width:none!important;margin:0!important;padding:16px 18px 28px!important}
    .special-hero,.memo-hero,.ledger-hero{
      border:1px solid #e2e8f0!important;border-top:1px solid #e2e8f0!important;border-radius:16px!important;
      background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important;
      padding:18px 20px!important
    }
    .special-kicker,.memo-kicker,.ledger-kicker{color:#2563eb!important;letter-spacing:.06em!important;font-size:9px!important}
    .special-hero h2,.memo-hero h2,.ledger-hero h2{
      font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
      color:#0f172a!important;font-size:24px!important;font-weight:800!important;letter-spacing:-.6px!important
    }
    body.dark .special-hero,body.dark .memo-hero,body.dark .ledger-hero{background:#111827!important;border-color:#263244!important}
    body.dark .special-hero h2,body.dark .memo-hero h2,body.dark .ledger-hero h2{color:#f8fafc!important}
    .special-count,.memo-count{
      border:1px solid #dbeafe!important;background:#eff6ff!important;color:#1d4ed8!important;
      border-radius:999px!important;font-size:10px!important
    }
    .arcade-game-card,.memo-composer,.memo-bucket,.memo-card,.calendar-card,.cloud-card{
      border:1px solid #e2e8f0!important;border-top:1px solid #e2e8f0!important;border-radius:14px!important;
      background:#fff!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important
    }
    .arcade-game-card:hover,.memo-card:hover{border-color:#bfdbfe!important}
    .arcade-game-card.active{border-color:#93c5fd!important;background:#eff6ff!important;box-shadow:none!important}
    .arcade-game-icon{background:#eff6ff!important;color:#2563eb!important;border-radius:12px!important}
    .arcade-game-card b,.memo-metric strong,.calendar-head h3{
      font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important
    }
    .memo-bucket-head,.monthly-group-head,.history-group>summary{
      background:#f8fafc!important;border-color:#e2e8f0!important
    }
    .memo-bucket{border-top:1px solid #e2e8f0!important}
    .memo-bucket-count,.special-count,.memo-count{color:#2563eb!important}
    .memo-actions .primary,.calendar-layer.active{background:#2563eb!important;border-color:#2563eb!important;color:#fff!important}
    .memo-card.done{background:#f0fdf4!important;border-color:#bbf7d0!important}
    .live-stage .live:not(.expanded),.live{
      border:1px solid #1e293b!important;border-radius:16px!important;box-shadow:none!important
    }
    .runner-heading h2,.runner-records h3,.runner-message b,.reportcard h3{
      font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important
    }
    .ledger-grid{min-width:0!important}

    /* Social mini-home, customization and posts */
    .profile-edit-grid select{width:100%!important;border:1px solid #e2e8f0!important;border-radius:10px!important;padding:10px!important;background:#fff!important;color:#0f172a!important;font-size:12px!important}
    .profile-preset-row{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin-top:9px!important}
    .profile-preset-row button{width:34px!important;height:34px!important;border:1px solid #e2e8f0!important;border-radius:10px!important;background:#fff!important;font-size:17px!important;cursor:pointer!important}
    .profile-preset-row button:hover{background:#eff6ff!important;border-color:#bfdbfe!important}
    body.dark .profile-edit-grid select,body.dark .profile-preset-row button{background:#111827!important;color:#f8fafc!important;border-color:#334155!important}
    .friend-home.theme-blue .friend-home-cover{background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#2563eb 100%)!important}
    .friend-home.theme-night .friend-home-cover{background:linear-gradient(135deg,#020617 0%,#172554 58%,#1e40af 100%)!important}
    .friend-home.theme-mint .friend-home-cover{background:linear-gradient(135deg,#0f172a 0%,#0f766e 58%,#14b8a6 100%)!important}
    .friend-home.theme-violet .friend-home-cover{background:linear-gradient(135deg,#111827 0%,#5b21b6 58%,#7c3aed 100%)!important}
    .friend-home.theme-pink .friend-home-cover{background:linear-gradient(135deg,#111827 0%,#9f1239 58%,#e11d48 100%)!important}
    .friend-home.theme-yellow .friend-home-cover{background:linear-gradient(135deg,#172554 0%,#1d4ed8 60%,#60a5fa 100%)!important}
    .social-post-modal{width:min(820px,100%)!important}
    .social-post-compose{display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important;margin-bottom:12px!important;padding:12px!important;border:1px solid #e2e8f0!important;border-radius:14px!important;background:#f8fafc!important}
    .social-post-compose-head{grid-column:1/-1!important;display:flex!important;align-items:center!important;gap:8px!important}
    .social-post-compose-head select{width:62px!important;min-width:62px!important;padding:7px!important}
    .social-post-compose textarea{min-height:92px!important;resize:vertical!important;padding:10px 11px!important;font-size:12px!important;line-height:1.55!important}
    .social-post-compose>button{border:0!important;border-radius:10px!important;background:#2563eb!important;color:#fff!important;padding:0 15px!important;font-size:11px!important;font-weight:800!important;cursor:pointer!important}
    .social-post-list{display:grid!important;gap:10px!important}
    .social-post-card{border:1px solid #e2e8f0!important;border-radius:14px!important;background:#fff!important;padding:13px!important;box-shadow:0 1px 2px rgba(15,23,42,.03)!important}
    body.dark .social-post-compose,body.dark .social-post-card{background:#111827!important;border-color:#334155!important}
    .social-post-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important}
    .social-post-author{display:flex!important;align-items:center!important;gap:8px!important}
    .social-post-author .mini-avatar,.social-comment .mini-avatar{display:grid!important;place-items:center!important;background:#eff6ff!important;border:1px solid #dbeafe!important}
    .social-post-author .mini-avatar{width:34px!important;height:34px!important;border-radius:10px!important;font-size:17px!important}
    .social-post-author b{display:block!important;font-size:11px!important}.social-post-author small{display:block!important;margin-top:2px!important;color:#94a3b8!important;font-size:8px!important}
    .social-post-mood{font-size:18px!important}
    .social-post-body{padding:12px 0!important;font-size:12px!important;line-height:1.65!important;white-space:pre-wrap!important;word-break:break-word!important}
    .social-post-actions{display:flex!important;align-items:center!important;gap:7px!important;padding-top:9px!important;border-top:1px solid #f1f5f9!important}
    .social-post-actions button{border:1px solid #e2e8f0!important;border-radius:9px!important;background:#fff!important;color:#64748b!important;padding:6px 8px!important;font-size:9px!important;font-weight:750!important;cursor:pointer!important}
    .social-post-actions button.active{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important}
    .social-post-actions button.danger{margin-left:auto!important;color:#b91c1c!important}
    .social-post-actions span{font-size:9px!important;color:#94a3b8!important}
    .social-comments{display:grid!important;gap:5px!important;margin-top:9px!important}
    .social-comment{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;gap:7px!important;align-items:start!important;padding:8px!important;border-radius:10px!important;background:#f8fafc!important}
    body.dark .social-comment{background:#1f2937!important}
    .social-comment .mini-avatar{width:25px!important;height:25px!important;border-radius:8px!important;font-size:13px!important}
    .social-comment b{font-size:9px!important}.social-comment p{margin:2px 0 0!important;font-size:9px!important;line-height:1.45!important}.social-comment button{border:0!important;background:transparent!important;color:#94a3b8!important;font-size:8px!important;cursor:pointer!important}
    .social-comment-form{display:grid!important;grid-template-columns:1fr auto!important;gap:6px!important;margin-top:8px!important}
    .social-comment-form input{padding:8px 9px!important;font-size:10px!important}.social-comment-form button{border:0!important;border-radius:9px!important;background:#2563eb!important;color:#fff!important;padding:0 11px!important;font-size:9px!important;font-weight:800!important}
    /* Social */
    .friends-avatar{background:#eff6ff!important;border-color:#bfdbfe!important}
    .friends-self{background:#f8fafc!important;border-color:#e2e8f0!important}
    .friend-search button,.friend-actions .primary,.guestbook-compose button,.post-compose-actions button,.comment-form button{
      background:#2563eb!important;color:#fff!important;border-color:#2563eb!important
    }
    .permission-chip{background:#eff6ff!important;color:#1d4ed8!important}
    .friend-home-cover{
      background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 58%,#2563eb 100%)!important;
      color:#fff!important;border-bottom:0!important
    }
    .friend-home-head p,.friend-home-profile span{color:#dbeafe!important}
    .friend-home-profile .friends-avatar{background:#fff!important;border-color:#dbeafe!important}
    .friend-home-nav button.active{background:#2563eb!important;color:#fff!important}

    /* Lab game shells follow the same OKESTRO product language; canvases keep their own game art */
    .bokrun-shell,.kart-crossing{
      border:1px solid #e2e8f0!important;border-top:1px solid #e2e8f0!important;border-radius:16px!important;
      background:#fff!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important;overflow:hidden!important
    }
    body.dark .bokrun-shell,body.dark .kart-crossing{background:#111827!important;border-color:#263244!important}
    .bokrun-hero,.kart-head{
      background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 56%,#2563eb 100%)!important;
      color:#fff!important;border-bottom:0!important
    }
    .bokrun-kicker,.kart-kicker{color:#bfdbfe!important;opacity:1!important}
    .bokrun-hero h2,.kart-head h2{color:#fff!important;font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-weight:800!important}
    .bokrun-hero p,.kart-head p{color:#dbeafe!important}
    .bokrun-wallet span{background:rgba(255,255,255,.12)!important;color:#fff!important}
    .bokrun-nav{background:#f8fafc!important;border-color:#e2e8f0!important}
    .bokrun-nav button{color:#64748b!important}.bokrun-nav button.active{background:#eff6ff!important;color:#1d4ed8!important}
    .bokrun-world.active,.bokrun-unit.selected,.bokrun-consume.active{border-color:#60a5fa!important;box-shadow:inset 0 0 0 1px #60a5fa!important;background:#eff6ff!important}
    .bokrun-start,.bokrun-primary,.kart-head-actions .primary,.kart-reveal-button{
      background:#2563eb!important;border-color:#2563eb!important;color:#fff!important
    }
    .bokrun-start:hover,.bokrun-primary:hover,.kart-head-actions .primary:hover,.kart-reveal-button:hover{background:#1d4ed8!important}
    .bokrun-card,.kart-lounge,.kart-selected,.kart-modal{
      background:#fff!important;border-color:#e2e8f0!important;color:#0f172a!important;box-shadow:none!important
    }
    body.dark .bokrun-card,body.dark .kart-lounge,body.dark .kart-selected,body.dark .kart-modal{background:#111827!important;border-color:#334155!important;color:#f8fafc!important}
    .kart-lounge-title h3,.kart-modal h3,.kart-message b{
      font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important
    }
    .kart-balance{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important}
    .kart-controls{background:#0f172a!important;border-color:#334155!important}
    .kart-controls button{background:#1e293b!important;border-color:#475569!important;color:#e2e8f0!important;border-radius:9px!important}
    .kart-controls button:active{background:#334155!important}
    .kart-message{border-color:#60a5fa!important;background:rgba(15,23,42,.94)!important;color:#fff!important}
    .kart-message em{color:#93c5fd!important}
    .kart-modal-bg{background:rgba(2,6,23,.78)!important}
    /* Readability pass: desktop work UI must be readable without zooming */
    .title{font-size:27px!important}
    .subclock{font-size:12px!important;color:#64748b!important}
    .btn,.tabs button{font-size:13px!important;padding:9px 12px!important}
    .nav button{font-size:14px!important;padding:11px 12px!important;color:#475569!important}
    .nav-divider{font-size:10px!important;color:#64748b!important}
    .brand small{font-size:10px!important;color:#64748b!important}

    .ledger-metrics{gap:12px!important}
    .ledger-metric{min-height:82px!important;padding:14px 16px!important}
    .ledger-metric span{font-size:12px!important;color:#475569!important;font-weight:750!important}
    .ledger-metric strong{font-size:28px!important;line-height:1.1!important}

    .ledger-week-head{padding:15px 16px!important}
    .ledger-week-title b{font-size:20px!important;line-height:1.25!important}
    .ledger-week-title span{margin-top:5px!important;font-size:13px!important;color:#475569!important}
    .ledger-week-nav{gap:7px!important}
    .ledger-week-nav button{min-height:36px!important;padding:8px 11px!important;font-size:12px!important;color:#334155!important}

    .ledger-top-quick{
      grid-template-columns:200px minmax(320px,1fr) 150px 76px!important;
      gap:8px!important;padding:11px 12px!important
    }
    .ledger-top-quick select,.ledger-top-quick input{min-height:40px!important;padding:8px 11px!important;font-size:13px!important}
    .ledger-top-quick button{min-height:40px!important;font-size:13px!important}

    .ledger-board{gap:12px!important;padding:12px!important}
    .ledger-board .ledger-area>summary{min-height:48px!important;padding:11px 13px!important}
    .ledger-board .ledger-area>summary b{font-size:15px!important}
    .ledger-board .ledger-area>summary span{
      min-width:26px!important;height:26px!important;font-size:11px!important
    }
    .ledger-board .ledger-area-body{padding:7px 9px 9px!important}
    .ledger-board .ledger-task-row{
      grid-template-columns:minmax(0,1fr) 238px!important;
      gap:7px 10px!important;min-height:74px!important;margin:6px 0!important;padding:10px 11px!important
    }
    .ledger-board .ledger-task-main strong{
      font-size:15px!important;line-height:1.45!important;font-weight:800!important;color:#0f172a!important
    }
    .ledger-board .ledger-task-meta{gap:6px!important;margin-top:7px!important}
    .ledger-board .ledger-task-meta span{
      padding:4px 7px!important;font-size:11px!important;line-height:1.2!important;
      color:#475569!important;font-weight:700!important
    }
    .ledger-board .ledger-state-group{gap:4px!important;padding:3px!important}
    .ledger-board .ledger-state-btn{
      min-height:32px!important;font-size:11px!important;font-weight:800!important;color:#64748b!important
    }
    .ledger-board .ledger-task-actions{gap:5px!important}
    .ledger-board .ledger-task-actions button{
      min-height:30px!important;padding:6px 8px!important;font-size:11px!important;font-weight:750!important;color:#475569!important
    }
    .ledger-empty{padding:16px!important;font-size:12px!important;color:#64748b!important}

    .special-kicker,.memo-kicker,.ledger-kicker{font-size:11px!important}
    .special-count,.memo-count{font-size:12px!important}
    .special-hero p,.memo-hero p,.ledger-hero p{font-size:13px!important;line-height:1.55!important;color:#475569!important}
    .calendar-head p{font-size:13px!important;color:#475569!important}
    .calendar-label{font-size:16px!important}
    .cal-num{font-size:14px!important}
    .holiday-name,.cal-preview span{font-size:11px!important}
    .memo-card,.memo-bucket,.calendar-card,.cloud-card{font-size:13px!important}

    .friend-home-nav button{font-size:12px!important;padding:10px 13px!important}
    .friend-stat span,.game-metric span{font-size:10px!important;color:#64748b!important}
    .friend-stat strong,.game-metric strong{font-size:17px!important}
    .friend-item b{font-size:12px!important;line-height:1.45!important}
    .friend-item small,.friend-item span{font-size:10px!important;color:#64748b!important}
    .social-post-author b{font-size:12px!important}
    .social-post-author small{font-size:10px!important}
    .social-post-body{font-size:13px!important}
    .social-post-actions button,.social-post-actions span{font-size:10px!important}
    .social-comment b,.social-comment p,.social-comment-form input,.social-comment-form button{font-size:10px!important}

    @media (max-width:1200px){
      .ledger-board{grid-template-columns:1fr!important}
      .ledger-board .ledger-task-row{grid-template-columns:minmax(0,1fr) 230px!important}
    }
    @media (max-width:760px){
      .ledger-board .ledger-task-row{
        grid-template-columns:1fr!important;
        grid-template-areas:"main" "status" "actions"!important
      }
      .ledger-top-quick{grid-template-columns:1fr!important}
      .ledger-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }

    /* remove antique/gothic remnants */
    [style*="Georgia"],[style*="Batang"]{font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
    .metric strong,.lanehead h3,.calendar-head h3,.cloud-card h2,.runner-heading h2,.runner-records h3,.runner-message b{
      font-family:Pretendard,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important
    }
    .metrics,.lane,.runner,.live{border-top-style:solid!important}
    .runner{border-radius:16px!important;border-color:#e2e8f0!important;background:#fff!important}
    .runner-heading{background:#fff!important}
    .live{border-radius:16px!important}

    @media(max-width:1380px){
      .ledger-board{grid-template-columns:1fr!important}
      .ledger-board .ledger-task-row{grid-template-columns:minmax(0,1fr) 220px!important}
    }
    @media(max-width:980px){
      .side{width:78px!important;padding:18px 8px!important}
      .main{margin-left:78px!important;width:calc(100% - 78px)!important}
      .brand{font-size:15px!important;padding-left:4px!important;padding-right:4px!important}
      .brand small,.nav-divider{display:none!important}
      .nav button{padding:10px 5px!important;text-align:center!important;font-size:10px!important}
      .ledger-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
    @media(max-width:720px){
      header{height:auto!important;min-height:72px!important;padding:12px 14px!important;gap:8px!important;flex-wrap:wrap!important}
      .wrap{padding:12px!important}
      .workhub-home-hero{padding:18px!important}
      .ledger-top-quick{grid-template-columns:1fr!important}
      .ledger-board .ledger-task-row{
        grid-template-columns:1fr!important;grid-template-areas:"main" "status" "actions"!important
      }
      .ledger-board .ledger-task-actions{justify-content:flex-start!important}
    }
  `;
  const removeLegacyThemeNodes=()=>{
    ['workhub-large-css','workhub-renaissance-css'].forEach(id=>document.getElementById(id)?.remove());
  };
  const keepThemeLast=()=>{
    removeLegacyThemeNodes();
    if(style.parentNode!==document.head || document.head.lastElementChild!==style){
      document.head.appendChild(style);
    }
  };
  document.head.appendChild(style);
  removeLegacyThemeNodes();
  const guard=new MutationObserver(()=>queueMicrotask(keepThemeLast));
  guard.observe(document.head,{childList:true});
  [0,120,300,700,1500,3000].forEach(ms=>window.setTimeout(keepThemeLast,ms));
  window.__workhubOkestroThemeLoaded = true;
  window.__workhubThemeReady = true;
  window.dispatchEvent(new CustomEvent('workhub:theme-ready',{detail:{theme:'okestro'}}));
})();