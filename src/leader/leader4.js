import {songs as prototypeSongs,defaultPlans} from './singer-data.js';
import {SingerSequence} from './singer-sequence.js';
import {mountLeader} from './leader-runtime.js';
import {fixedShortcutSlots,expandedRoute,navigationTarget,nextShortcutRow,songBrowseTarget} from './leader4-flow.js';

const $=id=>document.getElementById(id);
const initial=new SingerSequence(defaultPlans,prototypeSongs);
let songs=prototypeSongs,route=initial.route,rows=[],viewedSong=0;
let active={singing:true,songIndex:0,routeIndex:0,page:0},queued=null;
let structureKey='',activeKey='',animation=0,frameLock=null;
const lastPositions=new Map();
const node=(tag,className,text)=>{const element=document.createElement(tag);element.className=className||'';if(text!==undefined)element.textContent=text;return element;};
const announce=message=>{$('announcement').textContent=message;};
const groupAt=index=>$('flow-sequence').querySelector('.flow-group[data-route-index="'+index+'"]');
function navigate(row,routePage=0){
 const target=navigationTarget(row,routePage);if(!target)return;
 if(sync.navigateTo(target)){queued={...target,page:routePage};viewedSong=row.song;renderTabs();updateFlow();renderShortcuts();announce('已預選下一項：'+songs[row.song].title+' · '+row.name);}
}
function setViewedSong(index){viewedSong=Math.min(songs.length-1,Math.max(0,index));render({focusSong:true,smooth:true});}
function renderTabs(){
 $('song-number').textContent=(viewedSong+1)+'/'+songs.length;
 $('song-title').textContent=songs[viewedSong]?.title||'尚無歌曲';
 $('previous-song').disabled=viewedSong===0;$('next-song').disabled=viewedSong===songs.length-1;
 $('song-tabs').replaceChildren(...songs.map((song,i)=>{
  const button=node('button','song-tab',String(i+1)+' '+song.title);button.type='button';
  button.classList.toggle('viewing',i===viewedSong);button.classList.toggle('playing',active.singing&&i===active.songIndex);
  button.setAttribute('aria-pressed',String(i===viewedSong));button.setAttribute('aria-label','瀏覽'+song.title+'的完整編排');
  button.onclick=()=>setViewedSong(i);return button;
 }));
}
function renderShortcuts(){
 const all=fixedShortcutSlots(songs,route,viewedSong),shortcuts=$('section-shortcuts');
 shortcuts.style.setProperty('--shortcut-count',Math.max(1,all.length));
 const available=new Set(rows.filter(row=>row.song===viewedSong).map(row=>row.slot).filter(Boolean));
 const current=rows.find(row=>row.routeIndex===active.routeIndex),next=rows.find(row=>row.routeIndex===queued?.routeIndex);
 shortcuts.replaceChildren(...all.map(slot=>{
  const button=node('button','flow-shortcut '+slot.kind,slot.label);button.type='button';button.disabled=!available.has(slot.id);
  const playing=active.singing&&active.songIndex===viewedSong&&current?.slot===slot.id;
  button.classList.toggle('playing',playing);button.classList.toggle('queued',queued?.songIndex===viewedSong&&next?.slot===slot.id);
  button.setAttribute('aria-label',(button.disabled?'本首歌未使用 ':'預選 ')+slot.label);
  if(playing)button.setAttribute('aria-current','step');
  if(!button.disabled)button.onclick=()=>{const destination=nextShortcutRow(rows,slot.id,viewedSong,active.routeIndex);if(destination)navigate(destination);};
  return button;
 }));
}
function buildFlow(){
 const list=document.createDocumentFragment();let previousSong=-1;
 for(const row of rows){
  if(row.end){list.append(node('div','flow-end','敬拜結束'));continue;}
  if(previousSong!==row.song){const divider=node('div','flow-song-divider',String(row.song+1)+' · '+songs[row.song].title);divider.dataset.songIndex=String(row.song);list.append(divider);previousSong=row.song;}
  const group=node('article','flow-group '+row.kind);group.dataset.routeIndex=String(row.routeIndex);group.dataset.songIndex=String(row.song);
  if(row.loop)group.dataset.loop='true';
  if(row.utility){
   const button=node('button','flow-interlude',row.name);button.type='button';button.setAttribute('aria-label','預選 '+songs[row.song].title+'的'+row.name);button.onclick=()=>navigate(row);group.append(button);
  }else{
   const title=node('button','flow-title');title.type='button';title.append(node('strong','',row.name.replace(/\s+/g,'')));
   if(row.repeated||row.loop)title.append(node('small','flow-occurrence','第 '+row.occurrence+' 次'));
   title.setAttribute('aria-label','預選'+row.name+'第 1 頁');title.onclick=()=>navigate(row);
   const pages=node('div','flow-page-list');
   for(const page of row.pages){
    const button=node('button','flow-page');button.type='button';button.dataset.routePage=String(page.routePage);
    button.setAttribute('aria-label','預選'+row.name+'第 '+(page.routePage+1)+' 頁：'+page.lines.join(' '));
    for(const line of page.lines)button.append(node('span','flow-lyric-line',line||'\u00a0'));
    button.onclick=()=>navigate(row,page.routePage);pages.append(button);
   }
   group.append(title,pages);
  }
  list.append(group);
 }
 $('flow-sequence').replaceChildren(list);
}
function updateFlow(){
 for(const group of $('flow-sequence').querySelectorAll('.flow-group')){
  const index=Number(group.dataset.routeIndex),live=active.singing&&index===active.routeIndex;
  group.classList.toggle('active',live);group.classList.toggle('past',active.singing&&index<active.routeIndex);
  group.classList.toggle('queued',index===queued?.routeIndex);
  const row=rows.find(row=>row.routeIndex===index);
  if(row?.loop){const count=group.querySelector('.flow-occurrence');if(count){count.textContent='第 '+(live?active.iteration||1:1)+' 次';count.title='無限反覆';}}
  for(const page of group.querySelectorAll('.flow-page')){
   const current=live&&Number(page.dataset.routePage)===active.page;
   page.classList.toggle('live',current);page.classList.toggle('queued',index===queued?.routeIndex&&Number(page.dataset.routePage)===queued?.page);
   if(current)page.setAttribute('aria-current','step');else page.removeAttribute('aria-current');
  }
  const interlude=group.querySelector('.flow-interlude');if(interlude){if(live)interlude.setAttribute('aria-current','step');else interlude.removeAttribute('aria-current');}
 }
 syncFrames();
}
function frameBox(element){
 const panel=$('flow-scroll').parentElement.getBoundingClientRect(),box=element.getBoundingClientRect();
 return {top:box.top-panel.top-1,left:box.left-panel.left-1,width:box.width,height:box.height};
}
function placeFrame(frame,box){
 if(!box||box.top+box.height<=0||box.top>=$('flow-scroll').clientHeight){frame.hidden=true;return;}
 frame.hidden=false;for(const property of ['top','left','width','height'])frame.style[property]=box[property]+'px';
}
function syncFrames(){
 const current=active.singing?groupAt(active.routeIndex):null,next=queued?.singing===false?null:groupAt(queued?.routeIndex);
 placeFrame($('flow-current-frame'),current?(frameLock||frameBox(current)):null);
 const nextPage=next?.querySelector('.flow-page[data-route-page="'+(queued?.page||0)+'"]');
 placeFrame($('flow-next-frame'),next?frameBox(nextPage||next):null);
}
function stopFollow(){cancelAnimationFrame(animation);animation=0;frameLock=null;syncFrames();}
function moveTo(target,{smooth=false,lockFrame=false}={}){
 if(!target)return;stopFollow();
 const scroll=$('flow-scroll'),start=scroll.scrollTop,box=frameBox(target);
 const end=Math.max(0,Math.min(scroll.scrollHeight-scroll.clientHeight,start+box.top-5));
 const duration=smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?440:0;
 if(!duration){scroll.scrollTop=end;syncFrames();return;}
 if(lockFrame){frameLock={...box,top:box.top-(end-start)};syncFrames();}
 const started=performance.now();
 const step=now=>{
  const fraction=Math.min(1,(now-started)/duration),ease=1-Math.pow(1-fraction,3);
  scroll.scrollTop=start+(end-start)*ease;syncFrames();
  if(fraction<1)animation=requestAnimationFrame(step);else{animation=0;frameLock=null;syncFrames();}
 };
 animation=requestAnimationFrame(step);
}
function render({focusSong=false,follow=false,smooth=false}={}){
 if(!songs.length)return;
 const key=JSON.stringify([songs,route]);
 if(key!==structureKey){structureKey=key;rows=expandedRoute(route,songs);buildFlow();}
 viewedSong=Math.min(viewedSong,songs.length-1);renderTabs();renderShortcuts();updateFlow();
 if(focusSong){
  const index=songBrowseTarget(viewedSong,active,lastPositions);
  moveTo(index!==null?groupAt(index):$('flow-sequence').querySelector('.flow-song-divider[data-song-index="'+viewedSong+'"]'),{smooth});
 }else if(follow)moveTo(groupAt(active.routeIndex),{smooth,lockFrame:true});
}
$('flow-scroll').addEventListener('scroll',syncFrames,{passive:true});
for(const event of ['wheel','touchstart','pointerdown'])$('flow-scroll').addEventListener(event,stopFollow,{passive:true});
window.addEventListener('resize',()=>render({focusSong:true}));
$('previous-song').onclick=()=>setViewedSong(viewedSong-1);$('next-song').onclick=()=>setViewedSong(viewedSong+1);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{announce('請使用瀏覽器的全螢幕功能。');}};
document.addEventListener('fullscreenchange',()=>$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全螢幕':'進入全螢幕'));
const sync=mountLeader({onState:snapshot=>{
 if(!Array.isArray(snapshot.songs)||!snapshot.songs.length||!Array.isArray(snapshot.route))return;
 const next=snapshot.active||{singing:false},key=next.singing?String(next.routeIndex):'outside-worship';
 const changed=key!==activeKey,previousSong=active.songIndex;
 const changedShow=structureKey!==JSON.stringify([snapshot.songs,snapshot.route]);
 if(changedShow)lastPositions.clear();
 for(const [songIndex,position] of Object.entries(snapshot.history||{})){
  if(Number.isInteger(position?.routeIndex)&&snapshot.route[position.routeIndex]?.song===Number(songIndex))lastPositions.set(Number(songIndex),position);
 }
 songs=snapshot.songs;route=snapshot.route;active=next;queued=snapshot.next||snapshot.cue;
 if(next.singing){lastPositions.set(next.songIndex,{routeIndex:next.routeIndex,page:next.page});if(previousSong!==next.songIndex||changedShow)viewedSong=next.songIndex;}
 activeKey=key;render({follow:changed&&!!next.singing,smooth:!!structureKey});
}});
render({follow:true});
