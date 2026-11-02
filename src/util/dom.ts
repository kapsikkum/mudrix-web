export type ScrollInfo = {
  offsetTop: number;
  top: number;
  height: number;
  viewHeight: number;
  scrollable: boolean;
};

export const getScrollInfo = (target: HTMLElement): ScrollInfo => ({
  offsetTop: Math.round(target.offsetTop),
  top: Math.round(target.scrollTop),
  height: Math.round(target.scrollHeight),
  viewHeight: Math.round(target.clientHeight),
  scrollable: target.scrollHeight > target.clientHeight,
});

export const scrollToBottom = (scrollEl: HTMLElement, behavior?: 'auto' | 'instant' | 'smooth') => {
  scrollEl.scrollTo({
    top: Math.round(scrollEl.scrollHeight - scrollEl.clientHeight),
    behavior,
  });
};

export const isIntersectingScrollView = (
  scrollElement: HTMLElement,
  childElement: HTMLElement
): boolean => {
  const scrollRect = scrollElement.getBoundingClientRect();
  const childRect = childElement.getBoundingClientRect();

  return childRect.bottom > scrollRect.top && childRect.top < scrollRect.bottom;
};

export const isInScrollView = (scrollElement: HTMLElement, childElement: HTMLElement): boolean => {
  const scrollRect = scrollElement.getBoundingClientRect();
  const childRect = childElement.getBoundingClientRect();

  return childRect.top >= scrollRect.top && childRect.bottom <= scrollRect.bottom;
};

export const canFitInScrollView = (
  scrollElement: HTMLElement,
  childElement: HTMLElement
): boolean => childElement.offsetHeight <= scrollElement.clientHeight;
