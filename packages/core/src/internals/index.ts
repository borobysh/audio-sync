/**
 * Internal modules for advanced usage.
 * These APIs may change between minor versions.
 * Use at your own risk.
 */

// Internal classes
export { Driver } from "../model/Driver";
export { Engine } from "../model/Engine";
export { EventEmitter } from "../model/EventEmitter";

// Internal types
export type { AudioEngineContract, EngineEventType } from "../model/types/engine.types";
export type { AudioElementContract } from "../model/types/driver.types";
export { AudioReadyState } from "../model/types/driver.types";
export type { AudioInstanceEventType, AudioInstanceEventData } from "../model/types/eventEmitter.types";

// Internal configs
export { DEFAULT_PLAYER_STATE } from "../config/engine.config";
