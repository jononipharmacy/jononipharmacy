# Security Specification & Threat Model (Jononi Pharmacy Firestore)

## 1. Data Invariants
1. **Identity & Ownership Invariant**: Every record in `memos`, `products`, `counters`, `profiles`, and `trash` must have an `authorId` strictly matching `request.auth.uid`. A user cannot forge another user's `authorId`.
2. **Verified Auth Invariant**: Standard write operations require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **No Blanket List Reads**: `allow list` queries must enforce `resource.data.authorId == request.auth.uid`. Blanket unrestricted queries are rejected.
4. **Path & ID Sanitization**: All document IDs must satisfy `isValidId(id)` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
5. **Length & Bound Limits**: Every string field has strict length bounds (e.g., `memoNo.size() <= 50`, `customerName.size() <= 150`, `name.size() <= 150`) to eliminate resource exhaustion / Denial-of-Wallet attacks.
6. **Immutable Fields**: `authorId` cannot be altered during document updates (`incoming().authorId == existing().authorId`).

## 2. The "Dirty Dozen" Payloads (Must be Denied by Rules)
1. **Unauthenticated Write**: Creating a memo with `request.auth == null` -> DENIED.
2. **Identity Spoofing**: Signed-in user `user_abc` creates a memo with `authorId: 'user_xyz'` -> DENIED.
3. **Unverified Email**: User whose `email_verified == false` attempts to write -> DENIED.
4. **Oversized String Injection**: Payload with `customerName` exceeding 150 chars -> DENIED.
5. **Junk / Poisoned Document ID**: Writing to document ID with 500 characters or special injection characters (`../../`) -> DENIED.
6. **Blanket List Query Violation**: Querying `/memos` without filtering by `authorId == request.auth.uid` -> DENIED.
7. **Cross-Tenant Read**: User A attempts to `get` User B's memo -> DENIED.
8. **Cross-Tenant Update**: User A attempts to update User B's product -> DENIED.
9. **Cross-Tenant Delete**: User A attempts to delete User B's memo -> DENIED.
10. **Ownership Hijacking via Update**: Updating an existing memo to change `authorId` to another user -> DENIED.
11. **Negative Price Poisoning**: Creating a product with negative `unitPrice: -500` -> DENIED.
12. **Catch-All Default Deny**: Reading or writing to an undefined collection (e.g., `/admin_secrets/{id}`) -> DENIED.
