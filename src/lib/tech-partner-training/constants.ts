export const TECH_PARTNER_TRAINING_SESSION = {
  training_name: "2026년 상반기 기술파트너 교육",
  training_type: "기술파트너 교육",
  training_level: "정기 기술교육",
  product: "CONTRABASS",
  start_date: "2026-05-20",
  end_date: "2026-06-19",
  exam_date: "2026-06-19",
  training_year: 2026,
  training_month: 6,
  exam_time: "10:00 ~ 11:45",
  poc_deadline: "2026-06-22T18:00:00+09:00",
  review_date: "2026-06-26",
  total_training_days: 17,
  description:
    "신규 플래티넘/기술파트너 대상 CONTRABASS 기반기술, 설치/구성, 운영관리, Troubleshooting, Legato, PoC 수행 준비 교육",
  curriculum: [
    { date: "2026-05-20", topic: "OT, OpenStack, Ceph" },
    { date: "2026-05-21", topic: "K8s, CONTRABASS 소개 및 기능" },
    { date: "2026-05-22", topic: "CONTRABASS 소개 및 기능" },
    { date: "2026-05-26", topic: "Crescendo Tutorial" },
    { date: "2026-05-27", topic: "CONTRABASS Engine & MGMT 설치/구성" },
    { date: "2026-06-08", topic: "CONTRABASS 설치 최종확인" },
    { date: "2026-06-09", topic: "CONTRABASS 운영 및 관리, 점검, 백업, 기동/중지" },
    { date: "2026-06-10", topic: "Trouble Shooting" },
    { date: "2026-06-12", topic: "PoC 계획 및 사전준비" },
    { date: "2026-06-15", topic: "Legato 설치/구성 및 Migration" },
    { date: "2026-06-17", topic: "Contrabass PoC 교육" },
    { date: "2026-06-19", topic: "평가 및 마무리" }
  ]
} as const;

export const TECH_PARTNER_ROSTER_DATES = [
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  "2026-05-26",
  "2026-05-27",
  "2026-05-28",
  "2026-05-29",
  "2026-06-08",
  "2026-06-09",
  "2026-06-10",
  "2026-06-11",
  "2026-06-12",
  "2026-06-15",
  "2026-06-16",
  "2026-06-17",
  "2026-06-18",
  "2026-06-19"
] as const;

export type TechPartnerExamStatus = "응시" | "미응시" | "결과없음" | "매칭검토";

export type TechPartnerEducationStatus =
  | "attended"
  | "partial_attended"
  | "no_show"
  | "result_only"
  | "attendance_not_found";

export const TECH_PARTNER_EXAM_FILE_HINT = "2026_상반기_기술파트너_이론평가_시험결과";
export const TECH_PARTNER_ROSTER_FILE_HINT = "기술파트너교육";
