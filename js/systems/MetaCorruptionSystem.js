/**
 * MetaCorruptionSystem.js - "The Game Watches Back" (Inscryption-inspired)
 * 
 * At high corruption (50%+), the game UI itself becomes an unreliable narrator.
 * False enemy intents, energy display flickers, cards leaking between piles,
 * and interface distortions - all with learnable tells so skilled players
 * can read the corruption's lies.
 * 
 * Corruption tiers:
 *   0-24%:  No meta effects
 *   25-49%: Subtle whispers, minor visual noise
 *   50-74%: Intent flickers, energy ghosts, UI tremors
 *   75-99%: Full unreliable narrator - false intents, card leaks, display lies
 *   100%:   Total breakdown
 * 
 * CRITICAL DESIGN RULE: Every lie has a TELL.
 * - False intents have a purple shimmer border
 * - Wrong energy numbers have a brief void flicker
 * - Leaked cards have void particle effects
 * - Distorted UI elements have a subtle chromatic aberration
 * 
 * @version 1.0.0
 * @system Shattered Star MVP
 */

class MetaCorruptionSystem {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        // Configuration per corruption tier
        this.tiers = {
            0: {
                name: 'Clear',
                intentFlickerChance: 0,
                energyGhostChance: 0,
                cardLeakChance: 0,
                uiTremorChance: 0,
                whisperChance: 0,
                costDisplayLieChance: 0,
                damageNumberLieChance: 0
            },
            25: {
                name: 'Whispers',
                intentFlickerChance: 0,
                energyGhostChance: 0,
                cardLeakChance: 0,
                uiTremorChance: 0.05,
                whisperChance: 0.15,
                costDisplayLieChance: 0,
                damageNumberLieChance: 0
            },
            50: {
                name: 'Distortion',
                intentFlickerChance: 0.15,
                energyGhostChance: 0.10,
                cardLeakChance: 0,
                uiTremorChance: 0.12,
                whisperChance: 0.30,
                costDisplayLieChance: 0.08,
                damageNumberLieChance: 0.05
            },
            75: {
                name: 'Unreliable',
                intentFlickerChance: 0.30,
                energyGhostChance: 0.20,
                cardLeakChance: 0.10,
                uiTremorChance: 0.25,
                whisperChance: 0.50,
                costDisplayLieChance: 0.15,
                damageNumberLieChance: 0.12
            },
            100: {
                name: 'Collapse',
                intentFlickerChance: 0.50,
                energyGhostChance: 0.35,
                cardLeakChance: 0.20,
                uiTremorChance: 0.40,
                whisperChance: 0.80,
                costDisplayLieChance: 0.25,
                damageNumberLieChance: 0.20
            }
        };
        
        // Active lies being displayed (so we can clean them up)
        this.activeLies = {
            intents: new Map(),       // enemyId -> { realIntent, fakeIntent }
            energy: null,             // { realValue, displayedValue, timeout }
            cardCosts: new Map(),     // cardInstanceId -> { realCost, displayedCost }
            damageNumbers: [],        // Recent false damage numbers
            leakedCards: []           // Cards that "leaked" from discard
        };
        
        // Whisper messages (void taunts shown briefly)
        this.whispers = [
            "You're not reading this correctly.",
            "That number was wrong.",
            "Are you sure that's what the enemy intends?",
            "The deck remembers what you discarded.",
            "Nothing here is real.",
            "Check again.",
            "The void sees your strategy.",
            "Trust nothing. Especially this.",
            "Your energy is... fluctuating.",
            "Was that always there?",
            "The cards are restless.",
            "Something moved in your discard pile.",
            "Is that really what it costs?",
            "The enemies are lying to you. Or am I?",
            "Count your cards again.",
            "The void appreciates your attention.",
            "Reality is a suggestion here.",
            "Did you notice the change?",
            "Your eyes are not deceiving you. Or are they?",
            "The corruption speaks through the interface."
        ];
        
        // Timing control
        this.lastWhisperTime = 0;
        this.whisperCooldown = 8000; // Min 8s between whispers
        this.lastFlickerTime = 0;
        this.flickerCooldown = 3000;
        
        // Active effect tracking
        this.activeIntervals = [];
        this.activeTimeouts = [];
        
        this.setupEventListeners();
        
        console.log('[MetaCorruption] The game is watching. Initialized.');
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    setupEventListeners() {
        this.eventBus.on('combat:start', () => this.onCombatStart());
        this.eventBus.on('combat:end', () => this.onCombatEnd());
        this.eventBus.on('turn:start', () => this.onTurnStart());
        this.eventBus.on('turn:end', () => this.onTurnEnd());
        this.eventBus.on('enemy:intentRevealed', (data) => this.onIntentRevealed(data));
        this.eventBus.on('corruption:changed', () => this.onCorruptionChanged());
        this.eventBus.on('card:drawn', (data) => this.onCardDrawn(data));
    }

    // ==========================================
    // TIER RESOLUTION
    // ==========================================

    getCurrentTier() {
        const corruption = this.state.get('corruption') || 0;
        if (corruption >= 100) return this.tiers[100];
        if (corruption >= 75) return this.tiers[75];
        if (corruption >= 50) return this.tiers[50];
        if (corruption >= 25) return this.tiers[25];
        return this.tiers[0];
    }

    getCorruptionLevel() {
        return this.state.get('corruption') || 0;
    }

    // ==========================================
    // INTENT CORRUPTION - "The enemies are lying"
    // ==========================================

    /**
     * When an enemy reveals intent, potentially show a false one first.
     * The false intent has a TELL: purple shimmer border + brief flicker.
     */
    onIntentRevealed(data) {
        const { enemy, intent } = data;
        if (!enemy || !intent) return;
        
        const tier = this.getCurrentTier();
        
        if (Math.random() < tier.intentFlickerChance) {
            const fakeIntent = this.generateFakeIntent(intent);
            
            // Store the lie
            this.activeLies.intents.set(enemy.id || enemy.name, {
                realIntent: intent,
                fakeIntent,
                revealed: false
            });
            
            // Show the fake intent first
            this.eventBus.emit('meta:falseIntent', {
                enemy,
                fakeIntent,
                realIntent: intent,
                hasTell: true // UI should render with purple shimmer
            });
            
            // After a delay, "correct" to real intent with a glitch
            const correctionDelay = 1500 + Math.random() * 2000;
            const timeout = setTimeout(() => {
                const lie = this.activeLies.intents.get(enemy.id || enemy.name);
                if (lie && !lie.revealed) {
                    lie.revealed = true;
                    this.eventBus.emit('meta:intentCorrected', {
                        enemy,
                        realIntent: intent,
                        wasShowing: fakeIntent
                    });
                }
            }, correctionDelay);
            
            this.activeTimeouts.push(timeout);
        }
    }

    /**
     * Generate a plausible but wrong intent
     */
    generateFakeIntent(realIntent) {
        const intentTypes = ['attack', 'defend', 'buff', 'debuff', 'special'];
        const fakeType = intentTypes.filter(t => t !== realIntent.type);
        const chosenType = fakeType[Math.floor(Math.random() * fakeType.length)];
        
        // Generate a fake value that's close to real but wrong
        let fakeValue = realIntent.value || 0;
        if (fakeValue > 0) {
            const variance = Math.max(2, Math.floor(fakeValue * 0.4));
            fakeValue += (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * variance));
            fakeValue = Math.max(1, fakeValue);
        }
        
        return {
            type: chosenType,
            value: fakeValue,
            isFake: true, // Internal flag, NOT shown to player
            tell: 'shimmer' // The visual tell type
        };
    }

    /**
     * Check if an intent being displayed is currently a lie
     */
    isIntentCorrupted(enemyId) {
        const lie = this.activeLies.intents.get(enemyId);
        return lie && !lie.revealed;
    }

    // ==========================================
    // ENERGY DISPLAY CORRUPTION - "Your energy is wrong"
    // ==========================================

    /**
     * Periodically flash wrong energy number.
     * TELL: The wrong number has a brief void-purple glow before correcting.
     */
    tryEnergyGhost() {
        const tier = this.getCurrentTier();
        if (Math.random() >= tier.energyGhostChance) return;
        
        const now = Date.now();
        if (now - this.lastFlickerTime < this.flickerCooldown) return;
        this.lastFlickerTime = now;
        
        const realEnergy = this.state.get('combat.energy') || this.state.get('hero.energy') || 0;
        
        // Show a wrong number: +1 or -1 from real, or occasionally +2
        const offset = Math.random() > 0.7 ? 2 : 1;
        const direction = Math.random() > 0.5 ? 1 : -1;
        const fakeEnergy = Math.max(0, realEnergy + (offset * direction));
        
        if (fakeEnergy === realEnergy) return; // No point lying with truth
        
        this.activeLies.energy = {
            realValue: realEnergy,
            displayedValue: fakeEnergy
        };
        
        this.eventBus.emit('meta:energyGhost', {
            fakeEnergy,
            realEnergy,
            duration: 600 + Math.random() * 800,
            tell: 'voidGlow' // Purple flash on the energy orb
        });
        
        // Auto-correct after duration
        const timeout = setTimeout(() => {
            this.activeLies.energy = null;
            this.eventBus.emit('meta:energyCorrected', { realEnergy });
        }, 600 + Math.random() * 800);
        
        this.activeTimeouts.push(timeout);
    }

    // ==========================================
    // CARD COST LIES - "That doesn't cost what you think"
    // ==========================================

    /**
     * When drawing cards, potentially display wrong cost briefly.
     * TELL: Wrong cost has a subtle flicker animation and slightly different font color.
     */
    onCardDrawn(data) {
        const { card } = data;
        if (!card) return;
        
        const tier = this.getCurrentTier();
        if (Math.random() >= tier.costDisplayLieChance) return;
        
        const realCost = card.cost || 0;
        const fakeCost = Math.max(0, realCost + (Math.random() > 0.5 ? 1 : -1));
        
        if (fakeCost === realCost) return;
        
        const cardId = card.instanceId || card.id;
        this.activeLies.cardCosts.set(cardId, {
            realCost,
            displayedCost: fakeCost
        });
        
        this.eventBus.emit('meta:falseCost', {
            card,
            fakeCost,
            realCost,
            duration: 1200 + Math.random() * 1500,
            tell: 'costFlicker'
        });
        
        // Correct after delay
        const timeout = setTimeout(() => {
            this.activeLies.cardCosts.delete(cardId);
            this.eventBus.emit('meta:costCorrected', { card, realCost });
        }, 1200 + Math.random() * 1500);
        
        this.activeTimeouts.push(timeout);
    }

    // ==========================================
    // CARD LEAK - "Something moved in your discard pile"
    // ==========================================

    /**
     * At high corruption, a card briefly "leaks" from discard to draw.
     * It appears in hand with void particles, then fades away.
     * TELL: Leaked cards have purple particle border and are slightly translucent.
     */
    tryCardLeak() {
        const tier = this.getCurrentTier();
        if (Math.random() >= tier.cardLeakChance) return;
        
        // Get discard pile
        const discard = this.state.get('combat.discardPile') || [];
        if (discard.length === 0) return;
        
        // Pick a random discarded card
        const leakedCard = discard[Math.floor(Math.random() * discard.length)];
        
        this.eventBus.emit('meta:cardLeak', {
            card: { ...leakedCard, isPhantom: true },
            duration: 2000 + Math.random() * 2000,
            tell: 'voidParticles', // Translucent + purple particles
            source: 'discard'
        });
        
        this.activeLies.leakedCards.push(leakedCard.name);
        
        // The leaked card is NOT actually playable
        // It disappears after the duration
        const timeout = setTimeout(() => {
            this.eventBus.emit('meta:cardLeakFade', { card: leakedCard });
            this.activeLies.leakedCards = this.activeLies.leakedCards
                .filter(n => n !== leakedCard.name);
        }, 2000 + Math.random() * 2000);
        
        this.activeTimeouts.push(timeout);
    }

    // ==========================================
    // DAMAGE NUMBER LIES - "That wasn't really how much it dealt"
    // ==========================================

    /**
     * Occasionally show wrong damage number briefly before correcting.
     * TELL: The wrong number flashes red/purple, then corrects to white.
     */
    tryDamageNumberLie(realDamage) {
        const tier = this.getCurrentTier();
        if (Math.random() >= tier.damageNumberLieChance) return null;
        
        // Show a number that's 20-60% off
        const variance = 0.2 + Math.random() * 0.4;
        const direction = Math.random() > 0.5 ? 1 : -1;
        const fakeDamage = Math.max(1, Math.round(realDamage * (1 + variance * direction)));
        
        if (fakeDamage === realDamage) return null;
        
        return {
            fakeDamage,
            realDamage,
            correctionDelay: 400 + Math.random() * 300,
            tell: 'numberGlitch' // Flashes purple then corrects
        };
    }

    // ==========================================
    // WHISPERS - "The void speaks through the interface"
    // ==========================================

    /**
     * Show a brief whisper message on screen.
     * These are small, translucent text that appears and fades.
     */
    tryWhisper() {
        const tier = this.getCurrentTier();
        if (Math.random() >= tier.whisperChance) return;
        
        const now = Date.now();
        if (now - this.lastWhisperTime < this.whisperCooldown) return;
        this.lastWhisperTime = now;
        
        const message = this.whispers[Math.floor(Math.random() * this.whispers.length)];
        
        // Position: random edge of screen
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];
        const position = positions[Math.floor(Math.random() * positions.length)];
        
        this.eventBus.emit('meta:whisper', {
            message,
            position,
            duration: 2500 + Math.random() * 2000,
            corruption: this.getCorruptionLevel()
        });
    }

    // ==========================================
    // UI TREMOR - "The interface shakes"
    // ==========================================

    /**
     * Apply subtle tremor to UI elements.
     */
    tryUITremor() {
        const tier = this.getCurrentTier();
        if (Math.random() >= tier.uiTremorChance) return;
        
        // Pick a random UI element to tremor
        const targets = [
            'enemy-area',
            'hand-area',
            'energy-display',
            'player-stats',
            'draw-pile',
            'discard-pile'
        ];
        
        const target = targets[Math.floor(Math.random() * targets.length)];
        const intensity = this.getCorruptionLevel() / 100; // 0-1
        
        this.eventBus.emit('meta:uiTremor', {
            target,
            intensity: intensity * 3, // Max 3px tremor
            duration: 300 + Math.random() * 500,
            tell: 'chromatic' // Slight RGB split on affected element
        });
    }

    // ==========================================
    // COMBAT LIFECYCLE
    // ==========================================

    onCombatStart() {
        this.clearAllLies();
        
        // Start periodic effect checks
        const corruptionTick = setInterval(() => {
            if (!this.isInCombat()) {
                clearInterval(corruptionTick);
                return;
            }
            
            this.tryWhisper();
            this.tryUITremor();
            this.tryEnergyGhost();
        }, 3000 + Math.random() * 2000);
        
        this.activeIntervals.push(corruptionTick);
    }

    onCombatEnd() {
        this.clearAllLies();
        this.cleanupTimers();
    }

    onTurnStart() {
        // Clear intent lies from previous turn
        this.activeLies.intents.clear();
        this.activeLies.cardCosts.clear();
        
        // Try card leak at start of turn (feels most unsettling)
        this.tryCardLeak();
    }

    onTurnEnd() {
        // Energy ghost more likely at end of turn
        this.tryEnergyGhost();
    }

    onCorruptionChanged() {
        // When corruption changes, immediately check for new tier effects
        const tier = this.getCurrentTier();
        this.eventBus.emit('meta:tierChanged', { 
            tierName: tier.name,
            corruption: this.getCorruptionLevel()
        });
    }

    // ==========================================
    // QUERY METHODS (for CombatScreen rendering)
    // ==========================================

    /**
     * Get the intent to display for an enemy (may be false)
     */
    getDisplayIntent(enemyId, realIntent) {
        const lie = this.activeLies.intents.get(enemyId);
        if (lie && !lie.revealed) {
            return {
                intent: lie.fakeIntent,
                isCorrupted: true,
                tell: 'shimmer'
            };
        }
        return {
            intent: realIntent,
            isCorrupted: false,
            tell: null
        };
    }

    /**
     * Get the energy to display (may briefly be wrong)
     */
    getDisplayEnergy(realEnergy) {
        if (this.activeLies.energy) {
            return {
                energy: this.activeLies.energy.displayedValue,
                isCorrupted: true,
                tell: 'voidGlow'
            };
        }
        return {
            energy: realEnergy,
            isCorrupted: false,
            tell: null
        };
    }

    /**
     * Get the cost to display for a card (may briefly be wrong)
     */
    getDisplayCost(cardId, realCost) {
        const lie = this.activeLies.cardCosts.get(cardId);
        if (lie) {
            return {
                cost: lie.displayedCost,
                isCorrupted: true,
                tell: 'costFlicker'
            };
        }
        return {
            cost: realCost,
            isCorrupted: false,
            tell: null
        };
    }

    /**
     * Check if any phantom/leaked cards should be shown in hand
     */
    getPhantomCards() {
        return this.activeLies.leakedCards.length > 0;
    }

    // ==========================================
    // CLEANUP
    // ==========================================

    clearAllLies() {
        this.activeLies.intents.clear();
        this.activeLies.energy = null;
        this.activeLies.cardCosts.clear();
        this.activeLies.damageNumbers = [];
        this.activeLies.leakedCards = [];
    }

    cleanupTimers() {
        this.activeIntervals.forEach(id => clearInterval(id));
        this.activeTimeouts.forEach(id => clearTimeout(id));
        this.activeIntervals = [];
        this.activeTimeouts = [];
    }

    isInCombat() {
        return this.state.get('combat.active') || 
               this.state.get('inCombat') || 
               this.state.get('combat.enemies')?.length > 0;
    }

    // ==========================================
    // SAVE / LOAD
    // ==========================================

    getSaveData() {
        // Meta corruption is ephemeral - no persistent state needed
        return { active: true };
    }

    loadSaveData(data) {
        // Nothing to restore - effects regenerate from corruption level
    }

    /**
     * Destroy the system (cleanup)
     */
    destroy() {
        this.cleanupTimers();
        this.clearAllLies();
    }
}

export { MetaCorruptionSystem };
