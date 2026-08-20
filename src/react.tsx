import "./elements.js";
import type { HTMLAttributes } from "react";
import { forwardRef, useEffect, useRef } from "react";
import type { AddonPortOpenDetail } from "./elements.js";
import type { SessionSnapshot } from "./index.js";

export interface AddonPortInstallButtonProps extends Omit<HTMLAttributes<HTMLElement>, "onError"> {
  target: string;
  label?: string;
  apiBaseUrl?: string;
  disabled?: boolean;
  onOpen?: (handoff: AddonPortOpenDetail) => void;
  onStatus?: (session: SessionSnapshot) => void;
  onComplete?: (session: SessionSnapshot) => void;
  onError?: (error: unknown) => void;
}

export const AddonPortInstallButton = forwardRef<HTMLElement, AddonPortInstallButtonProps>(
  function AddonPortInstallButton(
    { target, label, apiBaseUrl, disabled, onOpen, onStatus, onComplete, onError, ...props },
    forwardedRef,
  ) {
    const localRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
      const element = localRef.current;
      if (!element) return;
      const status = (event: Event) => onStatus?.((event as CustomEvent<SessionSnapshot>).detail);
      const open = (event: Event) => onOpen?.((event as CustomEvent<AddonPortOpenDetail>).detail);
      const complete = (event: Event) =>
        onComplete?.((event as CustomEvent<SessionSnapshot>).detail);
      const error = (event: Event) => onError?.((event as CustomEvent<unknown>).detail);
      element.addEventListener("addonport-open", open);
      element.addEventListener("addonport-status", status);
      element.addEventListener("addonport-complete", complete);
      element.addEventListener("addonport-error", error);
      return () => {
        element.removeEventListener("addonport-open", open);
        element.removeEventListener("addonport-status", status);
        element.removeEventListener("addonport-complete", complete);
        element.removeEventListener("addonport-error", error);
      };
    }, [onComplete, onError, onOpen, onStatus]);

    return (
      <addonport-install-button
        {...props}
        ref={(node: HTMLElement | null) => {
          localRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        target={target}
        label={label}
        api-base-url={apiBaseUrl}
        disabled={disabled ? "" : undefined}
      />
    );
  },
);

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "addonport-install-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        target: string;
        label?: string;
        "api-base-url"?: string;
        disabled?: string;
      };
    }
  }
}

export type { SessionSnapshot } from "./index.js";
