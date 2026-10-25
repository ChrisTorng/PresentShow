import {songs as prototypeSongs,defaultPlans} from './singer-data.js';
import {SingerSequence} from './singer-sequence.js';
import {mountLeader} from './leader-runtime.js';
import {fixedShortcutSlots,expandedRoute,navigationTarget,nextShortcutRow,songBrowseTarget} from './leader4-flow.js';
import {repeatRatio} from '../config/repeats.js';
import {uiLabels} from '../config/ui-labels.js';

const $=id=>document.getElementById(id);
const initial=new SingerSequence(defaultPlans,prototypeSongs);
let songs=prototypeSongs,route=initial.route,rows=[],viewedSong=0;
let readOnly={before:[],after:[]},viewedArea='worship',catalogKey='',tabSelection=null,labels=uiLabels();
let active={singing:true,songIndex:0,routeIndex:0,page:0},queued=null;
let structureKey='',activeKey='',animation=0,frameLock=null;
const lastPositions=new Map();
const node=(tag,className,text)=>{const element=document.createElement(tag);element.className=className||'';if(text!==undefined)element.textContent=text;return element;};
const announce=message=>{$('announcement').textContent=message;};
const groupAt=index=>$('flow-sequence').querySelector('.flow-group[data-route-index="'+index+'"]');
const slideAt=index=>$('flow-sequence').querySelector('.flow-group[data-slide-index="'+index+'"]');
const currentElement=()=>viewedArea==='worship'?(active.singing?groupAt(active.routeIndex):null):slideAt(active.slideIndex);
const tabIndex=()=>viewedArea==='before'?-1:viewedArea==='after'?songs.length:viewedSong;
function navigate(row,routePage=0){
 if(!sync.canControl){moveTo(groupAt(row.routeIndex),{smooth:true});return;}
 if(!active.singing||viewedArea!=='worship'){announce('目前為唯讀階段');return;}
 const target=navigationTarget(row,routePage);if(!target)return;
 if(sync.navigateTo(target)){queued={...target,page:routePage};viewedSong=row.song;renderTabs();updateFlow();renderShortcuts();announce('已預選下一項：'+songs[row.song].title+' · '+row.name);}
}
function setViewedSong(index){
 viewedArea=index<0?'before':index>=songs.length?'after':'worship';
 if(viewedArea==='worship')viewedSong=index;
 render({focusSong:true,smooth:true});
}
function renderTabs(){
 $('song-number').textContent=viewedArea==='worship'?(viewedSong+1)+'/'+songs.length:'僅看';
 $('song-title').textContent=viewedArea==='worship'?(songs[viewedSong]?.title||'尚無歌曲'):labels.worship+(viewedArea==='before'?'前':'後');
 const selected=tabIndex();
 $('previous-song').disabled=selected===-1;$('next-song').disabled=selected===songs.length;
 const tabs=[{title:labels.worship+'前',index:-1},...songs.map((song,index)=>({title:String(index+1)+' '+song.title,index})),{title:labels.worship+'後',index:songs.length}];
 $('song-tabs').replaceChildren(...tabs.map(({title,index:i})=>{
  const button=node('button','song-tab',title);button.type='button';
  const live=active.singing?i===active.songIndex:active.area==='before'?i===-1:i===songs.length;
  button.classList.toggle('viewing',i===selected);button.classList.toggle('playing',live);
  button.setAttribute('aria-pressed',String(i===selected));button.setAttribute('aria-label','瀏覽'+title+(i<0||i>=songs.length?'（僅看）':'的完整編排'));
  button.onclick=()=>setViewedSong(i);return button;
 }));
 if(tabSelection!==selected){tabSelection=selected;requestAnimationFrame(()=>$('song-tabs').querySelector('.viewing')?.scrollIntoView({block:'nearest',inline:'nearest'}));}
}
function renderShortcuts(){
 if(viewedArea!=='worship'){
  const groups=new Map();for(const item of readOnly[viewedArea]||[])if(!groups.has(item.section))groups.set(item.section,item);
  const sections=[...groups.values()],shortcuts=$('section-shortcuts');
  shortcuts.style.setProperty('--shortcut-count',Math.max(1,sections.length));
  shortcuts.replaceChildren(...sections.map(item=>{
   const button=node('button','flow-shortcut instrumental readonly-shortcut',item.sectionTitle);button.type='button';
   button.classList.toggle('playing',(readOnly[viewedArea]||[]).some(page=>page.section===item.section&&page.slideIndex===active.slideIndex));
   button.onclick=()=>moveTo(slideAt(item.slideIndex),{smooth:true});return button;
  }));return;
 }
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
 if(viewedArea!=='worship'){
  const list=document.createDocumentFragment();let section=null;
  for(const item of readOnly[viewedArea]||[]){
   if(section!==item.section){list.append(node('div','flow-song-divider',item.sectionTitle));section=item.section;}
   const group=node('article','flow-group instrumental readonly-group');group.dataset.slideIndex=String(item.slideIndex);
   group.append(node('strong','readonly-title',item.name||''));
   if(item.lines.some(line=>line)){
    const content=node('div','readonly-content');for(const line of item.lines)content.append(node('div','',line||'\u00a0'));group.append(content);
   }
   if(item.seconds)group.append(node('small','readonly-timer',item.seconds+' 秒 · 自動換頁'));
   list.append(group);
  }
  if(!list.childNodes.length)list.append(node('p','flow-end','尚無項目'));
  $('flow-sequence').replaceChildren(list);return;
 }
 const list=document.createDocumentFragment();let previousSong=-1;
 for(const row of rows){
  if(row.end){list.append(node('div','flow-end',labels.worship+'結束'));continue;}
  if(previousSong!==row.song){const divider=node('div','flow-song-divider',String(row.song+1)+' · '+songs[row.song].title);divider.dataset.songIndex=String(row.song);list.append(divider);previousSong=row.song;}
  const group=node('article','flow-group '+row.kind);group.dataset.routeIndex=String(row.routeIndex);group.dataset.songIndex=String(row.song);
  if(row.loop)group.dataset.loop='true';
  if(row.utility){
   const button=node('button','flow-interlude',row.name);button.type='button';button.setAttribute('aria-label','預選 '+songs[row.song].title+'的'+row.name);button.onclick=()=>navigate(row);group.append(button);
  }else{
   const title=node('button','flow-title');title.type='button';title.append(node('strong','',row.name.replace(/\s+/g,'')));
   if(row.repeated||row.loop)title.append(node('small','flow-occurrence',repeatRatio(row)));
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
 $('flow-scroll').setAttribute('aria-label',viewedArea==='worship'?'完整演唱順序，向上可查看已播放內容':labels.worship+(viewedArea==='before'?'前':'後')+'項目，僅供查看');
 $('flow-scroll').classList.toggle('readonly',viewedArea!=='worship'||!active.singing||!sync.canControl);
 if(viewedArea!=='worship'){
  for(const group of $('flow-sequence').querySelectorAll('.flow-group')){
   const index=Number(group.dataset.slideIndex),live=index===active.slideIndex;
   group.classList.toggle('active',live);group.classList.toggle('queued',index===queued?.slideIndex);
   group.setAttribute('aria-current',live?'step':'false');
  }
  syncFrames();return;
 }
 for(const group of $('flow-sequence').querySelectorAll('.flow-group')){
  const index=Number(group.dataset.routeIndex),live=active.singing&&index===active.routeIndex;
  group.classList.toggle('active',live);group.classList.toggle('past',active.singing&&index<active.routeIndex);
  group.classList.toggle('queued',index===queued?.routeIndex);
  const row=rows.find(row=>row.routeIndex===index);
  if(row?.loop){const count=group.querySelector('.flow-occurrence');if(count){count.textContent=repeatRatio(row,live?active.iteration||1:1);count.title='無限反覆';}}
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
 const current=currentElement(),next=viewedArea==='worship'?(queued?.singing===false?null:groupAt(queued?.routeIndex)):slideAt(queued?.slideIndex);
 placeFrame($('flow-current-frame'),current?(frameLock||frameBox(current)):null);
 const nextPage=next?.querySelector('.flow-page[data-route-page="'+(queued?.page||0)+'"]');
 placeFrame($('flow-next-frame'),next?frameBox(nextPage||next):null);
}
function stopFollow(){cancelAnimationFrame(animation);animation=0;frameLock=null;syncFrames();}
function moveTo(target,{smooth=false,lockFrame=false}={}){
 if(!target)return;stopFollow();
 const scroll=$('flow-scroll'),start=scroll.scrollTop,box=frameBox(target);
 const end=Math.max(0,Math.min(scroll.scrollHeight-scroll.clientHeight,start+box.top-5));
 const duration=smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?260:0;
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
 const key=(catalogKey||JSON.stringify([songs,route]))+'|'+viewedArea;
 if(key!==structureKey){structureKey=key;rows=expandedRoute(route,songs);buildFlow();}
 viewedSong=Math.min(viewedSong,songs.length-1);renderTabs();renderShortcuts();updateFlow();
 if(focusSong){
  if(viewedArea!=='worship')moveTo(currentElement()||$('flow-sequence').querySelector('.flow-group'),{smooth});
  else{
   const index=songBrowseTarget(viewedSong,active,lastPositions);
   moveTo(index!==null?groupAt(index):$('flow-sequence').querySelector('.flow-song-divider[data-song-index="'+viewedSong+'"]'),{smooth});
  }
 }else if(follow)moveTo(currentElement(),{smooth,lockFrame:true});
}
$('flow-scroll').addEventListener('scroll',syncFrames,{passive:true});
for(const event of ['wheel','touchstart','pointerdown'])$('flow-scroll').addEventListener(event,stopFollow,{passive:true});
window.addEventListener('resize',()=>render({focusSong:true}));
$('previous-song').onclick=()=>setViewedSong(tabIndex()-1);$('next-song').onclick=()=>setViewedSong(tabIndex()+1);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{announce('請使用瀏覽器的全螢幕功能。');}};
document.addEventListener('fullscreenchange',()=>$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全螢幕':'進入全螢幕'));
const sync=mountLeader({showOutsideWorship:true,onState:snapshot=>{
 if(!Array.isArray(snapshot.songs)||!Array.isArray(snapshot.route))return;
 labels={...uiLabels(),...snapshot.labels};
 const next=snapshot.active||{singing:false},key=next.singing?'song:'+next.routeIndex:'slide:'+next.slideIndex;
 const changed=key!==activeKey,previousSong=active.songIndex;
 const incomingKey=snapshot.contentVersion||JSON.stringify([snapshot.songs,snapshot.route,snapshot.readOnly]);
 const changedShow=catalogKey!==incomingKey;
 if(changedShow)lastPositions.clear();
 for(const [songIndex,position] of Object.entries(snapshot.history||{})){
  if(Number.isInteger(position?.routeIndex)&&snapshot.route[position.routeIndex]?.song===Number(songIndex))lastPositions.set(Number(songIndex),position);
 }
 songs=snapshot.songs;route=snapshot.route;readOnly=snapshot.readOnly||{before:[],after:[]};active=next;queued=snapshot.next||snapshot.cue;catalogKey=incomingKey;
 if(next.singing){lastPositions.set(next.songIndex,{routeIndex:next.routeIndex,page:next.page});if(previousSong!==next.songIndex||changedShow||changed&&viewedArea!=='worship'){viewedSong=next.songIndex;viewedArea='worship';}}
 else if(changed||changedShow)viewedArea=next.area||'before';
 activeKey=key;render({follow:changed,smooth:!!structureKey});
}});
render({follow:true});
