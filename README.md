# AddonPort SDK

Experimental protocol and frontend integration package for website-to-adapter handoffs.

> [!IMPORTANT]
> This is an early GitHub beta and is not published to npm. The hosted Connect service is live at
> `https://connect.addonport.dev`, while direct `addonport://` links remain the simplest FACEIT
> integration and do not require this SDK.

## Install

~~~bash
npm install github:AddonPort/sdk#v0.1.0-beta.1
~~~

This installs the current GitHub beta. The public npm package is not live yet.

## Entry points

| Import | Purpose |
| --- | --- |
| <code>@addonport/sdk</code> | Framework-neutral session client |
| <code>@addonport/sdk/protocol</code> | Versioned intents, validation, states, and deep links |
| <code>@addonport/sdk/elements</code> | Drop-in custom element |
| <code>@addonport/sdk/react</code> | React wrapper |
| <code>@addonport/sdk/vue</code> | Vue 3 wrapper |

Framework bindings are optional subpath exports. Importing the core client does not load React or
Vue.

## Core client

Against the public beta [AddonPort Connect](https://github.com/AddonPort/connect) service:

~~~ts
import { AddonPortClient } from "@addonport/sdk";

const client = new AddonPortClient({
  apiBaseUrl: "https://connect.addonport.dev",
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
