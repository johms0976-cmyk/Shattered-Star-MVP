/**
 * EventBus - Centralized event system for decoupled communication
 * Enables systems to communicate without direct dependencies
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
        this.debug = false;
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @param {Object} context - Optional context for 'this' binding
     * @returns {Function} Unsubscribe function
     */
    on(event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        
        const handler = { callback, context };
        this.listeners.get(event).push(handler);
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @param {Object} context - Optional context
     */
    once(event, callback, context = null) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, []);
        }
        this.onceListeners.get(event).push({ callback, context });
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const handlers = this.listeners.get(event);
            const index = handlers.findIndex(h => h.callback === callback);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data = null) {
        if (this.debug) {
            console.log(`[EventBus] ${event}`, data);
        }

        // Record event history
        this.eventHistory.push({
            event,
            data,
            timestamp: Date.now()
        });
        
        // Trim history if needed
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        // Regular listeners
        if (this.listeners.has(event)) {
            const handlers = [...this.listeners.get(event)];
            handlers.forEach(({ callback, context }) => {
                try {
                    callback.call(context, data);
                } catch (error) {
                    console.error(`[EventBus] Error in handler for ${event}:`, error);
                }
            });
        }

        // Once listeners
        if (this.onceListeners.has(event)) {
            const handlers = this.onceListeners.get(event);
            this.onceListeners.delete(event);
            handlers.forEach(({ callback, context }) => {
                try {
                    callback.call(context, data);
                } catch (error) {
                    console.error(`[EventBus] Error in once handler for ${event}:`, error);
                }
            });
        }

        // Emit wildcard event for debugging
        if (event !== '*' && this.listeners.has('*')) {
            this.listeners.get('*').forEach(({ callback, context }) => {
                callback.call(context, { event, data });
            });
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name (optional, clears all if not provided)
     */
    clear(event = null) {
        if (event) {
            this.listeners.delete(event);
            this.onceListeners.delete(event);
        } else {
            this.listeners.clear();
            this.onceListeners.clear();
        }
    }

    /**
     * Get recent event history
     * @param {number} count - Number of events to return
     * @returns {Array} Recent events
     */
    getHistory(count = 10) {
        return this.eventHistory.slice(-count);
    }

    /**
     * Enable/disable debug logging
     * @param {boolean} enabled 
     */
    setDebug(enabled) {
        this.debug = enabled;
    }
}

// Event name constants for type safety
export const GameEvents = {
    // Core game events
    GAME_INIT: 'game:init',
    GAME_START: 'game:start',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    GAME_OVER: 'game:over',
    GAME_VICTORY: 'game:victory',
    
    // Screen events
    SCREEN_CHANGE: 'screen:change',
    SCREEN_TRANSITION_START: 'screen:transition:start',
    SCREEN_TRANSITION_END: 'screen:transition:end',
    
    // Run events
    RUN_START: 'run:start',
    RUN_END: 'run:end',
    ACT_START: 'act:start',
    ACT_END: 'act:end',
    
    // Map events
    MAP_GENERATED: 'map:generated',
    NODE_SELECTED: 'node:selected',
    NODE_COMPLETED: 'node:completed',
    PATH_REVEALED: 'path:revealed',
    
    // Combat events
    COMBAT_START: 'combat:start',
    COMBAT_END: 'combat:end',
    TURN_START: 'turn:start',
    TURN_END: 'turn:end',
    PLAYER_TURN_START: 'player:turn:start',
    PLAYER_TURN_END: 'player:turn:end',
    ENEMY_TURN_START: 'enemy:turn:start',
    ENEMY_TURN_END: 'enemy:turn:end',
    
    // Card events
    CARD_DRAWN: 'card:drawn',
    CARD_PLAYED: 'card:played',
    CARD_DISCARDED: 'card:discarded',
    CARD_EXHAUSTED: 'card:exhausted',
    CARD_ADDED: 'card:added',
    CARD_REMOVED: 'card:removed',
    CARD_UPGRADED: 'card:upgraded',
    CARD_TRANSFORMED: 'card:transformed',
    HAND_UPDATED: 'hand:updated',
    
    // Damage/Health events
    DAMAGE_DEALT: 'damage:dealt',
    DAMAGE_TAKEN: 'damage:taken',
    BLOCK_GAINED: 'block:gained',
    BLOCK_LOST: 'block:lost',
    HEAL: 'heal',
    HP_CHANGED: 'hp:changed',
    MAX_HP_CHANGED: 'max_hp:changed',
    
    // Enemy events
    ENEMY_SPAWN: 'enemy:spawn',
    ENEMY_DEATH: 'enemy:death',
    ENEMY_INTENT_SET: 'enemy:intent:set',
    ENEMY_ACTION: 'enemy:action',
    
    // Status effect events
    STATUS_APPLIED: 'status:applied',
    STATUS_REMOVED: 'status:removed',
    STATUS_TRIGGERED: 'status:triggered',
    
    // Energy events
    ENERGY_GAINED: 'energy:gained',
    ENERGY_SPENT: 'energy:spent',
    ENERGY_RESET: 'energy:reset',
    
    // Corruption events
    CORRUPTION_GAINED: 'corruption:gained',
    CORRUPTION_LOST: 'corruption:lost',
    CORRUPTION_THRESHOLD: 'corruption:threshold',
    CORRUPTION_MAX: 'corruption:max',
    
    // Faction events
    FACTION_REP_CHANGED: 'faction:rep:changed',
    FACTION_THRESHOLD: 'faction:threshold',
    
    // Artifact events
    ARTIFACT_GAINED: 'artifact:gained',
    ARTIFACT_LOST: 'artifact:lost',
    ARTIFACT_TRIGGERED: 'artifact:triggered',
    
    // Economy events
    CREDITS_GAINED: 'credits:gained',
    CREDITS_SPENT: 'credits:spent',
    SCRAP_GAINED: 'scrap:gained',
    SCRAP_SPENT: 'scrap:spent',
    
    // Event/Story events
    EVENT_START: 'event:start',
    EVENT_CHOICE: 'event:choice',
    EVENT_END: 'event:end',
    DIALOGUE_START: 'dialogue:start',
    DIALOGUE_END: 'dialogue:end',
    
    // Shop events
    SHOP_ENTER: 'shop:enter',
    SHOP_PURCHASE: 'shop:purchase',
    SHOP_EXIT: 'shop:exit',
    
    // Rest events
    REST_START: 'rest:start',
    REST_ACTION: 'rest:action',
    REST_END: 'rest:end',
    
    // Reward events
    REWARD_SCREEN: 'reward:screen',
    REWARD_SELECTED: 'reward:selected',
    REWARD_SKIPPED: 'reward:skipped',
    
    // Audio events
    AUDIO_PLAY: 'audio:play',
    AUDIO_STOP: 'audio:stop',
    AUDIO_VOLUME: 'audio:volume',
    
    // Save/Load events
    SAVE_START: 'save:start',
    SAVE_COMPLETE: 'save:complete',
    LOAD_START: 'load:start',
    LOAD_COMPLETE: 'load:complete',
    
    // UI events
    UI_UPDATE: 'ui:update',
    TOOLTIP_SHOW: 'tooltip:show',
    TOOLTIP_HIDE: 'tooltip:hide',
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',
    
    // Korvax-specific events
    OVERHEAT_CHANGED: 'overheat:changed',
    OVERHEAT_THRESHOLD: 'overheat:threshold',
    RAGE_CHANGED: 'rage:changed'
};

// Create singleton instance
const eventBus = new EventBus();

export { EventBus, eventBus, GameEvents };
export default eventBus;
