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
  'data-mx-spoiler', // spoiler / content warning
  'data-mx-emoticon', // MSC2545 custom emoticon marker
  'role', // mention-pill button semantics
  'tabindex', // mention-pill keyboard focus
  'src', // img source
  'alt', // img alt text
  'width', // img width
  'height', // img height
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

const CACHE_LIMIT = 2000;
const cache = new Map<string, string>();

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

  // Sanitize, then prettify links, then convert matrix.to <a> tags to pill spans
  const sanitized = DOMPurify.sanitize(raw, PURIFY_CONFIG) as string;
  let result = prettifyLinks ? prettifyAnchors(sanitized) : sanitized;
  const final = renderPills ? applyMentionPills(result, myUserId) : result;

  if (cache.size >= CACHE_LIMIT) {
    // Evict the least recently used entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, final);
  return final;
}
