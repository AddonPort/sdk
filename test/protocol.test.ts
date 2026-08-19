import { describe, expect, it } from "vitest";
import {
  assertIntent,
  createConnectDeepLink,
  createDirectDeepLink,
  createLegacyFaceitLink,
  isAddonTarget,
  isSessionState,
  isTerminalSessionState,
  parseConnectDeepLink,
} from "../src/protocol.js";

describe("AddonPort protocol", () => {
  it("round-trips a connect link", () => {
    const sessionId = "0123456789abcdefghij";
    const claimToken = "abcdefghijklmnopqrstuvwxyz_ABCDE-12345";
    const link = createConnectDeepLink(sessionId, claimToken);
    expect(parseConnectDeepLink(link)).toEqual({ sessionId, claimToken });
  });

  it("rejects credentials, query strings, and malformed tokens", () => {
    expect(() => parseConnectDeepLink("addonport://user@connect/session/token")).toThrow();
    expect(() =>
      parseConnectDeepLink("addonport://connect/session/token?next=https://example.com"),
    ).toThrow();
    expect(() => createConnectDeepLink("short", "short")).toThrow();
  });

  it("accepts catalog slugs and Chrome extension identifiers", () => {
    expect(isAddonTarget("faceit-forecast")).toBe(true);
    expect(isAddonTarget("mpkkcddegpblmobincjkbpgfcbejjbcp")).toBe(true);
    expect(isAddonTarget("../forecast")).toBe(false);
  });

  it("validates intent shapes strictly", () => {
    expect(() => assertIntent({ action: "install", target: "faceit-forecast" })).not.toThrow();
    expect(() => assertIntent({ action: "open", target: "unused" })).toThrow();
    expect(() => assertIntent({ action: "download", target: "faceit-forecast" })).toThrow();
  });

  it("retains the legacy FACEIT links during migration", () => {
    expect(createDirectDeepLink({ action: "install", target: "faceit-forecast" })).toBe(
      "addonport://install/faceit-forecast",
    );
    expect(createLegacyFaceitLink({ action: "open" })).toBe("faceit-mods://open");
    expect(createLegacyFaceitLink({ action: "launch", target: "faceit-forecast" })).toBe(
      "faceit-mods://launch/faceit-forecast",
    );
  });

  it("identifies every terminal state", () => {
    expect(
      (["completed", "rejected", "failed", "expired"] as const).every(isTerminalSessionState),
    ).toBe(true);
    expect(isTerminalSessionState("client_opened")).toBe(false);
    expect(isSessionState("awaiting_confirmation")).toBe(true);
    expect(isSessionState("finished")).toBe(false);
  });
});
