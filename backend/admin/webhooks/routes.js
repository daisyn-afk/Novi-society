import { Router } from "express";
import { processCompletedCheckoutSession, verifyStripeWebhook } from "../checkout/service.js";

export const webhooksRouter = Router();

webhooksRouter.post("/stripe", async (req, res, next) => {
  try {
    const signatureHeader = req.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) return res.status(400).send("Missing stripe-signature header.");

    const event = verifyStripeWebhook(req.body, signature);
    if (event.type === "checkout.session.completed") {
      await processCompletedCheckoutSession(event.data.object);
    }

    return res.json({ received: true });
  } catch (error) {
    return next(error);
  }
});
