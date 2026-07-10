"use client";

import { useRouter } from "next/navigation";

type ContactsLoadErrorProps = {
  title?: string;
  message: string;
};

export function ContactsLoadError({
  title = "담당자 목록을 불러오지 못했습니다",
  message
}: ContactsLoadErrorProps) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-6 text-center">
      <h3 className="text-sm font-semibold text-rose-900">{title}</h3>
      <p className="mt-2 text-sm text-rose-800">{message}</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
      >
        다시 시도
      </button>
    </div>
  );
}
