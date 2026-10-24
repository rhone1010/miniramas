export type BeautyInputKind = 'generation_picture' | 'mug_full_wrap_view'
export type BeautyRefusal = 'no_beauty_scene_for_family' | 'orientation_not_photographed' | 'finish_not_photographed' | 'shape_not_photographed'
/** Frame scenes only: the colour the customer selected, every colour this product is sold in, and how the browser shows it (recolour the supplied frame mask from the photographed colour; nothing else changes). */
export interface BeautyFrame { selected: string; supported: string[]; recolor: { mask: 'frame-mask.svg'; folder: string; photographedColor: string; toColor: string; needed: boolean } }
export type BeautyRouting =
  | { sceneId: string; family: string; folder: string; openingAspect: number; extension: number; input: { kind: BeautyInputKind; aspect: number }; displayOnly: true; productionPrintFile: false; reason: null; frame?: BeautyFrame }
  | { sceneId: null; reason: BeautyRefusal; nearest?: { sceneId: string; openingAspect: number; productAspect: number; extension: number } }

/** `frameColor`: the colour the line is sold in (defaults to the product's own `color` attribute, then black). The product passed may already carry it. */
