import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import InfoBanner from "../shared/InfoBanner";
import { FIELD_INPUT_TYPES, EMPTY_CUSTOM_FIELD } from "../constants";

function FieldRow({ field, onChange, onRemove, index }) {
  const typeLabel =
    FIELD_INPUT_TYPES.find((t) => t.value === field.input_type)?.label || "Short Text";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {field.label || `Field ${index + 1}`}
        </p>
        <p className="text-xs text-slate-500">
          {typeLabel}
          {field.required ? " · Required" : " · Optional"}
          {field.placeholder ? ` · "${field.placeholder}"` : ""}
        </p>
      </div>
      <Switch checked={!!field.required} onCheckedChange={(v) => onChange({ ...field, required: v })} />
      <button
        type="button"
        onClick={onRemove}
        className="text-slate-300 hover:text-red-500 p-1"
        aria-label={`Remove field ${index + 1}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NewFieldEditor({ onSubmit, onCancel }) {
  const [draft, setDraft] = useState({ ...EMPTY_CUSTOM_FIELD });
  const canAdd = !!draft.label.trim();

  return (
    <div
      className="rounded-xl p-3.5 space-y-3"
      style={{
        background: "rgba(200,230,60,0.07)",
        border: "1px solid rgba(200,230,60,0.35)",
      }}
    >
      <p className="text-xs font-bold" style={{ color: "#4a6b10" }}>New Field</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel className="mb-1">Label</FieldLabel>
          <Input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="e.g. DEA Number"
            className="bg-white"
          />
        </div>
        <div>
          <FieldLabel className="mb-1">Input Type</FieldLabel>
          <Select
            value={draft.input_type}
            onValueChange={(v) => setDraft({ ...draft, input_type: v })}
          >
            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_INPUT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <FieldLabel className="mb-1">Placeholder (optional)</FieldLabel>
          <Input
            value={draft.placeholder}
            onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })}
            placeholder="Hint text for providers"
            className="bg-white"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-2">
          <Switch
            checked={!!draft.required}
            onCheckedChange={(v) => setDraft({ ...draft, required: v })}
          />
          <span className="text-sm text-slate-700">Required</span>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canAdd}
          onClick={() => onSubmit(draft)}
          style={{ background: "#C8E63C", color: "#1a2540" }}
        >
          Add Field
        </Button>
      </div>
    </div>
  );
}

export default function ApplicationFormBuilderSection({ form, update }) {
  const [adding, setAdding] = useState(false);
  const fields = form.custom_fields || [];

  const setFields = (next) =>
    update({
      custom_fields: next,
      required_fields: next.filter((f) => f.required).map((f) => f.label),
    });

  const append = (field) => {
    setFields([...fields, field]);
    setAdding(false);
  };
  const change = (i, next) => setFields(fields.map((f, idx) => (idx === i ? next : f)));
  const remove = (i) => setFields(fields.filter((_, idx) => idx !== i));

  return (
    <>
      <InfoBanner tone="info">
        <strong>Standard fields</strong> (name, email, license, practice info, NPI) are always
        included. Add supplier-specific fields below — they appear in the provider application
        modal.
      </InfoBanner>

      {fields.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">No custom fields yet.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, i) => (
            <FieldRow
              key={i}
              index={i}
              field={field}
              onChange={(next) => change(i, next)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      )}

      {adding ? (
        <NewFieldEditor onSubmit={append} onCancel={() => setAdding(false)} />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          className="w-full"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Field
        </Button>
      )}
    </>
  );
}
