/** Parent rollups for dashboard pie / bars; children are stored on each transaction. */
export const PARENT_CATEGORIES: Record<string, readonly string[]> = {
  Shopping: ['Shopping - Home', 'Shopping - General', 'Shopping - Clothing', 'Shopping - Online'],
  Groceries: ['Groceries', 'Alcohol & Liquor'],
  Utilities: ['Utilities', 'Fees & Charges', 'Auto & Maintenance'],
  Transportation: ['Gas & Fuel', 'Rides & Transit', 'Transportation'],
  'Food & Dining': ['Restaurants & Dining', 'Convenience Store'],
  Lifestyle: ['Entertainment', 'Subscriptions'],
};

/** child category string → parent name (for filters & deep links). */
export const CHILD_TO_PARENT: Record<string, string> = {};
for (const [parent, children] of Object.entries(PARENT_CATEGORIES)) {
  for (const child of children) {
    CHILD_TO_PARENT[child] = parent;
  }
}

export const PARENT_CATEGORY_NAMES = Object.keys(PARENT_CATEGORIES) as readonly string[];

/** True if transaction category should show when the given filter is selected (exact leaf or whole parent). */
export function transactionMatchesCategoryFilter(txnCategory: string, filterCategory: string): boolean {
  if (!filterCategory) return true;
  if (txnCategory === filterCategory) return true;
  return CHILD_TO_PARENT[txnCategory] === filterCategory;
}
