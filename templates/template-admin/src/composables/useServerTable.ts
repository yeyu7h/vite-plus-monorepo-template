import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, WatchSource } from 'vue'
import { hashKey, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { PlaceholderDataFunction, QueryKey } from '@tanstack/vue-query'

export interface ServerTableState {
  page: number
  pageSize: number
  search: string
}

export interface ServerTableResult<Item> {
  items: Item[]
  total: number
}

export interface ServerTableOptions<Item, Query> {
  /** Include the session/tenant in this prefix to isolate cached data. */
  queryKey: MaybeRefOrGetter<QueryKey>
  enabled?: MaybeRefOrGetter<boolean>
  pageSize?: number
  buildQuery: (state: ServerTableState) => Query
  queryFn: (query: Query) => Promise<ServerTableResult<Item>>
  /** Filters that apply immediately and reset pagination. */
  filterSources?: WatchSource[]
}

export function useServerTable<Item, Query>(options: ServerTableOptions<Item, Query>) {
  const queryClient = useQueryClient()
  const page = ref(1)
  const pageSize = ref(options.pageSize ?? 10)
  const search = ref('')
  const appliedSearch = ref('')
  const queryPrefix = computed(() => toValue(options.queryKey))
  const request = computed(() => options.buildQuery({ page: page.value, pageSize: pageSize.value, search: appliedSearch.value }))

  const query = useQuery(
    computed(() => {
      const prefix = queryPrefix.value
      const params = request.value
      const key: QueryKey = [...prefix, params]
      return {
        queryKey: key,
        enabled: toValue(options.enabled) ?? true,
        retry: false,
        refetchOnWindowFocus: false,
        queryFn: () => options.queryFn(params),
        // A new callback per key also prevents TanStack Query from reusing a
        // memoized placeholder when switching scope during an unfinished page load.
        placeholderData: ((previousData, previousQuery) =>
          previousQuery && hashKey(previousQuery.queryKey.slice(0, -1)) === hashKey(prefix) ? previousData : undefined) satisfies PlaceholderDataFunction<ServerTableResult<Item>>,
      }
    }),
  )

  function applySearch() {
    if (page.value === 1 && appliedSearch.value === search.value) void query.refetch()
    else {
      appliedSearch.value = search.value
      page.value = 1
    }
  }

  watch(
    options.filterSources ?? [],
    () => {
      appliedSearch.value = search.value
      page.value = 1
    },
    { flush: 'sync' },
  )
  watch(
    pageSize,
    () => {
      page.value = 1
    },
    { flush: 'sync' },
  )

  return {
    page,
    pageSize,
    search,
    items: computed(() => query.data.value?.items ?? []),
    total: computed(() => query.data.value?.total ?? 0),
    loading: query.isFetching,
    error: query.error,
    applySearch,
    refresh: query.refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: queryPrefix.value }),
  }
}
