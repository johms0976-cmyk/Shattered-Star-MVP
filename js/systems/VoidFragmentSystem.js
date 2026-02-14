/**
 * VoidFragmentSystem.js - "Corruption Jokers" (Balatro-inspired)
 * 
 * Slottable modifiers that change how cards score and resolve.
 * Each fragment passively increases corruption per combat.
 * Fragments interact with ChainMultiplierSystem and MetaCorruptionSystem.
 * 
 * @version 1.0.0
 * @system Shattered Star MVP
 */

class VoidFragmentSystem {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        // Fragment slots (unlocked by corruption thresholds)
        this.maxSlots = 4;
        this.slotUnlockThresholds = [0, 15, 35, 60];
        this.equippedFragments = [];
        
        // Fragment database (loaded from data)
        this.fragmentDatabase = {};
        
        // Combat-turn tracking for fragment effects
        this.combatState = {
            cardsPlayedThisTurn: 0,
            cardsPlayedThisCombat: 0,
            lastCardCost: -1,
            costSequence: [],
            nextAttackBonus: 0,
            firstCardThisTurn: true,
            lastCardPlayed: null,
            cardsDiscardedEndOfTurn: 0
        };
        
        // Collected (inventory) but not equipped
        this.collectedFragments = [];
        
        this.setupEventListeners();
        
        console.log('[VoidFragmentSystem] Initialized');
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    /**
     * Load fragment definitions from data
     */
    loadFragmentData(fragmentData) {
        if (!fragmentData || !fragmentData.fragments) {
            console.warn('[VoidFragmentSystem] No fragment data provided');
            return;
        }
        
        fragmentData.fragments.forEach(f => {
            this.fragmentDatabase[f.id] = { ...f };
        });
        
        console.log(`[VoidFragmentSystem] Loaded ${Object.keys(this.fragmentDatabase).length} fragments`);
    }

    /**
     * Setup all event listeners for fragment triggers
     */
    setupEventListeners() {
        // Combat lifecycle
        this.eventBus.on('combat:start', () => this.onCombatStart());
        this.eventBus.on('combat:end', () => this.onCombatEnd());
        this.eventBus.on('turn:start', () => this.onTurnStart());
        this.eventBus.on('turn:end', () => this.onTurnEnd());
        
        // Card events
        this.eventBus.on('card:played', (data) => this.onCardPlayed(data));
        this.eventBus.on('card:discarded', (data) => this.onCardDiscarded(data));
        
        // Damage events
        this.eventBus.on('damage:dealt', (data) => this.onDamageDealt(data));
        this.eventBus.on('damage:taken', (data) => this.onDamageTaken(data));
        
        // Enemy events
        this.eventBus.on('enemy:killed', (data) => this.onEnemyKilled(data));
        this.eventBus.on('enemy:buffed', (data) => this.onEnemyBuffed(data));
        
        // Corruption events
        this.eventBus.on('corruption:changed', () => this.updateSlotAvailability());
    }

    // ==========================================
    // SLOT MANAGEMENT
    // ==========================================

    /**
     * Get number of unlocked fragment slots
     */
    getUnlockedSlots() {
        const corruption = this.state.get('corruption') || 0;
        let unlocked = 0;
        for (let i = 0; i < this.slotUnlockThresholds.length; i++) {
            if (corruption >= this.slotUnlockThresholds[i]) {
                unlocked = i + 1;
            }
        }
        return Math.min(unlocked, this.maxSlots);
    }

    /**
     * Update slot availability when corruption changes
     */
    updateSlotAvailability() {
        const unlocked = this.getUnlockedSlots();
        this.eventBus.emit('fragments:slotsUpdated', {
            unlocked,
            max: this.maxSlots,
            equipped: this.equippedFragments.length
        });
    }

    /**
     * Equip a fragment into a slot
     */
    equipFragment(fragmentId) {
        const unlocked = this.getUnlockedSlots();
        
        if (this.equippedFragments.length >= unlocked) {
            console.warn(`[VoidFragmentSystem] All ${unlocked} slots full`);
            this.eventBus.emit('fragments:slotsFull');
            return false;
        }
        
        if (this.equippedFragments.find(f => f.id === fragmentId)) {
            console.warn(`[VoidFragmentSystem] Fragment ${fragmentId} already equipped`);
            return false;
        }
        
        const fragment = this.fragmentDatabase[fragmentId];
        if (!fragment) {
            console.warn(`[VoidFragmentSystem] Unknown fragment: ${fragmentId}`);
            return false;
        }
        
        this.equippedFragments.push({ ...fragment });
        
        // Remove from collected inventory
        const collIdx = this.collectedFragments.indexOf(fragmentId);
        if (collIdx > -1) this.collectedFragments.splice(collIdx, 1);
        
        this.eventBus.emit('fragments:equipped', { fragment });
        console.log(`[VoidFragmentSystem] Equipped: ${fragment.name}`);
        return true;
    }

    /**
     * Unequip a fragment from slot
     */
    unequipFragment(fragmentId) {
        const idx = this.equippedFragments.findIndex(f => f.id === fragmentId);
        if (idx === -1) return false;
        
        const fragment = this.equippedFragments.splice(idx, 1)[0];
        this.collectedFragments.push(fragment.id);
        
        this.eventBus.emit('fragments:unequipped', { fragment });
        console.log(`[VoidFragmentSystem] Unequipped: ${fragment.name}`);
        return true;
    }

    /**
     * Add a fragment to collected inventory
     */
    collectFragment(fragmentId) {
        if (this.collectedFragments.includes(fragmentId)) return false;
        if (this.equippedFragments.find(f => f.id === fragmentId)) return false;
        
        const fragment = this.fragmentDatabase[fragmentId];
        if (!fragment) return false;
        
        this.collectedFragments.push(fragmentId);
        this.eventBus.emit('fragments:collected', { fragment });
        console.log(`[VoidFragmentSystem] Collected: ${fragment.name}`);
        return true;
    }

    /**
     * Get a random fragment for rewards (respects rarity weights)
     */
    getRandomFragment(pool = 'all', count = 3) {
        const available = Object.values(this.fragmentDatabase).filter(f => {
            // Not already owned
            if (this.collectedFragments.includes(f.id)) return false;
            if (this.equippedFragments.find(eq => eq.id === f.id)) return false;
            // Pool filter
            if (pool !== 'all' && !pool.split(',').includes(f.rarity)) return false;
            return true;
        });
        
        if (available.length === 0) return [];
        
        // Weighted random by rarity
        const weights = { common: 40, uncommon: 30, rare: 20, legendary: 10 };
        const weighted = [];
        available.forEach(f => {
            const w = weights[f.rarity] || 20;
            for (let i = 0; i < w; i++) weighted.push(f);
        });
        
        const results = [];
        const used = new Set();
        for (let i = 0; i < count && weighted.length > 0; i++) {
            let attempts = 0;
            let pick;
            do {
                pick = weighted[Math.floor(Math.random() * weighted.length)];
                attempts++;
            } while (used.has(pick.id) && attempts < 50);
            
            if (!used.has(pick.id)) {
                results.push(pick);
                used.add(pick.id);
            }
        }
        
        return results;
    }

    // ==========================================
    // COMBAT LIFECYCLE HOOKS
    // ==========================================

    onCombatStart() {
        this.combatState = {
            cardsPlayedThisTurn: 0,
            cardsPlayedThisCombat: 0,
            lastCardCost: -1,
            costSequence: [],
            nextAttackBonus: 0,
            firstCardThisTurn: true,
            lastCardPlayed: null,
            cardsDiscardedEndOfTurn: 0
        };
        
        // Apply per-combat corruption from equipped fragments
        let totalCorruptionGain = 0;
        this.equippedFragments.forEach(f => {
            totalCorruptionGain += f.corruptionPerCombat || 0;
        });
        
        if (totalCorruptionGain > 0) {
            this.eventBus.emit('corruption:gained', totalCorruptionGain);
            this.eventBus.emit('fragments:corruptionApplied', { amount: totalCorruptionGain });
        }
        
        // Emit for UI to show active fragment indicators
        this.eventBus.emit('fragments:combatActive', {
            fragments: this.equippedFragments.map(f => ({
                id: f.id,
                name: f.name,
                description: f.description
            }))
        });
    }

    onCombatEnd() {
        // Reset combat tracking
        this.combatState.cardsPlayedThisCombat = 0;
    }

    onTurnStart() {
        this.combatState.cardsPlayedThisTurn = 0;
        this.combatState.firstCardThisTurn = true;
        this.combatState.costSequence = [];
        this.combatState.cardsDiscardedEndOfTurn = 0;
    }

    onTurnEnd() {
        // Discard Harvest: Block per card discarded
        const discardHarvest = this.getEquippedByType('economy')
            .find(f => f.id === 'void_discard_harvest');
        if (discardHarvest && this.combatState.cardsDiscardedEndOfTurn > 0) {
            const blockGain = this.combatState.cardsDiscardedEndOfTurn * 
                (discardHarvest.effect.bonus.blockPerDiscard || 1);
            this.eventBus.emit('player:gainBlock', blockGain);
            this.emitFragmentTrigger(discardHarvest, 'blockGain', blockGain);
        }
        
        // Paradox Engine: Exact cards played bonus
        const paradox = this.getEquippedById('void_paradox_engine');
        if (paradox) {
            const required = paradox.effect.bonus.exactCount || 5;
            if (this.combatState.cardsPlayedThisTurn === required) {
                const bonusDraw = paradox.effect.bonus.bonusDraw || 2;
                this.eventBus.emit('player:bonusDraw', bonusDraw);
                this.emitFragmentTrigger(paradox, 'bonusDraw', bonusDraw);
            }
        }
    }

    // ==========================================
    // CARD PLAY HOOKS
    // ==========================================

    onCardPlayed(data) {
        const { card } = data;
        if (!card) return;
        
        this.combatState.cardsPlayedThisTurn++;
        this.combatState.cardsPlayedThisCombat++;
        this.combatState.costSequence.push(card.cost || 0);
        this.combatState.lastCardPlayed = card;
        
        // --- Entropy Tax: First card free, last card costs more ---
        const entropyTax = this.getEquippedById('void_entropy_tax');
        if (entropyTax && this.combatState.firstCardThisTurn) {
            // Energy refund for first card is handled in modifyCardCost
            this.combatState.firstCardThisTurn = false;
        }
        
        // --- Temporal Stutter: Every Nth card replays ---
        const stutter = this.getEquippedById('void_temporal_stutter');
        if (stutter) {
            const nth = stutter.effect.bonus.nthCard || 4;
            if (this.combatState.cardsPlayedThisCombat % nth === 0) {
                this.eventBus.emit('card:replay', { card, source: 'void_temporal_stutter' });
                this.emitFragmentTrigger(stutter, 'replay', card.name);
            }
        }
        
        // --- Corruption Feast: Bonus for corrupted cards ---
        const feast = this.getEquippedById('void_corruption_feast');
        if (feast && card.corrupted) {
            const extraCorruption = feast.effect.bonus.extraCorruption || 2;
            this.eventBus.emit('corruption:gained', extraCorruption);
            this.emitFragmentTrigger(feast, 'extraCorruption', extraCorruption);
        }
        
        this.combatState.firstCardThisTurn = false;
    }

    onCardDiscarded(data) {
        this.combatState.cardsDiscardedEndOfTurn++;
    }

    // ==========================================
    // DAMAGE MODIFICATION
    // ==========================================

    /**
     * Calculate damage modifier from all equipped fragments
     * Called by CombatSystem before applying damage
     * @returns {Object} { flatBonus, multiplier }
     */
    calculateDamageModifiers(card, baseDamage, target) {
        let flatBonus = 0;
        let multiplier = 1.0;
        
        // --- Suffering Echo: +damage after taking damage ---
        if (this.combatState.nextAttackBonus > 0 && card.type === 'attack') {
            flatBonus += this.combatState.nextAttackBonus;
            const sufferingEcho = this.getEquippedById('void_suffering_echo');
            if (sufferingEcho) {
                this.emitFragmentTrigger(sufferingEcho, 'bonusDamage', this.combatState.nextAttackBonus);
            }
            this.combatState.nextAttackBonus = 0;
        }
        
        // --- Glass Cannon: All damage +25% ---
        const glass = this.getEquippedById('void_glass_cannon');
        if (glass) {
            multiplier *= glass.effect.bonus.allDamageDealtMultiplier || 1.25;
        }
        
        // --- Corruption Feast: Corrupted cards +50% ---
        const feast = this.getEquippedById('void_corruption_feast');
        if (feast && card.corrupted) {
            multiplier *= feast.effect.bonus.damageMultiplier || 1.5;
        }
        
        // --- Echo Amplifier: Descending cost sequence bonus ---
        const amplifier = this.getEquippedById('void_echo_amplifier');
        if (amplifier && this.combatState.costSequence.length >= 2) {
            const seq = this.combatState.costSequence;
            let isDescending = true;
            for (let i = 1; i < seq.length; i++) {
                if (seq[i] > seq[i - 1]) { isDescending = false; break; }
            }
            if (isDescending && seq.length >= 2) {
                multiplier *= amplifier.effect.bonus.finalCardDamageMultiplier || 1.3;
                this.emitFragmentTrigger(amplifier, 'sequenceBonus', multiplier);
            }
        }
        
        // --- Hungry Void: 0-cost cards +4 damage ---
        const hungry = this.getEquippedById('void_hungry_void');
        if (hungry && card.cost === 0) {
            flatBonus += hungry.effect.bonus.zeroCostDamageBonus || 4;
            this.emitFragmentTrigger(hungry, 'zeroCostBonus', flatBonus);
        }
        
        return { flatBonus, multiplier };
    }

    /**
     * Calculate block modifier from fragments
     */
    calculateBlockModifiers(card, baseBlock) {
        let flatBonus = 0;
        
        // --- Hungry Void: 3+ cost cards +4 block ---
        const hungry = this.getEquippedById('void_hungry_void');
        if (hungry) {
            const threshold = hungry.effect.bonus.highCostThreshold || 3;
            if (card.cost >= threshold) {
                flatBonus += hungry.effect.bonus.highCostBlockBonus || 4;
            }
        }
        
        return { flatBonus };
    }

    /**
     * Modify card cost based on fragments
     */
    modifyCardCost(card, baseCost) {
        let costMod = 0;
        
        // --- Entropy Tax: First card is free ---
        const entropyTax = this.getEquippedById('void_entropy_tax');
        if (entropyTax && this.combatState.firstCardThisTurn) {
            costMod -= baseCost; // Make it free
        }
        
        return Math.max(0, baseCost + costMod);
    }

    /**
     * Calculate incoming damage modifier (for Glass Cannon)
     */
    calculateIncomingDamageModifier(damage) {
        let multiplier = 1.0;
        
        const glass = this.getEquippedById('void_glass_cannon');
        if (glass) {
            multiplier *= glass.effect.bonus.allDamageReceivedMultiplier || 1.25;
        }
        
        return Math.floor(damage * multiplier);
    }

    // ==========================================
    // EVENT RESPONSE HOOKS
    // ==========================================

    onDamageTaken(data) {
        const { amount } = data;
        if (amount <= 0) return;
        
        // Suffering Echo: Queue bonus damage for next attack
        const echo = this.getEquippedById('void_suffering_echo');
        if (echo) {
            this.combatState.nextAttackBonus += echo.effect.bonus.nextAttackBonus || 3;
        }
    }

    onDamageDealt(data) {
        // Handled via calculateDamageModifiers in the combat pipeline
    }

    onEnemyKilled(data) {
        const { enemy, overkillDamage, remainingEnemies } = data;
        
        // --- Lethal Siphon: Exact lethal refunds energy ---
        const siphon = this.getEquippedById('void_lethal_siphon');
        if (siphon && overkillDamage === 0) {
            const refund = siphon.effect.bonus.energyRefund || 1;
            this.eventBus.emit('player:gainEnergy', refund);
            this.emitFragmentTrigger(siphon, 'energyRefund', refund);
        }
        
        // --- Overkill Cascade: Splash excess damage ---
        const cascade = this.getEquippedById('void_overkill_cascade');
        if (cascade && overkillDamage > 0 && remainingEnemies && remainingEnemies.length > 0) {
            const splashTarget = remainingEnemies[Math.floor(Math.random() * remainingEnemies.length)];
            this.eventBus.emit('damage:splash', {
                target: splashTarget,
                damage: overkillDamage,
                source: 'void_overkill_cascade'
            });
            this.emitFragmentTrigger(cascade, 'splash', overkillDamage);
        }
        
        // --- Death Rattle: Strip block from remaining enemies ---
        const rattle = this.getEquippedById('void_death_rattle');
        if (rattle && remainingEnemies && remainingEnemies.length > 0) {
            const stripAmount = rattle.effect.bonus.stripEnemyBlock || 3;
            remainingEnemies.forEach(e => {
                this.eventBus.emit('enemy:loseBlock', { enemy: e, amount: stripAmount });
            });
            this.emitFragmentTrigger(rattle, 'blockStrip', stripAmount);
        }
    }

    onEnemyBuffed(data) {
        // Mirror Intent: Gain block when enemy buffs
        const mirror = this.getEquippedById('void_mirror_intent');
        if (mirror) {
            const blockGain = mirror.effect.bonus.blockGain || 2;
            this.eventBus.emit('player:gainBlock', blockGain);
            this.emitFragmentTrigger(mirror, 'mirrorBlock', blockGain);
        }
    }

    // ==========================================
    // PASSIVE QUERIES (for UI / other systems)
    // ==========================================

    /**
     * Check if top draw card should be revealed (Void Sight)
     */
    shouldRevealTopDraw() {
        return !!this.getEquippedById('void_void_sight');
    }

    /**
     * Get chain multiplier base (modified by Chain Resonance)
     */
    getChainBaseMultiplier() {
        const resonance = this.getEquippedById('void_chain_resonance');
        return resonance ? (resonance.effect.bonus.chainBaseMultiplier || 1.2) : 1.0;
    }

    /**
     * Check if a card type bridges another chain type (Type Bleed)
     */
    doesTypeBridgeChain(cardType, chainType) {
        const bleed = this.getEquippedById('void_type_bleed');
        if (!bleed) return false;
        
        const bridge = bleed.effect.bonus.chainBridge || [];
        return bridge.includes(cardType) && bridge.includes(chainType);
    }

    // ==========================================
    // HELPERS
    // ==========================================

    getEquippedById(fragmentId) {
        return this.equippedFragments.find(f => f.id === fragmentId) || null;
    }

    getEquippedByType(type) {
        return this.equippedFragments.filter(f => f.type === type);
    }

    emitFragmentTrigger(fragment, effectType, value) {
        this.eventBus.emit('fragments:triggered', {
            fragmentId: fragment.id,
            fragmentName: fragment.name,
            effectType,
            value
        });
    }

    // ==========================================
    // SAVE / LOAD
    // ==========================================

    getSaveData() {
        return {
            equipped: this.equippedFragments.map(f => f.id),
            collected: [...this.collectedFragments]
        };
    }

    loadSaveData(data) {
        if (!data) return;
        
        this.equippedFragments = [];
        this.collectedFragments = data.collected || [];
        
        (data.equipped || []).forEach(id => {
            const fragment = this.fragmentDatabase[id];
            if (fragment) {
                this.equippedFragments.push({ ...fragment });
            }
        });
    }

    // ==========================================
    // UI DATA
    // ==========================================

    /**
     * Get data for rendering fragment UI
     */
    getUIData() {
        const unlocked = this.getUnlockedSlots();
        
        return {
            slots: Array.from({ length: this.maxSlots }, (_, i) => ({
                index: i,
                unlocked: i < unlocked,
                fragment: this.equippedFragments[i] || null,
                unlockThreshold: this.slotUnlockThresholds[i]
            })),
            collected: this.collectedFragments.map(id => this.fragmentDatabase[id]).filter(Boolean),
            totalCorruptionCost: this.equippedFragments.reduce((sum, f) => sum + (f.corruptionPerCombat || 0), 0)
        };
    }
}

export { VoidFragmentSystem };
