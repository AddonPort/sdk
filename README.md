# AddonPort SDK

Experimental protocol and frontend integration package for website-to-adapter handoffs.

> [!IMPORTANT]
> This is an early GitHub beta and is not published to npm. The install button uses the public
> AddonPort Connect service by default and falls back to a direct `addonport://install` handoff if a
> session cannot be prepared or no compatible client claims it.

## Install

~~~bash
npm install github:AddonPort/sdk#v0.1.0-beta.3
~~~

This installs the current GitHub beta. The public npm package is not live yet.

## Entry points

| Import | Purpose |
| --- | --- |
| <code>@addonport/sdk</code> | Framework-neutral session client |
| <code>@addonport/sdk/protocol</code> | Versioned intents, validation, states, and deep links |
| <code>@addonport/sdk/elements</code> | Drop-in custom element |
| <code>@addonport/sdk/embed</code> | Browser-bundle exports |
| <code>@addonport/sdk/react</code> | React wrapper |
| <code>@addonport/sdk/vue</code> | Vue 3 wrapper |

Framework bindings are optional subpath exports. Importing the core client does not load React or
Vue.

## Script tag

The standalone browser build registers `<addonport-install-button>` automatically:

~~~html
<script src="https://addonport.dev/sdk/v0.1.0-beta.3/addonport-button.js" defer></script>

<addonport-install-button
  target="abcdefghijklmnopabcdefghijklmnop"
  label="Install for FACEIT"
></addonport-install-button>
~~~

By default the button creates a short-lived session through `https://connect.addonport.dev`, opens
its `addonport://connect/...` handoff, and reports status until the FACEIT adapter completes or
rejects the request. Listen for the lifecycle events to update the surrounding page:

~~~js
document.querySelector("addonport-install-button").addEventListener("addonport-open", (event) => {
  console.log(event.detail.mode, event.detail.intent, event.detail.deepLink);
});

document.querySelector("addonport-install-button").addEventListener("addonport-complete", (event) => {
  console.log(event.detail.state, event.detail.result);
});
~~~

Set `mode="direct"` to skip Connect and open `addonport://install/<target>` immediately. Set
`api-base-url="https://your-connect-endpoint.example"` to use a compatible private service instead
of the public endpoint.

### Element contract

| Attribute | Required | Meaning |
| --- | --- | --- |
| `target` | Yes | Chrome Web Store extension ID or AddonPort catalog slug |
| `label` | No | Idle button label; defaults to `Install with AddonPort` |
| `disabled` | No | Boolean attribute that disables interaction |
| `mode` | No | `session` by default; set to `direct` to skip Connect |
| `api-base-url` | No | Overrides the public Connect endpoint used by session mode |

| Event | `detail` | Emitted in |
| --- | --- | --- |
| `addonport-open` | `{ mode, intent, deepLink }` | Direct and session modes |
| `addonport-status` | `SessionSnapshot` | Session mode |
| `addonport-complete` | Completed `SessionSnapshot` | Session mode |
| `addonport-error` | The thrown error | Direct and session modes |

`addonport-open` confirms only that the page requested a native handoff. A completed session is a
user-experience signal, not authentication or device attestation. If session preparation fails, the
button emits `addonport-error` before opening the direct fallback; `addonport-open.detail.mode` then
equals `direct`.

The Shadow DOM exposes `button`, `icon`, and `label` parts. Override
`--addonport-accent`, `--addonport-bg`, and `--addonport-fg` on the host element to match the site.

## React

~~~tsx
import { AddonPortInstallButton } from "@addonport/sdk/react";

export function FaceitInstall() {
  return (
    <AddonPortInstallButton
      target="abcdefghijklmnopabcdefghijklmnop"
      label="Install for FACEIT"
      onOpen={({ deepLink }) => console.log(deepLink)}
    />
  );
}
~~~

## Vue 3

~~~vue
<script setup lang="ts">
import { AddonPortInstallButton } from "@addonport/sdk/vue";
</script>

<template>
  <AddonPortInstallButton
    target="abcdefghijklmnopabcdefghijklmnop"
    label="Install for FACEIT"
    @open="({ deepLink }) => console.log(deepLink)"
  />
</template>
~~~

## Core client

Against the public beta [AddonPort Connect](https://github.com/AddonPort/connect) service:

~~~ts
import { AddonPortClient } from "@addonport/sdk";

const client = new AddonPortClient({
  client: { name: "extension-site", version: "1.0.0" },
});

const result = await client.run({
  action: "install",
  target: "abcdefghijklmnopabcdefghijklmnop",
});
~~~

The result confirms that an AddonPort adapter claimed and completed the short-lived session. It is
a user-experience signal, not device attestation, and must not be used for authentication or
authorization.

## Development

~~~bash
pnpm install
pnpm check
~~~

For the integration that works with the current public FACEIT beta, use the
[`addonport://` contract](https://github.com/AddonPort/faceit/blob/dev/docs/INTEGRATION.md).
Framework examples for the generic flow currently live in the
[website source](https://github.com/AddonPort/website).
