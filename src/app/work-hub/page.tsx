"use client";

import { useEffect, useRef } from "react";

const STATUSES = [
  { value: "todo", icon: "○", label: "예정", cls: "todo" },
  { value: "doing", icon: "△", label: "진행", cls: "doing" },
  { value: "done", icon: "✓", label: "완료", cls: "done" },
  { value: "blocked", icon: "!", label: "이슈", cls: "blocked" },
  { value: "failed", icon: "×", label: "못함", cls: "failed" },
] as const;

export default function WorkHubPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = "Work Hub";
    return () => {
      observerRef.current?.disconnect();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function patchFrame() {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    doc.title = "Work Hub";

    const brand = doc.querySelector<HTMLElement>(".brand");
    if (brand) {
      brand.innerHTML = 'Work Hub<small>개인 업무 운영판</small>';
    }

    if (!doc.getElementById("work-hub-status-style")) {
      const style = doc.createElement("style");
      style.id = "work-hub-status-style";
      style.textContent = `
        .wh-statusbar{display:flex;gap:4px;flex-wrap:wrap;align-items:center;width:100%}
        .wh-statusbtn{border:1px solid #e0e5ec;background:#fff;color:#667085;border-radius:7px;padding:5px 7px;font-size:9px;font-weight:800;cursor:pointer;line-height:1;white-space:nowrap;transition:.12s ease}
        .wh-statusbtn:hover{transform:translateY(-1px);border-color:#b8c0ce}
        .wh-statusbtn.todo.active{background:#eef1f5;border-color:#cbd2dc;color:#596273}
        .wh-statusbtn.doing.active{background:#fff6e5;border-color:#efd297;color:#a66c0f}
        .wh-statusbtn.done{font-weight:900}
        .wh-statusbtn.done.active{background:#e9f8f2;border-color:#9edbc6;color:#0c8258}
        .wh-statusbtn.blocked.active{background:#fff2e9;border-color:#efbf9f;color:#b55d23}
        .wh-statusbtn.failed.active{background:#fff0f0;border-color:#efb0b0;color:#bb4040}
        .statusrow>span:first-child{display:none!important}
        .tablehead,.workrow{grid-template-columns:minmax(260px,1fr) 105px 115px 250px 90px!important}
        .statusrow{align-items:center!important}
        .statusrow .wh-statusbar{margin-top:1px}
        .field .wh-statusbar{padding-top:2px}
        #plannerAdd .wh-statusbar{align-self:center}
        @media(max-width:1100px){.tablehead,.workrow{grid-template-columns:minmax(220px,1fr) 100px 110px 235px 80px!important}}
        @media(max-width:620px){.workrow{grid-template-columns:1fr!important}.wh-statusbtn{padding:7px 8px;font-size:10px}.tablehead{display:none!important}}
      `;
      doc.head.appendChild(style);
    }

    const ensureStatusBar = (
      select: HTMLSelectElement,
      allowed = STATUSES.map((s) => s.value),
    ) => {
      select.style.display = "none";
      const key = select.id || select.dataset.statusId || "status";
      let bar = select.nextElementSibling as HTMLElement | null;

      if (!bar || bar.dataset.whFor !== key) {
        bar = doc.createElement("div");
        bar.className = "wh-statusbar";
        bar.dataset.whFor = key;
        select.insertAdjacentElement("afterend", bar);

        STATUSES.filter((s) => allowed.includes(s.value)).forEach((status) => {
          const button = doc.createElement("button");
          button.type = "button";
          button.className = `wh-statusbtn ${status.cls}`;
          button.dataset.value = status.value;
          button.title = status.label;
          button.innerHTML = `<span>${status.icon}</span> ${status.label}`;
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            select.value = status.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            syncStatusBar(select, bar!);
          });
          bar!.appendChild(button);
        });
      }

      syncStatusBar(select, bar);
    };

    const syncStatusBar = (select: HTMLSelectElement, bar: HTMLElement) => {
      bar.querySelectorAll<HTMLButtonElement>(".wh-statusbtn").forEach((button) => {
        button.classList.toggle("active", button.dataset.value === select.value);
      });
    };

    doc.querySelectorAll<HTMLSelectElement>("select[data-status-id]").forEach((select) => {
      ensureStatusBar(select);
    });

    const plannerStatus = doc.querySelector<HTMLSelectElement>("#plannerStatus");
    if (plannerStatus) ensureStatusBar(plannerStatus, ["todo", "doing", "blocked"]);

    const modalStatus = doc.querySelector<HTMLSelectElement>("#taskStatus");
    if (modalStatus) ensureStatusBar(modalStatus);
  }

  function handleLoad() {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    patchFrame();
    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver(() => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => patchFrame(), 0);
    });
    observerRef.current.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  return (
    <iframe
      ref={frameRef}
      src="/dayflow/index.html"
      title="Work Hub"
      onLoad={handleLoad}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
        zIndex: 9999,
        background: "#f5f7fb",
      }}
    />
  );
}
