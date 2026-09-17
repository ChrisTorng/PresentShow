import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.mp4':'video/mp4','.png':'image/png'};
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || pathname.split('/').some(p => p.startsWith('.'))) throw new Error();
    const data = await readFile(file);
    const headers = {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
    if(req.headers.range){
      const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      const start=match?Number(match[1]):-1, end=match?.[2]?Math.min(Number(match[2]),data.length-1):data.length-1;
      if(start<0 || start>=data.length || end<start){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return;}
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(data.subarray(start,end+1));
    }else{res.writeHead(200,{...headers,'Content-Length':data.length});res.end(data);}
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('PresentShow: http://localhost:4173'));
