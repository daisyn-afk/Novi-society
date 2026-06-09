import { base44 } from "@/api/base44Client";

export function buildSkinScanPrompt({ isPremium = false } = {}) {
  const premiumFields = isPremium
    ? `
- wrinkle_depth_score: 0-100 integer (0=no wrinkles, 100=deep wrinkles) — map visible lines, creases, and folds
- volume_loss_score: 0-100 integer (0=no volume loss, 100=severe hollowing) — assess cheeks, temples, under-eye
- symmetry_score: 0-100 integer (100=perfectly symmetrical) — evaluate facial balance
- estimated_skin_age: integer — estimated biological skin age based on texture and tone
- hydration_score: 0-100 integer — skin hydration/plumpness level
- pigmentation_score: 0-100 integer (100=perfectly even, 0=severe uneven) — assess evenness of skin tone
- wrinkle_depth_map: object with keys for facial zones (forehead, glabella, crow_feet, nasolabial, marionette, perioral) and integer 0-10 severity values`
    : "";

  return `You are Novi — a warm, professional aesthetic wellness guide with complete knowledge of every aesthetic product, brand, treatment, and ingredient on the market. Analyze this facial photo and respond in friendly, patient-accessible language (never clinical jargon).

Your product knowledge includes: neurotoxins (Botox, Dysport, Xeomin, Daxxify, Jeuveau), dermal fillers (Juvederm Voluma/Volbella/Vollure/Ultra, Restylane Lyft/Silk/Kysse/Defyne, Sculptra, Radiesse, Belotero Balance), skincare (SkinMedica TNS, ZO Skin Health, iS Clinical, SkinCeuticals C E Ferulic, EltaMD UV, Obagi Nu-Derm, Alastin Restorative Skin Complex, PCA Skin), facials (HydraFacial, Aquagold, BBL Hero, DiamondGlow), chemical peels (VI Peel, ZO 3-Step Stimulation Peel), laser (Clear + Brilliant, Fraxel, IPL, Halo), microneedling (SkinPen, Morpheus8 RF), PRP/PRF, Kybella, CoolSculpting, body contouring, IV vitamin therapy, acne treatments (Accutane, Spironolactone topicals, AviClear laser), and more.

Analyze the photo and return:
- overall_skin_health: "Excellent" | "Good" | "Fair" | "Needs Attention"
- concern_summary: 2-3 warm, encouraging sentences describing what you observe in patient-friendly terms
- detected_concerns: array of 3-6 specific observable concerns using friendly language (e.g. "Fine lines around eyes" not "periorbital rhytids")
- recommended_treatments: array of 3-5 REAL, SPECIFIC treatments with actual brand/product names that directly address the detected concerns. Each item:
  - name: specific treatment or product name (e.g. "Botox for forehead lines", "Juvederm Voluma for cheek volume", "HydraFacial for skin texture", "SkinCeuticals C E Ferulic for uneven tone")
  - reason: 1 sentence in patient language explaining WHY this specific treatment helps THEIR specific concern
  - category: one of "injectables" | "fillers" | "laser" | "skincare" | "prp" | "other"
- treatment_areas: array of facial areas that may benefit
- confidence_score: 0-100${premiumFields}`;
}

export function buildSkinScanResponseSchema(isPremium = false) {
  return {
    type: "object",
    properties: {
      overall_skin_health: { type: "string" },
      concern_summary: { type: "string" },
      detected_concerns: { type: "array", items: { type: "string" } },
      recommended_treatments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            reason: { type: "string" },
            category: { type: "string" },
          },
        },
      },
      educational_suggestions: { type: "array", items: { type: "string" } },
      treatment_areas: { type: "array", items: { type: "string" } },
      confidence_score: { type: "number" },
      ...(isPremium
        ? {
            wrinkle_depth_score: { type: "number" },
            volume_loss_score: { type: "number" },
            symmetry_score: { type: "number" },
            estimated_skin_age: { type: "number" },
            hydration_score: { type: "number" },
            pigmentation_score: { type: "number" },
            wrinkle_depth_map: { type: "object" },
          }
        : {}),
    },
  };
}

export async function analyzeSkinScan({ fileUrl, isPremium = false }) {
  return base44.integrations.Core.InvokeLLM({
    prompt: buildSkinScanPrompt({ isPremium }),
    file_urls: [fileUrl],
    response_json_schema: buildSkinScanResponseSchema(isPremium),
  });
}

export const FALLBACK_SCAN_ANALYSIS = {
  overall_skin_health: "Good",
  concern_summary: "I wasn't able to fully analyze this image, but I can still help guide you!",
  detected_concerns: [],
  educational_suggestions: [],
};
