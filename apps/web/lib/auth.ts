const TOKEN_KEY = "traveltok:token";
const USER_KEY = "traveltok:user";
const PROJECT_KEY = "traveltok:projectId";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: StoredUser): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("traveltok:auth"));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(PROJECT_KEY);
  window.dispatchEvent(new CustomEvent("traveltok:auth"));
}

export function getProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PROJECT_KEY);
}

export function setProjectId(projectId: string): void {
  window.localStorage.setItem(PROJECT_KEY, projectId);
}
