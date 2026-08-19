export const ADDONPORT_PROTOCOL_VERSION = 2 as const;
export const ADDONPORT_SCHEME = "addonport" as const;
export const SESSION_TTL_SECONDS = 300 as const;

export const sessionStates = [
  "created",
  "client_opened",
  "awaiting_confirmation",
  "completed",
  "rejected",
  "failed",
  "expired",
] as const;

export type SessionState = (typeof sessionStates)[number];
export type TerminalSessionState = Extract<
  SessionState,
  "completed" | "rejected" | "failed" | "expired"
>;

export type AddonPortIntent =
  | { action: "open" }
  | { action: "install"; target: string }
  | { action: "launch"; target: string };

export interface SessionClientMetadata {
  name?: string;
  version?: string;
}

export interface CreateSessionRequest {
  intent: AddonPortIntent;
  client?: SessionClientMetadata;
}

export interface CreatedSession {
  protocolVersion: typeof ADDONPORT_PROTOCOL_VERSION;
  sessionId: string;
  claimToken: string;
  pollToken: string;
  deepLink: string;
  expiresAt: string;
}

export interface SessionError {
  code: string;
  message: string;
}

export interface SessionSnapshot {
  protocolVersion: typeof ADDONPORT_PROTOCOL_VERSION;
  sessionId: string;
  intent: AddonPortIntent;
  state: SessionState;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  client?: {
    adapter?: string;
    version?: string;
    platform?: string;
  };
  result?: {
    installedVersion?: string;
    message?: string;
  };
  error?: SessionError;
}

export interface SessionTransitionRequest {
  state: Exclude<SessionState, "created" | "expired">;
  client?: SessionSnapshot["client"];
  result?: SessionSnapshot["result"];
  error?: SessionError;
}

const chromeExtensionPattern = /^[a-p]{32}$/;
const catalogTargetPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const sessionIdPattern = /^[A-Za-z0-9_-]{20,64}$/;
const tokenPattern = /^[A-Za-z0-9_-]{32,128}$/;

export function isChromeExtensionId(value: string): boolean {
  return chromeExtensionPattern.test(value);
}

export function isCatalogTarget(value: string): boolean {
  return catalogTargetPattern.test(value);
}

export function isAddonTarget(value: string): boolean {
  return isChromeExtensionId(value) || isCatalogTarget(value);
}

export function isSessionId(value: string): boolean {
  return sessionIdPattern.test(value);
}

export function isSessionToken(value: string): boolean {
  return tokenPattern.test(value);
}

export function isSessionState(value: unknown): value is SessionState {
  return typeof value === "string" && (sessionStates as readonly string[]).includes(value);
}

export function isTerminalSessionState(state: SessionState): state is TerminalSessionState {
  return state === "completed" || state === "rejected" || state === "failed" || state === "expired";
}

export function assertIntent(value: unknown): asserts value is AddonPortIntent {
  if (!isRecord(value) || typeof value.action !== "string") {
    throw new TypeError("Intent must be an object with an action.");
  }
  if (value.action === "open") {
    if (Object.keys(value).some((key) => key !== "action")) {
      throw new TypeError("The open intent does not accept a target.");
    }
    return;
  }
  if (
    (value.action === "install" || value.action === "launch") &&
    typeof value.target === "string" &&
    isAddonTarget(value.target) &&
    Object.keys(value).every((key) => key === "action" || key === "target")
  ) {
    return;
  }
  throw new TypeError("Intent contains an unsupported action or target.");
}

export function createConnectDeepLink(sessionId: string, claimToken: string): string {
  if (!isSessionId(sessionId) || !isSessionToken(claimToken)) {
    throw new TypeError("Invalid AddonPort session identifier or claim token.");
  }
  return `${ADDONPORT_SCHEME}://connect/${sessionId}/${claimToken}`;
}

export function createDirectDeepLink(intent: AddonPortIntent): string {
  assertIntent(intent);
  if (intent.action === "open") return `${ADDONPORT_SCHEME}://open`;
  return `${ADDONPORT_SCHEME}://${intent.action}/${intent.target}`;
}

export function parseConnectDeepLink(value: string): { sessionId: string; claimToken: string } {
  const url = new URL(value);
  const segments = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== `${ADDONPORT_SCHEME}:` ||
    url.hostname !== "connect" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    segments.length !== 2
  ) {
    throw new TypeError("Unsupported AddonPort link.");
  }
  const [sessionId, claimToken] = segments;
  if (!sessionId || !claimToken || !isSessionId(sessionId) || !isSessionToken(claimToken)) {
    throw new TypeError("Invalid AddonPort session link.");
  }
  return { sessionId, claimToken };
}

export function createLegacyFaceitLink(intent: AddonPortIntent): string {
  if (intent.action === "open") return "faceit-mods://open";
  return `faceit-mods://${intent.action}/${intent.target}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
