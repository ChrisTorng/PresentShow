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
        sections.push({sectionId:page.sectionId, name:page.section, kind:styleFor(page.section,page.sectionKey), pages:[]});
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
    parsePlan(i,plan,result); // reject invalid plans before publishing
    return plan;
  });
  return {schema:1, showName:show.name, songs:result, plans};
}
