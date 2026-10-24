// Gift Shop display scenes only. Manufacturing and the shared Product Studio
// keep their existing contracts; Premium and Fine Art share photography.
const names={fine_art:'fine_art_print',premium:'fine_art_print',framed:'framed_print',matted:'matted_frame',canvas:'wrapped_canvas',framed_canvas:'framed_canvas',mug:'mug',card:'greeting_card'};
export function beautyPhoto(product,option){
 const prefix=names[product.id];if(!prefix)return product.image;
 let name=prefix;
 if(!['mug','card'].includes(product.id)){
  const orientation=!option||option.imageWidthIn===option.imageHeightIn?'square':option.imageWidthIn>option.imageHeightIn?'landscape':'portrait';
  name+='_'+(prefix==='wrapped_canvas'&&orientation==='square'?'sqaure':orientation);
 }
 return '/gift-wizard/beauty-scenes/'+name+'/product_beauty_'+name+'.jpeg';
}
