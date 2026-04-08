import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

export default function WizardPreview({ open, onClose, serviceType, formData }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [signatureData, setSignatureData] = useState({});

  if (!serviceType || !open) return null;

  const calculatePricing = () => {
    const monthly = parseFloat(formData.monthly_fee) || 0;
    const daysRemaining = 10; // mock
    const prorated = (monthly / 30) * daysRemaining;
    return { monthly, prorated: Math.round(prorated * 100) / 100, daysRemaining, total: monthly + prorated };
  };

  const pricing = calculatePricing();

  const cards = [
    {
      id: "platform",
      title: "NOVI Platform Agreement",
      icon: "📋",
      content: (
        <div className="space-y-4">
          <div className="p-6 rounded-xl max-h-64 overflow-y-auto" style={{ background: "#f5f3ef", border: "1px solid rgba(0,0,0,0.1)" }}>
            <h4 className="font-bold mb-3" style={{ color: "#2D6B7F" }}>Step 1: Sign Platform Agreement</h4>
            <div className="space-y-3 text-sm" style={{ color: "rgba(30,37,53,0.8)" }}>
              {formData.platform_agreement_text ? (
                <p>{formData.platform_agreement_text}</p>
              ) : (
                <p>Default platform agreement text would appear here.</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "rgba(123,142,200,0.1)" }}>
            <Checkbox
              checked={!!signatureData.platformConsent}
              onCheckedChange={(checked) => setSignatureData(prev => ({ ...prev, platformConsent: checked }))}
            />
            <label className="text-sm cursor-pointer" style={{ color: "rgba(30,37,53,0.8)" }}>
              I agree to the NOVI Platform Member Agreement
            </label>
          </div>
        </div>
      ),
    },
    {
      id: "md",
      title: "Medical Director Agreement",
      icon: "🛡️",
      content: (
        <div className="space-y-4">
          <div className="p-6 rounded-xl max-h-64 overflow-y-auto" style={{ background: "#f5f3ef", border: "1px solid rgba(0,0,0,0.1)" }}>
            <h4 className="font-bold mb-3" style={{ color: "#2D6B7F" }}>Step 2: Medical Director Supervision</h4>
            <div className="space-y-3 text-sm" style={{ color: "rgba(30,37,53,0.8)" }}>
              {formData.md_agreement_text ? (
                <p>{formData.md_agreement_text}</p>
              ) : (
                <p>Default MD agreement text would appear here.</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "rgba(123,142,200,0.1)" }}>
            <Checkbox
              checked={!!signatureData.mdConsent}
              onCheckedChange={(checked) => setSignatureData(prev => ({ ...prev, mdConsent: checked }))}
            />
            <label className="text-sm cursor-pointer" style={{ color: "rgba(30,37,53,0.8)" }}>
              I agree to Medical Director supervision for {serviceType.name}
            </label>
          </div>
        </div>
      ),
    },
    {
      id: "payment",
      title: "Membership & Payment",
      icon: "💰",
      content: (
        <div className="space-y-5">
          <div className="p-6 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.08), rgba(200,230,60,0.08))", border: "1px solid rgba(123,142,200,0.2)" }}>
            <h4 className="font-bold mb-4" style={{ color: "#2D6B7F" }}>Step 3: Monthly Membership</h4>
            <div className="space-y-2 mb-4 pb-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: "rgba(30,37,53,0.8)" }}>Monthly Fee:</span>
                <span className="font-semibold" style={{ color: "#2D6B7F" }}>${pricing.monthly}/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "rgba(30,37,53,0.8)" }}>Prorated ({pricing.daysRemaining} days):</span>
                <span className="font-semibold" style={{ color: "#2D6B7F" }}>${pricing.prorated}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-bold" style={{ color: "#2D6B7F" }}>Total Monthly:</span>
                <span className="text-2xl font-bold" style={{ color: "#2D6B7F" }}>${pricing.total}/mo</span>
              </div>
              <p className="text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>Renews on the 1st of each month</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "rgba(123,142,200,0.1)" }}>
            <Checkbox
              checked={!!signatureData.paymentConsent}
              onCheckedChange={(checked) => setSignatureData(prev => ({ ...prev, paymentConsent: checked }))}
            />
            <label className="text-sm cursor-pointer" style={{ color: "rgba(30,37,53,0.8)" }}>
              I authorize NOVI to charge ${pricing.total}/month
            </label>
          </div>
        </div>
      ),
    },
    {
      id: "growth",
      title: "Growth Studio Setup",
      icon: "🚀",
      content: (
        <div className="space-y-4">
          <div className="p-6 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(200,230,60,0.1), rgba(123,142,200,0.08))", border: "1px solid rgba(200,230,60,0.25)" }}>
            <h4 className="font-bold mb-3 text-lg" style={{ color: "#4a6b10" }}>Step 4: Next: Growth Studio</h4>
            <div className="space-y-2 text-sm" style={{ color: "rgba(30,37,53,0.8)", lineHeight: "1.6" }}>
              {formData.growth_studio_text ? (
                <p>{formData.growth_studio_text}</p>
              ) : (
                <p>Visit the Growth Studio to complete your professional profile, upload before/after photos, and set your service pricing.</p>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "suppliers",
      title: "Supplier Marketplace",
      icon: "🏭",
      content: (
        <div className="space-y-4">
          <div className="p-6 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(200,230,60,0.1), rgba(123,142,200,0.08))", border: "1px solid rgba(200,230,60,0.25)" }}>
            <h4 className="font-bold mb-3 text-lg" style={{ color: "#4a6b10" }}>Step 5: Apply for Supplier Accounts</h4>
            <div className="space-y-2 text-sm" style={{ color: "rgba(30,37,53,0.8)", lineHeight: "1.6" }}>
              {formData.supplier_accounts_text ? (
                <p>{formData.supplier_accounts_text}</p>
              ) : (
                <p>Browse our Supplier Marketplace to apply for product accounts with trusted manufacturers. Get wholesale pricing and inventory management tools.</p>
              )}
            </div>
          </div>
        </div>
      ),
    },
  ];

  const canProceed = () => {
    const card = cards[currentStep];
    switch (card.id) {
      case "platform": return !!signatureData.platformConsent;
      case "md": return !!signatureData.mdConsent;
      case "payment": return !!signatureData.paymentConsent;
      default: return true; // Info cards auto-advance
    }
  };

  const currentCard = cards[currentStep];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl" style={{ fontFamily: "'DM Serif Display', serif", color: "#2D6B7F", fontStyle: "italic" }}>
            Class Day Setup Guide
          </DialogTitle>
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>
            Swipeable cards shown in class for {serviceType.name}
          </p>
        </DialogHeader>

        {/* Card Counter */}
        <div className="text-center mb-4">
          <p className="text-sm font-semibold" style={{ color: "#2D6B7F" }}>
            Card {currentStep + 1} of {cards.length}
          </p>
          <div className="flex gap-1 mt-2 justify-center">
            {cards.map((_, idx) => (
              <div
                key={idx}
                className="h-1 rounded-full transition-all"
                style={{
                  width: idx === currentStep ? "24px" : "8px",
                  background: idx <= currentStep ? "#C8E63C" : "rgba(0,0,0,0.1)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Card Content */}
        <div className="mb-6 p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.5)", minHeight: "300px", display: "flex", flexDirection: "column" }}>
          <div className="text-3xl mb-2">{currentCard.icon}</div>
          <h3 className="text-xl font-bold mb-4" style={{ color: "#2D6B7F" }}>
            {currentCard.title}
          </h3>
          <div className="flex-1">
            {currentCard.content}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
          <Button
            variant="outline"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <div className="text-sm font-semibold" style={{ color: "rgba(30,37,53,0.6)" }}>
            {currentStep < 3 && !canProceed() && "Complete step to continue"}
          </div>

          <Button
            disabled={!canProceed() || currentStep === cards.length - 1}
            onClick={() => setCurrentStep(currentStep + 1)}
            style={{ background: currentStep === cards.length - 1 ? "rgba(0,0,0,0.1)" : "#2D6B7F" }}
          >
            {currentStep === cards.length - 1 ? (
              "Done"
            ) : (
              <>
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}