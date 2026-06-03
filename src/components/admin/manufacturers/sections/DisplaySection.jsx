import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon, Globe } from "lucide-react";
import FieldLabel from "../shared/FieldLabel";
import ChipListEditor from "../shared/ChipListEditor";
import { CATEGORIES, CATEGORY_LABELS } from "../constants";

function UploadField({ label, value, onChange, onUpload, uploading, accept = ".png,.jpg,.jpeg,.svg,.webp" }) {
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;
    await onUpload(file);
  };

  return (
    <div>
      <FieldLabel className="mb-1">{label}</FieldLabel>
      {value ? (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt={label}
            className="w-14 h-14 rounded-lg object-cover border border-slate-200 bg-slate-50"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange("")} disabled={uploading}>
            Remove
          </Button>
        </div>
      ) : (
        <label
          className={`flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2.5 transition-all ${
            uploading ? "opacity-60 cursor-wait" : "cursor-pointer hover:bg-slate-50"
          }`}
        >
          <Upload className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500">
            {uploading ? "Uploading..." : `Upload ${label.toLowerCase()}`}
          </span>
          <input
            type="file"
            className="hidden"
            accept={accept}
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
}

export default function DisplaySection({ form, update, onUploadFile, uploadingKey }) {
  const handleUpload = async (key, file) => {
    if (!onUploadFile) return;
    const url = await onUploadFile(file, key);
    if (url) {
      update({ [key]: url });
    }
  };

  return (
    <>
      <div>
        <FieldLabel required className="mb-1">Supplier Name</FieldLabel>
        <Input
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Allergan, Galderma"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel required className="mb-1">Category</FieldLabel>
          <Select value={form.category} onValueChange={(v) => update({ category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel className="mb-1">Website</FieldLabel>
          <div className="relative">
            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              className="pl-8"
              value={form.website_url}
              onChange={(e) => update({ website_url: e.target.value })}
              placeholder="https://supplier.com"
            />
          </div>
        </div>
      </div>

      <div>
        <FieldLabel className="mb-1">JotForm Application Link</FieldLabel>
        <div className="relative">
          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            className="pl-8"
            value={form.jotform_application_url}
            onChange={(e) => update({ jotform_application_url: e.target.value })}
            placeholder="https://form.jotform.com/..."
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Optional. When set, providers are sent to this external form instead of the built-in NOVI
          application flow.
        </p>
      </div>

      <div>
        <FieldLabel className="mb-1">Short Description</FieldLabel>
        <textarea
          className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Brief description shown in the provider marketplace card"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <UploadField
          label="Logo"
          value={form.logo_url}
          onChange={(v) => update({ logo_url: v })}
          onUpload={(file) => handleUpload("logo_url", file)}
          uploading={uploadingKey === "logo_url"}
        />
        <UploadField
          label="Card Photo"
          value={form.cover_image_url}
          onChange={(v) => update({ cover_image_url: v })}
          onUpload={(file) => handleUpload("cover_image_url", file)}
          uploading={uploadingKey === "cover_image_url"}
        />
      </div>

      <div>
        <FieldLabel className="mb-1.5">Product Highlights</FieldLabel>
        <ChipListEditor
          items={form.products}
          onChange={(v) => update({ products: v })}
          placeholder="e.g. Botox, Juvederm"
          emptyHint="No products yet"
          chipTone="slate"
        />
      </div>

      <div>
        <FieldLabel className="mb-1.5">Provider Benefits</FieldLabel>
        <ChipListEditor
          items={form.benefits}
          onChange={(v) => update({ benefits: v })}
          placeholder="e.g. Exclusive NOVI pricing"
          emptyHint="No benefits yet"
          chipTone="lime"
        />
      </div>

      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-4 h-4 text-slate-500" />
          <div>
            <p className="text-sm font-semibold text-slate-700">FDA Approved US Products</p>
            <p className="text-xs text-slate-500">Displays an FDA badge on the marketplace card</p>
          </div>
        </div>
        <Switch
          checked={!!form.fda_approved_us_products}
          onCheckedChange={(v) => update({ fda_approved_us_products: v })}
        />
      </label>
    </>
  );
}
