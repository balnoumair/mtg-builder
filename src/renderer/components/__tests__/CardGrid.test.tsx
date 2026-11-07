import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it.each(['ctrlKey', 'metaKey'])('%s previews while repeated plain clicks only add copies', async (modifier) => {
    const user = userEvent.setup();
    const add = vi.fn();
    const preview = vi.fn();
    render(<CardGrid cards={[displayedCard]} loading={false} view={view}
      onCardClick={add} onViewCard={preview} />);
    const target = view === 'grid' && displayedCard.image_uri_normal
      ? screen.getByRole('img', { name: card.name }) : screen.getByText(card.name);
    fireEvent.click(target, { [modifier]: true });
    expect(preview).toHaveBeenCalledWith(displayedCard);
    expect(add).not.toHaveBeenCalled();
    preview.mockClear();
    await user.dblClick(target);
    await user.click(target);
    expect(add).toHaveBeenCalledTimes(3);
    expect(add).toHaveBeenCalledWith(displayedCard);
    expect(preview).not.toHaveBeenCalled();
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

describe.each(['grid', 'list'] as const)('%s collection controls', (view) => {
  it('adds four copies to the collection without a copy limit', () => {
    const addPlayset = vi.fn();
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()}
      ownedQuantities={{ [card.id]: 8 }} onAddPlayset={addPlayset} playsetTarget="collection" />);
    const button = screen.getByRole('button', { name: '+4' });
    expect(button).toHaveAttribute('title', 'Add 4 copies to My Cards');
    fireEvent.click(button);
    expect(addPlayset).toHaveBeenCalledWith(card);
  });

  it('shows free and in-decks copies as separate piles', () => {
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()}
      ownedQuantities={{ [card.id]: 2 }} inDecksQuantities={{ [card.id]: 3 }} />);
    expect(screen.getByText('2 free')).toHaveAttribute('title', 'Not in any deck · 5 owned in total');
    expect(screen.getByText('3 in decks')).toBeInTheDocument();
  });

  it('labels deck and free counts as distinct tags', () => {
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()} onAddToDeck={vi.fn()}
      deckQuantities={{ [card.id]: 2 }} ownedQuantities={{ [card.id]: 2 }} />);
    expect(screen.getByText('2 in deck')).toHaveAttribute('data-count-kind', 'inDeck');
    expect(screen.getByText('2 free')).toHaveAttribute('data-count-kind', 'free');
  });

  it('splits copies between this deck, free and other decks without overlap', () => {
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()}
      deckQuantities={{ [card.id]: 2 }} ownedQuantities={{ [card.id]: 1 }} inDecksQuantities={{ [card.id]: 3 }}
      currentDeckQuantities={{ [card.id]: 2 }} />);
    expect(screen.getByText('2 in deck')).toBeInTheDocument();
    expect(screen.getByText('1 free')).toBeInTheDocument();
    expect(screen.getByText('1 in other decks')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ in decks$/)).toBeNull();
  });

  it('shows only the other-decks tag when every copy is in another deck', () => {
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()}
      ownedQuantities={{}} inDecksQuantities={{ [card.id]: 4 }} currentDeckQuantities={{}} />);
    expect(screen.getByText('4 in other decks')).toBeInTheDocument();
    expect(screen.queryByText(/free$/)).toBeNull();
    expect(screen.queryByText(/in deck$/)).toBeNull();
  });

  it('hides the other-decks tag when every copy is in the open deck', () => {
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()}
      deckQuantities={{ [card.id]: 4 }} ownedQuantities={{}} inDecksQuantities={{ [card.id]: 4 }}
      currentDeckQuantities={{ [card.id]: 4 }} />);
    expect(screen.getByText('4 in deck')).toBeInTheDocument();
    expect(screen.queryByText(/free$|in (other )?decks$/)).toBeNull();
  });

  it('shows unconfirmed additions as new, not again as in deck', () => {
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()}
      deckQuantities={{ [card.id]: 4 }} newQuantities={{ [card.id]: 4 }} />);
    expect(screen.getByText('+4 new')).toBeInTheDocument();
    expect(screen.queryByText(/in deck$/)).toBeNull();
  });

  it('splits a deck count into confirmed and new copies', () => {
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()}
      deckQuantities={{ [card.id]: 4 }} newQuantities={{ [card.id]: 2 }} />);
    expect(screen.getByText('2 in deck')).toBeInTheDocument();
    expect(screen.getByText('+2 new')).toBeInTheDocument();
  });

  it('shows cards held only in decks with the in-decks tag alone', () => {
    render(<CardGrid cards={[card]} loading={false} view={view} onCardClick={vi.fn()}
      ownedQuantities={{}} inDecksQuantities={{ [card.id]: 3 }} />);
    expect(screen.getByText('3 in decks')).toBeInTheDocument();
    expect(screen.queryByText(/free$/)).toBeNull();
  });
});
