import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const port=Number(process.env.PRESENTSHOW_PORT || 4173);
const types = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.webm':'video/webm','.yml':'text/yaml; charset=utf-8','.yaml':'text/yaml; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.mp4':'video/mp4','.png':'image/png'};
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || pathname.split('/').some(p => p.startsWith('.'))) throw new Error();
    const info = await stat(file);if(!info.isFile())throw new Error();
    const headers = {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
    let start=0,end=info.size-1;
    if(req.headers.range){
      const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      start=match?Number(match[1]):-1;end=match?.[2]?Math.min(Number(match[2]),info.size-1):info.size-1;
      if(start<0 || start>=info.size || end<start){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});
    }else res.writeHead(200,{...headers,'Content-Length':info.size});
    if(req.method==='HEAD' || !info.size){res.end();return;}
    const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`PresentShow: http://localhost:${port}`));
