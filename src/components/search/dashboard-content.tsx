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
      className="flex min-h-screen md:ml-64"
      style={layoutStyle}
    >
      <main className="min-h-screen min-w-0 flex-1">
        <div className="w-full max-w-none px-6 py-6 lg:pr-8">
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
