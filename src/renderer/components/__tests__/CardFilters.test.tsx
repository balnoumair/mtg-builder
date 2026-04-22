import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardFilters from '../CardFilters';
import type { CardFilters as Filters } from '../../../shared/types';

const renderCardFilters = (filters: Filters = {}, onUpdate = vi.fn()) => {
  render(<CardFilters filters={filters} onUpdate={onUpdate} />);
  return { onUpdate };
};

describe('CardFilters', () => {
  it('emits color updates when toggling on and off', async () => {
    const user = userEvent.setup();
    const first = renderCardFilters();

    await user.click(screen.getByTitle('White'));
    expect(first.onUpdate).toHaveBeenCalledWith({ colors: ['W'] });

    cleanup();
    const second = renderCardFilters({ colors: ['W'] });
    await user.click(screen.getByTitle('White'));
    expect(second.onUpdate).toHaveBeenCalledWith({ colors: undefined });
  });

  it('handles exact CMC and 7+ CMC toggle behavior', async () => {
    const user = userEvent.setup();

    const exact = renderCardFilters();
    await user.click(screen.getByTitle('CMC 3'));
    expect(exact.onUpdate).toHaveBeenCalledWith({ cmcMin: 3, cmcMax: 3 });

    cleanup();
    const exactActive = renderCardFilters({ cmcMin: 3, cmcMax: 3 });
    await user.click(screen.getByTitle('CMC 3'));
    expect(exactActive.onUpdate).toHaveBeenCalledWith({ cmcMin: undefined, cmcMax: undefined });

    cleanup();
    const sevenPlus = renderCardFilters();
    await user.click(screen.getByTitle('CMC 7 or more'));
    expect(sevenPlus.onUpdate).toHaveBeenCalledWith({ cmcMin: 7, cmcMax: undefined });

    cleanup();
    const sevenPlusActive = renderCardFilters({ cmcMin: 7 });
    await user.click(screen.getByTitle('CMC 7 or more'));
    expect(sevenPlusActive.onUpdate).toHaveBeenCalledWith({ cmcMin: undefined, cmcMax: undefined });
  });

  it('emits type and rarity toggle updates', async () => {
    const user = userEvent.setup();
    const typeRender = renderCardFilters();

    await user.click(screen.getByRole('button', { name: 'Creature' }));
    expect(typeRender.onUpdate).toHaveBeenCalledWith({ types: ['Creature'] });

    cleanup();
    const rarityRender = renderCardFilters();
    await user.click(screen.getByTitle('common'));
    expect(rarityRender.onUpdate).toHaveBeenCalledWith({ rarity: ['common'] });
  });

  it('loads sets, filters by search text, and emits set updates', async () => {
    const user = userEvent.setup();
    vi.mocked(window.electronAPI.getSets).mockResolvedValue([
      { code: 'abc', name: 'Alpha Set', releasedAt: '2020-01-01', blockCode: null, blockName: null },
      { code: 'bet', name: 'Beta Set', releasedAt: '2021-01-01', blockCode: null, blockName: null },
    ]);

    const { onUpdate } = renderCardFilters();
    await user.click(screen.getByRole('button', { name: /^Sets/ }));

    const searchInput = await screen.findByPlaceholderText('Search sets…');
    await user.type(searchInput, 'beta');

    await waitFor(() => {
      expect(screen.getByText('Beta Set')).toBeInTheDocument();
      expect(screen.queryByText('Alpha Set')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('Beta Set'));
    expect(onUpdate).toHaveBeenCalledWith({ sets: ['bet'] });
  });

  it('shows clear all only when filters are active and resets all fields', async () => {
    const user = userEvent.setup();
    renderCardFilters();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();

    cleanup();
    const active = renderCardFilters({
      colors: ['U'],
      types: ['Instant'],
      rarity: ['rare'],
      sets: ['abc'],
      cmcMin: 2,
      cmcMax: 2,
    });

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(active.onUpdate).toHaveBeenCalledWith({
      colors: undefined,
      types: undefined,
      rarity: undefined,
      sets: undefined,
      cmcMin: undefined,
      cmcMax: undefined,
    });
  });
});
