/**
 * FeatureIntegration - Integration hooks for new features
 * Shattered Star
 * 
 * This module initializes and connects:
 * 1. Enhanced RewardSystem (rarity shimmer, corrupted rewards)
 * 3. VoidMerchant (corruption-as-choice shop tab)
 * 4. BossNarrative (pre/mid/post boss events)
 * 7. VarraTracker (recurring faction NPC)
 * 
 * INTEGRATION INSTRUCTIONS:
 * 
 * 1. Add to index.html <head>:
 *    <link rel="stylesheet" href="css/components/reward-shimmer.css">
 *    <link rel="stylesheet" href="css/components/void-merchant.css">
 *    <link rel="stylesheet" href="css/components/boss-narrative.css">
 * 
 * 2. In main.js, import and call initializeNewFeatures() after game systems are created:
 *    import { initializeNewFeatures } from './systems/FeatureIntegration.js';
 *    // After game.state, game.eventBus, game.dataLoader exist:
 *    initializeNewFeatures(game);
 * 
 * 3. Replace js/systems/RewardSystem.js with the new version
 * 4. Replace js/screens/ShopScreen.js with the new version
 * 5. Add new files:
 *    - js/systems/VoidMerchant.js
 *    - js/systems/BossNarrative.js
 *    - js/systems/VarraTracker.js
 *    - js/screens/BossEventScreen.js
 */

import BossNarrative from './BossNarrative.js';
import VarraTracker from './VarraTracker.js';
import { setupBossEventScreen } from '../screens/BossEventScreen.js';

/**
 * Initialize all new feature systems
 */
export function initializeNewFeatures(game) {
    console.log('[FeatureIntegration] Initializing new features...');
    
    // Initialize Boss Narrative system
    try {
        game.bossNarrative = new BossNarrative(game.state, game.eventBus);
        console.log('[FeatureIntegration] BossNarrative initialized');
    } catch (e) {
        console.error('[FeatureIntegration] BossNarrative failed:', e);
    }
    
    // Initialize Varra Tracker
    try {
        game.varraTracker = new VarraTracker(game.state, game.eventBus);
        console.log('[FeatureIntegration] VarraTracker initialized');
    } catch (e) {
        console.error('[FeatureIntegration] VarraTracker failed:', e);
    }
    
    // Setup Boss Event Screen
    try {
        setupBossEventScreen(game);
        console.log('[FeatureIntegration] BossEventScreen initialized');
    } catch (e) {
        console.error('[FeatureIntegration] BossEventScreen failed:', e);
    }
    
    // Hook into boss node handling
    hookBossNarrative(game);
    
    // Hook Varra into event system
    hookVarraEvents(game);
    
    // Hook into reward system for rarity sound cues
    hookRewardSounds(game);
    
    console.log('[FeatureIntegration] All features initialized');
}

/**
 * Hook boss narrative into the node/combat flow
 */
function hookBossNarrative(game) {
    // Intercept boss node entry to show pre-boss event first
    const originalHandleNodeEnter = game.handleNodeEnter?.bind(game);
    
    game.eventBus.on('node:enter', (node) => {
        if (node?.type === 'boss' && game.bossNarrative) {
            const act = game.state.get('act') || 1;
            const bossId = 'scrap_king'; // Act 1 default
            
            const preBossEvent = game.bossNarrative.getPreBossEvent(act, bossId);
            
            if (preBossEvent) {
                // Show pre-boss event instead of going straight to combat
                game.eventBus.emit('boss:pre_event', preBossEvent);
                return; // Don't proceed to combat yet
            }
        }
    });
    
    // When pre-boss event completes, start the actual boss fight
    game.eventBus.on('boss:start_combat', () => {
        try {
            if (game.startBossCombat) {
                game.startBossCombat();
            } else {
                // Fallback: emit combat start directly
                game.eventBus.emit('combat:start', { type: 'boss' });
                game.screenManager.transitionTo('combat-screen');
            }
        } catch (e) {
            console.error('[FeatureIntegration] Failed to start boss combat:', e);
        }
    });
    
    // After boss is defeated, show post-boss event
    game.eventBus.on('boss:defeated', () => {
        if (!game.bossNarrative) return;
        
        const act = game.state.get('act') || 1;
        const bossId = 'scrap_king';
        
        // Small delay for dramatic effect
        setTimeout(() => {
            const postBossEvent = game.bossNarrative.getPostBossEvent(act, bossId);
            if (postBossEvent) {
                game.eventBus.emit('boss:post_event', postBossEvent);
            }
        }, 1500);
    });
    
    // Handle act completion after post-boss
    game.eventBus.on('act:complete', (data) => {
        console.log(`[FeatureIntegration] Act ${data.act} complete!`);
        
        // Show Varra's post-boss dialogue if she was met
        if (game.varraTracker) {
            const varraDialogue = game.varraTracker.getPostBossDialogue();
            if (varraDialogue) {
                game.eventBus.emit('combat:dialogue', {
                    speaker: varraDialogue.speaker,
                    lines: [varraDialogue.text],
                    mood: 'neutral'
                });
            }
        }
        
        // TODO: Transition to Act 2 or victory screen
        // For now, go to victory screen
        setTimeout(() => {
            game.screenManager.transitionTo('victory-screen');
        }, 2000);
    });
}

/**
 * Hook Varra events into the standard event system
 */
function hookVarraEvents(game) {
    // Before showing a standard event, check if Varra should appear instead
    game.eventBus.on('event:pre_generate', () => {
        if (!game.varraTracker) return;
        
        if (game.varraTracker.shouldTrigger()) {
            const varraEvent = game.varraTracker.getNextVarraEvent();
            if (varraEvent) {
                // Override the standard event with Varra's encounter
                game.state.set('event.currentEvent', varraEvent);
                game.state.set('event.isNPC', true);
                console.log('[FeatureIntegration] Varra event triggered!');
            }
        }
    });
}

/**
 * Hook reward sounds for rarity reveals
 */
function hookRewardSounds(game) {
    game.eventBus.on('sfx:play', (data) => {
        if (data.sound === 'rare_reveal') {
            // Attempt to play rare reveal sound via Web Audio API
            try {
                const audioCtx = game.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                if (!game.audioContext) game.audioContext = audioCtx;
                
                // Create a shimmer sound
                const osc1 = audioCtx.createOscillator();
                const osc2 = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(800, audioCtx.currentTime);
                osc1.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 0.3);
                
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1200, audioCtx.currentTime);
                osc2.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.3);
                
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
                
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc1.start(audioCtx.currentTime);
                osc2.start(audioCtx.currentTime);
                osc1.stop(audioCtx.currentTime + 0.4);
                osc2.stop(audioCtx.currentTime + 0.4);
            } catch (e) {
                // Audio not available, silently fail
            }
        }
    });
}
