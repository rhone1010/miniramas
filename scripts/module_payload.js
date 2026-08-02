
  /* ==================================================================
     THE PAYLOAD  ·  build 1b, lane 2 of 3
     ==================================================================
     s72's queue held two fields, {siloId, effectId}, which is everything the
     rail needs to paint a row and nothing /generate can craft from. This
     builds the real item beside it.

     Ported from public/portraits-b2.html, read 2026-07-31:
       addToQueue            7812   the payload body, 93 lines
       MATERIAL_LOCATIONS    4594   verbatim

     THE MERGE. b2 and s72 both declare addToQueue and they are different
     functions — b2's takes no arguments and reads module state, s72's takes
     (siloId, effectId). s72's signature and its call sites win, because the
     floor already calls it that way. b2's body becomes buildPayload(), which
     the same push now carries.

     WHAT IS NOT PORTED, and why the payload is smaller than b2's:
       framing        not on the wire. The route derives 1:1 from the default
       scale          already the constant 'auto_85'; the control was retired
       plaque_text    inscriptions ruled out 2026-07-31
       subject_selector, focal   paused 2026-07-31, 17 functions parked
       advanced       backend ignores unknown keys; an empty object is honest
     aspect_ratio IS sent, and the route ignores it. Kept because removing a
     field the route reads-and-discards is a change to the wire that this
     build has no need to make. */

  /* b2 4594, unchanged. NOT every effect is in here — see checkLocations
     below, which makes the gap loud rather than letting it default. */
  var MATERIAL_LOCATIONS = {
    bronze:        ['mantel', 'pedestal', 'gradient'],
    alabaster:     ['mantel', 'pedestal', 'gradient'],
    iron:          ['mantel', 'pedestal', 'gradient'],
    stone:         ['mantel', 'pedestal', 'gradient'],
    ebony:         ['mantel', 'pedestal', 'gradient'],
    walnut:        ['mantel', 'pedestal', 'gradient'],
    plushy:        ['plushy_shelf'],
    impressionist:  ['mantel', 'pedestal', 'gradient'],
    torn_paper:     ['mantel', 'pedestal', 'gradient'],
    folded_book:    ['mantel', 'pedestal', 'gradient'],
    charcoal_chalk: ['mantel', 'pedestal', 'gradient'],
    pencil_sketch:  ['mantel', 'pedestal', 'gradient'],
    sheet_music:    ['mantel', 'pedestal', 'gradient']
  };
  var DEFAULT_LOCATION = 'pedestal';

  /* Thirteen presets are mapped and the registry offers more than thirteen.
     An unmapped effect silently takes 'pedestal', which may be right and may
     be wrong, and nobody would ever find out. So it is counted at boot and
     put on the console once. Rich and CENG own the answer; this lane only
     refuses to hide the question. */
  function checkLocations(){
    var missing = (R.effects || []).filter(function(e){
      return e.body === 'live' && !MATERIAL_LOCATIONS[e.id];
    }).map(function(e){ return e.id; });
    if (missing.length){
      console.warn('[payload] ' + missing.length + ' live effects have no location mapping ' +
                   'and will default to ' + DEFAULT_LOCATION + ': ' + missing.join(', '));
    }
    return missing;
  }
  window.__UNMAPPED = checkLocations();

  /* style_id is derived, not chosen. b2 had a Series switch above the
     material picker; the room is that switch now. */
  function styleForSilo(siloId){
    return siloId === 'artists_gallery' ? 'artists_gallery' : 'realistic';
  }

  function locationForEffect(effectId){
    var locs = MATERIAL_LOCATIONS[effectId];
    return (locs && locs[0]) || DEFAULT_LOCATION;
  }

  /* One queue item, ready for /generate. Everything it needs comes from the
     two ids and the source photograph — which is why the material, location,
     scale, aspect and series controls did not have to cross from b2.

     POSE IS CARRIED AND THE ROUTE HAS NO FIELD FOR IT. Ruled 2026-07-31:
     Rich is deploying pose prompts. Until the route reads `pose`, this is
     written into the item and sent, and the route ignores it exactly as it
     ignores aspect_ratio. Sending it early is safe; discovering at lane 3
     that nothing carried it would not be. */
  /* Declared above its caller. A var assigned below buildPayload would hoist
     the name and not the value, and ++undefined is NaN — that is the s63
     fault class, three times over. */
  var QUEUE_SEQ = 0;

  function buildPayload(siloId, effectId){
    return {
      id:                    ++QUEUE_SEQ,
      siloId:                siloId,
      effectId:              effectId,
      mode:                  'preset',

      source_image_b64:      SRC.b64,
      additional_images_b64: [],

      style_id:              styleForSilo(siloId),
      preset:                effectId,
      location:              locationForEffect(effectId),
      scale:                 'auto_85',
      aspect_ratio:          '1:1',
      resolution:            '1k',
      pose:                  window.__POSE || 'as_photographed',
      advanced:              {},

      status:                'pending',
      result:                null,
      error:                 null,
      duration_ms:           null,
      likeness_score:        null,
      user_decision:         null,   /* null | 'rerender' | 'refund' | 'accept' */
      rerender_count:        0
    };
  }
  /* The rail paints from siloId and effectId and does not care about the
     rest, so nothing about the row changes. */
  window.__buildPayload = buildPayload;

  /* ---- the pose is chosen once, for the whole queue ----------------------
     Ruled 2026-07-29: one pose, every piece. The pose floor sets __POSE
     after the items are already in the queue, so every item is restamped
     when it changes rather than reading a global at craft time — an item
     that has left the rail must carry its own pose. */
  function stampPose(pose){
    QUEUE.forEach(function(it){ it.pose = pose; });
  }
  window.__stampPose = stampPose;

  /* ---- what the run will actually send -----------------------------------
     Lane 3 calls this. Kept here beside the builder so the shape has one
     home, and exposed so a craft can be inspected without a breakpoint. */
  function payloadFor(item){
    return {
      source_image_b64:      item.source_image_b64,
      additional_images_b64: item.additional_images_b64,
      style_id:              item.style_id,
      preset:                item.preset,
      location:              item.location,
      scale:                 item.scale,
      aspect_ratio:          item.aspect_ratio,
      resolution:            item.resolution,
      pose:                  item.pose,
      advanced:              item.advanced
    };
  }
  window.__payloadFor = payloadFor;
