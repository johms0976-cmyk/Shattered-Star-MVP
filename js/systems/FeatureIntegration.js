/**
 * FeatureIntegration - Integration hooks for new features
 * Shattered Star v0.5.0
 * 
 * Initializes and connects:
 * 1. Enhanced RewardSystem (rarity shimmer, corrupted rewards) - via replaced file
 * 3. VoidMerchant (corruption-as-choice shop tab) - via replaced ShopScreen
 * 4. BossNarrative (pre/mid/post boss events) - initialized here
 * 5. CorruptionThresholds (forced micro-events at 25/50/75%) - initialized here
 * 7. VarraTracker (recurring faction NPC) - initialized here
 * 
 * NOTE: Pre-boss event flow and Varra event triggers are handled directly
 * in main.js (startBossCombat and startEvent methods). This module handles
 * initialization and post-boss narrative flow.
 */

import BossNarrative from './BossNarrative.js';
import VarraTracker from './VarraTracker.js';
import CorruptionThresholds from './CorruptionThresholds.js';

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
    
    // Initialize Corruption Threshold Micro-Events
    try {
        game.corruptionThresholds = new CorruptionThresholds(game);
        
        // Restore state from saved run if available
        const savedThresholds = game.state.get('corruptionThresholds');
        if (savedThresholds) {
            game.corruptionThresholds.deserialize(savedThresholds);
        }
        
        console.log('[FeatureIntegration] CorruptionThresholds initialized');
    } catch (e) {
        console.error('[FeatureIntegration] CorruptionThresholds failed:', e);
    }
    
    // Hook post-boss narrative flow
    hookPostBossNarrative(game);
    
    // Hook reward sound cues
    hookRewardSounds(game);
    
    console.log('[FeatureIntegration] All features initialized');
}

/**
 * Hook post-boss narrative into the game flow
 * Pre-boss events are handled directly by main.js startBossCombat()
 */
function hookPostBossNarrative(game) {
    // After boss is defeated, show post-boss narrative event
    game.eventBus.on('boss:defeated', () => {
        if (!game.bossNarrative) return;
        
        const act = game.state.get('act') || 1;
        const boss = game.state.get('currentBoss');
        const bossId = boss?.id || 'scrap_king';
        
        // Delay for dramatic effect after combat ends
        setTimeout(() => {
            const postBossEvent = game.bossNarrative.getPostBossEvent(act, bossId);
            if (postBossEvent) {
                console.log('[FeatureIntegration] Showing post-boss narrative event');
                game.eventBus.emit('boss:post_event', postBossEvent);
            } else {
                // No narrative event - show rewards directly
                game.rewards.generateBossRewards(act);
                game.state.set('actComplete', true);
                game.screenManager.transitionTo('victory-screen');
            }
        }, 1500);
    });
    
    // Handle act completion after post-boss event choices
    game.eventBus.on('act:complete', (data) => {
        console.log(`[FeatureIntegration] Act ${data.act} complete!`);
        
        // Show Varra post-boss dialogue if available
        if (game.varraTracker) {
            const varraDialogue = game.varraTracker.getPostBossDialogue();
            if (varraDialogue && varraDialogue.speaker !== 'Unknown Voice') {
                game.eventBus.emit('combat:dialogue', {
                    speaker: varraDialogue.speaker,
                    lines: [varraDialogue.text],
                    mood: 'neutral'
                });
            }
        }
        
        // Generate boss rewards and show victory
        setTimeout(() => {
            const act = data.act || game.state.get('act') || 1;
            game.rewards.generateBossRewards(act);
            game.state.set('actComplete', true);
            game.screenManager.transitionTo('victory-screen');
        }, 1000);
    });
}

/**
 * Hook reward sounds for rarity reveals (procedural Web Audio shimmer)
 */
function hookRewardSounds(game) {
    game.eventBus.on('sfx:play', (data) => {
        if (data.sound === 'rare_reveal') {
            try {
                const audioCtx = game.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                if (!game.audioContext) game.audioContext = audioCtx;
                
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
                // Audio not available
            }
        }
    });
}
