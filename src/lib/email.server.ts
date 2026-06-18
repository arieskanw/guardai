const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "GuardAI <noreply@codezy.id>";

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

export function buildOtpEmailHtml(otp: string, title = "Verify your email"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
          <tr>
            <td style="padding:40px 32px 8px;text-align:center">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:26px;font-weight:700;line-height:1">G</span>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;text-align:center">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#1a1a2e;letter-spacing:-0.3px">${title}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#6b7280;line-height:1.5">Use the code below to complete your verification. This code expires in <strong>10 minutes</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px">
              <div style="text-align:center;font-size:40px;font-weight:700;letter-spacing:10px;color:#6366f1;background:#f0f0ff;border-radius:12px;padding:24px 16px;font-family:'SF Mono','Menlo','Monaco','Courier New',monospace;border:1px solid rgba(99,102,241,0.15)">${otp}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;text-align:center">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">If you didn't request this, you can safely ignore this email.<br>&copy; ${new Date().getFullYear()} GuardAI &mdash; AI code review</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOtpEmailText(otp: string): string {
  return `Verify your email\n\nYour GuardAI verification code: ${otp}\n\nCode expires in 10 minutes.\n- GuardAI Team`;
}
