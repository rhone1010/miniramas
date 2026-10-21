// Local-only Print Studio contract fixture. No external services or commerce writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('public'),data=JSON.parse(fs.readFileSync(path.join(root,'gift-wizard/catalog.next.json')));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'};
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');const json=x=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x))};
 if(req.method!=='GET'){res.writeHead(403);return json({error:'offline_read_only'})}
 if(u.pathname==='/api/v1/print/source')return json({piece:{id:u.searchParams.get('piece'),width:1024,height:1024},fulfilment:true});
 if(u.pathname==='/api/v1/print/catalog')return json({contractVersion:1,artwork:{width:1024,height:1024},products:data.products.flatMap(p=>p.options.map(o=>({family:p.id,status:p.available?'launch':'disabled',selectable:p.available,size:o.size,label:o.label,retailCents:o.retailCents,sku:o.sku,attributes:o.attributes,requirements:{ppi:300,picturePx:{w:o.imageWidthIn*300,h:o.imageHeightIn*300},finalPx:o.requiredPx}})))});
 const target=u.pathname==='/print'?'/portraits.html':u.pathname;
 const file=path.resolve(root,'.'+decodeURIComponent(target));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
}).listen(4209,'127.0.0.1',()=>console.log('Offline Print Studio fixture http://localhost:4209/print?test_piece=a8caca33-0a95-48ab-be74-9f13b9ba3a72'));
