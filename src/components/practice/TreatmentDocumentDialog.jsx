import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  buildInventoryProductOptions,
  getInventoryProductSelectValue,
  sanitizeProductsUsed,
} from "@/lib/supplierUsage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import AftercarePlanDialog from "./AftercarePlanDialog";
import TreatmentCheckoutDialog from "./TreatmentCheckoutDialog";
import AreasTreatedField from "./AreasTreatedField";
import {
  areasForInjectableOffering,
  buildAutoInvoiceChargeModes,
  calculateCombinedInjectableTotal,
  calculateTreatmentTotal,
  combinedInjectableAreaSuggestions,
  combinedInjectableLogFormConfig,
  defaultUnitLabelForMenu,
  formatUsd,
  billingQuantitiesForForm,
  getCombinedInjectableMenus,
  isCombinedInjectableLog,
  logTreatmentFormConfig,
  resolveOfferingForAppointment,
  serializeBillingQuantities,
} from "@/lib/treatmentPricing";

const EMPTY_PRODUCT = {
  product_name: "",
  batch_lot: "",
  amount: "",
  manufacturer_id: "",
  manufacturer_name: "",
};

export default function TreatmentDocumentDialog({
  open,
  onClose,
  appointment,
  existingRecord,
  providerMe: providerMeProp = null,
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const treatmentAlreadyPaid =
    String(appointment?.treatment_payment_status || "").toLowerCase() === "paid";
  const treatmentAwaitingPayment =
    String(appointment?.treatment_payment_status || "").toLowerCase() === "awaiting_payment";
  const [form, setForm] = useState({});
  const [products, setProducts] = useState([{ ...EMPTY_PRODUCT }]);
  const [areas, setAreas] = useState([]);
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [uploading, setUploading] = useState({ before: false, after: false });
  const [showAftercarePlan, setShowAftercarePlan] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [savedRecord, setSavedRecord] = useState(null);
  const [patientJourney, setPatientJourney] = useState(null);

  const { data: me, isPending: mePending, isFetching: meFetching } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    enabled: open,
    staleTime: 10 * 60 * 1000,
    placeholderData: () => providerMeProp ?? qc.getQueryData(["me"]),
    initialData: providerMeProp ?? undefined,
  });

  const providerProfile = me ?? providerMeProp ?? null;
  const menuLoading = open && !providerProfile && (mePending || meFetching);

  useEffect(() => {
    if (open) {
      void qc.prefetchQuery({
        queryKey: ["me"],
        queryFn: () => base44.auth.me(),
        staleTime: 10 * 60 * 1000,
      });
    }
  }, [open, qc]);

  const { data: inventory = [] } = useQuery({
    queryKey: ["my-inventory", providerProfile?.id],
    queryFn: () =>
      base44.entities.ProviderInventory.filter({ provider_id: providerProfile.id }, "-created_date"),
    enabled: open && Boolean(providerProfile?.id),
  });

  const inventoryOptions = useMemo(
    () => buildInventoryProductOptions(inventory),
    [inventory]
  );

  const inventoryBySupplier = useMemo(() => {
    return inventoryOptions.reduce((acc, option) => {
      const label = option.manufacturer_name || "Supplier";
      if (!acc[label]) acc[label] = [];
      acc[label].push(option);
      return acc;
    }, {});
  }, [inventoryOptions]);

  const offerings = providerProfile?.service_offerings_v2 || {};
  const combinedBundle = useMemo(
    () => getCombinedInjectableMenus(offerings, appointment?.service_type_id),
    [offerings, appointment?.service_type_id]
  );
  const isCombinedInjectable = useMemo(
    () => isCombinedInjectableLog(offerings, appointment?.service_type_id),
    [offerings, appointment?.service_type_id]
  );

  const menuOffering = useMemo(() => {
    if (isCombinedInjectable) return null;
    return resolveOfferingForAppointment({
      serviceLabel: appointment?.service,
      serviceTypeId: appointment?.service_type_id,
      serviceTypeName: appointment?.service_type_name,
      offerings,
      unitsLabel: form.units_label,
      unitsUsed: form.units_used,
    });
  }, [
    appointment?.service,
    appointment?.service_type_id,
    appointment?.service_type_name,
    offerings,
    isCombinedInjectable,
    form.units_label,
    form.units_used,
  ]);

  const logForm = useMemo(() => {
    if (isCombinedInjectable) return combinedInjectableLogFormConfig();
    return logTreatmentFormConfig(menuOffering?.data?.pricing_model || "", appointment?.service);
  }, [isCombinedInjectable, menuOffering?.data?.pricing_model, appointment?.service]);

  const areaSuggestions = useMemo(() => {
    if (isCombinedInjectable) {
      return combinedInjectableAreaSuggestions(offerings, appointment?.service_type_id);
    }
    return areasForInjectableOffering(menuOffering);
  }, [isCombinedInjectable, offerings, appointment?.service_type_id, menuOffering]);

  const liveEstimate = useMemo(() => {
    if (isCombinedInjectable && combinedBundle) {
      return calculateCombinedInjectableTotal({
        toxOffering: combinedBundle.tox.data,
        fillerOffering: combinedBundle.filler.data,
        unitsUsed: form.units_used,
        syringesUsed: form.syringes_used,
        areasTreated: areas,
      });
    }
    if (!menuOffering?.data) return null;
    const menuHint = menuOffering.data.pricing_model || "";
    const chargeModes = buildAutoInvoiceChargeModes({
      menuPricingHint: menuHint,
      capabilities: logForm,
      unitsUsed: form.units_used,
      areasTreated: areas,
    });
    return calculateTreatmentTotal({
      offering: menuOffering.data,
      pricingModel: menuOffering.pricingModel,
      unitsUsed: form.units_used,
      areasTreated: areas,
      chargeModes,
    });
  }, [
    isCombinedInjectable,
    combinedBundle,
    menuOffering,
    logForm,
    form.units_used,
    form.syringes_used,
    areas,
  ]);

  useEffect(() => {
    if (!open || !menuOffering || existingRecord) return;
    const defaultLabel = defaultUnitLabelForMenu(
      menuOffering?.pricingModel,
      menuOffering?.data?.pricing_model || ""
    );
    setForm((prev) =>
      prev.units_label === defaultLabel ? prev : { ...prev, units_label: defaultLabel }
    );
  }, [open, menuOffering?.key, menuOffering?.pricingModel, menuOffering?.data?.pricing_model, existingRecord]);

  useEffect(() => {
    if (!open || !appointment?.patient_id) {
      if (!open) setPatientJourney(null);
      return;
    }
    let cancelled = false;
    base44.entities.PatientJourney.filter({ patient_id: appointment.patient_id })
      .then((journeys) => {
        if (!cancelled) setPatientJourney(journeys[0] || null);
      })
      .catch(() => {
        if (!cancelled) setPatientJourney(null);
      });
    return () => {
      cancelled = true;
    };
  }, [appointment?.patient_id, open]);

  // Autofill from appointment
  useEffect(() => {
    if (!open) return;
    if (existingRecord) {
      const billing = billingQuantitiesForForm(
        existingRecord.units_used || "",
        isCombinedInjectableLog(offerings, appointment?.service_type_id)
      );
      setForm({
        units_used: billing.units_used,
        syringes_used: billing.syringes_used,
        units_label: existingRecord.units_label || "units",
        clinical_notes: existingRecord.clinical_notes || "",
        adverse_reaction: existingRecord.adverse_reaction || false,
        adverse_reaction_notes: existingRecord.adverse_reaction_notes || "",
      });
      setProducts(
        existingRecord.products_used?.length
          ? existingRecord.products_used.map((product) => ({ ...EMPTY_PRODUCT, ...product }))
          : [{ ...EMPTY_PRODUCT }]
      );
      setAreas(existingRecord.areas_treated || []);
      setBeforePhotos(existingRecord.before_photo_urls || []);
      setAfterPhotos(existingRecord.after_photo_urls || []);
    } else if (appointment) {
      setForm({
        units_used: "",
        syringes_used: "",
        units_label: "units",
        clinical_notes: "",
        adverse_reaction: false,
        adverse_reaction_notes: "",
      });
      setProducts([{ ...EMPTY_PRODUCT }]);
      setAreas([]);
      setBeforePhotos([]);
      setAfterPhotos([]);
    }
  }, [open, appointment, existingRecord, offerings]);

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const updateProduct = (index, patch) => {
    setProducts((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleProductSelect = (index, value) => {
    if (value === "__other__") {
      updateProduct(index, {
        product_name: "",
        manufacturer_id: "",
        manufacturer_name: "",
      });
      return;
    }

    if (!value) {
      updateProduct(index, {
        product_name: "",
        manufacturer_id: "",
        manufacturer_name: "",
      });
      return;
    }

    const option = inventoryOptions.find((item) => item.key === value);
    if (!option) return;

    updateProduct(index, {
      product_name: option.product_name,
      manufacturer_id: option.manufacturer_id,
      manufacturer_name: option.manufacturer_name,
    });
  };

  const uploadPhoto = async (file, type) => {
    setUploading(u => ({ ...u, [type]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (type === "before") setBeforePhotos(p => [...p, file_url]);
    else setAfterPhotos(p => [...p, file_url]);
    setUploading(u => ({ ...u, [type]: false }));
  };

  const isResubmitMode =
    existingRecord?.status === "flagged" || existingRecord?.status === "changes_requested";

  const save = useMutation({
    mutationFn: async (status) => {
      const me = await base44.auth.me();
      const {
        syringes_used: _syringes,
        units_used: _units,
        units_label: _label,
        ...restForm
      } = form;
      const payload = {
        appointment_id: appointment.id,
        provider_id: appointment.provider_id,
        provider_name: appointment.provider_name,
        provider_email: appointment.provider_email,
        patient_id: appointment.patient_id,
        patient_name: appointment.patient_name,
        patient_email: appointment.patient_email,
        service: appointment.service,
        treatment_date: appointment.appointment_date,
        areas_treated: areas,
        products_used: sanitizeProductsUsed(products),
        before_photo_urls: beforePhotos,
        after_photo_urls: afterPhotos,
        gfe_status: appointment.gfe_status || null,
        gfe_exam_url: appointment.gfe_exam_url || null,
        status,
        ...restForm,
        units_label: isCombinedInjectable ? "units" : form.units_label,
        units_used: serializeBillingQuantities({
          units: form.units_used,
          syringes: form.syringes_used,
          isCombined: isCombinedInjectable,
        }),
      };
      let record;
      if (existingRecord) {
        const updatePayload = { ...payload };
        if (status === "submitted" && isResubmitMode) {
          updatePayload.md_reviewed_by = null;
          updatePayload.md_reviewed_at = null;
        }
        record = await base44.entities.TreatmentRecord.update(existingRecord.id, updatePayload);
      } else {
        record = await base44.entities.TreatmentRecord.create(payload);
      }
      // Escalate adverse reactions automatically
      if (status === 'submitted' && payload.adverse_reaction) {
        await base44.functions.invoke('adverseReactionEscalation', { treatment_record_id: record.id });
      }
      return record;
    },
    onSuccess: (record, status) => {
      qc.invalidateQueries({ queryKey: ["treatment-records"] });
      qc.invalidateQueries({ queryKey: ["md-treatment-records"] });
      qc.invalidateQueries({ queryKey: ["my-appointments"] });
      qc.invalidateQueries({ queryKey: ["my-treatment-records-mktplace"] });
      qc.invalidateQueries({ queryKey: ["my-treatment-records-spend"] });
      if (status === "submitted" && !treatmentAlreadyPaid) {
        setSavedRecord(record);
        setShowCheckout(true);
      }
    },
  });

  const handleSubmitForInvoice = async () => {
    try {
      const record = await save.mutateAsync("submitted");
      if (treatmentAlreadyPaid) {
        toast({
          title: "Treatment record saved",
          description: "The patient has already paid this treatment balance. The invoice cannot be changed.",
        });
        qc.invalidateQueries({ queryKey: ["my-appointments"] });
        onClose();
        return;
      }
      setSavedRecord(record);
      setShowCheckout(true);
    } catch {
      /* mutation error surfaced by react-query / UI */
    }
  };

  if (!appointment) return null;

  return (
    <>
    <Dialog open={open && !showCheckout} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
            {isResubmitMode ? "Update & Resubmit Treatment Record" : "Document Treatment"}
          </DialogTitle>
        </DialogHeader>

        {/* Autofilled header */}
        <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: "#F0EDE8" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: "#243257" }}>{appointment.service}</span>
            <Badge className="text-xs border-0" style={{ background: "rgba(107,125,179,0.15)", color: "#6B7DB3" }}>{appointment.appointment_date}</Badge>
            {patientJourney && (
              <Badge className="text-xs font-bold border-0" style={{ background: "rgba(200,230,60,0.2)", color: "#5a7a20", border: "1px solid rgba(200,230,60,0.35)" }}>
                Premium Patient
              </Badge>
            )}
          </div>
          <p className="text-xs" style={{ color: "#9a8f7e" }}>Patient: {appointment.patient_name || appointment.patient_email}</p>
        </div>

        {/* Premium Aftercare Notice */}
        {patientJourney && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(200,230,60,0.08)", border: "1px solid rgba(200,230,60,0.2)" }}>
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#5a7a20" }} />
            <div className="flex-1">
              <p className="text-xs font-semibold" style={{ color: "#5a7a20" }}>Aftercare Plan Available</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(0,0,0,0.55)" }}>
                After submitting this treatment record, you'll be able to create a personalized aftercare plan with AI-generated recommendations for this premium patient.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5 pt-1">
          {treatmentAlreadyPaid && (
            <div className="rounded-xl px-4 py-3" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>Treatment balance paid</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#5a7a20" }}>
                The patient has already paid
                {appointment.treatment_amount ? ` ${formatUsd(appointment.treatment_amount)}` : ""}.
                You can update the clinical record, but you cannot send a new payment link.
              </p>
            </div>
          )}
          {treatmentAwaitingPayment && !treatmentAlreadyPaid && (
            <div className="rounded-xl px-4 py-3" style={{ background: "rgba(200,230,60,0.12)", border: "1px solid rgba(200,230,60,0.35)" }}>
              <p className="text-xs font-semibold" style={{ color: "#5a7a20" }}>Invoice sent — awaiting patient payment</p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(0,0,0,0.55)" }}>
                You can edit this record and send an updated payment link if the amount changed (before they pay).
              </p>
            </div>
          )}

          {isCombinedInjectable && combinedBundle ? (
            <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.25)" }}>
              <p className="text-xs font-semibold" style={{ color: "#243257" }}>
                Injectables (combined) — from your treatment menu
              </p>
              <p className="text-[11px]" style={{ color: "#6B7DB3" }}>
                Neurotoxin: {combinedBundle.tox.data?.pricing_model || "Per unit"}
                {combinedBundle.tox.data?.price ? ` · $${combinedBundle.tox.data.price}` : ""}
                {combinedBundle.tox.data?.price_per_area ? ` · $${combinedBundle.tox.data.price_per_area}/area` : ""}
                {" · "}
                Dermal filler: {combinedBundle.filler.data?.pricing_model || "Per syringe"}
                {combinedBundle.filler.data?.price ? ` · $${combinedBundle.filler.data.price}` : ""}
                {combinedBundle.filler.data?.price_per_area ? ` · $${combinedBundle.filler.data.price_per_area}/area` : ""}
              </p>
              <p className="text-[11px]" style={{ color: "#6B7DB3" }}>{logForm.logHelper}</p>
            </div>
          ) : logForm.menuPricingHint ? (
            <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: "rgba(123,142,200,0.1)", border: "1px solid rgba(123,142,200,0.25)" }}>
              <p className="text-xs font-semibold" style={{ color: "#243257" }}>
                From your treatment menu
                {menuOffering?.subLabel ? ` · ${menuOffering.subLabel}` : ""}: {logForm.menuPricingHint}
                {menuOffering?.data?.price ? ` · $${menuOffering.data.price}` : ""}
                {menuOffering?.data?.price_per_area ? ` · $${menuOffering.data.price_per_area}/area` : ""}
              </p>
              <p className="text-[11px]" style={{ color: "#6B7DB3" }}>{logForm.logHelper}</p>
            </div>
          ) : (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(250,111,48,0.08)", color: "#9a8f7e" }}>
              Set pricing on Practice → Treatment Menu for this service so logging and checkout auto-calculate.
            </p>
          )}

          {open && (
            <div
              className="rounded-xl px-4 py-3 space-y-2"
              style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.25)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#FA6F30" }}>
                Estimated invoice (from your menu)
              </p>
              {menuLoading ? (
                <p className="text-xs" style={{ color: "#9a8f7e" }}>
                  Loading your menu prices…
                </p>
              ) : liveEstimate?.lines?.length > 0 ? (
                <>
                  {liveEstimate.lines.map((line, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span style={{ color: "#243257" }}>
                        {line.label}
                        {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                        {line.unit_price ? ` @ ${formatUsd(line.unit_price)}` : ""}
                      </span>
                      <span className="font-semibold" style={{ color: "#243257" }}>
                        {formatUsd(line.amount)}
                      </span>
                    </div>
                  ))}
                  <div
                    className="flex justify-between text-sm pt-1 border-t font-semibold"
                    style={{ borderColor: "rgba(250,111,48,0.2)", color: "#243257" }}
                  >
                    <span>Subtotal</span>
                    <span style={{ color: "#FA6F30" }}>{formatUsd(liveEstimate.total)}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: "#9a8f7e" }}>
                  {logForm.menuPrimary === "area"
                    ? "Select areas treated to see the calculated total."
                    : logForm.showAmountOnLog
                      ? `Enter ${logForm.quantityLabel?.toLowerCase() || "quantity"} to see the calculated total.`
                      : "Flat fee from your menu will apply at checkout."}
                </p>
              )}
            </div>
          )}

          {logForm.injectableCombined && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Number of units (neurotoxin)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 20"
                  value={form.units_used || ""}
                  onChange={(e) => f("units_used", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Number of syringes (filler)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 2"
                  value={form.syringes_used || ""}
                  onChange={(e) => f("syringes_used", e.target.value)}
                />
              </div>
            </div>
          )}

          {logForm.showAmountOnLog && !logForm.injectableCombined && (
            <div className="space-y-1.5">
              <Label className="text-xs">{logForm.quantityLabel}</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder={logForm.quantityPlaceholder || "e.g. 1"}
                value={form.units_used || ""}
                onChange={(e) => f("units_used", e.target.value)}
              />
              {logForm.quantityBillingNote && (
                <p className="text-[10px]" style={{ color: "#9a8f7e" }}>
                  {logForm.quantityBillingNote}
                </p>
              )}
            </div>
          )}

          {logForm.showAreasOnLog && (
            <AreasTreatedField
              areas={areas}
              onChange={setAreas}
              suggestions={areaSuggestions}
              optional={!logForm.showAreasBeforeQuantity && logForm.menuPrimary !== "area"}
            />
          )}

          {/* Products Used */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Products Used</Label>
              <button type="button" onClick={() => setProducts(p => [...p, { ...EMPTY_PRODUCT }])}
                className="text-xs flex items-center gap-1" style={{ color: "#FA6F30" }}>
                <Plus className="w-3 h-3" /> Add Product
              </button>
            </div>
            {inventoryOptions.length === 0 && (
              <p className="text-xs" style={{ color: "#9a8f7e" }}>
                Place orders through the Supplier Network to pick products from your inventory here.
              </p>
            )}
            {products.map((p, i) => {
              const selectValue = getInventoryProductSelectValue(p, inventoryOptions);
              const showManualName = inventoryOptions.length === 0 || selectValue === "__other__";

              return (
                <div key={i} className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 items-start">
                    <div className="space-y-1.5">
                      {inventoryOptions.length > 0 ? (
                        <select
                          value={selectValue}
                          onChange={(e) => handleProductSelect(i, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-md text-sm h-8 outline-none"
                          style={{ background: "#fff", border: "1px solid rgba(198,190,168,0.6)", color: "#243257" }}
                        >
                          <option value="">Select product...</option>
                          {Object.entries(inventoryBySupplier).map(([supplierName, options]) => (
                            <optgroup key={supplierName} label={supplierName}>
                              {options.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.product_name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <option value="__other__">Other (type below)</option>
                        </select>
                      ) : (
                        <Input
                          placeholder="Product name"
                          className="text-sm h-8"
                          value={p.product_name}
                          onChange={(e) => updateProduct(i, { product_name: e.target.value })}
                        />
                      )}
                      {showManualName && inventoryOptions.length > 0 && (
                        <Input
                          placeholder="Product name"
                          className="text-sm h-8"
                          value={p.product_name}
                          onChange={(e) => updateProduct(i, {
                            product_name: e.target.value,
                            manufacturer_id: "",
                            manufacturer_name: "",
                          })}
                        />
                      )}
                      {p.manufacturer_name && !showManualName && (
                        <p className="text-[10px] truncate" style={{ color: "#9a8f7e" }}>
                          {p.manufacturer_name}
                        </p>
                      )}
                    </div>
                    <Input placeholder="Batch/Lot #" className="text-sm h-8" value={p.batch_lot} onChange={e => updateProduct(i, { batch_lot: e.target.value })} />
                    <div className="flex gap-1">
                      <Input placeholder="mL, mg, etc." className="text-sm h-8" value={p.amount} onChange={e => updateProduct(i, { amount: e.target.value })} />
                      {products.length > 1 && (
                        <button type="button" onClick={() => setProducts(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clinical Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>Clinical Notes</Label>
            <Textarea
              placeholder="Describe technique, patient response, follow-up instructions given..."
              rows={4}
              value={form.clinical_notes || ""}
              onChange={e => f("clinical_notes", e.target.value)}
            />
          </div>

          {/* Adverse Reaction */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: form.adverse_reaction ? "rgba(239,68,68,0.06)" : "#F0EDE8", border: form.adverse_reaction ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent" }}>
              <Switch checked={form.adverse_reaction || false} onCheckedChange={v => f("adverse_reaction", v)} />
              <div className="flex-1">
                <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: form.adverse_reaction ? "#dc2626" : "#243257" }}>
                  {form.adverse_reaction && <AlertTriangle className="w-4 h-4" />}
                  Adverse Reaction Occurred
                </p>
              </div>
            </div>
            {form.adverse_reaction && (
              <Textarea
                placeholder="Describe the adverse reaction, severity, and steps taken..."
                rows={3}
                value={form.adverse_reaction_notes || ""}
                onChange={e => f("adverse_reaction_notes", e.target.value)}
                className="border-red-200"
              />
            )}
          </div>

          {/* Photos */}
          <div className="grid grid-cols-2 gap-4">
            {["before", "after"].map(type => {
              const photos = type === "before" ? beforePhotos : afterPhotos;
              const isUploading = uploading[type];
              return (
                <div key={type} className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-widest capitalize" style={{ color: "#DA6A63" }}>{type} Photos</Label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => type === "before" ? setBeforePhotos(p => p.filter((_, j) => j !== i)) : setAfterPhotos(p => p.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white text-[10px]"
                        >×</button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                      style={{ borderColor: "#C6BEA8" }}>
                      {isUploading ? <span className="text-[10px] text-center" style={{ color: "#9a8f7e" }}>...</span> : <Upload className="w-4 h-4" style={{ color: "#C6BEA8" }} />}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0], type)} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Show MD feedback if flagged/changes_requested */}
        {existingRecord?.md_review_notes && ["flagged","changes_requested"].includes(existingRecord?.status) && (
          <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(250,111,48,0.06)", border: "1px solid rgba(250,111,48,0.25)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#FA6F30" }}>MD Feedback ({existingRecord.status === "flagged" ? "Flagged" : "Changes Requested"})</p>
            <p className="text-sm" style={{ color: "#243257" }}>{existingRecord.md_review_notes}</p>
            <p className="text-xs mt-1" style={{ color: "#9a8f7e" }}>Address the feedback above then resubmit.</p>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2" style={{ borderTop: "1px solid rgba(198,190,168,0.3)" }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => save.mutate("draft")} disabled={save.isPending}>
            Save Draft
          </Button>
          <Button style={{ background: "#FA6F30", color: "#fff" }} onClick={handleSubmitForInvoice} disabled={save.isPending}>
            <CheckCircle className="w-4 h-4 mr-1.5" />
            {existingRecord?.status === "flagged" || existingRecord?.status === "changes_requested"
              ? "Resubmit for MD Review"
              : treatmentAlreadyPaid
                ? "Save treatment record"
                : treatmentAwaitingPayment
                  ? "Update & resend invoice"
                  : "Save & Send Treatment Invoice"}
          </Button>
        </div>
      </DialogContent>

      {savedRecord && (
        <AftercarePlanDialog
          open={showAftercarePlan}
          onClose={() => {
            setShowAftercarePlan(false);
            setSavedRecord(null);
            onClose();
          }}
          treatmentRecord={savedRecord}
        />
      )}
    </Dialog>

    {savedRecord && (
      <TreatmentCheckoutDialog
        open={showCheckout}
        onClose={() => {
          setShowCheckout(false);
          if (patientJourney) {
            setShowAftercarePlan(true);
          } else {
            setSavedRecord(null);
            onClose();
          }
        }}
        appointment={appointment}
        treatmentRecord={savedRecord}
        providerProfile={providerProfile}
        onSent={() => {
          setShowCheckout(false);
          if (patientJourney) {
            setShowAftercarePlan(true);
          } else {
            setSavedRecord(null);
            onClose();
          }
        }}
      />
    )}
    </>
  );
}