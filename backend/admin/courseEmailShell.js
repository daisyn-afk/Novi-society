export function withCourseEmailShell({ title, contentHtml }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f5f3ef;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e2535 0%,#2D6B7F 60%,#7B8EC8 100%);padding:40px 32px;text-align:center;">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin:0 0 8px;">novi society</p>
      <h1 style="font-family:Georgia,serif;font-size:28px;color:#fff;margin:0;font-style:italic;font-weight:400;">${title}</h1>
    </div>
    <div style="padding:32px;">${contentHtml}</div>
    <div style="background:#f5f3ef;padding:20px 32px;text-align:center;">
      <p style="color:rgba(30,37,53,0.4);font-size:11px;margin:0;">© NOVI Society LLC · <a href="https://novisociety.com" style="color:rgba(30,37,53,0.4);">novisociety.com</a></p>
    </div>
  </div>
</body>
</html>`.trim();
}
