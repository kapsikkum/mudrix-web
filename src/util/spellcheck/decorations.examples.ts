/**
 * Fixtures for the composer's underline logic (the repo has no unit test runner).
 * `runDecorationExamples()` returns the names of failing cases; empty = all good.
 */
import { misspelledTokens, sameWords, uniqueWords, wordAtOffset } from './decorations';

export function runDecorationExamples(): string[] {
  const failures: string[] = [];
  const eq = (name: string, actual: unknown, expected: unknown) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
    }
  };
  const bad = new Set(['teh', 'wrold']);
  const spans = (text: string, caret: number | null) =>
    misspelledTokens(text, bad, caret).map((t) => [t.start, t.end]);

  eq('marks misspelled words', spans('teh good wrold', null), [
    [0, 3],
    [9, 14],
  ]);
  eq('empty set', misspelledTokens('teh', new Set(), null), []);
  eq('caret at word end', spans('teh good wrold', 14), [[0, 3]]);
  eq('caret inside word', spans('teh good wrold', 11), [[0, 3]]);
  eq('caret at word start', spans('teh good wrold', 9), [[0, 3]]);
  eq('caret in a space', spans('teh good wrold', 4), [
    [0, 3],
    [9, 14],
  ]);
  eq('caret right after the word and a space', spans('teh ', 4), [[0, 3]]);
  eq('caret on another node', spans('teh', null), [[0, 3]]);
  eq('skips links and handles', spans('@teh https://teh.com/x teh', null), [[23, 26]]);
  eq('correct words untouched', spans('the world', null), []);

  eq('word at offset inside', wordAtOffset('hello brave', 7)?.word, 'brave');
  eq('word at offset start', wordAtOffset('hello brave', 6)?.word, 'brave');
  eq('word at offset end', wordAtOffset('hello brave', 5)?.word, 'hello');
  eq('word at offset gap', wordAtOffset('hello  brave', 6), null);
  eq('word at offset not checkable', wordAtOffset('abc123 x', 2), null);
  eq('word at offset empty', wordAtOffset('', 0), null);

  eq('unique words', uniqueWords(['teh teh good', 'good wrold', '']), ['teh', 'good', 'wrold']);
  eq('same words', sameWords(new Set(['a', 'b']), new Set(['b', 'a'])), true);
  eq('different words', sameWords(new Set(['a']), new Set(['a', 'b'])), false);

  return failures;
}
