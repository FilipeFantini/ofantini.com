import { desktop, initWindow, raiseWindow, toggleMax } from './windows';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const area = document.querySelector<HTMLElement>('.wins');
const task = document.querySelector<HTMLElement>('.task');
if (!area || !task) throw new Error('Desktop is missing its window area or taskbar');
type State = { id: string; stack: string[]; opener: HTMLElement | null; title: string };
const states = new WeakMap<HTMLElement, State>();
const cache = new Map<string, Promise<{ win: HTMLElement; title: string }>>();
let sequence = 0;
const defaultTitle = document.title;
const windows = () => [...area.querySelectorAll<HTMLElement>('.win:not(.closing)')];
const front = () => windows().sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
const pageLink = (a: HTMLAnchorElement) => a.origin === location.origin && !a.hash && !a.hasAttribute('download') && a.target !== '_blank';
const focusBody = (w: HTMLElement) => w.querySelector<HTMLElement>('.body')?.focus();

async function load(url: string): Promise<{ win: HTMLElement; title: string }> {
  if (!cache.has(url)) {
    const request = fetch(url).then(response => {
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      return response.text();
    }).then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const win = doc.querySelector<HTMLElement>('.win[data-url]');
      if (!win) throw new Error(`${url}: no window in page`);
      return { win, title: doc.title };
    });
    cache.set(url, request);
    request.catch(() => cache.delete(url));
  }
  const loaded = await cache.get(url)!;
  return { win: document.importNode(loaded.win, true), title: loaded.title };
}

function sync(mode: 'pushState' | 'replaceState' | null): void {
  const win = front();
  const url = win?.dataset.url || '/';
  const state = win ? states.get(win) : undefined;
  document.title = state?.title || defaultTitle;
  if (mode) history[mode]({ id: state?.id, url }, '', url);
  task.replaceChildren(...windows().map(w => {
    const link = document.createElement('a');
    link.href = w.dataset.url || '/';
    link.textContent = w.querySelector('.t')?.textContent || 'window';
    link.dataset.id = states.get(w)?.id || '';
    if (w === win) link.setAttribute('aria-current', 'page');
    return link;
  }));
}
function raise(win: HTMLElement, mode: 'pushState' | 'replaceState' | null = 'replaceState'): void {
  raiseWindow(win);
  sync(mode);
}
function adopt(win: HTMLElement, title: string, opener: HTMLElement | null, prior?: State): void {
  states.set(win, prior || { id: `w${++sequence}`, stack: [], opener, title });
  states.get(win)!.title = title;
  initWindow(win);
}
function place(win: HTMLElement, from: HTMLElement | null): void {
  const last = front(), step = 32;
  const width = Math.min(720, area.clientWidth - 200);
  const height = Math.min(480, area.clientHeight - 80);
  let x = last ? last.offsetLeft + step : 160;
  let y = last ? last.offsetTop + step : 24;
  area.append(win);
  win.style.width = `${width}px`;
  win.style.height = `${height}px`;
  if (x + width > area.clientWidth || y + height > area.clientHeight) {
    x = 160 + (sequence % 3) * step;
    y = 24 + (sequence % 3) * step;
  }
  x = Math.max(0, Math.min(x, area.clientWidth - width));
  y = Math.max(0, Math.min(y, area.clientHeight - height));
  win.style.left = `${x}px`; win.style.top = `${y}px`;
  if (from && !reduced.matches) {
    const origin = from.getBoundingClientRect(), box = win.getBoundingClientRect();
    win.style.setProperty('--fx', `${origin.left + origin.width / 2 - box.left - box.width / 2}px`);
    win.style.setProperty('--fy', `${origin.top + origin.height / 2 - box.top - box.height / 2}px`);
    win.classList.add('opening');
    win.addEventListener('animationend', () => win.classList.remove('opening'), { once: true });
  }
}
async function open(url: string, from: HTMLElement | null, mode: 'pushState' | 'replaceState' | null = 'pushState'): Promise<void> {
  const existing = windows().find(w => w.dataset.url === url);
  if (existing) { raise(existing, mode); focusBody(existing); return; }
  const { win, title } = await load(url);
  adopt(win, title, from);
  place(win, from);
  raise(win, mode);
  focusBody(win);
}
async function go(old: HTMLElement, url: string, push = true): Promise<void> {
  const { win, title } = await load(url);
  const state = states.get(old);
  if (!state) throw new Error('Window has no navigation state');
  if (push) state.stack.push(old.dataset.url || '/');
  win.style.cssText = old.style.cssText;
  win.classList.add(...[...old.classList].filter(name => name === 'maximized'));
  adopt(win, title, state.opener, state);
  old.replaceWith(win);
  raise(win, push ? 'pushState' : 'replaceState');
  focusBody(win);
}
function close(win: HTMLElement): void {
  const state = states.get(win);
  const done = () => {
    win.remove();
    sync('replaceState');
    (state?.opener?.isConnected ? state.opener : front()?.querySelector<HTMLElement>('.body'))?.focus();
  };
  if (reduced.matches) { done(); return; }
  win.classList.add('closing');
  win.addEventListener('animationend', done, { once: true });
}
function fail(url: string, error: unknown): void {
  console.error('desk: falling back to a full page load', error);
  location.assign(url);
}
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a');
  if (!anchor || !pageLink(anchor)) return;
  if (!desktop.matches) {
    if (anchor.matches('.back') && document.referrer.startsWith(location.origin) && history.length > 1) { event.preventDefault(); history.back(); }
    return;
  }
  const win = anchor.closest<HTMLElement>('.win');
  const url = anchor.pathname;
  event.preventDefault();
  if (win && anchor.matches('.close')) { close(win); return; }
  if (win && anchor.matches('.max')) { toggleMax(win); return; }
  if (win && anchor.matches('.back')) {
    const previous = states.get(win)?.stack.pop() || url;
    go(win, previous, false).catch(error => fail(previous, error)); return;
  }
  if (!win && anchor.closest('.task')) {
    const id = anchor.dataset.id;
    const target = windows().find(w => states.get(w)?.id === id);
    if (target) { raise(target, 'pushState'); focusBody(target); return; }
  }
  if (!win || anchor.matches('.home')) { open(url, anchor).catch(error => fail(url, error)); return; }
  go(win, url).catch(error => fail(url, error));
});
area.addEventListener('pointerdown', event => {
  const win = (event.target as Element).closest<HTMLElement>('.win');
  if (win && win !== front()) raise(win);
});
addEventListener('popstate', event => {
  if (!desktop.matches) { location.reload(); return; }
  const url = location.pathname;
  const win = windows().find(w => states.get(w)?.id === event.state?.id);
  (win ? (win.dataset.url === url ? Promise.resolve(raise(win, null)) : go(win, url, false)) : open(url, null, null))
    .catch(error => fail(url, error));
});
const first = area.querySelector<HTMLElement>('.win');
if (!first) throw new Error('No initial window');
adopt(first, document.title, null);
raiseWindow(first);
history.replaceState({ id: states.get(first)!.id, url: location.pathname }, '');
sync(null);
