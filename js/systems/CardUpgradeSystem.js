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
 * @version 2.0.0 — Full coverage for all heroes + neutrals
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
        description: 'Deal 6 damage. Deal 12 instead if you took damage this turn.',
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
    vent_heat: {
        upgradedName: 'Emergency Vent',
        description: 'Lose all Overheat. Gain Block equal to 1.5× Overheat lost.',
        flavor: '"Better out than in. That\'s what the manual said."'
    },
    fuel_the_fire: {
        upgradedName: 'Stoke the Inferno',
        damage: 5,
        description: 'Deal 5 damage. Deal +2 damage for each Overheat.',
        flavor: '"Every degree feeds the beast inside."'
    },
    reckless_swing: {
        upgradedName: 'Suicidal Swing',
        damage: 14,
        description: 'Deal 14 damage. Take 3 damage.',
        flavor: '"Who needs a body when you have momentum?"'
    },
    heavy_plating: {
        upgradedName: 'Ablative Plating',
        block: 18,
        description: 'Gain 18 Block.',
        flavor: '"It won\'t last. Nothing does. But it\'ll last long enough."'
    },
    enrage: {
        upgradedName: 'Blood Frenzy',
        description: 'Gain 3 Rage.',
        flavor: '"Rage isn\'t an emotion. It\'s an operating system."'
    },
    pummel: {
        upgradedName: 'Obliterate',
        damage: 3,
        description: 'Deal 3 damage 4 times.',
        flavor: '"One hit for each regret. He has many."'
    },
    intimidate: {
        upgradedName: 'Terrorize',
        description: 'Apply 2 Weak to ALL enemies.',
        flavor: '"They looked at his face. They looked away."'
    },
    crush: {
        upgradedName: 'Devastate',
        damage: 18,
        description: 'Deal 18 damage. Apply 2 Vulnerable.',
        flavor: '"The sound alone broke their resolve."'
    },
    body_slam: {
        upgradedName: 'Full Collision',
        description: 'Deal damage equal to your current Block. Gain 5 Block first.',
        flavor: '"Physics doesn\'t negotiate."'
    },
    cleave: {
        upgradedName: 'Whirlwind Cleave',
        damage: 11,
        description: 'Deal 11 damage to ALL enemies.',
        flavor: '"One arc. Every target. No exceptions."'
    },
    reactor_breach: {
        upgradedName: 'Core Rupture',
        damage: 11,
        description: 'Deal 11 damage to ALL enemies. Gain 2 Overheat.',
        flavor: '"Containment failure. Everyone pays."'
    },
    titan_stance: {
        upgradedName: 'Immovable Stance',
        block: 16,
        description: 'Gain 16 Block. Gain 8 Counter.',
        flavor: '"Mountains don\'t dodge. Neither does he."'
    },
    rage_protocol: {
        upgradedName: 'Berserker Protocol',
        description: 'Whenever you take damage, gain 2 Rage.',
        flavor: '"Protocol override. All limiters disengaged."'
    },
    armor_plating: {
        upgradedName: 'Titan Plating',
        description: 'Gain 5 Block at the start of each turn.',
        flavor: '"Salvaged from something bigger. Something that fell."'
    },
    bloodlust: {
        upgradedName: 'Crimson Hunger',
        damage: 10,
        description: 'Deal 10 damage. If enemy dies, gain 3 Rage.',
        flavor: '"The kill isn\'t the end. It\'s the appetizer."'
    },
    heat_sink: {
        upgradedName: 'Thermal Dump',
        description: 'Reduce Overheat by 5. Gain 1 Energy.',
        flavor: '"Five seconds of clarity between the fires."'
    },
    provoke: {
        upgradedName: 'Death Wish',
        description: 'Apply 3 Vulnerable. Gain 3 Rage.',
        flavor: '"Come closer. I dare you."'
    },
    immolate: {
        upgradedName: 'Firestorm',
        damage: 14,
        description: 'Deal 14 damage to ALL. Apply 3 Burn to ALL.',
        flavor: '"Everything burns the same. Eventually."'
    },
    battle_trance: {
        upgradedName: 'War Meditation',
        description: 'Draw 4 cards. Cannot draw more this turn.',
        flavor: '"In the silence between blows, clarity."'
    },
    seeing_red: {
        upgradedName: 'Crimson Vision',
        description: 'Gain 3 Energy. Exhaust.',
        flavor: '"The world turned red. He turned lethal."'
    },
    shockwave: {
        upgradedName: 'Seismic Blast',
        description: 'Apply 3 Weak and 3 Vulnerable to ALL. Exhaust.',
        flavor: '"The ground remembered that impact for years."'
    },
    unstoppable: {
        upgradedName: 'Impenetrable',
        description: 'Gain 3 Armor (permanent damage reduction).',
        flavor: '"They kept hitting. He stopped noticing."'
    },
    rupture: {
        upgradedName: 'Internal Bleed',
        description: 'Whenever you lose HP from a card, gain 2 Strength.',
        flavor: '"Every wound makes the machine angrier."'
    },
    metallicize: {
        upgradedName: 'Living Steel',
        description: 'At the end of your turn, gain 4 Block.',
        flavor: '"The metal grows. Korvax pretends not to notice."'
    },
    combust: {
        upgradedName: 'Spontaneous Combustion',
        description: 'At end of turn, lose 1 HP and deal 7 damage to ALL enemies.',
        flavor: '"He runs hot. Everyone nearby runs hotter."'
    },
    meltdown: {
        upgradedName: 'Critical Meltdown',
        description: 'Deal damage equal to Overheat ×5 to ALL. Reset Overheat.',
        flavor: '"The warnings blared. Korvax ignored them all."'
    },
    berserk: {
        upgradedName: 'Unstoppable Fury',
        description: 'Gain 2 Energy each turn. Gain 1 Vulnerable each turn.',
        flavor: '"They called it a malfunction. He calls it liberation."'
    },
    limit_break: {
        upgradedName: 'Shatter Limits',
        description: 'Double your Strength.',
        flavor: '"There was a ceiling. He broke through it."'
    },
    brutality: {
        upgradedName: 'Savage Instinct',
        description: 'At start of turn, lose 1 HP and draw 2 cards.',
        flavor: '"Blood for knowledge. A fair trade."'
    },
    juggernaut: {
        upgradedName: 'Unstoppable Force',
        description: 'When you gain Block, deal 5 damage to random enemy.',
        flavor: '"Defense and offense are the same motion."'
    },
    demon_form: {
        upgradedName: 'Abyssal Form',
        description: 'At start of each turn, gain 3 Strength.',
        flavor: '"He stopped being Korvax. Became something worse."'
    },
    feed: {
        upgradedName: 'Devour',
        damage: 12,
        description: 'Deal 12 damage. If fatal, gain 4 Max HP. Exhaust.',
        flavor: '"He doesn\'t eat. He absorbs."'
    },
    impervious: {
        upgradedName: 'Absolute Guard',
        block: 40,
        description: 'Gain 40 Block. Exhaust.',
        flavor: '"For one moment, nothing could touch him."'
    },
    offering: {
        upgradedName: 'Blood Offering',
        description: 'Lose 6 HP. Gain 2 Energy. Draw 5 cards. Exhaust.',
        flavor: '"The old gods accept any currency. Blood is just the cheapest."'
    },
    reaper: {
        upgradedName: 'Soul Harvest',
        damage: 5,
        description: 'Deal 5 damage to ALL. Heal for unblocked damage dealt.',
        flavor: '"Every cut heals the cutter."'
    },
    barricade: {
        upgradedName: 'Eternal Barricade',
        cost: 2,
        description: 'Block is not removed at the start of your turn.',
        flavor: '"This wall doesn\'t fall. Ever."'
    },
    critical_mass: {
        upgradedName: 'Supercritical Mass',
        description: 'Deal 8 damage. If Overheat 10+, deal 40 instead. Reset Overheat.',
        flavor: '"The event horizon. No coming back."'
    },
    titans_wrath: {
        upgradedName: 'Titan\'s Apocalypse',
        damage: 25,
        description: 'Deal 25 damage +7 per Rage. Lose all Rage.',
        flavor: '"He wound up. The world held its breath."'
    }
};

// ═══════════════════════════════════════════
// LYRIA UPGRADE TABLE  
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

// ═══════════════════════════════════════════
// AUREN UPGRADE TABLE
// ═══════════════════════════════════════════
const AUREN_UPGRADES = {
    radiant_strike: {
        upgradedName: 'Blazing Judgment',
        damage: 8,
        description: 'Deal 8 damage. If you have Block, gain 2 Judgment.',
        flavor: '"Light doesn\'t ask permission to burn."'
    },
    solemn_defense: {
        upgradedName: 'Sanctified Shield',
        block: 8,
        description: 'Gain 8 Block. If you took damage last turn, gain 2 Judgment.',
        flavor: '"Suffering refines the worthy."'
    },
    aegis_pulse: {
        upgradedName: 'Radiant Aegis',
        block: 12,
        description: 'Gain 12 Block. Excess Block becomes Judgment.',
        flavor: '"The shield does not merely protect. It judges."'
    },
    searing_verdict: {
        upgradedName: 'Final Verdict',
        damage: 10,
        description: 'Deal 10 damage. Consume Judgment for +4 damage each.',
        flavor: '"The sentence is passed. The sentence is carried out."'
    },
    judicators_stance: {
        upgradedName: 'Arbiter\'s Decree',
        description: 'Whenever you gain Block, gain 2 Judgment.',
        flavor: '"Every wall built is another law enacted."'
    },
    shield_of_truth: {
        upgradedName: 'Bulwark of Verity',
        block: 14,
        description: 'Gain 14 Block. Enemies attacking you take 5 damage.',
        flavor: '"Truth hurts. Especially when you punch it."'
    },
    first_light_broken: {
        upgradedName: 'Dawn Shattered',
        description: 'Gain 3 Judgment per turn. Spending Judgment gives Corruption.',
        flavor: '"The first light broke. What came after was darker. And stronger."'
    },
    final_absolution: {
        upgradedName: 'Absolute Absolution',
        description: 'Deal damage equal to your Block + Judgment ×1.5. Lose both.',
        flavor: '"Forgiveness is a weapon. The final one."'
    },
    martyrs_resolve: {
        upgradedName: 'Saint\'s Sacrifice',
        description: 'Lose 7 HP. Gain Block equal to HP lost. Draw 3 cards.',
        flavor: '"Less blood. More resolve. Same outcome."'
    }
};

// ═══════════════════════════════════════════
// NEUTRAL/SHARED CARD UPGRADE TABLE
// ═══════════════════════════════════════════
const NEUTRAL_UPGRADES = {
    void_siphon: {
        upgradedName: 'Void Drain',
        damage: 7,
        description: 'Deal 7 damage. Gain 1 Corruption.',
        flavor: '"The void takes a little more each time."'
    },
    desperate_strike: {
        upgradedName: 'Reckless Blow',
        damage: 7,
        description: 'Deal 7 damage. Take 2 damage.',
        flavor: '"Desperation sharpens the blade."'
    },
    scrap_shield: {
        upgradedName: 'Salvaged Barrier',
        block: 10,
        description: 'Gain 10 Block. Exhaust.',
        flavor: '"Held together by willpower and rust."'
    },
    quick_patch: {
        upgradedName: 'Field Surgery',
        description: 'Heal 7 HP. Exhaust.',
        flavor: '"Not pretty. But you\'ll live."'
    },
    improvised_weapon: {
        upgradedName: 'Makeshift Arsenal',
        damage: 5,
        description: 'Deal 5 damage. Draw 1 card.',
        flavor: '"Anything is a weapon if you\'re angry enough."'
    },
    bandage: {
        upgradedName: 'Med Kit',
        description: 'Heal 4 HP.',
        flavor: '"Standard issue. Surprisingly effective."'
    },
    trip: {
        upgradedName: 'Sweep the Legs',
        description: 'Apply 3 Vulnerable.',
        flavor: '"They never see it coming. That\'s the point."'
    },
    flash_bang: {
        upgradedName: 'Blinding Flash',
        description: 'Apply 2 Weak to ALL enemies. Draw 1 card.',
        flavor: '"Close your eyes. Too late."'
    },
    throwing_knife: {
        upgradedName: 'Precision Throw',
        damage: 7,
        description: 'Deal 7 damage.',
        flavor: '"Right between the plates."'
    },
    finesse: {
        upgradedName: 'Elegant Dodge',
        block: 4,
        description: 'Gain 4 Block. Draw 1 card.',
        flavor: '"Grace under fire is still grace."'
    },
    adrenaline: {
        upgradedName: 'Adrenaline Rush',
        description: 'Gain 2 Energy. Draw 2 cards. Exhaust.',
        flavor: '"Time slows. Everything becomes clear."'
    },
    void_blade: {
        upgradedName: 'Abyssal Edge',
        damage: 18,
        description: 'Deal 18 damage. Gain 3 Corruption.',
        flavor: '"The blade doesn\'t cut. It unmakes."'
    },
    corruption_pulse: {
        upgradedName: 'Void Detonation',
        description: 'Deal damage equal to your Corruption level ×1.5.',
        flavor: '"All that darkness, weaponized."'
    },
    second_wind: {
        upgradedName: 'Last Stand',
        description: 'Gain Block equal to your missing HP. Draw 1 card.',
        flavor: '"The closer to death, the harder to kill."'
    },
    calculated_gamble: {
        upgradedName: 'All In',
        description: 'Discard your hand. Draw that many +1 cards.',
        flavor: '"Fortune favors the desperate."'
    },
    panacea: {
        upgradedName: 'Universal Cure',
        description: 'Gain 2 Artifact. Exhaust.',
        flavor: '"Immunity is the ultimate luxury."'
    },
    piercing_wail: {
        upgradedName: 'Banshee\'s Cry',
        description: 'ALL enemies lose 8 Strength this turn. Exhaust.',
        flavor: '"The sound that makes gods cover their ears."'
    },
    concentrate: {
        upgradedName: 'Deep Focus',
        description: 'Gain 2 Energy. Discard 1 card.',
        flavor: '"Less noise. More power."'
    },
    neutralize: {
        upgradedName: 'Subdue',
        damage: 4,
        description: 'Deal 4 damage. Apply 2 Weak.',
        flavor: '"Not dead. Just... manageable."'
    },
    sucker_punch: {
        upgradedName: 'Cheap Shot',
        damage: 10,
        description: 'Deal 10 damage. Apply 1 Weak.',
        flavor: '"Honor is for people who can afford it."'
    },
    leg_sweep: {
        upgradedName: 'Grand Sweep',
        block: 14,
        description: 'Apply 3 Weak. Gain 14 Block.',
        flavor: '"Down goes the enemy. Up goes the wall."'
    },
    terror: {
        upgradedName: 'Existential Dread',
        cost: 0,
        description: 'Apply 99 Vulnerable. Exhaust.',
        flavor: '"They didn\'t run. They forgot how."'
    },
    setup: {
        upgradedName: 'Master Plan',
        description: 'Put a card from hand on top of draw pile. Draw 1 card.',
        flavor: '"Three moves ahead. Always."'
    },
    dark_pact: {
        upgradedName: 'Infernal Contract',
        description: 'Gain 3 Energy each turn. Gain 5 Corruption per combat.',
        flavor: '"The terms are non-negotiable."'
    },
    ancient_knowledge: {
        upgradedName: 'Forbidden Wisdom',
        description: 'Draw 2 additional cards each turn.',
        flavor: '"Knowledge was never meant to be this accessible."'
    },
    apotheosis: {
        upgradedName: 'Transcendence',
        cost: 1,
        description: 'Upgrade ALL cards for the rest of combat. Exhaust.',
        flavor: '"For one fight, everything is perfect."'
    },
    hand_of_greed: {
        upgradedName: 'Midas Touch',
        damage: 25,
        description: 'Deal 25 damage. If fatal, gain 30 Credits.',
        flavor: '"Everything he touches turns to profit."'
    },
    master_of_strategy: {
        upgradedName: 'Grand Strategist',
        description: 'Draw 4 cards. Exhaust.',
        flavor: '"See the whole board. Move accordingly."'
    },
    violence: {
        upgradedName: 'Extreme Violence',
        description: 'Put 4 random Attack cards from draw pile into hand. Exhaust.',
        flavor: '"Diplomacy has failed. Good."'
    },
    panache: {
        upgradedName: 'Virtuoso',
        description: 'Every 5 cards played, deal 14 damage to ALL enemies.',
        flavor: '"Style points are damage points."'
    },
    sadistic_nature: {
        upgradedName: 'Cruel Nature',
        description: 'Whenever you apply a debuff, deal 7 damage.',
        flavor: '"Suffering is an art. She\'s a master."'
    },
    void_embrace: {
        upgradedName: 'Void Symbiosis',
        description: 'Gain +2 damage for every 10 Corruption.',
        flavor: '"The darkness doesn\'t weigh her down. It lifts her up."'
    },
    corruption_manifest: {
        upgradedName: 'Corruption Incarnate',
        damage: 12,
        description: 'Deal 12 damage. Apply Poison equal to your Corruption / 8.',
        flavor: '"The corruption found a shape. Her shape."'
    },
    echo_form: {
        upgradedName: 'Resonance Form',
        cost: 2,
        description: 'Ethereal. The first card you play each turn is played twice.',
        flavor: '"Two of her. Two of everything."'
    },
    void_conduit: {
        upgradedName: 'Void Cataclysm',
        damage: 40,
        description: 'Deal 40 damage to ALL. Gain 10 Corruption.',
        flavor: '"She opened the gate. Everything poured through."'
    }
};

// Merge all hero upgrades
const ALL_UPGRADES = {
    ...KORVAX_UPGRADES,
    ...LYRIA_UPGRADES,
    ...AUREN_UPGRADES,
    ...NEUTRAL_UPGRADES
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
                    if ((eff.type === 'block' || eff.type === 'block_gain') && upgradeInfo.block !== undefined) eff.value = upgradeInfo.block;
                    if (eff.type === 'draw' && upgradeInfo.draw !== undefined) eff.value = upgradeInfo.draw;
                    // Update status effect values too
                    if (eff.type === 'status' && eff.target === 'self') {
                        if (eff.status === 'overheat' && upgradeInfo.overheatGain !== undefined) eff.value = upgradeInfo.overheatGain;
                        if (eff.status === 'rage' && upgradeInfo.rageGain !== undefined) eff.value = upgradeInfo.rageGain;
                    }
                    // Update conditional damage
                    if (eff.conditional && upgradeInfo.conditionalDamage !== undefined) {
                        eff.conditional.value = upgradeInfo.conditionalDamage;
                    }
                    // Update scaling
                    if (eff.scaling && upgradeInfo.scalingMultiplier !== undefined) {
                        eff.scaling.multiplier = upgradeInfo.scalingMultiplier;
                    }
                });
            }
        } else {
            // ── Smart generic fallback ──
            card.originalName = card.name;
            card.name = card.name + '+';
            card.upgraded = true;
            card.upgradedFromId = card.id;

            // Scale primary stats by 30-40%
            const scale = 1.35;
            if (typeof card.damage === 'number' && card.damage > 0) card.damage = Math.ceil(card.damage * scale);
            if (typeof card.block === 'number' && card.block > 0) card.block = Math.ceil(card.block * scale);
            if (card.draw && card.draw > 0 && card.draw < 5) card.draw = card.draw + 1;
            
            // 40% chance to reduce cost on expensive cards
            if (card.cost > 1 && Math.random() < 0.4) card.cost = Math.max(0, card.cost - 1);
            
            // Boost heal values
            if (card.heal && card.heal > 0) card.heal = Math.ceil(card.heal * scale);

            // Update effects array too
            if (card.effects) {
                card.effects.forEach(eff => {
                    if (eff.type === 'damage' && typeof eff.value === 'number') eff.value = Math.ceil(eff.value * scale);
                    if ((eff.type === 'block' || eff.type === 'block_gain') && typeof eff.value === 'number') eff.value = Math.ceil(eff.value * scale);
                    if (eff.type === 'heal' && typeof eff.value === 'number') eff.value = Math.ceil(eff.value * scale);
                    if (eff.type === 'draw' && typeof eff.value === 'number' && eff.value < 5) eff.value += 1;
                    // Boost status values slightly
                    if (eff.type === 'status' && typeof eff.value === 'number' && eff.value > 0 && eff.value < 10) {
                        eff.value = Math.ceil(eff.value * 1.25);
                    }
                });
            }

            // Update description to show it's enhanced
            if (card.description) {
                card.description = card.description.replace(/\d+/g, (match) => {
                    const num = parseInt(match);
                    // Only scale numbers that look like game values (2-99)
                    if (num >= 2 && num < 100) return Math.ceil(num * scale);
                    return match;
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
        const scale = 1.35;
        return {
            name: card.name + '+',
            description: card.description + ' (Enhanced)',
            flavor: this._genericFlavor(card.type),
            statChanges: [
                ...(typeof card.damage === 'number' && card.damage > 0 ? [{ stat: 'damage', from: card.damage, to: Math.ceil(card.damage * scale) }] : []),
                ...(typeof card.block === 'number' && card.block > 0 ? [{ stat: 'block', from: card.block, to: Math.ceil(card.block * scale) }] : [])
            ]
        };
    }

    _genericFlavor(type) {
        const flavors = {
            attack: [
                '"Sharper now. Hungrier."',
                '"The edge finds its own targets."',
                '"Refined by necessity. Perfected by desperation."',
                '"Every swing teaches the next one."',
                '"Blood remembers the motion."'
            ],
            skill: [
                '"Instinct replaces thought."',
                '"The body remembers what the mind forgets."',
                '"Efficiency born from repetition."',
                '"Faster now. Muscle memory."',
                '"A trick perfected through pain."'
            ],
            power: [
                '"Something fundamental shifted inside."',
                '"The change is permanent. So are the consequences."',
                '"Power doesn\'t grow. It mutates."',
                '"The engine runs hotter now."',
                '"An upgrade to the soul."'
            ]
        };
        const pool = flavors[type] || flavors.attack;
        return pool[Math.floor(Math.random() * pool.length)];
    }
}

export default CardUpgradeSystem;
