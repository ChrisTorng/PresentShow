import {songs, utilities, defaultPlans} from './singer-data.js';

export function itemFor(song, name, catalog = songs) {
  const normalized = name.replaceAll(' ', '');
  const section = catalog[song].sections.findIndex(section => section.name.replaceAll(' ', '') === normalized);
  if (section >= 0) return {song, section};
  if (utilities.includes(normalized)) return {song, utility:normalized};
  throw new Error(`「${catalog[song].title}」沒有段落「${name}」。`);
}
export function parsePlan(song, text, catalog = songs) {
  const parts = text.split(/[-→\n,，]+/).map(part => part.trim()).filter(Boolean);
  if (!parts.length) throw new Error('請至少安排一個段落。');
  return parts.flatMap(part => {
    const match = /^(.*?)(?:\s*[×*]\s*(\d+))?$/.exec(part);
    const count = Number(match[2] || 1);
    if (count < 1 || count > 32) throw new Error('重複次數需介於 1 到 32。');
    const item = itemFor(song, match[1].trim(), catalog);
    return Array.from({length:count}, () => ({...item}));
  });
}
export function samePart(a, b) {
  return !!a && !!b && a.song === b.song && a.section === b.section && a.utility === b.utility && !!a.end === !!b.end;
}
export function nameOf(item, catalog = songs) {
  if (!item) return '—';
  return item.end ? '結束' : item.utility || catalog[item.song].sections[item.section].name;
}
export function kindOf(item, catalog = songs) {
  return !item || item.end ? 'ending' : item.utility ? 'instrumental' : catalog[item.song].sections[item.section].kind;
}
export function pagesOf(item, catalog = songs) {
  if (!item || item.end) return ['演唱結束'];
  if (item.utility === '尾句') return [catalog[item.song].sections.at(-1).pages.at(-1)];
  return item.utility ? [item.utility] : catalog[item.song].sections[item.section].pages;
}

export class SingerSequence {
  constructor(plans = defaultPlans, catalog = songs) {
    this.catalog = catalog;
    this.serial = 0;
    this.plans = [...plans];
    this.route = plans.flatMap((plan, song) => parsePlan(song, plan, catalog).map(item => this.entry(item)));
    this.route.push(this.entry({song:catalog.length - 1, end:true}));
    this.cursor = 0;
    this.page = 0;
    this.route[0].visited = true;
    this.cue = null;
    this.staged = [];
  }
  entry(item) { return {...item, id:++this.serial, visited:false}; }
  get current() { return this.route[this.cursor]; }
  get nextSegment() {
    return this.cue && this.cue.type !== 'page' ? this.route.find(item => item.id === this.cue.id) : this.route[this.cursor + 1] || null;
  }
  get nextPage() {
    if (this.cue) return {item:this.route.find(item => item.id === this.cue.id), page:this.cue.page || 0};
    if (this.page + 1 < pagesOf(this.current, this.catalog).length) return {item:this.current, page:this.page + 1};
    return this.nextSegment ? {item:this.nextSegment, page:0} : null;
  }
  clearCue() {
    const currentId = this.current.id;
    this.route = this.route.filter(item => !this.staged.includes(item.id));
    this.cursor = this.route.findIndex(item => item.id === currentId);
    this.staged = [];
    this.cue = null;
  }
  cueSection(item, page = 0) {
    this.clearCue();
    let next = this.route[this.cursor + 1];
    if (samePart(next, item) && page === 0) return;
    if (!samePart(next, item)) {
      next = this.entry({...item, inserted:true});
      this.route.splice(this.cursor + 1, 0, next);
      this.staged = [next.id];
    }
    this.cue = {type:'section', id:next.id, page};
  }
  cuePage(item, page) {
    if (!samePart(item, this.current)) { this.cueSection(item, page);return; }
    this.clearCue();
    this.cue = {type:'page', id:this.current.id, page};
  }
  cueRoute(id) {
    if (this.cue?.id === id) return;
    const target = this.route.find(item => item.id === id);
    if (!target) return;
    this.clearCue();
    const index = this.route.findIndex(item => item.id === id);
    if (index < 0) return;
    if (index <= this.cursor) {
      // Repeat the actual path from the selected occurrence through the current one.
      const copies = this.route.slice(index, this.cursor + 1).filter(item => item.visited || item.id === target.id).map(item => this.entry({...item, repeated:true}));
      this.route.splice(this.cursor + 1, 0, ...copies);
      this.staged = copies.map(item => item.id);
      this.cue = {type:'jump', id:copies[0].id, page:0};
    } else this.cue = {type:'jump', id, page:0};
  }
  advance() {
    const next = this.nextPage;
    if (!next?.item) return false;
    this.cursor = this.route.findIndex(item => item.id === next.item.id);
    this.page = next.page;
    this.current.visited = true;
    this.cue = null;
    this.staged = [];
    return true;
  }
  editPlan(song, text) {
    const items = parsePlan(song, text, this.catalog);
    this.clearCue();
    let remaining = items;
    if (this.current.song === song) {
      const occurrence = this.route.slice(0, this.cursor + 1).filter(item => item.visited && samePart(item, this.current)).length;
      const matches = items.map((item, index) => samePart(item, this.current) ? index : -1).filter(index => index >= 0);
      const at = matches[Math.min(occurrence - 1, matches.length - 1)];
      if (at !== undefined) remaining = items.slice(at + 1);
    }
    const future = this.route.slice(this.cursor + 1);
    let at = future.findIndex(item => item.song === song && !item.end);
    if (at < 0) at = future.findIndex(item => item.end || item.song > song);
    if (at < 0) at = future.length;
    const before = future.slice(0, at).filter(item => item.song !== song || item.end);
    const after = future.slice(at).filter(item => item.song !== song || item.end);
    this.route = [...this.route.slice(0, this.cursor + 1), ...before, ...remaining.map(item => this.entry(item)), ...after];
    this.plans[song] = text;
  }
}
