# QA BEFORE LAUNCH -- THE PASS EVERY ROOM MUST SURVIVE
24 August 2026 . CUI 41A . For Rich and the new QE. One line per check;
tick or fail with a screenshot. Phone = real S23, not responsive mode.

## 0 . THE MONEY PATH (do this first, it kills launches)
- [ ] Buy credits with a real card, smallest pack. Balance rises.
- [ ] Craft to a SHORTFALL: buy panel opens with the true figure,
      pieces are HELD and complete after purchase.
- [ ] While SOFT_LAUNCH: pill and Account buy-doors closed until
      balance is zero; shortfall door always opens. All five rooms.
- [ ] FIRST: flip the test account's fulfilment flag ON in the admin
      panel (Controls). Prints reach Prodigi only for flagged
      accounts - unflagged, the order silently never sends and
      reads as a bug. (Panel review, 25 Aug.)
- [ ] Print order end-to-end: quote -> checkout -> Stripe webhook ->
      Prodigi order visible in their dashboard. One real cheap print.
- [ ] Refund path known: who presses what when a guest writes in.

## 1 . THE GATE
- [ ] Friends code enters; pill shows 50. Family shows 80.
- [ ] Return next day, same browser: no card, balance kept.
- [ ] Same person, other code: higher tops up, lower does nothing.
- [ ] Wrong code: refused kindly, no console errors.

## 2 . EVERY LAUNCH ROOM x BOTH PLATFORMS
(portraits, pets, groups, halloween, pets-halloween + chooser)
- [ ] Upload a photograph -> effects floor -> craft -> piece arrives.
- [ ] Take a photo (phone): camera opens, right lens per room
      (portraits/halloween front, rest rear), piece arrives.
- [ ] 12MP fresh camera shot crafts without the low-memory toast.
- [ ] Oversized/odd files: 15MB JPEG, HEIC, PNG screenshot, 9:16+
      refused shapes -- each gets a kind answer, never a spinner.
- [ ] Post to Community from the lightbox; appears on the board.
- [ ] My Collection holds the piece; Print Shop reaches it.
- [ ] Phone floors: one column, no sideways scroll, tray seats
      above the bar, drawer closes on next tap.

## 3 . THE HOMEPAGE
- [ ] Desktop: full 60s cycle -- five Series in step, headline and
      button change WITH the plates, no black or blurred frames,
      console quiet (the tall-small 404s resolved, not just fallen
      back from).
- [ ] Mobile: swipe both ways, dots above headline, auto-advance
      without the flick, button lands on the right effects floor.

## 4 . THE EDGES
- [ ] Safari/iPhone pass of section 2 -- the whole list so far is
      Android+Chrome shaped.
- [ ] Slow connection (devtools 3G): reel degrades politely, craft
      status honest.
- [ ] Every nav link on every page goes where it says. Help reads
      on a phone with margins.
- [ ] Wallpapers + gallery: CUI 42 / 41B own the pass; confirm they
      have run one, not that it looked fine in passing.
- [ ] Two browsers, one account, craft simultaneously: credits
      debit once each, no double-spend.

## 5 . THE DAY-OF SWITCHES
- [ ] LITEN_ACCESS_CODES set in Vercel prod; singular fallback still
      valid; codes match what Rich is sending.
- [ ] Feedback path exists for guests (even just a mailto) --
      the golden bug is parked, guests still need a door.
- [ ] Admin panel: Health tab OPEN through the evening (incidents
      badge); fulfilment flags default OFF for guests; per-Series QA
      sliders confirmed at launch values. /admin, one screen.
- [ ] H: mounted, FileActions log rolling, Save-Work green.

Anything unticked is a launch decision, not a surprise.
*CUI 41A . 24 August 2026*
