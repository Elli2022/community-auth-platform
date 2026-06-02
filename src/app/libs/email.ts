import { logger } from "./logger";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "Flödet <onboarding@resend.dev>";

  if (!apiKey) {
    logger.warn("[email] RESEND_API_KEY is not set; skipping send");
    return { sent: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn(`[email] Resend returned ${res.status}: ${body.slice(0, 200)}`);
    }
    return { sent: res.ok };
  } catch (err) {
    logger.warn(`[email] send failed: ${err instanceof Error ? err.message : "unknown"}`);
    return { sent: false };
  }
}

export function siteBaseUrl(): string {
  const url =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.URL?.trim() ||
    "http://127.0.0.1:3000";
  return url.replace(/\/$/, "");
}
