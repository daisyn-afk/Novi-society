import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  calculateTreatmentTotal,
  treatmentAmountDue,
  defaultChargeModesForModel,
  formatUsd,
  pricingModelLabel,
  resolveOfferingForAppointment,
} from "@/lib/treatmentPricing";

export default function TreatmentCheckoutDialog({
  open,
  onClose,
  appointment,
  treatmentRecord,
  providerProfile,
  onSent,
}) {
  const { toast } = useToast();
  const offerings = providerProfile?.service_offerings_v2 || {};

  const resolved = useMemo(
    () =>
      resolveOfferingForAppointment({
        serviceLabel: appointment?.service,
        serviceTypeId: appointment?.service_type_id,
        serviceTypeName: appointment?.service_type_name,
        offerings,
      }),
    [appointment, offerings]
  );

  const menuModel = resolved?.pricingModel || PRICING_MODEL.FLAT;
  const [chargeUnit, setChargeUnit] = useState(menuModel === PRICING_MODEL.UNIT);
  const [chargeArea, setChargeArea] = useState(menuModel === PRICING_MODEL.AREA);
  const [chargeFlat, setChargeFlat] = useState(
    menuModel === PRICING_MODEL.FLAT || menuModel === PRICING_MODEL.PACKAGE
  );
  const [unitRate, setUnitRate] = useState("");
  const [areaRate, setAreaRate] = useState("");
  const [flatAmount, setFlatAmount] = useState("");
  const [finalTotal, setFinalTotal] = useState("");
  const [manualTotal, setManualTotal] = useState(false);
  const [discount, setDiscount] = useState("");

  const unitsUsed = treatmentRecord?.units_used ?? "";
  const areasTreated = treatmentRecord?.areas_treated || [];

  useEffect(() => {
    if (!open) return;
    const price = resolved?.data?.price ?? "";
    setUnitRate(String(price));
    setAreaRate(String(price));
    setFlatAmount(String(price));
    setChargeUnit(menuModel === PRICING_MODEL.UNIT);
    setChargeArea(menuModel === PRICING_MODEL.AREA);
    setChargeFlat(menuModel === PRICING_MODEL.FLAT || menuModel === PRICING_MODEL.PACKAGE);
    setManualTotal(false);
    setFinalTotal("");
    setDiscount("");
  }, [open, resolved?.data?.price, menuModel]);

  const chargeModes = useMemo(() => {
    const modes = [];
    if (chargeUnit) modes.push(PRICING_MODEL.UNIT);
    if (chargeArea) modes.push(PRICING_MODEL.AREA);
    if (chargeFlat) modes.push(PRICING_MODEL.FLAT);
    return modes.length ? modes : defaultChargeModesForModel(menuModel);
  }, [chargeUnit, chargeArea, chargeFlat, menuModel]);

  const calc = useMemo(
    () =>
      calculateTreatmentTotal({
        offering: resolved?.data || {},
        pricingModel: menuModel,
        unitsUsed,
        areasTreated,
        chargeModes,
        unitRate: unitRate === "" ? undefined : unitRate,
        areaRate: areaRate === "" ? undefined : areaRate,
        flatAmount: flatAmount === "" ? undefined : flatAmount,
      }),
    [resolved, menuModel, unitsUsed, areasTreated, chargeModes, unitRate, areaRate, flatAmount]
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
          menu_pricing_model: resolved?.data?.pricing_model || null,
          units_used: unitsUsed,
          areas_treated: areasTreated,
          unit_rate: unitRate,
          area_rate: areaRate,
          flat_amount: flatAmount,
        },
      }),
    onSuccess: () => {
      toast({
        title: "Payment link sent",
        description: `Patient will be notified to pay ${formatUsd(amountDue)}.`,
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

  const menuHint = resolved?.data?.pricing_model
    ? `Treatment menu: ${resolved.data.pricing_model}`
    : "No treatment menu pricing found — enter amounts manually.";

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
        <p className="text-[11px]" style={{ color: "#9a8f7e" }}>{menuHint}</p>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#DA6A63" }}>
            How to charge
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={chargeUnit} onCheckedChange={setChargeUnit} />
              {pricingModelLabel(PRICING_MODEL.UNIT)}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={chargeArea} onCheckedChange={setChargeArea} />
              {pricingModelLabel(PRICING_MODEL.AREA)}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={chargeFlat} onCheckedChange={setChargeFlat} />
              {pricingModelLabel(PRICING_MODEL.FLAT)}
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {chargeUnit && (
              <div className="space-y-1">
                <Label className="text-[10px]">Rate / unit ($)</Label>
                <Input type="number" value={unitRate} onChange={(e) => setUnitRate(e.target.value)} className="h-8 text-sm" />
              </div>
            )}
            {chargeArea && (
              <div className="space-y-1">
                <Label className="text-[10px]">Rate / area ($)</Label>
                <Input type="number" value={areaRate} onChange={(e) => setAreaRate(e.target.value)} className="h-8 text-sm" />
              </div>
            )}
            {chargeFlat && (
              <div className="space-y-1">
                <Label className="text-[10px]">Flat fee ($)</Label>
                <Input type="number" value={flatAmount} onChange={(e) => setFlatAmount(e.target.value)} className="h-8 text-sm" />
              </div>
            )}
          </div>
        </div>

        {calc.lines.length > 0 && (
          <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: "rgba(123,142,200,0.08)", border: "1px solid rgba(123,142,200,0.2)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6B7DB3" }}>Breakdown</p>
            {calc.lines.map((line, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span style={{ color: "#243257" }}>
                  {line.label}
                  {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                  {line.unit_price ? ` @ ${formatUsd(line.unit_price)}` : ""}
                </span>
                <span className="font-semibold" style={{ color: "#243257" }}>{formatUsd(line.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-1 border-t" style={{ borderColor: "rgba(123,142,200,0.2)" }}>
              <span style={{ color: "#6B7DB3" }}>Subtotal</span>
              <span className="font-semibold">{formatUsd(calc.subtotal)}</span>
            </div>
          </div>
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
          <Label className="text-xs font-semibold" style={{ color: "#DA6A63" }}>Discount ($)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 25 — optional"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <p className="text-[10px]" style={{ color: "#9a8f7e" }}>
            Reduces the treatment total before the booking deposit is applied.
          </p>
        </div>

        {(discountApplied > 0 || depositCredit > 0) && (
          <div className="rounded-xl px-4 py-3 space-y-1.5 text-sm" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(198,190,168,0.4)" }}>
            <div className="flex justify-between">
              <span style={{ color: "#6B7DB3" }}>Treatment total</span>
              <span style={{ color: "#243257" }}>{formatUsd(computedTotal)}</span>
            </div>
            {discountApplied > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "#5a7a20" }}>Discount</span>
                <span style={{ color: "#5a7a20" }}>−{formatUsd(discountApplied)}</span>
              </div>
            )}
            {discountApplied > 0 && (
              <div className="flex justify-between font-semibold">
                <span style={{ color: "#243257" }}>After discount</span>
                <span style={{ color: "#243257" }}>{formatUsd(totalAfterDiscount)}</span>
              </div>
            )}
          </div>
        )}

        {depositCredit > 0 && (
          <p className="text-xs" style={{ color: "#5a7a20" }}>
            Booking deposit already paid: −{formatUsd(depositCredit)}
          </p>
        )}

        <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "rgba(250,111,48,0.08)", border: "1px solid rgba(250,111,48,0.25)" }}>
          <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#243257" }}>
            <DollarSign className="w-4 h-4" style={{ color: "#FA6F30" }} />
            Patient pays
          </span>
          <span className="text-xl font-bold" style={{ color: "#FA6F30" }}>{formatUsd(amountDue)}</span>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Skip for now</Button>
          <Button
            style={{ background: "#FA6F30", color: "#fff" }}
            disabled={sendPayment.isPending || amountDue <= 0}
            onClick={() => sendPayment.mutate()}
          >
            {sendPayment.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending…</>
            ) : (
              <><Send className="w-4 h-4 mr-1.5" />Send Payment Link</>
            )}
          </Button>
        </div>
        {amountDue <= 0 && (
          <p className="text-xs text-center" style={{ color: "#9a8f7e" }}>
            Deposit covers the full amount — no balance due.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
