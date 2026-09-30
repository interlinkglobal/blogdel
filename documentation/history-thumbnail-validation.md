# History thumbnail collection

Validated 2026-09-30 against `thumbnails/history-images.txt`.

- 100 distinct Google Drive IDs, retained in the exact committed list order.
- Existing public-image validation results match all 100 IDs exactly: every unauthenticated request returned HTTP 200 with decodable PNG bytes at 1672 × 941 pixels.
- Card thumbnails request a 3840-pixel-wide rendition; the sources are not verified native 4K images. The History 4K image supply requirement remains unmet.
- The first 100 History selections are unique; rank 100 starts the next rotation.
- History uses the shared thumbnail policy: Cloudinary, Drive, public web, verified Supabase copies, local category assets, then the component fallback. No unverified Storage copies are registered.
- Production build, 11 public-read/security tests, exact list mapping, first-100 uniqueness, rotation boundary, and 3840 rendition checks passed.
