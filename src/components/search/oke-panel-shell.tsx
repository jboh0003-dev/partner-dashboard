"use client";

import { Maximize2, Minimize2, X } from "lucide-react";
import { SearchChat } from "@/components/search/search-chat";
import { OkeAvatar } from "@/components/search/oke-avatar";
import { useOkePanel } from "@/components/search/oke-panel-context";
import { OKE_NAME, OKE_SUBTITLE } from "@/lib/search/oke-branding";

type OkePanelShellProps = {
  className?: string;
  onClose?: () => void;
  showFullscreenToggle?: boolean;
};

export function OkePanelShell({
  className = "",
  onClose,
  showFullscreenToggle = true
}: OkePanelShellProps) {
  const { closePanel, toggleFullscreen, fullscreen } = useOkePanel();

  return (
    <aside
      role="complementary"
      aria-label={`${OKE_NAME} AI 검색`}
      className={["ui-oke-panel flex h-full min-h-0 flex-col bg-white", className].join(" ")}
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-white via-okestro-50/40 to-white px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <OkeAvatar size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-950">{OKE_NAME}</h2>
              <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
                AI
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{OKE_SUBTITLE}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showFullscreenToggle ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {fullscreen ? (
                <>
                  <Minimize2 size={14} />
                  축소 보기
                </>
              ) : (
                <>
                  <Maximize2 size={14} />
                  전체 화면
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose ?? closePanel}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <SearchChat variant="panel" />
      </div>
    </aside>
  );
}
