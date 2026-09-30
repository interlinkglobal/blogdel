import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPublicHttpUrl,
  fetchPublicText,
  isPublicAddress,
} from "../src/lib/safe-public-fetch.server.ts";

test("blocks private, loopback, link-local, metadata and reserved IP space", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.2",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])
    assert.equal(isPublicAddress(address), true, address);
});

test("validates every DNS result and URL authority", async () => {
  await assert.rejects(
    assertPublicHttpUrl("https://example.test", async () => ["93.184.216.34", "127.0.0.1"]),
  );
  await assert.rejects(assertPublicHttpUrl("file:///etc/passwd", async () => ["93.184.216.34"]));
  await assert.rejects(
    assertPublicHttpUrl("https://user:pass@example.test", async () => ["93.184.216.34"]),
  );
  await assert.rejects(
    assertPublicHttpUrl("https://example.test:8443", async () => ["93.184.216.34"]),
  );
  assert.equal(
    (await assertPublicHttpUrl("https://example.test/path", async () => ["93.184.216.34"]))
      .pathname,
    "/path",
  );
});

test("rejects oversized bodies even when content-length is absent", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("x".repeat(101), { headers: { "content-type": "text/html" } });
  try {
    await assert.rejects(
      fetchPublicText("https://1.1.1.1", {
        accept: "text/html",
        userAgent: "test",
        maxBytes: 100,
        allowedContentTypes: ["text/html"],
      }),
      /too large/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("revalidates redirect destinations before following them", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
  };
  try {
    await assert.rejects(
      fetchPublicText("https://1.1.1.1", {
        accept: "text/html",
        userAgent: "test",
        allowedContentTypes: ["text/html"],
      }),
      /non-public/,
    );
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("accepts bounded expected content", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('<meta property="og:image" content="https://example.test/a.jpg">', {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  try {
    const result = await fetchPublicText("https://1.1.1.1/start", {
      accept: "text/html",
      userAgent: "test",
      maxBytes: 1000,
      allowedContentTypes: ["text/html"],
    });
    assert.match(result.text, /og:image/);
  } finally {
    globalThis.fetch = original;
  }
});
