/**
 * CorruptionCurrency.js - Corruption as an active spendable resource
 * Shattered Star
 * 
 * Corruption isn't just a meter that fills — it's a volatile resource players
 * can actively TAP for power. Each "void channeling" costs corruption AND
 * permanently increases your base corruption by a smaller amount.
 * 
 * The risk/reward: you spend 15 corruption to gain 2 energy, but you also
 * permanently gain 3 corruption. So your net is -12 temporary, +3 permanent.
 * Over time, aggressive void channeling pushes you toward thresholds.
 * 
 * ABILITIES (available during player turn):
 * 1. Void Surge     — Spend corruption → gain Energy
 * 2. Dark Insight   — Spend corruption → draw cards
 * 3. Empower        — Spend corruption → next card deals bonus damage
 * 4. Void Ward      — Spend corruption → gain Block
 * 5. Corrupt Card   — Spend corruption → transform a card (permanent)
 * 
 * THRESHOLDS trigger bonus/penalty effects when corruption crosses 25/50/75.
 * 
 * @version 1.0.0
 */

const VOID_ABILITIES = {
    void_surge: {
        id: 'void_surge',
        name: 'Void Surge',
        icon: '⚡',
        description: 'Channel the void for energy.',
        corruptionCost: 12,     // Temporary corruption spent
        permanentGain: 3,       // Permanent corruption gained
        effect: 'energy',
        value: 2,               // Energy gained
        cooldown: 0,            // Turns until usable again (0 = every turn)
        unlockThreshold: 0      // Available from the start
    },
    dark_insight: {
        id: 'dark_insight',
        name: 'Dark Insight',
        icon: '👁️',
        description: 'The void reveals hidden knowledge.',
        corruptionCost: 8,
        permanentGain: 2,
        effect: 'draw',
        value: 2,               // Cards drawn
        cooldown: 0,
        unlockThreshold: 0
    },
    empower: {
        id: 'empower',
        name: 'Empower',
        icon: '🔥',
        description: 'Infuse your next attack with void energy.',
        corruptionCost: 10,
        permanentGain: 2,
        effect: 'empower',
        value: 6,               // Bonus damage on next attack
        cooldown: 0,
        unlockThreshold: 25     // Only available at 25%+ corruption
    },
    void_ward: {
        id: 'void_ward',
        name: 'Void Ward',
        icon: '🛡️',
        description: 'Weave corruption into a protective barrier.',
        corruptionCost: 10,
        permanentGain: 2,
        effect: 'block',
        value: 10,              // Block gained
        cooldown: 0,
        unlockThreshold: 0
    },
    corrupt_card: {
        id: 'corrupt_card',
        name: 'Corrupt Card',
        icon: '🌀',
        description: 'Permanently transform a card — powerful but unstable.',
        corruptionCost: 20,
        permanentGain: 5,
        effect: 'corrupt_card',
        value: 0,
        cooldown: 999,          // Once per combat
        unlockThreshold: 50     // Only available at 50%+ corruption
    }
};

// Corruption threshold events triggered when crossing boundaries
const THRESHOLD_EVENTS = {
    25: {
        name: 'Void Whisper',
        description: 'The void acknowledges your presence...',
        effect: 'unlock_empower', // Unlocks Empower ability
        visual: 'subtle_distortion'
    },
    50: {
        name: 'Reality Fracture',
        description: 'The boundary between you and the void thins.',
        effect: 'unlock_corrupt',  // Unlocks Corrupt Card
        visual: 'screen_glitch'
    },
    75: {
        name: 'Void Resonance',
        description: 'The void flows through you freely. Power surges... but at what cost?',
        effect: 'void_resonance',  // All void abilities cost 25% less corruption
        visual: 'heavy_distortion'
    }
};

class CorruptionCurrency {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        // Combat-scoped state
        this.combatActive = false;
        this.empowerStacks = 0;      // Bonus damage for next attack
        this.cooldowns = {};          // Ability cooldowns
        this.usedThisCombat = {};     // Track per-combat usage
        this.voidResonance = false;   // 75% threshold bonus
        
        this.setupListeners();
        console.log('[CorruptionCurrency] System initialized');
    }
    
    setupListeners() {
        // Track card plays for Empower consumption
        this.eventBus.on('card:played', (card) => {
            // Empower is consumed on the next attack card played
            if (this.empowerStacks > 0 && (card.type === 'attack' || card.damage > 0)) {
                console.log(`[CorruptionCurrency] Empower consumed: +${this.empowerStacks} damage`);
                this.empowerStacks = 0;
            }
        });
    }
    
    // ─────────────────────────────────────────────
    // COMBAT LIFECYCLE
    // ─────────────────────────────────────────────
    
    onCombatStart() {
        this.combatActive = true;
        this.empowerStacks = 0;
        this.cooldowns = {};
        this.usedThisCombat = {};
        
        // Check if we've crossed the 75% threshold for Void Resonance
        const corruption = this.state.get('corruption') || 0;
        this.voidResonance = corruption >= 75;
        
        console.log(`[CorruptionCurrency] Combat start. Corruption: ${corruption}%. Void Resonance: ${this.voidResonance}`);
    }
    
    onTurnStart() {
        // Tick down cooldowns
        Object.keys(this.cooldowns).forEach(id => {
            if (this.cooldowns[id] > 0) this.cooldowns[id]--;
        });
    }
    
    onCombatEnd() {
        this.combatActive = false;
        this.empowerStacks = 0;
        this.cooldowns = {};
    }
    
    // ─────────────────────────────────────────────
    // ABILITY USAGE
    // ─────────────────────────────────────────────
    
    /**
     * Get all available void abilities for the current state.
     * @returns {Array} Array of ability objects with canUse flag
     */
    getAvailableAbilities() {
        const corruption = this.state.get('corruption') || 0;
        
        return Object.values(VOID_ABILITIES).map(ability => {
            const canUse = this.canUseAbility(ability.id);
            const effectiveCost = this.getEffectiveCost(ability);
            
            return {
                ...ability,
                corruptionCost: effectiveCost,
                canUse,
                reason: canUse ? null : this.getBlockReason(ability.id),
                isNew: corruption >= ability.unlockThreshold && 
                       corruption - 5 < ability.unlockThreshold // Just unlocked
            };
        });
    }
    
    /**
     * Check if an ability can be used right now.
     */
    canUseAbility(abilityId) {
        if (!this.combatActive) return false;
        
        const ability = VOID_ABILITIES[abilityId];
        if (!ability) return false;
        
        const corruption = this.state.get('corruption') || 0;
        
        // Check unlock threshold
        if (corruption < ability.unlockThreshold) return false;
        
        // Check corruption cost (need enough to spend)
        const effectiveCost = this.getEffectiveCost(ability);
        if (corruption < effectiveCost) return false;
        
        // Check cooldown
        if (this.cooldowns[abilityId] > 0) return false;
        
        // Check per-combat limit
        if (ability.cooldown >= 999 && this.usedThisCombat[abilityId]) return false;
        
        return true;
    }
    
    /**
     * Use a void ability. Returns the result or null if failed.
     */
    useAbility(abilityId) {
        if (!this.canUseAbility(abilityId)) {
            console.log(`[CorruptionCurrency] Cannot use ${abilityId}`);
            return null;
        }
        
        const ability = VOID_ABILITIES[abilityId];
        const corruption = this.state.get('corruption') || 0;
        const effectiveCost = this.getEffectiveCost(ability);
        
        // Check for threshold crossings BEFORE modifying corruption
        const prevThreshold = this.getThresholdTier(corruption);
        
        // Deduct corruption cost (temporary spend)
        const afterSpend = corruption - effectiveCost;
        
        // Add permanent corruption gain
        const newCorruption = Math.min(100, afterSpend + ability.permanentGain);
        this.state.set('corruption', newCorruption);
        
        // Check if we crossed a threshold
        const newThreshold = this.getThresholdTier(newCorruption);
        if (newThreshold !== prevThreshold) {
            this.onThresholdCrossed(newThreshold);
        }
        
        // Apply cooldown
        if (ability.cooldown > 0) {
            this.cooldowns[abilityId] = ability.cooldown;
        }
        if (ability.cooldown >= 999) {
            this.usedThisCombat[abilityId] = true;
        }
        
        // Apply the effect
        const result = this.applyEffect(ability);
        
        console.log(`[CorruptionCurrency] Used ${ability.name}: spent ${effectiveCost}, permanent +${ability.permanentGain}, corruption ${corruption} → ${newCorruption}`);
        
        this.eventBus.emit('corruption:spent', {
            ability: ability.id,
            spent: effectiveCost,
            permanentGain: ability.permanentGain,
            oldCorruption: corruption,
            newCorruption: newCorruption,
            result
        });
        
        return result;
    }
    
    // ─────────────────────────────────────────────
    // EFFECT APPLICATION
    // ─────────────────────────────────────────────
    
    applyEffect(ability) {
        const result = { type: ability.effect, value: ability.value };
        
        switch (ability.effect) {
            case 'energy': {
                const energy = this.state.get('combat.energy') || 0;
                this.state.set('combat.energy', energy + ability.value);
                result.message = `+${ability.value} Energy`;
                this.eventBus.emit('energy:gained', ability.value);
                break;
            }
            
            case 'draw': {
                // Emit event for CombatScreen to handle drawing
                result.message = `Draw ${ability.value} cards`;
                this.eventBus.emit('corruption:draw', ability.value);
                break;
            }
            
            case 'empower': {
                this.empowerStacks += ability.value;
                result.message = `Next attack +${ability.value} damage`;
                this.eventBus.emit('corruption:empower', this.empowerStacks);
                break;
            }
            
            case 'block': {
                const block = this.state.get('combat.block') || 0;
                this.state.set('combat.block', block + ability.value);
                result.message = `+${ability.value} Block`;
                this.eventBus.emit('block:gained', { amount: ability.value, source: 'void' });
                break;
            }
            
            case 'corrupt_card': {
                // Signal CombatScreen to enter card corruption mode
                result.message = 'Select a card to corrupt';
                result.requiresSelection = true;
                this.eventBus.emit('corruption:selectCard');
                break;
            }
        }
        
        return result;
    }
    
    // ─────────────────────────────────────────────
    // DAMAGE MODIFIER (Empower)
    // ─────────────────────────────────────────────
    
    /**
     * Get bonus damage from Empower stacks.
     * Called by CombatScreen when calculating attack damage.
     * Consumed after use.
     */
    getEmpowerBonus() {
        return this.empowerStacks;
    }
    
    /**
     * Consume empower stacks (call after applying damage).
     */
    consumeEmpower() {
        const bonus = this.empowerStacks;
        this.empowerStacks = 0;
        return bonus;
    }
    
    // ─────────────────────────────────────────────
    // CARD CORRUPTION (permanent transformation)
    // ─────────────────────────────────────────────
    
    /**
     * Corrupt a card, transforming it permanently.
     * Increases damage/block but adds drawbacks.
     */
    corruptCard(card) {
        if (!card) return null;
        
        const corrupted = { ...card };
        corrupted.corrupted = true;
        corrupted.type = 'corrupted';
        corrupted._originalType = card.type;
        corrupted._originalName = card.name;
        corrupted.name = `Void ${card.name}`;
        
        // Boost primary effect by 50%
        if (corrupted.damage) {
            corrupted.damage = Math.floor(corrupted.damage * 1.5);
        }
        if (corrupted.block) {
            corrupted.block = Math.floor(corrupted.block * 1.5);
        }
        
        // Add drawback: self-damage or corruption gain on play
        if (card.type === 'attack') {
            corrupted.selfDamage = (corrupted.selfDamage || 0) + 2;
            corrupted.description = `${corrupted.description} [CORRUPTED: Take 2 damage]`;
        } else {
            corrupted.corruptionOnPlay = 2;
            corrupted.description = `${corrupted.description} [CORRUPTED: +2 Corruption]`;
        }
        
        // Update description with new values
        if (corrupted.damage) {
            corrupted.description = corrupted.description.replace(
                /Deal \d+ damage/,
                `Deal ${corrupted.damage} damage`
            );
        }
        if (corrupted.block) {
            corrupted.description = corrupted.description.replace(
                /Gain \d+ Block/,
                `Gain ${corrupted.block} Block`
            );
        }
        
        console.log(`[CorruptionCurrency] Card corrupted: ${card.name} → ${corrupted.name}`);
        
        this.eventBus.emit('card:corrupted', {
            original: card,
            corrupted
        });
        
        return corrupted;
    }
    
    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    
    getEffectiveCost(ability) {
        let cost = ability.corruptionCost;
        
        // Void Resonance (75% threshold): 25% cost reduction
        if (this.voidResonance) {
            cost = Math.floor(cost * 0.75);
        }
        
        return cost;
    }
    
    getThresholdTier(corruption) {
        if (corruption >= 75) return 75;
        if (corruption >= 50) return 50;
        if (corruption >= 25) return 25;
        return 0;
    }
    
    onThresholdCrossed(threshold) {
        const event = THRESHOLD_EVENTS[threshold];
        if (!event) return;
        
        console.log(`[CorruptionCurrency] ═══ THRESHOLD ${threshold}%: ${event.name} ═══`);
        
        if (threshold === 75) {
            this.voidResonance = true;
        }
        
        this.eventBus.emit('corruption:threshold', {
            threshold,
            event
        });
    }
    
    getBlockReason(abilityId) {
        const ability = VOID_ABILITIES[abilityId];
        if (!ability) return 'Unknown ability';
        
        const corruption = this.state.get('corruption') || 0;
        
        if (corruption < ability.unlockThreshold) {
            return `Requires ${ability.unlockThreshold}% corruption`;
        }
        if (corruption < this.getEffectiveCost(ability)) {
            return 'Not enough corruption';
        }
        if (this.cooldowns[abilityId] > 0) {
            return `Cooldown: ${this.cooldowns[abilityId]} turns`;
        }
        if (ability.cooldown >= 999 && this.usedThisCombat[abilityId]) {
            return 'Once per combat';
        }
        return 'Cannot use';
    }
    
    // ─────────────────────────────────────────────
    // UI HELPERS
    // ─────────────────────────────────────────────
    
    /**
     * Render the void channeling panel HTML for combat screen.
     */
    renderPanel() {
        const corruption = this.state.get('corruption') || 0;
        const abilities = this.getAvailableAbilities();
        
        // Filter to only show unlocked or nearly-unlocked abilities
        const visible = abilities.filter(a => corruption >= a.unlockThreshold || 
            (a.unlockThreshold - corruption) <= 10);
        
        if (visible.length === 0) return '';
        
        return `
            <div class="void-channel-panel">
                <div class="void-panel-header">
                    <span class="void-panel-icon">👁️</span>
                    <span class="void-panel-title">VOID CHANNEL</span>
                    <span class="void-panel-corruption">${corruption}%</span>
                </div>
                <div class="void-abilities">
                    ${visible.map(a => `
                        <button class="void-ability ${a.canUse ? 'available' : 'locked'}"
                                data-ability="${a.id}"
                                ${a.canUse ? '' : 'disabled'}
                                title="${a.description}${a.reason ? ' — ' + a.reason : ''}">
                            <span class="ability-icon">${a.icon}</span>
                            <span class="ability-name">${a.name}</span>
                            <span class="ability-cost">${a.corruptionCost}%</span>
                            ${a.isNew ? '<span class="ability-new">NEW</span>' : ''}
                        </button>
                    `).join('')}
                </div>
                ${this.empowerStacks > 0 ? `
                    <div class="empower-indicator">
                        🔥 Next attack: +${this.empowerStacks} damage
                    </div>
                ` : ''}
            </div>
        `;
    }
}

export default CorruptionCurrency;
export { VOID_ABILITIES, THRESHOLD_EVENTS };
