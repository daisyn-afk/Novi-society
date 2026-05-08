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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const checkoutType = String(session?.metadata?.checkout_type || "").toLowerCase();
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
