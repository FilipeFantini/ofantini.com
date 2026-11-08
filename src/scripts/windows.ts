export const desktop = matchMedia('(min-width: 701px) and (min-height: 560px)');
let topLayer = 10;
const MIN_W = 300, MIN_H = 160;

export function toggleMax(win: HTMLElement): void {
  const max = win.classList.toggle('maximized');
  const button = win.querySelector<HTMLAnchorElement>('.max');
  const title = win.querySelector<HTMLElement>('.t')?.textContent?.trim() || 'window';
  button?.setAttribute('aria-label', `${max ? 'Restore' : 'Maximize'} ${title}`);
}

export function raiseWindow(win: HTMLElement): void {
  win.style.zIndex = String(++topLayer);
}

export function initWindow(win: HTMLElement): void {
  if (win.dataset.init) return;
  win.dataset.init = '1';
  const bar = win.querySelector<HTMLElement>('.bar');
  if (!bar) throw new Error('Window is missing its title bar');
  const grip = document.createElement('span');
  grip.className = 'grip';
  grip.setAttribute('aria-hidden', 'true');
  win.append(grip);
  win.addEventListener('pointerdown', () => raiseWindow(win));
  bar.addEventListener('dblclick', event => {
    if (desktop.matches && !(event.target as Element).closest('a')) toggleMax(win);
  });
  function track(handle: HTMLElement, resizing: boolean): void {
    let start: { x: number; y: number; left: number; top: number; width: number; height: number } | undefined;
    handle.addEventListener('pointerdown', event => {
      if (!desktop.matches || event.pointerType === 'touch' || event.button !== 0 || win.classList.contains('maximized') || (event.target as Element).closest('a')) return;
      const parent = win.parentElement;
      if (!parent) return;
      const rect = win.getBoundingClientRect();
      const box = parent.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, left: rect.left - box.left, top: rect.top - box.top, width: rect.width, height: rect.height };
      win.style.left = `${start.left}px`; win.style.top = `${start.top}px`;
      win.style.width = `${start.width}px`; win.style.height = `${start.height}px`;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
      if (!start || !handle.hasPointerCapture(event.pointerId)) return;
      const parent = win.parentElement;
      if (!parent) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (resizing) {
        win.style.width = `${Math.min(Math.max(MIN_W, start.width + dx), parent.clientWidth - start.left)}px`;
        win.style.height = `${Math.min(Math.max(MIN_H, start.height + dy), parent.clientHeight - start.top)}px`;
      } else {
        win.style.left = `${Math.min(Math.max(start.left + dx, 0), parent.clientWidth - start.width)}px`;
        win.style.top = `${Math.min(Math.max(start.top + dy, 0), parent.clientHeight - start.height)}px`;
      }
    });
    const clear = () => { start = undefined; };
    handle.addEventListener('pointerup', clear);
    handle.addEventListener('pointercancel', clear);
  }
  track(bar, false);
  track(grip, true);
  desktop.addEventListener('change', () => {
    win.classList.remove('maximized');
    win.removeAttribute('style');
  });
}
