import test from 'node:test';
import assert from 'node:assert/strict';
import {SingerSequence, parsePlan, nameOf, itemFor, pagesOf} from '../src/singer-sequence.js';
import {defaultPlans} from '../src/singer-data.js';

test('the supplied first-song arrangement preserves every repeated occurrence', () => {
  const sequence = new SingerSequence();
  assert.equal(sequence.route.filter(item => item.song === 0).map(nameOf).join('-'), '前奏-主歌 1-前副歌-副歌-間奏-主歌 2-前副歌-副歌-副歌-間奏-小副歌-小副歌-副歌-副歌-尾句-尾奏');
  assert.equal(new Set(sequence.route.map(item => item.id)).size, sequence.route.length);
  assert.equal(sequence.current.utility, '前奏');
  assert.equal(sequence.route.at(-1).end, true);
});
test('pages advance within a section, then through arrangements across all songs to end', () => {
  const sequence = new SingerSequence();
  sequence.advance();
  const verse = sequence.current;
  assert.equal(nameOf(verse), '主歌 1');
  assert.equal(pagesOf(verse).length, 2);
  assert.equal(sequence.nextPage.item.id, verse.id);
  assert.equal(nameOf(sequence.nextSegment), '前副歌');
  sequence.advance();assert.equal(sequence.current.id, verse.id);assert.equal(sequence.page, 1);
  sequence.advance();assert.equal(nameOf(sequence.current), '前副歌');assert.equal(sequence.page, 0);
  const encountered = [];
  let previous = sequence.current;
  for (let count = 0; count < 150 && !sequence.current.end; count++) {
    sequence.advance();
    if (previous.song !== sequence.current.song) encountered.push([nameOf(previous), nameOf(sequence.current)]);
    previous = sequence.current;
  }
  assert.deepEqual(encountered, [['尾奏','前奏'], ['尾奏','前奏']]);
  assert.equal(sequence.current.end, true);
  assert.equal(sequence.advance(), false);
});
test('a matching section cue leaves the planned next page and arrangement unchanged', () => {
  const sequence = new SingerSequence();sequence.advance();
  const ids = sequence.route.map(item => item.id);
  sequence.cueSection(itemFor(0, '前副歌'));
  assert.deepEqual(sequence.route.map(item => item.id), ids);
  assert.equal(sequence.cue, null);
  assert.equal(sequence.nextPage.page, 1);
  assert.equal(sequence.nextPage.item.id, sequence.current.id);
});
test('a different big-button cue inserts one occurrence and retains the original next segment', () => {
  const sequence = new SingerSequence();sequence.advance();
  const current = sequence.current.id, expected = sequence.nextSegment.id;
  sequence.cueSection(itemFor(0, '副歌'));
  assert.equal(sequence.current.id, current);
  assert.equal(sequence.nextSegment.visited, false);
  assert.equal(nameOf(sequence.nextSegment), '副歌');
  assert.equal(sequence.route[sequence.cursor + 2].id, expected);
  sequence.cueSection(itemFor(0, '小副歌'));
  assert.equal(nameOf(sequence.nextSegment), '小副歌');
  assert.equal(sequence.route[sequence.cursor + 2].id, expected);
  sequence.advance();assert.equal(nameOf(sequence.current), '小副歌');assert.equal(sequence.current.visited, true);
  assert.equal(sequence.nextSegment.id, expected);
});
test('jumping back stages a copy through the current occurrence without changing current playback', () => {
  const sequence = new SingerSequence();sequence.advance();sequence.advance();sequence.advance();
  const current = sequence.current.id, expected = sequence.nextSegment.id;
  const target = sequence.route[1].id;
  sequence.cueRoute(target);
  assert.equal(sequence.current.id, current);
  const copies = sequence.route.slice(sequence.cursor + 1, sequence.cursor + 3);
  assert.deepEqual(copies.map(nameOf), ['主歌 1','前副歌']);
  assert.ok(copies.every(item => item.repeated && !item.visited));
  assert.equal(sequence.route[sequence.cursor + 3].id, expected);
  sequence.advance();assert.equal(nameOf(sequence.current), '主歌 1');assert.notEqual(sequence.current.id, target);
});
test('selecting the current occurrence stages a repeat; forward jumps do not mark skipped entries sung', () => {
  const sequence = new SingerSequence();
  sequence.cueRoute(sequence.current.id);
  assert.equal(sequence.current.id, 1);
  const repeat = sequence.nextSegment;
  sequence.advance();assert.equal(sequence.current.id, repeat.id);assert.equal(sequence.current.repeated, true);
  const future = sequence.route.find(item => item.song === 1);
  sequence.cueRoute(future.id);assert.notEqual(sequence.current.id, future.id);
  sequence.advance();assert.equal(sequence.current.id, future.id);
  const skipped = sequence.route.find(item => item.song === 0 && !item.visited);
  assert.ok(skipped);
  sequence.cueRoute(skipped.id);sequence.advance();assert.equal(nameOf(sequence.current), nameOf(skipped));
});
test('page cues distinguish repeat pages from segment repeats', () => {
  const sequence = new SingerSequence();sequence.advance();
  const id = sequence.current.id, length = sequence.route.length;
  sequence.cuePage(itemFor(0, '主歌1'), 0);
  assert.equal(sequence.nextPage.page, 0);sequence.advance();
  assert.equal(sequence.current.id, id);assert.equal(sequence.page, 0);assert.equal(sequence.route.length, length);
  sequence.cuePage(itemFor(0, '副歌'), 1);sequence.advance();
  assert.equal(nameOf(sequence.current), '副歌');assert.equal(sequence.page, 1);
});
test('arrangements can be edited during singing without replacing visited occurrences', () => {
  const sequence = new SingerSequence();sequence.advance();
  const visited = sequence.route.slice(0, sequence.cursor + 1).map(item => item.id);
  sequence.editPlan(0, '前奏-主歌1-副歌 × 2-尾奏');
  assert.deepEqual(sequence.route.slice(0, sequence.cursor + 1).map(item => item.id), visited);
  assert.deepEqual(sequence.route.slice(sequence.cursor + 1).filter(item => item.song === 0).map(nameOf), ['副歌','副歌','尾奏']);
  assert.equal(sequence.route.find(item => item.song === 1).utility, '前奏');
  assert.equal(sequence.route.at(-1).end, true);
  assert.throws(() => parsePlan(0, '不存在'));
  assert.throws(() => parsePlan(0, '副歌 × 33'));
  assert.equal(parsePlan(0, defaultPlans[0]).length, 16);
});
