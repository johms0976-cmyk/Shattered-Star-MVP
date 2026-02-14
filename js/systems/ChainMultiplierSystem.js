/**
 * ChainMultiplierSystem.js - Balatro-Style Combat Chains
 * 
 * Playing cards of the same type consecutively builds a multiplier.
 * Different type breaks the chain and starts a new one.
 * Void Fragments can modify chain behavior.
 * 
 * Chain: Attack → Attack → Attack = x1.0 → x1.2 → x1.5
 * Break: Attack → Skill = chain resets to x1.0
 * 
 * @version 1.0.0
 * @system Shattered Star MVP
 */

class ChainMultiplierSystem {
    constructor(state, eventBus, voidFragmentSystem) {
        this.state = state;
        this.eventBus = eventBus;
        this.voidFragments = voidFragmentSystem;
        
        // Chain configuration
        this.config = {
            // Multiplier values per chain length
            // Index 0 = 1 card (no chain), 1 = 2 cards, 2 = 3 cards, etc.
            multiplierSteps: [1.0, 1.2, 1.5, 1.8, 2.0, 2.3, 2.5],
            maxChainLength: 7,
            
            // Visual feedback thresholds
            shakeThreshold: 3,     // Screen shake starts at chain 3
            glowThreshold: 2,      // Card glow at chain 2
            explosionThreshold: 5,  // Big visual at chain 5
            
            // Which card types can chain
            chainableTypes: ['attack', 'skill', 'power', 'corrupted'],
            
            // Multiplier applies to these effects
            affectsDamage: true,
            affectsBlock: true,
            affectsSelfDamage: false
        };
        
        // Current chain state
        this.chain = {
            active: false,
            type: null,           // 'attack', 'skill', 'power', 'corrupted'
            length: 0,
            multiplier: 1.0,
            maxThisRun: 0,        // Best chain this combat for stats
            totalChains: 0,       // Total chains completed this combat
            brokenChains: 0       // Times chain was broken (stat)
        };
        
        // History for visual effects
        this.chainHistory = [];   // Last N chain events for trail animation
        
        this.setupEventListeners();
        
        console.log('[ChainMultiplier] Initialized');
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    setupEventListeners() {
        this.eventBus.on('combat:start', () => this.resetChain());
        this.eventBus.on('combat:end', () => this.onCombatEnd());
        this.eventBus.on('turn:start', () => this.onTurnStart());
    }

    // ==========================================
    // CORE CHAIN LOGIC
    // ==========================================

    /**
     * Process a card being played and update chain state.
     * Called BEFORE damage/block calculation so multiplier is ready.
     * 
     * @param {Object} card - The card being played
     * @returns {Object} { multiplier, chainLength, chainType, continued, broke }
     */
    processCardPlay(card) {
        if (!card || !card.type) {
            return this.getChainResult(false);
        }
        
        const cardType = this.normalizeType(card.type);
        
        // Check if this type is chainable
        if (!this.config.chainableTypes.includes(cardType)) {
            return this.getChainResult(false);
        }
        
        // Check for Void Fragment: Type Bleed (skill continues attack chains, etc.)
        const bridged = this.voidFragments && 
            this.chain.active && 
            cardType !== this.chain.type &&
            this.voidFragments.doesTypeBridgeChain(cardType, this.chain.type);
        
        // Determine if chain continues
        const continues = this.chain.active && (cardType === this.chain.type || bridged);
        
        if (continues) {
            // EXTEND the chain
            this.chain.length++;
            this.chain.multiplier = this.getMultiplierForLength(this.chain.length);
            
            // Track max
            if (this.chain.length > this.chain.maxThisRun) {
                this.chain.maxThisRun = this.chain.length;
            }
            
            this.chainHistory.push({
                type: cardType,
                length: this.chain.length,
                multiplier: this.chain.multiplier,
                timestamp: Date.now(),
                bridged
            });
            
            // Emit chain growth event
            this.eventBus.emit('chain:grow', {
                type: this.chain.type,
                length: this.chain.length,
                multiplier: this.chain.multiplier,
                bridged,
                cardName: card.name
            });
            
            // Check for milestone effects
            this.checkChainMilestones();
            
            return this.getChainResult(true);
            
        } else {
            // BREAK and start new chain
            const oldChain = { ...this.chain };
            
            if (this.chain.active && this.chain.length >= 2) {
                this.chain.brokenChains++;
                this.chain.totalChains++;
                
                this.eventBus.emit('chain:break', {
                    previousType: oldChain.type,
                    previousLength: oldChain.length,
                    previousMultiplier: oldChain.multiplier,
                    newType: cardType
                });
            }
            
            // Start new chain
            this.chain.active = true;
            this.chain.type = cardType;
            this.chain.length = 1;
            this.chain.multiplier = this.getMultiplierForLength(1);
            
            this.chainHistory.push({
                type: cardType,
                length: 1,
                multiplier: this.chain.multiplier,
                timestamp: Date.now(),
                newChain: true
            });
            
            this.eventBus.emit('chain:start', {
                type: cardType,
                cardName: card.name
            });
            
            return this.getChainResult(false, oldChain);
        }
    }

    /**
     * Get the multiplier for a given chain length
     */
    getMultiplierForLength(length) {
        // Get base multiplier from Void Fragments (Chain Resonance)
        const baseMultiplier = this.voidFragments ? 
            this.voidFragments.getChainBaseMultiplier() : 1.0;
        
        const idx = Math.min(length - 1, this.config.multiplierSteps.length - 1);
        const stepMultiplier = this.config.multiplierSteps[idx];
        
        // If base > 1.0 (Chain Resonance), scale the chain up
        if (baseMultiplier > 1.0 && length > 1) {
            const bonus = (stepMultiplier - 1.0) * (baseMultiplier / 1.0);
            return 1.0 + bonus;
        }
        
        return stepMultiplier;
    }

    /**
     * Apply chain multiplier to a damage value
     */
    applyToValue(baseValue, isBlock = false) {
        if (!this.chain.active || this.chain.length < 2) return baseValue;
        
        if (isBlock && !this.config.affectsBlock) return baseValue;
        if (!isBlock && !this.config.affectsDamage) return baseValue;
        
        return Math.floor(baseValue * this.chain.multiplier);
    }

    /**
     * Get current multiplier (for display)
     */
    getCurrentMultiplier() {
        return this.chain.active ? this.chain.multiplier : 1.0;
    }

    /**
     * Get current chain info (for UI)
     */
    getChainInfo() {
        return {
            active: this.chain.active && this.chain.length >= 2,
            type: this.chain.type,
            length: this.chain.length,
            multiplier: this.chain.multiplier,
            maxThisRun: this.chain.maxThisRun,
            totalChains: this.chain.totalChains,
            isHot: this.chain.length >= this.config.shakeThreshold,
            isExplosive: this.chain.length >= this.config.explosionThreshold
        };
    }

    // ==========================================
    // CHAIN MILESTONES & EFFECTS
    // ==========================================

    checkChainMilestones() {
        const len = this.chain.length;
        
        // Screen shake at threshold
        if (len === this.config.shakeThreshold) {
            this.eventBus.emit('vfx:screenShake', { intensity: 'light', duration: 200 });
        }
        
        // Bigger shake at explosion threshold
        if (len === this.config.explosionThreshold) {
            this.eventBus.emit('vfx:screenShake', { intensity: 'heavy', duration: 400 });
            this.eventBus.emit('vfx:chainExplosion', { 
                type: this.chain.type, 
                multiplier: this.chain.multiplier 
            });
        }
        
        // Max chain bonus
        if (len === this.config.maxChainLength) {
            this.eventBus.emit('chain:maxReached', {
                type: this.chain.type,
                multiplier: this.chain.multiplier
            });
        }
    }

    // ==========================================
    // LIFECYCLE
    // ==========================================

    onTurnStart() {
        // Chain persists across turns within the same combat
        // But we emit an update for UI refresh
        if (this.chain.active) {
            this.eventBus.emit('chain:turnUpdate', this.getChainInfo());
        }
    }

    onCombatEnd() {
        // Record stats
        if (this.chain.maxThisRun > 0) {
            this.eventBus.emit('stats:chainRecord', {
                longestChain: this.chain.maxThisRun,
                totalChains: this.chain.totalChains
            });
        }
        this.resetChain();
    }

    resetChain() {
        this.chain = {
            active: false,
            type: null,
            length: 0,
            multiplier: 1.0,
            maxThisRun: 0,
            totalChains: 0,
            brokenChains: 0
        };
        this.chainHistory = [];
    }

    // ==========================================
    // HELPERS
    // ==========================================

    normalizeType(type) {
        if (!type) return 'attack';
        const t = type.toLowerCase().trim();
        // Echo cards (Shade) count as whatever they're mimicking
        if (t === 'echo') return 'attack';
        // Temporal cards (Lyria) count as skill
        if (t === 'temporal') return 'skill';
        return t;
    }

    getChainResult(continued, previousChain = null) {
        return {
            multiplier: this.chain.multiplier,
            chainLength: this.chain.length,
            chainType: this.chain.type,
            continued,
            broke: !continued && previousChain && previousChain.length >= 2,
            previousChain: previousChain && previousChain.length >= 2 ? {
                type: previousChain.type,
                length: previousChain.length,
                multiplier: previousChain.multiplier
            } : null
        };
    }

    /**
     * Preview what would happen if a card is played (for UI hover)
     */
    previewCardPlay(card) {
        if (!card || !card.type) {
            return { wouldContinue: false, nextMultiplier: 1.0 };
        }
        
        const cardType = this.normalizeType(card.type);
        
        const wouldContinue = this.chain.active && (
            cardType === this.chain.type ||
            (this.voidFragments && this.voidFragments.doesTypeBridgeChain(cardType, this.chain.type))
        );
        
        if (wouldContinue) {
            const nextLength = this.chain.length + 1;
            return {
                wouldContinue: true,
                nextMultiplier: this.getMultiplierForLength(nextLength),
                nextLength,
                chainType: this.chain.type
            };
        }
        
        return {
            wouldContinue: false,
            nextMultiplier: this.getMultiplierForLength(1),
            nextLength: 1,
            chainType: cardType
        };
    }

    // ==========================================
    // SAVE / LOAD (mid-combat persistence)
    // ==========================================

    getSaveData() {
        return { ...this.chain };
    }

    loadSaveData(data) {
        if (data) {
            Object.assign(this.chain, data);
        }
    }
}

export { ChainMultiplierSystem };
