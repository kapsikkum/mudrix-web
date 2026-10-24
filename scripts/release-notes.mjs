// Writes whatsnew/<version>.md, the notes the "What's new" dialog shows, from the commits since the
// previous release. Only user-facing commits make it in: `feat` goes under "New", `fix` and `perf`
// under "Fixed". Everything else (chore, refactor, docs, ci, ...) is left out.
//
// A commit can steer its own line with a `Release-note:` trailer in the body:
//   Release-note: Spaces can now have roles.     -> use this wording instead of the subject
//   Release-note: skip                           -> leave it out
//
// Usage: node scripts/release-notes.mjs <version> [--from <ref>] [--to <ref>] [--body <file>]
//   --from   previous release tag (default: the last tag before HEAD; stable releases skip pre-releases)
//   --to     end of the range (default: HEAD)
//   --body   also write the notes, as Markdown for a GitHub release body, to this file
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const version = args[0]?.replace(/^v/, '');
if (!version || version.startsWith('--')) {
  console.error('usage: node scripts/release-notes.mjs <version> [--from <ref>] [--to <ref>] [--body <file>]');
  process.exit(1);
}
// The dialog only reads whatsnew/<major.minor.patch>.md, so 26.11.0-next.2 is written as 26.11.0
const base = /^\d+\.\d+\.\d+/.exec(version)?.[0];
if (!base) {
  console.error(`"${version}" is not a version`);
  process.exit(1);
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

const to = flag('--to') ?? 'HEAD';
const preRelease = version.includes('-');
const from =
  flag('--from') ??
  git('tag', '--merged', to, '--list', 'v*', '--sort=-v:refname')
    .split('\n')
    .filter((tag) => tag && tag !== `v${version}`)
    .find((tag) => preRelease || !tag.includes('-'));

const range = from ? `${from}..${to}` : to;
const SEP = '\u001e';
const log = git('log', '--no-merges', `--format=%s%n%b${SEP}`, range)
  .split(SEP)
  .map((entry) => entry.trim())
  .filter(Boolean);

const TYPES = { feat: 'New', fix: 'Fixed', perf: 'Fixed' };
const SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

const sections = { New: [], Fixed: [] };
for (const entry of log) {
  const [subject, ...rest] = entry.split('\n');
  const parsed = SUBJECT.exec(subject);
  if (!parsed) continue;
  const [, type, , , text] = parsed;
  const section = TYPES[type];
  if (!section) continue;

  const trailer = /^Release-note:\s*(.+)$/im.exec(rest.join('\n'))?.[1].trim();
  if (trailer?.toLowerCase() === 'skip') continue;

  const line = (trailer ?? text).replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const note = /[.!?]$/.test(line) ? line : `${line}.`;
  if (!sections[section].includes(note)) sections[section].push(note);
}

const markdown = Object.entries(sections)
  .filter(([, notes]) => notes.length)
  .map(([title, notes]) => `## ${title}\n\n${notes.map((n) => `- ${n}`).join('\n')}`)
  .join('\n\n');

if (!markdown) {
  console.log(`No user-facing commits since ${from ?? 'the start'}; no notes written.`);
  process.exit(0);
}

const write = (file, content) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${content}\n`);
};
write(`whatsnew/${base}.md`, markdown);
const body = flag('--body');
if (body) write(body, markdown);
console.log(`Wrote whatsnew/${base}.md (${from ?? 'start'}..${to}):\n\n${markdown}`);
