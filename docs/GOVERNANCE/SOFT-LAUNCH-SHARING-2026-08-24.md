# SOFT LAUNCH -- WHAT GUESTS GET AND WHAT TO SEND
24 August 2026 . CUI 41A . Builds on SOFT-LAUNCH-ALLOCATION-2026-08-20 (policy, locked)

## THE TIERS, AS RULED 20 AUGUST
```
Friends   50 credits   five proofs
Family    80 credits   eight proofs
```
One code per tier. Codes are Rich's, live only in LITEN_ACCESS_CODES
(`code:50,code:80` in Vercel env), never in the repo or this doc.

## WHAT A GUEST RECEIVES FROM RICH
Three lines. No account creation, no password -- the code IS the login.
```
1  The address:  https://litenco.com
2  Their code:   <friends code>  or  <family code>
3  One sentence of Rich's, in the Curator's register, telling them
   what the studio does. (Copy is Rich's to write.)
```
The gate card asks for the code once; a cookie remembers it. Credits
appear in the masthead pill after entry. The card must NOT name a
number -- it cannot know the tier (copy change still pending, Rich's).

## WHAT MUST LAND BEFORE THE FIRST CODE GOES OUT
In dependency order. Items 1-3 are CENG lane (app/api, middleware).
```
1  /api/v1/invite resolves tier FROM THE CODE, server-side.
   Route has still never been read by any lane. READ IT FIRST.
2  middleware valid() checks set membership, not equality --
   or tier-two guests bounce on their second visit.
3  Grant idempotency key = person, never code/session/timestamp.
   Higher tier tops up the difference; lower or equal does nothing.
4  Gate card copy loses the "80 credits" promise (Rich writes).
5  Paywall doors patch (browse-doors closed while SOFT_LAUNCH)
   confirmed present in ALL FIVE launch rooms, not just portraits --
   groups.html was cloned before the patch existed.
6  Reopen switch stays one edit: SOFT_LAUNCH=false in each room.
```

## THE SEND ITSELF
Text or email, from Rich personally, one guest at a time -- the soft
launch is a guest list, not a broadcast. Suggested skeleton (words are
Rich's to replace):
```
I built a portrait studio. Bring it one photograph you like.
litenco.com -- your code at the door is <code>.
It has <five/eight> pieces in it for you. Spend them on anyone.
```
Nothing about credits, tiers, AI, or instructions. If the site needs
a manual, the site is wrong.

*CUI 41A . 24 August 2026*
