const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "GuardAI <noreply@guardai.codezy.id>";

if (!RESEND_API_KEY) {
  console.warn("[email] RESEND_API_KEY not set — emails will not be sent");
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[email] Skipping send — no RESEND_API_KEY");
    return { ok: false, error: "Resend not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.message || `HTTP ${res.status}` };
    }

    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function buildOtpEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:40px 20px">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;padding:40px 32px;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
    <div style="text-align:center;margin-bottom:24px">
      <span style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:24px;font-weight:bold">G</span>
    </div>
    <h1 style="text-align:center;font-size:22px;margin:0 0 8px;color:#1a1a2e">Verify your email</h1>
    <p style="text-align:center;font-size:14px;color:#666;margin:0 0 28px">Enter this code to activate your GuardAI account</p>
    <div style="text-align:center;font-size:36px;font-weight:bold;letter-spacing:8px;color:#6366f1;background:#f0f0ff;border-radius:12px;padding:20px;margin-bottom:28px;font-family:monospace">${otp}</div>
    <p style="text-align:center;font-size:12px;color:#999;margin:0">Code expires in 10 minutes &middot; GuardAI &mdash; AI code review</p>
  </div>
</body>
</html>`;
}

export function buildOtpEmailText(otp: string): string {
  return `Verify your email\n\nYour GuardAI verification code: ${otp}\n\nCode expires in 10 minutes.\n- GuardAI Team`;
}
