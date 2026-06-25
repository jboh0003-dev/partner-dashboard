import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";

async function createPartner(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const payload = {
    company_name: String(formData.get("company_name") ?? "").trim(),
    business_number: String(formData.get("business_number") ?? "").trim() || null,
    grade: String(formData.get("grade") ?? "silver"),
    status: String(formData.get("status") ?? "active"),
    ceo_name: String(formData.get("ceo_name") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    main_phone: String(formData.get("main_phone") ?? "").trim() || null,
    website: String(formData.get("website") ?? "").trim() || null,
    sales_owner: String(formData.get("sales_owner") ?? "").trim() || null,
    memo: String(formData.get("memo") ?? "").trim() || null
  };

  if (!payload.company_name) {
    throw new Error("파트너사명은 필수입니다.");
  }

  const { data, error } = await supabase.from("partners").insert(payload).select("id").single();

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/dashboard/partners/${data.id}`);
}

export default function NewPartnerPage() {
  return (
    <>
      <PageHeader title="파트너 등록" description="파트너사 기본정보를 신규 등록합니다." />

      <form action={createPartner} className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <Field label="파트너사명" name="company_name" required />
          <Field label="사업자번호" name="business_number" />
          <Field label="대표자" name="ceo_name" />
          <Field label="대표전화" name="main_phone" />
          <Field label="주소" name="address" className="col-span-2" />
          <Field label="웹사이트" name="website" />
          <Field label="영업담당자" name="sales_owner" />

          <div>
            <label className="text-sm font-medium text-slate-700">등급</label>
            <select name="grade" defaultValue="silver" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
              <option value="strategic">Strategic</option>
              <option value="none">미지정</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">상태</label>
            <select name="status" defaultValue="active" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
              <option value="active">활동중</option>
              <option value="inactive">미활동</option>
              <option value="pending">검토중</option>
              <option value="expired">계약종료</option>
              <option value="blocked">관리제외</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="text-sm font-medium text-slate-700">메모</label>
            <textarea name="memo" rows={5} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            저장
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  name,
  required,
  className
}: {
  label: string;
  name: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        name={name}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600"
      />
    </div>
  );
}
