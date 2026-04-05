import { useCallback, useEffect, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, SlidersHorizontal, X } from 'lucide-react';
import { Spinner, useToastContext } from '@librechat/client';
import MinimalMessagesWrapper from '~/components/Chat/Messages/MinimalMessages';
import { useNavScrolling, useLocalize, useAuthContext } from '~/hooks';
import SearchMessage from '~/components/Chat/Messages/SearchMessage';
import { useConversationsInfiniteQuery, useMessagesInfiniteQuery } from '~/data-provider';
import { useFileMapContext } from '~/Providers';
import { cn, formatFullTimestamp, toDayRange } from '~/utils';
import store from '~/store';

const QUICK_RANGE_PRESETS = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '365d', label: 'Last 365 days', days: 365 },
] as const;

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Search() {
  const navigate = useNavigate();
  const localize = useLocalize();
  const fileMap = useFileMapContext();
  const { showToast } = useToastContext();
  const { isAuthenticated } = useAuthContext();
  const [search, setSearchState] = useRecoilState(store.search);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = search.debouncedQuery;
  const startDate = useMemo(() => toDayRange(search.startDate).startDate, [search.startDate]);
  const endDate = useMemo(() => toDayRange(search.endDate).endDate, [search.endDate]);
  const hasDateFilters = Boolean(startDate || endDate);
  const isAdvancedOpen = searchParams.get('advanced') === '1' || hasDateFilters;
  const hasSearchCriteria = Boolean(searchQuery || hasDateFilters);
  const hasQuery = Boolean(search.query || searchQuery);
  const showRefineControls = Boolean(hasQuery || hasDateFilters);

  const {
    data: searchConversations,
    isLoading: isConversationsLoading,
    isFetching: isFetchingConversations,
  } = useConversationsInfiniteQuery(
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

  const matchingConversations = useMemo(
    () => searchConversations?.pages.flatMap((page) => page.conversations) ?? [],
    [searchConversations?.pages],
  );

  useEffect(() => {
    if (isError && hasSearchCriteria) {
      showToast({ message: 'An error occurred during search', status: 'error' });
    }
  }, [hasSearchCriteria, isError, showToast]);

  const conversationCount = matchingConversations.length;
  const resultsCount = messages?.length ?? 0;
  const resultsAnnouncement = useMemo(() => {
    const totalCount = conversationCount + resultsCount;
    if (totalCount === 0) {
      return localize('com_ui_nothing_found');
    }
    if (totalCount === 1) {
      return localize('com_ui_result_found', { count: totalCount });
    }
    return localize('com_ui_results_found', { count: totalCount });
  }, [conversationCount, resultsCount, localize]);

  const isSearchLoading =
    search.isTyping ||
    isLoading ||
    isFetchingNextPage ||
    isConversationsLoading ||
    isFetchingConversations;
  const emptyStateClasses = 'flex w-full justify-center py-10';

  const toggleAdvanced = useCallback(
    (open: boolean) => {
      const nextParams = new URLSearchParams(searchParams);
      if (open) {
        nextParams.set('advanced', '1');
      } else {
        nextParams.delete('advanced');
      }
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const applyPreset = useCallback(
    (days: number) => {
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));

      setSearchState((prev) => ({
        ...prev,
        startDate: toInputDate(start),
        endDate: toInputDate(end),
      }));
      toggleAdvanced(true);
    },
    [setSearchState, toggleAdvanced],
  );

  const clearDateFilters = useCallback(() => {
    setSearchState((prev) => ({
      ...prev,
      startDate: '',
      endDate: '',
    }));
    if (!hasQuery) {
      toggleAdvanced(false);
    }
  }, [hasQuery, setSearchState, toggleAdvanced]);

  const activeFilterLabel = useMemo(() => {
    if (search.startDate && search.endDate) {
      return `${search.startDate} to ${search.endDate}`;
    }
    if (search.startDate) {
      return `From ${search.startDate}`;
    }
    if (search.endDate) {
      return `Until ${search.endDate}`;
    }
    return null;
  }, [search.endDate, search.startDate]);

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
      {showRefineControls ? (
        <div className="mx-auto mb-4 flex w-full max-w-4xl flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-border-medium bg-surface-secondary p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-text-primary">Search results</div>
                <div className="text-xs text-text-secondary">
                  {searchQuery ? (
                    <>
                      Query:{' '}
                      <span className="font-medium text-text-primary">&ldquo;{searchQuery}&rdquo;</span>
                    </>
                  ) : (
                    'Browsing by date only'
                  )}
                </div>
                <div className="text-xs text-text-secondary">
                  {isSearchLoading
                    ? 'Refreshing results...'
                    : `${conversationCount} conversation match${conversationCount === 1 ? '' : 'es'} · ${resultsCount} message result${resultsCount === 1 ? '' : 's'}`}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                    isAdvancedOpen
                      ? 'border-border-xheavy bg-surface-hover text-text-primary'
                      : 'border-border-medium bg-transparent text-text-secondary hover:text-text-primary',
                  )}
                  onClick={() => toggleAdvanced(!isAdvancedOpen)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Refine
                </button>
                {activeFilterLabel ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-medium bg-transparent px-3 text-sm text-text-secondary hover:text-text-primary"
                    onClick={clearDateFilters}
                  >
                    <X className="h-4 w-4" />
                    {activeFilterLabel}
                  </button>
                ) : null}
              </div>
            </div>

            {isAdvancedOpen ? (
              <div className="flex flex-col gap-3 border-t border-border-light pt-3">
                <div className="flex flex-wrap gap-2">
                  {QUICK_RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className="inline-flex h-8 items-center rounded-full border border-border-medium px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-heavy hover:text-text-primary"
                      onClick={() => applyPreset(preset.days)}
                    >
                      {preset.label}
                    </button>
                  ))}
                  {(search.startDate || search.endDate) ? (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-full border border-border-medium px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-heavy hover:text-text-primary"
                      onClick={clearDateFilters}
                    >
                      {localize('com_ui_clear')}
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
                    <span>Date from</span>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                      <input
                        type="date"
                        value={search.startDate}
                        onChange={(e) =>
                          setSearchState((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        className="h-10 w-full rounded-lg border border-border-medium bg-transparent pl-10 pr-3 text-sm text-text-primary outline-none focus:border-border-xheavy"
                      />
                    </div>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
                    <span>Date to</span>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                      <input
                        type="date"
                        value={search.endDate}
                        onChange={(e) =>
                          setSearchState((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        className="h-10 w-full rounded-lg border border-border-medium bg-transparent pl-10 pr-3 text-sm text-text-primary outline-none focus:border-border-xheavy"
                      />
                    </div>
                  </label>
                </div>
                <div className="text-xs text-text-secondary">
                  Use the quick presets or the calendar inputs to narrow both the history list and
                  the search results.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="sr-only" role="alert" aria-atomic="true">
        {resultsAnnouncement}
      </div>
      {isSearchLoading && isAdvancedOpen ? (
        <div className="flex w-full justify-center py-10">
          <Spinner className="text-text-primary" />
        </div>
      ) : conversationCount === 0 && ((messages && messages.length === 0) || messages == null) ? (
        <div className={emptyStateClasses}>
          <div className="rounded-lg bg-white p-6 text-lg text-gray-500 dark:border-gray-800/50 dark:bg-gray-800 dark:text-gray-300">
            {hasSearchCriteria
              ? localize('com_ui_nothing_found')
              : 'Use the sidebar search above or add a date range to start browsing chat history.'}
          </div>
        </div>
      ) : (
        <>
          {matchingConversations.length > 0 ? (
            <div className="mx-auto mb-6 flex w-full max-w-4xl flex-col gap-3">
              <div className="text-sm font-semibold text-text-primary">Matching conversations</div>
              <div className="grid gap-3">
                {matchingConversations.map((conversation) => (
                  <button
                    key={conversation.conversationId}
                    type="button"
                    className="rounded-xl border border-border-medium bg-surface-secondary px-4 py-3 text-left transition-colors hover:border-border-heavy hover:bg-surface-hover"
                    onClick={() => navigate(`/c/${conversation.conversationId}`)}
                  >
                    <div className="truncate text-sm font-medium text-text-primary">
                      {conversation.title || localize('com_ui_untitled')}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
                      <span>{formatFullTimestamp(conversation.updatedAt ?? conversation.createdAt)}</span>
                      {conversation.endpoint ? <span>{conversation.endpoint}</span> : null}
                      {conversation.model ? <span>{conversation.model}</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages && messages.length > 0 ? (
            <div className="mx-auto mb-4 flex w-full max-w-4xl items-center justify-between">
              <div className="text-sm font-semibold text-text-primary">Matching messages</div>
            </div>
          ) : null}
          {(messages ?? []).map((msg) => (
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
