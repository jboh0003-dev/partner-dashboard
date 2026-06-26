import assert from "node:assert/strict";
import {
  buildCopyPayload,
  extractUniqueEmails,
  extractUniquePhones,
  formatCompanyNameEmailTsv,
  type CopyableRow
} from "../src/lib/clipboard/table-copy";

const rows: CopyableRow[] = [
  {
    id: "1",
    companyName: "넥시아스",
    name: "김철수",
    phone: "010-1111-2222",
    email: "aaa@company.com"
  },
  {
    id: "2",
    companyName: "디노텍",
    name: "이영희",
    phone: "010-3333-4444",
    email: "bbb@company.com"
  },
  {
    id: "3",
    companyName: "넥시아스",
    name: "박중복",
    phone: "010-1111-2222",
    email: "aaa@company.com"
  },
  {
    id: "4",
    companyName: "테스트",
    name: "빈이메일",
    phone: "010-0000-0000",
    email: null
  }
];

assert.deepEqual(extractUniqueEmails(rows), ["aaa@company.com", "bbb@company.com"]);
assert.deepEqual(extractUniquePhones(rows.filter((r) => r.email)), [
  "010-1111-2222",
  "010-3333-4444"
]);

const emails = buildCopyPayload("emails", rows);
assert.ok(emails);
assert.equal(emails.count, 2);
assert.equal(emails.text, "aaa@company.com; bbb@company.com");

const phones = buildCopyPayload("phones", rows.filter((r) => r.id !== "4"));
assert.ok(phones);
assert.equal(phones.text, "010-1111-2222\n010-3333-4444");

const tsv = formatCompanyNameEmailTsv(rows);
assert.match(tsv, /넥시아스\t김철수\taaa@company.com/);
assert.equal(tsv.split("\n").length, 3);

console.log("table-copy tests passed");
