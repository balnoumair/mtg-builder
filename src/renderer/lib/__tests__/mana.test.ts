import { describe, it, expect } from 'vitest';
import {
  parseManaCost,
  getManaMeta,
  getCardTypeCategory,
  TYPE_ORDER,
} from '../mana';

describe('parseManaCost', () => {
  it('parses a standard mana cost', () => {
    expect(parseManaCost('{1}{W}{U}')).toEqual(['1', 'W', 'U']);
  });

  it('returns empty array for empty string', () => {
    expect(parseManaCost('')).toEqual([]);
  });

  it('returns empty array for string with no braces', () => {
    expect(parseManaCost('WU')).toEqual([]);
  });

  it('parses hybrid mana symbols', () => {
    expect(parseManaCost('{2/W}{2/U}')).toEqual(['2/W', '2/U']);
  });

  it('parses Phyrexian mana symbols', () => {
    expect(parseManaCost('{W/P}')).toEqual(['W/P']);
  });

  it('parses generic mana only', () => {
    expect(parseManaCost('{5}')).toEqual(['5']);
  });

  it('parses X costs', () => {
    expect(parseManaCost('{X}{X}{G}')).toEqual(['X', 'X', 'G']);
  });

  it('parses colorless C symbol', () => {
    expect(parseManaCost('{C}')).toEqual(['C']);
  });
});

describe('getManaMeta', () => {
  it('returns Hush palette meta for W', () => {
    expect(getManaMeta('W').hex).toBe('#f1ead0');
    expect(getManaMeta('W').name).toBe('White');
  });

  it('returns Hush palette meta for U', () => {
    expect(getManaMeta('U').hex).toBe('#9fcfee');
  });

  it('returns Hush palette meta for B', () => {
    expect(getManaMeta('B').hex).toBe('#9b948d');
  });

  it('returns Hush palette meta for R', () => {
    expect(getManaMeta('R').hex).toBe('#e7a294');
  });

  it('returns Hush palette meta for G', () => {
    expect(getManaMeta('G').hex).toBe('#a8c79c');
  });

  it('returns colorless fallback for unknown symbol', () => {
    expect(getManaMeta('Z').hex).toBe('#bdb7af');
  });
});

describe('getCardTypeCategory', () => {
  it('classifies creatures', () => {
    expect(getCardTypeCategory('Legendary Creature — Dragon')).toBe('Creature');
  });

  it('classifies planeswalkers', () => {
    expect(getCardTypeCategory('Legendary Planeswalker — Jace')).toBe('Planeswalker');
  });

  it('classifies instants', () => {
    expect(getCardTypeCategory('Instant')).toBe('Instant');
  });

  it('classifies sorceries', () => {
    expect(getCardTypeCategory('Sorcery')).toBe('Sorcery');
  });

  it('classifies enchantments', () => {
    expect(getCardTypeCategory('Enchantment — Aura')).toBe('Enchantment');
  });

  it('classifies artifacts', () => {
    expect(getCardTypeCategory('Artifact — Equipment')).toBe('Artifact');
  });

  it('classifies lands', () => {
    expect(getCardTypeCategory('Basic Land — Forest')).toBe('Land');
  });

  it('classifies creature takes priority over enchantment', () => {
    expect(getCardTypeCategory('Enchantment Creature — Spirit')).toBe('Creature');
  });

  it('classifies artifact creature as creature', () => {
    expect(getCardTypeCategory('Artifact Creature — Golem')).toBe('Creature');
  });

  it('returns Other for unrecognized types', () => {
    expect(getCardTypeCategory('Token')).toBe('Other');
  });

  it('handles case insensitivity', () => {
    expect(getCardTypeCategory('CREATURE')).toBe('Creature');
  });
});

describe('TYPE_ORDER', () => {
  it('contains all expected categories in correct order', () => {
    expect(TYPE_ORDER).toEqual([
      'Creature', 'Planeswalker', 'Instant', 'Sorcery',
      'Enchantment', 'Artifact', 'Land', 'Other',
    ]);
  });
});
