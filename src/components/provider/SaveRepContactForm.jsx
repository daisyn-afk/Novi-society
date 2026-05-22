import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Info } from "lucide-react";

export default function SaveRepContactForm({
  manufacturer,
  applicationId = null,
  initialRep = null,
  onSaved = null,
  onSkip = null,
  onCancel = null,
  showSkip = true,
  compact = false,
  variant = "default",
}) {
  const isModal = variant === "modal";
  const qc = useQueryClient();
  const [repName, setRepName] = useState(initialRep?.rep_name || "");
  const [repEmail, setRepEmail] = useState(initialRep?.rep_email || "");
  const [repPhone, setRepPhone] = useState(initialRep?.rep_phone || "");
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      base44.entities.ProviderManufacturerRep.upsert({
        manufacturer_id: manufacturer.id,
        manufacturer_application_id: applicationId,
        rep_name: repName.trim(),
        rep_email: repEmail.trim(),
        rep_phone: repPhone.trim(),
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["provider-manufacturer-reps"] });
      qc.invalidateQueries({ queryKey: ["provider-manufacturer-rep", manufacturer?.id] });
      if (isModal) {
        onSaved?.(row);
        return;
      }
      setSaved(true);
      onSaved?.(row);
    },
  });

  const canSave = repEmail.trim().length > 3 && repEmail.includes("@");

  if (saved && !isModal) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "#5a7a20" }} />
        <p className="text-sm font-semibold" style={{ color: "#1e2535" }}>Rep contact saved</p>
        <p className="text-xs mt-1" style={{ color: "rgba(30,37,53,0.55)" }}>
          Orders and messages to {manufacturer?.name} will go to {repEmail}.
        </p>
      </div>
    );
  }

  return (
    <div className={isModal ? "space-y-4" : compact ? "space-y-3" : "space-y-4"}>
      {!compact && !isModal && (
        <div className="text-center">
          <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1e2535" }}>
            Save Your Rep&apos;s Contact Info
          </h3>
        </div>
      )}

      {!isModal && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs leading-relaxed"
          style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.18)", color: "rgba(30,37,53,0.65)" }}
        >
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
          <span>
            Once your rep reaches out, save their details here so you can order and communicate directly through NOVI.
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>Rep Name</label>
          <Input
            value={repName}
            onChange={(e) => setRepName(e.target.value)}
            placeholder="e.g. Jane Smith"
            className="h-10"
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
            Rep Email <span style={{ color: "#DA6A63" }}>*</span>
          </label>
          <Input
            type="email"
            value={repEmail}
            onChange={(e) => setRepEmail(e.target.value)}
            placeholder="rep@supplier.com"
            className="h-10"
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: "rgba(30,37,53,0.55)" }}>
            Rep Phone{!isModal && " (optional)"}
          </label>
          <Input
            value={repPhone}
            onChange={(e) => setRepPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="h-10"
          />
        </div>
      </div>

      {(saveMutation.isError || saveMutation.error) && (
        <p className="text-xs text-red-600">{saveMutation.error?.message || "Could not save rep contact."}</p>
      )}

      {isModal ? (
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11"
            onClick={() => onCancel?.()}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 h-11 font-bold"
            style={{ background: "#1e2535", color: "#fff" }}
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving..." : "Save Rep Info"}
          </Button>
        </div>
      ) : (
        <Button
          className="w-full h-11 font-bold"
          style={{ background: "#C8E63C", color: "#1e2535" }}
          disabled={!canSave || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving..." : "Save Rep Info"}
        </Button>
      )}

      {showSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-xs text-center transition-opacity hover:opacity-70"
          style={{ color: "rgba(30,37,53,0.45)" }}
        >
          Skip for now — I&apos;ll add it later from My Accounts
        </button>
      )}
    </div>
  );
}

export function resolveRepDisplay(savedRep, manufacturer) {
  if (savedRep?.rep_email) {
    return {
      rep_name: savedRep.rep_name || "Your Rep",
      rep_email: savedRep.rep_email,
      rep_phone: savedRep.rep_phone || "",
      source: "saved",
    };
  }
  return {
    rep_name: manufacturer?.account_rep_name || "Account Rep",
    rep_email: manufacturer?.account_rep_email || "",
    rep_phone: "",
    source: "routing",
  };
}
