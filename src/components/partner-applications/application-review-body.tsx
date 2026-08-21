import type { ReactNode } from "react";
import type { ApplicationPersonInput, PartnerApplicationFormPayload } from "@/lib/partner-applications/types";
import {
  DOCUMENT_TYPE_LABEL,
  customerHasContent,
  documentTypeLabel,
  equipmentHasContent,
  engineerProfileHasContent,
  personHasContent
} from "@/lib/partner-applications/admin-display";
import type { ApplicationDocumentType } from "@/lib/partner-applications/types";

type Doc = {
  id?: unknown;
  document_type?: unknown;
  file_name?: unknown;
  is_active?: unknown;
  signed_url?: unknown;
};

function text(value: unknown): string {
  const v = String(value ?? "").trim();
  return v || "미입력";
}

function optionalText(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v || null;
}

function Dl({ items }: { items: Array<{ label: string; value: string | null | undefined; hideEmpty?: boolean }> }) {
  const visible = items.filter((item) => !item.hideEmpty || optionalText(item.value));
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {visible.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-slate-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-900">{optionalText(item.value) ?? "미입력"}</dd>
        </div>
      ))}
    </dl>
  );
}

function PersonRows({
  people,
  extraKeys
}: {
  people: ApplicationPersonInput[];
  extraKeys?: Array<{ key: keyof ApplicationPersonInput; label: string }>;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="py-1.5 pr-3 font-medium">성명</th>
            <th className="py-1.5 pr-3 font-medium">부서</th>
            <th className="py-1.5 pr-3 font-medium">직급</th>
            <th className="py-1.5 pr-3 font-medium">연락처</th>
            <th className="py-1.5 pr-3 font-medium">이메일</th>
            {(extraKeys ?? []).map((col) => (
              <th key={col.label} className="py-1.5 pr-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((person, index) => (
            <tr key={`${person.name ?? "p"}-${index}`} className="border-t border-slate-100">
              <td className="py-2 pr-3">{text(person.name)}</td>
              <td className="py-2 pr-3">{text(person.department)}</td>
              <td className="py-2 pr-3">{text(person.position)}</td>
              <td className="py-2 pr-3">{text(person.phone)}</td>
              <td className="py-2 pr-3">{text(person.email)}</td>
              {(extraKeys ?? []).map((col) => (
                <td key={col.label} className="py-2 pr-3">
                  {text(person[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

export function ApplicationReviewBody({
  form,
  documents
}: {
  form: PartnerApplicationFormPayload;
  documents: Doc[];
}) {
  const company = form.company;
  const contact = form.contact;
  const ceo = form.people.ceo.filter(personHasContent);
  const sales = form.people.sales.filter(personHasContent);
  const engineers = form.people.engineer.filter(personHasContent);
  const customers = form.customers.filter(customerHasContent);
  const equipment = form.equipment.filter(equipmentHasContent);
  const profiles = form.engineer_profiles.filter(engineerProfileHasContent);
  const strategy = optionalText(form.sales_strategy);
  const activeDocs = documents.filter((d) => d.is_active !== false);

  const docOrder: ApplicationDocumentType[] = [
    "business_registration",
    "company_intro",
    "financial",
    "other"
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">신청 내용</h2>

      <Card id="section-company" title="기업 정보">
        <Dl
          items={[
            { label: "기업명", value: company.company_name },
            { label: "사업자등록번호", value: company.business_registration_number },
            { label: "대표자명", value: company.representative_name },
            { label: "설립일", value: company.established_date },
            { label: "주소", value: company.address },
            { label: "임직원 수", value: company.total_employees },
            { label: "엔지니어 수", value: company.total_engineers },
            { label: "오케스트로 전담 영업인원 수", value: company.dedicated_sales_count },
            {
              label: "오케스트로 전담 기술인원 수",
              value: company.dedicated_technical_count,
              hideEmpty: true
            }
          ]}
        />
      </Card>

      <Card id="section-contact" title="신청 담당자">
        <Dl
          items={[
            { label: "성명", value: contact.name },
            { label: "부서", value: contact.department },
            { label: "직급", value: contact.position },
            { label: "휴대폰", value: contact.phone },
            { label: "이메일", value: contact.email },
            { label: "사무실 전화", value: contact.office_phone }
          ]}
        />
      </Card>

      <Card id="section-ceo" title="대표이사">
        {ceo.length ? (
          <PersonRows people={ceo} />
        ) : (
          <p className="mt-2 text-sm text-slate-500">등록된 내용 없음</p>
        )}
      </Card>

      <Card id="section-sales" title="영업 전담인원">
        {sales.length ? (
          <PersonRows people={sales} />
        ) : (
          <p className="mt-2 text-sm text-slate-500">등록된 내용 없음</p>
        )}
      </Card>

      {engineers.length ? (
        <Card id="section-engineer" title="기술 전담인원">
          <PersonRows
            people={engineers}
            extraKeys={[
              { key: "skill_level", label: "숙련도" },
              { key: "main_skills", label: "주요기술" }
            ]}
          />
        </Card>
      ) : null}

      <Card id="section-customers" title="주요 고객 및 영업계획">
        {customers.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">고객명</th>
                  <th className="py-1.5 pr-3 font-medium">제안 현황</th>
                  <th className="py-1.5 pr-3 font-medium">사업 시기</th>
                  <th className="py-1.5 pr-3 font-medium">매출 목표</th>
                  <th className="py-1.5 pr-3 font-medium">비고</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((row, index) => (
                  <tr key={`${row.customer_name ?? "c"}-${index}`} className="border-t border-slate-100">
                    <td className="py-2 pr-3">{optionalText(row.customer_name) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.proposal_status) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.business_timing) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.revenue_target) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.note) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">등록된 내용 없음</p>
        )}
        {strategy ? (
          <div className="mt-4">
            <p className="text-xs text-slate-500">영업 전략</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{strategy}</p>
          </div>
        ) : null}
      </Card>

      {equipment.length ? (
        <Card id="section-equipment" title="장비 현황">
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">장비명</th>
                  <th className="py-1.5 pr-3 font-medium">모델</th>
                  <th className="py-1.5 pr-3 font-medium">수량</th>
                  <th className="py-1.5 pr-3 font-medium">비고</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((row, index) => (
                  <tr key={`${row.equipment_name ?? "e"}-${index}`} className="border-t border-slate-100">
                    <td className="py-2 pr-3">{optionalText(row.equipment_name) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.model) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.quantity) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.note) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {profiles.length ? (
        <Card id="section-engineer-profiles" title="기술인력 프로필">
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">성명</th>
                  <th className="py-1.5 pr-3 font-medium">경력</th>
                  <th className="py-1.5 pr-3 font-medium">주요 기술</th>
                  <th className="py-1.5 pr-3 font-medium">자격</th>
                  <th className="py-1.5 pr-3 font-medium">비고</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((row, index) => (
                  <tr key={`${row.name ?? "eng"}-${index}`} className="border-t border-slate-100">
                    <td className="py-2 pr-3">{optionalText(row.name) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.career_years) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.main_skills) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.certifications) ?? "—"}</td>
                    <td className="py-2 pr-3">{optionalText(row.note) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card id="section-documents" title="첨부서류">
        <ul className="mt-3 space-y-2 text-sm">
          {docOrder.map((type) => {
            const docs = activeDocs.filter((d) => String(d.document_type) === type);
            return (
              <li key={type} className="rounded-lg border border-slate-100 px-3 py-2">
                <p className="text-xs font-medium text-slate-500">{DOCUMENT_TYPE_LABEL[type]}</p>
                {docs.length === 0 ? (
                  <p className="mt-1 text-slate-400">미첨부</p>
                ) : (
                  docs.map((doc) => (
                    <p key={String(doc.id)} className="mt-1 flex flex-wrap items-center gap-2">
                      <span>{String(doc.file_name || documentTypeLabel(type))}</span>
                      {doc.signed_url ? (
                        <>
                          <a
                            className="text-blue-700 underline"
                            href={String(doc.signed_url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            미리보기
                          </a>
                          <a className="text-blue-700 underline" href={String(doc.signed_url)} download>
                            다운로드
                          </a>
                        </>
                      ) : null}
                    </p>
                  ))
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
