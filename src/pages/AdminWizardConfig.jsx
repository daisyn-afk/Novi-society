import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import WizardConfigForm from "@/components/admin/WizardConfigForm";
import WizardPreview from "@/components/admin/WizardPreview";

export default function AdminWizardConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch all service types
  const { data: serviceTypes = [], isLoading: loadingServices } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  // Fetch selected service details
  const { data: selectedService, isLoading: loadingService } = useQuery({
    queryKey: ["service-type", selectedServiceId],
    queryFn: () => base44.entities.ServiceType.get(selectedServiceId),
    enabled: !!selectedServiceId,
  });

  // Update form when service changes
  useEffect(() => {
    if (selectedService) {
      setFormData({
        platform_agreement_text: selectedService.platform_agreement_text || "",
        md_agreement_text: selectedService.md_agreement_text || "",
        monthly_fee: selectedService.monthly_fee || 0,
        scope_rules: selectedService.scope_rules || [],
        protocol_document_urls: selectedService.protocol_document_urls || [],
        allowed_areas: selectedService.allowed_areas || [],
        growth_studio_text: selectedService.growth_studio_text || "",
        supplier_accounts_text: selectedService.supplier_accounts_text || "",
      });
    }
  }, [selectedService]);

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const saveConfig = useMutation({
    mutationFn: async () => {
      return base44.entities.ServiceType.update(selectedServiceId, {
        platform_agreement_text: formData.platform_agreement_text,
        md_agreement_text: formData.md_agreement_text,
        monthly_fee: parseFloat(formData.monthly_fee) || 0,
        scope_rules: formData.scope_rules,
        protocol_document_urls: formData.protocol_document_urls,
        allowed_areas: formData.allowed_areas,
        growth_studio_text: formData.growth_studio_text,
        supplier_accounts_text: formData.supplier_accounts_text,
      });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Wizard configuration updated successfully" });
      qc.invalidateQueries({ queryKey: ["service-type", selectedServiceId] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    await saveConfig.mutateAsync();
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>
          Wizard Configuration
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(30,37,53,0.55)" }}>
          Customize MD Board wizard templates and pricing per service
        </p>
      </div>

      {/* Service Type Selector */}
      <Card style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.8)" }}>
        <CardHeader>
          <CardTitle>Select Service Type</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingServices ? (
            <div className="flex items-center gap-2" style={{ color: "rgba(30,37,53,0.5)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading services...
            </div>
          ) : (
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a service to configure..." />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map(svc => (
                  <SelectItem key={svc.id} value={svc.id}>
                    {svc.name} ({svc.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Config Form */}
      {loadingService ? (
        <div className="flex items-center gap-2" style={{ color: "rgba(30,37,53,0.5)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading service...
        </div>
      ) : selectedService ? (
        <div className="space-y-5">
          <div className="flex gap-2 justify-end mb-4">
            <Button
              onClick={() => setPreviewOpen(true)}
              variant="outline"
              className="font-bold"
            >
              <Eye className="w-4 h-4 mr-2" /> Preview as Provider
            </Button>
          </div>
          <WizardConfigForm
            serviceType={selectedService}
            formData={formData}
            onFormChange={handleFormChange}
            onSave={handleSave}
            isSaving={isSaving || saveConfig.isPending}
          />
        </div>
      ) : null}

      {/* Preview Modal */}
      {selectedService && (
        <WizardPreview
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          serviceType={selectedService}
          formData={formData}
        />
      )}

      {/* Info Box */}
      {!selectedService && selectedServiceId === "" && (
        <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.2)" }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#7B8EC8" }} />
          <div>
            <p className="font-semibold" style={{ color: "#1e2535" }}>Select a service to get started</p>
            <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>
              Choose a service type from the dropdown above to configure its wizard agreement text and monthly fee.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}