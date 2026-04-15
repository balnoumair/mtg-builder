import { describe, it, expect } from 'vitest';
import {
  parseManaCost,
  getManaColor,
  getManaBg,
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

describe('getManaColor', () => {
  it('returns correct color for W', () => {
    expect(getManaColor('W')).toBe('#f9faf4');
  });

  it('returns correct color for U', () => {
    expect(getManaColor('U')).toBe('#0e68ab');
  });

  it('returns correct color for B', () => {
    expect(getManaColor('B')).toBe('#6b5c7a');
  });

  it('returns correct color for R', () => {
    expect(getManaColor('R')).toBe('#d3202a');
  });

  it('returns correct color for G', () => {
    expect(getManaColor('G')).toBe('#00733e');
  });

  it('returns fallback color for unknown symbol', () => {
    expect(getManaColor('Z')).toBe('#9098a0');
  });

  it('returns fallback color for empty string', () => {
    expect(getManaColor('')).toBe('#9098a0');
  });
});

describe('getManaBg', () => {
  it('returns correct background for R', () => {
    expect(getManaBg('R')).toBe('rgba(211,32,42,0.2)');
  });

  it('returns correct background for W', () => {
    expect(getManaBg('W')).toBe('rgba(249,250,244,0.15)');
  });

  it('returns fallback background for unknown symbol', () => {
    expect(getManaBg('Z')).toBe('rgba(144,152,160,0.15)');
  });
});

describe('getCardTypeCategory', () => {
  it('classifies creatures', () => {
    expect(getCardTypeCategory('Legendary Creature — Dragon')).toBe('Creatures');
  });

  it('classifies planeswalkers', () => {
    expect(getCardTypeCategory('Legendary Planeswalker — Jace')).toBe('Planeswalkers');
  });

  it('classifies instants', () => {
    expect(getCardTypeCategory('Instant')).toBe('Instants');
  });

  it('classifies sorceries', () => {
    expect(getCardTypeCategory('Sorcery')).toBe('Sorceries');
  });

  it('classifies enchantments', () => {
    expect(getCardTypeCategory('Enchantment — Aura')).toBe('Enchantments');
  });

  it('classifies artifacts', () => {
    expect(getCardTypeCategory('Artifact — Equipment')).toBe('Artifacts');
  });

  it('classifies lands', () => {
    expect(getCardTypeCategory('Basic Land — Forest')).toBe('Lands');
  });

  it('classifies creature takes priority over enchantment', () => {
    expect(getCardTypeCategory('Enchantment Creature — Spirit')).toBe('Creatures');
  });

  it('classifies artifact creature as creature', () => {
    expect(getCardTypeCategory('Artifact Creature — Golem')).toBe('Creatures');
  });

  it('returns Other for unrecognized types', () => {
    expect(getCardTypeCategory('Token')).toBe('Other');
  });

  it('handles case insensitivity', () => {
    expect(getCardTypeCategory('CREATURE')).toBe('Creatures');
  });
});

describe('TYPE_ORDER', () => {
  it('contains all expected categories in correct order', () => {
    expect(TYPE_ORDER).toEqual([
      'Creatures', 'Planeswalkers', 'Instants', 'Sorceries',
      'Enchantments', 'Artifacts', 'Lands', 'Other',
    ]);
  });
});
