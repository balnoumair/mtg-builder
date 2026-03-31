import { useCards, useCardDetail } from '../hooks/useCards';
import CardFiltersBar from './CardFilters';
import CardGrid from './CardGrid';
import CardDetail from './CardDetail';

export default function CardBrowser() {
  const { filters, updateFilters, setPage, result, loading } = useCards();
  const { card, printings, open, showCard, close } = useCardDetail();

  const totalPages = Math.ceil(result.total / (filters.pageSize || 60));
  const currentPage = filters.page || 1;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-5 pb-0 space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-xl font-bold text-bone">Collection</h2>
          <span className="text-ash text-sm">{result.total.toLocaleString()} cards</span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search cards..."
          value={filters.query || ''}
          onChange={e => updateFilters({ query: e.target.value || undefined })}
          className="w-full bg-obsidian border border-slate-mid/30 rounded-xl px-4 py-2.5
                     text-sm text-bone placeholder:text-ash/50
                     focus:outline-none focus:border-mana-gold/40 transition-colors"
        />

        {/* Filters */}
        <CardFiltersBar filters={filters} onUpdate={updateFilters} />
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto p-5">
        <CardGrid cards={result.cards} loading={loading} onCardClick={showCard} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 pb-4">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg text-sm text-ash hover:text-bone
                         disabled:opacity-30 disabled:cursor-default cursor-pointer
                         hover:bg-obsidian transition-all"
            >
              Prev
            </button>
            <span className="text-ash text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm text-ash hover:text-bone
                         disabled:opacity-30 disabled:cursor-default cursor-pointer
                         hover:bg-obsidian transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {open && card && (
        <CardDetail card={card} printings={printings} onClose={close} />
      )}
    </div>
  );
}
