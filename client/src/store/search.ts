import { atom } from 'recoil';

export type SearchState = {
  enabled: boolean | null;
  query: string;
  debouncedQuery: string;
  isSearching: boolean;
  isTyping: boolean;
  startDate: string;
  endDate: string;
};

export const search = atom<SearchState>({
  key: 'search',
  default: {
    enabled: null,
    query: '',
    debouncedQuery: '',
    isSearching: false,
    isTyping: false,
    startDate: '',
    endDate: '',
  },
});

export default {
  search,
};
