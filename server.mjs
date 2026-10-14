import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultCorsOrigins = [
  'https://present-show.vercel.app',
  'https://present-show-christorngs-projects.vercel.app',
  'https://present-show-git-main-christorngs-projects.vercel.app',
  'https://christorng.github.io',
  'https://christorng.idv.tw',
  'http://christorng.idv.tw',
];
const allowedMethods = ['GET', 'HEAD', 'OPTIONS'];
const allowedHeaders = ['range', 'content-type'];
function corsOrigins(extra) {
  const origins = new Set(defaultCorsOrigins);
  for (const value of (extra || '').split(',').map(value => value.trim()).filter(Boolean)) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
      throw new Error(`CORS 來源需為完整 origin，不含路徑或萬用字元：${value}`);
    }
    origins.add(value);
  }
  return origins;
}
const types = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.webm':'video/webm','.yml':'text/yaml; charset=utf-8','.yaml':'text/yaml; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.mp4':'video/mp4','.png':'image/png'};
export function createPresentShowServer({ root = process.cwd(), extraOrigins = process.env.PRESENTSHOW_CORS_ORIGINS } = {}) {
 root = path.resolve(root);
 const origins = corsOrigins(extraOrigins);
 return http.createServer(async (req,res) => {
  res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Access-Control-Request-Private-Network');
  const origin = req.headers.origin;
  const sameServerOrigins = [`http://localhost:${req.socket.localPort}`, `http://127.0.0.1:${req.socket.localPort}`];
  if (origin && !origins.has(origin) && !sameServerOrigins.includes(origin)) {
    res.writeHead(403);res.end('Origin not allowed');return;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  }
  if (!allowedMethods.includes(req.method)) {
    res.writeHead(405, {Allow: allowedMethods.join(', ')});res.end('Method not allowed');return;
  }
  if (req.method === 'OPTIONS') {
    const method = req.headers['access-control-request-method'];
    const headers = (req.headers['access-control-request-headers'] || '').split(',').map(header => header.trim().toLowerCase()).filter(Boolean);
    if ((method && !['GET', 'HEAD'].includes(method)) || headers.some(header => !allowedHeaders.includes(header))) {
      res.writeHead(403);res.end('Preflight not allowed');return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      res.setHeader('Access-Control-Max-Age', '600');
      // Compatibility with browsers that still use Private Network Access preflights.
      if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    res.writeHead(204, {Allow: allowedMethods.join(', ')});res.end();return;
  }
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
 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PRESENTSHOW_PORT || 4173);
  createPresentShowServer().listen(port, '127.0.0.1', () => console.log(`PresentShow: http://localhost:${port}`));
}
