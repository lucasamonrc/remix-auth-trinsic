# TrinsicStrategy

[![Version](https://img.shields.io/npm/v/remix-auth-trinsic.svg)](https://www.npmjs.org/package/remix-auth-trinsic)
[![Build Status](https://github.com/lucasamonrc/remix-auth-trinsic/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasamonrc/remix-auth-trinsic/actions?query=branch%main)

A Remix Auth strategy to work Trinsic's widget identity verification sessions

## Supported runtimes

| Runtime    | Has Support |
| ---------- | ----------- |
| Node.js    | ✅          |
| Cloudflare | ✅          |

## How to use

This Strategy gives you back on the verify function Trinsic's `GetSessionResultResponse` data and the instance of the request.

This let you use Trinsic's digital identity network to authenticate users. You'll obviously need an account with Trinsic and an app set up with them to use this strategy.

First, install the strategy and Remix Auth.

```bash
$ npm install remix-auth remix-auth-trinsic
```

Then, create an Authenticator instance.

```ts
import { Authenticator } from "remix-auth";
import { User } from "~/models/user";

export let authenticator = new Authenticator<User>();
```

And you can tell the authenticator to use the FormStrategy.

```ts
import { TrinsicStrategy } from "remix-auth-trinsic";

authenticator.use(
  new TrinsicStrategy<User>(
    {
      accessToken: process.env.TRINSIC_ACCESS_TOKEN,
      redirectUrl: "https://example.com/auth/callback",
      providers: ["clear", "yoti", "ca-mdl"], // optional
      knownIdentityData: { ... } // optional
    },
    async ({ results }) => {
      const data = results.identityData

      // process data to create/find a user

      return user;
    }
  ),
  // this is optional, but if you setup more than one Trinsic instance you will
  // need to set a custom name to each one, by default is "trinsic"
  "provider-name"
);
```

Then you will need to setup your routes, you will need to call the `authenticate` method twice.

First, you will call the `authenticate` method with the provider name you set in the authenticator.

```ts
export async function action({ request }: Route.ActionArgs) {
  await authenticator.authenticate("provider-name", request);
}
```

> [!NOTE]
> This route can be an `action` or a `loader`, it depends if you trigger the flow doing a POST or GET request.

This will start the verification flow and redirect the user to Trinsic. Once the user completes the identity verification, Trinsic will redirect the user back to your application redirect URL.

You will now need a route on that URL to handle the callback from Trinsic.

```ts
export async function loader({ request }: Route.LoaderArgs) {
  let user = await authenticator.authenticate("provider-name", request);
  // now you have the user object with the data you returned in the verify function
}
```

> [!NOTE]
> This route must be a `loader` as the redirect will trigger a `GET` request.

Once you have the `user` object returned by your strategy verify function, you can do whatever you want with that information. This can be storing the user in a session, creating a new user in your database, link the account to an existing user in your database, etc.
