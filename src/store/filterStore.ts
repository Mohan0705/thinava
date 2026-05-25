import { create } from 'zustand'

export interface FilterState {
  // Homepage filters (temporary, reset on category/search navigation)
  activeRatingFilter: number | null
  activeFilterChips: string[]

  // Category/Search context (persistent within that view)
  currentCategory: string | null
  currentSearchQuery: string | null

  // Actions
  setRatingFilter: (rating: number | null) => void
  setFilterChips: (chips: string[]) => void
  addFilterChip: (chip: string) => void
  removeFilterChip: (chip: string) => void
  toggleFilterChip: (chip: string) => void

  // Context-aware reset
  resetHomepageFilters: () => void
  setCategory: (category: string | null) => void
  setSearchQuery: (query: string | null) => void
  resetCategoryContext: () => void
}

/**
 * Filter Store - Manages filter state with proper isolation
 *
 * ISOLATION RULES:
 * - Homepage filters (rating, chips) are temporary and reset when navigating to category/search
 * - Category and search context track current view
 * - When navigating away from category/search, those contexts are cleared
 * - API requests always get fresh, clean state
 */
export const useFilterStore = create<FilterState>((set) => ({
  activeRatingFilter: null,
  activeFilterChips: [],
  currentCategory: null,
  currentSearchQuery: null,

  setRatingFilter: (rating) =>
    set((state) => ({
      ...state,
      activeRatingFilter: rating,
    })),

  setFilterChips: (chips) =>
    set((state) => ({
      ...state,
      activeFilterChips: chips,
    })),

  addFilterChip: (chip) =>
    set((state) => ({
      ...state,
      activeFilterChips: [...state.activeFilterChips, chip],
    })),

  removeFilterChip: (chip) =>
    set((state) => ({
      ...state,
      activeFilterChips: state.activeFilterChips.filter((c) => c !== chip),
    })),

  toggleFilterChip: (chip) =>
    set((state) => {
      const current = state.activeFilterChips

      // Handle mutually exclusive filters
      if (chip === 'Under Rs99') {
        return {
          ...state,
          activeFilterChips: current.includes(chip)
            ? current.filter((item) => item !== chip)
            : [...current.filter((item) => item !== 'Under Rs199'), chip],
        }
      }

      if (chip === 'Under Rs199') {
        return {
          ...state,
          activeFilterChips: current.includes(chip)
            ? current.filter((item) => item !== chip)
            : [...current.filter((item) => item !== 'Under Rs99'), chip],
        }
      }

      if (chip === 'Pure Veg') {
        return {
          ...state,
          activeFilterChips: current.includes(chip)
            ? current.filter((item) => item !== chip)
            : [...current.filter((item) => item !== 'Non Veg'), chip],
        }
      }

      if (chip === 'Non Veg') {
        return {
          ...state,
          activeFilterChips: current.includes(chip)
            ? current.filter((item) => item !== chip)
            : [...current.filter((item) => item !== 'Pure Veg'), chip],
        }
      }

      return {
        ...state,
        activeFilterChips: current.includes(chip)
          ? current.filter((item) => item !== chip)
          : [...current, chip],
      }
    }),

  // Reset homepage filters when navigating away from homepage
  resetHomepageFilters: () =>
    set(() => ({
      activeRatingFilter: null,
      activeFilterChips: [],
    })),

  // Set current category context
  setCategory: (category) =>
    set((state) => ({
      ...state,
      currentCategory: category,
      currentSearchQuery: null, // Mutually exclusive with search
    })),

  // Set current search context
  setSearchQuery: (query) =>
    set((state) => ({
      ...state,
      currentSearchQuery: query,
      currentCategory: null, // Mutually exclusive with category
    })),

  // Clear category/search context when navigating away
  resetCategoryContext: () =>
    set(() => ({
      currentCategory: null,
      currentSearchQuery: null,
    })),
}))
