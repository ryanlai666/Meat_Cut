import { MeatCut, SortOption, FilterState } from '../types';

export function filterAndSortMeatCuts(
  meatCuts: MeatCut[],
  filters: FilterState
): MeatCut[] {
  // Filter by search query (name and tags/cooking methods) using OR logic for multiple keywords
  let filtered = meatCuts.filter((cut) => {
    if (!filters.searchQuery.trim()) return true;
    
    // Split search query into keywords, filtering out empty strings
    const keywords = filters.searchQuery.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    
    if (keywords.length === 0) return true;

    // Check if ANY keyword matches ANY field (OR logic between keywords)
    return keywords.some(keyword => {
      const matchesName = cut.name.toLowerCase().includes(keyword) ||
                         cut.chineseName.toLowerCase().includes(keyword);
      const matchesTags = cut.cookingMethods.some(method => 
        method.toLowerCase().includes(keyword)
      ) || cut.part.toLowerCase().includes(keyword);
      
      return matchesName || matchesTags;
    });
  });

  // Filter by price range
  filtered = filtered.filter((cut) => {
    const meanPrice = cut.priceRange.mean;
    return meanPrice >= filters.priceRange[0] && meanPrice <= filters.priceRange[1];
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (filters.sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'cut':
        return a.part.localeCompare(b.part);
      case 'cookingMethod':
        const aMethod = a.cookingMethods[0] || '';
        const bMethod = b.cookingMethods[0] || '';
        return aMethod.localeCompare(bMethod);
      case 'price':
        return a.priceRange.mean - b.priceRange.mean;
      default:
        return 0;
    }
  });

  return sorted;
}

export function getPriceRangeFromCuts(meatCuts: MeatCut[]): [number, number] {
  if (meatCuts.length === 0) return [0, 100];
  
  const prices = meatCuts.map(cut => cut.priceRange.mean);
  const min = Math.floor(Math.min(...prices));
  const max = Math.ceil(Math.max(...prices));
  
  return [min, max];
}
