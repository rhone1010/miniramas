# Information pages — operational handoff (2026-10-25)

Review copy implements Rich's approved policies; it does not implement their enforcement. No payment, refund, approval, entitlement, manufacturing, authentication or storage handler was changed.

## CC dependencies before final policy publication

1. **60-day retention:** CC commit `16b44416` added the retention sweep and migration 060 while these pages were being built. Migration is not applied; deletion defaults to dry-run. Activation and verification remain pending. Reconcile the retained shorter Gift expiry (7/30 days), retention of unpurchased generated artwork, the exact approval clock, browser-local copies and provider caching with the approved policy. Preserve dispute holds and separate manufacturing/financial records. See `SOURCE-PHOTO-RETENTION-2026-10-25.md`.
2. **Refund enforcement:** CC commit `16b44416` makes later refund claims enter review; migration 061 is not applied. Verify activation. Owner authorization above $50, delivery/tracking evidence integration, issue-origin recording and a separate physical-defect process remain open per `GOODWILL-REFUND-POLICY-IMPLEMENTATION-2026-10-25.md`. Preserve existing Gift pre-submission cancellation handling and original-method Stripe refunds.
3. **Gift checkout disclosure:** `lib/v1/gift/orders.ts` still has the shared older twelve-preview disclosure and accepted version. Provide flow-specific disclosure/version handling for new six-generation product-first sessions and legacy sessions. No accepted-disclosure contract was changed here.
4. **Processor practices:** verify the actual Replicate/Google/OpenAI and other processor agreements, no-training settings, retention and processing locations. The studio's approved no-advertising/no-training policy must not be represented as a verified provider guarantee.
5. **International duties/taxes:** verify destination-specific quote/invoice treatment before promising any duties-paid delivery. Checkout remains the source of shipping charges and available estimates.
6. **Legal/accessibility:** obtain legal review, final administrative contact information and an accessibility assessment before removing review notices. No WCAG-conformance claim is made.

## Content and preservation

Sources: `docs/GOVERNANCE/PRIVACY-DRAFT-2026-08-08.md`, `docs/GOVERNANCE/TERMS-DRAFT-2026-08-08.md`, Rich's 25 October implementation assignment. The optional `HELP-AND-SUPPORT-CONTENT-2026-10-25.md` was not found.

Seven pages share `public/information.next.html`, `public/information.next.css`, `public/information.next.js`, and `public/information-content.next.js`. Existing About destination is populated too. Existing More/footer components receive links. Cookie modal/storage/consent logic is unchanged. Help Phase 1 changes only two guidance strings; Concierge changes only knowledge text, not POST handler. Legacy FAQ answers are reconciled, and its existing policy tabs link to the canonical review pages instead of duplicate conflicting policy text.

This is newly authorized content/layout implementation, not a verbatim design-source port. No source markup port is claimed.

Delivery note: local review used because concurrent backend migrations are unapplied. No Production deployment or retention activation performed. The authoritative branch advanced concurrently; its existing committed backend work was pushed during integration, but no deployment was initiated by this task.
