export const SESSION_TOKEN_HEADER = "X-LeStudio-Token";

const TOKEN_STORAGE_PREFIX = "lestudio-session-token:";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname.trim().toLowerCase());
}

export function resolveApiOrigin(apiBase: string, windowOrigin = ""): string {
  const normalizedBase = apiBase.trim();
  const normalizedWindowOrigin = windowOrigin.trim();

  if (!normalizedBase) {
    return normalizedWindowOrigin;
  }

  try {
    return new URL(normalizedBase, normalizedWindowOrigin || undefined).origin;
  } catch {
    return normalizedWindowOrigin;
  }
}

export function buildSessionTokenStorageKey(apiOrigin: string): string {
  return `${TOKEN_STORAGE_PREFIX}${apiOrigin || "default"}`;
}

export function isRemoteApiOrigin(apiOrigin: string): boolean {
  if (!apiOrigin) {
    return false;
  }

  try {
    return !isLocalHostname(new URL(apiOrigin).hostname);
  } catch {
    return false;
  }
}

export function shouldPromptForSessionToken(apiOrigin: string, storedToken: string): boolean {
  if (storedToken.trim()) {
    return false;
  }

  return isRemoteApiOrigin(apiOrigin);
}

export function describeApiOrigin(apiOrigin: string): string {
  if (!apiOrigin) {
    return "Current server";
  }

  try {
    const url = new URL(apiOrigin);
    return url.host;
  } catch {
    return apiOrigin;
  }
}

export function readStoredSessionToken(apiOrigin: string, storage: Storage | null | undefined): string {
  if (!storage) {
    return "";
  }

  return storage.getItem(buildSessionTokenStorageKey(apiOrigin))?.trim() ?? "";
}

export function writeStoredSessionToken(apiOrigin: string, token: string, storage: Storage | null | undefined): void {
  if (!storage) {
    return;
  }

  const normalized = token.trim();
  const key = buildSessionTokenStorageKey(apiOrigin);
  if (normalized) {
    storage.setItem(key, normalized);
    return;
  }
  storage.removeItem(key);
}

export function clearStoredSessionToken(apiOrigin: string, storage: Storage | null | undefined): void {
  writeStoredSessionToken(apiOrigin, "", storage);
}
