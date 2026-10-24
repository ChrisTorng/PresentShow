// Keep both on-air and queued references when a configuration is recompiled.
export function remapPosition(previous,next,index){
  if(!Number.isInteger(index)||!previous?.items[index])return null;
  const old=previous.items[index];
  const sameSection=item=>item.section.id===old.section.id;
  const identity=item=>old.song
    ? !!item.song&&item.song.title===old.song.title&&item.song.utility===old.song.utility
      &&item.song.sectionName===old.song.sectionName&&item.song.sectionPage===old.song.sectionPage
      &&!!item.song.boundary===!!old.song.boundary&&!!item.song.titlePage===!!old.song.titlePage
    : !item.song&&item.id===old.id;
  const matches=next.items.map((item,i)=>({item,i})).filter(({item})=>sameSection(item)&&identity(item));
  const exact=matches.find(({item})=>JSON.stringify(item.origin)===JSON.stringify(old.origin));
  if(exact)return exact.i;
  const ordinal=previous.items.slice(0,index).filter(item=>sameSection(item)&&identity(item)).length;
  if(matches.length)return matches[Math.min(ordinal,matches.length-1)].i;
  const section=next.sections.find(section=>section.id===old.section.id);
  return section?Math.min(section.end,section.start+index-previous.sections[old.section.index].start):Math.min(index,next.items.length-1);
}
