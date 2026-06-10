/**
 * Canonical Management Services Agreement (MSA) template for MD Board Coverage.
 *
 * This module is dependency-free pure ESM so it can be imported by BOTH the
 * Vite frontend (to render the HTML review/sign UI) and the Node backend (to
 * lay the same agreement out into the signed PDF via pdf-lib). Keep it free of
 * JSX, browser APIs, and Node APIs so it loads in either environment.
 *
 * Dynamic tokens come from the signing provider's profile + the selected
 * service. Everything about the doctor / Practice-Owner side is fixed.
 */

/** Fixed Practice-Owner (Medical Director) signatory shown on the right side. */
export const PRACTICE_OWNER = {
  name: "Dr. James Otis Hill, II",
  title: "Manager / Practice Owner",
  entity: "(PHH) LLC",
  // Matches the approved signature-page design (screenshot 3).
  entityType: "a Florida professional limited liability company",
  address: "4818 W. S Hwy 90, Suite 100, Lake City, Florida",
  // NOTE: the source text contradicts itself on the MD fee ($500 in 1.4 vs $0
  // in Article 4 / Exhibit A). Rendered as-pasted per product decision.
  medicalDirectorFee: "$500",
};

/** Format a date input into the "June 10, 2026" style used across the contract. */
export function formatEffectiveDate(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Resolve the dynamic token values, falling back to the literal placeholder so
 * an incomplete profile still produces a readable (if un-personalized) draft.
 */
export function buildMdAgreementValues({
  providerName = "",
  practiceName = "",
  state = "",
  address = "",
  serviceName = "",
  effectiveDate = null,
} = {}) {
  const name = String(providerName || "").trim();
  const pllc = String(practiceName || "").trim();
  return {
    effectiveDate: formatEffectiveDate(effectiveDate) || "(DATE)",
    providerName: name || "(PROVIDER NAME)",
    providerLlc: pllc || "(PROVIDER LLC)",
    state: String(state || "").trim() || "(STATE)",
    address: String(address || "").trim() || "(PROVIDER ADDRESS)",
    serviceName: String(serviceName || "").trim() || "Test",
    phh: "(PHH)",
  };
}

/** Build agreement token context from an auth `me` object or provider profile row. */
export function buildAgreementContextFromProfile(profile = {}) {
  const cityStateZip = [
    String(profile.city || "").trim(),
    [String(profile.state || "").trim(), String(profile.zip || "").trim()]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const address = [
    String(profile.address_line1 || profile.address || "").trim(),
    String(profile.address_line2 || "").trim(),
    cityStateZip,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    providerName: String(profile.full_name || profile.providerName || "").trim(),
    practiceName: String(profile.practice_name || profile.practiceName || "").trim(),
    state: String(profile.state || "").trim(),
    address,
  };
}

/** Prefer the first non-empty value for each agreement field. */
export function mergeAgreementContext(...sources) {
  const merged = { providerName: "", practiceName: "", state: "", address: "" };
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const key of Object.keys(merged)) {
      const value = String(source[key] || "").trim();
      if (!merged[key] && value) merged[key] = value;
    }
  }
  return merged;
}

/**
 * Sentinel wrapping dynamic (filled-in) values inside block text so renderers
 * can bold them. Use `parseAgreementSegments` to split a block's text into
 * `{ text, dynamic }` runs.
 */
export const DYNAMIC_MARK = "\u0001";

/** Wrap a value so it is rendered bold as a dynamic field. */
function m(value) {
  return `${DYNAMIC_MARK}${value}${DYNAMIC_MARK}`;
}

/** Split marked block text into `{ text, dynamic }` segments. */
export function parseAgreementSegments(text) {
  return String(text || "")
    .split(DYNAMIC_MARK)
    .map((part, i) => ({ text: part, dynamic: i % 2 === 1 }))
    .filter((seg) => seg.text !== "");
}

const DR_HILL = "Dr. James Otis Hill, II";

/**
 * Build the ordered list of renderable agreement blocks with all tokens filled.
 * Dynamic values are wrapped in DYNAMIC_MARK so they can be bolded by renderers.
 *
 * Block shapes:
 *   { type: "title",   text }
 *   { type: "heading", text }
 *   { type: "clause",  label, text }
 *   { type: "p",       text, caps? }
 */
export function buildMdAgreementBlocks(values) {
  const v = values || buildMdAgreementValues();
  return [
    { type: "title", text: "Management Services Agreement" },
    {
      type: "p",
      text:
        `THIS MANAGEMENT SERVICES AGREEMENT ("Agreement") dated as of ${m(v.effectiveDate)} ` +
        `("Effective Date") is made and entered into by and between ${m(v.providerName)}, a ${m(v.state)} PSC ` +
        `("Manager") (${m(v.providerLlc)}), a FL based professional limited liability company (the "Practice"), ` +
        `and ${m(DR_HILL)}, a resident of Florida ("Practice Owner"). Manager, the Practice, and ` +
        `Practice Owner are each referred to as a "Party" and collectively as the "Parties."`,
    },

    { type: "heading", text: "Recitals:" },
    {
      type: "p",
      text:
        `Practice was formed for the purpose of providing professional functional health services and related ` +
        `services (collectively, "medical services"), including ${m(v.serviceName)}.`,
    },
    {
      type: "p",
      text:
        "Practice provides professional services through health professionals who are licensed to practice in the " +
        "applicable jurisdiction and trained to provide functional health services.",
    },
    {
      type: "p",
      text:
        'Manager is the owner of valuable intellectual property and trademarks ("IP") described on Exhibit D that ' +
        "will be useful to Practice in the branding development and ongoing expansion of its business operations. " +
        "Manager is willing to license IP to Practice, subject to the terms and conditions of this Agreement.",
    },
    {
      type: "p",
      text:
        "The Practice desires to engage Manager to provide to the Practice certain administrative, management and " +
        "other business and support services as are necessary for the Practice to provide their professional " +
        "services upon the terms and conditions set forth herein.",
    },
    {
      type: "p",
      text:
        "NOW, THEREFORE, in consideration of the premises and the mutual covenants and agreements herein " +
        "contained, and intending to be legally bound hereby, the Parties hereby agree as follows:",
    },

    { type: "heading", text: "Article 1 — Responsibilities of Manager" },
    {
      type: "clause",
      label: "1.1 No Control Over Healthcare or Professional Matters.",
      text:
        "Notwithstanding any provision in this Agreement to the contrary, the Parties agree and acknowledge that " +
        "Manager and its employees will not provide or otherwise engage in any activity which constitutes the " +
        "unauthorized practice of medicine or functional health services as defined by all applicable state laws. " +
        "Nothing contained in this Agreement will be construed to permit Manager to engage in the practice of " +
        "medicine or functional health services, it being the sole intention of the Parties that the services to be " +
        "rendered to the Practice by Manager are solely for the purpose of providing non-healthcare management and " +
        "administrative services to the Practice so as to enable the Practice to devote its time and resources to " +
        "the professional conduct of its practice and the provision of functional health services to its customers " +
        "and not to administration or practice management.",
    },
    {
      type: "clause",
      label: "1.2 Management and Administrative Services.",
      text:
        "The Practice hereby engages Manager to serve as the Practice's sole and exclusive agent for the management " +
        "and administration of the business and administrative functions, affairs and non-healthcare services " +
        "contemplated under this Agreement. Such management and administrative services will include, but not be " +
        "limited to: General Administrative Services, Contract Administration, Accounting, Hardware and Software, " +
        "Legal Services, Administrative Personnel, Personnel Recruiting and Training, Human Resources, Equipment " +
        "Security and Maintenance, Insurance, Billing and Collection, and Contract Negotiations.",
    },
    {
      type: "clause",
      label: "1.3 Attorney-In-Fact.",
      text:
        "In connection with the administrative, management, and other business and support services, the Practice " +
        "hereby grants to Manager a limited special power of attorney and appoints Manager as the Practice's true " +
        "and lawful agent and attorney-in-fact for the specific purposes of billing, collections, and account " +
        "management as set forth in the full Agreement.",
    },
    {
      type: "clause",
      label: "1.4 Practice Account.",
      text:
        "Manager will be given access to the Practice's bank accounts as needed to perform its duties outlined " +
        "herein. For each month during the Term, the Manager is authorized to apply and disburse all revenue and " +
        "collections for the month deposited in the Practice Account, in the following order: costs of " +
        `products/goods/supplies; wages, compensation, benefits and taxes; payment to ${m(DR_HILL)} of ` +
        "the fixed monthly medical director fee of $500 (no later than the 5th of the following month); initial " +
        "consultation or GFE costs; other operating expenses; unpaid fees owed to Manager; and remaining revenue " +
        "to the Practice.",
    },
    {
      type: "clause",
      label: "1.5 Disclaimers.",
      caps: true,
      text:
        "MANAGER MAKES NO EXPRESS OR IMPLIED WARRANTIES OR REPRESENTATIONS THAT THE SERVICES PROVIDED BY MANAGER " +
        "WILL RESULT IN ANY PARTICULAR AMOUNT OR LEVEL OF SERVICES OR INCOME TO PRACTICE.",
    },

    { type: "heading", text: "Article 2 — Responsibilities of the Practice" },
    {
      type: "p",
      text:
        `The Practice will be solely and exclusively in control of all aspects of the delivery of functional health ` +
        `services, including ${m(v.serviceName)}. All professional healthcare services will be the responsibility of ` +
        `the Practice. The Practice will assure that all personnel are licensed, qualified and permitted to perform ` +
        `healthcare services without restriction in each applicable jurisdiction.`,
    },

    { type: "heading", text: "Article 3 — Covenants" },
    {
      type: "p",
      text:
        "Manager and the Practice will comply with the requirements of all statutes, ordinances, laws, rules, " +
        "regulations and orders of any governmental or regulatory body having jurisdiction respecting the provision " +
        `of professional services by the Practice. This Agreement is governed by and will be construed under the ` +
        `laws of the State of ${m(v.state)}.`,
    },

    { type: "heading", text: "Article 4 — Management Fees and Costs" },
    {
      type: "p",
      text:
        "Outside of the Medical Director fee of $0 per month, which is outlined in this document, there is no " +
        "additional compensation for services covered under this agreement. In addition, the Practice will " +
        "reimburse Manager for all reasonable out-of-pocket costs and expenses incurred by Manager, directly and " +
        "primarily related to, or in furtherance of, its performance of its services under the Agreement.",
    },

    { type: "heading", text: "Article 5 — Term and Termination" },
    {
      type: "p",
      text:
        "Unless sooner terminated, the term will remain in effect for one year from the Effective Date and will " +
        "automatically renew for additional one-year periods. Either Party may give notice of non-renewal not less " +
        "than sixty (60) days before the expiration of any Term. Either Party may terminate this Agreement by " +
        "delivering not less than sixty (60) days' prior written notice of termination to the other Party.",
    },

    { type: "heading", text: "Article 6 — Other Provisions" },
    {
      type: "p",
      text:
        `This Agreement is governed by the laws of the State of ${m(v.state)}. The Parties are independent ` +
        "contractors. No amendment will be binding unless in writing and executed by duly authorized " +
        "representatives. THE PARTIES EACH HEREBY WAIVE THEIR RESPECTIVE RIGHTS TO A JURY TRIAL OF ANY CLAIM OR " +
        "CAUSE OF ACTION BASED UPON OR ARISING OUT OF THIS AGREEMENT.",
    },

    { type: "heading", text: "Notice Addresses" },
    { type: "p", text: `Manager: ${m(v.providerName)}` },
    { type: "p", text: `Manager Address: ${m(v.address)}` },
    {
      type: "p",
      text: `Practice Owner: ${m(DR_HILL)} — 4818 W. S Hwy 90, Suite 100, Lake City, Florida`,
    },

    { type: "heading", text: 'Exhibit "A" — Management Fees' },
    {
      type: "p",
      text:
        "Outside of the Medical Director fee of $0 per month, there is no additional compensation for services " +
        "covered under this agreement. The Practice will reimburse Manager for all reasonable out-of-pocket costs " +
        "and expenses incurred in performance of services under the Agreement.",
    },

    { type: "heading", text: "IP License Agreement" },
    {
      type: "p",
      text:
        `This IP License Agreement, effective as of ${m(v.effectiveDate)}, is made between ${m(v.phh)}, PLLC ("Practice") ` +
        `and ${m(v.providerLlc)} ("Manager"). Manager hereby grants a nonexclusive, terminable, royalty-bearing right ` +
        `and license to Practice to use the IP in and for the provision of ${m(v.serviceName)} services at the leased ` +
        `premises of the Practice initially located at ${m(v.address)}. Practice is not permitted to sublicense the ` +
        "IP. All intellectual property created or used under this Agreement remains the property of Manager.",
    },
  ];
}

/**
 * Two-column signature page model. The provider's drawn signature goes in the
 * left (Manager) block; Dr. Hill's default signature image goes in the right
 * (Practice / Practice Owner) block.
 */
export function buildMdSignatureBlocks(values) {
  const v = values || buildMdAgreementValues();
  return {
    intro: `IN WITNESS WHEREOF, the Parties have executed this Agreement as of ${m(v.effectiveDate)}.`,
    left: {
      role: "Manager",
      entity: v.providerLlc,
      entityType: `a ${v.state} limited liability company`,
      name: v.providerName,
      title: "Manager",
    },
    right: {
      role: "The Practice / Practice Owner",
      entity: PRACTICE_OWNER.entity,
      entityType: PRACTICE_OWNER.entityType,
      name: PRACTICE_OWNER.name,
      title: PRACTICE_OWNER.title,
    },
  };
}
