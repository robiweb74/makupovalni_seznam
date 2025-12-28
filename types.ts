
export interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  category?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ListItem[];
  createdAt: number;
}

export type View = 'home' | 'list';
