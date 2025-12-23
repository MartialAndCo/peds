import fs from 'fs';
import path from 'path';

export const logger = {
    log: (message: string, data?: any) => {
        const logEntry = `[${new Date().toISOString()}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
        try {
            fs.appendFileSync(path.join(process.cwd(), 'debug.log'), logEntry);
        } catch (e) {
            console.error('Failed to write to debug.log', e);
        }
    },
    error: (message: string, error?: any) => {
        const logEntry = `[${new Date().toISOString()}] [ERROR] ${message} ${error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : ''}\n`;
        try {
            fs.appendFileSync(path.join(process.cwd(), 'debug.log'), logEntry);
        } catch (e) {
            console.error('Failed to write to debug.log', e);
        }
    }
};
