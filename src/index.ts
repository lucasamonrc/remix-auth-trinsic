import { Cookie, SetCookie } from "@mjackson/headers";
import { Configuration, SessionsApi } from "@trinsic/api";
import type { GetSessionResultResponse, KnownIdentityData } from "@trinsic/api";
import createDebug from "debug";
import { redirect } from "react-router";
import { Strategy } from "remix-auth/strategy";

const debug = createDebug("remix-auth-trinsic");

export class TrinsicStrategy<T> extends Strategy<
	T,
	TrinsicStrategy.VerifyOptions
> {
	readonly name = "trinsic";
	protected readonly cookieName = "trinsic-auth-strategy";
	protected readonly api: SessionsApi;

	constructor(
		protected options: TrinsicStrategy.ConstructorOptions,
		verify: Strategy.VerifyFunction<T, TrinsicStrategy.VerifyOptions>,
	) {
		super(verify);

		const config = new Configuration({
			accessToken: options.accessToken,
		});

		this.api = new SessionsApi(config);
	}

	async authenticate(request: Request): Promise<T> {
		debug("Request URL", request.url);

		let url = new URL(request.url);

		const sessionId = url.searchParams.get("sessionId");
		const resultsAccessKey = url.searchParams.get("resultsAccessKey");

		if (!sessionId || !resultsAccessKey) {
			debug(
				"No sessionId or resultsAccessKey found in the URL, redirecting to Trinsic",
			);
			const { launchUrl, header } = await this.handleSignIn();

			debug("Redirecting to Trinsic", launchUrl.toString());

			throw redirect(launchUrl.toString(), {
				headers: { "Set-Cookie": header.toString() },
			});
		}

		debug("Session ID found in the URL, handling callback");

		return this.handleCallback(request, resultsAccessKey);
	}

	private async handleSignIn() {
		debug("Creating widget session with redirectUrl", this.options.redirectUrl);
		const response = await this.api.createWidgetSession({
			redirectUrl: this.options.redirectUrl,
			providers: this.options.providers,
			knownIdentityData: this.options.knownIdentityData,
		});

		if (!response.launchUrl) {
			throw new TrinsicApiError(
				"Failed to start sign in flow. No launch URL returned.",
			);
		}

		if (!response.sessionId) {
			throw new TrinsicApiError(
				"Failed to start sign in flow. No session ID returned.",
			);
		}

		debug("Widget session created");
		debug("Launch URL", response.launchUrl);
		debug("Session ID", response.sessionId);

		const launchUrl = new URL(response.launchUrl);

		const header = new SetCookie({
			name: this.cookieName,
			value: new URLSearchParams({ sessionId: response.sessionId }).toString(),
			httpOnly: true,
			maxAge: 60 * 5, // 5 minutes
			path: "/",
			sameSite: "Lax",
		});

		return { launchUrl, header };
	}

	private async handleCallback(request: Request, resultsAccessKey: string) {
		const cookie = new Cookie(request.headers.get("Cookie") || "");
		const params = new URLSearchParams(cookie.get(this.cookieName) || "");

		const sessionId = params.get("sessionId");

		debug("Session ID found in cookie", sessionId);

		if (!sessionId) {
			throw new ReferenceError("Missing sessionId in cookie");
		}

		debug("Getting session result with sessionId", sessionId);
		debug("Using resultsAccessKey");

		const results = await this.api.getSessionResult(sessionId, {
			resultsAccessKey,
		});

		debug("Session result received");

		const t = this.verify({ request, results });

		debug("Verification complete");

		return t;
	}
}

export namespace TrinsicStrategy {
	export interface VerifyOptions {
		/** The request that triggered the authentication flow */
		request: Request;
		/** The session result returned by Trinsic */
		results: GetSessionResultResponse;
	}

	export interface ConstructorOptions {
		/** The access token to use for the Trinsic API */
		accessToken: string;
		/** The URL to redirect the user to after the widget session is complete. */
		redirectUrl: string;
		/** The list of allowed identity providers. If not specified, all available providers will be allowed. */
		providers?: string[];
		/** Known identity data of an individual being verified. */
		knownIdentityData?: KnownIdentityData;
	}
}

class TrinsicApiError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TrinsicApiError";
	}
}
