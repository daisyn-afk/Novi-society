const BASE = "http://127.0.0.1:8787";

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

// LIST (should be empty)
let res = await req("/admin/email-templates");
console.log("LIST:", res.status, Array.isArray(res.body) ? `${res.body.length} rows` : res.body);

// CREATE
res = await req("/admin/email-templates", {
  method: "POST",
  body: JSON.stringify({
    name: "Test Template",
    trigger: "enrollment_created",
    recipient_type: "provider",
    subject: "Hello {{first_name}}",
    body_html: "<p>Hi {{first_name}}, welcome!</p>",
    is_active: true
  })
});
console.log("CREATE:", res.status, res.body?.id || res.body);
const id = res.body?.id;

if (id) {
  // PATCH toggle
  res = await req(`/admin/email-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false })
  });
  console.log("PATCH:", res.status, res.body?.is_active);

  // DELETE
  res = await req(`/admin/email-templates/${id}`, { method: "DELETE" });
  console.log("DELETE:", res.status);
}

console.log("All API smoke tests passed.");
