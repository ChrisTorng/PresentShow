import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_BACKGROUND,normalizeBackground,backgroundPlan,mixColor} from '../src/backgrounds/config.js';
import {parseSongs,sectionTarget} from '../src/config/songs.js';
import {compile} from '../src/config/model.js';
import {parseConfig,formatConfig} from '../src/config/format.js';
import {setBackgroundCue,replaceSongText} from '../src/config/editing.js';
const songText='# First\n[Verse]\nOne\nTwo\n\nThree\n\n[Pre-Chorus]\nFour\n\n[Chorus]\nFive\n\n[Verse]\nSix\n\nSeven\n\n# Second\n[Chorus]\nEight\n\n# Third\nNine\nTen\n';
const raw={songTitlePage:false,songs:songText,backgrounds:{light:DEFAULT_BACKGROUND,rose:{type:'mist',colors:['#fff1db','#fce4ef']}},pages:{blank:{type:'blank'}},sequence:['blank',{song:1},{song:2,background:'rose'},'blank',{song:3}]};
test('same seed produces identical motion and color; different seed changes both',()=>{
  const bg=normalizeBackground();const a=backgroundPlan(bg),b=backgroundPlan({...bg});
  assert.deepEqual(a,b);assert.notDeepEqual(a,backgroundPlan({...bg,seed:'another'}));
  assert.notEqual(a[0].frames[0].transform,a[0].frames[1].transform);assert.notEqual(a[0].frames[0].backgroundColor,a[0].frames[1].backgroundColor);
  assert.deepEqual(a[0].frames[0],a[0].frames.at(-1));
});
test('palette interpolation and bounded deviation',()=>{
  assert.equal(mixColor(['#808080','#c0c0c0'],0),'#808080');assert.equal(mixColor(['#808080','#c0c0c0'],1),'#c0c0c0');
  for(const blob of backgroundPlan(normalizeBackground({colors:['#808080','#c0c0c0'],deviation:20}))){
    for(const frame of blob.frames){const channel=parseInt(frame.backgroundColor.slice(1,3),16);assert.ok(channel>=115 && channel<=205);assert.equal(frame.backgroundColor.slice(1,3),frame.backgroundColor.slice(3,5));}
  }
});
test('colorMotion zero remains one color per blob and input errors are actionable',()=>{
  const plan=backgroundPlan(normalizeBackground({colorMotion:0}));assert.equal(new Set(plan[0].frames.map(f=>f.backgroundColor)).size,1);
  assert.throws(()=>normalizeBackground({colors:['blue','pink']}),/色碼/);assert.throws(()=>normalizeBackground({deviation:101}),/deviation/);assert.throws(()=>normalizeBackground({type:'video'}),/src/);
});
test('songs split on blank lines, preserve line breaks, repeated markers create distinct targets',()=>{
  const songs=parseSongs(songText);assert.equal(songs.length,3);assert.equal(songs[0].pages.length,6);assert.equal(songs[0].pages[0].text,'One\nTwo');
  assert.deepEqual(songs[0].pages.filter(p=>p.sectionStart).map(p=>p.sectionKey),['V','P','C','V']);assert.equal(songs[2].pages[0].sectionKey,'V');
  assert.throws(()=>parseSongs('no song header'),/歌名/);
});
test('V/P/C/B shortcuts cycle section starts only, within current song occurrence',()=>{
  const {items}=compile(raw);
  assert.equal(sectionTarget(items,1,'V'),5);assert.equal(sectionTarget(items,5,'v'),1);assert.equal(sectionTarget(items,2,'P'),3);
  assert.equal(sectionTarget(items,4,'C'),4);assert.equal(sectionTarget(items,1,'B'),null);
  assert.equal(sectionTarget(items,7,'C'),7);assert.equal(sectionTarget(items,0,'C'),4);
});
test('background inheritance is deterministic even on direct jumps',()=>{
  const show=compile(raw);assert.equal(show.items[1].background.id,'light');assert.equal(show.items[8].background.id,'rose');
  const changed=setBackgroundCue(raw,show.items[2],'rose');const result=compile(changed);
  assert.equal(result.items[1].background.id,'light');assert.equal(result.items[2].background.id,'rose');assert.equal(result.items[6].background.id,'rose');
  assert.deepEqual(changed.sequence[1].backgroundAt,{'2':'rose'});
});
test('YAML supports comments, multiline songs, quoted accounts and JSON compatibility',()=>{
  const yaml='name: Sample # comment\nvariables:\n  account: "00123"\nsongs: |\n  # First\n  [Verse]\n  hello\n\n  world\nsequence:\n  - song: 1\n';
  const parsed=parseConfig(yaml);assert.equal(parsed.variables.account,'00123');assert.equal(compile(parsed).items.length,3);
  assert.deepEqual(parseConfig(formatConfig(parsed)),parsed);assert.deepEqual(parseConfig(JSON.stringify(raw)),raw);
  assert.throws(()=>parseConfig('x: !<tag:yaml.org,2002:js/function> abc'));
});
test('song editor keeps existing positions and inserts new songs',()=>{
  const next=replaceSongText(raw,songText+'\n# Fourth\nExtra',parseSongs(songText),parseSongs(songText+'\n# Fourth\nExtra'));
  assert.equal(next.sequence.at(-1).song,4);assert.equal(compile(next).songs.length,4);
});
test('removing a song does not duplicate the next song into its place',()=>{
  const source='# Second\n[Chorus]\nEight\n\n# Third\nNine\nTen\n';
  const next=replaceSongText(raw,source,parseSongs(songText),parseSongs(source));
  assert.deepEqual(next.sequence.filter(e=>e?.song).map(e=>e.song),[1,2]);assert.equal(compile(next).songs.length,2);
});
test('repeated song occurrences have separate shortcut scopes',()=>{
  const {items}=compile({...raw,sequence:[{song:1},{song:1}]});
  assert.equal(sectionTarget(items,6,'V'),10);assert.equal(sectionTarget(items,10,'V'),6);
});
test('public YAML example compiles and uses only demonstration lyrics',async()=>{
  const text=await readFile('examples/sample.yml','utf8');const config=parseConfig(text);const show=compile(config);assert.equal(show.songs.length,3);assert.ok(show.items.length>17);assert.equal(config.variables.account,'000000000000');assert.match(config.variables.accountName,/示範，請勿匯款/);
});
