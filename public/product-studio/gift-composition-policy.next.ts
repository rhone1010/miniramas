import type {StudioOption,StudioProduct} from './studio.next.js';

// Composition eligibility is independent of manufacturing and photographic availability.
// This policy is opt-in for migration 059; legacy Gift and Collection adapters do not use it.
export type GiftCompositionAspect='1:1'|'2:3'|'3:2'|'21:9'|'catalog';
export type GiftCompositionReason='subject_count_required'|'subject_count_restriction'|'unsupported_artwork_ratio'|'invalid_catalog_geometry'|null;
export interface GiftCompositionEligibility {
 allowed:boolean;reason:GiftCompositionReason;aspect:GiftCompositionAspect|null;
 pictureRatio:number|null;placement:'picture'|'primary_visible_area';
}
const wallArt=new Set(['fine_art','premium','framed','matted','canvas','framed_canvas']);
export function giftCompositionEligibility(product:Pick<StudioProduct,'id'>,option:Pick<StudioOption,'imageWidthIn'|'imageHeightIn'>,subjectCount:number|null|undefined):GiftCompositionEligibility {
 const w=option.imageWidthIn,h=option.imageHeightIn;
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return {allowed:false,reason:'invalid_catalog_geometry',aspect:null,pictureRatio:null,placement:'picture'};
 const pictureRatio=w/h;
 // Generation aspect never changes the catalog's physical wrap or card geometry.
 if(product.id==='mug')return {allowed:true,reason:null,aspect:'21:9',pictureRatio,placement:'primary_visible_area'};
 if(product.id==='card')return {allowed:true,reason:null,aspect:'catalog',pictureRatio,placement:'picture'};
 const matches=(ratio:number)=>Math.abs(pictureRatio/ratio-1)<=0.02;
 const aspect:GiftCompositionAspect|null=matches(1)?'1:1':matches(2/3)?'2:3':matches(3/2)?'3:2':null;
 const base={aspect,pictureRatio,placement:'picture' as const};
 if(!wallArt.has(product.id)||!aspect)return {...base,allowed:false,reason:'unsupported_artwork_ratio'};
 if(!Number.isInteger(subjectCount)||subjectCount!<1)return {...base,allowed:false,reason:'subject_count_required'};
 const allowed=aspect==='1:1'||(aspect==='2:3'&&subjectCount!<=3)||(aspect==='3:2'&&subjectCount!>=2);
 return {...base,allowed,reason:allowed?null:'subject_count_restriction'};
}

// Returns existing options, without synthesizing SKUs or rewriting availability, price or finish.
export function giftCompositionOptions<T extends StudioOption>(product:Pick<StudioProduct,'id'>,options:T[],subjectCount:number|null|undefined){
 return options.map(option=>({option,composition:giftCompositionEligibility(product,option,subjectCount)}));
}
