"use client";

import type { CSSProperties, ReactNode } from "react";
import { OkePanelShell } from "@/components/search/oke-panel-shell";
import { useOkeDockedPanel, useOkePanel } from "@/components/search/oke-panel-context";

export function DashboardContent({ children }: { children: ReactNode }) {
  const { open, panelWidth } = useOkePanel();
  const docked = useOkeDockedPanel();

  const layoutStyle = {
    "--oke-panel-width": `${panelWidth}px`
  } as CSSProperties;

  return (
    <div
      className="ml-64 flex min-h-screen transition-[gap] duration-200"
      style={layoutStyle}
    >
      <main className="min-h-screen min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1680px] px-6 py-7 lg:px-8 xl:px-10 2xl:py-9">
          {children}
        </div>
      </main>

      {open && docked ? (
        <div
          className="hidden h-screen shrink-0 md:block"
          style={{ width: "var(--oke-panel-width)" }}
        >
          <div className="sticky top-0 h-screen">
            <OkePanelShell className="h-full border-l shadow-none" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
