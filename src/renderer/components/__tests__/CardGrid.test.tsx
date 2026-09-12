import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CardGrid from '../CardGrid';
import type { Card } from '../../../shared/types';

const card = {
  id: 'card-1', name: 'Example card', mana_cost: '', color_identity: [],
  rarity: 'common', type_line: 'Creature', oracle_text: '', cmc: 1,
  power: null, toughness: null, image_uri_normal: 'card.png',
} as Card;

const variants = [
  { label: 'image grid', view: 'grid' as const, card },
  { label: 'imageless grid', view: 'grid' as const, card: { ...card, image_uri_normal: null } },
  { label: 'list', view: 'list' as const, card },
];

describe.each(variants)('$label card actions', ({ view, card: displayedCard }) => {
  it.each(['ctrlKey', 'metaKey'])('%s previews without adding a copy', (modifier) => {
    const add = vi.fn();
    const preview = vi.fn();
    render(<CardGrid cards={[displayedCard]} loading={false} view={view}
      onCardClick={add} onViewCard={preview} />);
    const target = view === 'grid' && displayedCard.image_uri_normal
      ? screen.getByRole('img', { name: card.name }) : screen.getByText(card.name);
    fireEvent.click(target, { [modifier]: true });
    expect(preview).toHaveBeenCalledWith(displayedCard);
    expect(add).not.toHaveBeenCalled();
    fireEvent.click(target);
    expect(add).toHaveBeenCalledWith(displayedCard);
  });

  it('removes every owned copy without triggering the card click action', () => {
    const open = vi.fn();
    const remove = vi.fn();
    render(<CardGrid cards={[displayedCard]} loading={false} view={view}
      ownedQuantities={{ [card.id]: 4 }} onCardClick={open} onRemoveFromCollection={remove} />);
    const target = view === 'grid' && displayedCard.image_uri_normal
      ? screen.getByRole('img', { name: card.name }) : screen.getByText(card.name);
    fireEvent.mouseEnter(target);
    fireEvent.click(screen.getByRole('button', { name: `Remove all 4 copies of ${card.name} from My Cards` }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(displayedCard);
    expect(open).not.toHaveBeenCalled();
  });
});

describe.each(['grid', 'list'] as const)('%s nested deck controls', (view) => {
  it.each(['ctrlKey', 'metaKey'])('%s previews instead of adding a playset', (modifier) => {
    const add = vi.fn();
    const addPlayset = vi.fn();
    const preview = vi.fn();
    render(<CardGrid cards={[card]} loading={false} view={view}
      onCardClick={add} onViewCard={preview} onAddPlayset={addPlayset} />);
    const button = screen.getByRole('button', { name: '+4' });
    fireEvent.click(button, { [modifier]: true });
    expect(preview).toHaveBeenCalledWith(card);
    expect(addPlayset).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(addPlayset).toHaveBeenCalledWith(card);
  });
});
