// lib/analytics/event-names.ts
//
// The closed list. Adding a name here is a deliberate act — this is what
// stops the events table turning into landfill.
//
// Deliberately excluded: craft outcomes (craft_events already has them) and
// render telemetry (qa_log already has it). This layer covers only what
// nothing else records — navigation, drop-off, and attribution.

export const EVENT_NAMES = new Set<string>([
  // arrival & navigation
  'session_start',
  'page_view',
  'series_view',
  'nav_click',

  // source photo & intake
  'upload_start',
  'upload_complete',
  'intake_result',
  'intake_retry',
  'series_redirect_shown',
  'series_redirect_choice',

  // curator & choice
  'suggestions_shown',
  'effect_add',
  'effect_remove',
  'choose_again',
  'advanced_open',
  'bundle_add',

  // payment
  'checkout_open',
  'checkout_abandon',
  'purchase_complete',

  // delivery (intent/engagement only — outcomes live in craft_events)
  'craft_start',
  'piece_download',
  'lightbox_open',
  'make_more',

  // print
  'printshop_open',
  'print_configure',
  'print_cart_add',
  'print_checkout_open',

  // account
  'signup',
  'identify',
  'account_view',
  'collection_view',
])

export type EventName = string
