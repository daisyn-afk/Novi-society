import { forwardRef, useImperativeHandle, useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Pencil } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import InfoBanner from "../shared/InfoBanner";
import ChipListEditor from "../shared/ChipListEditor";
import {
  FIELD_INPUT_TYPES,
  EMPTY_CUSTOM_FIELD,
  normalizeCustomFieldForClient,
} from "../constants";

function isDraftValid(draft) {
  const isSelect = draft.input_type === "select";
  return (
    !!String(draft.label || "").trim() &&
    (!isSelect || (draft.options || []).length > 0)
  );
}

function FieldEditor({ title, draft, setDraft, onSubmit, onCancel, submitLabel = "Add Field" }) {
  const isSelect = draft.input_type === "select";
  const canSubmit = isDraftValid(draft);

  return (
    <div
      className="rounded-xl p-3.5 space-y-3"
      style={{
        background: "rgba(200,230,60,0.07)",
        border: "1px solid rgba(200,230,60,0.35)",
      }}
    >
      <p className="text-xs font-bold" style={{ color: "#4a6b10" }}>{title}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel className="mb-1">Label</FieldLabel>
          <Input
            value={draft.label}
            onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="e.g. DEA Number"
            className="bg-white"
          />
        </div>
        <div>
          <FieldLabel className="mb-1">Input Type</FieldLabel>
          <Select
            value={draft.input_type}
            onValueChange={(v) =>
              setDraft((prev) => ({
                ...prev,
                input_type: v,
                options: v === "select" ? prev.options || [] : [],
              }))
            }
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

      {isSelect ? (
        <div>
          <FieldLabel className="mb-1" hint="Providers pick one value from this list.">
            Dropdown Options
          </FieldLabel>
          <ChipListEditor
            items={draft.options || []}
            onChange={(options) => setDraft((prev) => ({ ...prev, options }))}
            placeholder="e.g. Yes, No, Not sure"
            emptyHint="Add at least one option"
            chipTone="blue"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <FieldLabel className="mb-1">
            {isSelect ? "Empty-state hint (optional)" : "Placeholder (optional)"}
          </FieldLabel>
          <Input
            value={draft.placeholder}
            onChange={(e) => setDraft((prev) => ({ ...prev, placeholder: e.target.value }))}
            placeholder={isSelect ? "e.g. Select an option" : "Hint text for providers"}
            className="bg-white"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-2">
          <Switch
            checked={!!draft.required}
            onCheckedChange={(v) => setDraft((prev) => ({ ...prev, required: v }))}
          />
          <span className="text-sm text-slate-700">Required</span>
        </label>
      </div>

      {isSelect && !(draft.options || []).length ? (
        <p className="text-xs text-red-500">Add at least one dropdown option.</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={() => onSubmit(normalizeCustomFieldForClient(draft))}
          style={{ background: "#C8E63C", color: "#1a2540" }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function FieldRow({ field, onChange, onRemove, onEdit, index }) {
  const typeLabel =
    FIELD_INPUT_TYPES.find((t) => t.value === field.input_type)?.label || "Short Text";
  const missingSelectOptions =
    field.input_type === "select" && !(field.options || []).length;

  return (
    <div
      className="rounded-lg border bg-white p-3 flex items-center justify-between gap-3"
      style={{
        borderColor: missingSelectOptions ? "rgba(250,111,48,0.45)" : "rgb(226 232 240)",
        background: missingSelectOptions ? "rgba(250,111,48,0.04)" : "#fff",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {field.label || `Field ${index + 1}`}
        </p>
        <p className="text-xs text-slate-500">
          {typeLabel}
          {field.required ? " · Required" : " · Optional"}
          {field.placeholder ? ` · "${field.placeholder}"` : ""}
          {field.input_type === "select" && field.options?.length
            ? ` · ${field.options.length} option${field.options.length !== 1 ? "s" : ""}: ${field.options.join(", ")}`
            : ""}
        </p>
        {missingSelectOptions ? (
          <p className="text-xs text-orange-600 mt-1 font-medium">
            Dropdown has no options — click edit to add them, then Save Changes
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-slate-400 hover:text-slate-700 p-1"
        aria-label={`Edit field ${index + 1}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <Switch
        checked={!!field.required}
        onCheckedChange={(v) => onChange(normalizeCustomFieldForClient({ ...field, required: v }))}
      />
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

function mergePendingIntoFields(baseFields, { editingIndex, editDraft, adding, newDraft }) {
  let next = baseFields.map(normalizeCustomFieldForClient);

  if (editingIndex !== null && editDraft && isDraftValid(editDraft)) {
    next = next.map((f, idx) =>
      idx === editingIndex ? normalizeCustomFieldForClient(editDraft) : f
    );
  }

  if (adding && newDraft && isDraftValid(newDraft)) {
    next = [...next, normalizeCustomFieldForClient(newDraft)];
  }

  return next;
}

const ApplicationFormBuilderSection = forwardRef(function ApplicationFormBuilderSection(
  { form, update },
  ref
) {
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState({ ...EMPTY_CUSTOM_FIELD, options: [] });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState({ ...EMPTY_CUSTOM_FIELD, options: [] });

  const fields = (form.custom_fields || []).map(normalizeCustomFieldForClient);

  const commitFields = (next) => {
    const normalized = next.map(normalizeCustomFieldForClient);
    update({
      custom_fields: normalized,
      required_fields: normalized.filter((f) => f.required).map((f) => f.label),
    });
  };

  useImperativeHandle(ref, () => ({
    /** Commit any open new-field or edit-field drafts before dialog save. */
    flushPendingDraft() {
      const hasEdit = editingIndex !== null && isDraftValid(editDraft);
      const hasNew = adding && isDraftValid(newDraft);
      if (!hasEdit && !hasNew) return null;

      return mergePendingIntoFields(fields, {
        editingIndex: hasEdit ? editingIndex : null,
        editDraft: hasEdit ? editDraft : null,
        adding: hasNew,
        newDraft: hasNew ? newDraft : null,
      });
    },
  }));

  const append = (field) => {
    commitFields([...fields, field]);
    setAdding(false);
    setNewDraft({ ...EMPTY_CUSTOM_FIELD, options: [] });
  };

  const change = (i, next) => commitFields(fields.map((f, idx) => (idx === i ? next : f)));
  const remove = (i) => {
    commitFields(fields.filter((_, idx) => idx !== i));
    if (editingIndex === i) {
      setEditingIndex(null);
      setEditDraft({ ...EMPTY_CUSTOM_FIELD, options: [] });
    }
  };

  const startEdit = (i) => {
    setAdding(false);
    setEditingIndex(i);
    setEditDraft(normalizeCustomFieldForClient(fields[i]));
  };

  const saveEdit = (field) => {
    if (editingIndex === null) return;
    change(editingIndex, field);
    setEditingIndex(null);
    setEditDraft({ ...EMPTY_CUSTOM_FIELD, options: [] });
  };

  return (
    <>
      <InfoBanner tone="info">
        <strong>Standard fields</strong> (name, email, license, practice info, NPI) are always
        included. Add supplier-specific fields below — they appear in the provider application
        modal. Unsaved field edits are applied when you click <strong>Save Changes</strong>.
      </InfoBanner>

      {fields.length === 0 && editingIndex === null && !adding ? (
        <p className="text-xs text-slate-400 text-center py-2">No custom fields yet.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, i) =>
            editingIndex === i ? (
              <FieldEditor
                key={`edit-${field.label}-${i}`}
                title={`Edit Field ${i + 1}`}
                draft={editDraft}
                setDraft={setEditDraft}
                submitLabel="Save Field"
                onSubmit={saveEdit}
                onCancel={() => {
                  setEditingIndex(null);
                  setEditDraft({ ...EMPTY_CUSTOM_FIELD, options: [] });
                }}
              />
            ) : (
              <FieldRow
                key={`${field.label}-${i}`}
                index={i}
                field={field}
                onChange={(next) => change(i, next)}
                onRemove={() => remove(i)}
                onEdit={() => startEdit(i)}
              />
            )
          )}
        </div>
      )}

      {adding ? (
        <FieldEditor
          title="New Field"
          draft={newDraft}
          setDraft={setNewDraft}
          onSubmit={append}
          onCancel={() => {
            setAdding(false);
            setNewDraft({ ...EMPTY_CUSTOM_FIELD, options: [] });
          }}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingIndex(null);
            setAdding(true);
          }}
          className="w-full"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Field
        </Button>
      )}
    </>
  );
});

export default ApplicationFormBuilderSection;
