import { Alert } from "@/components/ui";

/**
 * Shown when the auth email could not actually be dispatched (no
 * RESEND_API_KEY). Displays the fresh verification/reset link directly so the
 * flow stays usable locally, and explains how to enable real delivery.
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
        Supaya email benar-benar sampai ke Gmail, aktifkan Resend: set{" "}
        <code>RESEND_API_KEY</code> dan <code>EMAIL_FROM</code> (dari domain
        terverifikasi) di <code>apps/web/.env.local</code> dan Vercel.
      </p>
    </Alert>
  );
}