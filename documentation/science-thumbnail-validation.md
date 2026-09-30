# Science thumbnail collection

Validated 2026-09-30 against `thumbnails/science-images.txt`.

- 100 distinct Google Drive IDs, retained in the exact committed list order.
- All 100 have public reader permissions and returned HTTP 200 with decodable PNG image bytes without authentication.
- Actual returned dimensions: 1672 × 940 or 1672 × 941. These are generated editorial illustrations, not documentary photographs or verified 4K sources.
- The requested Drive rendition is 3840 pixels wide. Drive does not enlarge these sources to 4K; the Science 4K image supply requirement remains unmet.
- Science uses 100 distinct selections before repeating at rank 100. Existing category ordering remains unchanged.
- Existing Cloudinary, Drive, public web, verified Supabase copy, local asset and component fallback behavior remains in place. No unverified Supabase copies are registered.
- Validation: production build passed; exact list mapping, first-100 uniqueness, rotation boundary, invalid input checks and existing public-read/security checks passed.
