import {describe, expect, it} from "vitest";
import {createTokenPair, hashToken, verifyAccessToken, verifyRefreshToken} from "../src/lib/jwt.js";

describe("JWT token pair", () => {
  it("creates distinct verifiable access and refresh tokens", async () => {
    const userId = "6f34cd83-a089-4ba9-9970-061dc8464968";
    const pair = await createTokenPair(userId);
    expect(pair.accessToken).not.toBe(pair.refreshToken);
    expect(hashToken(pair.refreshToken)).toHaveLength(64);
    expect((await verifyAccessToken(pair.accessToken)).userId).toBe(userId);
    expect((await verifyRefreshToken(pair.refreshToken)).userId).toBe(userId);
  });
});
