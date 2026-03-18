import * as fs from 'fs';
import * as path from 'path';

export const logger = {
  logFile: path.join(process.cwd(), 'todoist-mcp-server.log'),
  _writeToFile(message: string) {
    try { fs.appendFileSync(this.logFile, message + '\n'); } catch (error) {}
  },
  info(message: string, ...args: any[]) {
    const msg = `[INFO] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}`;
    this._writeToFile(msg);
  },
  warn(message: string, ...args: any[]) {
    const msg = `[WARN] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}`;
    this._writeToFile(msg);
  },
  error(message: string, ...args: any[]) {
    const msg = `[ERROR] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}`;
    this._writeToFile(msg);
  }
};
