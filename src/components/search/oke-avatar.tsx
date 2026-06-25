import { Sparkles } from "lucide-react";

type OkeAvatarProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14"
} as const;

const ICON_SIZE = {
  sm: 16,
  md: 20,
  lg: 24
} as const;

export function OkeAvatar({ size = "md", className = "" }: OkeAvatarProps) {
  return (
    <div
      className={[
        "relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-okestro-800 to-okestro-600 text-white shadow-md ring-1 ring-okestro-200/50",
        SIZE_CLASS[size],
        className
      ].join(" ")}
      aria-hidden
    >
      <Sparkles size={ICON_SIZE[size]} className="text-okestro-100" />
      <span className="absolute -bottom-1 -right-1 rounded-md bg-white px-1 py-0.5 text-[9px] font-bold tracking-wide text-slate-900 shadow-sm ring-1 ring-slate-100">
        OKE
      </span>
    </div>
  );
}
