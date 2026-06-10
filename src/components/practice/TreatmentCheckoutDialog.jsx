import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appointmentsApi } from "@/api/appointmentsApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Send, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  PRICING_MODEL,
  applyTreatmentDiscount,
  buildAutoInvoiceChargeModes,
  calculateCombinedInjectableTotal,
  calculateTreatmentTotal,
  checkoutTogglesFromChargeModes,
  treatmentAmountDue,
  formatUsd,
  getCombinedInjectableMenus,
  logTreatmentFormConfig,
  maxPriceCapValidationError,
  menuRatesFromOffering,
  parseBillingQuantities,
  pricingModelLabel,
  resolveOfferingForAppointment,
} from "@/lib/treatmentPricing";
import { fetchStripeConnectStatus } from "@/lib/stripeConnectApi";
import { computeTreatmentPaymentBreakdown, GFE_FEE_LINE_LABEL } from "@/lib/gfePlatformFee";

export default function TreatmentCheckoutDialog({
  open,
  onClose,
  appointment,
  treatmentRecord,
  providerProfile,
  onSent,
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    enabled: open,
    staleTime: 10 * 60 * 1000,
    placeholderData: () => providerProfile ?? qc.getQueryData(["me"]),
    initialData: providerProfile ?? undefined,
  });
  const offerings = (me ?? providerProfile)?.service_offerings_v2 || {};
  const { data: connectStatus } = useQuery({
    queryKey: ["stripe-connect-status", "checkout-fee-bps"],
    queryFn: () => fetchStripeConnectStatus({ live: false }),
    enabled: open,
    staleTime: 60_000,
  });
  const combinedBundle = useMemo(
    () => getCombinedInjectableMenus(offerings, appointment?.service_type_id),
    [offerings, appointment?.service_type_id]
  );
  const isCombined = Boolean(combinedBundle);

  const billingQty = useMemo(
    () => parseBillingQuantities(treatmentRecord || {}),
    [treatmentRecord]
  );

  const resolved = useMemo(() => {
    if (isCombined) return null;
    return resolveOfferingForAppointment({
      serviceLabel: appointment?.service,
      serviceTypeId: appointment?.service_type_id,
      serviceTypeName: appointment?.service_type_name,
      offerings,
      unitsLabel: treatmentRecord?.units_label,
      unitsUsed: billingQty.units || treatmentRecord?.units_used,
    });
  }, [appointment, offerings, treatmentRecord, isCombined, billingQty.units]);

  const menuPricingHint = resolved?.data?.pricing_model || "";
  const logForm = useMemo(
    () =>
      isCombined
        ? { injectableCombined: true, unit: true, area: true, flat: false }
        : logTreatmentFormConfig(menuPricingHint, appointment?.service),
    [isCombined, menuPricingHint, appointment?.service]
  );

  const unitsUsed = billingQty.units ?? "";
  const syringesUsed = billingQty.syringes ?? "";
  const areasTreated = treatmentRecord?.areas_treated || [];

  const autoChargeModes = useMemo(
    () =>
      buildAutoInvoiceChargeModes({
        menuPricingHint,
        capabilities: logForm,
        unitsUsed,
        areasTreated,
      }),
    [menuPricingHint, logForm, unitsUsed, areasTreated]
  );

  const menuRates = useMemo(() => {
    if (isCombined && combinedBundle) {
      const tox = menuRatesFromOffering(combinedBundle.tox.data);
      const filler = menuRatesFromOffering(combinedBundle.filler.data);
      return {
        unitRate: tox.unitRate,
        fillerUnitRate: filler.unitRate,
        areaRate: Math.max(tox.areaRate, filler.areaRate),
        flatAmount: 0,
      };
    }
    return menuRatesFromOffering(resolved?.data || {});
  }, [isCombined, combinedBundle, resolved?.data]);

  const [chargeUnit, setChargeUnit] = useState(false);
  const [chargeArea, setChargeArea] = useState(false);
  const [chargeFlat, setChargeFlat] = useState(false);
  const [unitRate, setUnitRate] = useState("");
  const [areaRate, setAreaRate] = useState("");
  const [flatAmount, setFlatAmount] = useState("");
  const [finalTotal, setFinalTotal] = useState("");
  const [manualTotal, setManualTotal] = useState(false);
  const [discount, setDiscount] = useState("");

  useEffect(() => {
    if (!open) return;
    const toggles = checkoutTogglesFromChargeModes(autoChargeModes, logForm);
    setUnitRate(String(menuRates.unitRate || ""));
    setAreaRate(String(menuRates.areaRate || ""));
    setFlatAmount(String(menuRates.flatAmount || ""));
    setChargeUnit(toggles.chargeUnit);
    setChargeArea(toggles.chargeArea);
    setChargeFlat(toggles.chargeFlat);
    setManualTotal(false);
    setFinalTotal("");
    setDiscount("");
  }, [open, resolved?.key, autoChargeModes, menuRates, logForm]);

  const chargeModes = useMemo(() => {
    const modes = [];
    if (chargeUnit && logForm.unit) modes.push(PRICING_MODEL.UNIT);
    if (chargeArea && logForm.area) modes.push(PRICING_MODEL.AREA);
    if (chargeFlat && logForm.flat) modes.push(PRICING_MODEL.FLAT);
    return modes.length ? modes : autoChargeModes;
  }, [chargeUnit, chargeArea, chargeFlat, logForm, autoChargeModes]);

  const calc = useMemo(() => {
    if (isCombined && combinedBundle) {
      return calculateCombinedInjectableTotal({
        toxOffering: combinedBundle.tox.data,
        fillerOffering: combinedBundle.filler.data,
        unitsUsed,
        syringesUsed,
        areasTreated,
      });
    }
    return calculateTreatmentTotal({
      offering: resolved?.data || {},
      pricingModel: resolved?.pricingModel,
      unitsUsed,
      areasTreated,
      chargeModes,
      unitRate: unitRate === "" ? undefined : unitRate,
      areaRate: areaRate === "" ? undefined : areaRate,
      flatAmount: flatAmount === "" ? undefined : flatAmount,
    });
  }, [
    isCombined,
    combinedBundle,
    resolved,
    unitsUsed,
    syringesUsed,
    areasTreated,
    chargeModes,
    unitRate,
    areaRate,
    flatAmount,
  ]);

  const maxPriceError = useMemo(
    () => maxPriceCapValidationError(calc),
    [calc]
  );

  const computedTotal = manualTotal && finalTotal !== "" ? Number(finalTotal) || 0 : calc.total;
  const { discount: discountApplied, totalAfterDiscount } = useMemo(
    () => applyTreatmentDiscount(computedTotal, discount),
    [computedTotal, discount]
  );
  const depositCredit = useMemo(() => {
    const status = String(appointment?.payment_status || "").toLowerCase();
    if (status !== "paid") return 0;
    return Number(appointment?.amount_paid || appointment?.deposit_amount || 0) || 0;
  }, [appointment]);

  const amountDue = treatmentAmountDue({
    subtotal: computedTotal,
    discount: discountApplied,
    depositPaid: depositCredit,
  });

  const paymentBreakdown = useMemo(
    () =>
      computeTreatmentPaymentBreakdown({
        treatmentAmount: amountDue,
        requiresGfe: appointment?.requires_gfe === true,
        chargeGfeFee: appointment?.gfe_fee_applies === true,
        gfePlatformFeeUsd:
          connectStatus?.gfe_platform_fee_usd ??
          (connectStatus?.gfe_platform_fee_cents != null
            ? connectStatus.gfe_platform_fee_cents / 100
            : 29),
      }),
    [
      amountDue,
      appointment?.requires_gfe,
      appointment?.gfe_fee_applies,
      connectStatus?.gfe_platform_fee_usd,
      connectStatus?.gfe_platform_fee_cents,
    ]
  );

  const sendPayment = useMutation({
    mutationFn: () =>
      appointmentsApi.requestTreatmentPayment(appointment.id, {
        treatment_record_id: treatmentRecord?.id,
        amount_due: amountDue,
        discount: discountApplied,
        total_amount: totalAfterDiscount,
        invoice: {
          lines: calc.lines,
          subtotal: calc.subtotal,
          total: computedTotal,
          discount: discountApplied,
          total_after_discount: totalAfterDiscount,
          deposit_credit: depositCredit,
          amount_due: amountDue,
          charge_modes: chargeModes,
          menu_pricing_model: menuPricingHint,
          offering_key: resolved?.key || null,
          menu_sub_label: resolved?.subLabel || null,
          units_used: unitsUsed,
          areas_treated: areasTreated,
          unit_rate: unitRate,
          area_rate: areaRate,
          flat_amount: flatAmount,
          manual_override: manualTotal,
        },
      }),
    onSuccess: () => {
      const chargeTotal = paymentBreakdown.totalChargeAmount;
      const feeNote =
        paymentBreakdown.feeApplied ? ` (includes ${formatUsd(paymentBreakdown.platformFeeAmount)} ${GFE_FEE_LINE_LABEL})` : "";
      toast({
        title: "Payment link sent",
        description: `Patient will be notified to pay ${formatUsd(chargeTotal)}${feeNote}.`,
        duration: 6000,
      });
      onSent?.();
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Could not send invoice",
        description: String(err?.message || "Try again."),
        variant: "destructive",
      });
    },
  });

  if (!appointment || !treatmentRecord) return null;

  const treatmentAlreadyPaid =
    String(appointment?.treatment_payment_status || "").toLowerCase() === "paid";

  const hasMenuPrice = isCombined
    ? menuRates.unitRate > 0 || menuRates.fillerUnitRate > 0 || menuRates.areaRate > 0
    : menuRates.unitRate > 0 || menuRates.areaRate > 0 || menuRates.flatAmount > 0;
  const menuHint = hasMenuPrice
    ? isCombined
      ? "Auto-calculated from your combined injectable menu (neurotoxin + dermal filler)."
      : `Auto-calculated from treatment menu (${menuPricingHint || "pricing"}) for ${resolved?.subLabel || appointment.service}`
    : "No treatment menu price found — set starting price on Practice → Treatment Menu, or use override total.";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", color: "#243257" }}>
            Treatment Checkout
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs rounded-xl px-3 py-2" style={{ background: "#F0EDE8", color: "#6B7DB3" }}>
          {appointment.service} · {appointment.patient_name || appointment.patient_email}
        </p>
        <p className="text-[11px]" style={{ color: hasMenuPrice ? "#5a7a20" : "#9a8f7e" }}>{menuHint}</p>

        {treatmentAlreadyPaid && (
          <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>
            This treatment has already been paid. A new payment link cannot be sent.
          </p>
        )}

        {!isCombined && (hasMenuPrice || calc.lines.length > 0) && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>
              Adjust charges (optional)
            </p>
            <p className="text-[10px]" style={{ color: "#9a8f7e" }}>
              Toggles and rates are pre-filled from your menu and what you logged. Change only if this visit differs.
            </p>
            <div className="flex flex-wrap gap-3">
              {logForm.unit && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={chargeUnit} onCheckedChange={setChargeUnit} />
                  {logForm.unitChargeLabel}
                </label>
              )}
              {logForm.area && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={chargeArea} onCheckedChange={setChargeArea} />
                  {pricingModelLabel(PRICING_MODEL.AREA)}
                </label>
              )}
              {logForm.flat && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={chargeFlat} onCheckedChange={setChargeFlat} />
                  {pricingModelLabel(PRICING_MODEL.FLAT)}
                </label>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {chargeUnit && logForm.unit && (
                <div className="space-y-1">
                  <Label className="text-[10px]">Rate / {logForm.unitChargeLabel.replace("Per ", "")} ($)</Label>
                  <Input type="number" value={unitRate} onChange={(e) => setUnitRate(e.target.value)} className="h-8 text-sm" />
                </div>
              )}
              {chargeArea && logForm.area && (
                <div className="space-y-1">
                  <Label className="text-[10px]">Rate / area ($)</Label>
                  <Input type="number" value={areaRate} onChange={(e) => setAreaRate(e.target.value)} className="h-8 text-sm" />
                </div>
              )}
              {chargeFlat && logForm.flat && (
                <div className="space-y-1">
                  <Label className="text-[10px]">Flat fee ($)</Label>
                  <Input type="number" value={flatAmount} onChange={(e) => setFlatAmount(e.target.value)} className="h-8 text-sm" />
                </div>
              )}
            </div>
          </div>
        )}

        {calc.lines.length > 0 ? (
          <div
            className="rounded-xl px-4 py-3 space-y-2"
            style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6B7DB3" }}>
              Breakdown
            </p>
            {calc.lines.map((line, i) => (
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
              className="flex justify-between text-sm pt-1 border-t"
              style={{ borderColor: "rgba(123,142,200,0.2)" }}
            >
              <span style={{ color: "#6B7DB3" }}>Subtotal</span>
              <span className="font-semibold">{formatUsd(calc.subtotal)}</span>
            </div>
            {calc.priceCapApplied && (
              <>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "#6B7DB3" }}>
                    Menu max price ({formatUsd(calc.maxPrice)})
                  </span>
                  <span style={{ color: "#6B7DB3" }}>
                    −{formatUsd(calc.priceCapReduction)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span style={{ color: "#243257" }}>Total</span>
                  <span>{formatUsd(calc.total)}</span>
                </div>
              </>
            )}
            {maxPriceError && !manualTotal && (
              <div
                className="rounded-lg px-3 py-2.5 text-xs mt-1"
                style={{ background: "rgba(254,226,226,0.85)", border: "1px solid rgba(220,38,38,0.35)", color: "#991b1b" }}
              >
                {maxPriceError}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#F0EDE8", color: "#9a8f7e" }}>
            {logForm.menuPrimary === "area"
              ? "Select areas on the treatment record to calculate."
              : logForm.menuPrimary === "flat"
                ? "Enable flat fee above to use your menu price."
                : "Enter units/syringes on the treatment record to calculate."}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Override total</Label>
            <Switch checked={manualTotal} onCheckedChange={setManualTotal} />
          </div>
          {manualTotal && (
            <Input
              type="number"
              min="0"
              placeholder="Custom total before discount"
              value={finalTotal}
              onChange={(e) => setFinalTotal(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold" style={{ color: "#DA6A63" }}>
            Discount ($)
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 25 — optional"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>

        {depositCredit > 0 && (
          <p className="text-xs" style={{ color: "#5a7a20" }}>
            Booking deposit already paid: −{formatUsd(depositCredit)}
          </p>
        )}

        <div
          className="rounded-xl px-4 py-3 space-y-2"
          style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.25)" }}
        >
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: "#243257" }}>Treatment</span>
            <span className="font-semibold" style={{ color: "#243257" }}>
              {formatUsd(amountDue)}
            </span>
          </div>
          {paymentBreakdown.feeApplied && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "#243257" }}>{GFE_FEE_LINE_LABEL}</span>
              <span className="font-semibold" style={{ color: "#243257" }}>
                {formatUsd(paymentBreakdown.platformFeeAmount)}
              </span>
            </div>
          )}
          <div
            className="flex items-center justify-between pt-2 border-t"
            style={{ borderColor: "rgba(250,111,48,0.2)" }}
          >
            <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#243257" }}>
              <DollarSign className="w-4 h-4" style={{ color: "#FA6F30" }} />
              Patient pays
            </span>
            <span className="text-xl font-bold" style={{ color: "#FA6F30" }}>
              {formatUsd(paymentBreakdown.totalChargeAmount)}
            </span>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Skip for now
          </Button>
          <Button
            style={{ background: "#FA6F30", color: "#fff" }}
            disabled={sendPayment.isPending || amountDue <= 0 || treatmentAlreadyPaid || (Boolean(maxPriceError) && !manualTotal)}
            onClick={() => sendPayment.mutate()}
          >
            {sendPayment.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1.5" />
                Send Payment Link
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
