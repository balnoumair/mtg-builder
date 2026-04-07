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
      <div className="flex-shrink-0 p-5 pb-4 space-y-4">
        <div className="flex items-end gap-3">
          <h2 className="font-display text-2xl font-normal tracking-[0.14em] text-bone/90 uppercase leading-none">
            Collection
          </h2>
          <span className="text-ash/50 text-xs tracking-wide pb-0.5">{result.total.toLocaleString()} cards</span>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ash/40 pointer-events-none"
            fill="none" viewBox="0 0 16 16"
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search cards…"
            value={filters.query || ''}
            onChange={e => updateFilters({ query: e.target.value || undefined })}
            className="w-full bg-slate-dark/40 border border-slate-mid/20 rounded-xl pl-10 pr-4 py-2.5
                       text-sm text-bone placeholder:text-ash/40
                       focus:outline-none focus:border-mana-gold/35 focus:bg-slate-dark/60 transition-all"
          />
        </div>

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
