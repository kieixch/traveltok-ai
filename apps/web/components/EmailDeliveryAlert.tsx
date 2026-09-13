import { Alert } from "@/components/ui";

/**
 * Shown when the auth email could not actually be dispatched (Brevo not
 * configured). Displays the fresh verification/reset link directly so the flow
 * stays usable locally, and explains how to enable real delivery.
 */
export function EmailDeliveryAlert({
  link,
  label,
  message,
}: {
  link?: string | null;
  label: string;
  message?: string;
}) {
  if (!link) return null;
  return (
    <Alert kind="info">
      <p>
        {message ??
          "Email belum dikirim karena kunci email belum dikonfigurasi — pakai link di bawah ini dulu."}
      </p>
      <p className="mt-2 break-all">
        <a href={link} className="font-medium underline">
          {label}
        </a>
      </p>
      <p className="mt-2 text-xs opacity-80">
        Supaya email benar-benar terkirim ke Gmail, daftar gratis di{" "}
        <a href="https://www.brevo.com" className="underline" target="_blank" rel="noopener noreferrer">brevo.com</a>,
        buat sender di Settings &gt; Senders &amp; IP, lalu set{" "}
        <code>BREVO_API_KEY</code> dan <code>BREVO_SENDER_EMAIL</code> di{" "}
        <code>apps/web/.env.local</code>.
      </p>
    </Alert>
  );
}