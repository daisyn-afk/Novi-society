-- Normalize hardcoded NOVI domains in template content to placeholders.
-- This keeps links environment-aware across dev/staging/prod.

UPDATE public.email_templates
SET
  body_html = replace(
    replace(
      replace(
        replace(coalesce(body_html, ''), 'https://app.novisociety.com/setup', '{{signup_link}}'),
        'http://app.novisociety.com/setup', '{{signup_link}}'
      ),
      'https://app.novisociety.com', '{{app_url}}'
    ),
    'http://app.novisociety.com', '{{app_url}}'
  ),
  body_text = replace(
    replace(
      replace(
        replace(coalesce(body_text, ''), 'https://app.novisociety.com/setup', '{{signup_link}}'),
        'http://app.novisociety.com/setup', '{{signup_link}}'
      ),
      'https://app.novisociety.com', '{{app_url}}'
    ),
    'http://app.novisociety.com', '{{app_url}}'
  )
WHERE
  coalesce(body_html, '') like '%app.novisociety.com%'
  OR coalesce(body_text, '') like '%app.novisociety.com%';

UPDATE public.email_templates
SET
  body_html = replace(
    replace(coalesce(body_html, ''), 'https://www.novisociety.com/patient-signup', '{{app_url}}/patient-signup'),
    'http://www.novisociety.com/patient-signup', '{{app_url}}/patient-signup'
  ),
  body_text = replace(
    replace(coalesce(body_text, ''), 'https://www.novisociety.com/patient-signup', '{{app_url}}/patient-signup'),
    'http://www.novisociety.com/patient-signup', '{{app_url}}/patient-signup'
  )
WHERE
  coalesce(body_html, '') like '%www.novisociety.com/patient-signup%'
  OR coalesce(body_text, '') like '%www.novisociety.com/patient-signup%';
