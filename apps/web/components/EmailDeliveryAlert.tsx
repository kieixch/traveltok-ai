import { Alert } from "@/components/ui";

/**
 * Shown when the auth email could not actually be dispatched (Gmail SMTP not
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
        Supaya email benar-benar terkirim ke Gmail, konfigurasi Gmail SMTP di{" "}
        <code>apps/web/.env.local</code>: set <code>EMAIL_USER</code> dan{" "}
        <code>EMAIL_APP_PASSWORD</code> (App Password Gmail). Baca petunjuk di
        repo ini untuk cara membuatnya.
      </p>
    </Alert>
  );
}