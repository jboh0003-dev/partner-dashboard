import assert from "node:assert/strict";
import { correctPhoneEmailSwap } from "../src/lib/contacts/phone-email";
import { mergePartnerOrganizationContacts } from "../src/lib/contacts/organization-merge";
import type { PartnerContact } from "../src/types/partner";

function contact(partial: Partial<PartnerContact> & Pick<PartnerContact, "id" | "name">): PartnerContact {
  return {
    partner_id: "p1",
    department: null,
    position: null,
    role_type: "engineer",
    role_raw: null,
    email: null,
    phone: null,
    is_primary: false,
    is_contract_contact: false,
    source_file: null,
    last_synced_at: null,
    memo: null,
    created_at: "",
    ...partial
  };
}

const swap = correctPhoneEmailSwap("mclee@intruevine.com", "010-3754-4980");
assert.equal(swap.swapped, true);
assert.equal(swap.email, "mclee@intruevine.com");
assert.equal(swap.phone, "010-3754-4980");

const merged = mergePartnerOrganizationContacts([
  contact({
    id: "c1",
    name: "권태민",
    role_type: "engineer",
    phone: "010-1111-2222",
    email: "a@socle.com"
  }),
  contact({
    id: "c2",
    name: "권태민",
    role_raw: "정기교육 참석자",
    source_file: "training_upload"
  }),
  contact({
    id: "c3",
    name: "권태민",
    role_raw: "기술파트너 교육 참석자",
    source_file: "tech_partner_training_upload"
  })
]);

assert.equal(merged.raw_count, 3);
assert.equal(merged.merged.length, 1);
assert.equal(merged.merged[0]!.name, "권태민");
assert.ok(merged.merged[0]!.tags.includes("엔지니어"));
assert.ok(merged.merged[0]!.tags.includes("정기교육 참석자"));
assert.ok(merged.merged[0]!.tags.includes("기술파트너 교육 참석자"));
assert.equal(merged.merged[0]!.has_multiple_sources, true);

console.log("organization-merge tests passed");
