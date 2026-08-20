import { describe, expect, it, vi } from "vitest";
import { AddonPortClient, DEFAULT_ADDONPORT_API_BASE_URL } from "../src/index.js";

const created = {
  protocolVersion: 2 as const,
  sessionId: "0123456789abcdefghij",
  claimToken: "abcdefghijklmnopqrstuvwxyz_ABCDE-12345",
  pollToken: "ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcde-12345",
  deepLink: "addonport://connect/0123456789abcdefghij/abcdefghijklmnopqrstuvwxyz_ABCDE-12345",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe("AddonPortClient", () => {
  it("uses the public Connect service by default", () => {
    const client = new AddonPortClient({});
    expect(client.apiBaseUrl).toBe(DEFAULT_ADDONPORT_API_BASE_URL);
  });

  it("prepares, opens, and polls a session", async () => {
    const launch = vi.fn();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(created))
      .mockResolvedValueOnce(
        Response.json({
          ...created,
          intent: { action: "install", target: "faceit-forecast" },
          state: "completed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
    const client = new AddonPortClient({
      apiBaseUrl: "https://connect.addonport.dev",
      fetch,
      launch,
      pollIntervalMs: 1,
    });
    const session = await client.prepare({ action: "install", target: "faceit-forecast" });
    session.open();
    const result = await session.wait();

    expect(launch).toHaveBeenCalledWith(created.deepLink);
    expect(result.state).toBe("completed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces structured service errors", async () => {
    const client = new AddonPortClient({
      apiBaseUrl: "https://connect.addonport.dev",
      fetch: vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "rate_limited", message: "Try again later." } },
            { status: 429 },
          ),
        ),
    });
    await expect(client.prepare({ action: "open" })).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  });

  it("rejects a service response that changes the custom protocol target", async () => {
    const client = new AddonPortClient({
      apiBaseUrl: "https://connect.addonport.dev",
      fetch: vi
        .fn()
        .mockResolvedValue(Response.json({ ...created, deepLink: "another-app://connect" })),
    });
    await expect(client.prepare({ action: "open" })).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("rejects malformed session status responses", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(created))
      .mockResolvedValueOnce(
        Response.json({
          protocolVersion: 2,
          sessionId: created.sessionId,
          intent: { action: "open" },
          state: "finished",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: created.expiresAt,
        }),
      );
    const client = new AddonPortClient({
      apiBaseUrl: "https://connect.addonport.dev",
      fetch,
      pollIntervalMs: 1,
    });
    const session = await client.prepare({ action: "open" });

    await expect(session.wait()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("accepts only HTTPS and explicit local HTTP APIs", () => {
    expect(() => new AddonPortClient({ apiBaseUrl: "ftp://localhost" })).toThrow(TypeError);
    expect(
      () => new AddonPortClient({ apiBaseUrl: "http://127.0.0.1:8787", pollIntervalMs: 0 }),
    ).toThrow(TypeError);
    expect(
      () => new AddonPortClient({ apiBaseUrl: "http://127.0.0.1:8787", pollIntervalMs: 1 }),
    ).not.toThrow();
  });

  it("stops polling when no native client claims the session", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(created))
      .mockResolvedValueOnce(
        Response.json({
          protocolVersion: 2,
          sessionId: created.sessionId,
          intent: { action: "open" },
          state: "created",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: created.expiresAt,
        }),
      );
    const client = new AddonPortClient({
      apiBaseUrl: "https://connect.addonport.dev",
      fetch,
      pollIntervalMs: 1,
    });
    const session = await client.prepare({ action: "open" });

    await expect(session.wait({ claimTimeoutMs: 0 })).rejects.toMatchObject({
      code: "client_unavailable",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
