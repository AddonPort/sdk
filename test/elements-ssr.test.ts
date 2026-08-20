import { describe, expect, it } from "vitest";
import {
  ADDONPORT_INSTALL_BUTTON_TAG,
  AddonPortInstallButton,
  registerAddonPortElements,
  resolveAddonPortButtonMode,
} from "../src/elements.js";

describe("server import", () => {
  it("loads without browser globals", () => {
    expect(ADDONPORT_INSTALL_BUTTON_TAG).toBe("addonport-install-button");
    expect(typeof AddonPortInstallButton).toBe("function");
    expect(typeof registerAddonPortElements).toBe("function");
  });

  it("uses session mode unless direct mode is explicit", () => {
    expect(resolveAddonPortButtonMode(null)).toBe("session");
    expect(resolveAddonPortButtonMode("session")).toBe("session");
    expect(resolveAddonPortButtonMode("direct")).toBe("direct");
  });
});
