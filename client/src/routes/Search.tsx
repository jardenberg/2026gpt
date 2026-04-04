import { useEffect, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { useSearchParams } from 'react-router-dom';
import { Spinner, useToastContext } from '@librechat/client';
import MinimalMessagesWrapper from '~/components/Chat/Messages/MinimalMessages';
import { useNavScrolling, useLocalize, useAuthContext } from '~/hooks';
import SearchMessage from '~/components/Chat/Messages/SearchMessage';
import { useMessagesInfiniteQuery } from '~/data-provider';
import { useFileMapContext } from '~/Providers';
import { toDayRange } from '~/utils';
import store from '~/store';

export default function Search() {
  const localize = useLocalize();
  const fileMap = useFileMapContext();
  const { showToast } = useToastContext();
  const { isAuthenticated } = useAuthContext();
  const [search, setSearchState] = useRecoilState(store.search);
  const [searchParams] = useSearchParams();
  const searchQuery = search.debouncedQuery;
  const startDate = useMemo(() => toDayRange(search.startDate).startDate, [search.startDate]);
  const endDate = useMemo(() => toDayRange(search.endDate).endDate, [search.endDate]);
  const hasDateFilters = Boolean(startDate || endDate);
  const isAdvancedOpen = searchParams.get('advanced') === '1' || hasDateFilters;
  const hasSearchCriteria = Boolean(searchQuery || hasDateFilters);

  const {
    data: searchMessages,
    isLoading,
    isError,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage: _hasNextPage,
  } = useMessagesInfiniteQuery(
    {
      search: searchQuery || undefined,
      startDate,
      endDate,
    },
    {
      enabled: isAuthenticated && hasSearchCriteria,
      staleTime: 30000,
      cacheTime: 300000,
    },
  );

  const { containerRef } = useNavScrolling({
    nextCursor: searchMessages?.pages[searchMessages.pages.length - 1]?.nextCursor,
    setShowLoading: () => ({}),
    fetchNextPage: fetchNextPage,
    isFetchingNext: isFetchingNextPage,
  });

  const messages = useMemo(() => {
    const msgs =
      searchMessages?.pages.flatMap((page) =>
        page.messages.map((message) => {
          if (!message.files || !fileMap) {
            return message;
          }
          return {
            ...message,
            files: message.files.map((file) => fileMap[file.file_id ?? ''] ?? file),
          };
        }),
      ) || [];

    return msgs.length === 0 ? null : msgs;
  }, [fileMap, searchMessages?.pages]);

  useEffect(() => {
    if (isError && hasSearchCriteria) {
      showToast({ message: 'An error occurred during search', status: 'error' });
    }
  }, [hasSearchCriteria, isError, showToast]);

  const resultsCount = messages?.length ?? 0;
  const resultsAnnouncement = useMemo(() => {
    if (resultsCount === 0) {
      return localize('com_ui_nothing_found');
    }
    if (resultsCount === 1) {
      return localize('com_ui_result_found', { count: resultsCount });
    }
    return localize('com_ui_results_found', { count: resultsCount });
  }, [resultsCount, localize]);

  const isSearchLoading = search.isTyping || isLoading || isFetchingNextPage;
  const emptyStateClasses = isAdvancedOpen
    ? 'flex w-full justify-center py-10'
    : 'absolute inset-0 flex items-center justify-center';

  if (isSearchLoading && !isAdvancedOpen) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (!hasSearchCriteria && !isAdvancedOpen) {
    return null;
  }

  return (
    <MinimalMessagesWrapper ref={containerRef} className="relative flex h-full pt-4">
      {isAdvancedOpen && (
        <div className="mx-auto mb-4 flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-border-medium bg-surface-secondary p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text-primary">{localize('com_ui_advanced')}</div>
              <div className="text-xs text-text-secondary">
                Add a date range to narrow both the history list and search results.
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-text-secondary hover:text-text-primary"
              onClick={() =>
                setSearchState((prev) => ({
                  ...prev,
                  startDate: '',
                  endDate: '',
                }))
              }
            >
              {localize('com_ui_clear')}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
              <span>Date from</span>
              <input
                type="date"
                value={search.startDate}
                onChange={(e) =>
                  setSearchState((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="h-10 rounded-lg border border-border-medium bg-transparent px-3 text-sm text-text-primary outline-none focus:border-border-xheavy"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
              <span>Date to</span>
              <input
                type="date"
                value={search.endDate}
                onChange={(e) =>
                  setSearchState((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="h-10 rounded-lg border border-border-medium bg-transparent px-3 text-sm text-text-primary outline-none focus:border-border-xheavy"
              />
            </label>
          </div>
          <div className="text-xs text-text-secondary">
            Query: <span className="font-medium text-text-primary">{searchQuery || 'None'}</span>
          </div>
        </div>
      )}
      <div className="sr-only" role="alert" aria-atomic="true">
        {resultsAnnouncement}
      </div>
      {isSearchLoading && isAdvancedOpen ? (
        <div className="flex w-full justify-center py-10">
          <Spinner className="text-text-primary" />
        </div>
      ) : (messages && messages.length === 0) || messages == null ? (
        <div className={emptyStateClasses}>
          <div className="rounded-lg bg-white p-6 text-lg text-gray-500 dark:border-gray-800/50 dark:bg-gray-800 dark:text-gray-300">
            {hasSearchCriteria
              ? localize('com_ui_nothing_found')
              : 'Use the sidebar search above or add a date range to start browsing chat history.'}
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg) => (
            <SearchMessage key={msg.messageId} message={msg} />
          ))}
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Spinner className="text-text-primary" />
            </div>
          )}
        </>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-[5%] bg-gradient-to-t from-gray-50 to-transparent dark:from-gray-800" />
    </MinimalMessagesWrapper>
  );
}
