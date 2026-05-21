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

  uses_network_tiers: false,
  network_tiers: [],

  custom_fields: [],
  required_fields: [],

  min_order_amount: "",
  ships_to_states: "",
  is_active: true,
};

export const EMPTY_NETWORK_TIER = {
  name: "",
  states: "",
  min_order_amount: "",
  contract_url: "",
  notes: "",
};

export const EMPTY_CUSTOM_FIELD = {
  label: "",
  input_type: "text",
  placeholder: "",
  required: true,
};

export const EMPTY_PRICING_ROW = { product: "", retail: "", novi: "" };
export const EMPTY_ROI_STAT = { value: "", label: "" };
