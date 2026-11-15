import {createHash, randomBytes} from 'node:crypto';
import {readFile, realpath, rename, unlink, writeFile} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import path from 'node:path';
import {parseConfig} from './src/config/format.js';
import {compile} from './src/config/model.js';

export const configRoute = '/__presentshow/';
const maxBytes = 1024 * 1024;
const revisionOf = text => createHash('sha256').update(text).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), {status});

export function createConfigHandler(root) {
  const keys = new Map(), files = new Map(), writes = new Set();
  const canonicalRoot = realpath(root).catch(() => root);
  return async (req, res, url) => {
    const json = (status, data) => {
      res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
      res.end(JSON.stringify(data));
    };
    try {
      const source = url.pathname === `${configRoute}source`;
      let filePath;
      if (source) {
        const remote = req.socket.remoteAddress?.replace(/^::ffff:/, '');
        if (!['127.0.0.1','::1'].includes(remote) || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host)) {
          throw fail(403, '請在筆電以 localhost 開啟來源主控。');
        }
        filePath = url.searchParams.get('file') || '';
      } else {
        const key = url.pathname.slice(`${configRoute}playback/`.length);
        filePath = url.pathname.startsWith(`${configRoute}playback/`) && files.get(key);
        if (!filePath) throw fail(404, '播放連線已失效，請取得筆電目前的播放主控連結。');
      }
      if (!/^\/private\/.+\.(?:ya?ml|json)$/i.test(filePath) ||
          filePath.includes('\\') || filePath.split('/').some(part => part.startsWith('.'))) {
        throw fail(400, '請選擇 private 資料夾內的 YAML／JSON 設定。');
      }
      const directory = await canonicalRoot;
      const file = path.resolve(directory, '.' + filePath);
      if (!file.startsWith(path.join(directory, 'private') + path.sep) || await realpath(file) !== file) {
        throw fail(400, '設定檔必須直接位於 private 資料夾中。');
      }
      if (req.method === 'POST') {
        if (!source) throw fail(405, '播放主控只能讀取設定。');
        if (req.headers['content-type'] !== 'application/json') throw fail(415, '設定須透過來源主控儲存。');
        if (writes.has(file)) throw fail(409, '設定正在儲存，請稍後再試。');
        writes.add(file);
        const temporary = path.join(path.dirname(file), `.presentshow-${randomBytes(12).toString('hex')}.tmp`);
        try {
          const chunks = [];
          let bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes <= maxBytes) chunks.push(chunk);
          }
          if (bytes > maxBytes) throw fail(413, '設定檔大小超過 1 MB。');
          const {text, revision} = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (typeof text !== 'string') throw fail(400, '缺少設定文字。');
          try { compile(parseConfig(text)); } catch (error) { throw fail(400, error.message); }
          await writeFile(temporary, text, {flag:'wx'});
          if (revisionOf(await readFile(file, 'utf8')) !== revision) {
            throw fail(409, '磁碟上的設定已有新版。請關閉編輯器並確認新版後再修改。');
          }
          await rename(temporary, file);
          return json(200, {revision:revisionOf(text)});
        } finally {
          await unlink(temporary).catch(() => {});
          writes.delete(file);
        }
      }
      const text = await readFile(file, 'utf8');
      const revision = revisionOf(text);
      if (req.method === 'HEAD') {
        res.writeHead(200, {'ETag':`"${revision}"`, 'Cache-Control':'no-store'});
        return res.end();
      }
      const data = {text, revision, filePath};
      if (source) {
        let key = keys.get(filePath);
        if (!key) {
          key = randomBytes(24).toString('hex');
          keys.set(filePath, key);files.set(key, filePath);
        }
        data.playbackPath = `${configRoute}playback/${key}`;
        data.addresses = [...new Set(Object.values(networkInterfaces()).flat()
          .filter(address => address?.family === 'IPv4' && !address.internal).map(address => address.address))];
      }
      json(200, data);
    } catch (error) {
      const status = error.status ?? (error.code === 'ENOENT' ? 404 : error instanceof SyntaxError ? 400 : 500);
      json(status, {error:error.status ? error.message : status === 404 ? '找不到設定檔。' : status === 400 ? '設定資料格式錯誤。' : '無法讀寫筆電上的設定檔。'});
    }
  };
}
