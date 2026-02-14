/**
 * SHATTERED STAR - Status Effect System
 * Comprehensive status effect management for combat
 * 
 * @version 1.0.0
 */

/**
 * Status Effect Definitions
 * All status effects in the game with their behaviors
 */
export const STATUS_DEFINITIONS = {
    // ==========================================
    // UNIVERSAL DEBUFFS
    // ==========================================
    
    vulnerable: {
        id: 'vulnerable',
        name: 'Vulnerable',
        description: 'Take 50% more damage from attacks.',
        type: 'debuff',
        icon: '🎯',
        color: '#ff6600',
        stackType: 'duration', // Stacks represent turns remaining
        defaultStacks: 1,
        onReceiveDamage: (damage, stacks) => Math.floor(damage * 1.5),
        onTurnEnd: (stacks) => stacks - 1, // Decrease by 1 each turn
        removeAtZero: true
    },
    
    weak: {
        id: 'weak',
        name: 'Weak',
        description: 'Deal 25% less damage with attacks.',
        type: 'debuff',
        icon: '💫',
        color: '#888888',
        stackType: 'duration',
        defaultStacks: 1,
        onDealDamage: (damage, stacks) => Math.floor(damage * 0.75),
        onTurnEnd: (stacks) => stacks - 1,
        removeAtZero: true
    },
    
    frail: {
        id: 'frail',
        name: 'Frail',
        description: 'Gain 25% less Block from cards.',
        type: 'debuff',
        icon: '💔',
        color: '#9966cc',
        stackType: 'duration',
        defaultStacks: 1,
        onGainBlock: (block, stacks) => Math.floor(block * 0.75),
        onTurnEnd: (stacks) => stacks - 1,
        removeAtZero: true
    },
    
    poison: {
        id: 'poison',
        name: 'Poison',
        description: 'Take damage equal to stacks at end of turn. Stacks decrease by 1.',
        type: 'debuff',
        icon: '☠️',
        color: '#00cc00',
        stackType: 'intensity',
        defaultStacks: 1,
        onTurnEnd: (stacks, target, system) => {
            system.dealStatusDamage(target, stacks, 'poison');
            return stacks - 1;
        },
        removeAtZero: true
    },
    
    bleed: {
        id: 'bleed',
        name: 'Bleed',
        description: 'Take damage equal to stacks at end of turn. Stacks decrease by 1.',
        type: 'debuff',
        icon: '🩸',
        color: '#cc0000',
        stackType: 'intensity',
        defaultStacks: 1,
        onTurnEnd: (stacks, target, system) => {
            system.dealStatusDamage(target, stacks, 'bleed');
            return stacks - 1;
        },
        removeAtZero: true
    },
    
    burn: {
        id: 'burn',
        name: 'Burn',
        description: 'Take damage equal to stacks at end of turn. Stacks halve each turn.',
        type: 'debuff',
        icon: '🔥',
        color: '#ff4400',
        stackType: 'intensity',
        defaultStacks: 1,
        onTurnEnd: (stacks, target, system) => {
            system.dealStatusDamage(target, stacks, 'burn');
            return Math.floor(stacks / 2);
        },
        removeAtZero: true
    },
    
    slow: {
        id: 'slow',
        name: 'Slow',
        description: 'Skip every other action.',
        type: 'debuff',
        icon: '🐌',
        color: '#6666aa',
        stackType: 'duration',
        defaultStacks: 1,
        onTurnEnd: (stacks) => stacks - 1,
        removeAtZero: true
    },
    
    stun: {
        id: 'stun',
        name: 'Stun',
        description: 'Cannot act this turn.',
        type: 'debuff',
        icon: '⭐',
        color: '#ffff00',
        stackType: 'duration',
        defaultStacks: 1,
        preventsAction: true,
        onTurnEnd: (stacks) => 0, // Always removed after one turn
        removeAtZero: true
    },
    
    // ==========================================
    // UNIVERSAL BUFFS
    // ==========================================
    
    strength: {
        id: 'strength',
        name: 'Strength',
        description: 'Deal additional damage with attacks.',
        type: 'buff',
        icon: '💪',
        color: '#ff4444',
        stackType: 'intensity',
        defaultStacks: 1,
        persistent: true, // Doesn't decrease over time
        onDealDamage: (damage, stacks) => damage + stacks
    },
    
    dexterity: {
        id: 'dexterity',
        name: 'Dexterity',
        description: 'Gain additional Block from cards.',
        type: 'buff',
        icon: '🛡️',
        color: '#44ff44',
        stackType: 'intensity',
        defaultStacks: 1,
        persistent: true,
        onGainBlock: (block, stacks) => block + stacks
    },
    
    regen: {
        id: 'regen',
        name: 'Regeneration',
        description: 'Heal HP equal to stacks at end of turn. Stacks decrease by 1.',
        type: 'buff',
        icon: '💚',
        color: '#00ff88',
        stackType: 'intensity',
        defaultStacks: 1,
        onTurnEnd: (stacks, target, system) => {
            system.healTarget(target, stacks);
            return stacks - 1;
        },
        removeAtZero: true
    },
    
    thorns: {
        id: 'thorns',
        name: 'Thorns',
        description: 'Deal damage back to attackers.',
        type: 'buff',
        icon: '🌹',
        color: '#ff66cc',
        stackType: 'intensity',
        defaultStacks: 1,
        persistent: true,
        onReceiveAttack: (attacker, stacks, system) => {
            system.dealStatusDamage(attacker, stacks, 'thorns');
        }
    },
    
    intangible: {
        id: 'intangible',
        name: 'Intangible',
        description: 'Reduce ALL damage to 1.',
        type: 'buff',
        icon: '👻',
        color: '#aaaaff',
        stackType: 'duration',
        defaultStacks: 1,
        onReceiveDamage: (damage, stacks) => 1,
        onTurnEnd: (stacks) => stacks - 1,
        removeAtZero: true
    },
    
    artifact: {
        id: 'artifact',
        name: 'Artifact',
        description: 'Negate the next debuff applied.',
        type: 'buff',
        icon: '🔮',
        color: '#ffaa00',
        stackType: 'intensity',
        defaultStacks: 1,
        persistent: true,
        onReceiveDebuff: (stacks) => {
            return { blocked: true, newStacks: stacks - 1 };
        },
        removeAtZero: true
    },
    
    // ==========================================
    // KORVAX-SPECIFIC STATUS EFFECTS
    // ==========================================
    
    overheat: {
        id: 'overheat',
        name: 'Overheat',
        description: 'Building reactor heat. At 5+: +2 damage. At 10+: Take 3 damage/turn. At 15: Meltdown!',
        type: 'resource',
        icon: '🌡️',
        color: '#ff4400',
        stackType: 'intensity',
        defaultStacks: 0,
        maxStacks: 15,
        persistent: true,
        thresholds: {
            5: { bonusDamage: 2 },
            10: { selfDamage: 3 },
            15: { meltdown: true }
        },
        onDealDamage: (damage, stacks) => {
            if (stacks >= 5) return damage + 2;
            return damage;
        },
        onTurnEnd: (stacks, target, system) => {
            if (stacks >= 15) {
                // Meltdown: Deal massive damage to all enemies, reset overheat
                system.triggerMeltdown(target);
                return 0;
            }
            if (stacks >= 10) {
                system.dealStatusDamage(target, 3, 'overheat');
            }
            return stacks;
        }
    },
    
    rage: {
        id: 'rage',
        name: 'Rage',
        description: 'Gain +1 damage per stack. Gained when taking damage.',
        type: 'buff',
        icon: '😤',
        color: '#ff0000',
        stackType: 'intensity',
        defaultStacks: 0,
        persistent: true,
        onDealDamage: (damage, stacks) => damage + stacks
    },
    
    armor: {
        id: 'armor',
        name: 'Armor',
        description: 'Reduce incoming damage by this amount (permanent).',
        type: 'buff',
        icon: '🔩',
        color: '#888888',
        stackType: 'intensity',
        defaultStacks: 0,
        persistent: true,
        onReceiveDamage: (damage, stacks) => Math.max(0, damage - stacks)
    },
    
    counter: {
        id: 'counter',
        name: 'Counter',
        description: 'Deal damage back when attacked.',
        type: 'buff',
        icon: '⚔️',
        color: '#ffcc00',
        stackType: 'intensity',
        defaultStacks: 0,
        onReceiveAttack: (attacker, stacks, system) => {
            system.dealStatusDamage(attacker, stacks, 'counter');
        },
        onTurnEnd: (stacks) => 0, // Resets each turn
        removeAtZero: true
    },
    
    titanStance: {
        id: 'titanStance',
        name: 'Titan Stance',
        description: 'Take 50% less damage. Cannot play Attack cards.',
        type: 'buff',
        icon: '🗿',
        color: '#666666',
        stackType: 'duration',
        defaultStacks: 1,
        onReceiveDamage: (damage, stacks) => Math.floor(damage * 0.5),
        cardRestriction: 'attack',
        onTurnEnd: (stacks) => stacks - 1,
        removeAtZero: true
    },
    
    // ==========================================
    // CORRUPTION-RELATED STATUS EFFECTS
    // ==========================================
    
    voidTouch: {
        id: 'voidTouch',
        name: 'Void Touch',
        description: 'Attacks apply 1 Corruption to enemies.',
        type: 'buff',
        icon: '👁️',
        color: '#8800ff',
        stackType: 'intensity',
        defaultStacks: 1,
        persistent: true,
        onDealAttack: (target, stacks, system) => {
            system.applyCorruption(target, stacks);
        }
    },
    
    voidMark: {
        id: 'voidMark',
        name: 'Void Mark',
        description: 'Take 2 extra damage from all sources.',
        type: 'debuff',
        icon: '🔮',
        color: '#8800ff',
        stackType: 'intensity',
        defaultStacks: 1,
        onReceiveDamage: (damage, stacks) => damage + (stacks * 2),
        onTurnEnd: (stacks) => stacks - 1,
        removeAtZero: true
    }
};

/**
 * Status Effect System
 * Manages all status effects in combat
 */
export class StatusEffectSystem {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.definitions = STATUS_DEFINITIONS;
        
        // Track effects on entities
        this.playerEffects = new Map();
        this.enemyEffects = new Map(); // Map<enemyId, Map<effectId, stacks>>
        
        // Combat reference (set when combat starts)
        this.combat = null;
        
        this.setupEventListeners();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.eventBus) return;
        
        this.eventBus.on('combat:start', () => this.reset());
        this.eventBus.on('turn:end:player', () => this.processPlayerTurnEnd());
        this.eventBus.on('turn:end:enemy', (data) => this.processEnemyTurnEnd(data?.enemy));
    }
    
    /**
     * Set combat system reference
     */
    setCombatReference(combat) {
        this.combat = combat;
    }
    
    /**
     * Reset all status effects (new combat)
     */
    reset() {
        this.playerEffects.clear();
        this.enemyEffects.clear();
    }
    
    // ==========================================
    // APPLY EFFECTS
    // ==========================================
    
    /**
     * Apply a status effect to the player
     */
    applyToPlayer(effectId, stacks = null) {
        const def = this.definitions[effectId];
        if (!def) {
            console.warn(`[StatusEffectSystem] Unknown effect: ${effectId}`);
            return false;
        }
        
        const actualStacks = stacks ?? def.defaultStacks;
        
        // Check for Artifact blocking debuffs
        if (def.type === 'debuff' && this.playerEffects.has('artifact')) {
            const artifactStacks = this.playerEffects.get('artifact');
            if (artifactStacks > 0) {
                this.playerEffects.set('artifact', artifactStacks - 1);
                if (artifactStacks - 1 <= 0) {
                    this.playerEffects.delete('artifact');
                }
                this.eventBus?.emit('status:blocked', { target: 'player', effect: effectId });
                return false;
            }
        }
        
        const currentStacks = this.playerEffects.get(effectId) || 0;
        const newStacks = Math.min(currentStacks + actualStacks, def.maxStacks || 999);
        this.playerEffects.set(effectId, newStacks);
        
        this.eventBus?.emit('status:applied', {
            target: 'player',
            effect: effectId,
            stacks: newStacks,
            definition: def
        });
        
        console.log(`[StatusEffectSystem] Applied ${effectId} (${newStacks}) to player`);
        return true;
    }
    
    /**
     * Apply a status effect to an enemy
     */
    applyToEnemy(enemyId, effectId, stacks = null) {
        const def = this.definitions[effectId];
        if (!def) {
            console.warn(`[StatusEffectSystem] Unknown effect: ${effectId}`);
            return false;
        }
        
        const actualStacks = stacks ?? def.defaultStacks;
        
        if (!this.enemyEffects.has(enemyId)) {
            this.enemyEffects.set(enemyId, new Map());
        }
        
        const enemyMap = this.enemyEffects.get(enemyId);
        
        // Check for Artifact blocking debuffs
        if (def.type === 'debuff' && enemyMap.has('artifact')) {
            const artifactStacks = enemyMap.get('artifact');
            if (artifactStacks > 0) {
                enemyMap.set('artifact', artifactStacks - 1);
                if (artifactStacks - 1 <= 0) {
                    enemyMap.delete('artifact');
                }
                this.eventBus?.emit('status:blocked', { target: enemyId, effect: effectId });
                return false;
            }
        }
        
        const currentStacks = enemyMap.get(effectId) || 0;
        const newStacks = Math.min(currentStacks + actualStacks, def.maxStacks || 999);
        enemyMap.set(effectId, newStacks);
        
        this.eventBus?.emit('status:applied', {
            target: enemyId,
            effect: effectId,
            stacks: newStacks,
            definition: def
        });
        
        console.log(`[StatusEffectSystem] Applied ${effectId} (${newStacks}) to enemy ${enemyId}`);
        return true;
    }
    
    /**
     * Remove a status effect from player
     */
    removeFromPlayer(effectId) {
        if (this.playerEffects.has(effectId)) {
            this.playerEffects.delete(effectId);
            this.eventBus?.emit('status:removed', { target: 'player', effect: effectId });
            return true;
        }
        return false;
    }
    
    /**
     * Remove a status effect from enemy
     */
    removeFromEnemy(enemyId, effectId) {
        if (this.enemyEffects.has(enemyId)) {
            const enemyMap = this.enemyEffects.get(enemyId);
            if (enemyMap.has(effectId)) {
                enemyMap.delete(effectId);
                this.eventBus?.emit('status:removed', { target: enemyId, effect: effectId });
                return true;
            }
        }
        return false;
    }
    
    // ==========================================
    // GET EFFECTS
    // ==========================================
    
    /**
     * Get all player effects as array
     */
    getPlayerEffects() {
        const effects = [];
        for (const [id, stacks] of this.playerEffects) {
            const def = this.definitions[id];
            if (def && stacks > 0) {
                effects.push({
                    ...def,
                    stacks
                });
            }
        }
        return effects;
    }
    
    /**
     * Get all enemy effects as array
     */
    getEnemyEffects(enemyId) {
        const effects = [];
        if (!this.enemyEffects.has(enemyId)) return effects;
        
        for (const [id, stacks] of this.enemyEffects.get(enemyId)) {
            const def = this.definitions[id];
            if (def && stacks > 0) {
                effects.push({
                    ...def,
                    stacks
                });
            }
        }
        return effects;
    }
    
    /**
     * Get specific effect stacks for player
     */
    getPlayerStacks(effectId) {
        return this.playerEffects.get(effectId) || 0;
    }
    
    /**
     * Get specific effect stacks for enemy
     */
    getEnemyStacks(enemyId, effectId) {
        if (!this.enemyEffects.has(enemyId)) return 0;
        return this.enemyEffects.get(enemyId).get(effectId) || 0;
    }
    
    /**
     * Check if player has effect
     */
    playerHas(effectId) {
        return this.getPlayerStacks(effectId) > 0;
    }
    
    /**
     * Check if enemy has effect
     */
    enemyHas(enemyId, effectId) {
        return this.getEnemyStacks(enemyId, effectId) > 0;
    }
    
    // ==========================================
    // DAMAGE MODIFICATION
    // ==========================================
    
    /**
     * Calculate outgoing damage from player
     */
    calculatePlayerDamage(baseDamage) {
        let damage = baseDamage;
        
        // Apply strength
        const strength = this.getPlayerStacks('strength');
        if (strength > 0) {
            damage += strength;
        }
        
        // Apply rage
        const rage = this.getPlayerStacks('rage');
        if (rage > 0) {
            damage += rage;
        }
        
        // Apply overheat bonus
        const overheat = this.getPlayerStacks('overheat');
        if (overheat >= 5) {
            damage += 2;
        }
        
        // Apply weak
        if (this.playerHas('weak')) {
            damage = Math.floor(damage * 0.75);
        }
        
        return Math.max(0, damage);
    }
    
    /**
     * Calculate outgoing damage from enemy
     */
    calculateEnemyDamage(enemyId, baseDamage) {
        let damage = baseDamage;
        
        // Apply strength
        const strength = this.getEnemyStacks(enemyId, 'strength');
        if (strength > 0) {
            damage += strength;
        }
        
        // Apply weak
        if (this.enemyHas(enemyId, 'weak')) {
            damage = Math.floor(damage * 0.75);
        }
        
        return Math.max(0, damage);
    }
    
    /**
     * Calculate incoming damage to player
     */
    calculateDamageToPlayer(baseDamage) {
        let damage = baseDamage;
        
        // Apply armor
        const armor = this.getPlayerStacks('armor');
        if (armor > 0) {
            damage = Math.max(0, damage - armor);
        }
        
        // Apply vulnerable
        if (this.playerHas('vulnerable')) {
            damage = Math.floor(damage * 1.5);
        }
        
        // Apply void mark
        const voidMark = this.getPlayerStacks('voidMark');
        if (voidMark > 0) {
            damage += voidMark * 2;
        }
        
        // Apply titan stance
        if (this.playerHas('titanStance')) {
            damage = Math.floor(damage * 0.5);
        }
        
        // Apply intangible
        if (this.playerHas('intangible')) {
            damage = 1;
        }
        
        return Math.max(0, damage);
    }
    
    /**
     * Calculate incoming damage to enemy
     */
    calculateDamageToEnemy(enemyId, baseDamage) {
        let damage = baseDamage;
        
        // Apply armor
        const armor = this.getEnemyStacks(enemyId, 'armor');
        if (armor > 0) {
            damage = Math.max(0, damage - armor);
        }
        
        // Apply vulnerable
        if (this.enemyHas(enemyId, 'vulnerable')) {
            damage = Math.floor(damage * 1.5);
        }
        
        // Apply intangible
        if (this.enemyHas(enemyId, 'intangible')) {
            damage = 1;
        }
        
        return Math.max(0, damage);
    }
    
    /**
     * Calculate block gain for player
     */
    calculatePlayerBlock(baseBlock) {
        let block = baseBlock;
        
        // Apply dexterity
        const dexterity = this.getPlayerStacks('dexterity');
        if (dexterity > 0) {
            block += dexterity;
        }
        
        // Apply frail
        if (this.playerHas('frail')) {
            block = Math.floor(block * 0.75);
        }
        
        return Math.max(0, block);
    }
    
    // ==========================================
    // TURN END PROCESSING
    // ==========================================
    
    /**
     * Process player turn end effects
     */
    processPlayerTurnEnd() {
        const toRemove = [];
        
        for (const [effectId, stacks] of this.playerEffects) {
            const def = this.definitions[effectId];
            if (!def) continue;
            
            if (def.onTurnEnd) {
                const newStacks = def.onTurnEnd(stacks, 'player', this);
                
                if (newStacks <= 0 && def.removeAtZero) {
                    toRemove.push(effectId);
                } else {
                    this.playerEffects.set(effectId, newStacks);
                }
            }
        }
        
        // Remove expired effects
        for (const effectId of toRemove) {
            this.playerEffects.delete(effectId);
            this.eventBus?.emit('status:expired', { target: 'player', effect: effectId });
        }
        
        this.eventBus?.emit('status:turnEnd:player', { effects: this.getPlayerEffects() });
    }
    
    /**
     * Process enemy turn end effects
     */
    processEnemyTurnEnd(enemy) {
        if (!enemy?.id) return;
        
        const enemyId = enemy.id;
        if (!this.enemyEffects.has(enemyId)) return;
        
        const enemyMap = this.enemyEffects.get(enemyId);
        const toRemove = [];
        
        for (const [effectId, stacks] of enemyMap) {
            const def = this.definitions[effectId];
            if (!def) continue;
            
            if (def.onTurnEnd) {
                const newStacks = def.onTurnEnd(stacks, enemyId, this);
                
                if (newStacks <= 0 && def.removeAtZero) {
                    toRemove.push(effectId);
                } else {
                    enemyMap.set(effectId, newStacks);
                }
            }
        }
        
        // Remove expired effects
        for (const effectId of toRemove) {
            enemyMap.delete(effectId);
            this.eventBus?.emit('status:expired', { target: enemyId, effect: effectId });
        }
        
        this.eventBus?.emit('status:turnEnd:enemy', { 
            enemyId, 
            effects: this.getEnemyEffects(enemyId) 
        });
    }
    
    // ==========================================
    // SPECIAL TRIGGERS
    // ==========================================
    
    /**
     * Trigger when player takes damage (for rage, etc)
     */
    onPlayerDamaged(amount) {
        // Gain rage if applicable
        if (this.combat?.hero?.id === 'korvax') {
            // Check for rage protocol power
            const rageGain = this.combat?.state?.get('rageOnDamage') || 0;
            if (rageGain > 0) {
                this.applyToPlayer('rage', rageGain);
            }
        }
        
        // Trigger counter damage
        const counter = this.getPlayerStacks('counter');
        if (counter > 0 && this.combat?.currentEnemy) {
            this.eventBus?.emit('counter:triggered', { 
                damage: counter, 
                target: this.combat.currentEnemy 
            });
        }
        
        // Trigger thorns
        const thorns = this.getPlayerStacks('thorns');
        if (thorns > 0 && this.combat?.currentEnemy) {
            this.eventBus?.emit('thorns:triggered', { 
                damage: thorns, 
                target: this.combat.currentEnemy 
            });
        }
    }
    
    /**
     * Deal damage from status effect
     */
    dealStatusDamage(target, amount, source) {
        this.eventBus?.emit('status:damage', { target, amount, source });
    }
    
    /**
     * Heal a target
     */
    healTarget(target, amount) {
        this.eventBus?.emit('status:heal', { target, amount });
    }
    
    /**
     * Apply corruption
     */
    applyCorruption(target, amount) {
        this.eventBus?.emit('corruption:apply', { target, amount });
    }
    
    /**
     * Trigger Korvax meltdown
     */
    triggerMeltdown(target) {
        console.log('[StatusEffectSystem] MELTDOWN TRIGGERED!');
        this.eventBus?.emit('meltdown:triggered', { target });
    }
    
    // ==========================================
    // UTILITY
    // ==========================================
    
    /**
     * Check if player can play attack cards
     */
    canPlayerPlayAttacks() {
        return !this.playerHas('titanStance');
    }
    
    /**
     * Check if enemy can act
     */
    canEnemyAct(enemyId) {
        if (this.enemyHas(enemyId, 'stun')) return false;
        
        // Check slow (acts every other turn)
        if (this.enemyHas(enemyId, 'slow')) {
            const slowStacks = this.getEnemyStacks(enemyId, 'slow');
            // Simple implementation: can act on odd stacks
            return slowStacks % 2 === 1;
        }
        
        return true;
    }
    
    /**
     * Get status effect definition
     */
    getDefinition(effectId) {
        return this.definitions[effectId] || null;
    }
    
    /**
     * Get all definitions
     */
    getAllDefinitions() {
        return this.definitions;
    }
}

// Create singleton instance
let instance = null;

export function getStatusEffectSystem(eventBus) {
    if (!instance) {
        instance = new StatusEffectSystem(eventBus);
    }
    return instance;
}

export default StatusEffectSystem;
