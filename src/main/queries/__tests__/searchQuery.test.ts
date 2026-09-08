import { describe, it, expect } from 'vitest';
import { parseSearchQuery, buildSearchConditions } from '../searchQuery';

describe('parseSearchQuery', () => {
  it('treats a bare word as a name-or-oracle term', () => {
    expect(parseSearchQuery('alpha')).toEqual([{ field: 'any', value: 'alpha' }]);
  });

  it('splits whitespace into separate terms', () => {
    expect(parseSearchQuery('alpha beta')).toEqual([
      { field: 'any', value: 'alpha' },
      { field: 'any', value: 'beta' },
    ]);
  });

  it('maps short and long field prefixes to the same field', () => {
    expect(parseSearchQuery('t:alpha')).toEqual([{ field: 'type', value: 'alpha' }]);
    expect(parseSearchQuery('type:alpha')).toEqual([{ field: 'type', value: 'alpha' }]);
    expect(parseSearchQuery('o:alpha')).toEqual([{ field: 'oracle', value: 'alpha' }]);
    expect(parseSearchQuery('n:alpha')).toEqual([{ field: 'name', value: 'alpha' }]);
  });

  it('ignores prefix casing', () => {
    expect(parseSearchQuery('T:alpha')).toEqual([{ field: 'type', value: 'alpha' }]);
  });

  it('keeps an unknown prefix as literal text', () => {
    expect(parseSearchQuery('zz:alpha')).toEqual([{ field: 'any', value: 'zz:alpha' }]);
  });

  it('groups a quoted phrase into one term', () => {
    expect(parseSearchQuery('"alpha beta"')).toEqual([{ field: 'any', value: 'alpha beta' }]);
    expect(parseSearchQuery('t:"alpha beta"')).toEqual([{ field: 'type', value: 'alpha beta' }]);
  });

  it('treats a colon inside quotes as content, not a field separator', () => {
    expect(parseSearchQuery('o:"alpha: beta"')).toEqual([
      { field: 'oracle', value: 'alpha: beta' },
    ]);
    expect(parseSearchQuery('"t:alpha"')).toEqual([{ field: 'any', value: 't:alpha' }]);
  });

  it('drops a prefix with no value yet, so mid-typing does not blank results', () => {
    expect(parseSearchQuery('t:')).toEqual([]);
    expect(parseSearchQuery('alpha t:')).toEqual([{ field: 'any', value: 'alpha' }]);
  });

  it('returns no terms for empty or whitespace-only input', () => {
    expect(parseSearchQuery('')).toEqual([]);
    expect(parseSearchQuery('   ')).toEqual([]);
  });

  it('closes an unterminated quote at the end of input', () => {
    expect(parseSearchQuery('t:"alpha beta')).toEqual([{ field: 'type', value: 'alpha beta' }]);
  });

  it('mixes prefixed and bare terms', () => {
    expect(parseSearchQuery('t:alpha beta o:gamma')).toEqual([
      { field: 'type', value: 'alpha' },
      { field: 'any', value: 'beta' },
      { field: 'oracle', value: 'gamma' },
    ]);
  });
});

describe('buildSearchConditions', () => {
  it('emits one parameterised condition per term', () => {
    const { conditions, params } = buildSearchConditions('t:alpha beta');
    expect(conditions).toHaveLength(2);
    expect(params).toEqual({ q0: 'alpha', q1: 'beta' });
  });

  it('checks only the type column for a type term', () => {
    const { conditions } = buildSearchConditions('t:alpha');
    expect(conditions[0]).toContain('type_line');
    expect(conditions[0]).not.toContain('oracle_text');
    expect(conditions[0]).not.toContain('name');
  });

  it('checks name and oracle for a bare term', () => {
    const { conditions } = buildSearchConditions('alpha');
    expect(conditions[0]).toContain('name');
    expect(conditions[0]).toContain('oracle_text');
  });

  it('applies a table alias to every column', () => {
    const { conditions } = buildSearchConditions('alpha t:beta', 'c.');
    expect(conditions[0]).toContain('c.name');
    expect(conditions[0]).toContain('c.oracle_text');
    expect(conditions[1]).toContain('c.type_line');
  });

  it('never inlines the search value into SQL', () => {
    const { conditions, params } = buildSearchConditions("alpha' OR 1=1 --");
    expect(conditions.join(' ')).not.toContain('1=1');
    expect(params.q0).toBe("alpha'");
  });
});
