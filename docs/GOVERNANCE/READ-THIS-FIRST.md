# READ THIS FIRST · THE STANDING RULE · 20 August 2026

`docs/GOVERNANCE/READ-THIS-FIRST.md`

**Every lane, every session, every successor. Before you write anything, read
this folder.**

CUI, CENG, CHK, CMARK, QA, and whatever comes after them. New session, new
model, new lane - it does not matter. This folder is the record of what has
been decided, and a decision you have not read is a decision you are about
to make again, differently.

---

## WHY THIS EXISTS

On 20 August 2026 the same fault happened three times in one day.

**The Groups plate contract.** A handoff asserted that every plate was
`groups_<id>.jpg`, lowercase, and that the path therefore derived with no
lookup table. The directory disagreed on twenty-three of twenty-eight -
`_01` suffixes, `.jpg` and `.jpeg` mixed, seven names that were not the id,
and one capital U that works on Windows and 404s on Vercel. Caught by
reading the directory. Would have shipped a page of blank cards.

**The Community rebuild.** CUI wrote a framing document specifying handles,
comments, hearts and moderation - without reading `app/api/v1/community`,
where seven finished routes and a spec already existed. CENG built a
parallel set from that document. All of it had to be archived back out. The
document itself carried a warning against exactly this, at the top, in bold.

**The stale "still owed".** CUI carried a demand for the `collection_pieces`
columns and the `studio/kept` route into a handoff. Both had been delivered
and committed the day before.

One shape, three times: **asserting the state of the work instead of reading
it.**

---

## THE RULE

**1 · Read this folder at the start of every session.** Not a skim of the
newest file - the folder. Decisions do not expire because a new session
started, and the document that settles your question is usually not the most
recent one.

**2 · Read the code before you describe the code.** If you are about to
write "the route does X" or "every file is named Y", open it. A statement
about the state of the work is a claim, and a claim you have not checked is
a guess wearing a suit.

**3 · The files outrank the documents.** Every document here was true when
written and some are not true now. Where a document and the code disagree,
the code wins and the document gets corrected. Say so in the correction.

**4 · Check whether it already exists before you build it.** The Community
routes were finished, committed, and invisible to the lane that specified
them again. One directory listing would have prevented a day's work.

**5 · Never write a command that depends on a fact you have not confirmed in
this conversation.** Where a file is, whether it arrived, what is already on
disk. One extra round trip costs a minute; getting it wrong has cost hours,
repeatedly, in the last stretch before a launch.

**6 · Superseded documents get marked superseded, not left lying next to the
thing that replaced them.** Two documents that disagree are worse than one
that is wrong, because the reader cannot tell which is live.

**7 · When Rich says something is wrong, it is wrong.** Check before
explaining why you think otherwise. Both times it has come up, the
explanation was defending a model instead of checking a fact.

---

## WHAT GOES IN THIS FOLDER

Rulings, contracts between lanes, specs, and carryovers. Anything a future
session would be wrong without.

Name files so the subject and the date are both in the filename. Date every
document at the bottom. When a ruling supersedes another, say which one, by
filename, in the first paragraph.

---

## THE PATTERN UNDERNEATH ALL OF IT

Constraints do not stop being true; they stop being **consulted**. Early in
a session every command gets scrutiny. Later ones get pattern-matched
against the earlier ones, and volume makes it worse - the more you write, the
less each one is checked.

**So the longer a session runs, the more explicitly the rules need re-reading,
not less. Fluency late in a session is not competence. It is the thing to be
suspicious of.**

---

## PUT THIS IN EVERY CARRYOVER

Rich's instruction, 20 August 2026. Every carryover document written from now
on carries a line pointing the next session here, near the top, before the
work. A rule nobody is told about is a rule that lasts one session.

---

*Liten & Co · 20 August 2026*
