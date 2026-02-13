/**
 * CardUpgradeSystem - Transforms cards on upgrade with personality
 * Instead of just +25% stats, upgrades give new names, descriptions, and flavor text.
 * 
 * Usage:
 *   import CardUpgradeSystem from '../systems/CardUpgradeSystem.js';
 *   const upgrader = new CardUpgradeSystem();
 *   upgrader.upgradeCard(card); // mutates card in place
 * 
 * Integration:
 *   Replace the simple upgrade logic in RestScreen.js and DeckManager.js
 *   with calls to upgrader.upgradeCard(card).
 * 
 * @version 1.0.0
 */

// ═══════════════════════════════════════════
// KORVAX UPGRADE TABLE
// ═══════════════════════════════════════════
const KORVAX_UPGRADES = {
    strike: {
        upgradedName: 'Brutal Strike',
        damage: 9,
        description: 'Deal 9 damage.',
        flavor: '"Precision is a luxury. Force is a guarantee."'
    },
    defend: {
        upgradedName: 'Fortify',
        block: 8,
        description: 'Gain 8 Block.',
        flavor: '"The armor remembers. Even when I don\'t."'
    },
    thermal_vent: {
        upgradedName: 'Superheated Vent',
        block: 6,
        description: 'Gain 6 Block. Gain 1 Overheat.',
        flavor: '"Steam pours from the cracks. Everything cracks eventually."'
    },
    rage_spike: {
        upgradedName: 'Fury Spike',
        damage: 6,
        conditionalDamage: 12,
        description: 'Deal 6 damage. If you took damage this turn, deal 12 instead.',
        flavor: '"Pain is just the body keeping score."'
    },
    system_check: {
        upgradedName: 'Deep Scan',
        draw: 2,
        description: 'Draw 2 cards. Exhaust.',
        flavor: '"Diagnostics came back red. All of them."'
    },
    thermal_spike: {
        upgradedName: 'Plasma Spike',
        damage: 12,
        description: 'Deal 12 damage. Gain 2 Overheat.',
        flavor: '"The temperature warning stopped working three fights ago."'
    },
    rage_protocol: {
        upgradedName: 'Berserker Protocol',
        description: 'Whenever you take damage, gain 2 Rage.',
        flavor: '"Protocol override. All limiters disengaged."'
    },
    meltdown: {
        upgradedName: 'Critical Meltdown',
        description: 'Deal damage equal to your current Overheat ×4. Reset Overheat to 0.',
        flavor: '"The warnings blared. Korvax ignored them all."'
    },
    titan_stance: {
        upgradedName: 'Immovable Stance',
        block: 16,
        description: 'Gain 16 Block. Next turn, counter for 9 damage when hit.',
        flavor: '"Mountains don\'t dodge. Neither does he."'
    },
    iron_will: {
        upgradedName: 'Ironclad Will',
        block: 12,
        description: 'Gain 12 Block.',
        flavor: '"Will alone holds the plates together."'
    },
    overcharge: {
        upgradedName: 'Reactor Overload',
        damage: 16,
        description: 'Deal 16 damage. Gain 3 Overheat.',
        flavor: '"Past the red line. Past the breaking point. Keep going."'
    },
    reactor_breach: {
        upgradedName: 'Core Rupture',
        damage: 9,
        description: 'Deal 9 damage to ALL enemies. Gain 2 Overheat.',
        flavor: '"Containment failure. Everyone pays."'
    },
    vent_heat: {
        upgradedName: 'Emergency Vent',
        description: 'Lose all Overheat. Gain Block equal to Overheat lost ×1.5.',
        flavor: '"Better out than in. That\'s what the manual said."'
    },
    berserk: {
        upgradedName: 'Unstoppable Fury',
        description: 'Gain 2 Energy at the start of each turn. Take 2 damage at the end of each turn.',
        flavor: '"They called it a malfunction. He calls it liberation."'
    },
    armor_plating: {
        upgradedName: 'Titan Plating',
        description: 'Gain 5 Block at the start of each turn.',
        flavor: '"Salvaged from something bigger. Something that fell."'
    }
};

// ═══════════════════════════════════════════
// LYRIA UPGRADE TABLE  
// Pulled from upgradeData in lyria_cards.json
// ═══════════════════════════════════════════
const LYRIA_UPGRADES = {
    lyria_strike: {
        upgradedName: 'Shattered Fracture',
        damage: 8,
        description: 'Deal 8 damage.',
        flavor: '"The cracks spread further each time."'
    },
    lyria_defend: {
        upgradedName: 'Perfect Foresight',
        block: 8,
        description: 'Gain 8 Block.',
        flavor: '"She saw the blow three seconds before it landed."'
    },
    temporal_slip: {
        upgradedName: 'Temporal Rift',
        draw: 3,
        description: 'Draw 3 cards. Discard 1. Gain 1 Temporal Flux.',
        flavor: '"Time didn\'t slip — it tore."'
    },
    astral_lance: {
        upgradedName: 'Astral Impaler',
        damage: 9,
        description: 'Deal 9 damage + Astral Charge. Gain 2 Astral Charge.',
        flavor: '"It was not a weapon. It was a goodbye."'
    },
    chronofracture: {
        upgradedName: 'Broken Chronology',
        cost: 2,
        description: 'At the end of your turn, gain 1 extra Energy next turn.',
        flavor: '"Time doesn\'t flow here. It pools."'
    },
    void_glimpse: {
        upgradedName: 'Void Stare',
        draw: 4,
        description: 'Draw 4 cards. Gain 1 Corruption.',
        flavor: '"She looked into the void. The void looked back and smiled."'
    },
    temporal_recursion: {
        upgradedName: 'Infinite Loop',
        cost: 2,
        description: 'At the end of your turn, return a random card from discard to hand. It costs 0.',
        flavor: '"She had seen this moment before. Many times."'
    },
    astral_surge: {
        upgradedName: 'Cosmic Surge',
        damage: 6,
        description: 'Deal 6 damage. Gain 3 Astral Charge.',
        flavor: '"The stars don\'t shine. They scream."'
    },
    starfire: {
        upgradedName: 'Supernova',
        damage: 5,
        description: 'Deal 5 damage to ALL enemies. Gain 2 Astral Charge per enemy hit.',
        flavor: '"Every sun dies. She just accelerates the process."'
    },
    time_dilation: {
        upgradedName: 'Temporal Cocoon',
        block: 9,
        description: 'Gain 9 Block. Draw 1 card.',
        flavor: '"A second stretched into an hour of safety."'
    },
    memory_leak: {
        upgradedName: 'Cascade Failure',
        damage: 10,
        description: 'Deal 10 damage. If this is the 2nd+ card played this turn, draw 1.',
        flavor: '"The memories aren\'t hers. Not anymore."'
    },
    reality_anchor: {
        upgradedName: 'Anchor of the Real',
        block: 11,
        description: 'Gain 11 Block. Reduce Corruption by 2.',
        flavor: '"Something to hold onto when the world dissolves."'
    },
    future_echo: {
        upgradedName: 'Prophecy Fragment',
        draw: 2,
        description: 'Draw 2 cards. They cost 1 less this turn. Exhaust.',
        flavor: '"Tomorrow\'s weapons, wielded today."'
    },
    void_communion: {
        upgradedName: 'Pact of Unmaking',
        description: 'Whenever you gain Corruption, gain 3 Astral Charge. Gain 2 Corruption.',
        flavor: '"The price was steep. She paid it twice."'
    },
    astral_nova: {
        upgradedName: 'Cosmic Annihilation',
        damage: 8,
        cost: 2,
        description: 'Deal 8 damage. Consume ALL Astral Charge: deal that much additional damage.',
        flavor: '"When enough starlight converges, even gods flinch."'
    },
    voidguard: {
        upgradedName: 'Abyssal Barrier',
        block: 7,
        description: 'Gain 7 Block. Gain 1 Corruption. Draw 2 cards.',
        flavor: '"Protection from something worse than enemies."'
    }
};

// Merge all hero upgrades
const ALL_UPGRADES = {
    ...KORVAX_UPGRADES,
    ...LYRIA_UPGRADES
};

class CardUpgradeSystem {
    constructor() {
        this.upgradeTable = ALL_UPGRADES;
    }

    /**
     * Upgrade a card in-place with personality
     * @param {Object} card - Card object to upgrade (mutated)
     * @returns {Object} The upgraded card (same ref)
     */
    upgradeCard(card) {
        if (!card || card.upgraded) return card;

        const upgradeInfo = this.upgradeTable[card.id];

        if (upgradeInfo) {
            // ── Named upgrade path ──
            card.originalName = card.name;
            card.name = upgradeInfo.upgradedName;
            card.description = upgradeInfo.description || card.description;
            card.flavor = upgradeInfo.flavor || '';
            card.upgraded = true;
            card.upgradedFromId = card.id;

            // Apply stat overrides
            if (upgradeInfo.damage !== undefined) card.damage = upgradeInfo.damage;
            if (upgradeInfo.block !== undefined) card.block = upgradeInfo.block;
            if (upgradeInfo.cost !== undefined) card.cost = upgradeInfo.cost;
            if (upgradeInfo.draw !== undefined) card.draw = upgradeInfo.draw;
            if (upgradeInfo.conditionalDamage !== undefined) card.conditionalDamage = upgradeInfo.conditionalDamage;

            // Update effects array if present
            if (card.effects) {
                card.effects.forEach(eff => {
                    if (eff.type === 'damage' && upgradeInfo.damage !== undefined) eff.value = upgradeInfo.damage;
                    if (eff.type === 'block' && upgradeInfo.block !== undefined) eff.value = upgradeInfo.block;
                    if (eff.type === 'draw' && upgradeInfo.draw !== undefined) eff.value = upgradeInfo.draw;
                });
            }
        } else {
            // ── Generic fallback — still better than raw +25% ──
            card.originalName = card.name;
            card.name = card.name + '+';
            card.upgraded = true;
            card.upgradedFromId = card.id;

            if (card.damage) card.damage = Math.floor(card.damage * 1.4);
            if (card.block) card.block = Math.floor(card.block * 1.4);
            if (card.cost > 1 && Math.random() < 0.3) card.cost = Math.max(0, card.cost - 1);

            if (card.effects) {
                card.effects.forEach(eff => {
                    if (eff.type === 'damage' && typeof eff.value === 'number') eff.value = Math.floor(eff.value * 1.4);
                    if (eff.type === 'block' && typeof eff.value === 'number') eff.value = Math.floor(eff.value * 1.4);
                });
            }

            card.flavor = this._genericFlavor(card.type);
        }

        console.log(`[CardUpgrade] ${card.originalName} → ${card.name}`);
        return card;
    }

    /**
     * Preview what an upgrade would look like (non-destructive)
     * @param {Object} card - Card to preview
     * @returns {Object} Preview data { name, description, flavor, statChanges }
     */
    previewUpgrade(card) {
        if (!card || card.upgraded) return null;

        const upgradeInfo = this.upgradeTable[card.id];
        if (upgradeInfo) {
            const statChanges = [];
            if (upgradeInfo.damage !== undefined && card.damage) {
                statChanges.push({ stat: 'damage', from: card.damage, to: upgradeInfo.damage });
            }
            if (upgradeInfo.block !== undefined && card.block) {
                statChanges.push({ stat: 'block', from: card.block, to: upgradeInfo.block });
            }
            if (upgradeInfo.cost !== undefined && card.cost !== upgradeInfo.cost) {
                statChanges.push({ stat: 'cost', from: card.cost, to: upgradeInfo.cost });
            }
            if (upgradeInfo.draw !== undefined && card.draw) {
                statChanges.push({ stat: 'draw', from: card.draw, to: upgradeInfo.draw });
            }

            return {
                name: upgradeInfo.upgradedName,
                description: upgradeInfo.description,
                flavor: upgradeInfo.flavor,
                statChanges
            };
        }

        // Generic fallback preview
        return {
            name: card.name + '+',
            description: card.description + ' (Enhanced)',
            flavor: this._genericFlavor(card.type),
            statChanges: [
                ...(card.damage ? [{ stat: 'damage', from: card.damage, to: Math.floor(card.damage * 1.4) }] : []),
                ...(card.block ? [{ stat: 'block', from: card.block, to: Math.floor(card.block * 1.4) }] : [])
            ]
        };
    }

    _genericFlavor(type) {
        const flavors = {
            attack: [
                '"Sharper now. Hungrier."',
                '"The edge finds its own targets."',
                '"Refined by necessity. Perfected by desperation."'
            ],
            skill: [
                '"Instinct replaces thought."',
                '"The body remembers what the mind forgets."',
                '"Efficiency born from repetition."'
            ],
            power: [
                '"Something fundamental shifted inside."',
                '"The change is permanent. So are the consequences."',
                '"Power doesn\'t grow. It mutates."'
            ]
        };
        const pool = flavors[type] || flavors.attack;
        return pool[Math.floor(Math.random() * pool.length)];
    }
}

export default CardUpgradeSystem;
