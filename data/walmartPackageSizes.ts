// data/walmartPackageSizes.ts
//
// Real-world package-size tiers for common grocery items, used to convert a recipe's
// needed amount (e.g. "2 cups flour") into an accurate number of retail packs, instead
// of defaulting to a flat 1 pack for every weight/volume/container quantity.
//
// These package sizes are real (representative Walmart pack sizes), but the specific
// SKU each item maps to comes from STAPLE_WALMART_MAP (services/groceryCheckoutService.ts)
// by fuzzy name match — this file intentionally carries no product IDs of its own, since
// we don't have confirmed IDs tying a specific SKU to a specific package tier. The
// smallest listed tier is assumed to be the package size of whichever SKU
// STAPLE_WALMART_MAP maps the item to (the conservative choice: underestimating pack
// size means rounding up to an extra pack rather than silently under-buying).
export interface PackageOption {
  packageAmount: number;
  packageUnit: string;
}

export interface ProductPackageSizes {
  name: string;
  options: PackageOption[];
}

export const WALMART_PACKAGE_SIZE_DATA: ProductPackageSizes[] = [
  { name: 'All-Purpose Flour', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 5, packageUnit: 'lb' }, { packageAmount: 10, packageUnit: 'lb' }] },
  { name: 'Granulated Sugar', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 4, packageUnit: 'lb' }, { packageAmount: 10, packageUnit: 'lb' }] },
  { name: 'Long Grain White Rice', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 3, packageUnit: 'lb' }, { packageAmount: 20, packageUnit: 'lb' }] },
  { name: 'Whole Milk', options: [{ packageAmount: 1, packageUnit: 'qt' }, { packageAmount: 0.5, packageUnit: 'gal' }, { packageAmount: 1, packageUnit: 'gal' }] },
  { name: 'Large White Eggs', options: [{ packageAmount: 6, packageUnit: 'count' }, { packageAmount: 12, packageUnit: 'count' }, { packageAmount: 18, packageUnit: 'count' }, { packageAmount: 60, packageUnit: 'count' }] },
  { name: 'Salted Butter', options: [{ packageAmount: 8, packageUnit: 'oz' }, { packageAmount: 16, packageUnit: 'oz' }] },
  { name: 'Extra Virgin Olive Oil', options: [{ packageAmount: 16.9, packageUnit: 'fl oz' }, { packageAmount: 25.4, packageUnit: 'fl oz' }, { packageAmount: 50.7, packageUnit: 'fl oz' }, { packageAmount: 101.4, packageUnit: 'fl oz' }] },
  { name: 'Russet Potatoes', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 5, packageUnit: 'lb' }, { packageAmount: 10, packageUnit: 'lb' }] },
  { name: 'Yellow Onions', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 3, packageUnit: 'lb' }, { packageAmount: 5, packageUnit: 'lb' }] },
  { name: 'Boneless Skinless Chicken Breast', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 2.5, packageUnit: 'lb' }, { packageAmount: 5, packageUnit: 'lb' }] },
  { name: 'Ground Beef 80/20', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 3, packageUnit: 'lb' }, { packageAmount: 5, packageUnit: 'lb' }] },
  { name: 'Spaghetti Pasta', options: [{ packageAmount: 16, packageUnit: 'oz' }, { packageAmount: 32, packageUnit: 'oz' }] },
  { name: 'Creamy Peanut Butter', options: [{ packageAmount: 16, packageUnit: 'oz' }, { packageAmount: 40, packageUnit: 'oz' }, { packageAmount: 64, packageUnit: 'oz' }] },
  { name: 'Ground Coffee', options: [{ packageAmount: 12, packageUnit: 'oz' }, { packageAmount: 25.9, packageUnit: 'oz' }, { packageAmount: 48, packageUnit: 'oz' }] },
  { name: 'Black Beans', options: [{ packageAmount: 15.25, packageUnit: 'oz' }, { packageAmount: 29, packageUnit: 'oz' }] },
  { name: 'Yellow Bananas', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 3, packageUnit: 'lb' }] },
  { name: 'Whole Carrots', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 2, packageUnit: 'lb' }, { packageAmount: 5, packageUnit: 'lb' }] },
  { name: 'Gala Apples', options: [{ packageAmount: 3, packageUnit: 'lb' }, { packageAmount: 5, packageUnit: 'lb' }] },
  { name: 'Fresh Spinach', options: [{ packageAmount: 10, packageUnit: 'oz' }, { packageAmount: 16, packageUnit: 'oz' }] },
  { name: 'Roma Tomatoes', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 3, packageUnit: 'lb' }] },
  { name: 'Fresh Strawberries', options: [{ packageAmount: 16, packageUnit: 'oz' }, { packageAmount: 32, packageUnit: 'oz' }] },
  { name: 'Broccoli Crowns', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 2, packageUnit: 'lb' }] },
  { name: 'Hass Avocados', options: [{ packageAmount: 1, packageUnit: 'count' }, { packageAmount: 4, packageUnit: 'count' }, { packageAmount: 6, packageUnit: 'count' }] },
  { name: 'Ground Turkey 93/7', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 3, packageUnit: 'lb' }] },
  { name: 'Assorted Pork Chops', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 2.5, packageUnit: 'lb' }] },
  { name: 'Thick Cut Bacon', options: [{ packageAmount: 12, packageUnit: 'oz' }, { packageAmount: 24, packageUnit: 'oz' }, { packageAmount: 48, packageUnit: 'oz' }] },
  { name: 'Shredded Mild Cheddar Cheese', options: [{ packageAmount: 8, packageUnit: 'oz' }, { packageAmount: 16, packageUnit: 'oz' }, { packageAmount: 32, packageUnit: 'oz' }] },
  { name: 'Plain Greek Yogurt', options: [{ packageAmount: 5.3, packageUnit: 'oz' }, { packageAmount: 32, packageUnit: 'oz' }] },
  { name: 'Original Cream Cheese', options: [{ packageAmount: 8, packageUnit: 'oz' }, { packageAmount: 16, packageUnit: 'oz' }] },
  { name: 'Original Sour Cream', options: [{ packageAmount: 8, packageUnit: 'oz' }, { packageAmount: 16, packageUnit: 'oz' }, { packageAmount: 24, packageUnit: 'oz' }] },
  { name: 'Petite Diced Tomatoes', options: [{ packageAmount: 14.5, packageUnit: 'oz' }, { packageAmount: 28, packageUnit: 'oz' }] },
  { name: 'Chicken Broth', options: [{ packageAmount: 14.5, packageUnit: 'oz' }, { packageAmount: 32, packageUnit: 'oz' }, { packageAmount: 48, packageUnit: 'oz' }] },
  { name: 'Whole Kernel Sweet Corn', options: [{ packageAmount: 15.25, packageUnit: 'oz' }, { packageAmount: 29, packageUnit: 'oz' }] },
  { name: 'Chunk Light Tuna in Water', options: [{ packageAmount: 5, packageUnit: 'oz' }, { packageAmount: 12, packageUnit: 'oz' }] },
  { name: 'Old Fashioned Rolled Oats', options: [{ packageAmount: 18, packageUnit: 'oz' }, { packageAmount: 42, packageUnit: 'oz' }] },
  { name: 'Tomato Ketchup', options: [{ packageAmount: 20, packageUnit: 'oz' }, { packageAmount: 38, packageUnit: 'oz' }, { packageAmount: 64, packageUnit: 'oz' }] },
  { name: 'Real Mayonnaise', options: [{ packageAmount: 15, packageUnit: 'fl oz' }, { packageAmount: 30, packageUnit: 'fl oz' }, { packageAmount: 48, packageUnit: 'fl oz' }] },
  { name: 'Less Sodium Soy Sauce', options: [{ packageAmount: 10, packageUnit: 'fl oz' }, { packageAmount: 15, packageUnit: 'fl oz' }, { packageAmount: 64, packageUnit: 'fl oz' }] },
  { name: 'Original Macaroni & Cheese', options: [{ packageAmount: 7.25, packageUnit: 'oz' }, { packageAmount: 14, packageUnit: 'oz' }] },
  { name: 'Frozen Mixed Vegetables', options: [{ packageAmount: 12, packageUnit: 'oz' }, { packageAmount: 32, packageUnit: 'oz' }] },
  { name: 'Fresh Sweet Onions', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 3, packageUnit: 'lb' }] },
  { name: 'Whole Green Asparagus', options: [{ packageAmount: 1, packageUnit: 'lb' }, { packageAmount: 2, packageUnit: 'lb' }] },
  { name: 'Red Seedless Grapes', options: [{ packageAmount: 1.5, packageUnit: 'lb' }, { packageAmount: 3, packageUnit: 'lb' }] },
  { name: 'Smoked Turkey Sausage', options: [{ packageAmount: 13, packageUnit: 'oz' }, { packageAmount: 26, packageUnit: 'oz' }] },
  { name: 'Beef Hot Dogs', options: [{ packageAmount: 15, packageUnit: 'oz' }, { packageAmount: 30, packageUnit: 'oz' }] },
  { name: 'Thin Sliced Deli Ham', options: [{ packageAmount: 9, packageUnit: 'oz' }, { packageAmount: 16, packageUnit: 'oz' }] },
  { name: 'Heavy Whipping Cream', options: [{ packageAmount: 8, packageUnit: 'fl oz' }, { packageAmount: 16, packageUnit: 'fl oz' }, { packageAmount: 32, packageUnit: 'fl oz' }] },
  { name: 'Grated Parmesan Cheese', options: [{ packageAmount: 8, packageUnit: 'oz' }, { packageAmount: 16, packageUnit: 'oz' }] },
  { name: 'Sliced Provolone Cheese', options: [{ packageAmount: 8, packageUnit: 'oz' }, { packageAmount: 16, packageUnit: 'oz' }] },
  { name: 'Garlic Powder', options: [{ packageAmount: 3.4, packageUnit: 'oz' }, { packageAmount: 10.5, packageUnit: 'oz' }] },
  { name: 'Onion Powder', options: [{ packageAmount: 3.25, packageUnit: 'oz' }, { packageAmount: 9.25, packageUnit: 'oz' }] },
  { name: 'Vegetable Oil', options: [{ packageAmount: 48, packageUnit: 'fl oz' }, { packageAmount: 128, packageUnit: 'fl oz' }] },
  { name: 'Baking Soda', options: [{ packageAmount: 16, packageUnit: 'oz' }, { packageAmount: 64, packageUnit: 'oz' }] },
  { name: 'Light Brown Sugar', options: [{ packageAmount: 32, packageUnit: 'oz' }, { packageAmount: 64, packageUnit: 'oz' }] },
  { name: 'White Sandwich Bread', options: [{ packageAmount: 20, packageUnit: 'oz' }, { packageAmount: 40, packageUnit: 'oz' }] },
  { name: 'Cut Green Beans', options: [{ packageAmount: 14.5, packageUnit: 'oz' }, { packageAmount: 28, packageUnit: 'oz' }] },
  { name: 'Tomato Sauce', options: [{ packageAmount: 8, packageUnit: 'oz' }, { packageAmount: 15, packageUnit: 'oz' }, { packageAmount: 29, packageUnit: 'oz' }] },
  { name: 'Cream of Chicken Condensed Soup', options: [{ packageAmount: 10.5, packageUnit: 'oz' }, { packageAmount: 22.6, packageUnit: 'oz' }] },
  { name: 'Sriracha Hot Chili Sauce', options: [{ packageAmount: 9, packageUnit: 'oz' }, { packageAmount: 17, packageUnit: 'oz' }, { packageAmount: 28, packageUnit: 'oz' }] },
  { name: 'Fully Cooked Chicken Nuggets', options: [{ packageAmount: 32, packageUnit: 'oz' }, { packageAmount: 64, packageUnit: 'oz' }] },
  { name: 'Frozen Broccoli Florets', options: [{ packageAmount: 12, packageUnit: 'oz' }, { packageAmount: 32, packageUnit: 'oz' }] },
  { name: 'Cheese Tortellini Pasta', options: [{ packageAmount: 19, packageUnit: 'oz' }, { packageAmount: 36, packageUnit: 'oz' }] },
  { name: 'Frozen Wild Blueberries', options: [{ packageAmount: 15, packageUnit: 'oz' }, { packageAmount: 32, packageUnit: 'oz' }] },
  { name: 'Distilled Water', options: [{ packageAmount: 1, packageUnit: 'gal' }, { packageAmount: 6, packageUnit: 'gal' }] },
  { name: 'Orange Juice No Pulp', options: [{ packageAmount: 52, packageUnit: 'fl oz' }, { packageAmount: 89, packageUnit: 'fl oz' }] },
];
