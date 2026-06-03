import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  TrendingUp,
  Sparkles,
  SlidersHorizontal,
  Mail,
  Share2,
  Settings2,
  Info,
} from "lucide-react";

import SectionShell from "./shared/SectionShell";
import DisplaySection from "./sections/DisplaySection";
import SalesPricingSection from "./sections/SalesPricingSection";
import NoviVsStandaloneSection from "./sections/NoviVsStandaloneSection";
import PositioningSection from "./sections/PositioningSection";
import ApplicationRoutingSection from "./sections/ApplicationRoutingSection";
import NetworkContractsSection from "./sections/NetworkContractsSection";
import ApplicationFormBuilderSection from "./sections/ApplicationFormBuilderSection";
import BusinessRulesSection from "./sections/BusinessRulesSection";

import { EMPTY_SUPPLIER, EMPTY_NETWORK_TIER } from "./constants";

const SECTIONS = [
  {
    id: "display",
    icon: LayoutGrid,
    title: "Display",
    subtitle: "What providers see in the marketplace",
    Component: DisplaySection,
  },
  {
    id: "sales",
    icon: TrendingUp,
    title: "Sales & Pricing",
    subtitle: "Pricing callouts, ROI stats, and sales copy to drive applications",
    Component: SalesPricingSection,
  },
  {
    id: "comparison",
    icon: Sparkles,
    title: "NOVI vs. Standalone",
    subtitle: "Show providers exactly what they get with NOVI vs. on their own",
    Component: NoviVsStandaloneSection,
  },
  {
    id: "positioning",
    icon: SlidersHorizontal,
    title: "Positioning",
    subtitle: "Visibility & priority controls",
    Component: PositioningSection,
  },
  {
    id: "routing",
    icon: Mail,
    title: "Application Routing",
    subtitle: "Where applications are sent",
    Component: ApplicationRoutingSection,
  },
  {
    id: "network",
    icon: Share2,
    title: "Network & Contracts",
    subtitle: "State tiers, contracts, and terms per region",
    Component: NetworkContractsSection,
  },
  {
    id: "form",
    icon: Settings2,
    title: "Application Form Builder",
    subtitle: "Custom fields providers must fill out",
    Component: ApplicationFormBuilderSection,
  },
  {
    id: "rules",
    icon: Info,
    title: "Business Rules",
    subtitle: "Order minimums, shipping states, status",
    Component: BusinessRulesSection,
  },
];

function mergeSupplier(initial) {
  const src = initial || {};
  return {
    ...EMPTY_SUPPLIER,
    ...src,
    logo_url: src.logo_url ?? "",
    cover_image_url: src.cover_image_url ?? "",
    products: initial?.products ?? [],
    benefits: initial?.benefits ?? [],
    selling_points: initial?.selling_points ?? [],
    pricing_highlights: initial?.pricing_highlights ?? [],
    roi_stats: initial?.roi_stats ?? [],
    standalone_access: initial?.standalone_access ?? [],
    novi_access: initial?.novi_access ?? [],
    network_tiers: (initial?.network_tiers ?? []).map((tier) => ({
      ...EMPTY_NETWORK_TIER,
      ...tier,
      requires_contract_signature: tier?.requires_contract_signature === true,
    })),
    custom_fields:
      initial?.custom_fields ??
      (initial?.required_fields || []).map((label) => ({
        label,
        input_type: "text",
        placeholder: "",
        required: true,
      })),
    required_fields: initial?.required_fields ?? [],
    jotform_application_url: src.jotform_application_url ?? "",
  };
}

export default function SupplierFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  onUploadFile,
  isSubmitting = false,
}) {
  const [form, setForm] = useState(() => mergeSupplier(initial));
  const [openSection, setOpenSection] = useState("display");
  const [uploadingKey, setUploadingKey] = useState(null);
  const [pendingUploads, setPendingUploads] = useState(0);
  const formRef = useRef(form);

  // Reset form only when the dialog opens for a different supplier (or new),
  // not on every parent re-render — otherwise in-flight logo/cover uploads get wiped.
  const formSeed = open ? String(initial?.id ?? "__new__") : "__closed__";

  useEffect(() => {
    if (!open) return;
    const next = mergeSupplier(initial);
    setForm(next);
    formRef.current = next;
    setOpenSection("display");
  }, [formSeed]);

  const update = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      formRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const handleUploadFile = async (file, key) => {
    if (!onUploadFile) return "";
    setUploadingKey(key);
    setPendingUploads((n) => n + 1);
    const uploadKind =
      typeof key === "string" && key.startsWith("contract_")
        ? "manufacturer_contract"
        : "manufacturer_logo";
    try {
      const url = await onUploadFile(file, uploadKind);
      return url || "";
    } finally {
      setUploadingKey(null);
      setPendingUploads((n) => Math.max(0, n - 1));
    }
  };

  const editing = !!initial?.id;
  const uploadsInFlight = pendingUploads > 0 || Boolean(uploadingKey);
  const canSubmit =
    form.name.trim() &&
    form.account_rep_email.trim() &&
    !isSubmitting &&
    !uploadsInFlight;

  const missingHint = useMemo(() => {
    if (!form.name.trim()) return "Supplier name required";
    if (!form.account_rep_email.trim()) return "Rep email required";
    return null;
  }, [form.name, form.account_rep_email]);

  const buildPayload = (source) => ({
    ...source,
    logo_url: String(source.logo_url || "").trim(),
    cover_image_url: String(source.cover_image_url || "").trim(),
    jotform_application_url: String(source.jotform_application_url || "").trim(),
    required_fields: (source.custom_fields || [])
      .filter((f) => f.required)
      .map((f) => f.label),
  });

  const handleSubmit = () => {
    if (uploadsInFlight) return;
    setForm((currentForm) => {
      const payload = buildPayload(currentForm);
      formRef.current = currentForm;
      onSubmit(payload);
      return currentForm;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold text-slate-900 italic">
            {editing ? "Edit Supplier" : "Add Supplier"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Configure marketplace display, application routing, contracts, and form requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50/40">
          {SECTIONS.map(({ id, icon, title, subtitle, Component }) => (
            <SectionShell
              key={id}
              icon={icon}
              title={title}
              subtitle={subtitle}
              open={openSection === id}
              onToggle={() => setOpenSection(openSection === id ? null : id)}
            >
              <Component
                form={form}
                update={update}
                onUploadFile={handleUploadFile}
                uploadingKey={uploadingKey}
              />
            </SectionShell>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-slate-100 bg-white">
          <p className="text-xs text-slate-500">
            {uploadsInFlight
              ? "Wait for image uploads to finish…"
              : missingHint || ""}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ background: "#C8E63C", color: "#1a2540" }}
            >
              {isSubmitting ? "Saving..." : editing ? "Save Changes" : "Add Supplier"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
