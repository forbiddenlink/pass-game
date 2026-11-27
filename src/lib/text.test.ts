import { describe, expect, it } from 'vitest';
import { endSentence } from './text';

describe('endSentence', () => {
  it('adds a period when there is no terminal mark', () => {
    expect(endSentence('You sound like you dream')).toBe('You sound like you dream.');
  });
  it('does not double an existing period', () => {
    expect(endSentence('You sound like you dream.')).toBe('You sound like you dream.');
  });
  it('collapses a stray double period', () => {
    expect(endSentence('You sound like you dream..')).toBe('You sound like you dream.');
  });
  it('keeps a deliberate ellipsis and other terminal marks', () => {
    expect(endSentence('You dream...')).toBe('You dream...');
    expect(endSentence('You dream…')).toBe('You dream…');
    expect(endSentence('Do you dream?')).toBe('Do you dream?');
  });
  it('handles empty input', () => {
    expect(endSentence('  ')).toBe('');
  });
});
