import { sendEmailFromTemplate } from "../emails/renderTemplate.js";
import {
  ensureProviderUserRecord,
  getUserPasswordSetupByEmail,
  markPasswordResetPending,
  PASSWORD_SETUP_STATUS
} from "../users/passwordSetup.js";
import { generateProviderSignupLink, splitCustomerName } from "../users/providerSignupLink.js";
import {
  getPreOrderById,
  markPreOrderRejected,
  markPreOrderSignupLinkSent
} from "./repository.js";

export const SIGNUP_LINK_SENT_STATUSES = new Set([
  "signup_link_sent",
  "payment_link_sent",
  "approved"
]);

const APPROVE_TEMPLATE_KEY = "pre_order_application_approved";
const REJECT_TEMPLATE_KEY = "pre_order_application_rejected";

function buildFakeReq({ frontendOrigin, requestOrigin } = {}) {
  return {
    origin: frontendOrigin || requestOrigin || "",
    referer: requestOrigin || "",
    headers: {
      origin: frontendOrigin || requestOrigin || "",
      referer: requestOrigin || ""
    }
  };
}

async function assertPasswordSetupNotComplete(email) {
  const existingSetup = await getUserPasswordSetupByEmail(email);
  if (existingSetup?.password_setup_status === PASSWORD_SETUP_STATUS.COMPLETED) {
    const err = new Error("This provider has already registered. They can sign in at the login page.");
    err.statusCode = 409;
    err.code = "PROVIDER_ALREADY_REGISTERED";
    throw err;
  }
}

async function sendPreOrderSignupEmail(preOrder, req) {
  const email = String(preOrder.customer_email || "").trim().toLowerCase();
  if (!email) {
    const err = new Error("Pre-order is missing customer_email.");
    err.statusCode = 400;
    throw err;
  }

  await assertPasswordSetupNotComplete(email);

  const { firstName, lastName } = splitCustomerName(preOrder.customer_name);
  const greetingName = firstName || preOrder.customer_name || "there";
  const serviceName = preOrder.service_name || preOrder.course_title || "Medical Director Coverage";

  const { link, authUserId } = await generateProviderSignupLink(email, req, {
    firstName,
    lastName
  });

  await ensureProviderUserRecord({
    authUserId,
    email,
    firstName,
    lastName
  });

  const sendResult = await sendEmailFromTemplate(APPROVE_TEMPLATE_KEY, {
    to: email,
    first_name: greetingName,
    service_name: serviceName,
    signup_link: link
  });

  if (!sendResult.ok) {
    const err = new Error(
      sendResult.error === "missing_resend_key"
        ? "Email service is not configured (RESEND_API_KEY)."
        : sendResult.error || "Failed to send signup email."
    );
    err.statusCode = sendResult.error === "missing_resend_key" ? 500 : 502;
    throw err;
  }

  await markPasswordResetPending({
    email,
    authUserId,
    firstName,
    lastName
  });

  return { email, signup_link: link };
}

async function sendPreOrderRejectionEmail(preOrder, rejectionReason, req) {
  const email = String(preOrder.customer_email || "").trim().toLowerCase();
  if (!email) {
    const err = new Error("Pre-order is missing customer_email.");
    err.statusCode = 400;
    throw err;
  }

  const { firstName } = splitCustomerName(preOrder.customer_name);
  const greetingName = firstName || preOrder.customer_name || "there";
  const serviceName = preOrder.service_name || preOrder.course_title || "Medical Director Coverage";
  const reason = String(rejectionReason || "").trim();

  const sendResult = await sendEmailFromTemplate(REJECT_TEMPLATE_KEY, {
    to: email,
    first_name: greetingName,
    service_name: serviceName,
    rejection_reason: reason
  });

  if (!sendResult.ok) {
    const err = new Error(
      sendResult.error === "missing_resend_key"
        ? "Email service is not configured (RESEND_API_KEY)."
        : sendResult.error || "Failed to send rejection email."
    );
    err.statusCode = sendResult.error === "missing_resend_key" ? 500 : 502;
    throw err;
  }

  return { email };
}

export async function processPreOrderAction({
  id,
  action,
  rejectionReason,
  actor,
  req: incomingReq,
  frontendOrigin,
  requestOrigin
}) {
  if (!id) {
    const err = new Error("pre_order_id is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!["approve", "reject"].includes(action)) {
    const err = new Error("action must be 'approve' or 'reject'.");
    err.statusCode = 400;
    throw err;
  }

  const preOrder = await getPreOrderById(id);
  if (!preOrder) {
    const err = new Error("Pre-order not found.");
    err.statusCode = 404;
    throw err;
  }

  const req = incomingReq || buildFakeReq({ frontendOrigin, requestOrigin });

  if (action === "approve") {
    const canApprove =
      preOrder.status === "pending_approval" || SIGNUP_LINK_SENT_STATUSES.has(preOrder.status);
    if (!canApprove) {
      const err = new Error(`Cannot approve a pre-order in status "${preOrder.status}".`);
      err.statusCode = 409;
      throw err;
    }

    await sendPreOrderSignupEmail(preOrder, req);
    return markPreOrderSignupLinkSent({ id, actor });
  }

  if (preOrder.status !== "pending_approval") {
    const err = new Error(`Cannot reject a pre-order in status "${preOrder.status}".`);
    err.statusCode = 409;
    throw err;
  }

  const reason = String(rejectionReason || "").trim();
  if (!reason) {
    const err = new Error("rejection_reason is required.");
    err.statusCode = 400;
    throw err;
  }

  await sendPreOrderRejectionEmail(preOrder, reason, req);
  return markPreOrderRejected({ id, actor, rejectionReason: reason });
}
