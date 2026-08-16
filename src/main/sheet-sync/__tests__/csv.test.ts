import { describe, it, expect } from 'vitest';
import { parseCsv } from '../csv';

describe('parseCsv', () => {
  it('parses plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('"Toni, el grande",Elfos')).toEqual([['Toni, el grande', 'Elfos']]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('"line1\nline2",b')).toEqual([['line1\nline2', 'b']]);
  });

  it('handles CRLF endings and a trailing newline', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('preserves empty cells', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('parses the emoji color column unchanged', () => {
    expect(parseCsv('Toni,Bloomburrow,⚪🔴,Ratones')).toEqual([
      ['Toni', 'Bloomburrow', '⚪🔴', 'Ratones'],
    ]);
  });
});
