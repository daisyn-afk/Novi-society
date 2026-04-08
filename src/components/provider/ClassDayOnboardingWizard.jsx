import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Check, FileText, Shield, CreditCard, ArrowRight, Loader2, AlertCircle, Rocket, ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ClassDayOnboardingWizard({ enrollment, course, open, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [platformContractSigned, setPlatformContractSigned] = useState(false);
  const [mdContractSigned, setMdContractSigned] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [signatureData, setSignatureData] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  // Fallback: derive service type ID from certifications_awarded if linked_service_type_ids is empty
  const serviceTypeId =
    course?.linked_service_type_ids?.[0] ||
    course?.certifications_awarded?.[0]?.service_type_id ||
    null;

  const { data: serviceType } = useQuery({
    queryKey: ["service-type", serviceTypeId],
    queryFn: async () => {
      const types = await base44.entities.ServiceType.filter({ id: serviceTypeId });
      return types[0] || null;
    },
    enabled: !!serviceTypeId,
  });

  const { data: existingMDSubscriptions = [] } = useQuery({
    queryKey: ["md-subscriptions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return base44.entities.MDSubscription.filter({ provider_id: user.id, status: "active" });
    },
    enabled: !!user?.id,
  });

  const { data: platformContract } = useQuery({
    queryKey: ["platform-contract-check"],
    queryFn: async () => {
      const subs = await base44.entities.MDSubscription.filter({ provider_id: user.id });
      return subs.length > 0 ? { signed: true } : { signed: false };
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (platformContract?.signed) {
      setPlatformContractSigned(true);
    }
  }, [platformContract]);

  // Calculate membership pricing
  const calculatePricing = () => {
    if (!serviceType) return { monthly: 0, prorated: 0, total: 0, totalMonthly: 0, daysRemaining: 0 };

    const existingMonthly = existingMDSubscriptions.reduce(
      (sum, sub) => sum + (sub.service_type_monthly_fee || 0), 0
    );
    const newMonthly = serviceType.monthly_fee || 0;
    const totalMonthly = existingMonthly + newMonthly;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();
    const prorated = (newMonthly / daysInMonth) * daysRemaining;

    return {
      monthly: newMonthly,
      existingMonthly,
      totalMonthly,
      prorated: Math.round(prorated * 100) / 100,
      daysRemaining,
    };
  };

  const pricing = calculatePricing();

  const steps = [
    {
      id: "platform-contract",
      title: "NOVI Platform Agreement",
      icon: FileText,
      completed: platformContractSigned,
      content: (
        <div className="space-y-6">
          {platformContractSigned ? (
            <div className="p-6 rounded-lg" style={{ background: "rgba(200,230,60,0.15)", border: "2px solid #C8E63C" }}>
              <div className="flex items-center gap-3">
                <Check className="w-6 h-6" style={{ color: "#C8E63C" }} />
                <div>
                  <p className="font-bold text-lg" style={{ color: "#2D6B7F" }}>Already Signed</p>
                  <p className="text-sm mt-1" style={{ color: "rgba(30,37,53,0.7)" }}>You previously signed this agreement on {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-8 rounded-lg" style={{ background: "white", border: "2px solid #2D6B7F", maxHeight: "350px", overflowY: "auto" }}>
                <h3 className="text-2xl font-bold mb-6" style={{ color: "#2D6B7F", fontFamily: "'DM Serif Display', serif" }}>NOVI PLATFORM MEMBER AGREEMENT</h3>
                <div className="space-y-5" style={{ color: "#1e2535", fontSize: "15px", lineHeight: "1.8" }}>
                  <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>
                  
                  <p>This Agreement is entered into between NOVI Society ("Platform") and the Provider ("You") for access to and use of the NOVI platform infrastructure.</p>
                  
                  <div>
                    <p className="font-bold text-base mb-2">1. PLATFORM ACCESS & USE</p>
                    <p>By signing this agreement, you agree to use the NOVI platform exclusively for authorized practice management, patient engagement, compliance tracking, and medical oversight coordination. You agree not to share your login credentials with any unauthorized parties.</p>
                  </div>
                  
                  <div>
                    <p className="font-bold text-base mb-2">2. PROFESSIONAL STANDARDS</p>
                    <p>You agree to maintain the highest professional and ethical standards in all platform activities and patient interactions. You will comply with all applicable state and federal laws, regulations, and licensing requirements.</p>
                  </div>
                  
                  <div>
                    <p className="font-bold text-base mb-2">3. DATA PRIVACY & HIPAA COMPLIANCE</p>
                    <p>You acknowledge NOVI's commitment to HIPAA compliance and agree to protect all patient data accessed through the platform. You will report any suspected data breaches immediately to the platform administrator.</p>
                  </div>
                  
                  <div>
                    <p className="font-bold text-base mb-2">4. MONTHLY MEMBERSHIP OBLIGATIONS</p>
                    <p>You agree to pay monthly membership fees as outlined in your service-specific agreements. Failure to pay will result in suspension of platform access and disciplinary action.</p>
                  </div>
                  
                  <div>
                    <p className="font-bold text-base mb-2">5. TERM & TERMINATION</p>
                    <p>This agreement continues month-to-month until terminated by either party with 30 days' written notice. NOVI may terminate immediately for violations of this agreement or professional misconduct.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-lg font-bold" style={{ color: "#1e2535" }}>YOUR SIGNATURE</p>
                <p className="text-sm" style={{ color: "rgba(30,37,53,0.6)" }}>Please draw your signature in the box below</p>
                <canvas
                  ref={el => { if (el && !signatureData.platformSignature) { el.width = 500; el.height = 100; el.style.border = '3px solid #2D6B7F'; el.style.borderRadius = '8px'; el.style.cursor = 'crosshair'; el.style.background = '#f9f9f9'; } }}
                  onMouseDown={(e) => {
                    const canvas = e.currentTarget;
                    const ctx = canvas.getContext('2d');
                    const rect = canvas.getBoundingClientRect();
                    let drawing = true;
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    const draw = (e) => {
                      if (!drawing) return;
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      ctx.lineTo(x, y);
                      ctx.stroke();
                    };
                    const stop = () => {
                      drawing = false;
                      setSignatureData(prev => ({ ...prev, platformSignature: canvas.toDataURL() }));
                      canvas.removeEventListener('mousemove', draw);
                      canvas.removeEventListener('mouseup', stop);
                    };
                    ctx.beginPath();
                    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                    canvas.addEventListener('mousemove', draw);
                    canvas.addEventListener('mouseup', stop);
                  }}
                  className="w-full touch-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const canvas = document.querySelectorAll('canvas')[0];
                    if (canvas) {
                      const ctx = canvas.getContext('2d');
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      setSignatureData(prev => ({ ...prev, platformSignature: null }));
                    }
                  }}
                >
                  Clear Signature
                </Button>
              </div>
              
              <div className="flex items-start gap-4 p-5 rounded-lg" style={{ background: "rgba(200,230,60,0.1)", border: "2px solid rgba(200,230,60,0.3)" }}>
                <Checkbox
                  checked={!!signatureData.platformConsent && !!signatureData.platformSignature}
                  disabled={!signatureData.platformSignature}
                  className="mt-1"
                  onCheckedChange={(checked) => setSignatureData(prev => ({ ...prev, platformConsent: checked }))}
                />
                <label className="text-base cursor-pointer" style={{ color: "#1e2535" }}>
                  <strong>I have read and electronically sign the NOVI Platform Member Agreement above</strong>
                </label>
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  const canProceed = () => {
    const step = steps[currentStep];
    if (step.completed) return true;
    switch (step.id) {
      case "platform-contract": return platformContractSigned || !!signatureData.platformConsent;
      case "md-contract": return !!signatureData.mdConsent;
      case "membership-payment": return !!signatureData.paymentConsent;
      case "growth-studio": return true; // Info card
      case "supplier-accounts": return true; // Info card
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      await base44.entities.MDSubscription.create({
        provider_id: user.id,
        provider_email: user.email,
        provider_name: user.full_name,
        service_type_id: serviceType?.id || serviceTypeId,
        service_type_name: serviceType?.name || course?.title,
        service_type_monthly_fee: serviceType?.monthly_fee,
        enrollment_id: enrollment.id,
        status: "pending",
        signed_at: new Date().toISOString(),
        signature_data: JSON.stringify(signatureData),
        signed_by_name: user.full_name,
      });

      const checkoutResponse = await base44.functions.invoke("createMDSubscriptionCheckout", {
        provider_id: user.id,
        service_type_id: serviceType?.id || serviceTypeId,
        prorated_amount: pricing.prorated,
      });

      if (checkoutResponse.data?.url) {
        window.location.href = checkoutResponse.data.url;
      } else {
        toast({ title: "Success", description: "Membership setup complete! Redirecting to dashboard..." });
        setTimeout(() => { queryClient.invalidateQueries(); onClose(); }, 2000);
      }
    } catch (error) {
      toast({ title: "Error", description: error.message || "Failed to complete setup", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const CurrentStep = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl" style={{ fontFamily: "'DM Serif Display', serif", color: "#2D6B7F", fontStyle: "italic" }}>
            Complete Your NOVI Membership
          </DialogTitle>
          <p className="text-sm" style={{ color: "rgba(30,37,53,0.7)" }}>
            Welcome to {course?.title}! Let's get you set up.
          </p>
        </DialogHeader>

        {/* Card Counter */}
        <div className="text-center mb-4">
          <p className="text-sm font-semibold" style={{ color: "#2D6B7F" }}>
            Card {currentStep + 1} of {steps.length}
          </p>
          <div className="flex gap-1 mt-2 justify-center">
            {steps.map((_, idx) => (
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

        {/* Step Content */}
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-4" style={{ color: "#2D6B7F" }}>{CurrentStep.title}</h3>
          {CurrentStep.content}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
          <Button
            variant="outline"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button
            disabled={!canProceed() || isProcessing || currentStep === steps.length - 1}
            onClick={() => currentStep < steps.length - 1 ? setCurrentStep(currentStep + 1) : handleComplete()}
            style={{ background: currentStep === steps.length - 1 ? "rgba(0,0,0,0.1)" : "#2D6B7F" }}
          >
            {isProcessing
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              : currentStep === steps.length - 1
                ? "Done!"
                : currentStep === 2
                  ? "Let's Go"
                  : <><>Next</> <ChevronRight className="w-4 h-4 ml-2" /></>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}