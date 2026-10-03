import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'dist');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.woff2':'font/woff2'};
export function startPreview(port=4330){return new Promise(resolve=>{const server=http.createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.includes('..'))throw new Error('Invalid path');const file=join(root,path==='/'?'index.html':path);const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});server.listen(port,'127.0.0.1',()=>resolve({server,url:`http://127.0.0.1:${server.address().port}`}));});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {url}=await startPreview(Number(process.env.PORT||4330));console.log(`Static Sales Jarvis demo: ${url}`);}
