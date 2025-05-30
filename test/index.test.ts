import { createCookieSessionStorage } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { TrinsicStrategy } from "../src";

describe(TrinsicStrategy.name, () => {
	const verify = vi.fn();

	it("should have the name of the strategy", () => {
		const strategy = new TrinsicStrategy(
			{
				accessToken: "test-token",
				redirectUrl: "https://example.com/callback",
			},
			verify,
		);
		expect(strategy.name).toBe("trinsic");
	});

	it.todo("Write more tests to check everything works as expected");
});
