export interface PantryItem {
  item: string;
  category: string;
  quantity_estimate: string;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface RecipeSearchResult {
  text: string;
  groundingChunks?: GroundingChunk[];
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}