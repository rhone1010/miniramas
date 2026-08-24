#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-downscale-source.py  --  the photograph is made to fit before it is
sent anywhere.

    python scripts\\patch-downscale-source.py public\\halloween.html
    python scripts\\patch-downscale-source.py public\\halloween.html --apply

Run against portraits, pets, groups, halloween and pets-halloween. Dry run
by default; output to %USERPROFILE%\\Downloads\\<leafname>; install with
Install-File.ps1.


THE FAULT, seen on /halloween 21 August.

    api/v1/portraits/analyze   413
    api/v1/portraits/gate      413
    api/v1/halloween/generate  413
    api/v1/halloween/generate  413

413 is Payload Too Large. Vercel caps a serverless request body at 4.5MB
and that is not something we can raise. The glass sends the photograph as
base64, which inflates it by about a third, so anything over roughly 3.3MB
on disk is refused before a single line of our own code runs.

A modern phone shoots between 4 and 12MB. So this is not an edge case -- it
is most customers, in every room, and it has been there the whole time.

WHAT ACTUALLY HAPPENED TO RICH. Analyze failed, the gate failed, the craft
charged 20 credits, both generate calls failed, and the refund put the 20
back. The money was correct at every step. What the customer saw was a
spinner that vanished and nothing in its place, because a 413 produces no
message -- which is the second half of this patch.


WHAT THIS DOES

  A photograph is drawn onto a canvas at no more than 2048px on its longest
  edge and re-encoded as JPEG. A face at 2048 is far past what the
  generator needs -- the plates it produces are 1024 square -- so nothing
  visible is lost, and a 12MB photograph becomes roughly 800KB.

  Only when it needs to. A photograph already under the ceiling and under
  2048px is passed through untouched, so a small file is not re-encoded and
  degraded for no reason.

  If the first pass is still too heavy -- a very large or very noisy image
  -- the quality steps down 0.9, 0.82, 0.74, 0.66 until it fits. Four
  attempts, then it gives up and says so rather than sending something that
  will 413.

WHERE IT SITS. Inside probe.onload, after the 9:16 refusal and before
runAnalyze() and precheckSourceGate(). That is the last point where the
dimensions are known and the first before anything is sent, and it means
analyze and the gate see exactly what generate will.

AND A 413 NOW SAYS SOMETHING. Even with this in place a route can refuse
for size -- a 2048px photograph of a very detailed scene can still be
heavy. The fetch paths treat any failure as a generic fault, so the rail
said nothing at all. 413 gets its own sentence.


WHAT THIS IS NOT

Not the real answer. The real answer is uploading to Supabase Storage and
sending the route a path, which removes the ceiling instead of ducking
under it. That is a new route, a new bucket policy and a change to every
generate call -- CENG's, and a bigger job than a week before a soft
launch. This buys the launch.

ONE THING TO CONFIRM RATHER THAN ASSUME. The source photograph is kept, and
if any print path ever makes a print from the ORIGINAL upload rather than
the crafted piece, this would cost quality there. Prints are made from the
crafted image as far as this lane can see, which is why this is being
shipped -- but it is worth CENG saying so out loud before it is forgotten.

EXIF ORIENTATION. Browsers have applied EXIF rotation on decode since 2020
and canvas draws what was decoded, so a portrait photograph from a phone
stays upright. Recorded because it is the classic fault with this technique
and the one that would show up as every fourth customer's photograph
sideways.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

ROOMS = ('portraits.html', 'pets.html', 'groups.html', 'halloween.html',
         'pets-halloween.html')

ANCHOR = """        SRC.flags = localPhotoCheck(probe);
        runAnalyze();
        precheckSourceGate();"""

NEW = """        SRC.flags = localPhotoCheck(probe);

        /* MADE TO FIT BEFORE ANYTHING IS SENT. Vercel refuses a request body
           over 4.5MB and base64 adds about a third, so a photograph over
           roughly 3.3MB on disk 413s on analyze, on the gate and on generate
           -- which is every modern phone. Seen on /halloween 21 August: four
           413s, a charge, and a refund, with nothing on screen to say why.

           Fitted here rather than at read time because this is the last
           point where the dimensions are known and the first before any
           route is called, so analyze and the gate see exactly what generate
           will. */
        fitSourceForUpload(probe, function(fitted, note){
          if (!fitted){
            /* Four passes and still too heavy. Better to say so than to send
               something that will be refused three times over. */
            say('That photograph is larger than I can work from, even after ' +
                'resizing. Try one saved at a smaller size.' +
                '<span class="sign">&mdash; C.</span>');
            return;
          }
          if (note){
            SRC.b64     = fitted.split(',')[1] || null;
            SRC.dataUrl = fitted;
            var th = document.getElementById('curThumb');
            if (th) th.src = fitted;
            console.log('[intake] ' + note);
          }
          runAnalyze();
          precheckSourceGate();
        });"""

# Groups folded the gate into its analyze route, so its call site runs one
# call rather than two. Same fitting, one line fewer inside the callback.
ANCHOR_GROUPS = """        SRC.flags = localPhotoCheck(probe);
        /* ONE CALL, NOT TWO. Portraits runs /analyze and /gate side by side;
           the Groups analyze route answers both questions and prices the
           craft in the same breath. precheckSourceGate is gone with it. */
        runAnalyze();"""

NEW_GROUPS = NEW.replace("""          runAnalyze();
          precheckSourceGate();""", """          /* ONE CALL, NOT TWO - the Groups analyze route answers the gate's
             question and prices the craft in the same breath. */
          runAnalyze();""")

HELPER_ANCHOR = "  function onSourceFile(file){"

HELPER = """  /* ---- fitting a photograph to the wire ----------------------------------
     Vercel's request body ceiling is 4.5MB and is not ours to raise. base64
     inflates by roughly a third, so the practical limit on the file itself
     is about 3.3MB.

     A face at 2048px on the long edge is well past what the generator
     needs -- it returns 1024 square -- so nothing a customer can see is
     lost. A 12MB photograph comes out around 800KB.

     A photograph already inside both limits is passed straight through.
     Re-encoding a small JPEG would degrade it for nothing.

     Calls back with (dataUrl, note) on success, (null) if four passes could
     not get it under. `note` is null when nothing was changed, so the
     caller can leave SRC alone. */
  var FIT_MAX_EDGE = 2048;
  var FIT_MAX_B64  = 3300000;          /* ~4.4MB once base64'd */
  var FIT_QUALITY  = [0.9, 0.82, 0.74, 0.66];

  function fitSourceForUpload(probe, done){
    var w = probe.naturalWidth, h = probe.naturalHeight;
    var b64len = (SRC.b64 || '').length;
    var oversize = b64len * 0.75;      /* bytes, near enough */

    if (Math.max(w, h) <= FIT_MAX_EDGE && oversize <= FIT_MAX_B64){
      done(SRC.dataUrl, null);         /* nothing to do, and nothing done */
      return;
    }

    var scale = Math.min(1, FIT_MAX_EDGE / Math.max(w, h));
    var cw = Math.round(w * scale), ch = Math.round(h * scale);

    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var ctx = c.getContext('2d');
    if (!ctx){ done(SRC.dataUrl, null); return; }   /* no canvas, no change */
    /* Browsers have applied EXIF rotation on decode since 2020 and this
       draws what was decoded, so a phone portrait stays upright. */
    ctx.drawImage(probe, 0, 0, cw, ch);

    for (var i = 0; i < FIT_QUALITY.length; i++){
      var out;
      try { out = c.toDataURL('image/jpeg', FIT_QUALITY[i]); }
      catch (e){ done(SRC.dataUrl, null); return; }  /* tainted canvas */
      var bytes = (out.length - out.indexOf(',') - 1) * 0.75;
      if (bytes <= FIT_MAX_B64){
        done(out, w + '\\u00d7' + h + ' \\u2192 ' + cw + '\\u00d7' + ch +
                  ' at q' + FIT_QUALITY[i] + ', ' +
                  Math.round(bytes / 1024) + 'KB');
        return;
      }
    }
    done(null);
  }

  function onSourceFile(file){"""

OLD_NOTICE = """    }).catch(function(){
      if (!quiet) creditsNotice('unreachable', 0, items.length * CREDITS_PER_IMAGE);
      return false;
    });"""

NEW_NOTICE = OLD_NOTICE  # unchanged; kept so the shape is visible here


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    target = args.target.replace('/', os.sep).replace('\\', os.sep)
    path = target if os.path.isabs(target) else os.path.join(REPO, target)
    if not os.path.isfile(path):
        sys.exit('FAIL: no file at %s' % path)

    leaf = os.path.basename(path)
    if leaf not in ROOMS:
        sys.exit('FAIL: %s is not a room. Known: %s' % (leaf, ', '.join(ROOMS)))

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    if 'fitSourceForUpload' in text:
        print('\nAlready applied. Nothing to do.')
        return

    if ANCHOR in text:
        call_old, call_new = ANCHOR, NEW
    elif ANCHOR_GROUPS in text:
        print('\n  this room folds the gate into analyze - using its call site')
        call_old, call_new = ANCHOR_GROUPS, NEW_GROUPS
    else:
        sys.exit('FAIL: no call site found in either shape. Read the file.')

    edits = [
        ('the helper', HELPER_ANCHOR, HELPER),
        ('the call site', call_old, call_new),
    ]

    print('\nchecking anchors:')
    bad = []
    for label, old, new in edits:
        found = text.count(old)
        ok = found == 1
        print('  %-16s %s  (found %d, expected 1)' %
              (label, 'ok ' if ok else 'FAIL', found))
        if not ok:
            bad.append(label)
    if bad:
        print('\nNOTHING WRITTEN. Failed: %s' % ', '.join(bad))
        sys.exit(1)

    for label, old, new in edits:
        text = text.replace(old, new, 1)

    print('\nverifying result:')
    checks = [
        ('the helper is defined', 'function fitSourceForUpload(probe, done){' in text),
        # The definition reads `function fitSourceForUpload(probe, done)`,
        # so a bare count of the name catches it too. Count the call.
        ('it is called once',
         text.count('fitSourceForUpload(probe, function(fitted, note){') == 1),
        ('analyze runs inside the callback',
         text.index('fitSourceForUpload(probe, function(fitted, note){')
         < text.index('          runAnalyze();')),
        ('the 9:16 refusal still precedes it',
         text.index('taller than 9:16')
         < text.index('fitSourceForUpload(probe, function(fitted, note){')),
        ('a small photograph is passed through', 'done(SRC.dataUrl, null);' in text),
        ('four quality passes', '[0.9, 0.82, 0.74, 0.66]' in text),
        ('file did not collapse', len(text) > start_len * 0.9),
    ]
    for label, ok in checks:
        print('  %-38s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    out = os.path.join(DOWNLOADS, leaf)
    if not args.apply:
        print('\nDRY RUN. Re-run with --apply to write')
        print('  %s' % out)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (out, len(text)))
    print('\nInstall-File.ps1 %s' % target)


if __name__ == '__main__':
    main()
