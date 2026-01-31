/**
 * GameConfig - Centralized game configuration constants
 * Rarity definitions, pricing, drop rates, and balance values
 */

export const RARITY = {
    STARTER: 'starter',
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    LEGENDARY: 'legendary',
    CORRUPTED: 'corrupted'
};

export const RARITY_ORDER = [
    RARITY.STARTER,
    RARITY.COMMON,
    RARITY.UNCOMMON,
    RARITY.RARE,
    RARITY.LEGENDARY,
    RARITY.CORRUPTED
];

/**
 * Card Pricing by Rarity (in credits)
 */
export const CARD_PRICES = {
    [RARITY.COMMON]: 50,
    [RARITY.UNCOMMON]: 75,
    [RARITY.RARE]: 150,
    [RARITY.LEGENDARY]: 300,
    [RARITY.CORRUPTED]: 0  // Cannot be purchased, only acquired
};

/**
 * Artifact Pricing by Rarity
 */
export const ARTIFACT_PRICES = {
    common: 150,
    rare: 250,
    mythic: 400,
    legendary: 500
};

/**
 * Card Removal Pricing
 */
export const CARD_REMOVAL = {
    baseCost: 75,
    costIncreasePerRemoval: 25,
    maxCost: 250
};

/**
 * Rarity Drop Weights by Encounter Type
 * Higher numbers = more likely to appear
 */
export const RARITY_WEIGHTS = {
    combat: {
        [RARITY.COMMON]: 70,
        [RARITY.UNCOMMON]: 25,
        [RARITY.RARE]: 5,
        [RARITY.LEGENDARY]: 0  // Cannot drop from normal combat
    },
    elite: {
        [RARITY.COMMON]: 40,
        [RARITY.UNCOMMON]: 45,
        [RARITY.RARE]: 14,
        [RARITY.LEGENDARY]: 1  // 1% chance from elites
    },
    boss: {
        [RARITY.COMMON]: 20,
        [RARITY.UNCOMMON]: 45,
        [RARITY.RARE]: 30,
        [RARITY.LEGENDARY]: 5  // 5% chance from bosses
    },
    event: {
        [RARITY.COMMON]: 50,
        [RARITY.UNCOMMON]: 35,
        [RARITY.RARE]: 14,
        [RARITY.LEGENDARY]: 1
    },
    shop: {
        [RARITY.COMMON]: 50,
        [RARITY.UNCOMMON]: 35,
        [RARITY.RARE]: 13,
        [RARITY.LEGENDARY]: 2  // Small chance for legendary in shop
    }
};

/**
 * Corrupted Card Appearance Thresholds
 */
export const CORRUPTION_THRESHOLDS = {
    visualEffects: 25,
    corruptedCardsInRewards: 50,
    realityFractures: 75,
    transformation: 100
};

/**
 * Deck Limits
 */
export const DECK_LIMITS = {
    maxLegendaryCards: 3,  // Maximum legendary cards in deck
    maxCorruptedCards: 5,  // Maximum corrupted cards in deck
    minDeckSize: 5,
    maxDeckSize: 50
};

/**
 * Combat Rewards Configuration
 */
export const COMBAT_REWARDS = {
    combat: {
        credits: { min: 10, max: 20 },
        cardChoices: 3,
        artifactChance: 0
    },
    elite: {
        credits: { min: 25, max: 40 },
        cardChoices: 3,
        artifactChance: 1.0,
        guaranteedRarity: RARITY.UNCOMMON  // At least one uncommon
    },
    boss: {
        credits: { min: 50, max: 75 },
        cardChoices: 3,
        artifactChance: 1.0,
        rareArtifact: true,
        guaranteedRarity: RARITY.RARE  // At least one rare
    }
};

/**
 * Visual styling for rarities (CSS class suffixes)
 */
export const RARITY_COLORS = {
    [RARITY.STARTER]: '#9ca3af',   // Gray
    [RARITY.COMMON]: '#9ca3af',    // Gray
    [RARITY.UNCOMMON]: '#00f5ff',  // Cyan
    [RARITY.RARE]: '#ffd700',      // Gold
    [RARITY.LEGENDARY]: '#bf00ff', // Purple/Magenta
    [RARITY.CORRUPTED]: '#8b0000'  // Dark Red
};

/**
 * Rarity display names
 */
export const RARITY_NAMES = {
    [RARITY.STARTER]: 'Starter',
    [RARITY.COMMON]: 'Common',
    [RARITY.UNCOMMON]: 'Uncommon',
    [RARITY.RARE]: 'Rare',
    [RARITY.LEGENDARY]: 'Legendary',
    [RARITY.CORRUPTED]: 'Corrupted'
};

export default {
    RARITY,
    RARITY_ORDER,
    CARD_PRICES,
    ARTIFACT_PRICES,
    CARD_REMOVAL,
    RARITY_WEIGHTS,
    CORRUPTION_THRESHOLDS,
    DECK_LIMITS,
    COMBAT_REWARDS,
    RARITY_COLORS,
    RARITY_NAMES
};
