export const CATEGORIES = [
  "injectables",
  "fillers",
  "devices",
  "skincare",
  "consumables",
  "prp",
  "laser",
  "body_contouring",
  "other",
];

export const CATEGORY_LABELS = {
  injectables: "Injectables",
  fillers: "Fillers & Dermal",
  devices: "Devices & Equipment",
  skincare: "Skincare & Retail",
  consumables: "Consumables",
  prp: "PRP & Regenerative",
  laser: "Laser & Energy",
  body_contouring: "Body Contouring",
  other: "Other",
};

export const PRICE_TIERS = [
  { value: "low", label: "💲 Low (entry)" },
  { value: "mid", label: "💲💲 Mid (standard)" },
  { value: "premium", label: "💲💲💲 Premium" },
  { value: "luxury", label: "💲💲💲💲 Luxury" },
];

export const PRICE_TIER_LABELS = Object.fromEntries(
  PRICE_TIERS.map((t) => [t.value, t.label])
);

export const FIELD_INPUT_TYPES = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

export const EMPTY_SUPPLIER = {
  name: "",
  category: "injectables",
  description: "",
  logo_url: "",
  cover_image_url: "",
  website_url: "",
  products: [],
  benefits: [],
  fda_approved_us_products: false,

  sales_headline: "",
  promo_badge: "",
  sales_pitch: "",
  social_proof: "",
  selling_points: [],
  pricing_highlights: [],
  roi_stats: [],

  standalone_pricing_note: "",
  standalone_access: [],
  novi_pricing_note: "",
  novi_access: [],

  training_approved: false,
  is_featured: false,
  price_tier: "mid",
  sort_order: 0,

  account_rep_name: "",
  account_rep_email: "",
  jotform_application_url: "",

  uses_network_tiers: false,
  network_tiers: [],

  custom_fields: [],
  required_fields: [],
  required_service_type_ids: [],

  min_order_amount: "",
  ships_to_states: "",
  is_active: true,
};

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

export const EMPTY_NETWORK_TIER = {
  name: "",
  states: "",
  min_order_amount: "",
  contract_url: "",
  contract_file_name: "",
  notes: "",
  requires_contract_signature: false,
};

export const EMPTY_CUSTOM_FIELD = {
  label: "",
  input_type: "text",
  placeholder: "",
  options: [],
  required: true,
};

/** Keep custom field shape consistent from admin UI through API payload. */
export function normalizeCustomFieldForClient(field = {}) {
  const inputType = String(field.input_type || "text").trim() || "text";
  const rawOptions = Array.isArray(field.options) ? field.options : [];
  const options = [
    ...new Set(rawOptions.map((o) => String(o ?? "").trim()).filter(Boolean)),
  ];

  return {
    label: String(field.label || "").trim(),
    input_type: inputType,
    placeholder: String(field.placeholder || ""),
    required: field.required !== false,
    options: inputType === "select" ? options : [],
  };
}

export const EMPTY_PRICING_ROW = { product: "", retail: "", novi: "" };
export const EMPTY_ROI_STAT = { value: "", label: "" };
