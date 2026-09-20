import {DEFAULT_BACKGROUND,normalizeBackground} from '../backgrounds/config.js';
import {parseSongs} from './songs.js';
import {expandSequence} from './sequence.js';
export function youtubeId(src) {
  try {
    const u = new URL(src);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0];
    if (['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)) return u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || null;
  } catch {}
  return null;
}
export function substitute(value, vars) {
  if (typeof value === 'string') return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(vars,key.trim())) throw new Error(`找不到變數：${key}`);
    return String(vars[key.trim()]);
  });
  if (Array.isArray(value)) return value.map(v => substitute(v,vars));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,substitute(v,vars)]));
  return value;
}
export function compile(raw, now = new Date()) {
  if (!raw || (!raw.sections && (!Array.isArray(raw.sequence) || !raw.sequence.length))) throw new Error('設定檔需要非空的 sections 或 sequence。');
  const vars = {...raw.variables};
  vars.date ||= `${now.getFullYear()} / ${now.getMonth()+1} / ${now.getDate()}`;
  const config = substitute(raw, vars);
  const songs=parseSongs(config.songs || '');
  const backgrounds=Object.fromEntries(Object.entries(config.backgrounds || {default:DEFAULT_BACKGROUND}).map(([id,value])=>[id,normalizeBackground(value,id)]));
  const defaultBackground=config.background || Object.keys(backgrounds)[0];
  if(!Object.hasOwn(backgrounds,defaultBackground))throw new Error(`找不到預設背景：${defaultBackground}`);
  const {items,sections}=expandSequence(config,songs,backgrounds,defaultBackground);
  let track = null;
  let background=backgrounds[defaultBackground];
  items.forEach((item,index) => {
    if(item.background && item.background!=='keep'){
      if(typeof item.background!=='string' || !Object.hasOwn(backgrounds,item.background))throw new Error(`${item.id}：找不到背景 ${item.background}。`);
      background=backgrounds[item.background];
    }
    item.background=background;
    if (item.media && item.media !== 'keep' && item.media !== 'stop') {
      const media = item.media;
      if (typeof media !== 'object' || !media.src || !['youtube','audio','video'].includes(media.kind)) throw new Error(`${item.id}：media 需要 kind（youtube/audio/video）與 src。`);
      if (media.kind === 'youtube' && !youtubeId(media.src)) throw new Error(`${item.id}：無效的 YouTube 網址。`);
      track = {...media,key:`${JSON.stringify(item.origin)}:${media.src}`,loop:media.loop !== false};
    } else if (item.media !== 'keep') track = null;
    item.track = track ? {...track} : null;
    if (item.type === 'media' && !track) throw new Error(`${item.id}：媒體頁需要 media。`);
    if (!Object.hasOwn(item,'autoNext')) item.autoNext = item.seconds ? (index+1 < items.length ? index+1 : null) : null;
    if (item.autoNext >= items.length) item.autoNext = null;
  });
  return {name:config.name || '未命名投影',items,variables:vars,backgrounds,songs,sections};
}
export function resolveAsset(src, base, assets = new Map()) {
  const clean = src.replaceAll('\\','/').replace(/^\.\//,'');
  if (assets.has(clean)) return assets.get(clean);
  if (/^(?:[a-z]:[\\/]|file:)/i.test(src)) throw new Error(`不能直接讀取本機路徑：${src}。請選取素材資料夾，並使用相對路徑。`);
  const url = new URL(src,base);
  if (!['http:','https:','blob:'].includes(url.protocol)) throw new Error('素材僅支援 HTTP、HTTPS 或已選取的本機檔案。');
  return url.href;
}
