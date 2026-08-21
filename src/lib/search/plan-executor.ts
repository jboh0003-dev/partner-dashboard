import type { SearchContext } from "@/lib/data/search";
import {
  buildContactSearchResult,
  findContactsByEmail,
  findContactsByPersonName,
  findContactsByPhone,
  findContactsBySurnamePrefix,
  appendTrainingForPerson
} from "@/lib/search/entity-resolver";
import { resolveCompanyName } from "@/lib/search/fuzzy-company";
import { handlePipelineLookup } from "@/lib/search/pipeline-lookup-handler";
import { lookupOpportunityByProjectCode } from "@/lib/search/pipeline-project-lookup";
import type { SearchPlan } from "@/lib/search/query-planner";
import type { ParsedSearchQuery, SearchIntent, SearchResult } from "@/lib/search/types";
import { isCanonicalContact } from "@/lib/contacts/person-key";

function emptyParsed(query: string, intent: SearchIntent, company: string | null): ParsedSearchQuery {
  return {
    raw: query,
    intent,
    companyCandidate: company,
    requiresPartner: Boolean(company),
    grade: null,
    months: [],
    attendedTags: [],
    notAttendedTags: [],
    documentTypeFilter: null,
    requiredDocumentTypes: [],
    contractYear: null,
    contractMonth: null,
    requiresAssets: false,
    knowledgeCategory: null,
    eventYear: null
  };
}

export async function executeStructuredPlan(
  query: string,
  plan: SearchPlan,
  context: SearchContext
): Promise<SearchResult | null> {
  if (plan.entities.email) {
    return buildContactSearchResult(findContactsByEmail(plan.entities.email, context), context);
  }
  if (plan.entities.phone) {
    return buildContactSearchResult(findContactsByPhone(plan.entities.phone, context), context);
  }
  if (plan.entities.project_code) {
    return lookupOpportunityByProjectCode(plan.entities.project_code);
  }

  const companyMatch = plan.entities.company
    ? resolveCompanyName(plan.entities.company, context.partners)
    : { partner: null, strategy: "none" as const, confidence: 0, candidates: [] };
  const partnerId = companyMatch.partner?.id ?? null;

  if (plan.entities.person || plan.filters.surname || plan.intent === "contact_lookup") {
    let hits = plan.entities.person
      ? findContactsByPersonName(plan.entities.person, context, partnerId)
      : plan.filters.surname
        ? findContactsBySurnamePrefix(plan.filters.surname, context, partnerId)
        : partnerId
          ? context.contacts.filter(
              (contact) => isCanonicalContact(contact) && contact.partner_id === partnerId
            )
          : [];
    if (plan.filters.sales_role) {
      hits = hits.filter(
        (hit) => hit.role_type === "sales" || (hit.role_raw ?? "").includes("영업")
      );
    }
    if (plan.filters.engineer_role) {
      hits = hits.filter(
        (hit) =>
          hit.role_type === "engineer" ||
          hit.role_type === "tech" ||
          (hit.role_raw ?? "").includes("기술")
      );
    }
    if (hits.length > 0 || plan.intent === "contact_lookup" || plan.intent === "training_lookup") {
      let result = buildContactSearchResult(hits, context, {
        ambiguousName: hits.length > 1 ? plan.entities.person ?? undefined : undefined,
        query
      });
      if (plan.intent === "training_lookup" || plan.extra_intents?.includes("training_lookup")) {
        result = appendTrainingForPerson(result, hits, context);
      }
      return result;
    }
  }

  if (plan.intent === "pipeline_lookup") {
    return handlePipelineLookup(
      emptyParsed(
        plan.filters.expected_win ? `${query} 수주 예상` : query,
        "pipeline_lookup",
        plan.entities.company
      ),
      partnerId,
      companyMatch.partner?.company_name ?? null
    );
  }

  return null;
}
