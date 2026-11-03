/**
 * Private Office document preview. The parsing happens entirely in the
 * authenticated user's browser: no public Office viewer and no extra storage.
 * Render values through React (never raw HTML from an uploaded workbook).
 */
export type PreviewCell = {
  text: string;
  colSpan?: number;
  rowSpan?: number;
};
export type PreviewSheet = {
  name: string;
  rows: Array<Array<PreviewCell | null>>;
  truncated: boolean;
};
export type WordBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "table"; rows: string[][] };
export type SlideItem = {
  kind: "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  src?: string;
  fontSize?: number;
  color?: string;
};
export type PreviewSlide = {
  index: number;
  items: SlideItem[];
  background: string;
  width: number;
  height: number;
};
export type OfficePreview =
  | { kind: "excel"; sheets: PreviewSheet[] }
  | { kind: "word"; blocks: WordBlock[]; truncated: boolean }
  | { kind: "presentation"; slides: PreviewSlide[]; truncated: boolean };

const MAX_PREVIEW_BYTES = 35 * 1024 * 1024;
const MAX_SHEET_ROWS = 350;
const MAX_SHEET_COLS = 70;

export async function parseOfficePreview(blob: Blob, ext: string): Promise<OfficePreview> {
  if (blob.size > MAX_PREVIEW_BYTES) {
    throw new Error("이 문서는 브라우저 미리보기 한도(35MB)를 초과합니다. 원본을 다운로드해 확인해 주세요.");
  }
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await blob.arrayBuffer(), {
      type: "array",
      cellDates: true
    });
    const sheets = workbook.SheetNames.map((name): PreviewSheet => {
      const sheet = workbook.Sheets[name];
      if (!sheet || !sheet["!ref"]) return { name, rows: [], truncated: false };
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      const finalRow = Math.min(range.e.r, range.s.r + MAX_SHEET_ROWS - 1);
      const finalCol = Math.min(range.e.c, range.s.c + MAX_SHEET_COLS - 1);
      const displayRange = {
        s: { r: range.s.r, c: range.s.c },
        e: { r: finalRow, c: finalCol }
      };
      const values = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
        header: 1,
        range: displayRange,
        raw: false,
        blankrows: true,
        defval: ""
      }) as Array<Array<string | number | null>>;

      const rows: Array<Array<PreviewCell | null>> = [];
      const visibleCols = finalCol - range.s.c + 1;
      for (let r = 0; r <= finalRow - range.s.r; r += 1) {
        const valuesRow = values[r] ?? [];
        const cells: Array<PreviewCell | null> = [];
        for (let c = 0; c < visibleCols; c += 1) {
          cells.push({ text: String(valuesRow[c] ?? "") });
        }
        rows.push(cells);
      }
      for (const merge of sheet["!merges"] ?? []) {
        const sr = merge.s.r - range.s.r, sc = merge.s.c - range.s.c;
        const er = Math.min(merge.e.r, finalRow) - range.s.r;
        const ec = Math.min(merge.e.c, finalCol) - range.s.c;
        if (sr < 0 || sc < 0 || sr >= rows.length || sc >= visibleCols ||
            er < sr || ec < sc) continue;
        const origin = rows[sr]?.[sc];
        if (origin) {
          origin.rowSpan = er - sr + 1;
          origin.colSpan = ec - sc + 1;
        }
        for (let r = sr; r <= er; r += 1) {
          for (let c = sc; c <= ec; c += 1) {
            if (r !== sr || c !== sc) rows[r]![c] = null;
          }
        }
      }
      return {
        name,
        rows,
        truncated: range.e.r > finalRow || range.e.c > finalCol
      };
    });
    return { kind: "excel", sheets };
  }

  const { default: JSZip } = await import("jszip");
  const archive = await JSZip.loadAsync(blob);
  if (Object.keys(archive.files).length > 2000) {
    throw new Error("압축 내부 항목이 너무 많아 미리보기를 열 수 없습니다.");
  }

  if (ext === "docx") {
    const xml = await archive.file("word/document.xml")?.async("text");
    if (!xml) throw new Error("Word 문서 내용을 읽을 수 없습니다.");
    const doc = parseXml(xml);
    const body = firstDescendant(doc, "body");
    if (!body) throw new Error("Word 본문이 없습니다.");
    const blocks: WordBlock[] = [];
    let truncated = false;
    for (const item of Array.from(body.children)) {
      if (blocks.length >= 400) {
        truncated = true;
        break;
      }
      if (item.localName === "p") {
        const value = textWithin(item);
        if (value.trim()) blocks.push({ kind: "paragraph", text: value });
      }
      if (item.localName === "tbl") {
        const rows = descendants(item, "tr").slice(0, 100).map((tr) =>
          Array.from(tr.children).filter((x) => x.localName === "tc").map((cell) =>
            descendants(cell, "p").map((p) => textWithin(p)).filter(Boolean).join("\n")
          )
        );
        blocks.push({ kind: "table", rows });
      }
    }
    return { kind: "word", blocks, truncated };
  }

  if (ext !== "pptx") throw new Error("지원되지 않는 Office 문서 형식입니다.");
  const presentationXml = await archive.file("ppt/presentation.xml")?.async("text");
  const presentation = presentationXml ? parseXml(presentationXml) : null;
  const size = presentation ? firstDescendant(presentation, "sldSz") : null;
  const width = Number(size?.getAttribute("cx") ?? 12192000);
  const height = Number(size?.getAttribute("cy") ?? 6858000);
  const slideNames = Object.keys(archive.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) =>
      Number(a.match(/slide(\d+)\.xml$/i)?.[1] ?? 0) -
      Number(b.match(/slide(\d+)\.xml$/i)?.[1] ?? 0)
    );
  const slides: PreviewSlide[] = [];
  for (const [index, path] of slideNames.slice(0, 80).entries()) {
    const content = await archive.file(path)?.async("text");
    if (!content) continue;
    const slideXml = parseXml(content);
    const bg = firstDescendant(slideXml, "bg");
    const background = rgbHex(bg) ?? "#ffffff";
    const relsPath = path.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
    const relXmlText = await archive.file(relsPath)?.async("text");
    const rels = new Map<string, string>();
    if (relXmlText) {
      for (const rel of descendants(parseXml(relXmlText), "Relationship")) {
        const id = rel.getAttribute("Id");
        const target = rel.getAttribute("Target");
        if (id && target && !/^https?:/i.test(target)) {
          const resolved = resolveZipPath(path, target);
          if (resolved.startsWith("ppt/media/")) rels.set(id, resolved);
        }
      }
    }
    const items: SlideItem[] = [];
    const slideTree = firstDescendant(slideXml, "spTree");
    for (const el of Array.from(slideTree?.children ?? [])) {
      if (el.localName !== "sp" && el.localName !== "pic") continue;
      const transform = firstDescendant(el, "xfrm");
      const off = transform ? firstDescendant(transform, "off") : null;
      const extEl = transform ? firstDescendant(transform, "ext") : null;
      const x = Number(off?.getAttribute("x") ?? 0);
      const y = Number(off?.getAttribute("y") ?? 0);
      const w = Number(extEl?.getAttribute("cx") ?? 0);
      const h = Number(extEl?.getAttribute("cy") ?? 0);
      const geometry = {
        x: boundPct(x / width * 100),
        y: boundPct(y / height * 100),
        width: boundPct(w / width * 100),
        height: boundPct(h / height * 100)
      };
      if (el.localName === "sp") {
        const paras = descendants(el, "p")
          .map((p) => textWithin(p).trim())
          .filter(Boolean);
        const text = paras.join("\n");
        if (!text) continue;
        const fontElement = firstDescendant(el, "rPr") ?? firstDescendant(el, "defRPr");
        const fontPt = Number(fontElement?.getAttribute("sz") ?? 1800) / 100;
        items.push({
          kind: "text",
          ...geometry,
          text,
          color: rgbHex(el) ?? "#1e293b",
          fontSize: Math.max(10, Math.min(32, fontPt * 0.75))
        });
        continue;
      }
      const blip = firstDescendant(el, "blip");
      const rid = blip?.getAttribute("r:embed") ??
        blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
      const filePath = rid ? rels.get(rid) : undefined;
      const mediaFile = filePath ? archive.file(filePath) : null;
      if (!mediaFile) continue;
      const match = filePath?.match(/\.(png|jpe?g|gif|webp)$/i);
      if (!match) continue;
      const bytes = await mediaFile.async("uint8array");
      if (bytes.byteLength > 8 * 1024 * 1024) continue;
      const mime = match[1].toLowerCase() === "png" ? "image/png" :
        /^jpe?g$/i.test(match[1]) ? "image/jpeg" :
        match[1].toLowerCase() === "gif" ? "image/gif" : "image/webp";
      const base64 = await mediaFile.async("base64");
      items.push({
        kind: "image", ...geometry, src: "data:" + mime + ";base64," + base64
      });
    }
    // Many presentations use one full-page raster, while some use only text.
    if (items.length === 0) {
      const text = descendants(slideXml, "t").map((t) => t.textContent ?? "").join(" ").trim();
      if (text) items.push({
        kind: "text", x: 5, y: 8, width: 90, height: 85, text, fontSize: 17
      });
    }
    slides.push({
      index: index + 1,
      items,
      background,
      width: Number.isFinite(width) && width > 0 ? width : 16,
      height: Number.isFinite(height) && height > 0 ? height : 9
    });
  }
  return { kind: "presentation", slides, truncated: slideNames.length > slides.length };
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Office 파일의 내부 구조가 손상되어 미리보기를 만들 수 없습니다.");
  }
  return doc;
}

function descendants(el: Document | Element, local: string): Element[] {
  return Array.from(el.getElementsByTagNameNS("*", local));
}
function firstDescendant(el: Document | Element, local: string): Element | null {
  return el.getElementsByTagNameNS("*", local).item(0);
}
function textWithin(el: Element): string {
  return descendants(el, "t").map((node) => node.textContent ?? "").join("");
}
function rgbHex(el: Document | Element | null): string | null {
  if (!el) return null;
  const value = firstDescendant(el, "srgbClr")?.getAttribute("val");
  return value && /^[a-f0-9]{6}$/i.test(value) ? "#" + value : null;
}
function boundPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
function resolveZipPath(sourcePath: string, target: string) {
  const parent = sourcePath.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") parent.pop();
    else if (part && part !== ".") parent.push(part);
  }
  return parent.join("/");
}
