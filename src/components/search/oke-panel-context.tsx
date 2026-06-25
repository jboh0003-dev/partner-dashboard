"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export const DEFAULT_OKE_PANEL_WIDTH = 420;

type OkePanelContextValue = {
  open: boolean;
  fullscreen: boolean;
  panelWidth: number;
  openPanel: (options?: { fullscreen?: boolean }) => void;
  closePanel: () => void;
  toggleFullscreen: () => void;
  setPanelWidth: (width: number) => void;
};

const OkePanelContext = createContext<OkePanelContextValue | null>(null);

export function OkePanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelWidth, setPanelWidthState] = useState(DEFAULT_OKE_PANEL_WIDTH);

  const openPanel = useCallback((options?: { fullscreen?: boolean }) => {
    setOpen(true);
    setFullscreen(options?.fullscreen ?? false);
  }, []);

  const closePanel = useCallback(() => {
    setFullscreen(false);
    setOpen(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((current) => !current);
  }, []);

  const setPanelWidth = useCallback((width: number) => {
    const next = Number.isFinite(width) ? Math.max(320, Math.min(width, 720)) : DEFAULT_OKE_PANEL_WIDTH;
    setPanelWidthState(next);
  }, []);

  const value = useMemo(
    () => ({
      open,
      fullscreen,
      panelWidth,
      openPanel,
      closePanel,
      toggleFullscreen,
      setPanelWidth
    }),
    [open, fullscreen, panelWidth, openPanel, closePanel, toggleFullscreen, setPanelWidth]
  );

  return <OkePanelContext.Provider value={value}>{children}</OkePanelContext.Provider>;
}

export function useOkePanel() {
  const context = useContext(OkePanelContext);
  if (!context) {
    throw new Error("useOkePanel must be used within OkePanelProvider");
  }
  return context;
}

/** md 이상에서 본문 옆에 도킹되는 패널 모드 */
export function useOkeDockedPanel() {
  const { open, fullscreen } = useOkePanel();
  return open && !fullscreen;
}
