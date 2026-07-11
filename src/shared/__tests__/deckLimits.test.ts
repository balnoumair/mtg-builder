import { describe, it, expect } from 'vitest';
import { getMaxCopies, DEFAULT_COPY_LIMIT } from '../deckLimits';

describe('getMaxCopies', () => {
  it('defaults to 4 copies', () => {
    expect(getMaxCopies({ type_line: 'Instant' })).toBe(DEFAULT_COPY_LIMIT);
  });

  it('allows unlimited basic lands', () => {
    expect(getMaxCopies({ type_line: 'Basic Land — Forest' })).toBeNull();
  });

  it('allows unlimited snow basics', () => {
    expect(getMaxCopies({ type_line: 'Basic Snow Land — Island' })).toBeNull();
  });

  it('does not treat non-basic lands as unlimited', () => {
    expect(getMaxCopies({ type_line: 'Land — Island Mountain' })).toBe(DEFAULT_COPY_LIMIT);
  });
});
