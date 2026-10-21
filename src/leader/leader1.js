import {songs as prototypeSongs, utilities} from './singer-data.js';
import {mountLeader} from './leader-runtime.js';
let songs = prototypeSongs;
import {SingerSequence, samePart, nameOf, kindOf, pagesOf} from './singer-sequence.js';
import {compactPartName} from './singer-preview.js';
const $ = id => document.getElementById(id);
let sequence = new SingerSequence();
let viewedSong = 0;
let renderedSong = 0;
let renderedPart = null;
// Design preview advances pages internally; the singer UI has no timer controls.
const previewDuration = 5000;
let elapsed = 0;
let lastTick = performance.now();

function announce(text) { $('announcement').textContent = text; }
function displayName(item) {
  if (!item) return '—';
  return !item.end && item.song !== viewedSong ? `${item.song + 1} · ${nameOf(item,songs)}` : nameOf(item,songs);
}
function resetBoundary() { elapsed = 0;lastTick = performance.now(); }
function stage(action, message) { action();sync.navigate(sequence);announce(message);render(); }
function routeButton(item, label) {
  const button = document.createElement('button');
  button.className = `route-item ${kindOf(item,songs)}`;
  if (label) button.classList.add('route-slot');
  if (!item) {
    button.disabled = true;
    const caption = document.createElement('small');caption.textContent = label || '';
    const title = document.createElement('strong');title.textContent = '—';
    button.append(caption, title);return button;
  }
  button.dataset.route = item.id;
  button.classList.toggle('visited', item.visited);
  button.classList.toggle('current', item.id === sequence.current.id);
  button.classList.toggle('queued', item.id === sequence.nextSegment?.id);
  button.classList.toggle('prepared', item.id === sequence.cue?.id);
  const heading = document.createElement('small');
  heading.textContent = label || (item.repeated ? '重唱' : item.inserted ? '插入' : '');
  const title = document.createElement('strong');title.textContent = displayName(item);
  button.append(heading, title);
  if (label === '目前') {
    heading.textContent = `目前 ${sequence.page + 1}/${pagesOf(item,songs).length}`;
    button.setAttribute('aria-current', 'step');
  }
  if (item.id === sequence.nextSegment?.id) {
    const line = document.createElement('span');line.className = 'cue-track';
    const fill = document.createElement('span');fill.id = 'cue-progress';line.append(fill);button.append(line);
  }
  button.setAttribute('aria-label', `預備${displayName(item)}${item.visited ? '，重唱此處到目前的路徑' : ''}`);
  button.setAttribute('aria-pressed', String(item.id === sequence.cue?.id));
  button.addEventListener('click', () => stage(() => sequence.cueRoute(item.id), `已預備${displayName(item)}。`));
  return button;
}
function empty(text) { const span = document.createElement('span');span.className = 'route-empty';span.textContent = text;return span; }
function renderRoute() {
  const route = sequence.route;
  const current = sequence.current;
  const isLiveSong = current.song === viewedSong;
  let anchor = sequence.cursor;
  if (!isLiveSong) {
    anchor = route.findIndex((item, index) => index > sequence.cursor && item.song === viewedSong);
    if (anchor < 0) anchor = route.findLastIndex(item => item.song === viewedSong && !item.end);
  }
  const focus = route[anchor];
  const previous = route.slice(0, anchor).findLast(item => item.visited && (isLiveSong || item.song === viewedSong));
  const next = isLiveSong ? sequence.nextSegment : route[anchor + 1];
  const nextIndex = next ? route.findIndex(item => item.id === next.id) : anchor;
  const afterNext = route[nextIndex + 1];
  $('route-window').replaceChildren(routeButton(previous, '前一個'), routeButton(focus, isLiveSong ? '目前' : '瀏覽'), routeButton(next, '下一個'), routeButton(afterNext, '下下一個'));
  const windowIds = new Set([previous?.id, focus?.id, next?.id, afterNext?.id]);
  const past = route.filter(item => item.song === viewedSong && item.visited && item.id !== current.id && !windowIds.has(item.id));
  $('route-past').replaceChildren(...(past.length ? past.map(item => routeButton(item)) : [empty('尚未唱過') ]));
  const future = route.filter((item, index) => item.song === viewedSong && !item.visited && !windowIds.has(item.id) && index > anchor);
  // A skipped occurrence remains available, and never gets the "already sung" styling.
  const skipped = route.filter((item, index) => item.song === viewedSong && !item.visited && index < anchor && !windowIds.has(item.id));
  const boundary = route.find((item, index) => index > anchor && (item.end || item.song === viewedSong + 1));
  if (boundary && !windowIds.has(boundary.id) && !future.some(item => item.id === boundary.id)) future.push(boundary);
  const buttons = [...future.map(item => routeButton(item)), ...(skipped.length ? [empty('略過'), ...skipped.map(item => routeButton(item))] : [])];
  $('route-future').replaceChildren(...(buttons.length ? buttons : [empty('已到最後') ]));
}
function makeSection(section, sectionIndex) {
  const item = {song:viewedSong, section:sectionIndex};
  const current = samePart(sequence.current, item);
  const nextSegment = samePart(sequence.nextSegment, item);
  const nextPage = sequence.nextPage;
  const card = document.createElement('article');
  card.className = `section-card ${section.kind}${current ? ' current-section' : ''}${nextSegment ? ' next-section' : ''}`;
  const name = document.createElement('button');name.className = 'section-name';name.dataset.section = sectionIndex;
  name.setAttribute('aria-label', `預備${section.name}`);
  const title = document.createElement('strong');title.textContent = compactPartName(section.name);
  const status = document.createElement('small');status.textContent = current && nextSegment ? '目前 · 下一段' : current ? '目前播放' : nextSegment ? '下一段' : '';
  name.append(title, status);
  name.addEventListener('click', () => stage(() => (samePart(sequence.current,item) && sequence.page + 1 < pagesOf(sequence.current,songs).length ? sequence.cuePage(item,sequence.page + 1) : sequence.cueSection(item)), `已預備${section.name}。`));
  const scroller = document.createElement('div');scroller.className = 'lyrics-pages';scroller.dataset.pages = sectionIndex;
  section.pages.forEach((text, page) => {
    const button = document.createElement('button');button.className = 'lyrics-page';button.dataset.page = page;
    const live = current && page === sequence.page;
    const queued = samePart(nextPage?.item, item) && page === nextPage.page;
    button.classList.toggle('live-page', live);button.classList.toggle('next-page', queued);
    if (live) button.setAttribute('aria-current', 'true');
    button.setAttribute('aria-pressed', String(queued));
    button.setAttribute('aria-label', `預備${section.name}第 ${page + 1} 頁`);
    const lyrics = document.createElement('span');lyrics.className = 'lyrics-text';
    for (const textLine of text.split(/\r?\n/)) {
      const line = document.createElement('span');line.className = 'lyrics-line';line.textContent = textLine;
      lyrics.append(line);
    }
    const number = document.createElement('small');number.className = 'page-number';number.textContent = `${page + 1}/${section.pages.length}`;
    button.append(lyrics, number);
    button.addEventListener('click', () => stage(() => sequence.cuePage(item, page), `已預備${section.name}第 ${page + 1} 頁。`));
    scroller.append(button);
  });
  const content = document.createElement('div');content.className = 'lyrics-content';content.append(scroller);
  card.append(name, content);
  return card;
}
function fitLargeButtonText() {
  const sections = $('sections');
  sections.style.removeProperty('--singer1-title-size');
  sections.style.removeProperty('--singer1-lyrics-size');
  const cards = [...sections.querySelectorAll('.section-card')];
  // Resize the whitespace, keeping the type scale's original height budget.
  const appStyle = getComputedStyle(document.querySelector('.singer-app'));
  const footerGrowth = Math.max(0, parseFloat(getComputedStyle($('utility-buttons')).height) - parseFloat(appStyle.getPropertyValue('--singer1-footer-base')));
  const donatedHeight = footerGrowth * 2 / cards.length;
  const titleStyle = getComputedStyle(cards[0].querySelector('.section-name strong'));
  const maximum = parseFloat(titleStyle.fontSize);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${titleStyle.fontWeight} ${maximum}px ${titleStyle.fontFamily}`;
  const widest = Math.max(...songs.flatMap(song => song.sections.map(section => measure.measureText(compactPartName(section.name)).width)));
  const titleSize = Math.min(maximum, ...cards.map(card => {
    const name = card.querySelector('.section-name');
    const style = getComputedStyle(name);
    const status = name.querySelector('small');
    const statusHeight = status.textContent ? status.getBoundingClientRect().height + parseFloat(style.rowGap) : 0;
    const width = name.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 1;
    const height = name.clientHeight + donatedHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - statusHeight;
    return Math.min(maximum * width / widest, height / 1.08);
  }));
  sections.style.setProperty('--singer1-title-size', `${Math.max(0, Math.floor(titleSize * 10) / 10)}px`);
  const lyricMaximum = parseFloat(getComputedStyle(sections.querySelector('.lyrics-text')).fontSize);
  const lyricSize = Math.min(lyricMaximum, titleSize * .82, ...cards.flatMap((card, index) =>
    [...card.querySelectorAll('.lyrics-page')].map((page, pageIndex) => {
      const style = getComputedStyle(page);
      const height = page.clientHeight + donatedHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const lines = songs[viewedSong].sections[index].pages[pageIndex].split(/\r?\n/).length;
      return height / lines / 1.14;
    })));
  sections.style.setProperty('--singer1-lyrics-size', `${Math.max(0, Math.floor(lyricSize * 10) / 10)}px`);
  for (const line of sections.querySelectorAll('.lyrics-line, .section-name small')) {
    line.classList.toggle('is-truncated', line.scrollWidth > line.clientWidth + 1);
  }
}
function render() {
  const focused = document.activeElement;
  const selector = focused?.dataset.route ? `[data-route="${focused.dataset.route}"]` : focused?.dataset.section ? `.section-name[data-section="${focused.dataset.section}"]` : null;
  const scrolls = renderedSong === viewedSong ? new Map([...document.querySelectorAll('.lyrics-pages')].map(element => [element.dataset.pages, element.scrollLeft])) : new Map();
  // Once a part finishes, its next glance starts at page one again.
  if (renderedPart?.song === viewedSong && !samePart(renderedPart, sequence.current)) scrolls.delete(String(renderedPart.section));
  renderedSong = viewedSong;
  renderedPart = {...sequence.current};
  $('song-title').textContent = songs[viewedSong].title;
  $('song-number').textContent = `${viewedSong + 1}/${songs.length}`;
  $('previous-song').disabled = viewedSong === 0;$('next-song').disabled = viewedSong === songs.length - 1;
  $('song-tabs').replaceChildren(...songs.map((song, index) => {
    const button = document.createElement('button');button.className = `song-tab${index === viewedSong ? ' viewing' : ''}`;
    button.dataset.song = index;button.textContent = `${index + 1} ${song.title}`;
    button.setAttribute('aria-pressed', String(index === viewedSong));button.setAttribute('aria-label', `瀏覽${song.title}的編排`);
    if (sequence.current.song === index && !sequence.current.end) button.classList.add('playing');
    if (sequence.nextSegment?.song === index) button.classList.add('queued');
    button.addEventListener('click', () => { viewedSong = index;render(); });
    return button;
  }));
  renderRoute();
  $('sections').replaceChildren(...songs[viewedSong].sections.map(makeSection));
  $('sections').style.setProperty('--section-count', songs[viewedSong].sections.length);
  $('utility-buttons').replaceChildren(...utilities.map(utility => {
    const item = {song:viewedSong, utility};const button = document.createElement('button');
    button.className = `utility-button${samePart(sequence.current, item) ? ' current' : ''}${samePart(sequence.nextSegment, item) ? ' queued' : ''}`;
    button.textContent = utility;button.setAttribute('aria-label', `預備${utility}`);
    button.addEventListener('click', () => stage(() => (samePart(sequence.current,item) && sequence.page + 1 < pagesOf(sequence.current,songs).length ? sequence.cuePage(item,sequence.page + 1) : sequence.cueSection(item)), `已預備${utility}。`));
    return button;
  }));
  requestAnimationFrame(() => {
    fitLargeButtonText();
    for (const scroller of document.querySelectorAll('.lyrics-pages')) {
      const section = Number(scroller.dataset.pages);
      const live = sequence.current.song === viewedSong && sequence.current.section === section;
      const target = live ? scroller.children[sequence.page] : null;
      if (target) {
        const left = target.offsetLeft - scroller.children[0].offsetLeft;
        scroller.scrollLeft = Math.min(left, scroller.scrollWidth - scroller.clientWidth);
      } else scroller.scrollLeft = scrolls.get(String(section)) || 0;
    }
    if (selector) document.querySelector(selector)?.focus({preventScroll:true});
  });
  updateProgress();
}
function updateProgress() { if ($('cue-progress')) $('cue-progress').style.transform = `scaleX(${Math.max(0, 1 - elapsed / previewDuration)})`; }
$('previous-song').onclick = () => { viewedSong--;render(); };
$('next-song').onclick = () => { viewedSong++;render(); };
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen();else await document.documentElement.requestFullscreen(); }
  catch { announce('可使用瀏覽器全螢幕，或將網頁加入主畫面。'); }
};
document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全螢幕' : '進入全螢幕'));
document.addEventListener('visibilitychange', () => { lastTick = performance.now(); });
window.addEventListener('resize', render);
document.fonts.ready.then(() => requestAnimationFrame(fitLargeButtonText));

const sync=mountLeader({onState:snapshot=>{
 if(!Array.isArray(snapshot.songs)||!snapshot.songs.length)return;
 songs=snapshot.songs;sequence=new SingerSequence(snapshot.plans,songs,snapshot.route);
 const at=snapshot.active;
 if(at?.singing){
  const entry=sequence.route[at.routeIndex];
  const match=entry?.song===at.songIndex&&(at.utility?entry.utility===at.utility:entry.section===at.sectionIndex);
  let cursor=match?at.routeIndex:sequence.route.findIndex(e=>e.song===at.songIndex&&(at.utility?e.utility===at.utility:e.section===at.sectionIndex));
  if(cursor<0)cursor=0;
  sequence.cursor=cursor;sequence.page=Math.max(0,Math.min(at.page||0,pagesOf(sequence.current,songs).length-1));
  sequence.route.forEach((part,i)=>{part.visited=i<=cursor;});viewedSong=at.songIndex;
 }else viewedSong=Math.max(0,Math.min(viewedSong,songs.length-1));
 render();
}});

render();
