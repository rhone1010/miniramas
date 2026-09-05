# CUI NEEDS LIST - GREETING & ONBOARDING - 25 August 2026

Every customer-facing piece of the open-doors model, itemized. Engine side
is fully live (see SPEC-OPEN-DOORS-2026-08-25.md); each item below names
its trigger, behaviour, and what it waits on from Rich.

---

## 1. WELCOME SCREEN  (new - the old gate's replacement)

**Trigger:** first page load of a visit. It replaces the passcode wall as
first contact - there is no wall any more.
**Behaviour:** a screen, not a form. One click anywhere / on a single
button dismisses it and the person is browsing. No email field, no
passcode field, no sign-in - it greets, it does not collect.
**Open ruling (Rich):** shows ONCE per browser (localStorage flag) or
EVERY visit. Recommend once-per-browser; returning people should land in
the studio, not the foyer.
**Waits on Rich:** the welcome copy.

## 2. SIGN-IN CARD - TRIGGER MOVES TO UPLOAD

**Ruling (Rich, 25 Aug):** "should gate me when I try to upload or
sooner. moment of intent becomes the moment of capture."
**Trigger:** the moment an unsigned person attempts to ADD A PHOTOGRAPH -
not when they press craft. Every analyze route now answers
`{ ok:false, reason:'not_signed_in' }` 401 to unsigned callers; that
answer is the trigger. Catch it (or pre-check) and raise the card BEFORE
the upload UI accepts a file, so nobody picks a photo into a dead end.
**Also triggers on:** buy-credits attempts, unchanged.

## 3. SIGN-IN CARD - THE INVITE CODE FIELD  (shipped, verify behaviours)

PR #88 added the optional code field. Confirm these behaviours against
the live engine:
- code present -> POST /api/v1/invite `{ email, code }` BEFORE the signin
  path; on `{ ok:true }` the magic link is ALREADY SENT by that route -
  do not also fire the signin POST or the person gets two emails
- code absent -> signin path only, no invite POST
- `bad_code` (403) -> show it plainly at the field; person fixes or
  clears; NEVER blocks plain sign-in
- `already:true` -> fine, link was resent; proceed as success

## 4. POST-SEND WAITING STATE

The dead moment after "Send the link". Needs explicit copy on the card:
the link can take a few minutes (Yahoo defers ~5), and CHECK SPAM. This
is glass copy, not engine - the send is confirmed by `link_sent:true`.

## 5. STALE CREDIT COPY - 80 -> 50, EVERYWHERE

The old gate card said "80 complimentary credits - enough to craft eight
images". The grant is 50 / five. Sweep every surface that states the
number: welcome screen (if it mentions the gift), sign-in card, any
onboarding copy. Engine returns `granted: 50` - display from the server
value where possible so this never drifts again.

## 6. LEDGER LABEL FOR THE GRANT

Activity feed has no wording for `reason:'launch_grant'` rows - a +50
appears unlabelled. Add the label ("Welcome credits" pending Rich's
wording). Same gap will exist for `reason:'wallpapers'` rows (a -N with
no story) - label that while in there ("Wallpapers" or Rich's wording).

## 7. "CRAFT THIS AGAIN" ON PURCHASED WALLPAPERS

My Collection shows crafted-piece actions on bought wallpaper tiles.
"Craft this again" is meaningless for a purchased file - hide or replace
(e.g. "Buy more wallpapers") for `series:'wallpapers'` pieces.

## 8. ?access= FAMILY LINKS - NO VISIBLE ACKNOWLEDGEMENT

A family member arriving via
`litenco.com/?access=letsmakesomefun&email=...` gets recorded and mailed
a link - silently. The URL scrubs and the site just... opens. Nothing
tells them a link is on its way. Options: a one-time toast/banner after
the scrubbed redirect ("Your sign-in link is on its way - check your
inbox"), or fold it into the welcome screen when the redirect lands.
Rich's call on wording; the mechanism is glass.

---

## WAITING ON RICH (copy, one pass)

1. Welcome screen text
2. Invite-code field label + helper ("Have an invite code? 50 credits on
   us" was the spec's placeholder)
3. "Welcome credits" ledger label (and the wallpapers one)
4. Post-send waiting copy
5. Once-per-browser vs every-visit ruling for the welcome screen

---

*CENG 41 - 25 August 2026*
