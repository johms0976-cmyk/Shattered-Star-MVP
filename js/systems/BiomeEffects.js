/**
 * BiomeEffects.js - Regional biome effects for combat
 * Shattered Star
 * 
 * Each region has a unique biome effect that modifies combat rules:
 * - Ironspine Wastes: "Scavenger's Luck" — bonus scrap/credits on victory
 * - Eclipse Marsh: "Temporal Flux" — 1-2 random cards cost ±1 each turn
 * - Radiant Highlands: "Purifying Light" — less corruption gain, but corrupted cards weakened
 * - Obsidian Thicket: "Shifting Faces" — enemies may change intent mid-combat
 * - Cradle Abyss: "Xal'Korath's Gaze" — doubled corruption, empowered corrupted cards
 * 
 * Integration: CombatScreen calls biome methods at key moments.
 * This module is purely data-driven and side-effect-free except for event emissions.
 * 
 * @version 1.0.0
 */

const BIOME_EFFECTS = {
    ironspine_wastes: {
        id: 'scavengers_luck',
        name: "Scavenger's Luck",
        region: 'Ironspine Wastes',
        icon: '⚙️',
        description: 'Combat rewards include bonus scrap currency.',
        color: '#c87533',
        // Bonus credits on victory (flat + percentage)
        bonusCreditFlat: 8,
        bonusCreditPercent: 0.25,
        // Small chance for bonus artifact drop
        bonusArtifactChance: 0.08
    },
    eclipse_marsh: {
        id: 'temporal_flux',
        name: 'Temporal Flux',
        region: 'Eclipse Marsh',
        icon: '🌀',
        description: 'Each turn, 1-2 random cards in hand cost +1 or -1 energy.',
        color: '#7b68ee',
        // Number of cards affected per turn
        cardsAffectedMin: 1,
        cardsAffectedMax: 2,
        // Cost shift range
        costShift: [-1, 1]
    },
    radiant_highlands: {
        id: 'purifying_light',
        name: 'Purifying Light',
        region: 'Radiant Highlands',
        icon: '✨',
        description: 'Corruption gain reduced by 2. Corrupted cards deal 25% less damage.',
        color: '#ffd700',
        // Flat corruption reduction per gain event
        corruptionReduction: 2,
        // Damage penalty for corrupted card type
        corruptedDamageMultiplier: 0.75
    },
    obsidian_thicket: {
        id: 'shifting_faces',
        name: 'Shifting Faces',
        region: 'Obsidian Thicket',
        icon: '🎭',
        description: 'Enemies may change their intent unpredictably each turn.',
        color: '#9b59b6',
        // Chance per enemy per turn to shift intent
        shiftChance: 0.25,
        // Can also swap enemy positions (cosmetic + targeting confusion)
        swapChance: 0.10
    },
    cradle_abyss: {
        id: 'xalkoraths_gaze',
        name: "Xal'Korath's Gaze",
        region: 'Cradle Abyss',
        icon: '👁️',
        description: 'Corruption gain doubled. Corrupted cards deal 30% bonus damage.',
        color: '#ff00ff',
        // Corruption gain multiplier
        corruptionMultiplier: 2.0,
        // Damage bonus for corrupted cards
        corruptedDamageMultiplier: 1.30,
        // Ambient corruption per combat (gained at combat start)
        ambientCorruption: 2
    }
};

// Map act numbers to default regions (fallback when region not set)
const ACT_REGION_MAP = {
    1: 'ironspine_wastes',
    2: 'eclipse_marsh',   // Could also be radiant_highlands or obsidian_thicket
    3: 'cradle_abyss'
};

class BiomeEffects {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.activeEffect = null;
        this.turnModifiers = [];  // Cards with modified costs this turn
        this.combatActive = false;
        
        this.setupListeners();
        console.log('[BiomeEffects] System initialized');
    }
    
    setupListeners() {
        // React to corruption gain events to apply biome modifiers
        this.eventBus.on('corruption:gained', (amount) => {
            if (!this.activeEffect) return;
            // Modifiers are applied before the event, but we track for UI
        });
    }
    
    // ─────────────────────────────────────────────
    // COMBAT LIFECYCLE - Called by CombatScreen
    // ─────────────────────────────────────────────
    
    /**
     * Called when combat begins. Determines active biome and applies start-of-combat effects.
     * @returns {Object|null} The active biome effect, or null
     */
    onCombatStart() {
        const regionId = this.getCurrentRegion();
        this.activeEffect = BIOME_EFFECTS[regionId] || null;
        this.turnModifiers = [];
        this.combatActive = true;
        
        if (!this.activeEffect) {
            console.log('[BiomeEffects] No biome effect for region:', regionId);
            return null;
        }
        
        console.log(`[BiomeEffects] ═══ Active: ${this.activeEffect.name} (${this.activeEffect.region}) ═══`);
        
        // Cradle Abyss: ambient corruption at combat start
        if (this.activeEffect.id === 'xalkoraths_gaze' && this.activeEffect.ambientCorruption) {
            const corruption = this.state.get('corruption') || 0;
            const gain = this.activeEffect.ambientCorruption;
            this.state.set('corruption', Math.min(100, corruption + gain));
            this.eventBus.emit('corruption:gained', gain);
            console.log(`[BiomeEffects] Ambient corruption: +${gain}`);
        }
        
        this.eventBus.emit('biome:activated', this.activeEffect);
        return this.activeEffect;
    }
    
    /**
     * Called at the start of each player turn. Applies per-turn effects.
     * @param {Array} hand - Current hand of cards
     * @returns {Array} Modified hand (for Temporal Flux) or original hand
     */
    onTurnStart(hand) {
        this.turnModifiers = [];
        
        if (!this.activeEffect || !hand || hand.length === 0) return hand;
        
        // Temporal Flux: randomly modify 1-2 card costs
        if (this.activeEffect.id === 'temporal_flux') {
            return this.applyTemporalFlux(hand);
        }
        
        return hand;
    }
    
    /**
     * Called when combat ends in victory. Returns bonus rewards.
     * @param {Object} baseRewards - The standard rewards object
     * @returns {Object} Modified rewards with biome bonuses
     */
    onCombatVictory(baseRewards) {
        this.combatActive = false;
        
        if (!this.activeEffect) return baseRewards;
        
        const modified = { ...baseRewards };
        
        // Scavenger's Luck: bonus credits
        if (this.activeEffect.id === 'scavengers_luck') {
            const bonusFlat = this.activeEffect.bonusCreditFlat;
            const bonusPercent = Math.floor((modified.credits || 0) * this.activeEffect.bonusCreditPercent);
            const totalBonus = bonusFlat + bonusPercent;
            
            modified.credits = (modified.credits || 0) + totalBonus;
            modified.bonusCredits = totalBonus;
            modified.biomeBonus = `Scavenger's Luck: +${totalBonus} ◈`;
            
            console.log(`[BiomeEffects] Scavenger's Luck: +${totalBonus} credits`);
        }
        
        return modified;
    }
    
    /**
     * Called when combat ends (victory or defeat). Cleans up.
     */
    onCombatEnd() {
        this.combatActive = false;
        this.turnModifiers = [];
        this.eventBus.emit('biome:deactivated');
    }
    
    // ─────────────────────────────────────────────
    // MODIFIER QUERIES - Called by CombatScreen
    // ─────────────────────────────────────────────
    
    /**
     * Get damage modifier for a card being played.
     * @param {Object} card - The card being played
     * @returns {number} Damage multiplier (1.0 = no change)
     */
    getDamageModifier(card) {
        if (!this.activeEffect) return 1.0;
        
        const isCorrupted = card.type === 'corrupted' || card.corrupted;
        
        // Purifying Light: corrupted cards deal less damage
        if (this.activeEffect.id === 'purifying_light' && isCorrupted) {
            return this.activeEffect.corruptedDamageMultiplier; // 0.75
        }
        
        // Xal'Korath's Gaze: corrupted cards deal MORE damage
        if (this.activeEffect.id === 'xalkoraths_gaze' && isCorrupted) {
            return this.activeEffect.corruptedDamageMultiplier; // 1.30
        }
        
        return 1.0;
    }
    
    /**
     * Modify corruption gain amount based on biome.
     * Call this BEFORE applying corruption to state.
     * @param {number} baseAmount - Original corruption gain
     * @returns {number} Modified corruption amount
     */
    modifyCorruptionGain(baseAmount) {
        if (!this.activeEffect || baseAmount <= 0) return baseAmount;
        
        // Purifying Light: reduce corruption gain
        if (this.activeEffect.id === 'purifying_light') {
            return Math.max(0, baseAmount - this.activeEffect.corruptionReduction);
        }
        
        // Xal'Korath's Gaze: double corruption gain
        if (this.activeEffect.id === 'xalkoraths_gaze') {
            return Math.floor(baseAmount * this.activeEffect.corruptionMultiplier);
        }
        
        return baseAmount;
    }
    
    /**
     * Check if enemies should shift intents (Shifting Faces).
     * Called during enemy turn.
     * @param {Array} enemies - Current enemy array
     * @returns {Array} Potentially modified enemies with shifted intents
     */
    applyShiftingFaces(enemies) {
        if (!this.activeEffect || this.activeEffect.id !== 'shifting_faces') return enemies;
        if (!enemies || enemies.length === 0) return enemies;
        
        const modified = [...enemies];
        
        modified.forEach((enemy, i) => {
            // Chance to shift intent
            if (Math.random() < this.activeEffect.shiftChance) {
                const oldIntent = enemy.intent ? { ...enemy.intent } : null;
                
                // Generate a completely new random intent
                const intentTypes = ['attack', 'block', 'buff', 'debuff'];
                const newType = intentTypes[Math.floor(Math.random() * intentTypes.length)];
                
                switch (newType) {
                    case 'attack':
                        enemy.intent = {
                            type: 'attack',
                            damage: Math.floor(Math.random() * 8) + 4
                        };
                        break;
                    case 'block':
                        enemy.intent = {
                            type: 'block',
                            value: Math.floor(Math.random() * 8) + 4
                        };
                        break;
                    case 'buff':
                        enemy.intent = {
                            type: 'buff',
                            effect: 'strength',
                            value: Math.floor(Math.random() * 2) + 1
                        };
                        break;
                    case 'debuff':
                        enemy.intent = {
                            type: 'debuff',
                            effect: Math.random() < 0.5 ? 'weak' : 'vulnerable',
                            value: 1
                        };
                        break;
                }
                
                console.log(`[BiomeEffects] Shifting Faces: ${enemy.name} intent changed from ${oldIntent?.type} → ${enemy.intent.type}`);
                
                this.eventBus.emit('biome:intentShift', {
                    enemy,
                    oldIntent,
                    newIntent: enemy.intent
                });
            }
        });
        
        // Rare: swap enemy positions (affects targeting)
        if (modified.length > 1 && Math.random() < this.activeEffect.swapChance) {
            const a = Math.floor(Math.random() * modified.length);
            let b = Math.floor(Math.random() * modified.length);
            while (b === a) b = Math.floor(Math.random() * modified.length);
            
            [modified[a], modified[b]] = [modified[b], modified[a]];
            console.log(`[BiomeEffects] Shifting Faces: swapped positions of ${modified[a].name} and ${modified[b].name}`);
            
            this.eventBus.emit('biome:enemySwap', { a: modified[a], b: modified[b] });
        }
        
        return modified;
    }
    
    // ─────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────
    
    /**
     * Apply Temporal Flux: modify 1-2 random card costs by ±1
     */
    applyTemporalFlux(hand) {
        const effect = this.activeEffect;
        const count = effect.cardsAffectedMin + 
            Math.floor(Math.random() * (effect.cardsAffectedMax - effect.cardsAffectedMin + 1));
        
        // Pick random card indices
        const indices = [];
        const available = hand.map((_, i) => i);
        for (let i = 0; i < Math.min(count, available.length); i++) {
            const pick = Math.floor(Math.random() * available.length);
            indices.push(available[pick]);
            available.splice(pick, 1);
        }
        
        const modifiedHand = hand.map((card, i) => {
            if (indices.includes(i)) {
                const shift = Math.random() < 0.5 ? -1 : 1;
                const originalCost = card._originalCost !== undefined ? card._originalCost : card.cost;
                const newCost = Math.max(0, originalCost + shift);
                
                const modifier = {
                    cardIndex: i,
                    cardName: card.name,
                    originalCost: originalCost,
                    newCost: newCost,
                    shift: shift
                };
                this.turnModifiers.push(modifier);
                
                console.log(`[BiomeEffects] Temporal Flux: ${card.name} cost ${originalCost} → ${newCost} (${shift > 0 ? '+' : ''}${shift})`);
                
                return {
                    ...card,
                    _originalCost: originalCost,
                    cost: newCost,
                    _temporalFlux: shift
                };
            }
            // Reset any previous flux on non-affected cards
            if (card._temporalFlux !== undefined) {
                return {
                    ...card,
                    cost: card._originalCost !== undefined ? card._originalCost : card.cost,
                    _temporalFlux: undefined,
                    _originalCost: undefined
                };
            }
            return card;
        });
        
        if (this.turnModifiers.length > 0) {
            this.eventBus.emit('biome:temporalFlux', this.turnModifiers);
        }
        
        return modifiedHand;
    }
    
    /**
     * Determine current region from game state
     */
    getCurrentRegion() {
        // Check explicit region setting
        const region = this.state.get('region') || this.state.get('map.region');
        if (region) {
            // Normalize region name to key format
            return region.toLowerCase().replace(/\s+/g, '_');
        }
        
        // Fall back to act-based region
        const act = this.state.get('act') || 1;
        return ACT_REGION_MAP[act] || 'ironspine_wastes';
    }
    
    // ─────────────────────────────────────────────
    // UI HELPERS
    // ─────────────────────────────────────────────
    
    /**
     * Get the active effect for UI display
     */
    getActiveEffect() {
        return this.activeEffect;
    }
    
    /**
     * Check if a card has been modified by Temporal Flux this turn
     * @param {number} cardIndex - Index in hand
     * @returns {Object|null} Modifier info or null
     */
    getFluxModifier(cardIndex) {
        return this.turnModifiers.find(m => m.cardIndex === cardIndex) || null;
    }
    
    /**
     * Render the biome effect banner HTML for the combat screen
     */
    renderBanner() {
        if (!this.activeEffect) return '';
        
        const e = this.activeEffect;
        return `
            <div class="biome-effect-banner" style="--biome-color: ${e.color}">
                <span class="biome-icon">${e.icon}</span>
                <span class="biome-name">${e.name}</span>
                <span class="biome-desc">${e.description}</span>
            </div>
        `;
    }
    
    /**
     * Check if Temporal Flux visual should show on a card
     */
    hasTemporalFlux(card) {
        return card._temporalFlux !== undefined && card._temporalFlux !== 0;
    }
    
    getTemporalFluxDirection(card) {
        if (!card._temporalFlux) return null;
        return card._temporalFlux > 0 ? 'increased' : 'decreased';
    }
}

export default BiomeEffects;
export { BIOME_EFFECTS, ACT_REGION_MAP };
