import {defaultPlans, songs as prototypeSongs} from './singer-data.js';
import {parsePlan} from './singer-sequence.js';

const styleFor = (label, key) => {
  const name = String(label).replaceAll(' ', '').toLowerCase();
  if (name.includes('前副歌') || key === 'P') return 'prechorus';
  if (name.includes('小副歌') || key === 'T') return 'tag';
  if (name.includes('副歌') || key === 'C') return 'chorus';
  if (key === 'B' || name.includes('橋段')) return 'bridge';
  return 'verse';
};

// All actual lyrics and plans originate from the controller's active YAML,
// never from the Leader's local defaults.
export function leaderSnapshot(show, raw) {
  const result = show.songs.map((song, i) => {
    const metadata = raw.songMeta?.[song.id] || {};
    const sections = [];
    for (const page of song.pages) {
      if (!sections.length || sections.at(-1).sectionId !== page.sectionId) {
        sections.push({sectionId:page.sectionId, name:page.sectionName||page.section, kind:styleFor(page.sectionName||page.section,page.sectionKey), pages:[]});
      }
      sections.at(-1).pages.push(page.text);
    }
    return {
      title: metadata.title || song.title,
      sourceTitle: song.title,
      sourceSongId: song.id,
      credit: metadata.credit || '',
      sections: sections.map(({sectionId,name,kind,pages}) => ({sectionId,name,kind,pages})),
    };
  });
  const plans = result.map((song,i) => {
    const configured = raw.leaderPlans?.[i+1] ?? raw.leaderPlans?.[String(i+1)] ?? raw.leaderPlans?.[show.songs[i].title];
    const matchesPrototype = prototypeSongs[i]?.title === show.songs[i]?.title
      && prototypeSongs[i].sections.every(section => song.sections.some(s => s.name.replaceAll(' ','') === section.name.replaceAll(' ','')));
    const plan = configured || (matchesPrototype ? defaultPlans[i] : ['前奏', ...song.sections.map(s=>s.name), '尾奏'].join('-'));
    try{parsePlan(i,plan,result);return plan;}
    catch{
      // A source section may have been renamed after an explicit page-level
      // arrangement was saved. The actual route below remains authoritative.
      const fallback=song.sections.map(s=>s.name).join('-');
      parsePlan(i,fallback,result);
      return fallback;
    }
  });
  // A single authoritative route is generated from the very same slides shown
  // on the controller, including repeated/removed/reordered lyric references.
  const route=[];
  let lastItem=-2;
  for(let i=0;i<show.items.length;i++){
    const item=show.items[i],part=item.song;
    if(!part||part.titlePage||part.boundary){lastItem=-2;continue;}
    const songIndex=show.songs.findIndex(s=>s.id===part.id);
    if(songIndex<0)continue;
    const sectionIndex=part.utility===undefined
      ? result.songs[songIndex].sections.findIndex(s=>s.sectionId===part.sectionId):-1;
    const utility=part.utility;
    const sourcePage=Math.max(0,(part.sectionPage||1)-1);
    const previous=route.at(-1);
    const contiguous=i===lastItem+1&&sectionIndex>=0
      &&previous?.song===songIndex&&previous.section===sectionIndex
      &&!previous.utility&&sourcePage===previous.pageRefs.at(-1)+1;
    if(contiguous){
      previous.slideIndices.push(i);
      previous.pageRefs.push(sourcePage);
    }else route.push({
      song:songIndex,...(utility?{utility}:{section:sectionIndex}),
      slideIndices:[i],pageRefs:utility?[0]:[sourcePage]
    });
    lastItem=i;
  }
  return {schema:1, showName:show.name, songs:result, plans, route};
}
