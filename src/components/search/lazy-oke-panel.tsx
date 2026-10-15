"use client";

import dynamic from "next/dynamic";
import { BrandLoading } from "@/components/common/brand-loading";

// Shared by docked/mobile/fullscreen modes; don't ship chat code on every page load.
export const LazyOkePanel = dynamic(
  () => import("@/components/search/oke-panel-shell").then((module) => module.OkePanelShell),
  { loading: () => <BrandLoading message="Partner Agent를 준비하고 있습니다." /> }
);
