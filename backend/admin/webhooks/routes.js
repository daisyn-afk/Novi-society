import { Router } from "express";
import { processCompletedCheckoutSession, verifyStripeWebhook } from "../checkout/service.js";
import { processModelCheckoutCompletedSession } from "../functions/routes.js";

export const webhooksRouter = Router();

webhooksRouter.post("/stripe", async (req, res, next) => {
  try {
    const signatureHeader = req.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) return res.status(400).send("Missing stripe-signature header.");

    const event = verifyStripeWebhook(req.body, signature);
    // eslint-disable-next-line no-console
    console.log("[webhook] stripe event received", {
      type: event?.type || null,
      id: event?.id || null,
    });
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const checkoutType = String(session?.metadata?.checkout_type || "").toLowerCase();
      // eslint-disable-next-line no-console
      console.log("[webhook] checkout.session.completed", {
        checkout_type: checkoutType || "course",
        stripe_session_id: session?.id || null,
        pre_order_id: session?.metadata?.pre_order_id || null,
        provider_email: session?.metadata?.provider_email || null,
      });
      if (checkoutType === "model") {
        await processModelCheckoutCompletedSession(session);
      } else {
        await processCompletedCheckoutSession(session);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return next(error);
  }
});
