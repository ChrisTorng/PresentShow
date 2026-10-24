import {defaultPlans, songs as prototypeSongs} from './singer-data.js';
import {parsePlan} from './singer-sequence.js';

const styleFor = (label, key) => {
  const name = String(label).replaceAll(' ', '').toLowerCase();
  if (name.includes('前副歌') || key === 'P') return 'prechorus';
  if (name.includes('小副歌') || key === 'T') return 'tag';
  if (name.includes('副歌') || key === 'C') return 'chorus';
  if (key === 'B' || name.includes('橋段')) return 'tag';
  return 'verse';
};

// Titles, instrumentals and blank pages around/between songs belong to worship.
// Anchor non-lyric pages to a nearby route entry so the Leader stays usable.
export function leaderPosition(show, data, at) {
  const routeIndex = data.route.findIndex(entry => entry.slideIndices.includes(at));
  if (routeIndex >= 0) {
    const part = data.route[routeIndex];
    return {singing:true, slideIndex:at, songIndex:part.song, sectionIndex:part.section ?? -1,
      utility:part.utility || null, page:part.slideIndices.indexOf(at), routeIndex};
  }
  const item = show.items[at];
  let song = item?.song;
  if (!song && item?.type === 'blank') {
    const sameSection = candidate => candidate.section.index === item.section.index;
    const before = show.items.slice(0, at).findLast(candidate => sameSection(candidate) && candidate.type !== 'blank');
    const after = show.items.slice(at + 1).find(candidate => sameSection(candidate) && candidate.type !== 'blank');
    if (before?.song && after?.song) song = after.song;
  }
  if (!song) return {singing:false, slideIndex:at};
  const songIndex = show.songs.findIndex(source => source.id === song.id);
  const entries = data.route.map((part, index) => ({part, index})).filter(({part}) => part.song === songIndex);
  const nearest = entries.find(({part}) => part.slideIndices[0] >= at) || entries.at(-1);
  if (!nearest) return {singing:false, slideIndex:at};
  return {singing:true, slideIndex:at, songIndex, routeIndex:nearest.index, page:0,
    sectionIndex:nearest.part.section ?? -1, utility:nearest.part.utility || null, interstitial:true};
}

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
      credit: metadata.credit || song.credit || '',
      sections: sections.map(({sectionId,name,kind,pages}) => ({sectionId,name,kind,pages})),
    };
  });
  const plans = result.map((song,i) => {
    const configured = show.songs[i].plan ?? raw.leaderPlans?.[i+1] ?? raw.leaderPlans?.[String(i+1)] ?? raw.leaderPlans?.[show.songs[i].title];
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
      ? result[songIndex].sections.findIndex(s=>s.sectionId===part.sectionId):-1;
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
      ...(item.loopGroup?{loop:true,loopGroup:item.loopGroup}:{}),
      slideIndices:[i],pageRefs:utility?[0]:[sourcePage]
    });
    lastItem=i;
  }
  return {schema:1, showName:show.name, songs:result, plans, route};
}
