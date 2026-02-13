// Input validation utilities for the Smart Pantry Chef app
// Provides comprehensive validation for forms, user inputs, and data integrity

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidators?: ((value: any) => string | null)[];
}

// Common validation patterns
export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  url: /^https?:\/\/.+/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  name: /^[a-zA-Z\s\-']+$/,
  quantity: /^[\d\s½¼¾⅓⅔⅛⅜⅝⅞⅙⅚⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+(?:\s*[a-zA-Z]+)?$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
} as const;

// Generic validation function
export function validateField(
  value: any,
  fieldName: string,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required validation
  if (options.required && (value === null || value === undefined || value === '')) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors, warnings };
  }

  // Skip other validations if value is empty and not required
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errors: [], warnings: [] };
  }

  const stringValue = String(value);

  // Length validations
  if (options.minLength && stringValue.length < options.minLength) {
    errors.push(`${fieldName} must be at least ${options.minLength} characters long`);
  }

  if (options.maxLength && stringValue.length > options.maxLength) {
    errors.push(`${fieldName} must be no more than ${options.maxLength} characters long`);
  }

  // Pattern validation
  if (options.pattern && !options.pattern.test(stringValue)) {
    errors.push(`${fieldName} format is invalid`);
  }

  // Custom validators
  if (options.customValidators) {
    for (const validator of options.customValidators) {
      const error = validator(value);
      if (error) {
        errors.push(error);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Specific validation functions for common fields
export function validateEmail(email: string): ValidationResult {
  return validateField(email, 'Email', {
    required: true,
    pattern: PATTERNS.email,
    maxLength: 254
  });
}

export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (!password || password.length === 0) {
    errors.push('Password is required');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: []
  };
}

export function validateName(name: string): ValidationResult {
  return validateField(name, 'Name', {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: PATTERNS.name,
    customValidators: [
      (value) => {
        if (value && value.length > 0 && /^\s|\s$/.test(value)) {
          return 'Name should not start or end with spaces';
        }
        return null;
      }
    ]
  });
}

export function validateQuantity(quantity: string): ValidationResult {
  return validateField(quantity, 'Quantity', {
    required: true,
    maxLength: 20,
    customValidators: [
      (value) => {
        if (value && !PATTERNS.quantity.test(value)) {
          return 'Quantity should be a number with optional unit (e.g., "2 cups", "1.5 lbs")';
        }
        // Extract numeric part and check if it's at least 1
        const numericMatch = value.match(/^(\d+(?:\.\d+)?)/);
        if (numericMatch) {
          const numericValue = parseFloat(numericMatch[1]);
          if (numericValue < 1) {
            return 'Quantity must be at least 1';
          }
        }
        return null;
      }
    ]
  });
}

export function validateItemName(name: string): ValidationResult {
  return validateField(name, 'Item name', {
    required: true,
    minLength: 2,
    maxLength: 100,
    customValidators: [
      (value) => {
        if (value && value.length > 0) {
          // Check for excessive special characters
          const specialCharCount = (value.match(/[^a-zA-Z0-9\s\-']/g) || []).length;
          if (specialCharCount > value.length * 0.3) {
            return 'Item name contains too many special characters';
          }
        }
        return null;
      }
    ]
  });
}

export function validateRecipeTitle(title: string): ValidationResult {
  return validateField(title, 'Recipe title', {
    required: true,
    minLength: 3,
    maxLength: 200,
    customValidators: [
      (value) => {
        if (value && value.length > 0 && /^\s|\s$/.test(value)) {
          return 'Recipe title should not start or end with spaces';
        }
        return null;
      }
    ]
  });
}

export function validateURL(url: string): ValidationResult {
  return validateField(url, 'URL', {
    pattern: PATTERNS.url,
    maxLength: 2048
  });
}

// Batch validation for forms
export function validateForm(fields: Record<string, { value: any; rules: ValidationOptions }>): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (const [fieldName, { value, rules }] of Object.entries(fields)) {
    const result = validateField(value, fieldName, rules);
    allErrors.push(...result.errors);
    if (result.warnings) {
      allWarnings.push(...result.warnings);
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

// Sanitization functions
export function sanitizeString(input: string): string {
  if (!input) return '';

  return input
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

export function sanitizeHTML(input: string): string {
  if (!input) return '';

  // Basic HTML sanitization - remove script tags and dangerous attributes
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .trim();
}

// Rate limiting helper
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(private maxAttempts: number = 5, private windowMs: number = 60000) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);

    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }

    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Export a default rate limiter instance
export const defaultRateLimiter = new RateLimiter();