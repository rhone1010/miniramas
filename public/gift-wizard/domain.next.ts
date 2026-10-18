export interface Preview {id:string;url:string;label:string;width:number;height:number;watermark:'baked';fixture:boolean}
export interface Option {sku:string;size:string;family:string;label:string;retailCents:number;attributes?:Record<string,string>;compatible:boolean}
export interface Product {id:string;label:string;image:string;available:boolean;options:Option[]}
export interface Crop {zoom:number;x:number;y:number}
export interface Line {id:string;artworkId:string;productId:string;size:string;copies:number;crop:Crop;orientation:'square';customization:Record<string,string>}
export interface Address {name:string;line1:string;line2:string;city:string;state:string;postcode:string;countryCode:string}
export interface State {sessionId:string;step:number;recipient:string;photoRef:string|null;batches:Preview[][];selectedId:string|null;productId:string|null;cart:Line[];email:string;shipTo:'self'|'recipient';address:Address;purchasePending:boolean}
export const steps=['Recipient','Upload','Discovery','Review','Products','Customize','Delivery','Checkout Review'];
export function fresh():State{return {sessionId:'gift-dev-'+crypto.randomUUID(),step:0,recipient:'',photoRef:null,batches:[],selectedId:null,productId:null,cart:[],email:'',shipTo:'self',address:{name:'',line1:'',line2:'',city:'',state:'',postcode:'',countryCode:''},purchasePending:false}}
export function selected(s:State){return s.batches.flat().find(p=>p.id===s.selectedId)}
export function addressValid(s:State){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)&&['name','line1','city','postcode'].every(k=>s.address[k as keyof Address].trim())&&/^[A-Z]{2}$/.test(s.address.countryCode)}
export function canVisit(s:State,n:number){if(n===0)return true;if(!s.recipient.trim())return false;if(n===1)return true;if(!s.photoRef)return false;if(n===2)return true;if(!selected(s))return false;if(n<=4)return true;if(n===5)return !!s.productId;if(!s.cart.length)return false;return n===6||addressValid(s)}
export function validateLine(s:State,line:Line,products:Product[]){
 const p=products.find(p=>p.id===line.productId),o=p?.options.find(o=>o.size===line.size);
 if(!p?.available||!o?.compatible)throw Error('This configuration is not available in the shared launch catalog.');
 if(!selected(s)||line.artworkId!==s.selectedId)throw Error('Every item must use the selected artwork.');
 if(!Number.isInteger(line.copies)||line.copies<1||line.copies>20)throw Error('Choose a quantity from 1 to 20.');
 if(line.orientation!=='square'||!Number.isFinite(line.crop.zoom)||line.crop.zoom<1||line.crop.zoom>2||![line.crop.x,line.crop.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('Check the artwork crop.');
 if(Object.keys(line.customization).length)throw Error('This product does not support custom messages or placement options.');
 return {product:p,option:o};
}
export function subtotal(s:State,products:Product[]){return s.cart.reduce((total,l)=>total+validateLine(s,l,products).option.retailCents*l.copies,0)}
export interface PreviewPurchaseHandoff {kind:'additional-previews';developmentOnly:true;sessionId:string;quantity:6;amountCents:299;currency:'USD';status:'requires_verified_payment'}
export function purchaseHandoff(s:State):PreviewPurchaseHandoff {if(!s.batches.length)throw Error('Use the included preview batch first.');return {kind:'additional-previews',developmentOnly:true,sessionId:s.sessionId,quantity:6,amountCents:299,currency:'USD',status:'requires_verified_payment'}}
export function appendIncludedBatch(s:State,batch:Preview[]){
 if(s.batches.length)throw Error('Additional previews require confirmed payment. No credits have been granted.');
 if(!s.photoRef||batch.length!==6||new Set(batch.map(p=>p.id)).size!==6||batch.some(p=>p.watermark!=='baked'||!p.fixture||!/^\.\/assets\/preview-[1-6]\.jpg$/.test(p.url)))throw Error('The protected preview batch is incomplete.');
 s.batches.push(structuredClone(batch));
}
export interface CheckoutHandoff {
 version:1;developmentOnly:true;readyForPayment:false;sessionId:string;
 customer:{userId:null;email:string};selectedArtwork:{previewId:string;sourceAssetId:string;width:number;height:number;watermark:'baked';fixture:boolean};
 items:Array<{renderId:string;sku:string;size:string;finish:string;copies:number;catalogUnitCents:number;attributes:Record<string,string>;crop:Crop;orientation:'square';customization:Record<string,string>}>;
 shippingAddress:Address;shipTo:'self'|'recipient';recipient:string;
 previewEntitlement:{includedBatchUsed:boolean;confirmedPaidBatches:0;additionalBatchRequestPending:boolean};
 totals:{currency:'USD';catalogSubtotalCents:number;shippingCents:null;taxCents:null;orderTotalCents:null};
 artworkUnlock:{on:'confirmed-physical-product-payment';count:1;consumeExistingCredits:false};
 blockers:string[];
}
export function checkoutHandoff(s:State,products:Product[]):CheckoutHandoff{
 const art=selected(s);if(!art||!s.photoRef||!s.recipient.trim()||!s.cart.length||!addressValid(s))throw Error('Complete the artwork, cart, email and delivery details.');
 const items=s.cart.map(l=>{const {option:o}=validateLine(s,l,products);return {renderId:art.id,sku:o.sku,size:o.size,finish:o.family,copies:l.copies,catalogUnitCents:o.retailCents,attributes:{...o.attributes},crop:{...l.crop},orientation:l.orientation,customization:{...l.customization}}});
 return {version:1,developmentOnly:true,readyForPayment:false,sessionId:s.sessionId,customer:{userId:null,email:s.email},selectedArtwork:{previewId:art.id,sourceAssetId:s.photoRef,width:art.width,height:art.height,watermark:art.watermark,fixture:true},items,shippingAddress:{...s.address},shipTo:s.shipTo,recipient:s.recipient,previewEntitlement:{includedBatchUsed:s.batches.length>0,confirmedPaidBatches:0,additionalBatchRequestPending:s.purchasePending},totals:{currency:'USD',catalogSubtotalCents:subtotal(s,products),shippingCents:null,taxCents:null,orderTotalCents:null},artworkUnlock:{on:'confirmed-physical-product-payment',count:1,consumeExistingCredits:false},blockers:['Fixture artwork must be replaced by a server-owned NB2.1 preview reference.','Resolve authenticated customer and verified preview entitlements.','Revalidate catalog, crop, shipping and tax on the server.','CC Print Shop checkout integration is not connected.']};
}
