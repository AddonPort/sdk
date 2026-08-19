import {
  type AddonPortIntent,
  assertIntent,
  type CreatedSession,
  type CreateSessionRequest,
  isRecord,
  isSessionId,
  isSessionState,
  isSessionToken,
  isTerminalSessionState,
  parseConnectDeepLink,
  type SessionSnapshot,
} from "./protocol.js";

export type { AddonPortIntent, CreatedSession, SessionSnapshot } from "./protocol.js";

export interface AddonPortClientOptions {
  apiBaseUrl: string;
  fetch?: typeof globalThis.fetch;
  launch?: (deepLink: string) => void;
  pollIntervalMs?: number;
  requestTimeoutMs?: number;
  client?: CreateSessionRequest["client"];
}

export interface WaitOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  claimTimeoutMs?: number;
  onStatus?: (snapshot: SessionSnapshot) => void;
}

export class AddonPortError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "AddonPortError";
    this.code = code;
    this.status = status;
  }
}

export class AddonPortSession {
  readonly created: CreatedSession;
  readonly intent: AddonPortIntent;
  #client: AddonPortClient;
  #opened = false;

  constructor(client: AddonPortClient, intent: AddonPortIntent, created: CreatedSession) {
    this.#client = client;
    this.intent = intent;
    this.created = created;
  }

  get opened(): boolean {
    return this.#opened;
  }

  open(): void {
    this.#client.launch(this.created.deepLink);
    this.#opened = true;
  }

  wait(options: WaitOptions = {}): Promise<SessionSnapshot> {
    return this.#client.waitForSession(this.created, options);
  }
}

export class AddonPortClient {
  readonly apiBaseUrl: string;
  readonly pollIntervalMs: number;
  readonly requestTimeoutMs: number;
  readonly clientMetadata?: CreateSessionRequest["client"];
  #fetch: typeof globalThis.fetch;
  #launch: (deepLink: string) => void;

  constructor(options: AddonPortClientOptions) {
    const apiUrl = new URL(options.apiBaseUrl);
    const localHttp =
      apiUrl.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname);
    if (
      (apiUrl.protocol !== "https:" && !localHttp) ||
      apiUrl.username ||
      apiUrl.password ||
      apiUrl.search ||
      apiUrl.hash
    ) {
      throw new TypeError("AddonPort API must use HTTPS or local HTTP.");
    }
    this.apiBaseUrl = apiUrl.toString().replace(/\/$/, "");
    this.pollIntervalMs = durationOption(options.pollIntervalMs, 800, "pollIntervalMs", 1);
    this.requestTimeoutMs = durationOption(options.requestTimeoutMs, 8_000, "requestTimeoutMs", 1);
    this.clientMetadata = options.client;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#launch = options.launch ?? defaultLaunch;
  }

  async prepare(intent: AddonPortIntent, signal?: AbortSignal): Promise<AddonPortSession> {
    assertIntent(intent);
    const created = await this.#request<CreatedSession>("/v2/sessions", {
      method: "POST",
      body: JSON.stringify({ intent, client: this.clientMetadata }),
      headers: { "content-type": "application/json" },
      signal,
    });
    validateCreatedSession(created);
    return new AddonPortSession(this, intent, created);
  }

  async run(intent: AddonPortIntent, options: WaitOptions = {}): Promise<SessionSnapshot> {
    const session = await this.prepare(intent, options.signal);
    session.open();
    return session.wait(options);
  }

  launch(deepLink: string): void {
    this.#launch(deepLink);
  }

  async waitForSession(
    created: CreatedSession,
    options: WaitOptions = {},
  ): Promise<SessionSnapshot> {
    const timeoutMs = durationOption(
      options.timeoutMs,
      Math.max(0, Date.parse(created.expiresAt) - Date.now()),
      "timeoutMs",
      0,
    );
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;
    const claimTimeoutMs = durationOption(options.claimTimeoutMs, 15_000, "claimTimeoutMs", 0);
    const claimDeadline = Math.min(deadline, startedAt + claimTimeoutMs);
    let unclaimedPolls = 0;
    while (Date.now() <= deadline) {
      if (options.signal?.aborted) throw abortError();
      const snapshot = await this.#request<unknown>(`/v2/sessions/${created.sessionId}`, {
        headers: { authorization: `Bearer ${created.pollToken}` },
        signal: options.signal,
      });
      validateSessionSnapshot(snapshot, created);
      options.onStatus?.(snapshot);
      if (isTerminalSessionState(snapshot.state)) return snapshot;
      if (snapshot.state === "created" && Date.now() >= claimDeadline) {
        throw new AddonPortError(
          "client_unavailable",
          "No AddonPort client claimed the session. Install or start the native client and try again.",
        );
      }
      unclaimedPolls = snapshot.state === "created" ? unclaimedPolls + 1 : 0;
      const interval =
        snapshot.state === "created"
          ? Math.min(2_500, Math.ceil(this.pollIntervalMs * 1.35 ** unclaimedPolls))
          : this.pollIntervalMs;
      await delay(Math.min(interval, Math.max(0, deadline - Date.now())), options.signal);
    }
    throw new AddonPortError("session_timeout", "The AddonPort session did not finish in time.");
  }

  async #request<T>(path: string, init: RequestInit): Promise<T> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.requestTimeoutMs);
    const signal = combineSignals(init.signal, timeoutController.signal);
    try {
      const response = await this.#fetch(`${this.apiBaseUrl}${path}`, { ...init, signal });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
        throw new AddonPortError(
          typeof error?.code === "string" ? error.code : "request_failed",
          typeof error?.message === "string"
            ? error.message
            : `AddonPort request failed (${response.status}).`,
          response.status,
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof AddonPortError) throw error;
      if (init.signal?.aborted) throw abortError();
      if (signal.aborted)
        throw new AddonPortError(
          "request_timeout",
          "The AddonPort service did not respond in time.",
        );
      throw new AddonPortError(
        "network_error",
        error instanceof Error ? error.message : "Network request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function defaultLaunch(deepLink: string): void {
  if (typeof window === "undefined") {
    throw new AddonPortError("browser_required", "Opening AddonPort requires a browser window.");
  }
  window.location.assign(deepLink);
}

function validateCreatedSession(value: unknown): asserts value is CreatedSession {
  if (
    !isRecord(value) ||
    value.protocolVersion !== 2 ||
    typeof value.sessionId !== "string" ||
    typeof value.claimToken !== "string" ||
    typeof value.pollToken !== "string" ||
    typeof value.deepLink !== "string" ||
    typeof value.expiresAt !== "string" ||
    !isSessionId(value.sessionId) ||
    !isSessionToken(value.claimToken) ||
    !isSessionToken(value.pollToken) ||
    !Number.isFinite(Date.parse(value.expiresAt))
  ) {
    throw new AddonPortError(
      "invalid_response",
      "The AddonPort service returned an invalid session.",
    );
  }
  try {
    const parsed = parseConnectDeepLink(value.deepLink);
    if (parsed.sessionId !== value.sessionId || parsed.claimToken !== value.claimToken) throw null;
  } catch {
    throw new AddonPortError(
      "invalid_response",
      "The AddonPort service returned an invalid session link.",
    );
  }
}

function validateSessionSnapshot(
  value: unknown,
  created: CreatedSession,
): asserts value is SessionSnapshot {
  let validIntent = false;
  if (isRecord(value)) {
    try {
      assertIntent(value.intent);
      validIntent = true;
    } catch {
      validIntent = false;
    }
  }
  if (
    !isRecord(value) ||
    value.protocolVersion !== 2 ||
    value.sessionId !== created.sessionId ||
    !validIntent ||
    !isSessionState(value.state) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    value.expiresAt !== created.expiresAt ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !hasOptionalStrings(value.client, ["adapter", "version", "platform"]) ||
    !hasOptionalStrings(value.result, ["installedVersion", "message"]) ||
    !isOptionalError(value.error)
  ) {
    throw new AddonPortError(
      "invalid_response",
      "The AddonPort service returned an invalid session status.",
    );
  }
}

function hasOptionalStrings(value: unknown, keys: string[]): boolean {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    keys.every((key) => value[key] === undefined || typeof value[key] === "string")
  );
}

function isOptionalError(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) && typeof value.code === "string" && typeof value.message === "string")
  );
}

function durationOption(
  value: number | undefined,
  fallback: number,
  name: string,
  minimum: number,
) {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < minimum) {
    throw new TypeError(`${name} must be a finite number greater than or equal to ${minimum}.`);
  }
  return result;
}

function combineSignals(first: AbortSignal | null | undefined, second: AbortSignal): AbortSignal {
  if (!first) return second;
  return AbortSignal.any([first, second]);
}

function delay(duration: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const handleAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, duration);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function abortError(): AddonPortError {
  return new AddonPortError("aborted", "The AddonPort operation was cancelled.");
}
