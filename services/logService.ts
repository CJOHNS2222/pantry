export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: Date;
  context?: string;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  // Default level: verbose in dev, conservative in prod
  private currentLevel: LogLevel = (typeof (import.meta as any).env !== 'undefined' && (import.meta as any).env.DEV)
    ? LogLevel.DEBUG
    : LogLevel.WARN;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private addLog(level: LogLevel, message: string, data?: any, context?: string): void {
    const entry = {
      level,
      message,
      data,
      timestamp: new Date(),
      context
    };

    this.logs.push(entry as LogEntry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to console with appropriate method
    const consoleMethod = this.getConsoleMethod(level);
    const prefix = `[${LogLevel[level]}]${context ? ` [${context}]` : ''}`;

    if (data !== undefined) {
      consoleMethod(`${prefix} ${message}`, data);
    } else {
      consoleMethod(`${prefix} ${message}`);
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }

  debug(message: string, data?: any, context?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.addLog(LogLevel.DEBUG, message, data, context);
    }
  }

  info(message: string, data?: any, context?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.addLog(LogLevel.INFO, message, data, context);
    }
  }

  warn(message: string, data?: any, context?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.addLog(LogLevel.WARN, message, data, context);
    }
  }

  error(message: string, data?: any, context?: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      let logMessage = message;
      let payload: any = undefined;
      if (typeof data === 'string') {
        logMessage = `${message} - ${data}`;
      } else if (data instanceof Error) {
        logMessage = `${message} - ${data.message}`;
        payload = { stack: data.stack, ...data };
      } else if (data !== undefined) {
        payload = data;
      }
      this.addLog(LogLevel.ERROR, logMessage, payload, context);
    }
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Get logs by context
  getLogsByContext(context: string): LogEntry[] {
    return this.logs.filter(log => log.context === context);
  }

  // Clear all logs
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs for external analysis
  exportLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Performance timing helpers
  startTimer(label: string, context?: string): () => void {
    const startTime = performance.now();
    this.debug(`Timer started: ${label}`, { startTime }, context);

    return () => {
      const duration = performance.now() - startTime;
      this.info(`Timer ended: ${label}`, { duration: `${duration.toFixed(2)}ms` }, context);
      return duration;
    };
  }

  // Async operation wrapper
  async timeAsync<T>(
    label: string,
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    const endTimer = this.startTimer(label, context);
    try {
      const result = await operation();
      endTimer();
      return result;
    } catch (err: any) {
      endTimer();
      this.error(`Async operation failed: ${label}`, err, context);
      throw err;
    }
  }
}

// Create and export the singleton instance
const logger = Logger.getInstance();

// Convenience functions for direct use
export const log = {
  debug: (message: string, data?: any, context?: string) => logger.debug(message, data, context),
  info: (message: string, data?: any, context?: string) => logger.info(message, data, context),
  warn: (message: string, data?: any, context?: string) => logger.warn(message, data, context),
  error: (message: string, data?: any, context?: string) => logger.error(message, data, context),

  // Performance helpers
  startTimer: (label: string, context?: string) => logger.startTimer(label, context),
  timeAsync: <T>(label: string, operation: () => Promise<T>, context?: string) =>
    logger.timeAsync(label, operation, context),

  // Log management
  getRecentLogs: (count?: number) => logger.getRecentLogs(count),
  getLogsByLevel: (level: LogLevel) => logger.getLogsByLevel(level),
  getLogsByContext: (context: string) => logger.getLogsByContext(context),
  clearLogs: () => logger.clearLogs(),
  exportLogs: () => logger.exportLogs(),
  setLevel: (level: LogLevel) => logger.setLevel(level)
};

export default logger;
