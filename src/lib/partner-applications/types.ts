export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "contracted";

export type PersonSection = "ceo" | "sales" | "engineer" | "contract_contact";

export type ApplicationPersonInput = {
  id?: string;
  section: PersonSection;
  sort_order?: number;
  duty?: string | null;
  department?: string | null;
  name?: string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  skill_level?: string | null;
  main_skills?: string | null;
};

export type ApplicationCustomerInput = {
  id?: string;
  sort_order?: number;
  customer_name?: string | null;
  proposal_status?: string | null;
  business_timing?: string | null;
  revenue_target?: string | null;
  note?: string | null;
};

export type ApplicationEquipmentInput = {
  id?: string;
  sort_order?: number;
  equipment_name?: string | null;
  model?: string | null;
  quantity?: string | null;
  note?: string | null;
};

export type ApplicationEngineerProfileInput = {
  id?: string;
  profile_sheet?: 1 | 2;
  sort_order?: number;
  name?: string | null;
  career_years?: string | null;
  main_skills?: string | null;
  certifications?: string | null;
  note?: string | null;
};

export type ApplicationDocumentType =
  | "business_registration"
  | "company_intro"
  | "financial"
  | "other";

export type PartnerApplicationFormPayload = {
  company: {
    company_name: string;
    business_registration_number: string;
    representative_name: string;
    established_date: string;
    address: string;
    website: string;
    credit_grade: string;
    revenue: string;
    total_employees: string;
    total_engineers: string;
    dedicated_sales_count: string;
    dedicated_technical_count: string;
  };
  contact: {
    name: string;
    position: string;
    department: string;
    phone: string;
    email: string;
    office_phone: string;
  };
  flags: {
    technical_collaboration_requested: boolean;
    platinum_review_requested: boolean;
  };
  people: {
    ceo: ApplicationPersonInput[];
    sales: ApplicationPersonInput[];
    engineer: ApplicationPersonInput[];
  };
  customers: ApplicationCustomerInput[];
  sales_strategy: string;
  equipment: ApplicationEquipmentInput[];
  engineer_profiles: ApplicationEngineerProfileInput[];
  applicant: {
    name: string;
    email: string;
  };
};

export const EMPTY_APPLICATION_FORM: PartnerApplicationFormPayload = {
  company: {
    company_name: "",
    business_registration_number: "",
    representative_name: "",
    established_date: "",
    address: "",
    website: "",
    credit_grade: "",
    revenue: "",
    total_employees: "",
    total_engineers: "",
    dedicated_sales_count: "",
    dedicated_technical_count: ""
  },
  contact: {
    name: "",
    position: "",
    department: "",
    phone: "",
    email: "",
    office_phone: ""
  },
  flags: {
    technical_collaboration_requested: false,
    platinum_review_requested: false
  },
  people: {
    ceo: [{ section: "ceo", name: "", position: "", department: "", phone: "", email: "" }],
    sales: [
      {
        section: "sales",
        duty: "영업",
        name: "",
        position: "",
        department: "",
        phone: "",
        email: ""
      }
    ],
    engineer: [
      {
        section: "engineer",
        duty: "기술",
        name: "",
        position: "",
        department: "",
        phone: "",
        email: "",
        skill_level: "",
        main_skills: ""
      }
    ]
  },
  customers: [
    {
      customer_name: "",
      proposal_status: "",
      business_timing: "",
      revenue_target: ""
    }
  ],
  sales_strategy: "",
  equipment: [],
  engineer_profiles: [],
  applicant: {
    name: "",
    email: ""
  }
};

export type MissingField = {
  section: string;
  field: string;
  label: string;
};

export const APPLICATION_WIZARD_STEPS = [
  { id: "intro", label: "신청 안내", required: false },
  { id: "company", label: "기업현황", required: true },
  { id: "contact", label: "담당자 정보", required: true },
  { id: "people", label: "전담 인원", required: true },
  { id: "customers", label: "주요고객 및 영업계획", required: true },
  { id: "strategy", label: "영업전략", required: false },
  { id: "equipment", label: "장비현황", required: false },
  { id: "engineers", label: "기술인력 프로필", required: false },
  { id: "documents", label: "첨부서류", required: true },
  { id: "review", label: "최종 확인 및 제출", required: true }
] as const;

export type WizardStepId = (typeof APPLICATION_WIZARD_STEPS)[number]["id"];
