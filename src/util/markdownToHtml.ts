import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

// Set before each parse call to pass current user context into the renderer.
let currentMyUserId: string | null = null;

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
    return `<span class="${pillClass}" data-user-id="${userId}">${displayName}</span>`;
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
];

const ALLOWED_ATTR = [
  'href', // links
  'title', // tooltip
  'target', // _blank
  'rel', // noopener noreferrer
  'class', // mention-pill class
  'data-user-id', // mention user ID
];

const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // Kill javascript: / data: / vbscript: URLs
  ALLOW_UNKNOWN_PROTOCOLS: false,
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
    span.textContent = label;
    a.replaceWith(span);
  });

  return tmp.innerHTML;
}

export function markdownToHtml(markdown: string, myUserId?: string): string {
  if (!markdown) return '';

  // Thread myUserId into the marked link renderer (handles markdown-style links)
  currentMyUserId = myUserId ?? null;
  const raw = marked.parse(markdown) as string;
  currentMyUserId = null;

  // Sanitize first, then convert any remaining matrix.to <a> tags to pill spans
  const sanitized = DOMPurify.sanitize(raw, PURIFY_CONFIG) as string;
  return applyMentionPills(sanitized, myUserId);
}
