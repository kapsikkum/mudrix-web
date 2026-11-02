/**
 * Fixtures for the spellcheck engine (the repo has no unit test runner). `runSpellcheckExamples()`
 * returns the names of failing cases; empty = all good. Pass `loadDictionary` (Node only, reads the
 * raw dictionary-* files) to also run Hunspell against the real dictionaries.
 */
import { SPELLCHECK_LANGUAGES, dictionaryForLocale } from './languages';
import {
  addPersonalWord,
  getPersonalWords,
  ignoreWord,
  isUserAccepted,
  reloadPersonalWords,
  removePersonalWord,
  subscribePersonalWords,
} from './personalDictionary';
import { checkWords, suggestWords } from './spellcheck';
import { createSpeller } from './spellcheckCore';
import { tokenizeWords } from './tokenize';

type Dict = { aff: Uint8Array; dic: Uint8Array };

const words = (text: string) => tokenizeWords(text).map((t) => t.word);

export async function runSpellcheckExamples(
  loadDictionary?: (lang: string) => Promise<Dict>
): Promise<string[]> {
  const failures: string[] = [];
  const eq = (name: string, actual: unknown, expected: unknown) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
    }
  };

  // tokenizeWords
  eq('plain', words('Hello brave world'), ['Hello', 'brave', 'world']);
  eq('offsets', tokenizeWords('a  teh'), [{ word: 'teh', start: 3, end: 6 }]);
  eq(
    'offsets non-ascii',
    tokenizeWords('x \u00e9t\u00e9 ok').map((t) => [t.start, t.end]),
    [
      [2, 5],
      [6, 8],
    ]
  );
  eq('accents', words('caf\u00e9 na\u00efve \u00fcber'), ['caf\u00e9', 'na\u00efve', '\u00fcber']);
  eq('cyrillic', words('\u043f\u0440\u0438\u0432\u0435\u0442 \u043c\u0438\u0440'), [
    '\u043f\u0440\u0438\u0432\u0435\u0442',
    '\u043c\u0438\u0440',
  ]);
  eq('ascii apostrophe', words("don't stop"), ["don't", 'stop']);
  eq('typographic apostrophe', words('don\u2019t stop'), ['don\u2019t', 'stop']);
  eq('quoted word', words("'hello' there"), ['hello', 'there']);
  eq('trailing apostrophe', words("the dogs' bowl"), ['the', 'dogs', 'bowl']);
  eq('hyphen parts', tokenizeWords('well-known fact'), [
    { word: 'well', start: 0, end: 4 },
    { word: 'known', start: 5, end: 10 },
    { word: 'fact', start: 11, end: 15 },
  ]);
  eq('digits', words('abc123 4chan 2024 fine'), ['fine']);
  eq('digit part of hyphen', words('abc-123 foo2-bar'), ['abc', 'bar']);
  eq('underscore', words('snake_case_name word'), ['word']);
  eq('one char', words('a b c word'), ['word']);
  eq('acronyms', words('NASA USB API HTTP CPU'), []);
  eq('long caps checked', words('HELLO WORLD'), ['HELLO', 'WORLD']);
  eq('camelCase', words('matrixClient iPhone plain'), ['plain']);
  eq('url', words('see https://example.com/some/path?q=1 now'), ['see', 'now']);
  eq('url in parens', words('(https://example.com/abc) ok'), ['ok']);
  eq('www', words('visit www.example.com today'), ['visit', 'today']);
  eq('domain', words('open example.com or file.txt please'), ['open', 'or', 'please']);
  eq('email', words('mail me@example.org please'), ['mail', 'please']);
  eq('mention', words('hi @alice and @bob:matrix.org'), ['hi', 'and']);
  eq('hyphenated mention', words('hi @some-user ok'), ['hi', 'ok']);
  eq('room alias', words('join #general:example.org now'), ['join', 'now']);
  eq('emoji shortcode', words('lol :smile: ok'), ['lol', 'ok']);
  eq('unix path', words('cd /usr/local/bin now'), ['cd', 'now']);
  eq('windows path', words('C:\\Users\\kapsi done'), ['done']);
  eq('sentence dot', words('End.Start again'), ['End', 'Start', 'again']);
  eq('empty', words(''), []);
  eq('punctuation only', words('... !!! ???'), []);

  // language mapping
  eq(
    'language list',
    SPELLCHECK_LANGUAGES.map((l) => l.code),
    ['en', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'tr']
  );
  eq('locale en', dictionaryForLocale('en'), 'en');
  eq('locale en-US', dictionaryForLocale('en-US'), 'en');
  eq('locale pt-BR', dictionaryForLocale('pt-BR'), 'pt');
  eq('locale underscore', dictionaryForLocale('de_AT'), 'de');
  eq('locale ru', dictionaryForLocale('ru'), 'ru');
  eq('locale tr', dictionaryForLocale('tr'), 'tr');
  eq('locale ja', dictionaryForLocale('ja'), null);
  eq('locale ja-JP', dictionaryForLocale('ja-JP'), null);
  eq('locale unknown', dictionaryForLocale('xx'), null);
  eq('locale empty', dictionaryForLocale(''), null);

  // no Worker in Node (and unknown/unavailable languages): everything degrades to correct
  eq('degrade no worker', [...(await checkWords(['recieve'], ['en']))], []);
  eq('degrade unknown language', [...(await checkWords(['recieve'], ['xx']))], []);
  eq('degrade it and pt without a worker', [...(await checkWords(['recieve'], ['it', 'pt']))], []);
  eq('degrade suggest', await suggestWords('recieve', ['en']), []);
  eq(
    'availability',
    SPELLCHECK_LANGUAGES.filter((l) => !l.available).map((l) => l.code),
    []
  );

  // personal dictionary (localStorage stub)
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  const realStorage = g.localStorage;
  const install = (stub: unknown) =>
    Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true });
  install({
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  try {
    reloadPersonalWords();
    eq('personal starts empty', getPersonalWords(), []);
    let notified = 0;
    const unsubscribe = subscribePersonalWords(() => notified++);
    addPersonalWord('Mudrix');
    addPersonalWord('mudrix');
    addPersonalWord('  ');
    eq('personal add dedupes', getPersonalWords(), ['mudrix']);
    eq('personal notified once', notified, 1);
    eq('personal persisted', store.get('mudrix.spellcheck.words'), '["mudrix"]');
    eq('personal case-insensitive', isUserAccepted('MUDRIX'), true);
    reloadPersonalWords();
    eq('personal reloaded from storage', getPersonalWords(), ['mudrix']);
    ignoreWord('Zorp');
    eq('ignore accepted', isUserAccepted('zorp'), true);
    eq('ignore not persisted', getPersonalWords(), ['mudrix']);
    reloadPersonalWords();
    eq('ignore is session-only', isUserAccepted('zorp'), false);
    notified = 0;
    removePersonalWord('MUDRIX');
    removePersonalWord('mudrix');
    eq('personal remove', getPersonalWords(), []);
    eq('personal remove notified once', notified, 1);
    unsubscribe();
    addPersonalWord('quux');
    eq('unsubscribed', notified, 1);
    store.set('mudrix.spellcheck.words', '{not json');
    reloadPersonalWords();
    eq('corrupt storage', getPersonalWords(), []);
    install({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    reloadPersonalWords();
    addPersonalWord('blocked');
    eq('storage throws, kept in memory', getPersonalWords(), ['blocked']);
  } finally {
    install(realStorage);
    reloadPersonalWords();
  }

  // real Hunspell (WebAssembly) against the real dictionaries
  if (loadDictionary) {
    const speller = async (lang: string) => {
      const { aff, dic } = await loadDictionary(lang);
      return createSpeller(aff, dic);
    };
    const en = await speller('en');
    eq('en receive ok', en.isCorrect('receive'), true);
    eq('en recieve wrong', en.isCorrect('recieve'), false);
    eq('en suggests receive', en.suggest('recieve').includes('receive'), true);
    eq('en capitalised ok', en.isCorrect('Hello'), true);
    eq('en contraction', en.isCorrect("don't"), true);
    eq('en typographic contraction', en.isCorrect('don’t'), true);
    eq('en gibberish', en.isCorrect('asdfgh'), false);
    // [misspelled, correct] pairs; every bundled language must load and answer
    const pairs: Record<string, [string, string]> = {
      de: ['Hauss', 'Haus'],
      es: ['kasa', 'casa'],
      fr: ['bonjuor', 'bonjour'],
      it: ['kasa', 'casa'],
      nl: ['huiss', 'huis'],
      pl: ['dziekuje', 'dziękuję'],
      pt: ['obrigadu', 'obrigado'],
      ru: ['превет', 'привет'],
      tr: ['merhabaa', 'merhaba'],
    };
    for (const [lang, [wrong, right]] of Object.entries(pairs)) {
      const sp = await speller(lang);
      eq(lang + ' wrong word', sp.isCorrect(wrong), false);
      eq(lang + ' right word', sp.isCorrect(right), true);
      eq(lang + ' suggests right word', sp.suggest(wrong).includes(right), true);
    }
  }

  return failures;
}
