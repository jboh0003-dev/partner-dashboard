import { BrandLogo } from "@/components/layout/brand-logo";

/** Server-renderable feedback: visible before the page's JavaScript is ready. */
export function BrandLoading({
  message = "화면을 불러오고 있습니다.",
  fullScreen = false
}: {
  message?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-4 rounded-xl bg-white px-6 py-8 ${fullScreen ? "min-h-screen" : "min-h-36"}`}
    >
      <BrandLogo priority className="h-9 w-auto object-contain" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 motion-reduce:animate-none" />
    </div>
  );
}
