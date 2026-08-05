# Korean fonts for Platinum agreement PDF

PDF generation embeds a Korean font via `pdf-lib` + `fontkit`.

Preferred (commit this file):

- `NotoSansKR-Regular.ttf` — Noto Sans KR (OFL), TTF. Subsetting works reliably for Hangul.

Fallbacks:

- `NotoSansKR-Regular.otf` — avoid as primary; OTF subsetting via fontkit can corrupt CFF glyphs (dots / missing Hangul).
- `C:\Windows\Fonts\malgun.ttf` — local Windows only (not bundled).

Do not commit Microsoft `malgun.ttf`.
