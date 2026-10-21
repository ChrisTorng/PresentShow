import {songs as prototypeSongs, utilities} from './singer-data.js';
import {mountLeader} from './leader-runtime.js';
let songs = prototypeSongs;
import {SingerSequence, samePart, nameOf, kindOf, pagesOf} from './singer-sequence.js';
const $ = id => document.getElementById(id);
let sequence = new SingerSequence();
let viewedSong = 0;
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
  const next = isLiveSong ? sequence.nextSegment : route[anchor + 1];
  const nextIndex = next ? route.findIndex(item => item.id === next.id) : anchor;
  const afterNext = route[nextIndex + 1];
  $('route-window').replaceChildren(routeButton(focus, isLiveSong ? '目前' : '瀏覽'), routeButton(next, '下一個'), routeButton(afterNext, '下下一個'));
  const windowIds = new Set([focus?.id, next?.id, afterNext?.id]);
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
  const button = document.createElement('button');
  button.className = `part-button ${section.kind}${current ? ' current-section' : ''}${nextSegment ? ' next-section' : ''}`;
  button.dataset.section = sectionIndex;
  button.setAttribute('aria-label', `預備${section.name}`);
  button.setAttribute('aria-pressed', String(nextSegment));
  if (current) button.setAttribute('aria-current', 'step');
  const title = document.createElement('strong');title.textContent = section.name;
  button.append(title);
  if (section.pages.length > 1) {
    const number = document.createElement('small');number.className = 'part-page';
    number.textContent = `${current ? sequence.page + 1 : 1}/${section.pages.length}`;
    button.append(number);
  }
  button.addEventListener('click', () => stage(() => (samePart(sequence.current,item) && sequence.page + 1 < pagesOf(sequence.current,songs).length ? sequence.cuePage(item,sequence.page + 1) : sequence.cueSection(item)), `已預備${section.name}。`));
  return button;
}
function renderSections() {
  const sections = songs[viewedSong].sections;
  const groups = [
    {label:'主歌', kinds:['verse']},
    {label:'前副歌與副歌', kinds:['prechorus', 'chorus']},
    {label:'小副歌', kinds:['tag']},
  ];
  const rows = groups.map(group => {
    const members = sections.map((section, index) => ({section, index})).filter(({section}) => group.kinds.includes(section.kind));
    if (!members.length) return null;
    const row = document.createElement('div');row.className = 'section-row';
    row.setAttribute('role', 'group');row.setAttribute('aria-label', group.label);
    row.style.setProperty('--columns', members.length);
    row.replaceChildren(...members.map(({section, index}) => makeSection(section, index)));
    return row;
  }).filter(Boolean);
  $('sections').replaceChildren(...rows);
  $('sections').style.setProperty('--section-count', rows.length);
}
function render() {
  const focused = document.activeElement;
  const selector = focused?.dataset.route ? `[data-route="${focused.dataset.route}"]` : focused?.dataset.section ? `.part-button[data-section="${focused.dataset.section}"]` : null;
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
  renderSections();
  $('utility-buttons').replaceChildren(...utilities.map(utility => {
    const item = {song:viewedSong, utility};const button = document.createElement('button');
    button.className = `utility-button${samePart(sequence.current, item) ? ' current' : ''}${samePart(sequence.nextSegment, item) ? ' queued' : ''}`;
    button.textContent = utility;button.setAttribute('aria-label', `預備${utility}`);
    button.addEventListener('click', () => stage(() => (samePart(sequence.current,item) && sequence.page + 1 < pagesOf(sequence.current,songs).length ? sequence.cuePage(item,sequence.page + 1) : sequence.cueSection(item)), `已預備${utility}。`));
    return button;
  }));
  requestAnimationFrame(() => {
    // Keep the most recently sung part (the former previous slot) in view.
    $('route-past').scrollLeft = $('route-past').scrollWidth;
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

const sync=mountLeader({onState:snapshot=>{
 if(!Array.isArray(snapshot.songs)||!snapshot.songs.length)return;
 songs=snapshot.songs;sequence=new SingerSequence(snapshot.plans,songs);
 const at=snapshot.active;
 if(at?.singing){
  const entry=sequence.route[at.routeIndex];
  const match=entry?.song===at.songIndex&&entry?.section===at.sectionIndex;
  let cursor=match?at.routeIndex:sequence.route.findIndex(e=>e.song===at.songIndex&&e.section===at.sectionIndex);
  if(cursor<0)cursor=0;
  sequence.cursor=cursor;sequence.page=Math.max(0,Math.min(at.page||0,pagesOf(sequence.current,songs).length-1));
  sequence.route.forEach((part,i)=>{part.visited=i<=cursor;});viewedSong=at.songIndex;
 }else viewedSong=Math.max(0,Math.min(viewedSong,songs.length-1));
 render();
}});

render();
