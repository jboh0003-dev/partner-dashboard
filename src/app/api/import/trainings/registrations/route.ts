import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCompanyName } from "@/lib/partner-match";
import { stripPhoneDigits } from "@/lib/contacts/phone-normalize";

const RowSchema = z.object({
  row_number: z.number().int().positive(),
  source_response_id: z.string().nullable(),
  source_sheet: z.string().min(1),
  company_name: z.string().min(1),
  attendee_name: z.string().min(1),
  attendee_department: z.string().nullable(),
  attendee_position: z.string().nullable(),
  attendee_phone: z.string().nullable(),
  attendee_email: z.string().nullable(),
  training_name: z.string().min(1),
  product: z.string().nullable(),
  start_date: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),
  source_header: z.string().min(1),
  raw_data: z.record(z.string(), z.string())
});

const PayloadSchema = z.object({
  file_name: z.string().min(1),
  rows: z.array(RowSchema).max(5000)
});

type ImportRow = z.infer<typeof RowSchema>;

type PartnerRow = {
  id: string;
  company_name: string;
};

type ContactRow = {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
};

type TrainingRow = {
  id: string;
  training_name: string;
  product: string | null;
  start_date: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function normalizePhone(value: string | null | undefined): string | null {
  const digits = stripPhoneDigits(value ?? "");
  return digits || null;
}

function trainingKey(name: string, product: string | null, startDate: string): string {
  return `${startDate}|${normalizeText(product || name)}`;
}

function sourceKey(row: ImportRow): string {
  const identity =
    normalizeEmail(row.attendee_email) ||
    normalizePhone(row.attendee_phone) ||
    normalizeText(row.attendee_name);

  return [
    row.start_date,
    normalizeText(row.product || row.training_name),
    normalizeText(row.company_name),
    identity,
    normalizeText(row.source_response_id || String(row.row_number))
  ].join("|");
}

function trainingInsert(row: ImportRow, fileName: string) {
  const [year, month] = row.start_date.split("-").map(Number);
  const product = row.product?.trim() || null;
  return {
    training_name: product || row.training_name.trim(),
    training_type: "정기교육",
    product,
    product_name: product,
    training_year: year,
    training_month: month,
    start_date: row.start_date,
    end_date: row.start_date,
    source_file: fileName,
    memo: "MS Forms 교육 신청 DB에서 자동 생성"
  };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status }
    );
  }

  try {
    const payload = PayloadSchema.parse(await request.json());
    const supabase = createAdminClient();

    const [
      partnersResult,
      contactsResult,
      trainingsResult,
      existingRegistrationsResult
    ] = await Promise.all([
      supabase
        .from("partners")
        .select("id, company_name")
        .is("deleted_at", null)
        .or("is_active.is.null,is_active.eq.true")
        .limit(5000),
      supabase
        .from("partner_contacts")
        .select("id, partner_id, name, email, phone, phone_normalized")
        .is("deleted_at", null)
        .eq("is_active", true)
        .limit(10000),
      supabase
        .from("trainings")
        .select("id, training_name, product, start_date")
        .is("deleted_at", null)
        .limit(5000),
      supabase
        .from("training_registrations")
        .select("id, source_key")
        .is("deleted_at", null)
        .limit(10000)
    ]);

    if (partnersResult.error) throw new Error(partnersResult.error.message);
    if (contactsResult.error) throw new Error(contactsResult.error.message);
    if (trainingsResult.error) throw new Error(trainingsResult.error.message);
    if (existingRegistrationsResult.error) {
      throw new Error(existingRegistrationsResult.error.message);
    }

    const partners = (partnersResult.data ?? []) as PartnerRow[];
    const contacts = (contactsResult.data ?? []) as ContactRow[];
    const trainings = (trainingsResult.data ?? []) as TrainingRow[];

    const partnerByName = new Map<string, PartnerRow>();
    for (const partner of partners) {
      const key = normalizeCompanyName(partner.company_name);
      if (key && !partnerByName.has(key)) partnerByName.set(key, partner);
    }

    const contactByEmail = new Map<string, ContactRow>();
    const contactByPhone = new Map<string, ContactRow>();
    const contactsByPartnerName = new Map<string, ContactRow>();

    for (const contact of contacts) {
      const email = normalizeEmail(contact.email);
      if (email && !contactByEmail.has(email)) contactByEmail.set(email, contact);

      const phone = normalizePhone(contact.phone_normalized || contact.phone);
      if (phone && !contactByPhone.has(phone)) contactByPhone.set(phone, contact);

      const key = `${contact.partner_id}|${normalizeText(contact.name)}`;
      if (!contactsByPartnerName.has(key)) contactsByPartnerName.set(key, contact);
    }

    const trainingByKey = new Map<string, TrainingRow>();
    for (const training of trainings) {
      if (!training.start_date) continue;
      trainingByKey.set(
        trainingKey(training.training_name, training.product, training.start_date),
        training
      );
    }

    const existingKeys = new Set(
      (existingRegistrationsResult.data ?? []).map((row) => String(row.source_key))
    );

    let createdRegistrations = 0;
    let updatedRegistrations = 0;
    let createdTrainings = 0;
    let createdContacts = 0;
    let matchedPartners = 0;
    let reviewCount = 0;

    const reviewRows: Array<{
      row_number: number;
      company_name: string;
      attendee_name: string;
      reason: string;
    }> = [];

    for (const row of payload.rows) {
      const partner =
        partnerByName.get(normalizeCompanyName(row.company_name) ?? "") ?? null;
      if (partner) matchedPartners += 1;

      const email = normalizeEmail(row.attendee_email);
      const phone = normalizePhone(row.attendee_phone);

      let contact =
        (email ? contactByEmail.get(email) : undefined) ||
        (phone ? contactByPhone.get(phone) : undefined) ||
        (partner
          ? contactsByPartnerName.get(
              `${partner.id}|${normalizeText(row.attendee_name)}`
            )
          : undefined) ||
        null;

      if (!contact && partner) {
        const { data: created, error } = await supabase
          .from("partner_contacts")
          .insert({
            partner_id: partner.id,
            name: row.attendee_name,
            department: row.attendee_department,
            position: row.attendee_position,
            email: row.attendee_email,
            phone: row.attendee_phone,
            source_file: payload.file_name,
            contact_source: "training_registration",
            is_active: true,
            in_current_full_db: false
          })
          .select("id, partner_id, name, email, phone, phone_normalized")
          .single();

        if (error) throw new Error(error.message);
        contact = created as ContactRow;
        createdContacts += 1;

        const createdEmail = normalizeEmail(contact.email);
        const createdPhone = normalizePhone(contact.phone_normalized || contact.phone);
        if (createdEmail) contactByEmail.set(createdEmail, contact);
        if (createdPhone) contactByPhone.set(createdPhone, contact);
        contactsByPartnerName.set(
          `${contact.partner_id}|${normalizeText(contact.name)}`,
          contact
        );
      }

      const tKey = trainingKey(row.training_name, row.product, row.start_date);
      let training = trainingByKey.get(tKey) ?? null;

      if (!training) {
        const { data: created, error } = await supabase
          .from("trainings")
          .insert(trainingInsert(row, payload.file_name))
          .select("id, training_name, product, start_date")
          .single();
        if (error) throw new Error(error.message);
        training = created as TrainingRow;
        trainingByKey.set(tKey, training);
        createdTrainings += 1;
      }

      const key = sourceKey(row);
      const matchStatus = partner
        ? contact
          ? "matched"
          : "partner_matched"
        : "needs_review";
      const reviewReason = partner
        ? null
        : "회사명을 Partner Connect 파트너 DB와 자동 매칭하지 못했습니다.";

      const registrationPayload = {
        training_id: training.id,
        partner_id: partner?.id ?? null,
        contact_id: contact?.id ?? null,
        company_name_raw: row.company_name,
        attendee_name: row.attendee_name,
        attendee_department: row.attendee_department,
        attendee_position: row.attendee_position,
        attendee_phone: row.attendee_phone,
        attendee_email: row.attendee_email,
        registration_status: "registered",
        source_response_id: row.source_response_id,
        source_sheet: row.source_sheet,
        source_file: payload.file_name,
        source_header: row.source_header,
        source_key: key,
        match_status: matchStatus,
        review_reason: reviewReason,
        raw_data: row.raw_data,
        updated_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabase
        .from("training_registrations")
        .upsert(registrationPayload, { onConflict: "source_key" });

      if (upsertError) throw new Error(upsertError.message);

      if (existingKeys.has(key)) {
        updatedRegistrations += 1;
      } else {
        createdRegistrations += 1;
        existingKeys.add(key);
      }

      if (!partner) {
        reviewCount += 1;
        reviewRows.push({
          row_number: row.row_number,
          company_name: row.company_name,
          attendee_name: row.attendee_name,
          reason: reviewReason ?? "확인 필요"
        });
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        total: payload.rows.length,
        created_registrations: createdRegistrations,
        updated_registrations: updatedRegistrations,
        created_trainings: createdTrainings,
        created_contacts: createdContacts,
        matched_partners: matchedPartners,
        review: reviewCount
      },
      review_rows: reviewRows.slice(0, 100)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "교육 신청 DB 업로드에 실패했습니다."
      },
      { status: 400 }
    );
  }
}
