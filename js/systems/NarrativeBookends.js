/**
 * NarrativeBookends — Pre-boss and post-boss narrative event system
 * Loads bookend data, integrates with VarraTracker for variant text,
 * and provides structured events for the EventScreen.
 * 
 * Usage:
 *   const bookends = new NarrativeBookends(gameState, eventBus, varraTracker);
 *   
 *   // Before boss fight:
 *   const preBossEvent = bookends.getPreBossEvent(1); // act number
 *   // Show this in EventScreen, then start boss combat
 *   
 *   // After boss defeated:
 *   const postBossEvent = bookends.getPostBossEvent(1);
 *   // Show this in EventScreen, then transition to act screen
 * 
 * @version 1.0.0
 */

class NarrativeBookends {
    constructor(state, eventBus, varraTracker = null) {
        this.state = state;
        this.eventBus = eventBus;
        this.varraTracker = varraTracker;
        this.bookendData = {};
        this.loaded = false;
        
        this._loadData();
    }

    async _loadData() {
        try {
            const resp = await fetch('./data/events/act1_bookends.json');
            if (resp.ok) {
                const data = await resp.json();
                this.bookendData[data.act] = data.narrativeBookends;
                this.loaded = true;
                console.log('[NarrativeBookends] Act 1 bookends loaded');
            }
        } catch (e) {
            console.warn('[NarrativeBookends] Failed to load bookend data:', e);
        }
    }

    /**
     * Get pre-boss narrative event
     * @param {number} act - Act number
     * @returns {Object|null} Event data for EventScreen
     */
    getPreBossEvent(act = 1) {
        if (!this.loaded || !this.bookendData[act]) return null;
        
        const preBoss = this.bookendData[act].preBoss;
        if (!preBoss) return null;
        
        let text = preBoss.text;
        let extraEffects = {};
        
        // Inject Varra variant text if applicable
        if (this.varraTracker && preBoss.varraVariants) {
            const flags = this.state.get('flags') || {};
            
            for (const [flagKey, variant] of Object.entries(preBoss.varraVariants)) {
                if (flags[flagKey]) {
                    text += variant.additionalText || '';
                    if (variant.additionalEffect && variant.additionalEffect.flags) {
                        extraEffects.flags = { ...extraEffects.flags, ...variant.additionalEffect.flags };
                    }
                    break; // Only one variant
                }
            }
        }
        
        return {
            id: preBoss.id,
            name: preBoss.name,
            text: text,
            image: preBoss.image,
            type: 'narrative',
            isPreBoss: true,
            choices: preBoss.choices.map(c => ({
                ...c,
                effects: {
                    ...c.effects,
                    flags: { ...(c.effects.flags || {}), ...extraEffects.flags }
                }
            }))
        };
    }

    /**
     * Get post-boss narrative event
     * @param {number} act - Act number
     * @returns {Object|null} Event data for EventScreen
     */
    getPostBossEvent(act = 1) {
        if (!this.loaded || !this.bookendData[act]) return null;
        
        const postBoss = this.bookendData[act].postBoss;
        if (!postBoss) return null;
        
        // Build the event
        const event = {
            id: postBoss.id,
            name: postBoss.name,
            text: postBoss.text,
            image: postBoss.image,
            type: 'narrative',
            isPostBoss: true,
            choices: postBoss.choices,
            postChoiceText: postBoss.postChoiceText || '',
            transition: postBoss.transition || null
        };
        
        return event;
    }

    /**
     * Apply Varra boss modifiers to boss enemy data
     * Called right before combat starts with the boss
     * @param {Object} bossData - Boss enemy data to modify
     * @returns {Object} Modified boss data
     */
    applyBossModifiers(bossData) {
        if (!this.varraTracker) return bossData;
        
        const mod = this.varraTracker.getBossModifier();
        if (!mod || !mod.mechanicalEffect) return bossData;
        
        const fx = mod.mechanicalEffect;
        const modified = { ...bossData };
        
        // HP reduction
        if (fx.bossHpReduction) {
            modified.hp = Math.max(1, (modified.hp || modified.maxHp) - fx.bossHpReduction);
            modified.currentHp = modified.hp;
            console.log(`[NarrativeBookends] Boss HP reduced by ${fx.bossHpReduction} (Varra loyal)`);
        }
        
        // Starting vulnerable
        if (fx.bossVulnerable) {
            modified.vulnerable = fx.bossVulnerable;
            console.log(`[NarrativeBookends] Boss starts with Vulnerable ${fx.bossVulnerable} (Varra allied)`);
        }
        
        // Phase 2 damage (stored for CombatScreen to apply)
        if (fx.phase2Damage) {
            modified._varraPhase2Damage = fx.phase2Damage;
        }
        
        // Player energy penalty (betrayal)
        if (fx.playerStartEnergy !== undefined) {
            this.state.set('combat._varraEnergyOverride', fx.playerStartEnergy);
            console.log(`[NarrativeBookends] Player starts with ${fx.playerStartEnergy} energy (Varra betrayed)`);
        }
        
        // Store Varra dialogue for boss intro
        if (mod.dialogue) {
            modified._varraPreBossDialogue = mod.dialogue;
        }
        
        return modified;
    }
}

export default NarrativeBookends;
