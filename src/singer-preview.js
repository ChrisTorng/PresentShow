// Stable opening lines identify a part even while its playback page advances.
export function openingLines(pages, count = 2) {
  return pages.flatMap(page => page.split(/\r?\n/)).filter(line => line.trim()).slice(0, count);
}

export function compactPartName(name) {
  return name.replace(/\s+/g, '');
}
