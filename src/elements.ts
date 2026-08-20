import { Check, CircleAlert, createElement, Download, LoaderCircle } from "lucide";
import type { AddonPortIntent, AddonPortSession, SessionSnapshot } from "./index.js";
import { AddonPortClient } from "./index.js";
import { createDirectDeepLink } from "./protocol.js";

export const ADDONPORT_INSTALL_BUTTON_TAG = "addonport-install-button";

type ButtonPhase = "idle" | "preparing" | "opening" | "waiting" | "complete" | "error";
export type AddonPortButtonMode = "direct" | "session";

export interface AddonPortOpenDetail {
  mode: AddonPortButtonMode;
  intent: AddonPortIntent;
  deepLink: string;
}

const HTMLElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export class AddonPortInstallButton extends HTMLElementBase {
  static readonly observedAttributes = ["target", "label", "api-base-url", "disabled"];

  #root: ShadowRoot;
  #button: HTMLButtonElement;
  #icon: HTMLSpanElement;
  #text: HTMLSpanElement;
  #client?: AddonPortClient;
  #session?: AddonPortSession;
  #preparePromise?: Promise<AddonPortSession>;
  #resetTimer?: ReturnType<typeof setTimeout>;
  #phase: ButtonPhase = "idle";

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.append(createStyles());
    this.#button = document.createElement("button");
    this.#button.type = "button";
    this.#button.part.add("button");
    this.#icon = document.createElement("span");
    this.#icon.className = "icon";
    this.#icon.part.add("icon");
    this.#text = document.createElement("span");
    this.#text.className = "label";
    this.#text.part.add("label");
    this.#button.append(this.#icon, this.#text);
    this.#root.append(this.#button);
  }

  connectedCallback(): void {
    this.#button.addEventListener("pointerenter", this.#prepare);
    this.#button.addEventListener("pointerdown", this.#prepare);
    this.#button.addEventListener("focus", this.#prepare);
    this.#button.addEventListener("click", this.#activate);
    this.#render();
  }

  disconnectedCallback(): void {
    this.#button.removeEventListener("pointerenter", this.#prepare);
    this.#button.removeEventListener("pointerdown", this.#prepare);
    this.#button.removeEventListener("focus", this.#prepare);
    this.#button.removeEventListener("click", this.#activate);
    this.#clearResetTimer();
  }

  attributeChangedCallback(): void {
    this.#clearResetTimer();
    this.#client = undefined;
    this.#session = undefined;
    this.#preparePromise = undefined;
    this.#phase = "idle";
    this.#render();
  }

  get target(): string {
    return this.getAttribute("target")?.trim() ?? "";
  }

  set target(value: string) {
    this.setAttribute("target", value);
  }

  #prepare = (): void => {
    if (
      !this.#usesSession ||
      this.#phase !== "idle" ||
      this.hasAttribute("disabled") ||
      !this.target
    )
      return;
    void this.#ensureSession().catch(() => undefined);
  };

  #activate = async (): Promise<void> => {
    if (this.hasAttribute("disabled") || !this.target || !["idle", "error"].includes(this.#phase))
      return;
    try {
      if (!this.#usesSession) {
        this.#openDirect();
        return;
      }
      const session = await this.#ensureSession();
      this.#phase = "opening";
      this.#render();
      session.open();
      this.#dispatchOpen("session", session.intent, session.created.deepLink);
      this.#phase = "waiting";
      this.#render();
      const result = await session.wait({ onStatus: this.#handleStatus });
      if (result.state === "completed") {
        this.dispatchEvent(
          new CustomEvent("addonport-complete", { detail: result, bubbles: true, composed: true }),
        );
      }
    } catch (error) {
      this.#session = undefined;
      this.#preparePromise = undefined;
      this.#phase = "error";
      this.#button.title = error instanceof Error ? error.message : "AddonPort could not open.";
      this.#render();
      this.dispatchEvent(
        new CustomEvent("addonport-error", { detail: error, bubbles: true, composed: true }),
      );
    }
  };

  #ensureSession(): Promise<AddonPortSession> {
    if (this.#session) return Promise.resolve(this.#session);
    if (this.#preparePromise) return this.#preparePromise;
    this.#phase = "preparing";
    this.#render();
    this.#preparePromise = this.#getClient()
      .prepare({ action: "install", target: this.target })
      .then((session) => {
        this.#session = session;
        this.#phase = "idle";
        this.#render();
        return session;
      })
      .catch((error) => {
        this.#preparePromise = undefined;
        this.#phase = "error";
        this.#button.title =
          error instanceof Error ? error.message : "AddonPort could not prepare.";
        this.#render();
        throw error;
      });
    return this.#preparePromise;
  }

  #getClient(): AddonPortClient {
    if (!this.#client) {
      const apiBaseUrl = this.getAttribute("api-base-url")?.trim();
      if (!apiBaseUrl) throw new TypeError("Session mode requires api-base-url.");
      this.#client = new AddonPortClient({
        apiBaseUrl,
        client: { name: "@addonport/sdk/elements", version: "0.1.0-beta.2" },
      });
    }
    return this.#client;
  }

  get #usesSession(): boolean {
    return Boolean(this.getAttribute("api-base-url")?.trim());
  }

  #openDirect(): void {
    const intent = { action: "install", target: this.target } as const;
    const deepLink = createDirectDeepLink(intent);
    this.#phase = "opening";
    this.#render();
    window.location.assign(deepLink);
    this.#dispatchOpen("direct", intent, deepLink);
    this.#resetTimer = setTimeout(() => {
      this.#phase = "idle";
      this.#render();
    }, 1_200);
  }

  #dispatchOpen(mode: AddonPortButtonMode, intent: AddonPortIntent, deepLink: string): void {
    const detail: AddonPortOpenDetail = { mode, intent, deepLink };
    this.dispatchEvent(
      new CustomEvent<AddonPortOpenDetail>("addonport-open", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  #clearResetTimer(): void {
    if (this.#resetTimer !== undefined) clearTimeout(this.#resetTimer);
    this.#resetTimer = undefined;
  }

  #handleStatus = (snapshot: SessionSnapshot): void => {
    this.dispatchEvent(
      new CustomEvent("addonport-status", { detail: snapshot, bubbles: true, composed: true }),
    );
    if (snapshot.state === "completed") this.#phase = "complete";
    if (
      snapshot.state === "failed" ||
      snapshot.state === "rejected" ||
      snapshot.state === "expired"
    ) {
      this.#session = undefined;
      this.#preparePromise = undefined;
      this.#phase = "error";
    }
    this.#render();
  };

  #render(): void {
    if (!this.#button) return;
    const label = this.getAttribute("label") || "Install with AddonPort";
    const content = buttonContent(this.#phase, label);
    if (this.#phase !== "error") this.#button.removeAttribute("title");
    this.#text.textContent = content.text;
    this.#button.disabled =
      this.hasAttribute("disabled") ||
      !this.target ||
      ["preparing", "opening", "waiting", "complete"].includes(this.#phase);
    this.#button.dataset.phase = this.#phase;
    this.#button.setAttribute(
      "aria-busy",
      String(["preparing", "opening", "waiting"].includes(this.#phase)),
    );
    this.#icon.replaceChildren(createElement(content.icon));
  }
}

export function registerAddonPortElements(registry: CustomElementRegistry = customElements): void {
  if (!registry.get(ADDONPORT_INSTALL_BUTTON_TAG)) {
    registry.define(ADDONPORT_INSTALL_BUTTON_TAG, AddonPortInstallButton);
  }
}

function buttonContent(phase: ButtonPhase, label: string) {
  switch (phase) {
    case "preparing":
      return { text: "Preparing...", icon: LoaderCircle };
    case "opening":
      return { text: "Opening AddonPort", icon: LoaderCircle };
    case "waiting":
      return { text: "Waiting for AddonPort", icon: LoaderCircle };
    case "complete":
      return { text: "Installed", icon: Check };
    case "error":
      return { text: "Try again", icon: CircleAlert };
    default:
      return { text: label, icon: Download };
  }
}

function createStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = `
    :host {
      --addonport-accent: #ff5c35;
      --addonport-bg: #f4f4f4;
      --addonport-fg: #111111;
      display: inline-block;
      color-scheme: light dark;
    }
    button {
      appearance: none;
      align-items: center;
      background: var(--addonport-bg);
      border: 1px solid color-mix(in srgb, var(--addonport-fg) 14%, transparent);
      border-radius: 6px;
      color: var(--addonport-fg);
      cursor: pointer;
      display: inline-flex;
      font: 600 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      gap: 8px;
      height: 38px;
      justify-content: center;
      letter-spacing: 0;
      padding: 0 14px;
      transition: background-color 140ms ease, border-color 140ms ease, transform 100ms ease;
      white-space: nowrap;
    }
    button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--addonport-bg) 92%, var(--addonport-accent));
      border-color: color-mix(in srgb, var(--addonport-accent) 55%, transparent);
    }
    button:active:not(:disabled) { transform: translateY(1px); }
    button:focus-visible { outline: 2px solid var(--addonport-accent); outline-offset: 2px; }
    button:disabled { cursor: not-allowed; opacity: 0.62; }
    button[data-phase="complete"] { --addonport-accent: #2e9b62; }
    button[data-phase="error"] { --addonport-accent: #d14343; }
    .icon { display: grid; height: 17px; place-items: center; width: 17px; }
    .icon > svg { height: 17px; stroke-width: 2; width: 17px; }
    button[data-phase="preparing"] .icon > svg,
    button[data-phase="opening"] .icon > svg,
    button[data-phase="waiting"] .icon > svg { animation: spin 900ms linear infinite; }
    .label { overflow: hidden; text-overflow: ellipsis; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-color-scheme: dark) {
      :host { --addonport-bg: #232323; --addonport-fg: #f7f7f7; }
    }
    @media (prefers-reduced-motion: reduce) {
      button { transition: none; }
      .icon > svg { animation-duration: 1600ms !important; }
    }
  `;
  return style;
}

if (typeof window !== "undefined" && "customElements" in window) registerAddonPortElements();
