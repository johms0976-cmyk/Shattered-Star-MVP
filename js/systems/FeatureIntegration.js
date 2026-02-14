/**
 * FeatureIntegration - Initializes and wires up feature pack systems
 * Connects BossNarrative, VoidMerchant, and post-boss event flow
 * @version 0.3.0
 */

import BossNarrative from './BossNarrative.js';
import VoidMerchant from './VoidMerchant.js';

/**
 * Initialize new feature systems and wire them into the game
 * @param {ShatteredStar} game - The main game instance
 */
export function initializeNewFeatures(game) {
    console.log('[FeatureIntegration] Initializing feature pack...');
    
    // Initialize Boss Narrative system
    try {
        game.bossNarrative = new BossNarrative(game.state, game.eventBus);
        console.log('[FeatureIntegration] BossNarrative initialized');
    } catch (e) {
        console.warn('[FeatureIntegration] BossNarrative init failed:', e);
    }
    
    // Initialize Void Merchant system
    try {
        game.voidMerchant = new VoidMerchant(game.state, game.eventBus);
        console.log('[FeatureIntegration] VoidMerchant initialized');
    } catch (e) {
        console.warn('[FeatureIntegration] VoidMerchant init failed:', e);
    }
    
    // Wire up post-boss event flow
    // When boss is defeated, BossNarrative can show a post-boss event
    // After that event completes, emit act:complete
    game.eventBus.on('boss:post_event_complete', () => {
        console.log('[FeatureIntegration] Post-boss event complete, triggering act completion');
        game.handleBossVictory();
    });
    
    // Wire up pre-boss events
    game.eventBus.on('boss:pre_event', (event) => {
        console.log('[FeatureIntegration] Pre-boss event triggered');
        game.eventBus.emit('event:start', event);
        game.screenManager.transitionTo('event-screen');
        
        // Listen for when this event completes to start actual boss fight
        game.eventBus.once('event:complete', () => {
            game.eventBus.emit('boss:start_combat');
        });
    });
    
    console.log('[FeatureIntegration] Feature pack initialization complete');
}
