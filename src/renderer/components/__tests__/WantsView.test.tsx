import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WantsView from '../WantsView';
import { copyText } from '../../lib/clipboard';
import type { Card, WantItem } from '../../../shared/types';

vi.mock('../../lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(undefined) }));

const source = (deck_id: number, deck_name: string, need: number) => ({
  deck_id, deck_name, need, pending: false,
});
const want = (name: string, owned: number, sources: WantItem['sources']): WantItem => {
  const needed = sources.reduce((sum, s) => sum + s.need, 0);
  return { name, owned, needed, to_buy: needed - owned, sources,
    card: { name, mana_cost: '', set_code: 'test' } as Card };
};

const setup = async () => {
  window.electronAPI.getWants = vi.fn().mockResolvedValue([
    want('Shared card', 2, [source(1, 'Deck A', 3), source(2, 'Deck B', 4)]),
    want('Covered card', 2, [source(1, 'Deck A', 2), source(2, 'Deck B', 1)]),
    want('Only B', 0, [source(2, 'Deck B', 1)]),
    want('Plains', 0, [source(1, 'Deck A', 5)]),
  ]);
  render(<WantsView active collectionVersion={0} />);
  await screen.findByText('Shared card');
  return userEvent.setup();
};

describe('Wants deck selection', () => {
  it('recalculates shared needs before subtracting owned copies and copying', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Copy list' }));
    expect(copyText).toHaveBeenLastCalledWith('5 Shared card\n1 Covered card\n1 Only B');
    await user.click(screen.getByRole('button', { name: 'Decks' }));
    await user.click(screen.getByRole('checkbox', { name: 'Deck B' }));
    expect(screen.queryByText('Only B')).not.toBeInTheDocument();
    expect(screen.queryByText('Covered card')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy list' }));
    expect(copyText).toHaveBeenLastCalledWith('1 Shared card');
    await user.click(screen.getByRole('checkbox', { name: /Exclude basic lands/ }));
    await user.click(screen.getByRole('button', { name: 'Copy list' }));
    expect(copyText).toHaveBeenLastCalledWith('1 Shared card\n5 Plains');
  });

  it('supports deselecting all decks and restoring them', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Decks' }));
    await user.click(screen.getByRole('button', { name: 'Hide all' }));
    expect(screen.getByRole('button', { name: 'Copy list' })).toBeDisabled();
    expect(screen.getByText('Nothing to buy for the selected decks')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByRole('button', { name: 'Copy list' })).toBeEnabled();
    expect(screen.getByText('Only B')).toBeInTheDocument();
  });
});
