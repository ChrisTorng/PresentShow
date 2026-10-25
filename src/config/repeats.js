export function repeatRuns(parts,keyFor){
 const result=[];
 for(let start=0;start<parts.length;){
  const key=keyFor(parts[start]);let end=start+1;
  if(!parts[start].loop)while(end<parts.length&&!parts[end].loop&&keyFor(parts[end])===key)end++;
  for(let i=start;i<end;i++)result[i]={occurrence:i-start+1,total:parts[i].loop?null:end-start};
  start=end;
 }
 return result;
}
export function annotateSongRepeats(items){
 const groups=[];let previousIndex=-2;
 items.forEach((item,index)=>{
  const song=item.song;
  if(!song||song.titlePage||song.boundary){previousIndex=-2;return;}
  const key=JSON.stringify([song.instance,song.utility||song.sectionId]),previous=groups.at(-1);
  const contiguous=index===previousIndex+1&&!song.utility&&previous?.key===key&&song.sectionPage===items[previousIndex].song.sectionPage+1&&item.loopGroup===items[previousIndex].loopGroup;
  if(contiguous)previous.indices.push(index);
  else groups.push({key,indices:[index],loop:!!item.loopGroup});
  previousIndex=index;
 });
 const runs=repeatRuns(groups,group=>group.key);
 groups.forEach((group,i)=>group.indices.forEach(index=>{items[index].song.repeat={...runs[i],loop:group.loop};}));
}
export const repeatRatio=(repeat,iteration=1)=>repeat?`${repeat.loop?iteration:repeat.occurrence}/${repeat.loop?'∞':repeat.total}`:'';
