/**
 * Shared logger utility for consistent logging across the library
 */

let DEBUG = false;

/**
 * Enable or disable debug logging for the entire library
 * @param enabled Whether to enable debug logging
 * @example
 * ```typescript
 * import { setDebugMode } from '@audio-sync/core';
 * 
 * // Enable debug logging
 * setDebugMode(true);
 * 
 * // Disable debug logging
 * setDebugMode(false);
 * ```
 */
export function setDebugMode(enabled: boolean): void {
    DEBUG = enabled;
}

/**
 * Check if debug mode is currently enabled
 * @returns Current debug mode state
 */
export function isDebugEnabled(): boolean {
    return DEBUG;
}

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
