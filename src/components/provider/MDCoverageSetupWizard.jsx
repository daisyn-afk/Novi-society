import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, FileText, ArrowRight } from "lucide-react";

const STEPS = ["Welcome", "Sign Agreement", "Pricing", "Next Steps"];

export default function MDCoverageSetupWizard({ open, onClose, onComplete, serviceName }) {
  const [step, setStep] = useState(0);

  const finish = () => {
    setStep(0);
    onComplete?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose?.(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif" }}>MD Coverage Setup</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 pb-2">
          {STEPS.map((label, index) => (
            <div key={label} className={`text-xs font-semibold px-2 py-1 rounded-full ${index <= step ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-400"}`}>
              {label}
            </div>
          ))}
        </div>
        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 bg-orange-50 border border-orange-100">
              <p className="text-sm text-slate-700">Your MD Board coverage request for <strong>{serviceName || "your service"}</strong> is in motion. This quick walkthrough explains what happens next.</p>
            </div>
            <Button className="w-full" style={{ background: "#FA6F30", color: "#fff" }} onClick={() => setStep(1)}>Continue</Button>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <FileText className="w-5 h-5 text-orange-500 mt-0.5" />
              <p className="text-sm text-slate-700">Your signed agreement is stored with your MD subscription record. A Board Medical Director will review your supervision request before practice features unlock.</p>
            </div>
            <Button className="w-full" style={{ background: "#FA6F30", color: "#fff" }} onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <Shield className="w-5 h-5 text-orange-500 mt-0.5" />
              <p className="text-sm text-slate-700">Your membership covers NOVI Board oversight, protocol support, and compliance guidance for each active service you add.</p>
            </div>
            <Button className="w-full" style={{ background: "#FA6F30", color: "#fff" }} onClick={() => setStep(3)}>Continue</Button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-sm text-slate-700">Once your Board MD approves supervision, you can launch your practice workflows from the Launch Pad.</p>
            <Button className="w-full gap-2" style={{ background: "#2d3d66", color: "#fff" }} onClick={finish}>
              Finish Setup <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
