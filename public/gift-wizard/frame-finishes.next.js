// Display references sampled from Prodigi swatches, 2026-10-16. Not colorimetric specifications.
// Source: tools/product-mockup/review/frame-finishes/references/finishes.next.json
export const frameFinishes = {
  "black": {
    "label": "Black",
    "rgb": [
      29,
      29,
      27
    ]
  },
  "white": {
    "label": "White",
    "rgb": [
      245,
      245,
      245
    ]
  },
  "natural": {
    "label": "Natural",
    "rgb": [
      216,
      199,
      175
    ]
  },
  "silver": {
    "label": "Antique Silver",
    "rgb": [
      219,
      218,
      213
    ]
  },
  "brown": {
    "label": "Brown",
    "rgb": [
      96,
      61,
      41
    ]
  },
  "gold": {
    "label": "Antique Gold",
    "rgb": [
      201,
      160,
      69
    ]
  },
  "dark grey": {
    "label": "Dark Grey",
    "rgb": [
      89,
      103,
      112
    ]
  },
  "light grey": {
    "label": "Light Grey",
    "rgb": [
      193,
      192,
      182
    ]
  }
};
export function frameColors(family){
 const colors=['black','white','natural','brown','dark grey','light grey','gold','silver'];
 return family==='framed_canvas'?colors.filter(c=>!c.includes('grey')):['framed','matted'].includes(family)?colors:[];
}
// Only the isolated frame changes. Art, mat, background and alpha remain byte-identical.
export function tintFramePixels(output,frame,art,mat,color){
 const finish=frameFinishes[color];if(!finish)throw Error('unsupported_frame_finish');
 if(output.length!==frame.length||output.length!==art.length||mat&&mat.length!==output.length)throw Error('frame_mask_mismatch');
 if(color==='natural')return;
 const luminance=i=>.2126*output[i]+.7152*output[i+1]+.0722*output[i+2];
 const values=[];
 for(let i=0;i<output.length;i+=4)if(frame[i]>250&&frame[i+3]>250&&!art[i]&&!(mat?.[i]))values.push(luminance(i));
 if(!values.length)throw Error('empty_frame_mask');
 values.sort((a,b)=>a-b);const reference=Math.max(1,values[Math.floor(values.length*.9)]);
 for(let i=0;i<output.length;i+=4){
  if(!frame[i]||art[i]||mat?.[i])continue;
  const k=frame[i]/255*frame[i+3]/255,shade=Math.pow(Math.max(0,luminance(i)/reference),.55);
  for(let c=0;c<3;c++)output[i+c]=Math.round(output[i+c]*(1-k)+Math.min(255,finish.rgb[c]*shade)*k);
 }
}
