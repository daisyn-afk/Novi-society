import { useEffect } from "react";

const FORM_EMBED_SCRIPT = "https://get.clinicgrowers.com/js/form_embed.js";

export default function ClinicGrowersFormEmbed() {
  useEffect(() => {
    if (document.querySelector(`script[src="${FORM_EMBED_SCRIPT}"]`)) return;

    const script = document.createElement("script");
    script.src = FORM_EMBED_SCRIPT;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <iframe
      src="https://get.clinicgrowers.com/widget/form/zuP6A0WT1mEBHuYHahO4"
      style={{ width: "100%", height: "100%", border: "none", borderRadius: 3 }}
      id="inline-zuP6A0WT1mEBHuYHahO4"
      data-layout="{'id':'INLINE'}"
      data-trigger-type="alwaysShow"
      data-trigger-value=""
      data-activation-type="alwaysActivated"
      data-activation-value=""
      data-deactivation-type="neverDeactivate"
      data-deactivation-value=""
      data-form-name="[Compliance] Twilio Phone Registration Form"
      data-height="undefined"
      data-layout-iframe-id="inline-zuP6A0WT1mEBHuYHahO4"
      data-form-id="zuP6A0WT1mEBHuYHahO4"
      title="[Compliance] Twilio Phone Registration Form"
    />
  );
}
