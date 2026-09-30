# External image acquisition security

Article reference pages and Wikimedia metadata are fetched only after resolving the destination and rejecting loopback, private, carrier-grade NAT, link-local, reserved, multicast and IPv4-mapped private addresses. URL credentials and nonstandard ports are rejected. Redirects are handled manually, limited to three, and every destination is revalidated before a subsequent request.

Reference HTML is limited to 700 KB and Wikimedia JSON to 750 KB, using both declared content length and streamed byte counting. Unexpected status or content type fails closed. Acquisition remains best-effort: a rejected source falls through to the next reference and then Wikimedia, preserving publication behavior and existing thumbnail priority.

These controls materially reduce SSRF and memory-exhaustion exposure. DNS validation occurs before the platform `fetch`; environments needing protection from hostile DNS rebinding should additionally enforce egress restrictions at the network layer or use a fetch agent that pins the validated address while preserving TLS hostname verification.

Run `node --test tests/safe-public-fetch.test.mjs` and the production build before release. The tests cover private-address families, mixed DNS answers, URL authority restrictions, redirect validation, streamed response limits and bounded expected content.
