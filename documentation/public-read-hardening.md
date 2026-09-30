# Public read hardening

The per-instance anonymous-read cache now retains a single in-flight promise until it settles. Its result TTL begins at successful completion, rather than request start. Rejected loads are evicted. The 200-entry bound remains; capacity pressure evicts completed entries before active work, and bypasses admission if all slots are active. Keys over 2,048 characters and invalid TTLs bypass retention. This cache is not suitable for authenticated data, and provides no cross-instance coordination or upstream timeout.

The feed server function now validates runtime request types, bounded search/identifier lengths, allowed sort values, integer page sizes (1–48), and unknown fields before cache or database access. Malformed requests fail instead of driving expensive reads or retaining oversized keys. This is input validation, not authentication or a complete rate limiter.

Run focused regression tests with Node 24: `node tests/public-read.test.mjs`. Six tests cover single-flight through TTL, result expiry, failure retries, capacity pressure, oversized keys and invalid request inputs. The production Vite build was also checked.

A deterministic simulation with an unresolved loader, a 10 ms result TTL, and 20 request waves spaced 11 ms apart (100 requests/wave) produced 20 upstream loads with the prior algorithm and 1 with this implementation. This is 95% less duplicate work in that controlled scenario, not a measured whole-site latency improvement. Feed ordering, thumbnail choice, UI, database grants and publication behavior are unchanged. A hung loader still needs upstream timeout handling; cache admission remains bounded.
