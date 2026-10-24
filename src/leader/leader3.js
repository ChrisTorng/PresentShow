import {songs as prototypeSongs, defaultPlans} from './singer-data.js';
import {SingerSequence} from './singer-sequence.js';
import {mountLeader} from './leader-runtime.js';
import {fixedShortcutSlots,expandedRoute,navigationTarget,nextShortcutRow} from './leader-flow.js';

const $=id=>document.getElementById(id);
const initial=new SingerSequence(defaultPlans,prototypeSongs);
let songs=prototypeSongs,route=initial.route,rows=[],viewedSong=0;
let active={singing:true,songIndex:0,routeIndex:0,page:0};
let activeKey='';
const node=(tag,className,text)=>{
 const element=document.createElement(tag);
 if(className)element.className=className;
 if(text!==undefined)element.textContent=text;
 return element;
};
const announce=message=>{$('announcement').textContent=message;};
function navigate(row,routePage=0) {
 const target=navigationTarget(row,routePage);
 if(!target)return;
 if(sync.navigateTo(target))announce('已要求主控切換：'+songs[row.song]?.title+' · '+row.name+(row.utility?'':' 第 '+(routePage+1)+' 頁'));
}
function setViewedSong(index) {
 viewedSong=Math.min(songs.length-1,Math.max(0,index));
 render({focusSong:true});
}
function renderTabs() {
 $('song-number').textContent=(viewedSong+1)+'/'+songs.length;
 $('song-title').textContent=songs[viewedSong]?.title||'尚無歌曲';
 $('previous-song').disabled=viewedSong===0;
 $('next-song').disabled=viewedSong===songs.length-1;
 const tabs=songs.map((song,i)=>{
  const button=node('button','song-tab',String(i+1)+' '+song.title);
  button.type='button';button.classList.toggle('viewing',i===viewedSong);
  button.classList.toggle('playing',active.singing&&i===active.songIndex);
  button.setAttribute('aria-pressed',String(i===viewedSong));
  button.setAttribute('aria-label','瀏覽'+song.title+'的完整編排');
  button.onclick=()=>setViewedSong(i);
  return button;
 });
 $('song-tabs').replaceChildren(...tabs);
}
function renderShortcuts() {
 const all=fixedShortcutSlots(songs);
 const shortcuts=$('section-shortcuts');
 shortcuts.style.setProperty('--shortcut-count',all.length);
 const available=new Set(rows.filter(row=>row.song===viewedSong).map(row=>row.slot).filter(Boolean));
 const current=rows.find(row=>row.routeIndex===active.routeIndex);
 shortcuts.replaceChildren(...all.map(slot=>{
  const button=node('button','flow-shortcut '+slot.kind,slot.label);
  button.type='button';button.disabled=!available.has(slot.id);
  const playing=active.singing&&active.songIndex===viewedSong&&current?.slot===slot.id;
  button.classList.toggle('playing',playing);
  button.setAttribute('aria-label',(button.disabled?'本首歌未使用 ':'切換至 ')+slot.label);
  if(playing)button.setAttribute('aria-current','step');
  if(!button.disabled)button.onclick=()=>{
   const destination=nextShortcutRow(rows,slot.id,viewedSong,active.routeIndex);
   if(destination)navigate(destination,0);
  };
  return button;
 }));
}
function renderFlow({follow=false,focusSong=false}={}) {
 const scroll=$('flow-scroll'),top=scroll.scrollTop;
 const list=document.createDocumentFragment();
 let previousSong=-1;
 for(const row of rows){
  if(row.end){list.append(node('div','flow-end','演唱結束'));continue;}
  if(previousSong!==row.song){
   const divider=node('div','flow-song-divider',String(row.song+1)+' · '+songs[row.song].title);
   divider.dataset.songIndex=String(row.song);
   list.append(divider);previousSong=row.song;
  }
  const live=active.singing&&active.routeIndex===row.routeIndex;
  const group=node('article','flow-group '+row.kind);
  group.dataset.routeIndex=String(row.routeIndex);
  group.dataset.songIndex=String(row.song);
  group.classList.toggle('active',live);
  group.classList.toggle('past',active.singing&&row.routeIndex<active.routeIndex);
  if(row.utility){
   const button=node('button','flow-interlude',row.name);
   button.type='button';
   button.setAttribute('aria-label','切換至 '+songs[row.song].title+'的'+row.name);
   if(live)button.setAttribute('aria-current','step');
   button.onclick=()=>navigate(row,0);
   group.append(button);
  }else{
   const title=node('button','flow-title');
   title.type='button';
   title.append(node('strong','',row.name.replace(/\s+/g,'')));
   if(row.occurrence>1)title.append(node('small','flow-occurrence','第 '+row.occurrence+' 次'));
   title.setAttribute('aria-label','切換至'+row.name+'第 1 頁');
   title.onclick=()=>navigate(row,0);
   const pages=node('div','flow-page-list');
   for(const page of row.pages){
    const button=node('button','flow-page');
    button.type='button';button.dataset.routePage=String(page.routePage);
    button.classList.toggle('live',live&&active.page===page.routePage);
    if(live&&active.page===page.routePage)button.setAttribute('aria-current','step');
    button.setAttribute('aria-label','切換至'+row.name+'第 '+(page.routePage+1)+' 頁：'+page.lines.join(' '));
    for(const line of page.lines)button.append(node('span','flow-lyric-line',line||'\u00a0'));
    if(row.pages.length>1)button.append(node('small','flow-page-label','第 '+(page.routePage+1)+' 頁'));
    button.onclick=()=>navigate(row,page.routePage);
    pages.append(button);
   }
   group.append(title,pages);
  }
  list.append(group);
 }
 $('flow-sequence').replaceChildren(list);
 requestAnimationFrame(()=>{
  if(follow||focusSong){
   const target=focusSong
    ? [...scroll.querySelectorAll('.flow-song-divider')].find(el=>Number(el.dataset.songIndex)===viewedSong)
    : [...scroll.querySelectorAll('.flow-group')].find(el=>Number(el.dataset.routeIndex)===active.routeIndex);
   if(target){
    const page=follow&&!focusSong?target.querySelector('.flow-page[data-route-page="'+active.page+'"]'):null;
    const element=page||target;
    const offset=element.getBoundingClientRect().top-scroll.getBoundingClientRect().top;
    scroll.scrollTop+=offset-5;
   }else scroll.scrollTop=top;
  }else scroll.scrollTop=top;
 });
}
function render(options={}) {
 if(!songs.length)return;
 rows=expandedRoute(route,songs);
 viewedSong=Math.min(viewedSong,songs.length-1);
 renderTabs();renderShortcuts();renderFlow(options);
}
$('previous-song').onclick=()=>setViewedSong(viewedSong-1);
$('next-song').onclick=()=>setViewedSong(viewedSong+1);
$('fullscreen').onclick=async()=>{
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
 }catch{announce('請使用瀏覽器的全螢幕功能。');}
};
document.addEventListener('fullscreenchange',()=>{
 $('fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全螢幕':'進入全螢幕');
});
const sync=mountLeader({onState:snapshot=>{
 if(!Array.isArray(snapshot.songs)||!snapshot.songs.length||!Array.isArray(snapshot.route))return;
 const next=snapshot.active||{singing:false};
 const key=next.singing?[next.slideIndex,next.routeIndex,next.page].join(':'):'not-singing';
 const changed=key!==activeKey;
 songs=snapshot.songs;route=snapshot.route;active=next;
 if(changed&&next.singing&&Number.isInteger(next.songIndex))viewedSong=next.songIndex;
 activeKey=key;
 render({follow:changed&&!!next.singing});
}});
render({follow:true});
