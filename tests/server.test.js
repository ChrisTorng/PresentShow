import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {networkInterfaces} from 'node:os';
import { createPresentShowServer, defaultCorsOrigins } from '../server.mjs';

let server, root, base;
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'presentshow-cors-'));
  await mkdir(path.join(root, 'private', 'meeting', 'pray'), {recursive:true});
  await writeFile(path.join(root, 'private', 'meeting', 'show.yml'), 'name: Local demo\n');
  await writeFile(path.join(root, 'private', 'meeting', 'pray', 'image.jpg'), 'image fixture');
  await writeFile(path.join(root, 'private', 'meeting', 'clip.mp4'), '0123456789');
  server = createPresentShowServer({root, extraOrigins:'https://preview.example.com'});
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (root) await rm(root, {recursive:true, force:true});
});

test('Vercel, GitHub Pages and custom domain can read local YAML and relative images', async () => {
  for (const origin of defaultCorsOrigins) {
    const config = await fetch(`${base}/private/meeting/show.yml`, {headers:{Origin:origin}});
    assert.equal(config.status, 200);
    assert.equal(config.headers.get('access-control-allow-origin'), origin);
    assert.match(config.headers.get('vary'), /Origin/);
    assert.equal(config.headers.get('access-control-allow-credentials'), null);
    assert.equal(await config.text(), 'name: Local demo\n');
    const image = await fetch(new URL('pray/image.jpg', config.url), {headers:{Origin:origin}});
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/jpeg');
    assert.equal(await image.text(), 'image fixture');
  }
});

test('CORS whitelist rejects other sites, suffix lookalikes, raw.githack and null origins', async () => {
  for (const origin of ['https://other.vercel.app', 'https://present-show.vercel.app.evil.test', 'https://other.github.io', 'https://raw.githack.com', 'null']) {
    const response = await fetch(`${base}/private/meeting/show.yml`, {headers:{Origin:origin}});
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(await response.text(), 'Origin not allowed');
  }
  for (const origin of [base, `http://localhost:${server.address().port}`, 'https://preview.example.com', undefined]) {
    const response = await fetch(`${base}/private/meeting/show.yml`, {headers:origin ? {Origin:origin} : {}});
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  }
});

test('OPTIONS allows read-only range requests and legacy private-network preflights', async () => {
  const origin = defaultCorsOrigins[0];
  const response = await fetch(`${base}/private/meeting/clip.mp4`, {method:'OPTIONS', headers:{
    Origin:origin, 'Access-Control-Request-Method':'GET',
    'Access-Control-Request-Headers':'Range, Content-Type',
    'Access-Control-Request-Private-Network':'true',
  }});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
  assert.equal(response.headers.get('access-control-allow-headers'), 'range, content-type');
  assert.equal(response.headers.get('access-control-allow-private-network'), 'true');
  for (const headers of [
    {Origin:origin, 'Access-Control-Request-Method':'POST'},
    {Origin:origin, 'Access-Control-Request-Method':'GET', 'Access-Control-Request-Headers':'Authorization'},
    {Origin:'https://evil.test', 'Access-Control-Request-Method':'GET'},
  ]) {
    const denied = await fetch(`${base}/private/meeting/clip.mp4`, {method:'OPTIONS', headers});
    assert.equal(denied.status, 403);
    await denied.text();
  }
});

test('cross-origin video retains 206 byte ranges and HEAD metadata', async () => {
  const Origin = defaultCorsOrigins[0];
  const clip = await fetch(`${base}/private/meeting/clip.mp4`, {headers:{Origin, Range:'bytes=2-5'}});
  assert.equal(clip.status, 206);
  assert.equal(clip.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(clip.headers.get('content-length'), '4');
  assert.equal(clip.headers.get('access-control-allow-origin'), Origin);
  assert.match(clip.headers.get('access-control-expose-headers'), /Content-Range/);
  assert.equal(await clip.text(), '2345');
  const head = await fetch(`${base}/private/meeting/clip.mp4`, {method:'HEAD', headers:{Origin}});
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '10');
  assert.equal(head.headers.get('access-control-allow-origin'), Origin);
  assert.equal(await head.text(), '');
});

test('missing files and invalid ranges retain CORS headers; writes stay disabled', async () => {
  const Origin = defaultCorsOrigins[0];
  const missing = await fetch(`${base}/missing.jpg`, {headers:{Origin}});
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('access-control-allow-origin'), Origin);
  await missing.text();
  const range = await fetch(`${base}/private/meeting/clip.mp4`, {headers:{Origin, Range:'bytes=99-'}});
  assert.equal(range.status, 416);
  assert.equal(range.headers.get('access-control-allow-origin'), Origin);
  await range.text();
  const post = await fetch(`${base}/private/meeting/clip.mp4`, {method:'POST', headers:{Origin}});
  assert.equal(post.status, 405);
  await post.text();
});

test('additional origins must be exact HTTP or HTTPS origins', () => {
  for (const extraOrigins of ['*', 'null', 'https://example.com/path', 'https://example.com/', 'file://example.com']) {
    assert.throws(() => createPresentShowServer({extraOrigins}));
  }
});

test('LAN interfaces serve mobile browsers and accept their own origin', async () => {
  const addresses=Object.values(networkInterfaces()).flat().filter(address=>address?.family==='IPv4'&&!address.internal);
  for(const address of addresses){
    const origin=`http://${address.address}:${server.address().port}`;
    const response=await fetch(`${origin}/private/meeting/show.yml`,{headers:{Origin:origin}});
    assert.equal(response.status,200,origin);
    assert.equal(response.headers.get('access-control-allow-origin'),origin);
    await response.text();
  }
});
