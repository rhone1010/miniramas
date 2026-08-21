# SOFT LAUNCH · ACCESS CODES AND ALLOCATION · 20 August 2026

`docs/GOVERNANCE/`

Rich's ruling, 20 August. Policy is locked here. Implementation follows once
`app/api/v1/invite/route.ts` has been read - it has not been, and designing
a grant against a route nobody has opened is the fault that cost this
project a morning already.

---

## THE TWO TIERS

```
Friends     50 credits    five proofs
Family      80 credits    eight proofs
```

Ten credits craft one piece, so the tiers are five and eight - the same two
numbers carried in the V29 carryover. The words the guest sees are Rich's.

One code per tier. More tiers later is a row in a table, not a redesign.

---

## THE RULE THAT MATTERS MOST

**The credit amount is resolved on the server, from the code. It is never
read from the request.**

`/api/v1/invite` is a public route. If it accepts a number, anybody can post
their own. It accepts the CODE, looks the tier up from the same environment
variable the gate validates against, and grants that. The browser never
names an amount, exactly as the Studio never sends a prompt.

---

## HOW A CODE BECOMES CREDITS

```
gate card  ->  middleware validates the code  ->  /api/v1/invite
                                                    resolves tier from code
                                                    grants, idempotently
```

Middleware runs on the edge with no database and no service key, and that
stays true. It validates and passes the code along; the grant happens where
the service key lives.

### Configuration

```
LITEN_ACCESS_CODES = <code>:50,<code>:80
```

Comma separated, `code:credits`. Codes themselves are Rich's to choose and
do not appear in this document or in the repo.

`LITEN_ACCESS_CODE` (singular) keeps working as a one-tier fallback. It is
what is deployed right now and a launch is a poor time to remove the thing
that is currently letting people in.

### What has to change in middleware

`valid()` compares the cookie's stored code against **the** code. With a set
it must check membership instead, or the second tier is refused at the door.
This is the one line that breaks silently if it is missed: guests with the
new code get in on first use, then meet the passcode card again on every
later visit, because the cookie no longer matches.

---

## GRANTING, AND WHAT COUNTS AS ONCE

**One grant per person, ever - not one per code.**

Somebody who has been given eighty does not get another fifty by presenting
the other code. If a guest presents a HIGHER tier than they have already
been granted, the difference is topped up. Lower or equal, nothing happens.

Idempotency keys on the person, not the visit. `grant_credits` is already
idempotent by `ref_id`; the ref must therefore be stable per person, and
must not include a timestamp, a session, or the code - or the same guest
collects twice.

A guest who enters, closes the browser and returns tomorrow has already been
granted. Nothing more happens, and nothing tells them off about it.

---

## THE GATE CARD SAYS NO NUMBER

The card is shown BEFORE the code is typed, so it cannot know the tier. It
currently promises "80 complimentary credits" to everybody, including the
guests who are about to get fifty.

The copy loses the number. What replaces it is Rich's, and it is the only
copy change this ruling requires.

The actual figure belongs where the balance already lives - the masthead
pill, once they are inside.

---

## NO SELLING UNTIL THE GRANT IS SPENT

Built and tested, 20 August, `scripts/patch-softlaunch-paywall.py`.

Three doors led to the buy panel and they were already distinguishable:

```
masthead credits pill    reason 'browse',  needed 0
Account > Buy credits    reason 'browse',  needed 0
a craft that is short    the real reason,  needed > 0
```

While `SOFT_LAUNCH` is true the two BROWSE doors open only at a zero
balance. The SHORTFALL door is never gated - running out mid-craft is the
one moment buying is the helpful answer, and the pieces are held while they
decide.

It reads the balance rather than a date or a guest list, so nothing has to
be switched at the moment somebody spends their last credit. An unknown
balance counts as not exhausted, and nobody is stranded by that because a
short craft still raises the panel with the real figure.

The pill still reads out the balance. It is the only place a guest can see
it; it simply stops claiming to be a way to buy.

**To reopen the shop: `SOFT_LAUNCH = false` in `public/portraits.html`. One
edit, nothing else.**

---

## OPEN, AND OWNED

**Not yet implemented: the code-to-tier resolution.** Needs
`app/api/v1/invite/route.ts` read first - whether it grants anything today
is unknown to CUI, and the honest answer is that nobody in this session has
opened it.

**Groups and the other Series carry the same paywall doors.** The gate is
currently in `portraits.html` only. `groups.html` was cloned before this
existed and will need the same patch; check any Series clone from here on.

---

*CUI · 20 August 2026*
