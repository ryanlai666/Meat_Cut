export interface MeatCut {
  id: number;
  name: string;
  chineseName: string;
  part: string;
  lean: boolean;
  priceRange: {
    min: number;
    max: number;
    mean: number;
    display: string;
  };
  cookingMethods: string[];
  recommendedDishes: string[];
  textureNotes: string;
  imageReference: string;
  imagePath: string;
  googleDriveImageId?: string | null;
  googleDriveImageUrl?: string | null;
}

export type SortOption = 'name' | 'cut' | 'cookingMethod' | 'price';

export interface FilterState {
  searchQuery: string;
  priceRange: [number, number];
  sortBy: SortOption;
}
