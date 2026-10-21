import test from 'node:test';
import assert from 'node:assert/strict';
import {openingLines, compactPartName} from '../src/singer-preview.js';

test('opening lyrics keep the first two lines when the first page has more lines', () => {
  assert.deepEqual(openingLines(['first\nsecond\nthird', 'later']), ['first', 'second']);
  assert.deepEqual(openingLines(['first\nsecond', 'later'], 1), ['first']);
});

test('a one-line opening page borrows the first line from the next page', () => {
  assert.deepEqual(openingLines(['first', 'second\nthird']), ['first', 'second']);
  assert.deepEqual(openingLines(['first']), ['first']);
  assert.deepEqual(openingLines(['first\r\n\r\n', 'second\r\nthird']), ['first', 'second']);
});

test('display names remove spaces without changing the score identifiers', () => {
  assert.equal(compactPartName('主歌 1'), '主歌1');
  assert.equal(compactPartName('副歌 2'), '副歌2');
  assert.equal(compactPartName('前副歌'), '前副歌');
});
