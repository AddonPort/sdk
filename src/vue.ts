import "./elements.js";
import { defineComponent, h } from "vue";
import type { AddonPortOpenDetail } from "./elements.js";
import type { SessionSnapshot } from "./index.js";

export const AddonPortInstallButton = defineComponent({
  name: "AddonPortInstallButton",
  inheritAttrs: false,
  props: {
    target: { type: String, required: true },
    label: { type: String, default: undefined },
    apiBaseUrl: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    open: (_handoff: AddonPortOpenDetail) => true,
    status: (_session: SessionSnapshot) => true,
    complete: (_session: SessionSnapshot) => true,
    error: (_error: unknown) => true,
  },
  setup(props, { attrs, emit }) {
    return () =>
      h("addonport-install-button", {
        ...attrs,
        target: props.target,
        label: props.label,
        "api-base-url": props.apiBaseUrl,
        disabled: props.disabled ? "" : undefined,
        "onAddonport-open": (event: CustomEvent<AddonPortOpenDetail>) => emit("open", event.detail),
        "onAddonport-status": (event: CustomEvent<SessionSnapshot>) => emit("status", event.detail),
        "onAddonport-complete": (event: CustomEvent<SessionSnapshot>) =>
          emit("complete", event.detail),
        "onAddonport-error": (event: CustomEvent<unknown>) => emit("error", event.detail),
      });
  },
});

export type { SessionSnapshot } from "./index.js";
