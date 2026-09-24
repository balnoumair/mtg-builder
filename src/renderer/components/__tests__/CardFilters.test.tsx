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

  it('filters multicolor and colorless cards as color categories', async () => {
    const user = userEvent.setup();
    const filters = renderCardFilters();

    await user.click(screen.getByTitle('Multicolor'));
    expect(filters.onUpdate).toHaveBeenCalledWith({ colorCategories: ['multicolor'] });

    cleanup();
    const colorless = renderCardFilters({ colorCategories: ['multicolor'] });
    await user.click(screen.getByTitle('Colorless'));
    expect(colorless.onUpdate).toHaveBeenCalledWith({
      colorCategories: ['multicolor', 'colorless'],
    });
  });

  it('allows selecting multiple mana values and toggling them independently', async () => {
    const user = userEvent.setup();
    const filters = renderCardFilters();

    await user.click(screen.getByTitle('Mana value 3'));
    expect(filters.onUpdate).toHaveBeenCalledWith({
      manaValues: [3],
      cmcMin: undefined,
      cmcMax: undefined,
    });

    cleanup();
    const multiple = renderCardFilters({ manaValues: [3] });
    await user.click(screen.getByTitle('Mana value 5'));
    expect(multiple.onUpdate).toHaveBeenCalledWith({
      manaValues: [3, 5],
      cmcMin: undefined,
      cmcMax: undefined,
    });

    cleanup();
    const remove = renderCardFilters({ manaValues: [3, 5] });
    await user.click(screen.getByTitle('Mana value 3'));
    expect(remove.onUpdate).toHaveBeenCalledWith({
      manaValues: [5],
      cmcMin: undefined,
      cmcMax: undefined,
    });
  });

  it('emits type updates as a single-element selection', async () => {
    const user = userEvent.setup();
    const typeRender = renderCardFilters();

    await user.click(screen.getByRole('button', { name: 'Creature' }));
    expect(typeRender.onUpdate).toHaveBeenCalledWith({ types: ['Creature'] });

    cleanup();
    const allRender = renderCardFilters({ types: ['Creature'] });
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(allRender.onUpdate).toHaveBeenCalledWith({ types: undefined });
  });

  it('loads sets, filters by search text, and emits set updates', async () => {
    const user = userEvent.setup();
    vi.mocked(window.electronAPI.getSets).mockResolvedValue([
      { code: 'abc', name: 'Alpha Set', releasedAt: '2020-01-01', blockCode: null, blockName: null },
      { code: 'bet', name: 'Beta Set', releasedAt: '2021-01-01', blockCode: null, blockName: null },
    ]);

    const { onUpdate } = renderCardFilters();
    await user.click(screen.getByRole('button', { name: /^Edition/ }));

    const searchInput = await screen.findByPlaceholderText('Search sets…');
    await user.type(searchInput, 'beta');

    await waitFor(() => {
      expect(screen.getByText('Beta Set')).toBeInTheDocument();
      expect(screen.queryByText('Alpha Set')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('Beta Set'));
    expect(onUpdate).toHaveBeenCalledWith({ sets: ['bet'] });
  });

  it('shows clear only when filters are active and resets all fields', async () => {
    const user = userEvent.setup();
    renderCardFilters();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    cleanup();
    const active = renderCardFilters({
      colors: ['U'],
      types: ['Instant'],
      sets: ['abc'],
      cmcMin: 2,
      cmcMax: 2,
    });

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(active.onUpdate).toHaveBeenCalledWith({
      query: undefined,
      colors: undefined,
      colorCategories: undefined,
      types: undefined,
      rarity: undefined,
      sets: undefined,
      manaValues: undefined,
      cmcMin: undefined,
      cmcMax: undefined,
    });
  });
});
