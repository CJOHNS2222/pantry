import { validateItemName, validateQuantity } from '../src/utils/validation';

export interface PantryItemValidation {
  isValid: boolean;
  error?: string;
}

export function validatePantryItem(itemName: string, quantity: number): PantryItemValidation {
  // Validate item name
  const nameValidation = validateItemName(itemName);
  if (!nameValidation.isValid) {
    return {
      isValid: false,
      error: nameValidation.errors.join(', ')
    };
  }

  // Validate quantity (convert number to string for validation)
  const quantityValidation = validateQuantity(quantity.toString());
  if (!quantityValidation.isValid) {
    return {
      isValid: false,
      error: quantityValidation.errors.join(', ')
    };
  }

  return { isValid: true };
}
