# AddonPort SDK

The protocol and frontend integration package for opening AddonPort adapters from websites.

## Install

~~~bash
npm install @addonport/sdk
~~~

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

See [addonport.dev/developers](https://addonport.dev/developers) for framework examples and the
native Windows integration contract.
