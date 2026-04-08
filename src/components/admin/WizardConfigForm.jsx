import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

export default function WizardConfigForm({ serviceType, formData, onFormChange, onSave, isSaving }) {
  if (!serviceType) return null;

  const handleArrayAdd = (field) => {
    const current = formData[field] || [];
    onFormChange(field, [...current, { name: "", url: "" }]);
  };

  const handleArrayRemove = (field, index) => {
    const current = formData[field] || [];
    onFormChange(field, current.filter((_, i) => i !== index));
  };

  const handleArrayFieldChange = (field, index, subField, value) => {
    const current = formData[field] || [];
    const updated = [...current];
    updated[index] = { ...updated[index], [subField]: value };
    onFormChange(field, updated);
  };

  return (
    <div className="space-y-5">
      {/* Platform Agreement */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>📋 Platform Agreement Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>Step 1 of wizard. Leave blank for default.</p>
          <Textarea
            value={formData.platform_agreement_text || ""}
            onChange={e => onFormChange("platform_agreement_text", e.target.value)}
            placeholder="Enter platform agreement text..."
            className="min-h-40"
          />
        </CardContent>
      </Card>

      {/* MD Agreement */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>🛡️ Medical Director Agreement Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>Step 2 of wizard. Leave blank for default.</p>
          <Textarea
            value={formData.md_agreement_text || ""}
            onChange={e => onFormChange("md_agreement_text", e.target.value)}
            placeholder="Enter MD agreement text..."
            className="min-h-40"
          />
        </CardContent>
      </Card>

      {/* Monthly Fee */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>💰 Monthly Membership Fee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>Shown in step 3. Prorated for current month.</p>
          <div className="flex items-center gap-2">
            <span>$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.monthly_fee || ""}
              onChange={e => onFormChange("monthly_fee", e.target.value)}
              className="max-w-xs"
            />
            <span>/month</span>
          </div>
        </CardContent>
      </Card>

      {/* Scope Rules */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>📊 Scope Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>e.g. "Max 50 units per session"</p>
          <div className="space-y-2">
            {(formData.scope_rules || []).map((rule, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <Input
                    placeholder="Rule name (e.g., Max Units)"
                    value={rule.rule_name || ""}
                    onChange={e => handleArrayFieldChange("scope_rules", idx, "rule_name", e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Value (e.g., 50)"
                    value={rule.rule_value || ""}
                    onChange={e => handleArrayFieldChange("scope_rules", idx, "rule_value", e.target.value)}
                    className="text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleArrayRemove("scope_rules", idx)}
                  className="mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleArrayAdd("scope_rules")}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Protocol Documents */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>📄 Protocol Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>PDFs/guides providers see for this service</p>
          <div className="space-y-2">
            {(formData.protocol_document_urls || []).map((doc, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <Input
                    placeholder="Document name (e.g., Botox Protocol)"
                    value={doc.name || ""}
                    onChange={e => handleArrayFieldChange("protocol_document_urls", idx, "name", e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Document URL"
                    value={doc.url || ""}
                    onChange={e => handleArrayFieldChange("protocol_document_urls", idx, "url", e.target.value)}
                    className="text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleArrayRemove("protocol_document_urls", idx)}
                  className="mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleArrayAdd("protocol_document_urls")}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Document
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Allowed Areas */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>🗺️ Allowed Treatment Areas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>Treatment areas allowed for this service (comma-separated)</p>
          <Textarea
            value={(formData.allowed_areas || []).join(", ")}
            onChange={e => onFormChange("allowed_areas", e.target.value.split(",").map(a => a.trim()))}
            placeholder="e.g., Forehead, Crow's feet, Lips, etc."
            className="min-h-24"
          />
        </CardContent>
      </Card>

      {/* Growth Studio Card */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>🚀 Growth Studio Next Step</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>Card 4 of 5. What providers see about setting up in the Growth Studio.</p>
          <Textarea
            value={formData.growth_studio_text || ""}
            onChange={e => onFormChange("growth_studio_text", e.target.value)}
            placeholder="e.g., 'Head to Growth Studio to complete your profile, upload photos, and set your pricing...'"
            className="min-h-32"
          />
        </CardContent>
      </Card>

      {/* Supplier Accounts Card */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>🏭 Supplier Accounts Next Step</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.65)" }}>Card 5 of 5. Final card about applying for supplier accounts.</p>
          <Textarea
            value={formData.supplier_accounts_text || ""}
            onChange={e => onFormChange("supplier_accounts_text", e.target.value)}
            placeholder="e.g., 'Visit our Supplier Marketplace to apply for product accounts with trusted manufacturers...'"
            className="min-h-32"
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={onSave}
        disabled={isSaving}
        style={{ background: "#2D6B7F", color: "white" }}
        className="w-full font-bold py-3"
      >
        {isSaving ? "Saving..." : "Save Configuration"}
      </Button>
    </div>
  );
}