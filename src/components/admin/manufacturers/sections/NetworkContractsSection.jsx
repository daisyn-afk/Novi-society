import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import InfoBanner from "../shared/InfoBanner";
import { EMPTY_NETWORK_TIER, US_STATES } from "../constants";

const NOVI_LIME = "#C8E63C";
const NOVI_LIME_TEXT = "#1a2540";

function parseStatesList(statesValue) {
  if (Array.isArray(statesValue)) {
    return statesValue.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean);
  }
  return String(statesValue || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => US_STATES.includes(s));
}

function formatStatesList(codes) {
  return [...new Set(codes)].sort((a, b) => US_STATES.indexOf(a) - US_STATES.indexOf(b)).join(", ");
}

function TierEditor({ tier, onChange, onRemove, index, onUploadFile, uploadingKey }) {
  const selectedStates = useMemo(() => parseStatesList(tier.states), [tier.states]);
  const uploadKey = `contract_${index}`;
  const isUploading = uploadingKey === uploadKey;

  const toggleState = (code) => {
    const next = selectedStates.includes(code)
      ? selectedStates.filter((s) => s !== code)
      : [...selectedStates, code];
    onChange({ ...tier, states: formatStatesList(next) });
  };

  const handleContractUpload = async (file) => {
    if (!onUploadFile || !file) return;
    const url = await onUploadFile(file, uploadKey);
    if (url) {
      onChange({
        ...tier,
        contract_url: url,
        contract_file_name: file.name || "contract.pdf",
      });
    }
  };

  const tierTitle = tier.name?.trim() || `Tier ${index + 1}`;
  const stateCountLabel =
    selectedStates.length === 1
      ? "1 state"
      : `${selectedStates.length} states`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 relative shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{tierTitle}</p>
          {selectedStates.length > 0 ? (
            <Badge
              variant="outline"
              className="text-xs font-semibold shrink-0"
              style={{ borderColor: "rgba(200,230,60,0.5)", color: "#4a6b10", background: "rgba(200,230,60,0.15)" }}
            >
              {stateCountLabel}
            </Badge>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 p-1 shrink-0"
          aria-label={`Remove ${tierTitle}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel className="mb-1">Tier Name</FieldLabel>
          <Input
            value={tier.name}
            onChange={(e) => onChange({ ...tier, name: e.target.value })}
            placeholder="e.g. Tier 1 — Southwest"
            className="bg-white h-9 text-sm"
          />
        </div>
        <div>
          <FieldLabel className="mb-1">Min Order ($)</FieldLabel>
          <Input
            type="number"
            min={0}
            value={tier.min_order_amount}
            onChange={(e) => onChange({ ...tier, min_order_amount: e.target.value })}
            placeholder="500"
            className="bg-white h-9 text-sm"
          />
        </div>
      </div>

      <div>
        <FieldLabel className="mb-1">States This Tier Applies To</FieldLabel>
        <Input
          readOnly
          value={tier.states || ""}
          placeholder="Select states below"
          className="bg-slate-50 h-9 text-sm mb-2 text-slate-700"
        />
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          {US_STATES.map((code) => {
            const selected = selectedStates.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleState(code)}
                className="text-xs font-semibold rounded-md px-1 py-1.5 transition-colors border"
                style={
                  selected
                    ? {
                        background: NOVI_LIME,
                        color: NOVI_LIME_TEXT,
                        borderColor: NOVI_LIME,
                      }
                    : {
                        background: "#fff",
                        color: "#64748b",
                        borderColor: "#e2e8f0",
                      }
                }
              >
                {code}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel className="mb-1">Contract / Agreement Document</FieldLabel>
        {tier.contract_url ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <a
              href={tier.contract_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline truncate"
            >
              {tier.contract_file_name || "View contract PDF"}
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({ ...tier, contract_url: "", contract_file_name: "" })
              }
            >
              Remove
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-1 cursor-pointer border border-dashed border-slate-300 rounded-lg px-3 py-6 hover:bg-slate-50 transition-all bg-white">
            <Upload className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-500">
              {isUploading ? "Uploading..." : "Upload PDF contract (optional)"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,application/pdf"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleContractUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div>
        <FieldLabel className="mb-1">
          Terms / Notes (shown to provider before applying)
        </FieldLabel>
        <Textarea
          value={tier.notes}
          onChange={(e) => onChange({ ...tier, notes: e.target.value })}
          placeholder="e.g. Must complete Allergan training within 90 days. Minimum 3 purchases per quarter."
          className="bg-white text-sm min-h-[80px] resize-y"
          rows={3}
        />
      </div>

      <label className="flex items-center justify-between gap-3 cursor-pointer rounded-lg border border-slate-200 px-3 py-2.5 bg-slate-50/50">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Require contract signature before application
          </p>
          <p className="text-xs text-slate-500">
            Provider must acknowledge the contract/terms before submitting
          </p>
        </div>
        <Switch
          checked={!!tier.requires_contract_signature}
          onCheckedChange={(v) => onChange({ ...tier, requires_contract_signature: v })}
        />
      </label>
    </div>
  );
}

export default function NetworkContractsSection({ form, update, onUploadFile, uploadingKey }) {
  const enabled = !!form.uses_network_tiers;

  const setTiers = (next) => update({ network_tiers: next });

  const addTier = () => setTiers([...(form.network_tiers || []), { ...EMPTY_NETWORK_TIER }]);
  const updateTier = (i, next) =>
    setTiers((form.network_tiers || []).map((t, idx) => (idx === i ? next : t)));
  const removeTier = (i) =>
    setTiers((form.network_tiers || []).filter((_, idx) => idx !== i));

  return (
    <>
      <label className="flex items-center justify-between gap-3 cursor-pointer rounded-lg border border-slate-200 px-3 py-2.5 bg-white">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            This supplier uses network tiers / state-specific contracts
          </p>
          <p className="text-xs text-slate-500">
            Enable to configure different terms, contracts, and requirements per state or region
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => update({ uses_network_tiers: v })}
        />
      </label>

      {!enabled ? (
        <InfoBanner tone="success">
          No network tiers — this supplier uses a single set of terms for all states. You can
          still set a minimum order and shipping states in Business Rules below.
        </InfoBanner>
      ) : (
        <div className="space-y-3">
          <InfoBanner tone="info">
            Each network tier can have its own <strong>states</strong>, <strong>contract PDF</strong>,{" "}
            <strong>terms</strong>, and <strong>minimum order</strong>. Providers will see the
            applicable tier when applying based on their practice state.
          </InfoBanner>

          {(form.network_tiers || []).length === 0 ? (
            <p className="text-xs text-slate-400 italic px-1">
              No tiers yet — add the first one below.
            </p>
          ) : (
            (form.network_tiers || []).map((tier, i) => (
              <TierEditor
                key={i}
                index={i}
                tier={tier}
                onChange={(next) => updateTier(i, next)}
                onRemove={() => removeTier(i)}
                onUploadFile={onUploadFile}
                uploadingKey={uploadingKey}
              />
            ))
          )}

          <Button type="button" variant="outline" size="sm" onClick={addTier} className="w-full">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Network Tier
          </Button>
        </div>
      )}
    </>
  );
}
