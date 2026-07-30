# Partner application Excel templates

- `partner-application-2026.xlsx` — fill template used by Excel download.
- Generated from the SPIS fixture layout for sheets `0`/`1`, plus sheets `2`–`5` matching the 2026 v7 sheet names.
- **Do not edit values in place during runtime.** The server clones the file in memory (`exceljs`) and fills cells defined in `src/lib/partner-applications/excel-mapping.ts`.

When the official blank file  
`2026년 오케스트로 파트너 신청서_v7 (파트너명 기재).xlsx`  
is available, replace `partner-application-2026.xlsx` with that file and adjust cell addresses in `excel-mapping.ts` if needed.

Regenerate scaffold template:

```bash
node scripts/generate-partner-application-template.js
```
