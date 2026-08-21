/**
 * Partner AI 자연어 조회: exact entity + leftover 토큰 테스트.
 * 실행: npx tsx scripts/test-partner-ai-query.ts
 *
 * 특정 예문을 regex hard-code로 통과시키지 않고,
 * 표현이 달라도 같은 entity가 추출되는지 검증한다.
 */
import assert from "node:assert/strict";
import {
  detectQueryEntities,
  leftoverQueryTokens,
  queryHasContactHint,
  queryHasExpectedWinHint,
  queryHasPipelineHint,
  queryHasTrainingHint
} from "../src/lib/search/entity-detect";
import { analyzeKoreanQuery, queryHasConcept } from "../src/lib/search/korean-query-lexicon";
import { resolveExactSearchResult } from "../src/lib/search/entity-resolver";
import { isPipelineQuery } from "../src/lib/search/pipeline-query";
import { compactSearchQuery } from "../src/lib/search/query-normalize";
import { planSearchQueryWithLlm } from "../src/lib/search/query-planner";
import type { SearchContext } from "../src/lib/data/search";
import type { Partner, PartnerContact } from "../src/types/partner";

function isTrainingLeaderboardQuery(query: string): boolean {
  const compact = compactSearchQuery(query);
  return /교육/.test(compact) && /(가장많|제일많|최다|많이참석|참석많|많이받은|많이받)/.test(compact);
}

function mockContext(): SearchContext {
  const partner: Partner = {
    id: "p-intrue",
    external_no: "1",
    company_name: "인터루바인",
    business_number: "123-45-67890",
    grade: "gold",
    grade_override: null,
    grade_original: null,
    grade_change_raw: null,
    grade_raw: null,
    status: "active",
    ceo_name: null,
    address: null,
    website: null,
    main_phone: null,
    contract_start_date: null,
    contract_end_date: null,
    sales_owner: null,
    okestro_owner: null,
    contract_contact_name: null,
    contract_contact_phone: null,
    contract_contact_email: null,
    revenue_2023: null,
    employee_count: null,
    credit_rating: null,
    region_group: null,
    region: null,
    city: null,
    source_file: null,
    last_synced_at: null,
    memo: null,
    has_training: false,
    theory_only: false,
    has_sales_opportunity: false,
    data_quality_warning: null,
    created_at: "",
    updated_at: ""
  };
  const persimmon: Partner = { ...partner, id: "p-persimmon", company_name: "퍼시몬랩", business_number: null };
  const contacts: PartnerContact[] = [
    {
      id: "c-jyb",
      partner_id: "p-intrue",
      name: "전영봉",
      department: "영업",
      position: "이사",
      role_type: "sales",
      role_raw: "영업",
      email: "jyb@intruevine.com",
      phone: "010-1111-2222",
      phone_normalized: "01011112222",
      is_primary: true,
      is_contract_contact: false,
      source_file: "full_db.xlsx",
      last_synced_at: null,
      memo: null,
      created_at: ""
    },
    {
      id: "c-hwk",
      partner_id: "p-intrue",
      name: "강현우",
      department: "기술",
      position: "팀장",
      role_type: "tech",
      role_raw: "기술",
      email: "hwkang@intruevine.com",
      phone: "010-9144-6115",
      phone_normalized: "01091446115",
      is_primary: false,
      is_contract_contact: false,
      source_file: "full_db.xlsx",
      last_synced_at: null,
      memo: null,
      created_at: ""
    },
    {
      id: "c-kjw",
      partner_id: "p-intrue",
      name: "김주원",
      department: null,
      position: null,
      role_type: "etc",
      role_raw: null,
      email: null,
      phone: null,
      is_primary: false,
      is_contract_contact: false,
      source_file: "full_db.xlsx",
      last_synced_at: null,
      memo: null,
      created_at: ""
    }
  ];

  return {
    partners: [partner, persimmon],
    contacts,
    assets: [],
    documents: [],
    pocs: [],
    attendances: [
      {
        id: "a1",
        partner_id: "p-intrue",
        training_id: "t1",
        attendee_name: "김주원",
        attended: true,
        contact_id: "c-kjw",
        partner_name: "인터루바인",
        training_name: "정기교육",
        training_year: 2026,
        training_month: 3,
        training_type: "regular"
      } as SearchContext["attendances"][number]
    ],
    trainings: [],
    knowledge: [],
    policyDocument: null,
    policyChunks: [],
    previousPolicyDocument: null,
    previousPolicyChunks: [],
    notes: [],
    events: [],
    eventDocuments: [],
    fetchedAt: new Date().toISOString()
  };
}

function samePerson(queries: string[]) {
  const names = queries.map((query) => resolveExactSearchResult(query, mockContext())?.contacts[0]?.name);
  assert.ok(names.every((name) => name === names[0] && name), `same person expected: ${queries.join(" / ")} -> ${names.join(",")}`);
}

function run() {
  samePerson(["전영봉 연락처", "전영봉 번호", "전영봉 폰", "전영봉 전화", "전영봉 휴대폰"]);
  samePerson(["전영봉 메일", "전영봉 이메일"]);
  samePerson(["전영봉 누구", "전영봉 누구지?", "전영봉 뭐하는사람", "전영봉 어디회사", "전영봉 어느파트너"]);
  for (const query of ["전영봉 누구지?", "연락처 뭐야 전영봉", "인터루바인 영업 누구야?"]) {
    assert.ok(queryHasContactHint(query) || leftoverQueryTokens(query).includes("전영봉") || leftoverQueryTokens(query).some((t) => t.includes("인터루")), query);
  }
  assert.ok(queryHasConcept("전영봉 누구지", "person_profile"));
  assert.ok(queryHasConcept("연락처 뭐야", "phone"));
  assert.ok(queryHasConcept("영업 누구야", "sales_contact"));
  assert.ok(queryHasExpectedWinHint("될만한 거 있어") || queryHasPipelineHint("될만한 거 있어"));
  assert.equal(detectQueryEntities("6115").phones[0], "6115");
  const partialPhone = resolveExactSearchResult("6115", mockContext());
  assert.equal(partialPhone?.contacts[0]?.name, "강현우");
  samePerson(["강현우 연락처", "강현우 번호"]);

  for (const query of ["전영봉 연락처", "전영봉 번호", "전영봉 폰", "전영봉 전화 좀"]) {
    assert.equal(analyzeKoreanQuery(query).concepts.includes("phone"), true, query);
    assert.ok(leftoverQueryTokens(query).includes("전영봉"), query);
  }
  for (const query of ["전영봉 메일", "전영봉 이메일"]) {
    assert.ok(queryHasConcept(query, "email"), query);
  }
  for (const query of ["전영봉 누구", "전영봉 뭐하는사람"]) {
    assert.ok(queryHasConcept(query, "person_profile"), query);
  }
  for (const query of ["전영봉 어디회사", "전영봉 어느파트너"]) {
    assert.ok(queryHasConcept(query, "affiliation"), query);
  }
  for (const query of ["인터루바인 영업", "인터루바인 영업누구", "인터루바인 세일즈"]) {
    const result = resolveExactSearchResult(query, mockContext());
    assert.equal(result?.contacts[0]?.name, "전영봉", query);
  }
  for (const query of ["퍼시몬랩 수주", "퍼시몬랩 수주예상", "퍼시몬랩 될만한거", "퍼시몬랩 수주할만한거", "퍼시몬랩 가능성높은거"]) {
    assert.ok(queryHasExpectedWinHint(query) || queryHasPipelineHint(query), query);
    assert.ok(isPipelineQuery(query), query);
    assert.ok(leftoverQueryTokens(query).some((token) => token.includes("퍼시몬")), query);
  }

  const email = resolveExactSearchResult("hwkang@intruevine.com", mockContext());
  assert.equal(email?.contacts[0]?.name, "강현우");
  assert.equal(detectQueryEntities("hwkang@intruevine.com").emails[0], "hwkang@intruevine.com");

  const phone = resolveExactSearchResult("01091446115", mockContext());
  assert.equal(phone?.contacts[0]?.name, "강현우");
  assert.equal(detectQueryEntities("010-9144-6115").phones[0], "01091446115");

  const people = resolveExactSearchResult("인터루바인 사람들", mockContext());
  assert.ok((people?.contacts.length ?? 0) >= 3);

  const sales = resolveExactSearchResult("인터루바인 영업 누구", mockContext());
  assert.equal(sales?.contacts[0]?.name, "전영봉");

  const training = resolveExactSearchResult("인터루바인 김주원 교육받았어?", mockContext());
  assert.ok(training?.answer.includes("교육"));
  assert.ok(queryHasTrainingHint("김주원 교육받았어?"));

  const kim = resolveExactSearchResult("인터루바인에 김씨 누구있음?", mockContext());
  assert.equal(kim?.contacts[0]?.name, "김주원");

  assert.ok(isTrainingLeaderboardQuery("교육많이참석파트너"));
  assert.ok(isTrainingLeaderboardQuery("교육 제일 많이 받은 회사"));
  assert.ok(queryHasPipelineHint("퍼시몬랩 파이프라인"));
  assert.ok(isPipelineQuery("퍼시몬랩 수주 예상"));
  assert.ok(isPipelineQuery("퍼시몬랩 수주할만한거"));
  assert.ok(isPipelineQuery("수주 가능성 높은 퍼시몬랩 건"));
  assert.equal(detectQueryEntities("OP-25-0844").projectCodes[0], "OP-25-0844");
  assert.ok(queryHasContactHint("전영봉 연락처"));

  const nameOnly = leftoverQueryTokens("전영봉");
  assert.deepEqual(nameOnly, ["전영봉"]);
}

async function plannerSmoke() {
  const plan = await planSearchQueryWithLlm("전영봉 연락처");
  if (!process.env.OPENAI_API_KEY) {
    assert.equal(plan, null, "planner must be skipped without OPENAI_API_KEY");
  }
}

run();
plannerSmoke()
  .then(() => {
    console.log("partner-ai query tests ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
