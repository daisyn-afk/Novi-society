-- Seed real email templates that are currently hardcoded in the backend.
-- Body HTML stores only the inner content (no shell wrapper) so the test-send
-- and future automation engine can apply the standard NOVI shell at send time.
-- Re-runnable: deletes by trigger key before inserting.

DELETE FROM public.email_templates
WHERE trigger IN (
  'enrollment_paid',
  'new_user_invite',
  'md_service_preorder',
  'license_verified',
  'license_rejected',
  'model_booking_confirmed',
  'model_waitlist_promoted',
  'model_gfe_assigned',
  'model_session_reminder',
  'model_post_training',
  'model_gfe_reminder'
);

-- 1. Course Enrollment Confirmation
-- Source: backend/admin/checkout/service.js → sendConfirmationEmail()
-- Stores FULL HTML (wide shell with logo) matching exactly what is sent after Stripe payment.
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'Course Enrollment Confirmation',
  'enrollment_paid',
  'provider',
  'Your NOVI course enrollment is confirmed',
  $html$<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="{{logo_url}}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Hi {{first_name}},</p>
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Welcome to NOVI Society - we're excited to have you with us.</p>
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Your enrollment for <strong>{{course_name}}</strong> has been successfully confirmed.</p>
          <div style="background:#f9f8f6;border-radius:12px;padding:24px;margin-bottom:32px;border:1px solid rgba(0,0,0,0.07)">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2D6B7F">Course Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;width:100px"><strong>Course</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">{{course_name}}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px"><strong>Date</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">{{course_date}}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px"><strong>Time</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">{{course_time}}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px"><strong>Location</strong></td><td style="padding:6px 0;font-size:14px;color:#111827">{{course_location}}</td></tr>
            </table>
          </div>
          <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">This immersive training is designed to take you from foundational knowledge to confident, hands-on application. You'll receive in-depth education on anatomy, product selection, injection techniques, and patient safety - along with live model experience to ensure you leave fully prepared.</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">As part of NOVI, this course is more than just training. It's your entry point into a fully supported system that includes:</p>
          <ul style="margin:0 0 32px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Ongoing mentorship and guidance</li>
            <li>Medical director oversight</li>
            <li>Compliance and scope-of-practice support</li>
            <li>Tools to help you launch and grow your aesthetic practice</li>
          </ul>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">What to Expect Next</p>
          <ul style="margin:0 0 32px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Additional course details and preparation instructions will be sent prior to your training date</li>
            <li>Any required forms or documentation will be provided for completion</li>
            <li>Our team will be available for any questions leading up to your course</li>
          </ul>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">To further access your course details set up your account, follow the steps in "Set up your NOVI Society account" email or if you already have an account login to the account.</p>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6">If you have any questions in the meantime, feel free to reach out - we're here to support you every step of the way.</p>
          <div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            <p style="margin:0 0 4px;font-size:15px;color:#374151">We look forward to seeing you soon.</p>
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:17px;color:#1e2535;font-style:italic">Welcome to NOVI.</p>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;font-style:italic">A New Way to Be Seen.</p>
            <p style="margin:0;font-size:15px;color:#374151">Best,<br><strong>The NOVI Society Team</strong></p>
          </div>
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
  true,
  0
);

-- 2. New User Account Invite
-- Source: backend/admin/checkout/service.js → sendNewUserInviteEmail()
-- Stores FULL HTML (wide shell with logo) matching exactly what is sent to new users.
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'New Account Setup Invite',
  'new_user_invite',
  'provider',
  'Set up your NOVI Society account',
  $html$<!DOCTYPE html>
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
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  true,
  0
);

-- 3. MD Service Pre-Order Welcome
-- Source: backend/admin/checkout/service.js → sendMdServiceConfirmationEmail()
-- Stores FULL HTML (wide shell with logo) matching exactly what is sent after MD service pre-order.
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'MD Service Pre-Order Welcome',
  'md_service_preorder',
  'provider',
  'You''re In — Welcome to NOVI MD Services',
  $html$<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.06);max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:32px 40px;text-align:center">
          <img src="{{logo_url}}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="padding:40px">
          <p style="margin:0 0 16px;font-size:16px;color:#111827">Hi {{first_name}},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">We're so excited to welcome you to NOVI MD Services.</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">You've officially secured your place in our pre-launch group for <strong>{{service_name}}</strong> — an early circle of providers stepping into something entirely new for this industry.</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">What we're building with NOVI isn't just another platform. It's a complete shift in how providers enter, operate, and grow within aesthetics — where everything you need is finally connected, elevated, and built to support you long-term.</p>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">What Happens Next</p>
          <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Over the coming weeks, we'll be working closely with you to prepare for activation:</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:15px;line-height:1.8">
            <li>Your onboarding spot is confirmed</li>
            <li>You'll receive early access updates as we approach our June 1st launch</li>
            <li>Our team will personally reach out to begin your setup</li>
          </ul>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">At this stage, no payment is required. We'll coordinate billing once the platform is fully live so your experience starts seamlessly and at the right time.</p>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">How We'll Support You</p>
          <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">This isn't a hands-off experience - we're building this with you.</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:15px;line-height:1.8">
            <li>You'll receive direct communication from our team via email</li>
            <li>Our sales and onboarding team will personally connect with you</li>
            <li>We'll guide you through every step so you're fully ready to activate</li>
          </ul>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">What Makes NOVI Different</p>
          <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">NOVI was designed to solve what's been missing in this industry - completely.</p>
          <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">Instead of piecing together systems, you'll step into one platform that brings everything together:</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:15px;line-height:1.8">
            <li>Medical Director oversight built directly into your workflow</li>
            <li>Seamless compliance and real-time chart review</li>
            <li>A fully connected patient journey - from discovery to treatment and beyond</li>
            <li>Intelligent growth tools designed to help you build and scale your practice</li>
          </ul>
          <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6">There truly isn't another platform operating at this level - and you're getting in at the very beginning.</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">If you have any questions in the meantime, just reply directly to this email - we're here for you.</p>
          <p style="margin:0 0 4px;font-size:15px;color:#374151">We're genuinely excited to have you with us and can't wait to bring you live on NOVI.</p>
          <div style="margin-top:32px;padding-top:28px;border-top:1px solid #e5e7eb">
            <p style="margin:0 0 4px;font-size:15px;font-style:italic;color:#6b7280">Welcome to NOVI.</p>
            <p style="margin:0 0 20px;font-size:13px;letter-spacing:1px;color:#9ca3af;text-transform:uppercase">A New Way to Be Seen.</p>
            <p style="margin:0;font-size:14px;color:#374151">Best,<br/><strong>The NOVI Society Team</strong></p>
          </div>
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center;background:#f3f4f6">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 NOVI Society LLC · 8109 Meadow Valley Dr, McKinney, TX 75071</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af"><a href="mailto:support@novisociety.com" style="color:#9ca3af">support@novisociety.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>$html$,
  true,
  0
);

-- 4. License Verified
-- Source: backend/admin/licenses/routes.js → buildLicenseDecisionEmailHtml() approved branch
-- Stores FULL HTML (wide shell with logo) matching exactly what is sent on license approval.
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'License Verified',
  'license_verified',
  'provider',
  'Your license has been verified — unlock MD coverage now',
  $html$<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="{{logo_url}}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Hi {{first_name}},</p>
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Your professional license has been verified by the NOVI admin team. ✓</p>
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">You're now eligible to apply for MD Board Coverage, which lets you legally offer aesthetic services under NOVI's Board of Medical Directors.</p>
          <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827">Your Next Steps:</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:15px;line-height:1.9">
            <li>Enroll in a NOVI course or submit an external certification</li>
            <li>Apply for MD Coverage for each service you want to offer</li>
            <li>Get matched with a Board MD - NOVI handles the assignment</li>
          </ul>
          <p style="margin:0 0 32px">
            <a href="{{app_url}}/ProviderCredentialsCoverage" style="display:inline-block;background:#2D6B7F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:14px">
              Apply for Coverage
            </a>
          </p>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6">You're one step closer,<br/><strong>The NOVI Team</strong></p>
          <div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            <p style="margin:0;font-size:15px;color:#374151">Best,<br><strong>The NOVI Society Team</strong></p>
          </div>
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
  true,
  0
);

-- 5. License Rejected
-- Source: backend/admin/licenses/routes.js → buildLicenseDecisionEmailHtml() rejected branch
-- Stores FULL HTML (wide shell with logo) matching exactly what is sent on license rejection.
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'License Rejected',
  'license_rejected',
  'provider',
  'Your license submission was rejected',
  $html$<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'DM Sans',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:linear-gradient(135deg,#2D6B7F 0%,#7B8EC8 55%,#C8E63C 100%);padding:36px 40px;text-align:center;border-radius:16px 16px 0 0">
          <img src="{{logo_url}}" alt="NOVI Society" style="width:160px;height:auto" />
        </td></tr>
        <tr><td style="background:#fff;padding:48px 40px;border-radius:0 0 16px 16px">
          <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">Hi {{first_name}},</p>
          <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6">Your professional license submission has been reviewed by the NOVI admin team.</p>
          <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6"><strong>Status:</strong> Rejected</p>
          <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#111827">Reason for rejection:</p>
          <div style="background:#fff7f7;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin:0 0 24px;color:#7f1d1d;font-size:14px;line-height:1.7">
            {{rejection_reason}}
          </div>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">Please update and resubmit your license details in your provider dashboard.</p>
          <p style="margin:0 0 32px;font-size:15px;color:#374151;line-height:1.6">The NOVI Team</p>
          <div style="border-top:1px solid #e5e7eb;padding-top:28px;margin-top:8px">
            <p style="margin:0;font-size:15px;color:#374151">Best,<br><strong>The NOVI Society Team</strong></p>
          </div>
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
  true,
  0
);

-- 6. Model Booking Confirmed
-- Source: backend/admin/functions/routes.js → sendModelConfirmationEmail + processModelCheckoutCompletedSession
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'Model Booking Confirmed',
  'model_booking_confirmed',
  'patient',
  'Your Model Training Booking is Confirmed - {{course_date}}',
  $html$<p style="color:#1e2535;font-size:15px;margin:0 0 24px;">Hi <strong>{{first_name}}</strong>,</p>
<p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">Your model training booking has been confirmed! Here's a summary of your session:</p>
<div style="background:#f9f8f6;border-radius:12px;padding:20px;margin-bottom:24px;">
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;width:40%;">Course</td><td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">{{course_name}}</td></tr>
    <tr><td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;">Date</td><td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">{{course_date}}</td></tr>
    <tr><td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;">Time</td><td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">{{time_slot}}</td></tr>
    <tr><td style="padding:8px 0;color:rgba(30,37,53,0.55);font-size:13px;">Treatment</td><td style="padding:8px 0;color:#1e2535;font-size:13px;font-weight:600;">{{treatment_type}}</td></tr>
  </table>
</div>
<div style="background:rgba(200,230,60,0.1);border:1px solid rgba(200,230,60,0.3);border-radius:12px;padding:16px;margin-bottom:24px;">
  <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#5a7a20;margin:0 0 8px;">What's Included</p>
  <ul style="margin:0;padding-left:18px;color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;">
    <li>Good Faith Exam (link sent separately)</li>
    <li>{{treatment_type}} treatment</li>
    <li>Supervised by a licensed Medical Director</li>
  </ul>
</div>
<p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0 0 24px;"><strong>Important:</strong> You'll receive your Good Faith Exam (GFE) link via a separate email. Please complete it before your session date.</p>
<p style="color:rgba(30,37,53,0.5);font-size:12px;margin:0;">Questions? Email us at <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a></p>$html$,
  true,
  0
);

-- 7. Waitlist Promoted to Confirmed
-- Source: backend/admin/functions/routes.js → promoteFromWaitlist
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'Waitlist Slot Opened — Booking Confirmed',
  'model_waitlist_promoted',
  'patient',
  'Your Model Training Booking is Confirmed - {{course_date}}',
  $html$<p style="color:#1e2535;font-size:15px;margin:0 0 24px;">Hi <strong>{{first_name}}</strong>,</p>
<p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 20px;">Great news — a slot opened up and your waitlist booking is now confirmed.</p>
<div style="background:#f9f8f6;border-radius:12px;padding:16px;margin-bottom:20px;">
  <p style="margin:0 0 8px;font-size:13px;color:#1e2535;"><strong>Date:</strong> {{course_date}}</p>
  <p style="margin:0 0 8px;font-size:13px;color:#1e2535;"><strong>Time:</strong> {{time_slot}}</p>
  <p style="margin:0;font-size:13px;color:#1e2535;"><strong>Treatment:</strong> {{treatment_type}}</p>
</div>
<p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0;">Please complete your Good Faith Exam before the session if you have not done so.</p>$html$,
  true,
  0
);

-- 8. Model GFE Link
-- Source: backend/admin/functions/routes.js → sendModelGFEEmail
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'Model GFE Link',
  'model_gfe_assigned',
  'patient',
  'Complete Your Good Faith Exam - NOVI Society',
  $html$<p style="color:#1e2535;font-size:15px;margin:0 0 16px;">Hi <strong>{{first_name}}</strong>,</p>
<p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">You're almost set! Before your training session, you need to complete a <strong>Good Faith Exam (GFE)</strong> — a quick virtual screening with a licensed medical provider. It takes about 5–10 minutes.</p>
<div style="text-align:center;margin:0 0 24px;">
  <a href="{{gfe_url}}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:15px;padding:14px 32px;border-radius:50px;text-decoration:none;">Complete My GFE →</a>
</div>
<div style="background:rgba(45,107,127,0.06);border:1px solid rgba(45,107,127,0.15);border-radius:12px;padding:16px;margin-bottom:24px;">
  <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2D6B7F;margin:0 0 8px;">What to Expect</p>
  <ul style="margin:0;padding-left:18px;color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;">
    <li>Brief video call with a licensed provider</li>
    <li>Review of your health history</li>
    <li>Medical clearance for your treatment</li>
    <li>Takes approximately 5–10 minutes</li>
  </ul>
</div>
<p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0 0 16px;"><strong>Please complete this before your session date.</strong> If you have any questions, reply to this email or contact us at <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a>.</p>$html$,
  true,
  0
);

-- 9. Model Day-Before Session Reminder
-- Source: backend/admin/functions/routes.js → sendModelReminderEmail + sendModelReminderBatch
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'Model Session Reminder (Day Before)',
  'model_session_reminder',
  'patient',
  'Reminder: Your Model Training Session is Tomorrow at {{time_slot}}',
  $html$<p style="color:#1e2535;font-size:15px;margin:0 0 16px;">Hello <strong>{{first_name}}</strong>,</p>
<p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 20px;">Just a friendly reminder that your model training session is tomorrow.</p>
<div style="background:#f9f8f6;border-radius:12px;padding:16px;margin-bottom:20px;">
  <p style="margin:0 0 8px;font-size:13px;color:#1e2535;"><strong>Date:</strong> {{course_date}}</p>
  <p style="margin:0 0 8px;font-size:13px;color:#1e2535;"><strong>Time:</strong> {{time_slot}}</p>
  <p style="margin:0;font-size:13px;color:#1e2535;"><strong>Treatment:</strong> {{treatment_type}}</p>
</div>
<p style="color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;margin:0 0 16px;"><strong>Pre-Training Instructions:</strong><br>Arrive 15 minutes early<br>Wear comfortable clothing for treatment areas<br>Avoid alcohol and blood thinners 24 hours before session<br>Bring a valid photo ID<br>Keep your booking confirmation email handy</p>
<p style="color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;margin:0 0 16px;"><strong>What to Bring:</strong><br>Phone or camera (optional)<br>Water bottle and snacks</p>
<p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0;">Questions or need to reschedule? Contact <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a>.</p>$html$,
  true,
  0
);

-- 10. Model Post-Training Follow-Up
-- Source: backend/admin/functions/routes.js → sendModelPostTrainingEmail + sendModelPostTrainingBatch
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'Model Post-Training Follow-Up',
  'model_post_training',
  'patient',
  'Become a Real Patient: Continue Your Journey with NOVI Society',
  $html$<p style="color:#1e2535;font-size:15px;margin:0 0 16px;">Hello <strong>{{first_name}}</strong>,</p>
<p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 16px;">Thank you for being part of {{course_name}}! We hope you had an amazing experience.</p>
<p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 16px;">Now it's your turn to experience professional aesthetic treatments as a patient.</p>
<p style="color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;margin:0 0 16px;"><strong>Next Steps:</strong><br>1) Sign up at <a href="https://www.novisociety.com/patient-signup" style="color:#2D6B7F;">novisociety.com/patient-signup</a><br>2) Build your aesthetic profile<br>3) Book your first {{treatment_type}} treatment</p>
<p style="color:rgba(30,37,53,0.7);font-size:13px;line-height:1.8;margin:0 0 16px;"><strong>Special Perks for Training Models:</strong><br>15% off first treatment (code <strong>NOVIMODEL15</strong>)<br>Priority booking with instructors<br>Premium recovery tracking for 30 days</p>
<p style="color:rgba(30,37,53,0.6);font-size:13px;line-height:1.7;margin:0;">Have questions? Reply to this email or contact <a href="mailto:hello@novisociety.com" style="color:#2D6B7F;">hello@novisociety.com</a>.</p>$html$,
  true,
  0
);

-- 11. Model GFE Reminder (batch — sent to models with pending GFE)
-- Source: backend/admin/functions/routes.js → sendModelGFEReminderBatch
INSERT INTO public.email_templates (name, trigger, recipient_type, subject, body_html, is_active, send_delay_minutes)
VALUES (
  'Model GFE Reminder',
  'model_gfe_reminder',
  'patient',
  'Reminder: Complete Your Good Faith Exam - NOVI Society',
  $html$<p style="color:#1e2535;font-size:15px;margin:0 0 12px;">Hi <strong>{{first_name}}</strong>,</p>
<p style="color:rgba(30,37,53,0.7);font-size:14px;line-height:1.7;margin:0 0 18px;">Friendly reminder to complete your Good Faith Exam before class.</p>
<p style="margin:0;">
  <a href="{{gfe_url}}" style="display:inline-block;background:#C8E63C;color:#1a2540;font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;text-decoration:none;">Complete GFE</a>
</p>$html$,
  true,
  0
);
