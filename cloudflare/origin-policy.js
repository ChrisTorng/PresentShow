export function validOrigin(origin, env) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return false;
    if (url.protocol === 'http:') {
      if (['localhost','127.0.0.1'].includes(url.hostname)) return true;
      const parts = url.hostname.split('.').map(Number);
      if (parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)
        && (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168)
          || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31))) return true;
    }
  } catch { return false; }
  return (env.ALLOWED_ORIGINS || 'https://christorng.idv.tw,http://christorng.idv.tw,https://present-show.vercel.app,https://christorng.github.io')
    .split(',').map(value => value.trim()).includes(origin);
}
