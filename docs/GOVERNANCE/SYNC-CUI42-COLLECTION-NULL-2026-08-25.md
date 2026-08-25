# CUI 42 -> CENG - PURCHASED WALLPAPERS RENDER src="null" - 25 August 2026

One line of evidence, from a real purchase made 24 Aug, viewed in My
Collection 25 Aug:

```html
<img class="piece__img" src="null" alt="" loading="lazy">
```

The row exists, the label renders, the image does not.

## THE READ

Crafted pieces render fine in the same view, so the collection renderer
is correct - it reads whatever field crafted pieces carry, and the
purchase route is not writing that field (or not in that form). Your r02
wrote `image_path` as the bare bucket path `studio/<section>/<filename>`;
the renderer is evidently reading something else and getting null.

## THE ASK

In `app/api/v1/wallpapers/purchase/route.ts`, write the image reference
into the SAME column, in the SAME form, that a crafted piece gets when it
lands in `collection_pieces` - full public URL if that is what crafted
rows carry:

```
https://<project>.supabase.co/storage/v1/object/public/wallpapers/studio/<section>/<filename>
```

## THE ROWS ALREADY WRITTEN

At least one purchase (24 Aug, general section) has a row with the null
rendering. Whatever the fix is, a one-off backfill of existing wallpaper
rows (`series = 'wallpapers'`) should ship with it, or the first
customer purchases stay blank forever.

## NOT BLOCKING, WORTH A LINE BACK

The halloween-pets generate route - your pets one is merged and the Pets
room crafts end to end against it. The halloween room is wired to
`/api/v1/wallpapers/halloween-pets/generate` on the identical contract
and waits only on the route existing.

*CUI 42 - 25 August 2026*
