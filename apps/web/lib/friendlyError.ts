import { ApiError } from "./api";

/**
 * Maps a caught error to a user-friendly message. Raw server/provider text is
 * never shown; the API layer already sanitizes internal errors, so the server
 * `message` is only used as a last-resort fallback.
 */
export function friendlyError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Terjadi kesalahan. Silakan coba lagi.";
  }

  switch (err.code) {
    case "AI_QUOTA_EXCEEDED":
    case "AI_RATE_LIMITED":
      return "Kuota AI (Gemini) harian telah habis. Coba lagi nanti, atau pilih provider Mock di menu AI Engine untuk demo.";
    case "AI_INVALID_KEY":
      return "Kunci API AI tidak valid. Periksa konfigurasi server.";
    case "AI_UNAVAILABLE":
      return "Layanan AI sedang tidak tersedia. Coba lagi beberapa saat.";
    case "AI_INVALID_RESPONSE":
      return "Respons AI tidak valid. Silakan coba lagi.";
    case "NETWORK_ERROR":
      return "Tidak dapat terhubung ke server. Periksa koneksi internet.";
    case "UNAUTHORIZED":
      return "Sesi Anda telah berakhir. Silakan login kembali.";
    case "FORBIDDEN":
      return "Anda tidak memiliki izin untuk melakukan aksi ini.";
    case "RECORD_NOT_FOUND":
      return "Data tidak ditemukan. Mungkin telah dihapus.";
    case "UNIQUE_CONSTRAINT_VIOLATION":
      return "Data tersebut sudah ada.";
    case "VALIDATION_ERROR":
      return "Input tidak valid. Periksa kembali isian Anda.";
  }

  if (err.status === 0) {
    return "Tidak dapat terhubung ke server. Periksa koneksi internet.";
  }
  if (err.status === 429) {
    return "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.";
  }
  if (err.status === 401) {
    return "Sesi Anda telah berakhir. Silakan login kembali.";
  }
  if (err.status === 403) {
    return "Anda tidak memiliki izin untuk melakukan aksi ini.";
  }
  if (err.status === 404) {
    return "Data tidak ditemukan. Mungkin telah dihapus.";
  }
  if (err.status >= 500) {
    return "Terjadi kesalahan pada server. Silakan coba lagi.";
  }
  return err.message || "Terjadi kesalahan. Silakan coba lagi.";
}
