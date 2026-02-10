export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL_NAMES: Record<number, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
};

export class Logger {
  private level: LogLevel;

  constructor(level?: LogLevel) {
    this.level = level ?? this.parseEnvLevel();
  }

  private parseEnvLevel(): LogLevel {
    const env = process.env.ENSEMBL_LOG_LEVEL?.toUpperCase();
    if (env && env in LogLevel) {
      return LogLevel[env as keyof typeof LogLevel] as unknown as LogLevel;
    }
    return LogLevel.INFO;
  }

  private log(
    level: LogLevel,
    event: string,
    data?: Record<string, unknown>
  ): void {
    if (level < this.level) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      event,
      ...data,
    };
    process.stderr.write(JSON.stringify(entry) + "\n");
  }

  debug(event: string, data?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, event, data);
  }
  info(event: string, data?: Record<string, unknown>) {
    this.log(LogLevel.INFO, event, data);
  }
  warn(event: string, data?: Record<string, unknown>) {
    this.log(LogLevel.WARN, event, data);
  }
  error(event: string, data?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, event, data);
  }
}

export const logger = new Logger();
