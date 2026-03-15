import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../mock-api/handlers", () => ({
  handleMockGet: vi.fn(),
  handleMockPost: vi.fn(),
  handleMockDelete: vi.fn(),
  subscribeNonTrainChannel: vi.fn(() => () => {}),
  subscribeTrainChannel: vi.fn(() => () => {}),
}));

import { handleMockDelete, handleMockGet, handleMockPost } from "../../mock-api/handlers";
import { apiDelete, apiGet, apiPost, getTransportMode, setTransportMode } from "./apiClient";

function jsonResponse(data: unknown, status = 200): Response {
  return {
    status,
    json: async () => data,
  } as Response;
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTransportMode("passthrough");
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses passthrough fetch for GET requests", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiGet<{ ok: boolean }>("/api/ping");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/ping", { method: "GET" });
  });

  it("sends JSON body and content type for POST requests", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ saved: true }));

    const result = await apiPost<{ saved: boolean }>("/api/config", { mode: "bi" });

    expect(result.saved).toBe(true);
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(options.body).toBe('{"mode":"bi"}');
    expect((options.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("uses DELETE method for apiDelete", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiDelete<{ ok: boolean }>("/api/hf/token");

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/hf/token", expect.objectContaining({ method: "DELETE" }));
  });

  it("delegates to mock handlers in mock transport mode", async () => {
    vi.useFakeTimers();
    setTransportMode("mock");
    vi.mocked(handleMockGet).mockResolvedValueOnce({ mode: "mock" });
    vi.mocked(handleMockPost).mockResolvedValueOnce({ posted: true });
    vi.mocked(handleMockDelete).mockResolvedValueOnce({ deleted: true });

    const getPromise = apiGet<{ mode: string }>("/api/devices");
    const postPromise = apiPost<{ posted: boolean }>("/api/config", { test: 1 });
    const deletePromise = apiDelete<{ deleted: boolean }>("/api/config");
    await vi.runAllTimersAsync();

    await expect(getPromise).resolves.toEqual({ mode: "mock" });
    await expect(postPromise).resolves.toEqual({ posted: true });
    await expect(deletePromise).resolves.toEqual({ deleted: true });
    expect(handleMockGet).toHaveBeenCalledWith("/api/devices");
    expect(handleMockPost).toHaveBeenCalledWith("/api/config", { test: 1 });
    expect(handleMockDelete).toHaveBeenCalledWith("/api/config");
    expect(getTransportMode()).toBe("mock");
  });
});
