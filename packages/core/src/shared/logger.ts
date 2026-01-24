/**
 * Shared logger utility for consistent logging across the library
 */

const DEBUG = true;

/**
 * Create a logger for a specific module
 * @param moduleName Name of the module (e.g., 'AudioInstance', 'PlaybackSync')
 * @param instanceId Optional instance ID to include in logs
 */
export function createLogger(moduleName: string, instanceId?: string) {
    const prefix = instanceId 
        ? `[${moduleName}:${instanceId.slice(0, 4)}]`
        : `[${moduleName}]`;

    return (...args: any[]) => {
        if (DEBUG) {
            console.log(prefix, ...args);
        }
    };
}

/**
 * Global debug flag
 */
export function isDebugEnabled(): boolean {
    return DEBUG;
}
