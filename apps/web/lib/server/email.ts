import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM ?? (EMAIL_USER ? `Traveltok AI <${EMAIL_USER}>` : undefined);

interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Returns true when the email was dispatched to the provider. Returns false
 * (and logs the message so the flow stays usable in dev) when Gmail SMTP is
 * not configured.
 */
async function sendMail(params: SendMailParams): Promise<boolean> {
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    // Local/dev fallback: log and report "not sent" instead of failing the flow.
    console.warn("[email] EMAIL_USER / EMAIL_APP_PASSWORD not set — email NOT delivered.");
    console.log(
      `[email] To: ${params.to}\nSubject: ${params.subject}\nBody:\n${params.text}`,
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: EMAIL_FROM ?? EMAIL_USER,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
  return true;
}

const layout = (title: string, body: string, cta: { label: string; href: string }, hint: string) => `
  <div style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="520" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr><td style="padding:28px 32px 4px;">
            <div style="font-size:18px;font-weight:700;color:#0f172a;">✈️ TravelTok AI</div>
          </td></tr>
          <tr><td style="padding:12px 32px;">
            <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${title}</h1>
            <div style="font-size:14px;line-height:1.6;color:#475569;">${body}</div>
          </td></tr>
          <tr><td style="padding:12px 32px 24px;">
            <a href="${cta.href}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">${cta.label}</a>
            <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">${hint}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;

export function sendVerificationEmail(
  to: string,
  link: string,
  expiresInHours: number,
): Promise<boolean> {
  return sendMail({
    to,
    subject: "Verify your email to activate your TravelTok AI account",
    text: `Hi!\n\nVerify your email to finish creating your TravelTok AI account. A real, reachable email is required — accounts created with unverified addresses stay inactive.\n\n${link}\n\nThis link expires in ${expiresInHours} hour(s). If you didn't sign up, you can safely ignore this email.`,
    html: layout(
      "Verify your email",
      `<p>Finish creating your account by confirming this address. A real, reachable email is required — accounts created with unverified addresses stay inactive.</p>`,
      { label: "Verify email", href: link },
      `This link expires in ${expiresInHours} hour(s). If you didn't sign up, you can safely ignore this email.`,
    ),
  });
}

export function sendPasswordResetEmail(
  to: string,
  link: string,
  expiresInHours: number,
): Promise<boolean> {
  return sendMail({
    to,
    subject: "Reset your TravelTok AI password",
    text: `Hi!\n\nWe received a request to reset your password. Click the link below to choose a new one:\n\n${link}\n\nThis link expires in ${expiresInHours} hour(s). If you didn't request this, you can safely ignore this email.\n\nIf clicking the link doesn't work, paste it into your browser.`,
    html: layout(
      "Reset your password",
      `<p>We received a request to reset your password. Click the button below to choose a new one.</p>`,
      { label: "Choose a new password", href: link },
      `This link expires in ${expiresInHours} hour(s). If you didn't request this, you can safely ignore this email.`,
    ),
  });
}