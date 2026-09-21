import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

// Set before each parse call to pass current user context into the renderer.
let currentMyUserId: string | null = null;

function prettifyUrl(href: string): string | null {
  try {
    const url = new URL(href);
    let hostname = url.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    const parts = hostname.split('.');
    if (parts.length > 2) {
      const tld = parts[parts.length - 1];
      const isCcTld = tld.length <= 2;
      const keep = isCcTld && parts.length > 3 ? 3 : 2;
      hostname = parts.slice(-keep).join('.');
    }
    return hostname;
  } catch {
    return null;
  }
}

const renderer = new Renderer();

// Detect matrix.to user mention links and render as pill spans.
// All other links get the standard safe anchor treatment.
renderer.link = ({ href, title, tokens }) => {
  const text = tokens.map((t) => ('text' in t ? t.text : '')).join('');
  const safeHref = href ?? '';

  if (safeHref.startsWith('https://matrix.to/#/@')) {
    const userId = safeHref.slice('https://matrix.to/#/'.length);
    const displayName = text.startsWith('@') ? text : `@${text}`;
    const isSelf = currentMyUserId && userId === currentMyUserId;
    const pillClass = isSelf ? 'mention-pill mention-pill-self' : 'mention-pill';
    return `<span class="${pillClass}" data-user-id="${userId}" role="button" tabindex="0">${displayName}</span>`;
  }

  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

marked.use({
  renderer,
  breaks: true,
  gfm: true,
  pedantic: false,
});

const ALLOWED_TAGS = [
  'strong',
  'b', // bold
  'em',
  'i', // italic
  'del',
  's', // strikethrough
  'code',
  'pre', // inline / block code
  'blockquote', // quote
  'ol',
  'ul',
  'li', // lists
  'a', // links
  'br',
  'p', // line breaks / paragraphs
  'span', // mention pills
  'img', // inline images (custom emoji, etc.)
];

const ALLOWED_ATTR = [
  'href', // links
  'title', // tooltip
  'target', // _blank
  'rel', // noopener noreferrer
  'class', // mention-pill class
  'data-user-id', // mention user ID
  'data-room-mention', // room mention marker
  'data-mx-spoiler', // spoiler / content warning
  'data-mx-emoticon', // MSC2545 custom emoticon marker
  'role', // mention-pill button semantics
  'tabindex', // mention-pill keyboard focus
  'src', // img source
  'alt', // img alt text
  'width', // img width
  'height', // img height
  'start', // ol start
  'type', // ol list style type
];

const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // Kill javascript: / data: / vbscript: URLs
  ALLOW_UNKNOWN_PROTOCOLS: true,
  // Allow data-* on our mention spans (data-user-id)
  ALLOW_DATA_ATTR: true,
  // Keep text content of stripped tags (don't delete the words, just the tags)
  KEEP_CONTENT: true,
  // Force all <a> targets to _blank and add rel safety
  ADD_ATTR: ['target'],
};

// Force every link to open in new tab after sanitization
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') ?? '';
    if (
      src &&
      !src.startsWith('http://') &&
      !src.startsWith('https://') &&
      !src.startsWith('mxc://')
    ) {
      node.removeAttribute('src');
    }
  }
});

function applyMentionPills(html: string, myUserId?: string): string {
  if (!html.includes('matrix.to/#/@')) return html;

  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  tmp.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (!href.startsWith('https://matrix.to/#/@')) return;

    const userId = href.slice('https://matrix.to/#/'.length);
    const displayName = a.textContent ?? userId;
    const label = displayName.startsWith('@') ? displayName : `@${displayName}`;
    const isSelf = myUserId && userId === myUserId;

    const span = document.createElement('span');
    span.className = isSelf ? 'mention-pill mention-pill-self' : 'mention-pill';
    span.setAttribute('data-user-id', userId);
    span.setAttribute('role', 'button');
    span.setAttribute('tabindex', '0');
    span.textContent = label;
    a.replaceWith(span);
  });

  return tmp.innerHTML;
}

function prettifyAnchors(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  tmp.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    // Skip mention-pill links (already handled by applyMentionPills)
    if (href.startsWith('https://matrix.to/#/@')) return;

    const pretty = prettifyUrl(href);
    if (!pretty || pretty === a.textContent) return;

    const fullText = a.textContent ?? href;
    const prettySpan = document.createElement('span');
    prettySpan.className = 'pretty-text';
    prettySpan.textContent = pretty;
    const fullSpan = document.createElement('span');
    fullSpan.className = 'full-text';
    fullSpan.textContent = fullText;

    a.textContent = '';
    a.appendChild(prettySpan);
    a.appendChild(fullSpan);
    a.classList.add('prettified-link');
  });

  return tmp.innerHTML;
}

function highlightRoomMentions(html: string): string {
  if (!/@(room|everyone|all)/i.test(html)) return html;

  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  // Only highlight room mentions that aren't inside links, code spans, or
  // already-pillified mention/room spans.
  const re = /(^|[\s(])@(room|everyone|all)(?=[\s).,!?;:]|$)/gi;
  const walker = tmp.ownerDocument.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
  const pending: { textNode: Text; parts: Array<string | Node> }[] = [];

  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    const skip = parent && parent.closest('code, pre, a, .mention-pill, .room-mention-pill');
    if (!skip && textNode.data) {
      const parts: Array<string | Node> = [];
      let lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(textNode.data)) !== null) {
        if (m.index > lastIndex) parts.push(textNode.data.slice(lastIndex, m.index));
        if (m[1]) parts.push(m[1]);
        const span = tmp.ownerDocument.createElement('span');
        span.className = 'room-mention';
        span.textContent = m[0].slice(m[1].length);
        parts.push(span);
        lastIndex = m.index + m[0].length;
      }
      if (parts.length > 0) {
        if (lastIndex < textNode.data.length) parts.push(textNode.data.slice(lastIndex));
        pending.push({ textNode, parts });
      }
    }
    node = walker.nextNode();
  }

  for (const { textNode, parts } of pending) {
    const frag = tmp.ownerDocument.createDocumentFragment();
    for (const part of parts) {
      frag.append(typeof part === 'string' ? tmp.ownerDocument.createTextNode(part) : part);
    }
    textNode.replaceWith(frag);
  }

  return tmp.innerHTML;
}

const URL_RE = /https?:\/\/[^\s<>"')]+/g;

function autoLinkUrls(html: string): string {
  if (!html.includes('://')) return html;

  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const walker = tmp.ownerDocument.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
  const pending: { textNode: Text; parts: Array<string | Node> }[] = [];

  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    const skip = parent && parent.closest('a, code, pre');
    if (!skip && textNode.data && URL_RE.test(textNode.data)) {
      URL_RE.lastIndex = 0;
      const parts: Array<string | Node> = [];
      let lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = URL_RE.exec(textNode.data)) !== null) {
        if (m.index > lastIndex) parts.push(textNode.data.slice(lastIndex, m.index));
        const a = tmp.ownerDocument.createElement('a');
        a.href = m[0];
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = m[0];
        parts.push(a);
        lastIndex = m.index + m[0].length;
      }
      if (parts.length > 0) {
        if (lastIndex < textNode.data.length) parts.push(textNode.data.slice(lastIndex));
        pending.push({ textNode, parts });
      }
    }
    node = walker.nextNode();
  }

  for (const { textNode, parts } of pending) {
    const frag = tmp.ownerDocument.createDocumentFragment();
    for (const part of parts) {
      frag.append(typeof part === 'string' ? tmp.ownerDocument.createTextNode(part) : part);
    }
    textNode.replaceWith(frag);
  }

  return tmp.innerHTML;
}

const CACHE_LIMIT = 2000;
const cache = new Map<string, string>();

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSingleEmptyListItem(el: Element): boolean {
  if (el.tagName !== 'OL' && el.tagName !== 'UL') return false;
  if (el.children.length !== 1 || el.children[0].tagName !== 'LI') return false;
  const li = el.children[0];
  return li.children.length === 0 && (li.textContent ?? '').trim() === '';
}

function isPlainTextOnly(html: string): boolean {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const nodes = Array.from(tmp.children);
  if (nodes.length === 0) return false;

  for (const node of nodes) {
    if (node.tagName === 'OL' || node.tagName === 'UL') {
      if (!isSingleEmptyListItem(node)) return false;
      continue;
    }
    if (node.tagName !== 'P') return false;
    const hasNonBreak = Array.from(node.querySelectorAll('*')).some(
      (child) => child.tagName !== 'BR'
    );
    if (hasNonBreak) return false;
  }
  return true;
}

function cacheKey(
  markdown: string,
  myUserId: string | undefined,
  renderPills: boolean,
  prettifyLinks: boolean,
  alreadyHtml: boolean
): string {
  return (
    (renderPills ? '1' : '0') +
    (prettifyLinks ? '1' : '0') +
    (alreadyHtml ? '1' : '0') +
    '|' +
    (myUserId ?? '') +
    '\n' +
    markdown
  );
}

export function markdownToHtml(
  markdown: string,
  myUserId?: string,
  renderPills = true,
  prettifyLinks = false,
  alreadyHtml = false
): string {
  if (!markdown) return '';

  const key = cacheKey(markdown, myUserId, renderPills, prettifyLinks, alreadyHtml);
  const cached = cache.get(key);
  if (cached !== undefined) {
    // Refresh LRU ordering.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  // Thread myUserId into the marked link renderer (handles markdown-style links)
  currentMyUserId = myUserId ?? null;
  const raw = alreadyHtml ? markdown : (marked.parse(markdown) as string);
  currentMyUserId = null;

  let final: string;
  if (!alreadyHtml && markdown.trim() && isPlainTextOnly(raw)) {
    final = escapeHtmlText(markdown).replace(/\n/g, '<br>');
  } else {
    // Sanitize, auto-link bare URLs, prettify links, then convert matrix.to <a> tags to pill spans
    const sanitized = DOMPurify.sanitize(raw, PURIFY_CONFIG) as string;
    const linked = autoLinkUrls(sanitized);
    let result = prettifyLinks ? prettifyAnchors(linked) : linked;
    const pillified = renderPills ? applyMentionPills(result, myUserId) : result;
    final = highlightRoomMentions(pillified);
  }

  if (cache.size >= CACHE_LIMIT) {
    // Evict the least recently used entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, final);
  return final;
}
