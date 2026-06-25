"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { OkePanelShell } from "@/components/search/oke-panel-shell";
import { useOkeDockedPanel, useOkePanel } from "@/components/search/oke-panel-context";
import { OKE_MENU_LABEL, OKE_NAME } from "@/lib/search/oke-branding";

export function PartnerSearchWidget() {
  const { open, fullscreen, openPanel, closePanel, toggleFullscreen } = useOkePanel();
  const docked = useOkeDockedPanel();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (fullscreen) {
        toggleFullscreen();
        return;
      }
      closePanel();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, fullscreen, closePanel, toggleFullscreen]);

  useEffect(() => {
    if (!open || docked) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, docked]);

  return (
    <>
      {open && fullscreen ? (
        <>
          <button
            type="button"
            aria-label="오케 패널 닫기"
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]"
            onClick={closePanel}
          />
          <div className="fixed inset-0 z-50">
            <OkePanelShell className="h-full shadow-2xl" />
          </div>
        </>
      ) : null}

      {open && !fullscreen ? (
        <>
          <button
            type="button"
            aria-label="오케 패널 닫기"
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px] md:hidden"
            onClick={closePanel}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${OKE_NAME} AI 검색`}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[min(100vw,420px)] md:hidden"
          >
            <OkePanelShell className="h-full shadow-2xl" />
          </div>
        </>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => openPanel()}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-slate-900 via-okestro-800 to-okestro-700 px-4 py-3 text-sm font-semibold text-white shadow-elevated ring-2 ring-okestro-200/40 transition hover:from-slate-800 hover:to-okestro-600"
          aria-expanded={open}
          aria-label={`${OKE_MENU_LABEL} 열기`}
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <Sparkles size={16} className="text-blue-100" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span>{OKE_NAME}</span>
            <span className="text-[10px] font-normal text-blue-100/90">AI</span>
          </span>
        </button>
      ) : null}
    </>
  );
}
