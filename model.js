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
  if (!raw || !raw.pages || !Array.isArray(raw.sequence) || !raw.sequence.length) throw new Error('設定檔需要 pages 與非空的 sequence。');
  const vars = {...raw.variables};
  vars.date ||= `${now.getFullYear()} / ${now.getMonth()+1} / ${now.getDate()}`;
  const config = substitute(raw, vars);
  const items = [];
  const add = (ref, group, seconds) => {
    const id = typeof ref === 'string' ? ref : ref.page;
    const page = config.pages[id];
    if (!page) throw new Error(`找不到頁面：${id}`);
    if (!['blank','text','image','media'].includes(page.type)) throw new Error(`${id}：type 必須為 blank、text、image 或 media。`);
    if (page.blocks && (!Array.isArray(page.blocks) || page.blocks.some(b => !['eyebrow','title','subtitle','text','quote','account','caption'].includes(b.kind) || typeof b.text !== 'string'))) throw new Error(`${id}：blocks 需指定有效的 kind 與文字 text。`);
    if (page.type === 'image' && !page.src) throw new Error(`${id}：圖片需要 src。`);
    if (page.fit && !['contain','original'].includes(page.fit)) throw new Error(`${id}：fit 請使用 contain 或 original。`);
    const duration = typeof ref === 'object' ? (ref.seconds ?? seconds ?? page.seconds ?? 0) : (seconds ?? page.seconds ?? 0);
    if (!Number.isFinite(duration) || duration < 0) throw new Error(`${id}：seconds 必須是大於等於 0 的數字。`);
    items.push({...page,id,group,seconds:duration,label:page.label || id});
  };
  for (const entry of config.sequence) {
    if (entry && typeof entry === 'object' && entry.pages) {
      if (!Array.isArray(entry.pages) || !entry.pages.length) throw new Error('輪播 pages 不可為空。');
      const start = items.length;
      entry.pages.forEach(ref => add(ref,entry.label || '輪播',entry.seconds ?? 10));
      for (let i=start;i<items.length;i++) items[i].autoNext = i < items.length-1 ? i+1 : entry.loop ? start : (entry.continue ? i+1 : null);
    } else add(entry);
  }
  let track = null;
  items.forEach((item,index) => {
    if (item.media && item.media !== 'keep' && item.media !== 'stop') {
      const media = item.media;
      if (typeof media !== 'object' || !media.src || !['youtube','audio','video'].includes(media.kind)) throw new Error(`${item.id}：media 需要 kind（youtube/audio/video）與 src。`);
      if (media.kind === 'youtube' && !youtubeId(media.src)) throw new Error(`${item.id}：無效的 YouTube 網址。`);
      track = {...media,key:`${index}:${media.src}`,loop:media.loop !== false};
    } else if (item.media !== 'keep') track = null;
    item.track = track ? {...track} : null;
    if (item.type === 'media' && !track) throw new Error(`${item.id}：媒體頁需要 media。`);
    if (!Object.hasOwn(item,'autoNext')) item.autoNext = item.seconds ? (index+1 < items.length ? index+1 : null) : null;
    if (item.autoNext >= items.length) item.autoNext = null;
  });
  return {name:config.name || '未命名投影',items,variables:vars};
}
export function resolveAsset(src, base, assets = new Map()) {
  const clean = src.replaceAll('\\','/').replace(/^\.\//,'');
  if (assets.has(clean)) return assets.get(clean);
  if (/^(?:[a-z]:[\\/]|file:)/i.test(src)) throw new Error(`不能直接讀取本機路徑：${src}。請選取素材資料夾，並使用相對路徑。`);
  const url = new URL(src,base);
  if (!['http:','https:','blob:'].includes(url.protocol)) throw new Error('素材僅支援 HTTP、HTTPS 或已選取的本機檔案。');
  return url.href;
}
