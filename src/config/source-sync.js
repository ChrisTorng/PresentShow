import {parseConfig} from './format.js';

const sourceRoute = '/__presentshow/source';
const playbackRoute = /^\/__presentshow\/playback\/[a-f0-9]{48}$/;
const loopback = ['localhost', '127.0.0.1', '[::1]'];

export function sourceEndpoint(base) {
  const url = new URL(base);
  if (url.protocol !== 'http:' || !loopback.includes(url.hostname) || !/^\/private\/.+\.(?:ya?ml|json)$/i.test(url.pathname)) return null;
  const endpoint = new URL(sourceRoute, url);
  endpoint.searchParams.set('file', decodeURIComponent(url.pathname));
  return endpoint;
}

export function playbackEndpoint(value) {
  const url = new URL(value);
  const [a,b] = url.hostname.split('.').map(Number);
  const local = loopback.includes(url.hostname) || ( /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) &&
    (a===10 || a===192&&b===168 || a===172&&b>=16&&b<=31 || a===169&&b===254));
  if (url.protocol !== 'http:' || !local || !playbackRoute.test(url.pathname) || url.username || url.password || url.search || url.hash) {
    throw Error('播放主控連結無效，請從筆電的來源主控重新複製連結。');
  }
  return url;
}

export function playbackLink(page, source, address, route) {
  const endpoint = new URL(route, source);
  endpoint.hostname = address;
  const link = new URL(page);
  link.search = '';
  link.hash = '';
  link.searchParams.set('play', playbackEndpoint(endpoint.href).href);
  return link.href;
}

async function request(endpoint, options = {}) {
  const response = await fetch(endpoint, {cache:'no-store', redirect:'error', signal:AbortSignal.timeout(5000), ...options});
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw Error(data?.error || `讀取來源失敗（HTTP ${response.status}）`);
  }
  return response;
}

export function configRevision(endpoint) {
  return request(endpoint, {method:'HEAD'}).then(response => {
    const etag = /^"([a-f0-9]{64})"$/.exec(response.headers.get('ETag') || '');
    if (!etag) throw Error('無法讀取來源設定版本。');
    return etag[1];
  });
}

export async function readSourceConfig(endpoint) {
  const data = await (await request(endpoint)).json();
  if (!/^\/private\//.test(data.filePath) || !/^[a-f0-9]{64}$/.test(data.revision) || typeof data.text !== 'string') {
    throw Error('來源設定回應不完整。');
  }
  const base = new URL(data.filePath.split('/').map(encodeURIComponent).join('/'), endpoint).href;
  return {...data, base, raw:parseConfig(data.text)};
}

export async function writeSourceConfig(endpoint, text, revision) {
  const result = await request(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, revision})});
  return (await result.json()).revision;
}
