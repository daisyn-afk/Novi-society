export type FunctionHandler = (payload: unknown) => Promise<unknown>;

function notImplemented(functionName: string): FunctionHandler {
  return async () => {
    throw new Error(`${functionName} is not implemented in Lovable backend yet.`);
  };
}

export const functionHandlers: Record<string, FunctionHandler> = {
  adverseReactionEscalation: notImplemented("adverseReactionEscalation"),
  approvePreOrder: notImplemented("approvePreOrder"),
  cancelMDSubscription: notImplemented("cancelMDSubscription"),
  cancelPatientSubscription: notImplemented("cancelPatientSubscription"),
  createAppointmentPayment: notImplemented("createAppointmentPayment"),
  createCheckoutSession: notImplemented("createCheckoutSession"),
  createMDSubscriptionCheckout: notImplemented("createMDSubscriptionCheckout"),
  createPatientSubscription: notImplemented("createPatientSubscription"),
  createPreOrderCheckout: notImplemented("createPreOrderCheckout"),
  createStripeConnectOnboarding: notImplemented("createStripeConnectOnboarding"),
  patientCheckinEscalation: notImplemented("patientCheckinEscalation"),
  redeemClassCode: notImplemented("redeemClassCode"),
  sendAutomatedEmail: notImplemented("sendAutomatedEmail"),
  sendManufacturerInquiry: notImplemented("sendManufacturerInquiry"),
  sendQualiphyGFE: notImplemented("sendQualiphyGFE"),
  sendRepContactEmail: notImplemented("sendRepContactEmail"),
  stripeBillingPortal: notImplemented("stripeBillingPortal"),
  submitPreOrderRequest: notImplemented("submitPreOrderRequest"),
  validateBookingScope: notImplemented("validateBookingScope"),
  validateScopeEligibility: notImplemented("validateScopeEligibility")
};

