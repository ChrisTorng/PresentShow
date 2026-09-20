import {SONG_KEYS} from '../config/songs.js';
export function forwardStageKey(event,item,send){
  // Embedded sites own every key, even when focus is still on the outer document.
  if(item?.type==='web'||event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target?.closest?.('input,textarea'))return;
  const key=event.key.length===1&&event.key!==' '?event.key.toUpperCase():event.key;
  if(['ArrowLeft','ArrowRight',' ','Escape','F8',...SONG_KEYS].includes(key)){event.preventDefault();send('key',{key:event.key});}
}
