// YouTube owns the playback budget, including pages that retain its soundtrack.
export function playbackPolicy(item,quietBackground=false){
 const youtube=item.track?.kind==='youtube';
 const quiet=quietBackground||youtube;
 return {quiet,youtube,visible:item.type==='media'||youtube,
  background:quiet?{...item.background,type:'solid',src:undefined,poster:undefined}:item.background};
}
