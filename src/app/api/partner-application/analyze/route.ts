import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePartnerApplicationBuffer } from "@/lib/partner-application/parse-application";
import {
  findMatchingPartner,
  type ApplicationRegisterCompany
} from "@/lib/partner-application/register";
import { formatBusinessNumberDisplay } from "@/lib/partner-application/contract-dates";
import { normalizeCompanyName, normalizeBusinessNumber } from "@/lib/partner-match";
import { normalizePersonName } from "@/lib/contacts/person-key";
import { normalizePhoneInput } from "@/lib/contacts/phone-normalize";
import { resolveCompanyName } from "@/lib/search/fuzzy-company";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

function isXlsx(fileName: string, mime: string | null): boolean {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) return true;
  if (mime?.includes("spreadsheet") || mime?.includes("excel")) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "파일이 필요합니다." }, { status: 400 });
    }
    if (!isXlsx(file.name, file.type)) {
      return NextResponse.json(
        { ok: false, message: "Excel(.xlsx) 파일만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, message: "파일 크기는 10MB를 초과할 수 없습니다." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parsePartnerApplicationBuffer(buffer);

    const company: ApplicationRegisterCompany = {
      company_name_db: parsed.company.company_name_db ?? "",
      company_name_contract: parsed.company.company_name_contract ?? "",
      business_number: parsed.company.business_number,
      ceo_name: parsed.company.ceo_name,
      website: parsed.company.website,
      founded_date: parsed.company.founded_date,
      credit_rating: parsed.company.credit_rating,
      address: parsed.company.address,
      revenue: parsed.company.revenue,
      employee_count: parsed.company.employee_count,
      engineer_count: parsed.company.engineer_count,
      dedicated_sales_count: parsed.company.dedicated_sales_count,
      dedicated_engineer_count: parsed.company.dedicated_engineer_count
    };

    const supabase = createAdminClient();
    const exactMatch = await findMatchingPartner(supabase, company);

    const { data: partners } = await supabase
      .from("partners")
      .select(
        "id, company_name, business_number, ceo_name, website, address, credit_rating, revenue_2023, employee_count, grade, contract_start_date, contract_end_date, external_no"
      )
      .is("deleted_at", null)
      .limit(3000);

    const partnerRows = (partners ?? []).map((p) => ({
      id: String(p.id),
      company_name: String(p.company_name)
    }));

    let similar: Array<{ id: string; company_name: string; confidence: number; strategy: string }> =
      [];
    if (!exactMatch && company.company_name_db.trim()) {
      const fuzzy = resolveCompanyName(company.company_name_db, partnerRows);
      if (
        fuzzy.partner &&
        (fuzzy.strategy === "fuzzy" ||
          fuzzy.strategy === "includes" ||
          fuzzy.strategy === "alias" ||
          fuzzy.strategy === "ambiguous" ||
          fuzzy.strategy === "low_confidence")
      ) {
        similar.push({
          id: fuzzy.partner.id,
          company_name: fuzzy.partner.company_name,
          confidence: fuzzy.confidence,
          strategy: fuzzy.strategy
        });
      }
      for (const candidate of fuzzy.candidates ?? []) {
        if (similar.some((s) => s.id === candidate.id)) continue;
        similar.push({
          id: candidate.id,
          company_name: candidate.company_name,
          confidence: candidate.confidence,
          strategy: fuzzy.strategy
        });
      }
      similar = similar.slice(0, 5);
    }

    const matchedPartnerRow = exactMatch
      ? (partners ?? []).find((p) => String(p.id) === exactMatch.id) ?? null
      : null;

    const people = [
      ...(parsed.contract_contact ? [parsed.contract_contact] : []),
      ...parsed.sales_staff,
      ...parsed.engineer_staff
    ];

    const duplicateHints: Array<{
      name: string;
      reason: string;
      sections: string[];
    }> = [];

    // 신청서 내부 중복
    const byName = new Map<string, string[]>();
    for (const person of people) {
      const key = normalizePersonName(person.name);
      const list = byName.get(key) ?? [];
      list.push(person.section);
      byName.set(key, list);
    }
    for (const [key, sections] of byName) {
      if (new Set(sections).size > 1 || sections.length > 1) {
        const name = people.find((p) => normalizePersonName(p.name) === key)?.name ?? key;
        duplicateHints.push({
          name,
          reason: "같은 회사 신청서 내 동일 이름 (역할 병합 예정)",
          sections
        });
      }
    }

    const byEmail = new Map<string, string[]>();
    for (const person of people) {
      const email = person.email?.trim().toLowerCase();
      if (!email) continue;
      const list = byEmail.get(email) ?? [];
      list.push(person.name);
      byEmail.set(email, list);
    }
    for (const [email, names] of byEmail) {
      if (new Set(names.map(normalizePersonName)).size > 1) {
        duplicateHints.push({
          name: names.join(", "),
          reason: `동일 이메일(${email})`,
          sections: []
        });
      }
    }

    // DB 중복 (매칭 파트너 기준)
    if (exactMatch) {
      const { data: contacts } = await supabase
        .from("partner_contacts")
        .select("id, name, email, phone")
        .eq("partner_id", exactMatch.id)
        .is("deleted_at", null)
        .is("merged_into_contact_id", null);

      for (const person of people) {
        const nameKey = normalizePersonName(person.name);
        const email = person.email?.trim().toLowerCase() || null;
        const phone = normalizePhoneInput(person.phone)?.normalized_phone || null;
        const hit = (contacts ?? []).find((c) => {
          if (normalizePersonName(c.name as string) === nameKey) return true;
          if (email && String(c.email ?? "").trim().toLowerCase() === email) return true;
          if (phone) {
            const existing = normalizePhoneInput(c.phone as string | null)?.normalized_phone;
            if (existing && existing === phone) return true;
          }
          return false;
        });
        if (hit) {
          duplicateHints.push({
            name: person.name,
            reason: `기존 담당자와 중복 가능 (${hit.name})`,
            sections: [person.section]
          });
        }
      }
    }

    return NextResponse.json({
      ok: parsed.ok,
      file_name: file.name,
      file_size: file.size,
      parse: {
        ...parsed,
        company: {
          ...parsed.company,
          business_number_display: formatBusinessNumberDisplay(parsed.company.business_number),
          business_number_normalized: normalizeBusinessNumber(parsed.company.business_number),
          company_name_normalized: normalizeCompanyName(parsed.company.company_name_db)
        }
      },
      match: {
        exact: exactMatch,
        similar,
        existing_partner: matchedPartnerRow
      },
      duplicate_hints: duplicateHints
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "신청서 분석 실패"
      },
      { status: 500 }
    );
  }
}
