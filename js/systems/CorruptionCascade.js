/**
 * CorruptionCascade — "The void intervenes"
 * 
 * Fires random micro-events whenever corruption crosses a multiple-of-10 threshold.
 * These cascades are NOT player-chosen — they just happen, creating surprise/dread.
 * Inspired by Candy Crush chain reactions and Balatro's joker trigger sequences.
 * 
 * Integration:
 *   import CorruptionCascade from '../systems/CorruptionCascade.js';
 *   const cascade = new CorruptionCascade(game.state, game.eventBus);
 *   // Call in applyCardEffects or wherever corruption changes:
 *   cascade.checkAndTrigger(oldCorruption, newCorruption);
 * 
 * @version 1.0.0
 */

// ═══════════════════════════════════════════
// CASCADE EVENT TABLE
// Each event has: id, name, flavor, weight, effect function
// Weight controls relative probability. Higher = more common.
// ═══════════════════════════════════════════

const CASCADE_EVENTS = [
    // ── Helpful cascades (the void tempts you) ──
    {
        id: 'void_surge',
        name: 'Void Surge',
        flavor: 'The void lashes out through you.',
        icon: '🌀',
        color: '#a855f7',
        weight: 15,
        tier: 'any',
        execute: (ctx) => {
            const enemies = ctx.state.get('combat.enemies') || [];
            const damage = 3 + Math.floor(ctx.corruption / 25);
            enemies.forEach(enemy => {
                if (enemy.currentHp > 0) {
                    const blocked = Math.min(enemy.block || 0, damage);
                    enemy.block = Math.max(0, (enemy.block || 0) - blocked);
                    enemy.currentHp -= (damage - blocked);
                }
            });
            ctx.state.set('combat.enemies', enemies);
            return { description: `Deal ${damage} damage to ALL enemies`, value: damage };
        }
    },
    {
        id: 'reality_slip',
        name: 'Reality Slip',
        flavor: 'Time stutters. Your hand fills with ghosts.',
        icon: '⏳',
        color: '#38bdf8',
        weight: 12,
        tier: 'any',
        execute: (ctx) => {
            // Draw 2 cards that cost 0 this turn
            const drawPile = ctx.state.get('combat.drawPile') || [];
            const hand = ctx.state.get('combat.hand') || [];
            let drawn = 0;
            for (let i = 0; i < 2 && drawPile.length > 0 && hand.length < 10; i++) {
                const card = drawPile.pop();
                card._cascadeFree = true;
                card._originalCost = card.cost;
                card.cost = 0;
                hand.push(card);
                drawn++;
            }
            ctx.state.set('combat.drawPile', drawPile);
            ctx.state.set('combat.hand', hand);
            return { description: `Draw ${drawn} cards. They cost 0 this turn.`, value: drawn };
        }
    },
    {
        id: 'whisper_gift',
        name: 'Whisper Gift',
        flavor: 'A card in your hand shimmers and twists.',
        icon: '✨',
        color: '#fbbf24',
        weight: 10,
        tier: 'any',
        execute: (ctx) => {
            const hand = ctx.state.get('combat.hand') || [];
            const upgradeable = hand.filter(c => !c.upgraded && !c._cascadeUpgraded);
            if (upgradeable.length > 0) {
                const target = upgradeable[Math.floor(Math.random() * upgradeable.length)];
                target._cascadeUpgraded = true;
                target._originalName = target.name;
                // Temporary combat-only upgrade: +40% to primary stat
                if (target.damage) target.damage = Math.floor(target.damage * 1.4);
                if (target.block) target.block = Math.floor(target.block * 1.4);
                // Update effects array too
                if (target.effects) {
                    target.effects.forEach(e => {
                        if (e.type === 'damage' && typeof e.value === 'number') e.value = Math.floor(e.value * 1.4);
                        if (e.type === 'block' && typeof e.value === 'number') e.value = Math.floor(e.value * 1.4);
                    });
                }
                target.name = target.name + '†';
                return { description: `${target._originalName} is temporarily enhanced!`, value: target.name };
            }
            return { description: 'The whisper finds nothing to grasp.', value: 0 };
        }
    },
    {
        id: 'unstable_flux',
        name: 'Unstable Flux',
        flavor: 'Enemy resolve wavers between realities.',
        icon: '💫',
        color: '#f472b6',
        weight: 10,
        tier: 'any',
        execute: (ctx) => {
            const enemies = ctx.state.get('combat.enemies') || [];
            let affected = 0;
            enemies.forEach(enemy => {
                if (enemy.currentHp > 0 && enemy.intent) {
                    if (enemy.intent.type === 'attack' && enemy.intent.damage > 0) {
                        const reduction = Math.max(1, Math.floor(enemy.intent.damage * 0.3));
                        enemy.intent.damage = Math.max(0, enemy.intent.damage - reduction);
                        affected++;
                    }
                }
            });
            ctx.state.set('combat.enemies', enemies);
            return { description: `${affected} enemies had their intent weakened`, value: affected };
        }
    },
    {
        id: 'corruption_echo',
        name: 'Corruption Echo',
        flavor: 'The last sound repeats. Again. AGAIN.',
        icon: '🔁',
        color: '#c084fc',
        weight: 8,
        tier: 'mid',
        execute: (ctx) => {
            // Gain 1 energy
            const energy = ctx.state.get('combat.energy') || 0;
            ctx.state.set('combat.energy', energy + 1);
            return { description: 'Gain 1 Energy from the echo.', value: 1 };
        }
    },
    {
        id: 'void_armor',
        name: 'Void Carapace',
        flavor: 'Darkness hardens around your skin.',
        icon: '🛡️',
        color: '#6366f1',
        weight: 10,
        tier: 'any',
        execute: (ctx) => {
            const amount = 4 + Math.floor(ctx.corruption / 20);
            const block = ctx.state.get('combat.block') || 0;
            ctx.state.set('combat.block', block + amount);
            return { description: `Gain ${amount} Block`, value: amount };
        }
    },

    // ── Harmful cascades (the void takes its toll) ──
    {
        id: 'void_tax',
        name: 'Void Tax',
        flavor: 'The void collects what is owed.',
        icon: '💀',
        color: '#ef4444',
        weight: 12,
        tier: 'any',
        execute: (ctx) => {
            const damage = 2 + Math.floor(ctx.corruption / 30);
            const hp = ctx.state.get('hero.hp') || 50;
            const newHp = Math.max(1, hp - damage);
            ctx.state.set('hero.hp', newHp);
            ctx.state.set('hero.hp', newHp);
            return { description: `Lose ${damage} HP`, value: -damage };
        }
    },
    {
        id: 'corrupted_draw',
        name: 'Tainted Draw',
        flavor: 'Something wrong slides into your hand.',
        icon: '🃏',
        color: '#991b1b',
        weight: 8,
        tier: 'mid',
        execute: (ctx) => {
            // Add a temporary curse-like card to hand
            const hand = ctx.state.get('combat.hand') || [];
            if (hand.length < 10) {
                hand.push({
                    id: 'void_fragment',
                    instanceId: `void_fragment_${Date.now()}`,
                    name: 'Void Fragment',
                    type: 'curse',
                    cost: 0,
                    rarity: 'curse',
                    description: 'Unplayable. Discard at end of turn.',
                    effects: [],
                    unplayable: true,
                    exhaust: true,
                    _cascade: true
                });
                ctx.state.set('combat.hand', hand);
            }
            return { description: 'A Void Fragment appears in your hand.', value: -1 };
        }
    },
    {
        id: 'reality_fracture',
        name: 'Reality Fracture',
        flavor: 'The world cracks. Something leaks through.',
        icon: '🔮',
        color: '#7c3aed',
        weight: 6,
        tier: 'high',
        execute: (ctx) => {
            // A random card in hand costs +1 this turn
            const hand = ctx.state.get('combat.hand') || [];
            const playable = hand.filter(c => c.cost >= 0 && !c.unplayable);
            if (playable.length > 0) {
                const target = playable[Math.floor(Math.random() * playable.length)];
                target._originalCost = target._originalCost ?? target.cost;
                target.cost += 1;
                return { description: `${target.name} costs +1 this turn`, value: target.name };
            }
            return { description: 'Reality bends but holds.', value: 0 };
        }
    },
    {
        id: 'whisper_drain',
        name: 'Whisper Drain',
        flavor: 'Your strength leaks into the dark between stars.',
        icon: '😵',
        color: '#dc2626',
        weight: 6,
        tier: 'high',
        execute: (ctx) => {
            // Lose 1 energy
            const energy = ctx.state.get('combat.energy') || 0;
            if (energy > 0) {
                ctx.state.set('combat.energy', energy - 1);
                return { description: 'Lose 1 Energy', value: -1 };
            }
            return { description: 'The whisper finds nothing to drain.', value: 0 };
        }
    },

    // ── Chaotic cascades (unpredictable) ──
    {
        id: 'entropy_wave',
        name: 'Entropy Wave',
        flavor: 'Order collapses. Everything shuffles.',
        icon: '🌊',
        color: '#06b6d4',
        weight: 5,
        tier: 'high',
        execute: (ctx) => {
            // Shuffle hand into draw pile, draw same number
            const hand = ctx.state.get('combat.hand') || [];
            const drawPile = ctx.state.get('combat.drawPile') || [];
            const handSize = hand.length;
            drawPile.push(...hand);
            const shuffled = drawPile.sort(() => Math.random() - 0.5);
            const newHand = shuffled.splice(0, Math.min(handSize, shuffled.length));
            ctx.state.set('combat.hand', newHand);
            ctx.state.set('combat.drawPile', shuffled);
            return { description: `Hand reshuffled. Drew ${newHand.length} new cards.`, value: newHand.length };
        }
    },
    {
        id: 'void_mirror',
        name: 'Void Mirror',
        flavor: 'Your reflection attacks alongside you.',
        icon: '🪞',
        color: '#8b5cf6',
        weight: 4,
        tier: 'high',
        execute: (ctx) => {
            // Deal damage equal to current block to a random enemy
            const block = ctx.state.get('combat.block') || 0;
            if (block > 0) {
                const enemies = ctx.state.get('combat.enemies') || [];
                const alive = enemies.filter(e => e.currentHp > 0);
                if (alive.length > 0) {
                    const target = alive[Math.floor(Math.random() * alive.length)];
                    target.currentHp -= block;
                    ctx.state.set('combat.enemies', enemies);
                    return { description: `Mirror deals ${block} damage to ${target.name}!`, value: block };
                }
            }
            return { description: 'The mirror reflects only emptiness.', value: 0 };
        }
    }
];

// ═══════════════════════════════════════════
// TIER THRESHOLDS
// Which events are available at which corruption levels
// ═══════════════════════════════════════════
const TIER_THRESHOLDS = {
    any: 0,    // Available at any corruption
    mid: 30,   // Available at 30+ corruption
    high: 60   // Available at 60+ corruption
};

class CorruptionCascade {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.cascadeHistory = []; // Track recent cascades for variety
        this.cascadeCount = 0;
        
        console.log('[CorruptionCascade] System initialized');
    }

    /**
     * Check if corruption crossed a threshold and trigger a cascade
     * Call this whenever corruption changes.
     * 
     * @param {number} oldValue - Previous corruption value
     * @param {number} newValue - New corruption value
     * @returns {Object|null} The cascade event result, or null if no trigger
     */
    checkAndTrigger(oldValue, newValue) {
        if (newValue <= oldValue) return null; // Only trigger on GAINS
        
        // Check every multiple-of-10 boundary between old and new
        const cascades = [];
        const oldBucket = Math.floor(oldValue / 10);
        const newBucket = Math.floor(newValue / 10);
        
        for (let bucket = oldBucket + 1; bucket <= newBucket; bucket++) {
            const threshold = bucket * 10;
            console.log(`[CorruptionCascade] Corruption crossed ${threshold}!`);
            const cascade = this._rollCascade(newValue);
            if (cascade) {
                cascades.push(cascade);
            }
        }
        
        if (cascades.length === 0) return null;
        
        // If multiple thresholds crossed at once, chain them with delays
        if (cascades.length > 1) {
            this._chainCascades(cascades);
        } else {
            this._executeCascade(cascades[0], newValue);
        }
        
        return cascades[0]; // Return first for immediate use
    }

    /**
     * Roll a random cascade event based on corruption level
     */
    _rollCascade(corruption) {
        // Filter events by tier eligibility
        const eligible = CASCADE_EVENTS.filter(event => {
            const minCorruption = TIER_THRESHOLDS[event.tier] || 0;
            return corruption >= minCorruption;
        });
        
        if (eligible.length === 0) return null;
        
        // Weighted random selection — avoid repeating recent events
        const recentIds = this.cascadeHistory.slice(-3);
        const weighted = eligible.map(event => ({
            ...event,
            adjustedWeight: recentIds.includes(event.id) ? event.weight * 0.3 : event.weight
        }));
        
        const totalWeight = weighted.reduce((sum, e) => sum + e.adjustedWeight, 0);
        let roll = Math.random() * totalWeight;
        
        for (const event of weighted) {
            roll -= event.adjustedWeight;
            if (roll <= 0) return event;
        }
        
        return weighted[weighted.length - 1]; // Fallback
    }

    /**
     * Execute a single cascade event
     */
    _executeCascade(event, corruption) {
        console.log(`[CorruptionCascade] ⚡ Triggering: ${event.name} — "${event.flavor}"`);
        
        this.cascadeCount++;
        this.cascadeHistory.push(event.id);
        if (this.cascadeHistory.length > 10) this.cascadeHistory.shift();
        
        // Execute the effect
        const result = event.execute({
            state: this.state,
            eventBus: this.eventBus,
            corruption
        });
        
        // Emit event for VFX and UI
        this.eventBus.emit('cascade:triggered', {
            event: {
                id: event.id,
                name: event.name,
                flavor: event.flavor,
                icon: event.icon,
                color: event.color
            },
            result,
            cascadeNumber: this.cascadeCount,
            corruption
        });
        
        console.log(`[CorruptionCascade] Result: ${result.description}`);
        return result;
    }

    /**
     * Chain multiple cascades with staggered timing
     */
    _chainCascades(cascades) {
        const corruption = this.state.get('corruption') || 0;
        
        cascades.forEach((cascade, i) => {
            setTimeout(() => {
                this._executeCascade(cascade, corruption);
            }, i * 1200); // 1.2s between each cascade
        });
    }

    /**
     * Force a specific cascade (for testing or scripted events)
     */
    forceCascade(eventId) {
        const event = CASCADE_EVENTS.find(e => e.id === eventId);
        if (event) {
            const corruption = this.state.get('corruption') || 0;
            return this._executeCascade(event, corruption);
        }
        console.warn(`[CorruptionCascade] Unknown event: ${eventId}`);
        return null;
    }

    /**
     * Get cascade history for run-summary display
     */
    getHistory() {
        return {
            total: this.cascadeCount,
            recent: [...this.cascadeHistory]
        };
    }

    /**
     * Reset for new combat
     */
    onCombatStart() {
        // Keep history across combats (it's a run-level system)
        // but reset per-combat tracking if needed
    }

    /**
     * Clean up cascade card modifications at end of turn
     * (Restores costs of Reality Slip cards, etc.)
     */
    onTurnEnd() {
        const hand = this.state.get('combat.hand') || [];
        hand.forEach(card => {
            if (card._cascadeFree && card._originalCost !== undefined) {
                card.cost = card._originalCost;
                delete card._cascadeFree;
                delete card._originalCost;
            }
        });
        this.state.set('combat.hand', hand);
    }
}

export default CorruptionCascade;
export { CASCADE_EVENTS };
