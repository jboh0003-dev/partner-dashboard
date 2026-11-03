"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Presentation, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { OfficePreview, PreviewSlide, PreviewSheet } from "@/lib/documents/office-preview";

type RenderedPreview =
  | { kind: "pdf"; url: string }
  | { kind: "image"; url: string }
  | OfficePreview;

function responseFilename(response: Response): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* fall through */ }
  }
  return disposition.match(/filename="([^"]+)"/i)?.[1] ?? "파트너 문서";
}

export function PartnerDocumentPreviewClient({ documentId }: { documentId: string }) {
  const [preview, setPreview] = useState<RenderedPreview | null>(null);
  const [fileName, setFileName] = useState("파트너 문서");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    async function load() {
      setLoading(true);
      setError(null);
      setPreview(null);
      try {
        const response = await fetch(
          "/api/partners/documents/" + encodeURIComponent(documentId) + "/preview",
          { cache: "no-store" }
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(body?.message ?? "문서를 불러오지 못했습니다. (HTTP " + response.status + ")");
        }
        const name = responseFilename(response);
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        const contentType = response.headers.get("content-type") ?? "";
        const file = await response.blob();
        if (cancelled) return;

        if (ext === "pdf" || contentType.includes("application/pdf")) {
          objectUrl = URL.createObjectURL(file);
          setPreview({ kind: "pdf", url: objectUrl });
        } else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ||
          contentType.startsWith("image/")) {
          objectUrl = URL.createObjectURL(file);
          setPreview({ kind: "image", url: objectUrl });
        } else if (["xlsx", "xls", "docx", "pptx"].includes(ext)) {
          const { parseOfficePreview } = await import("@/lib/documents/office-preview");
          const result = await parseOfficePreview(file, ext);
          if (cancelled) return;
          setPreview(result);
          setActiveSheet(0);
        } else {
          throw new Error("이 파일 형식은 브라우저 미리보기를 지원하지 않습니다.");
        }
        setFileName(name);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "미리보기를 표시할 수 없습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, refresh]);

  const downloadUrl = "/api/partners/documents/" + encodeURIComponent(documentId) + "/download";
  return (
    <div className="mx-auto max-w-[1480px] space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-0">
          <Link href="/dashboard/documents"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-700">
            <ArrowLeft size={13} /> 문서 목록
          </Link>
          <h1 className="mt-1 truncate text-lg font-bold text-slate-950" title={fileName}>
            {fileName}
          </h1>
          <p className="mt-1 text-xs text-slate-500">보안 문서 미리보기 · 원본 파일은 변경되지 않습니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRefresh((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw size={14} /> 다시 열기
          </button>
          <a href={downloadUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            <Download size={14} /> 원본 다운로드
          </a>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[460px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
          문서를 안전하게 불러오는 중입니다...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-amber-200 bg-white p-8">
          <h2 className="text-base font-bold text-slate-900">미리보기를 표시하지 못했습니다.</h2>
          <p className="mt-2 text-sm text-amber-800">{error}</p>
          <p className="mt-3 text-xs text-slate-500">원본 다운로드는 계속 사용할 수 있습니다.</p>
        </div>
      ) : preview?.kind === "pdf" ? (
        <iframe title={fileName + " PDF 미리보기"} src={preview.url}
          className="h-[calc(100vh-235px)] min-h-[550px] w-full rounded-2xl border border-slate-200 bg-white" />
      ) : preview?.kind === "image" ? (
        <div className="flex min-h-[500px] justify-center rounded-2xl border border-slate-200 bg-slate-100 p-4">
          {/* Blob URL is authenticated and created locally; no remote image optimizer is involved. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={fileName} className="max-h-[calc(100vh-260px)] max-w-full object-contain" />
        </div>
      ) : preview?.kind === "excel" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-700" />
              <h2 className="text-sm font-semibold text-slate-900">Excel 시트 미리보기</h2>
            </div>
            <p className="text-xs text-slate-500">병합 셀과 입력값 표시 · 복잡한 서식은 원본과 다를 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-slate-200 px-2 py-3" role="tablist" aria-label="Excel 시트 선택">
            {preview.sheets.map((sheet, index) => (
              <button key={sheet.name + index} type="button" role="tab"
                aria-selected={activeSheet === index}
                onClick={() => setActiveSheet(index)}
                className={[
                  "max-w-[200px] truncate rounded-lg px-3 py-2 text-xs font-semibold transition",
                  activeSheet === index ? "bg-emerald-700 text-white" : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                ].join(" ")}
                title={sheet.name}>
                {sheet.name}
              </button>
            ))}
          </div>
          {preview.sheets[activeSheet] ? <ExcelSheet sheet={preview.sheets[activeSheet]} /> : (
            <p className="p-6 text-sm text-slate-500">표시할 시트가 없습니다.</p>
          )}
        </div>
      ) : preview?.kind === "presentation" ? (
        <div className="space-y-5">
          <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            PowerPoint 슬라이드의 텍스트와 삽입 이미지를 브라우저에서 표시합니다.
            복잡한 도형·애니메이션·글꼴은 원본과 다를 수 있습니다.
          </p>
          {preview.slides.length ? preview.slides.map((slide) => (
            <PresentationSlide key={slide.index} slide={slide} />
          )) : (
            <p className="rounded-xl bg-white p-6 text-sm text-slate-500">슬라이드 콘텐츠를 읽을 수 없습니다.</p>
          )}
          {preview.truncated ? (
            <p className="text-center text-xs text-amber-700">80장까지만 표시됩니다. 나머지는 원본 파일에서 확인해 주세요.</p>
          ) : null}
        </div>
      ) : preview?.kind === "word" ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <FileText size={18} className="text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Word 본문 미리보기</h2>
            <span className="ml-auto text-xs text-slate-500">일부 이미지·서식은 생략될 수 있습니다.</span>
          </div>
          {preview.blocks.map((block, index) =>
            block.kind === "paragraph" ? (
              <p key={index} className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                {block.text}
              </p>
            ) : (
              <div key={index} className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <tbody>
                    {block.rows.map((row, rIndex) => (
                      <tr key={rIndex}>
                        {row.map((cell, cIndex) => (
                          <td key={cIndex} className="whitespace-pre-wrap border border-slate-200 p-2 text-slate-700">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {preview.truncated ? <p className="text-xs text-amber-700">일부 긴 문서는 생략되었습니다.</p> : null}
        </div>
      ) : (
        <p className="rounded-xl bg-white p-6 text-sm text-slate-500">표시할 문서가 없습니다.</p>
      )}
    </div>
  );
}

function ExcelSheet({ sheet }: { sheet: PreviewSheet }) {
  return (
    <>
      <div className="max-h-[calc(100vh-290px)] min-h-[460px] overflow-auto">
        <table className="w-max min-w-full border-collapse text-left text-xs text-slate-800">
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row" className="sticky left-0 z-10 min-w-12 border border-slate-200 bg-slate-100 px-2 py-2 text-center font-normal tabular-nums text-slate-500">
                  {rowIndex + 1}
                </th>
                {row.map((cell, columnIndex) =>
                  cell ? (
                    <td key={columnIndex} colSpan={cell.colSpan} rowSpan={cell.rowSpan}
                      className={[
                        "max-w-[420px] min-w-[90px] whitespace-pre-wrap break-keep border border-slate-200 px-3 py-2 align-middle",
                        rowIndex === 0 ? "bg-slate-50 font-semibold" : "bg-white"
                      ].join(" ")}
                      title={cell.text}>
                      {cell.text || "\u00a0"}
                    </td>
                  ) : null
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheet.truncated ? (
        <p className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          미리보기는 처음 350행·70열까지 표시합니다. 나머지 내용은 원본 다운로드에서 확인해 주세요.
        </p>
      ) : null}
    </>
  );
}

function PresentationSlide({ slide }: { slide: PreviewSlide }) {
  return (
    <article className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
        <span>슬라이드 {slide.index}</span>
        <Presentation size={14} />
      </div>
      <div className="relative w-full overflow-hidden"
        style={{ background: slide.background, aspectRatio: slide.width + " / " + slide.height }}>
        {slide.items.map((item, index) => (
          <div key={index}
            className="absolute overflow-hidden"
            style={{
              left: item.x + "%",
              top: item.y + "%",
              width: Math.max(0.5, item.width) + "%",
              height: Math.max(1, item.height) + "%"
            }}>
            {item.kind === "image" && item.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.src} alt={"슬라이드 " + slide.index + " 이미지"}
                className="h-full w-full object-contain" />
            ) : (
              <p className="whitespace-pre-wrap break-keep leading-snug"
                style={{
                  color: item.color,
                  fontSize: "clamp(9px, 1.35vw, " + (item.fontSize ?? 16) + "px)"
                }}>
                {item.text}
              </p>
            )}
          </div>
        ))}
        {slide.items.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            텍스트 또는 이미지 요소가 없는 슬라이드입니다.
          </div>
        ) : null}
      </div>
    </article>
  );
}
