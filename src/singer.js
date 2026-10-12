// UI-only prototype. No connection to the projection controller or remote devices.
const songs = [
  { title: '高聲唱', sections: [
    { name: '主歌 1', kind: 'verse', lyrics: '高舉祢  主祢在這裡\n在讚美中被高舉' },
    { name: '前副歌', kind: 'prechorus', lyrics: '我能夠遇見祢即將成就一切\n祢改變環境當我們高聲讚美' },
    { name: '副歌', kind: 'chorus', lyrics: '高聲唱  讚美嘹亮\n超越各方  所有的聲響' },
    { name: '主歌 2', kind: 'verse', lyrics: '我讚美  就經歷改變\n當祢的同在降臨' },
    { name: '小副歌', kind: 'tag', lyrics: '讚美升起  恩雨降臨 X4' },
  ] },
  { title: '我渴望宣揚', sections: [
    { name: '主歌', kind: 'verse', lyrics: '祢已呼召我生命\n為要成為神國度裡的器皿' },
    { name: '前副歌', kind: 'prechorus', lyrics: '我渴望宣揚\n直到世界都能聽見' },
    { name: '副歌', kind: 'chorus', lyrics: '使用我生命\n毫無保留全都給祢' },
  ] },
  { title: '永不熄滅', sections: [
    { name: '主歌 1', kind: 'verse', lyrics: '祢彰顯 呼召祢的百姓\n來建造 屬於祢的教會' },
    { name: '主歌 2', kind: 'verse', lyrics: '這火焰 祢說不可熄滅\n願成為 活祭為祢分別' },
    { name: '副歌 1', kind: 'chorus', lyrics: '主引領我 甘心與祢退到曠野\n安靜地 降伏於祢' },
    { name: '副歌 2', kind: 'chorus', lyrics: '主教導我 照祢旨意為祢而活\n帶下祢國度 在地如在天' },
  ] },
];
const utilities = ['前奏', '間奏', '變奏', '尾句', '尾奏'];
const duration = 5000;
const $ = id => document.getElementById(id);
let viewedSong = 0;
let current = { song: 0, section: 0 };
let queued = { song: 0, section: 1, source: 'computer' };
let history = [];
let paused = false;
let remaining = duration;
let previousTick = performance.now();
let historyPage = 0;

function nameOf(item) {
  if (!item) return '—';
  if (item.end) return '結束';
  return item.utility || songs[item.song].sections[item.section].name;
}
function displayName(item) {
  if (!item || item.end || item.song === viewedSong) return nameOf(item);
  return `${String(item.song + 1).padStart(2, '0')} · ${nameOf(item)}`;
}
function sameItem(a, b) {
  return !!a && !!b && a.song === b.song && a.section === b.section && a.utility === b.utility && !!a.end === !!b.end;
}
function nextFor(item) {
  if (!item || item.end) return null;
  if (item.utility) return { song: item.song, section: item.returnSection ?? 0, source: 'auto' };
  if (item.section + 1 < songs[item.song].sections.length) return { song: item.song, section: item.section + 1, source: 'auto' };
  if (item.song + 1 < songs.length) return { song: item.song + 1, section: 0, source: 'auto' };
  return { end: true, source: 'auto' };
}
function announce(message) { $('announcement').textContent = message; }
function cue(item, source = 'singer') {
  if (source === 'computer' && queued?.source === 'singer') {
    $('computer-feedback').textContent = '主唱已預備下一段，保留主唱的選擇。';
    return;
  }
  queued = { ...item, source };
  if (current.end) {
    remaining = duration;
    previousTick = performance.now();
  }
  $('computer-feedback').textContent = source === 'singer' ? '已依主唱更新預備段落。' : '電腦的預選已顯示在主唱介面。';
  announce(`已預備${nameOf(queued)}，${paused ? '模擬暫停中' : '倒數結束才會切換'}。`);
  render();
}
function takeQueued() {
  if (!queued) return;
  const followCurrentSong = viewedSong === current.song;
  history.push({ ...current });
  current = { ...queued };
  queued = nextFor(current);
  remaining = duration;
  if (followCurrentSong && !current.end) viewedSong = current.song;
  announce(`目前播放${nameOf(current)}。`);
  render();
}
function browse(song) {
  viewedSong = Math.max(0, Math.min(songs.length - 1, song));
  render();
}
function buttonState(button, item) {
  const isCurrent = sameItem(current, item);
  const isQueued = sameItem(queued, item);
  button.classList.toggle('current', isCurrent);
  button.classList.toggle('queued', isQueued);
  button.setAttribute('aria-pressed', String(isQueued));
  if (isCurrent) button.setAttribute('aria-current', 'true');
  else button.removeAttribute('aria-current');
  return isCurrent && isQueued ? '播放中 · 已預備' : isCurrent ? '播放中' : isQueued ? '已預備' : '';
}
function makeSection(section, index) {
  const button = document.createElement('button');
  button.className = `section-button ${section.kind}`;
  button.dataset.section = index;
  const name = document.createElement('span');
  name.className = 'section-name';
  const title = document.createElement('strong');
  title.textContent = section.name;
  const status = document.createElement('small');
  status.textContent = buttonState(button, { song: viewedSong, section: index });
  name.append(title, status);
  const lyrics = document.createElement('span');
  lyrics.className = 'section-lyrics';
  lyrics.textContent = section.lyrics;
  button.append(name, lyrics);
  button.setAttribute('aria-label', `預備${section.name}。${section.lyrics}`);
  return button;
}
function renderHistory() {
  $('history-count').textContent = `已唱 ${history.length} 段`;
  const container = $('history-past');
  container.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('span');
    empty.className = 'history-empty';
    empty.textContent = '已唱過的段落會依序留在這裡';
    container.append(empty);
  } else {
    let visible = Math.min(4, history.length);
    // Keep the latest path in the viewport; older records remain in a paged dialog.
    const fill = () => {
      container.replaceChildren();
      if (visible < history.length) {
        const more = document.createElement('button');
        more.className = 'history-more';
        more.textContent = `＋${history.length - visible}`;
        more.setAttribute('aria-label', `查看全部 ${history.length} 段演唱紀錄`);
        more.addEventListener('click', () => { historyPage = 0; renderHistoryDialog(); $('history-dialog').showModal(); });
        container.append(more);
      }
      history.slice(-visible).forEach((item, index) => {
        if (index > 0) {
          const arrow = document.createElement('span');
          arrow.className = 'past-arrow';
          arrow.textContent = '›';
          arrow.setAttribute('aria-hidden', 'true');
          container.append(arrow);
        }
        const tag = document.createElement('span');
        tag.className = 'past-item';
        tag.textContent = nameOf(item);
        tag.title = item.end ? '結束' : `${songs[item.song].title} · ${nameOf(item)}`;
        container.append(tag);
      });
    };
    fill();
    while (visible > 1 && container.scrollWidth > container.clientWidth) { visible--; fill(); }
  }
  for (const [id, item] of [['history-current', current], ['history-queued', queued]]) {
    $(id).textContent = displayName(item);
    $(id).classList.toggle('cross-song', !!item && !item.end && item.song !== viewedSong);
  }
  if ($('history-dialog').open) renderHistoryDialog();
}
function renderHistoryDialog() {
  const pageSize = 6;
  const pages = Math.max(1, Math.ceil(history.length / pageSize));
  historyPage = Math.min(historyPage, pages - 1);
  $('history-list').replaceChildren();
  $('history-list').start = historyPage * pageSize + 1;
  history.slice(historyPage * pageSize, (historyPage + 1) * pageSize).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.end ? '結束' : `${songs[item.song].title} · ${nameOf(item)}`;
    $('history-list').append(li);
  });
  $('history-page').textContent = `${historyPage + 1} / ${pages}`;
  $('history-previous').disabled = historyPage === 0;
  $('history-next').disabled = historyPage === pages - 1;
}
function render() {
  const focused = document.activeElement;
  const focusedSection = focused?.closest('.section-button')?.dataset.section;
  const focusedTab = focused?.closest('.song-tab')?.dataset.song;
  $('song-title').textContent = songs[viewedSong].title;
  $('song-number').textContent = `${String(viewedSong + 1).padStart(2, '0')} / 03`;
  $('previous-song').disabled = viewedSong === 0;
  $('next-song').disabled = viewedSong === songs.length - 1;
  $('song-tabs').replaceChildren(...songs.map((song, index) => {
    const button = document.createElement('button');
    button.className = `song-tab${index === viewedSong ? ' viewing' : ''}`;
    button.dataset.song = index;
    button.setAttribute('aria-pressed', String(index === viewedSong));
    button.setAttribute('aria-label', `瀏覽${song.title}，不切換播放`);
    const number = document.createElement('span');
    number.className = 'tab-number';
    number.textContent = String(index + 1).padStart(2, '0');
    button.append(number, document.createTextNode(song.title));
    for (const [item, kind] of [[current, 'current'], [queued, 'queued']]) {
      if (!item?.end && item?.song === index) {
        const dot = document.createElement('span');
        dot.className = `tab-dot ${kind}`;
        dot.setAttribute('aria-hidden', 'true');
        button.append(dot);
      }
    }
    return button;
  }));
  $('current-section').textContent = displayName(current);
  $('queued-section').textContent = displayName(queued);
  $('current-section').classList.toggle('cross-song', !current.end && current.song !== viewedSong);
  $('queued-section').classList.toggle('cross-song', !!queued && !queued.end && queued.song !== viewedSong);
  $('current-song-short').textContent = !current.end && current.song !== viewedSong ? `第 ${current.song + 1} 首` : '';
  $('cue-source').textContent = queued?.source === 'singer' ? '主唱' : queued?.source === 'computer' ? '電腦' : queued ? '順序' : '';
  $('cancel-cue').hidden = queued?.source !== 'singer';
  $('browse-hint').textContent = !current.end && current.song !== viewedSong ? '瀏覽其他歌曲 · 點段落才預備' : '點段落預備 · 不會立即切換';
  $('sections').style.setProperty('--section-count', songs[viewedSong].sections.length);
  $('sections').dataset.count = songs[viewedSong].sections.length;
  $('sections').replaceChildren(...songs[viewedSong].sections.map(makeSection));
  for (const button of $('utility-buttons').children) buttonState(button, { song: viewedSong, utility: button.dataset.utility });
  const nextSong = viewedSong + 1;
  $('cue-next-song').disabled = nextSong >= songs.length;
  $('next-song-name').textContent = nextSong < songs.length ? songs[nextSong].title : '已是最後一首';
  buttonState($('cue-next-song'), { song: nextSong, section: 0 });
  buttonState($('cue-end'), { end: true });
  renderHistory();
  renderCountdown();
  if (focusedSection !== undefined) $('sections').querySelector(`[data-section="${focusedSection}"]`)?.focus({ preventScroll: true });
  if (focusedTab !== undefined) $('song-tabs').querySelector(`[data-song="${focusedTab}"]`)?.focus({ preventScroll: true });
}
function renderCountdown() {
  $('countdown').textContent = queued ? `${Math.ceil(remaining / 1000)}s` : '—';
  $('simulation-label').textContent = paused ? '已暫停' : '模擬';
  $('simulation-icon').textContent = paused ? '▶' : 'Ⅱ';
  $('simulation').classList.toggle('paused', paused);
  $('simulation').setAttribute('aria-label', paused ? '繼續五秒播放模擬' : '暫停五秒播放模擬');
  $('simulation').setAttribute('aria-pressed', String(paused));
  $('cue-progress').style.transform = `scaleX(${queued ? remaining / duration : 0})`;
}
function renderComputerSections() {
  const song = Number($('computer-song').value);
  $('computer-section').replaceChildren(...songs[song].sections.map((section, index) => new Option(section.name, String(index))));
}

$('song-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-song]');
  if (button) browse(Number(button.dataset.song));
});
$('sections').addEventListener('click', event => {
  const button = event.target.closest('[data-section]');
  if (button) cue({ song: viewedSong, section: Number(button.dataset.section) });
});
utilities.forEach(utility => {
  const button = document.createElement('button');
  button.className = 'utility-button';
  button.dataset.utility = utility;
  button.textContent = utility;
  button.setAttribute('aria-label', `預備${utility}`);
  button.addEventListener('click', () => cue({ song: viewedSong, utility, returnSection: current.song === viewedSong ? current.section ?? current.returnSection ?? 0 : 0 }));
  $('utility-buttons').append(button);
});
$('previous-song').addEventListener('click', () => browse(viewedSong - 1));
$('next-song').addEventListener('click', () => browse(viewedSong + 1));
$('cue-next-song').addEventListener('click', () => { if (viewedSong + 1 < songs.length) cue({ song: viewedSong + 1, section: 0 }); });
$('cue-end').addEventListener('click', () => cue({ end: true }));
$('cancel-cue').addEventListener('click', () => { queued = nextFor(current); announce('已取消主唱預備，恢復順序播放。'); render(); });
$('simulation').addEventListener('click', () => { paused = !paused; previousTick = performance.now(); renderCountdown(); });
$('computer-song').replaceChildren(...songs.map((song, index) => new Option(`${index + 1}. ${song.title}`, String(index))));
$('computer-song').addEventListener('change', renderComputerSections);
$('computer-cue').addEventListener('click', () => cue({ song: Number($('computer-song').value), section: Number($('computer-section').value) }, 'computer'));
$('reset-demo').addEventListener('click', () => {
  viewedSong = 0;
  current = { song: 0, section: 0 };
  queued = { song: 0, section: 1, source: 'computer' };
  history = [];
  remaining = duration;
  paused = false;
  previousTick = performance.now();
  $('computer-feedback').textContent = '主唱預備後，優先依主唱的選擇。';
  render();
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else announce('此瀏覽器可將網頁加入主畫面，以全螢幕開啟。');
  } catch { announce('可以使用瀏覽器的全螢幕，或將網頁加入主畫面。'); }
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全螢幕' : '進入全螢幕');
});
$('close-history').addEventListener('click', () => $('history-dialog').close());
$('history-previous').addEventListener('click', () => { historyPage--; renderHistoryDialog(); });
$('history-next').addEventListener('click', () => { historyPage++; renderHistoryDialog(); });
new ResizeObserver(renderHistory).observe($('history-past'));
// Background tabs freeze the demo instead of racing through unseen sections.
document.addEventListener('visibilitychange', () => { previousTick = performance.now(); });
setInterval(() => {
  const now = performance.now();
  const elapsed = now - previousTick;
  previousTick = now;
  if (paused || document.hidden || !queued) return;
  remaining = Math.max(0, remaining - elapsed);
  if (remaining === 0) takeQueued();
  else renderCountdown();
}, 100);
renderComputerSections();
render();
