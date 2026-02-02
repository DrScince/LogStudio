export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'TRACE';

export interface LogEntry {
  originalLineNumber: number;
  timestamp: string;
  level: LogLevel;
  namespace: string;
  message: string;
  fullText: string;
  isMultiLine: boolean;
  lineCount: number;
}

export interface LogSchema {
  pattern: string;
  timestampFormat: string;
  separator: string;
  fields: {
    timestamp: number;
    level: number;
    namespace: number;
    message: number;
  };
}

export interface LogFile {
  name: string;
  path: string;
}
