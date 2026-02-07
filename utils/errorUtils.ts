// utils/errorUtils.ts
export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_LOST = 'CONNECTION_LOST',

  // Firebase errors
  FIRESTORE_ERROR = 'FIRESTORE_ERROR',
  FIREBASE_AUTH_ERROR = 'FIREBASE_AUTH_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // API errors
  API_ERROR = 'API_ERROR',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_UNAVAILABLE = 'API_UNAVAILABLE',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Business logic errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  OPERATION_FAILED = 'OPERATION_FAILED',

  // Usage limits
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode?: number;
  public readonly originalError?: Error;
  public readonly context?: Record<string, any>;
  public readonly retryable: boolean;
  public readonly userMessage: string;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    options: {
      statusCode?: number;
      originalError?: Error;
      context?: Record<string, any>;
      retryable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.statusCode;
    this.originalError = options.originalError;
    this.context = options.context;
    this.retryable = options.retryable ?? false;
    this.userMessage = userMessage;
  }

  static fromFirebaseError(error: any, context?: Record<string, any>): AppError {
    const firebaseError = error as { code?: string; message?: string };

    switch (firebaseError.code) {
      case 'permission-denied':
        return new AppError(
          ErrorCode.PERMISSION_DENIED,
          firebaseError.message || 'Permission denied',
          'You don\'t have permission to perform this action.',
          { originalError: error, context, retryable: false }
        );
      case 'unavailable':
        return new AppError(
          ErrorCode.CONNECTION_LOST,
          firebaseError.message || 'Service unavailable',
          'Connection lost. Please check your internet connection and try again.',
          { originalError: error, context, retryable: true }
        );
      case 'deadline-exceeded':
        return new AppError(
          ErrorCode.TIMEOUT_ERROR,
          firebaseError.message || 'Operation timed out',
          'The operation took too long. Please try again.',
          { originalError: error, context, retryable: true }
        );
      default:
        return new AppError(
          ErrorCode.FIRESTORE_ERROR,
          firebaseError.message || 'Database operation failed',
          'Something went wrong. Please try again.',
          { originalError: error, context, retryable: true }
        );
    }
  }

  static fromNetworkError(error: any, context?: Record<string, any>): AppError {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new AppError(
        ErrorCode.NETWORK_ERROR,
        error.message,
        'Network connection failed. Please check your internet connection.',
        { originalError: error, context, retryable: true }
      );
    }

    if (error.name === 'AbortError') {
      return new AppError(
        ErrorCode.TIMEOUT_ERROR,
        error.message,
        'Request timed out. Please try again.',
        { originalError: error, context, retryable: true }
      );
    }

    return new AppError(
      ErrorCode.API_ERROR,
      error.message || 'Network request failed',
      'Unable to connect to the service. Please try again later.',
      { originalError: error, context, retryable: true }
    );
  }

  static fromApiError(response: Response, context?: Record<string, any>): AppError {
    switch (response.status) {
      case 401:
        return new AppError(
          ErrorCode.PERMISSION_DENIED,
          `API returned ${response.status}`,
          'Authentication required. Please sign in again.',
          { statusCode: response.status, context, retryable: false }
        );
      case 403:
        return new AppError(
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          `API returned ${response.status}`,
          'You don\'t have permission to perform this action.',
          { statusCode: response.status, context, retryable: false }
        );
      case 404:
        return new AppError(
          ErrorCode.RESOURCE_NOT_FOUND,
          `API returned ${response.status}`,
          'The requested resource was not found.',
          { statusCode: response.status, context, retryable: false }
        );
      case 429:
        return new AppError(
          ErrorCode.API_RATE_LIMIT,
          `API returned ${response.status}`,
          'Too many requests. Please wait a moment and try again.',
          { statusCode: response.status, context, retryable: true }
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new AppError(
          ErrorCode.API_UNAVAILABLE,
          `API returned ${response.status}`,
          'Service is temporarily unavailable. Please try again later.',
          { statusCode: response.status, context, retryable: true }
        );
      default:
        return new AppError(
          ErrorCode.API_ERROR,
          `API returned ${response.status}`,
          'An error occurred while communicating with the service.',
          { statusCode: response.status, context, retryable: true }
        );
    }
  }
}

/**
 * Error handling wrapper for async operations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>,
  options: {
    retries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, error: AppError) => void;
  } = {}
): Promise<T> {
  const { retries = 0, retryDelay = 1000, onRetry } = options;
  let lastError: AppError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof AppError ? error : new AppError(
        ErrorCode.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'Unknown error occurred',
        'An unexpected error occurred. Please try again.',
        { originalError: error instanceof Error ? error : undefined, context, retryable: false }
      );

      // Log error for debugging
      console.error(`Operation failed (attempt ${attempt + 1}/${retries + 1}):`, {
        code: lastError.code,
        message: lastError.message,
        context,
        retryable: lastError.retryable
      });

      // If this is the last attempt or error is not retryable, throw
      if (attempt === retries || !lastError.retryable) {
        throw lastError;
      }

      // Call retry callback if provided
      onRetry?.(attempt + 1, lastError);

      // Wait before retrying
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError!;
}

/**
 * Safe async operation that never throws - returns Result type
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError(
      ErrorCode.UNKNOWN_ERROR,
      error instanceof Error ? error.message : 'Unknown error occurred',
      'An unexpected error occurred.',
      { originalError: error instanceof Error ? error : undefined, context, retryable: false }
    );
    return { success: false, error: appError };
  }
}