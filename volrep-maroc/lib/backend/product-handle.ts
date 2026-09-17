// The one authoritative product-handle shape, matching the backend's
// enforcement exactly: `volrep-backend/src/routes/admin/products.ts` and
// `.../services/admin/products.ts` both validate a product handle as
//   z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
// on create and on rename, so every handle that can exist in the database
// — and therefore every handle the backend ever sends to this storefront —
// is lowercase ASCII letters/digits in single-hyphen-separated segments,
// 1–200 chars. No slashes, dots, whitespace, control chars, URL parts or
// path-traversal sequences are representable.
//
// Used to gate POST /api/revalidate (security hardening — Step 4 L5): the
// externally supplied `handle` must match this before it is interpolated
// into a revalidatePath()/revalidateTag() call.
const PRODUCT_HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRODUCT_HANDLE_MAX = 200;

export function isValidProductHandle(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= PRODUCT_HANDLE_MAX &&
    PRODUCT_HANDLE_RE.test(value)
  );
}
