-- Restore the CTA button in the new_user_invite email template.
-- The body_html was regenerated via the Admin UI editor which stripped the
-- <a> button tag down to plain text, losing the styled button. This migration
-- restores the correct body_html and updates body_text to the [text](url)
-- format that the editor now uses to round-trip buttons correctly.

UPDATE public.email_templates
SET
  body_html = $html$<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="{{logo_url}}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6">Hi {{first_name}},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">You are almost ready to start. Use the button below to set up your NOVI Society account.</p>
          <p style="margin:0 0 28px">
            <a href="{{signup_link}}" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px">
              Set your account
            </a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af"><a href="mailto:support@novisociety.com" style="color:#9ca3af">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  body_text = 'Hi {{first_name}},

You are almost ready to start. Use the button below to set up your NOVI Society account.

[Set your account]({{signup_link}})'
WHERE trigger = 'new_user_invite';
