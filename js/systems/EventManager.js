/**
 * EventManager - Manages event selection, history, flags, and chains
 * 
 * Layer 1: Event History Tracker - prevents repeats
 * Layer 2: Event Flags System - choices set flags, events/choices read them
 * Layer 3: Event Chains - choices unlock follow-up events
 * Layer 4: Effects Processing - converts flat JSON effects to mechanical rewards
 * Layer 5: Data validation - ensures every choice has real consequences
 */

class EventManager {
    constructor(gameState, eventBus, dataLoader) {
        this.state = gameState;
        this.eventBus = eventBus;
        this.dataLoader = dataLoader;

        // ── Layer 1: History ────────────────────────────────────────
        // Tracks which events have been seen THIS RUN
        this.eventsCompleted = [];
        // Maps eventId → choiceIndex so we know WHAT they chose
        this.eventChoicesMade = {};

        // ── Layer 2: Flags ─────────────────────────────────────────
        // Persistent flags set by event choices (lore keys, story beats, etc.)
        this.eventFlags = {};

        // ── Layer 3: Chains ────────────────────────────────────────
        // Event IDs that have been unlocked by previous choices
        // These get priority weighting during selection
        this.unlockedEvents = [];

        // ── Layer 4: Insight buffs ─────────────────────────────────
        // Temporary combat buffs earned from "information" choices
        this.pendingInsights = [];

        // ── Repeatable events (explicitly marked) ──────────────────
        this.repeatableEvents = new Set([
            'rest_site_choice',   // Rest sites should always be available
            'merchant_camp'       // Merchants can be revisited
        ]);

        // Wire up event listeners
        this._setupListeners();

        console.log('[EventManager] Initialized');
    }

    // ═══════════════════════════════════════════════════════════════
    //  LAYER 1: EVENT HISTORY & REPEAT PREVENTION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Record that an event was seen
     */
    recordEventCompleted(eventId, choiceIndex) {
        if (!this.eventsCompleted.includes(eventId)) {
            this.eventsCompleted.push(eventId);
        }
        this.eventChoicesMade[eventId] = choiceIndex;

        console.log(`[EventManager] Event completed: ${eventId}, choice: ${choiceIndex}`);
        console.log(`[EventManager] Events seen this run: ${this.eventsCompleted.length}`);
    }

    /**
     * Check if an event has already been seen this run
     */
    hasSeenEvent(eventId) {
        return this.eventsCompleted.includes(eventId);
    }

    /**
     * Check if player made a specific choice in a past event
     */
    getChoiceMade(eventId) {
        return this.eventChoicesMade[eventId] ?? null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  LAYER 2: EVENT FLAGS SYSTEM
    // ═══════════════════════════════════════════════════════════════

    /**
     * Set a flag (from lore keys, story beats, etc.)
     */
    setFlag(flagName, value = true) {
        this.eventFlags[flagName] = value;
        // Also mirror to GameState flags for save compatibility
        try {
            this.state.set(`flags.${flagName}`, value, true);
        } catch (e) {
            // Silent fail if GameState doesn't support this path
        }
        console.log(`[EventManager] Flag set: ${flagName} = ${value}`);
    }

    /**
     * Check if a flag is set
     */
    hasFlag(flagName) {
        return !!this.eventFlags[flagName];
    }

    /**
     * Get all current flags
     */
    getFlags() {
        return { ...this.eventFlags };
    }

    /**
     * Check if ALL required flags are met
     */
    checkFlagRequirements(requiredFlags) {
        if (!requiredFlags || requiredFlags.length === 0) return true;
        return requiredFlags.every(flag => this.hasFlag(flag));
    }

    /**
     * Check if a set of requirements is met
     * Supports: flags, minCorruption, maxCorruption, minCredits, 
     *           heroId, minReputation, eventSeen, eventNotSeen
     */
    checkRequirements(requirements) {
        if (!requirements) return true;

        // Flag requirements
        if (requirements.flags) {
            if (!this.checkFlagRequirements(requirements.flags)) return false;
        }

        // Corruption requirements
        const corruption = this.state.get('corruption') || 0;
        if (requirements.minCorruption !== undefined && corruption < requirements.minCorruption) {
            return false;
        }
        if (requirements.maxCorruption !== undefined && corruption > requirements.maxCorruption) {
            return false;
        }

        // Credit requirements
        const credits = this.state.get('credits') || 0;
        if (requirements.minCredits !== undefined && credits < requirements.minCredits) {
            return false;
        }

        // Hero requirements
        if (requirements.heroId) {
            const heroId = this.state.get('hero.id');
            if (heroId !== requirements.heroId) return false;
        }

        // Reputation requirements
        if (requirements.minReputation) {
            for (const [faction, minRep] of Object.entries(requirements.minReputation)) {
                const currentRep = this.state.get(`factions.${faction}`) || 0;
                if (currentRep < minRep) return false;
            }
        }

        // "Must have seen this event" requirement
        if (requirements.eventSeen) {
            const eventsToCheck = Array.isArray(requirements.eventSeen)
                ? requirements.eventSeen
                : [requirements.eventSeen];
            if (!eventsToCheck.every(id => this.hasSeenEvent(id))) return false;
        }

        // "Must NOT have seen this event" requirement
        if (requirements.eventNotSeen) {
            const eventsToCheck = Array.isArray(requirements.eventNotSeen)
                ? requirements.eventNotSeen
                : [requirements.eventNotSeen];
            if (eventsToCheck.some(id => this.hasSeenEvent(id))) return false;
        }

        // Deck size requirement (for card removal)
        if (requirements.deckSize) {
            const deck = this.state.get('deck') || [];
            if (deck.length < requirements.deckSize) return false;
        }

        // Lore/flag requirement (legacy format from existing data)
        if (requirements.lore) {
            if (!this.hasFlag(requirements.lore)) return false;
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  LAYER 3: EVENT CHAINS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Unlock a chain event for future encounters
     */
    unlockEvent(eventId) {
        if (!this.unlockedEvents.includes(eventId)) {
            this.unlockedEvents.push(eventId);
            console.log(`[EventManager] Chain event unlocked: ${eventId}`);
        }
    }

    /**
     * Check if an event was explicitly unlocked by a previous choice
     */
    isEventUnlocked(eventId) {
        return this.unlockedEvents.includes(eventId);
    }

    /**
     * Remove an unlocked event after it fires (it's been consumed)
     */
    consumeUnlockedEvent(eventId) {
        const idx = this.unlockedEvents.indexOf(eventId);
        if (idx !== -1) {
            this.unlockedEvents.splice(idx, 1);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  LAYER 4: EFFECTS PROCESSING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Process flat JSON effects object into actual game state changes
     * This is the bridge between the event data format and the game systems
     * 
     * Handles: hp, maxHp, credits, corruption, reputation, lore, card,
     *          artifact, upgrade, removeCard, block, healPercent, status,
     *          combat, insight, setsFlags, unlocks, viewNextNodes, random
     */
    processEffects(effects, eventId = null) {
        if (!effects || typeof effects !== 'object') return;

        console.log(`[EventManager] Processing effects:`, effects);

        // ── HP changes ──
        if (effects.hp !== undefined) {
            const currentHp = this.state.get('hero.hp') || this.state.get('hp') || 50;
            const maxHp = this.state.get('hero.maxHp') || this.state.get('maxHp') || 80;
            const newHp = Math.max(0, Math.min(maxHp, currentHp + effects.hp));
            try {
                this.state.set('hero.hp', newHp);
            } catch (e) {
                this.state.set('hero.hp', newHp);
            }
            this.eventBus.emit('hp:changed', {
                current: newHp,
                max: maxHp,
                change: effects.hp
            });
            if (effects.hp > 0) {
                console.log(`[EventManager] Healed ${effects.hp} HP → ${newHp}`);
            } else {
                console.log(`[EventManager] Lost ${Math.abs(effects.hp)} HP → ${newHp}`);
            }
        }

        // ── Max HP changes ──
        if (effects.maxHp !== undefined) {
            const currentMax = this.state.get('hero.maxHp') || this.state.get('maxHp') || 80;
            const newMax = Math.max(1, currentMax + effects.maxHp);
            try {
                this.state.set('hero.maxHp', newMax);
            } catch (e) {
                this.state.set('hero.maxHp', newMax);
            }
            this.eventBus.emit('maxHp:changed', { max: newMax, change: effects.maxHp });
            console.log(`[EventManager] Max HP changed by ${effects.maxHp} → ${newMax}`);
        }

        // ── Heal by percentage ──
        if (effects.healPercent !== undefined) {
            const maxHp = this.state.get('hero.maxHp') || this.state.get('maxHp') || 80;
            const healAmount = Math.floor(maxHp * (effects.healPercent / 100));
            const currentHp = this.state.get('hero.hp') || this.state.get('hp') || 50;
            const newHp = Math.min(maxHp, currentHp + healAmount);
            try {
                this.state.set('hero.hp', newHp);
            } catch (e) {
                this.state.set('hero.hp', newHp);
            }
            this.eventBus.emit('hp:changed', {
                current: newHp,
                max: maxHp,
                change: healAmount
            });
            console.log(`[EventManager] Healed ${effects.healPercent}% (${healAmount} HP) → ${newHp}`);
        }

        // ── Credits ──
        if (effects.credits !== undefined) {
            const current = this.state.get('credits') || 0;
            const newCredits = Math.max(0, current + effects.credits);
            this.state.set('credits', newCredits);
            if (effects.credits > 0) {
                this.eventBus.emit('credits:gained', effects.credits);
            } else {
                this.eventBus.emit('credits:spent', Math.abs(effects.credits));
            }
            console.log(`[EventManager] Credits: ${current} → ${newCredits} (${effects.credits > 0 ? '+' : ''}${effects.credits})`);
        }

        // ── Corruption ──
        if (effects.corruption !== undefined) {
            const current = this.state.get('corruption') || 0;
            const newCorruption = Math.max(0, Math.min(100, current + effects.corruption));
            this.state.set('corruption', newCorruption);
            if (effects.corruption > 0) {
                this.eventBus.emit('corruption:gained', effects.corruption);
            } else {
                this.eventBus.emit('corruption:cleansed', Math.abs(effects.corruption));
            }
            console.log(`[EventManager] Corruption: ${current} → ${newCorruption}`);
        }

        // ── Reputation ──
        if (effects.reputation) {
            for (const [faction, change] of Object.entries(effects.reputation)) {
                const current = this.state.get(`factions.${faction}`) || 0;
                const newRep = current + change;
                this.state.set(`factions.${faction}`, newRep);
                this.eventBus.emit('faction:rep:changed', {
                    faction,
                    change,
                    total: newRep
                });
                console.log(`[EventManager] ${faction} reputation: ${current} → ${newRep}`);
            }
        }

        // ── Block (next combat temporary buff) ──
        if (effects.block !== undefined) {
            this.addInsight({
                type: 'block',
                value: effects.block,
                label: `+${effects.block} Block`,
                description: 'Start next combat with bonus Block'
            });
        }

        // ── Status effects (next combat buffs) ──
        if (effects.status) {
            for (const [statusName, value] of Object.entries(effects.status)) {
                this.addInsight({
                    type: 'status',
                    status: statusName,
                    value: value,
                    label: `+${value} ${statusName.charAt(0).toUpperCase() + statusName.slice(1)}`,
                    description: `Start next combat with ${value} ${statusName}`
                });
            }
        }

        // ── Lore flags (Layer 2) ──
        if (effects.lore) {
            this.setFlag(effects.lore);
            // Lore choices now also grant a small insight bonus
            this.addInsight({
                type: 'knowledge',
                value: 1,
                label: 'Knowledge Gained',
                description: `Learned: ${effects.lore.replace(/_/g, ' ')}`,
                loreKey: effects.lore
            });
        }

        // ── Explicit flag setting (Layer 2) ──
        if (effects.setsFlags) {
            const flags = Array.isArray(effects.setsFlags) ? effects.setsFlags : [effects.setsFlags];
            flags.forEach(flag => this.setFlag(flag));
        }

        // ── Chain event unlocking (Layer 3) ──
        if (effects.unlocks) {
            const unlocks = Array.isArray(effects.unlocks) ? effects.unlocks : [effects.unlocks];
            unlocks.forEach(eventId => this.unlockEvent(eventId));
        }

        // ── Card rewards ──
        if (effects.card) {
            this.eventBus.emit('event:card:reward', {
                cardId: effects.card,
                source: 'event'
            });
            console.log(`[EventManager] Card reward: ${effects.card}`);
        }

        // ── Artifact rewards ──
        if (effects.artifact) {
            const artifact = this.dataLoader.getRandomArtifact ?
                this.dataLoader.getRandomArtifact('common') : null;
            if (artifact) {
                const artifacts = this.state.get('artifacts') || [];
                artifacts.push(artifact);
                this.state.set('artifacts', artifacts);
                this.eventBus.emit('artifact:gained', artifact);
            }
            console.log(`[EventManager] Artifact reward: ${effects.artifact}`);
        }

        // ── Card upgrade ──
        if (effects.upgrade) {
            this.eventBus.emit('event:upgrade:offered', {
                type: effects.upgrade // 'choice' or 'random'
            });
            console.log(`[EventManager] Card upgrade offered: ${effects.upgrade}`);
        }

        // ── Card removal ──
        if (effects.removeCard) {
            this.eventBus.emit('event:removeCard:offered', {
                type: effects.removeCard // 'choice'
            });
            console.log(`[EventManager] Card removal offered: ${effects.removeCard}`);
        }

        // ── Combat trigger ──
        if (effects.combat) {
            this.eventBus.emit('event:combat:trigger', {
                enemyGroup: effects.combat
            });
            console.log(`[EventManager] Combat triggered: ${effects.combat}`);
        }

        // ── View next nodes ──
        if (effects.viewNextNodes) {
            this.eventBus.emit('map:reveal:next', {});
            console.log(`[EventManager] Map nodes revealed`);
        }

        // ── Random outcomes (coin flip) ──
        if (effects.random && Array.isArray(effects.random)) {
            const outcome = effects.random[Math.floor(Math.random() * effects.random.length)];
            console.log(`[EventManager] Random outcome selected:`, outcome);
            // Recursively process the randomly selected effects
            this.processEffects(outcome, eventId);
        }

        // ── Insight bonus (explicit) ──
        if (effects.insight) {
            this.addInsight({
                type: 'strength',
                value: effects.insight,
                label: `+${effects.insight} Strength`,
                description: 'Knowledge is power — bonus Strength next combat'
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  INSIGHT SYSTEM (makes info choices mechanically real)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Add a pending insight buff for the next combat
     */
    addInsight(insight) {
        this.pendingInsights.push(insight);
        this.eventBus.emit('insight:gained', insight);
        console.log(`[EventManager] Insight added: ${insight.label}`);
    }

    /**
     * Get and clear all pending insights (called at combat start)
     */
    consumeInsights() {
        const insights = [...this.pendingInsights];
        this.pendingInsights = [];
        return insights;
    }

    /**
     * Check if there are pending insights
     */
    hasPendingInsights() {
        return this.pendingInsights.length > 0;
    }

    // ═══════════════════════════════════════════════════════════════
    //  EVENT SELECTION (integrates all layers)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Select the next event, integrating history, flags, chains, and corruption
     * 
     * Priority order:
     * 1. Unlocked chain events (highest priority, 3x weight)
     * 2. Events whose requirements are met (normal weight)
     * 3. Generic/fallback events (lowest priority)
     */
    selectEvent(eventPool, act = 1) {
        if (!eventPool || eventPool.length === 0) {
            console.warn('[EventManager] Empty event pool!');
            return null;
        }

        const corruption = this.state.get('corruption') || 0;
        const heroId = this.state.get('hero.id') || 'korvax';

        // ── Step 1: Filter to eligible events ──
        const eligible = eventPool.filter(event => {
            // Skip already-seen events (unless repeatable)
            if (this.hasSeenEvent(event.id) && !this.repeatableEvents.has(event.id)) {
                return false;
            }

            // Check corruption minimums
            if (event.minCorruption !== undefined && corruption < event.minCorruption) {
                return false;
            }

            // Check corruption maximums
            if (event.maxCorruption !== undefined && corruption > event.maxCorruption) {
                return false;
            }

            // Check hero-specific events
            if (event.heroSpecific && event.heroSpecific !== heroId) {
                return false;
            }

            // Check complex requirements
            if (event.requirements && !this.checkRequirements(event.requirements)) {
                return false;
            }

            return true;
        });

        if (eligible.length === 0) {
            console.warn('[EventManager] No eligible events after filtering. Falling back to any unseen event.');
            // Fallback: allow any event not yet seen, ignoring requirements
            const fallback = eventPool.filter(e => !this.hasSeenEvent(e.id));
            if (fallback.length > 0) {
                return this._weightedSelect(fallback, corruption);
            }
            // Ultimate fallback: pick anything
            console.warn('[EventManager] All events seen. Picking random from full pool.');
            return { ...eventPool[Math.floor(Math.random() * eventPool.length)] };
        }

        // ── Step 2: Weighted selection with chain priority ──
        return this._weightedSelect(eligible, corruption);
    }

    /**
     * Weighted random selection favoring chain events and category variety
     */
    _weightedSelect(pool, corruption) {
        const weights = pool.map(event => {
            let weight = 1.0;

            // Chain events get 3x priority
            if (this.isEventUnlocked(event.id)) {
                weight *= 3.0;
            }

            // Hero-specific events get a boost
            if (event.heroSpecific) {
                weight *= 1.5;
            }

            // Lore events get a small boost if we haven't seen many
            if (event.category === 'lore') {
                const loreSeen = this.eventsCompleted.filter(id => {
                    const e = pool.find(p => p.id === id);
                    return e && e.category === 'lore';
                }).length;
                if (loreSeen < 2) weight *= 1.3;
            }

            // Corruption events become more likely at higher corruption
            if (event.category === 'corruption' && corruption > 30) {
                weight *= 1.0 + (corruption / 100);
            }

            // Apply event-level weight multiplier if specified
            if (event.weight) {
                weight *= event.weight;
            }

            return weight;
        });

        // Weighted random selection
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let roll = Math.random() * totalWeight;

        for (let i = 0; i < pool.length; i++) {
            roll -= weights[i];
            if (roll <= 0) {
                const selected = { ...pool[i] };
                // If this was a chain event, consume it
                if (this.isEventUnlocked(selected.id)) {
                    this.consumeUnlockedEvent(selected.id);
                }
                console.log(`[EventManager] Selected event: ${selected.id} (${selected.name})`);
                return selected;
            }
        }

        // Fallback
        return { ...pool[pool.length - 1] };
    }

    // ═══════════════════════════════════════════════════════════════
    //  CHOICE FILTERING (flag-gated choices)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Filter an event's choices to only those whose requirements are met
     * Returns the full choice objects with an `available` boolean added
     */
    filterChoices(event) {
        if (!event || !event.choices) return [];

        return event.choices.map((choice, index) => {
            const available = this.checkRequirements(choice.requirements);
            return {
                ...choice,
                originalIndex: index,
                available
            };
        });
    }

    /**
     * Get only available choices for an event
     */
    getAvailableChoices(event) {
        return this.filterChoices(event).filter(c => c.available);
    }

    // ═══════════════════════════════════════════════════════════════
    //  EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════

    _setupListeners() {
        // Apply insight buffs at combat start
        this.eventBus.on('combat:start', () => {
            const insights = this.consumeInsights();
            if (insights.length > 0) {
                console.log(`[EventManager] Applying ${insights.length} insight buffs to combat`);
                insights.forEach(insight => {
                    this.eventBus.emit('combat:applyInsight', insight);
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  SERIALIZATION (for save/load)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get serializable state for saving
     */
    serialize() {
        return {
            eventsCompleted: [...this.eventsCompleted],
            eventChoicesMade: { ...this.eventChoicesMade },
            eventFlags: { ...this.eventFlags },
            unlockedEvents: [...this.unlockedEvents],
            pendingInsights: [...this.pendingInsights]
        };
    }

    /**
     * Restore from saved state
     */
    deserialize(data) {
        if (!data) return;
        this.eventsCompleted = data.eventsCompleted || [];
        this.eventChoicesMade = data.eventChoicesMade || {};
        this.eventFlags = data.eventFlags || {};
        this.unlockedEvents = data.unlockedEvents || [];
        this.pendingInsights = data.pendingInsights || [];
        console.log(`[EventManager] Restored: ${this.eventsCompleted.length} events seen, ${Object.keys(this.eventFlags).length} flags set`);
    }

    /**
     * Reset for new run
     */
    reset() {
        this.eventsCompleted = [];
        this.eventChoicesMade = {};
        this.eventFlags = {};
        this.unlockedEvents = [];
        this.pendingInsights = [];
        console.log('[EventManager] Reset for new run');
    }
}

export { EventManager };
export default EventManager;
