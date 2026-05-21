import { useEffect, useMemo, useState } from "react";
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

import { EMPTY_SUPPLIER } from "./constants";

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
  return {
    ...EMPTY_SUPPLIER,
    ...(initial || {}),
    products: initial?.products ?? [],
    benefits: initial?.benefits ?? [],
    selling_points: initial?.selling_points ?? [],
    pricing_highlights: initial?.pricing_highlights ?? [],
    roi_stats: initial?.roi_stats ?? [],
    standalone_access: initial?.standalone_access ?? [],
    novi_access: initial?.novi_access ?? [],
    network_tiers: initial?.network_tiers ?? [],
    custom_fields:
      initial?.custom_fields ??
      (initial?.required_fields || []).map((label) => ({
        label,
        input_type: "text",
        placeholder: "",
        required: true,
      })),
    required_fields: initial?.required_fields ?? [],
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

  useEffect(() => {
    if (open) {
      setForm(mergeSupplier(initial));
      setOpenSection("display");
    }
  }, [open, initial]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleUploadFile = async (file, key) => {
    if (!onUploadFile) return "";
    setUploadingKey(key);
    try {
      const url = await onUploadFile(file);
      return url || "";
    } finally {
      setUploadingKey(null);
    }
  };

  const editing = !!initial?.id;
  const canSubmit = form.name.trim() && form.account_rep_email.trim() && !isSubmitting;

  const missingHint = useMemo(() => {
    if (!form.name.trim()) return "Supplier name required";
    if (!form.account_rep_email.trim()) return "Rep email required";
    return null;
  }, [form.name, form.account_rep_email]);

  const handleSubmit = () => {
    const payload = {
      ...form,
      required_fields: (form.custom_fields || [])
        .filter((f) => f.required)
        .map((f) => f.label),
    };
    onSubmit(payload);
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
          <p className="text-xs text-slate-500">{missingHint || ""}</p>
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
