import { describe, expect, it } from "vitest";

import {
  buildSessionTokenStorageKey,
  clearStoredSessionToken,
  describeApiOrigin,
  isLocalHostname,
  isRemoteApiOrigin,
  readStoredSessionToken,
  resolveApiOrigin,
  shouldPromptForSessionToken,
  writeStoredSessionToken,
} from "./sessionToken";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("sessionToken", () => {
  it("resolves the API origin from an explicit base", () => {
    expect(resolveApiOrigin("https://studio.example.com/api", "http://localhost:5173")).toBe("https://studio.example.com");
  });

  it("falls back to the browser origin when no API base is configured", () => {
    expect(resolveApiOrigin("", "http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("detects localhost hostnames", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("127.0.0.1")).toBe(true);
    expect(isLocalHostname("studio.example.com")).toBe(false);
  });

  it("prompts only for remote origins without a stored token", () => {
    expect(shouldPromptForSessionToken("https://studio.example.com", "")).toBe(true);
    expect(shouldPromptForSessionToken("http://localhost:7860", "")).toBe(false);
    expect(shouldPromptForSessionToken("https://studio.example.com", "abc123")).toBe(false);
  });

  it("detects remote origins and formats them for UI labels", () => {
    expect(isRemoteApiOrigin("https://studio.example.com")).toBe(true);
    expect(isRemoteApiOrigin("http://localhost:7860")).toBe(false);
    expect(describeApiOrigin("https://studio.example.com:8443/api")).toBe("studio.example.com:8443");
  });

  it("stores and clears tokens per API origin", () => {
    const storage = new MemoryStorage();
    const apiOrigin = "https://studio.example.com";

    writeStoredSessionToken(apiOrigin, "  abc123  ", storage);
    expect(storage.length).toBe(1);
    expect(storage.getItem(buildSessionTokenStorageKey(apiOrigin))).toBe("abc123");
    expect(readStoredSessionToken(apiOrigin, storage)).toBe("abc123");

    clearStoredSessionToken(apiOrigin, storage);
    expect(storage.length).toBe(0);
    expect(readStoredSessionToken(apiOrigin, storage)).toBe("");
  });
});
