function repMessageDraft({ providerEmail, mfrName, me }) {
  const provider = String(providerEmail || me?.email || "").trim();
  const name = mfrName || "Supplier";

  return {
    subject: `Provider Inquiry — ${name}`,
    body: `Hi ${name} Team,

I have a question regarding my account:

[Write your message here]

Provider: ${me?.full_name || ""}
Practice: ${me?.practice_name || ""}
Email: ${me?.email || provider || ""}

Thanks,
${me?.full_name || ""}`,
  };
}

export function buildRepGmailComposeUrl({ repEmail, providerEmail, mfrName, me }) {
  const to = String(repEmail || "").trim();
  if (!to) return null;

  const { subject, body } = repMessageDraft({ providerEmail, mfrName, me });

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

/** @deprecated use buildRepGmailComposeUrl */
export function buildRepMailtoUrl(opts) {
  return buildRepGmailComposeUrl(opts);
}

export function openRepMailto({ repEmail, providerEmail, mfrName, me, onMissingRepEmail }) {
  const url = buildRepGmailComposeUrl({ repEmail, providerEmail, mfrName, me });
  if (!url) {
    if (typeof onMissingRepEmail === "function") onMissingRepEmail();
    else window.alert("Save this supplier's rep contact before messaging.");
    return false;
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
