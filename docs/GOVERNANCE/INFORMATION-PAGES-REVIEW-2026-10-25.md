# Information pages — operational handoff (2026-10-25)

Review copy implements Rich's approved policies; it does not implement their enforcement. No payment, refund, approval, entitlement, manufacturing, authentication or storage handler was changed.

## CC dependencies before final policy publication

1. **60-day retention:** `lib/v1/gift/policy.ts` currently describes seven-day unpaid idle cleanup and protection for paid pinned records, not the approved schedule. Verify/implement qualifying timestamps for purchased crafts and Collection unlocks (Portraits/Pets/Groups), artwork approval (Gift/Print Shop), unpurchased artwork/source expiry, dispute holds and resumption after resolution. Verify actual deletion jobs and separate generated-artwork/manufacturing/financial retention. Do not delete existing records as part of this content task.
2. **Refund enforcement:** `lib/store/remedy-policy.ts` allows a first redo/refund remedy and can automatically refund later likely-failure claims. Reconcile with one eligible first goodwill refund up to $50 after payment/history checks, individual review thereafter, and verified evidence plus owner authorization above $50. Preserve separate physical defects, existing pre-manufacturing Gift cancellation eligibility, and original-method Stripe handling. The Concierge API remains knowledge-only.
3. **Gift checkout disclosure:** `lib/v1/gift/orders.ts` still has the shared older twelve-preview disclosure and accepted version. Provide flow-specific disclosure/version handling for new six-generation product-first sessions and legacy sessions. No accepted-disclosure contract was changed here.
4. **Processor practices:** verify the actual Replicate/Google/OpenAI and other processor agreements, no-training settings, retention and processing locations. The studio's approved no-advertising/no-training policy must not be represented as a verified provider guarantee.
5. **International duties/taxes:** verify destination-specific quote/invoice treatment before promising any duties-paid delivery. Checkout remains the source of shipping charges and available estimates.
6. **Legal/accessibility:** obtain legal review, final administrative contact information and an accessibility assessment before removing review notices. No WCAG-conformance claim is made.

## Content and preservation

Sources: `docs/GOVERNANCE/PRIVACY-DRAFT-2026-08-08.md`, `docs/GOVERNANCE/TERMS-DRAFT-2026-08-08.md`, Rich's 25 October implementation assignment. The optional `HELP-AND-SUPPORT-CONTENT-2026-10-25.md` was not found.

Seven pages share `public/information.next.html`, `public/information.next.css`, `public/information.next.js`, and `public/information-content.next.js`. Existing About destination is populated too. Existing More/footer components receive links. Cookie modal/storage/consent logic is unchanged. Help Phase 1 changes only two guidance strings; Concierge changes only knowledge text, not POST handler. Legacy FAQ answers are reconciled, and its existing policy tabs link to the canonical review pages instead of duplicate conflicting policy text.

This is newly authorized content/layout implementation, not a verbatim design-source port. No source markup port is claimed.
