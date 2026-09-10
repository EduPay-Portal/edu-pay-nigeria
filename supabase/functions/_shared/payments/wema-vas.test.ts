// Unit tests for the Wema VAS helpers (no network, no credentials required).
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  accountPrefix,
  checkVasBearer,
  DEFAULT_TEST_PREFIX,
  formatAccountName,
  identityFor,
  isOurAccountNumber,
  readJson,
  VAS_DESC,
  VAS_STATUS,
} from "./wema-vas.ts";

const withEnv = async (vars: Record<string, string | null>, fn: () => void | Promise<void>) => {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = Deno.env.get(k);
    if (v === null) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
};

const req = (token?: string) =>
  new Request("https://example.test/", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: "{}",
  });

Deno.test("test prefix is 711", () => {
  assertEquals(DEFAULT_TEST_PREFIX, "711");
});

Deno.test("account prefix falls back to 711 when unset", async () => {
  await withEnv({ WEMA_ACCOUNT_PREFIX: null }, () => {
    assertEquals(accountPrefix(), "711");
  });
});

Deno.test("account prefix must be 3 digits", async () => {
  await withEnv({ WEMA_ACCOUNT_PREFIX: "71" }, () => {
    let threw = false;
    try {
      accountPrefix();
    } catch {
      threw = true;
    }
    assert(threw, "expected a 2-digit prefix to be rejected");
  });
});

Deno.test("only 10-digit numbers carrying the configured prefix are ours", async () => {
  await withEnv({ WEMA_ACCOUNT_PREFIX: "711" }, () => {
    assert(isOurAccountNumber("7110234567"));
    assertFalse(isOurAccountNumber("9990234567")); // other vendor's prefix
    assertFalse(isOurAccountNumber("711023456")); // 9 digits
    assertFalse(isOurAccountNumber("71102345678")); // 11 digits
    assertFalse(isOurAccountNumber("711abc4567"));
  });
});

Deno.test("account name puts the vendor first", async () => {
  await withEnv({ WEMA_VENDOR_NAME: "ASCI" }, () => {
    assertEquals(formatAccountName("John Doe"), "ASCI/John Doe");
  });
});

Deno.test("bearer token is enforced", async () => {
  await withEnv({ WEMA_VAS_BEARER_TOKEN: "s3cr3t-token-value" }, () => {
    assert(checkVasBearer(req("s3cr3t-token-value")).ok);
    assertFalse(checkVasBearer(req("wrong-token-value")).ok);
    assertFalse(checkVasBearer(req()).ok);
  });
});

Deno.test("requests are rejected when no token is configured", async () => {
  await withEnv({ WEMA_VAS_BEARER_TOKEN: null }, () => {
    const check = checkVasBearer(req("anything"));
    assertFalse(check.ok);
    assertEquals(check.reason, "vas_token_not_configured");
  });
});

Deno.test("identity falls back to the configured responsible party", async () => {
  await withEnv({ WEMA_FALLBACK_BVN: "22222222222", WEMA_FALLBACK_NIN: null }, () => {
    assertEquals(identityFor(null, null).bvn, "22222222222");
    assertEquals(identityFor("11111111111", null).bvn, "11111111111");
  });
});

Deno.test("malformed JSON bodies are rejected", async () => {
  const bad = new Request("https://example.test/", { method: "POST", body: "not json" });
  assertEquals(await readJson(bad), null);
});

Deno.test("documented status codes", () => {
  assertEquals(VAS_STATUS.SUCCESS, "00");
  assertEquals(VAS_STATUS.INVALID, "07");
  assertEquals(VAS_DESC.INVALID_ACCOUNT, "Invalid account");
  assertEquals(VAS_DESC.INACTIVE_ACCOUNT, "Inactive account");
});
