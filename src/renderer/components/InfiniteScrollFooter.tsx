import { useI18n } from '../i18n/I18nProvider';

interface Props {
  loadingMore: boolean;
  hasMore: boolean;
  loadedCount: number;
  total: number;
}

export default function InfiniteScrollFooter({ loadingMore, hasMore, loadedCount, total }: Props) {
  const { t } = useI18n();
  if (loadedCount === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 0 4px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-mute)',
      }}
    >
      {loadingMore ? (
        t('pagination.loadingMore')
      ) : hasMore ? (
        t('pagination.scrollForMore')
      ) : (
        t('common.of', {
          current: loadedCount.toLocaleString(),
          total: total.toLocaleString(),
        })
      )}
    </div>
  );
}
