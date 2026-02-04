/**
 * SHATTERED STAR - Enemy AI System
 * Advanced enemy behavior patterns and intent selection
 * 
 * @version 1.0.0
 */

/**
 * AI Behavior Types
 */
export const AI_BEHAVIORS = {
    SEQUENTIAL: 'sequential',
    RANDOM: 'random',
    WEIGHTED: 'weighted',
    CONDITIONAL: 'conditional',
    ADAPTIVE: 'adaptive',
    PHASED: 'phased'
};

/**
 * Intent Types
 */
export const INTENT_TYPES = {
    ATTACK: 'attack',
    ATTACK_DEBUFF: 'attack_debuff',
    ATTACK_BUFF: 'attack_buff',
    MULTI_ATTACK: 'multi_attack',
    HEAVY_ATTACK: 'heavy_attack',
    DEFEND: 'defend',
    BUFF: 'buff',
    DEBUFF: 'debuff',
    HEAL: 'heal',
    SUMMON: 'summon',
    CHARGE: 'charge',
    SPECIAL: 'special',
    UNKNOWN: 'unknown'
};

/**
 * Enemy AI System
 */
export class EnemyAI {
    constructor(eventBus, statusSystem) {
        this.eventBus = eventBus;
        this.statusSystem = statusSystem;
        this.enemyStates = new Map();
        this.playerHistory = {
            attacksPlayed: 0,
            skillsPlayed: 0,
            powersPlayed: 0,
            damageDealt: 0,
            blockGained: 0,
            turnsElapsed: 0
        };
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (!this.eventBus) return;
        this.eventBus.on('combat:start', () => this.reset());
        this.eventBus.on('card:played', (data) => this.trackCardPlayed(data));
        this.eventBus.on('turn:end:player', () => this.onPlayerTurnEnd());
    }
    
    reset() {
        this.enemyStates.clear();
        this.playerHistory = {
            attacksPlayed: 0, skillsPlayed: 0, powersPlayed: 0,
            damageDealt: 0, blockGained: 0, turnsElapsed: 0
        };
    }
    
    initEnemy(enemy) {
        const state = {
            id: enemy.id,
            intentIndex: 0,
            turnsInCombat: 0,
            currentPhase: 0,
            lastIntent: null,
            timesHit: 0,
            totalDamageTaken: 0,
            specialFlags: {}
        };
        this.enemyStates.set(enemy.id, state);
        return state;
    }
    
    getEnemyState(enemy) {
        if (!this.enemyStates.has(enemy.id)) {
            return this.initEnemy(enemy);
        }
        return this.enemyStates.get(enemy.id);
    }
    
    selectIntent(enemy, gameState = {}) {
        const state = this.getEnemyState(enemy);
        const behavior = enemy.aiBehavior || AI_BEHAVIORS.SEQUENTIAL;
        
        let intent;
        
        switch (behavior) {
            case AI_BEHAVIORS.SEQUENTIAL:
                intent = this.selectSequentialIntent(enemy, state);
                break;
            case AI_BEHAVIORS.RANDOM:
                intent = this.selectRandomIntent(enemy, state);
                break;
            case AI_BEHAVIORS.WEIGHTED:
                intent = this.selectWeightedIntent(enemy, state);
                break;
            case AI_BEHAVIORS.CONDITIONAL:
                intent = this.selectConditionalIntent(enemy, state, gameState);
                break;
            case AI_BEHAVIORS.ADAPTIVE:
                intent = this.selectAdaptiveIntent(enemy, state, gameState);
                break;
            case AI_BEHAVIORS.PHASED:
                intent = this.selectPhasedIntent(enemy, state, gameState);
                break;
            default:
                intent = this.selectSequentialIntent(enemy, state);
        }
        
        state.lastIntent = intent;
        state.turnsInCombat++;
        
        if (intent && intent.damage) {
            const strength = this.statusSystem?.getEnemyStacks(enemy.id, 'strength') || 0;
            intent.calculatedDamage = intent.damage + strength;
        }
        
        return intent;
    }
    
    selectSequentialIntent(enemy, state) {
        const intents = enemy.intents || [];
        if (intents.length === 0) return this.defaultIntent();
        const intent = { ...intents[state.intentIndex % intents.length] };
        state.intentIndex++;
        return intent;
    }
    
    selectRandomIntent(enemy, state) {
        const intents = enemy.intents || [];
        if (intents.length === 0) return this.defaultIntent();
        return { ...intents[Math.floor(Math.random() * intents.length)] };
    }
    
    selectWeightedIntent(enemy, state) {
        const intents = enemy.intents || [];
        if (intents.length === 0) return this.defaultIntent();
        const totalWeight = intents.reduce((sum, i) => sum + (i.weight || 1), 0);
        let random = Math.random() * totalWeight;
        for (const intent of intents) {
            random -= (intent.weight || 1);
            if (random <= 0) return { ...intent };
        }
        return { ...intents[0] };
    }
    
    selectConditionalIntent(enemy, state, gameState) {
        const conditions = enemy.conditionalIntents || [];
        for (const condition of conditions) {
            if (this.evaluateCondition(condition, enemy, state, gameState)) {
                return { ...condition.intent };
            }
        }
        return this.selectSequentialIntent(enemy, state);
    }
    
    selectAdaptiveIntent(enemy, state, gameState) {
        const adaptiveRules = enemy.adaptiveRules || [];
        for (const rule of adaptiveRules) {
            if (this.evaluateAdaptiveRule(rule, state)) {
                return { ...rule.intent };
            }
        }
        if (enemy.conditionalIntents) {
            return this.selectConditionalIntent(enemy, state, gameState);
        }
        return this.selectSequentialIntent(enemy, state);
    }
    
    selectPhasedIntent(enemy, state, gameState) {
        const phases = enemy.phases || [];
        if (phases.length === 0) return this.selectSequentialIntent(enemy, state);
        
        const hpPercent = (enemy.currentHp / enemy.maxHp) * 100;
        let currentPhase = phases[0];
        
        for (let i = phases.length - 1; i >= 0; i--) {
            if (hpPercent <= phases[i].hpThreshold) {
                currentPhase = phases[i];
                if (state.currentPhase !== i) {
                    state.currentPhase = i;
                    state.intentIndex = 0;
                    this.eventBus?.emit('boss:phaseChange', { enemy, phase: currentPhase, phaseIndex: i });
                }
                break;
            }
        }
        
        const phaseIntents = currentPhase.intents || [];
        if (phaseIntents.length === 0) return this.selectSequentialIntent(enemy, state);
        
        const intent = { ...phaseIntents[state.intentIndex % phaseIntents.length] };
        state.intentIndex++;
        return intent;
    }
    
    evaluateCondition(condition, enemy, state, gameState) {
        switch (condition.type) {
            case 'hp_below': return (enemy.currentHp / enemy.maxHp) * 100 < condition.value;
            case 'hp_above': return (enemy.currentHp / enemy.maxHp) * 100 > condition.value;
            case 'turn_number': return state.turnsInCombat === condition.value;
            case 'turn_multiple': return state.turnsInCombat % condition.value === 0;
            case 'player_hp_below': return ((gameState.playerHp || 100) / (gameState.playerMaxHp || 100)) * 100 < condition.value;
            case 'player_has_block': return (gameState.playerBlock || 0) >= (condition.value || 1);
            case 'player_no_block': return (gameState.playerBlock || 0) === 0;
            case 'corruption_above': return (gameState.corruption || 0) >= condition.value;
            case 'last_intent_was': return state.lastIntent?.type === condition.value;
            case 'enemy_has_status': return this.statusSystem?.enemyHas(enemy.id, condition.status);
            case 'player_has_status': return this.statusSystem?.playerHas(condition.status);
            case 'random_chance': return Math.random() < condition.value;
            case 'first_turn': return state.turnsInCombat === 0;
            default: return false;
        }
    }
    
    evaluateAdaptiveRule(rule, state) {
        switch (rule.trigger) {
            case 'player_aggressive': return this.playerHistory.attacksPlayed > this.playerHistory.skillsPlayed * 1.5;
            case 'player_defensive': return this.playerHistory.skillsPlayed > this.playerHistory.attacksPlayed * 1.5;
            case 'player_high_damage': return this.playerHistory.damageDealt / Math.max(1, this.playerHistory.turnsElapsed) > 20;
            case 'player_low_damage': return this.playerHistory.damageDealt / Math.max(1, this.playerHistory.turnsElapsed) < 10;
            case 'player_using_powers': return this.playerHistory.powersPlayed >= 2;
            default: return false;
        }
    }
    
    defaultIntent() {
        return { type: INTENT_TYPES.ATTACK, damage: 6 };
    }
    
    trackCardPlayed(data) {
        if (!data?.card) return;
        switch (data.card.type) {
            case 'attack': this.playerHistory.attacksPlayed++; if (data.damage) this.playerHistory.damageDealt += data.damage; break;
            case 'skill': this.playerHistory.skillsPlayed++; if (data.block) this.playerHistory.blockGained += data.block; break;
            case 'power': this.playerHistory.powersPlayed++; break;
        }
    }
    
    onPlayerTurnEnd() {
        this.playerHistory.turnsElapsed++;
        for (const [id, state] of this.enemyStates) {
            state.specialFlags.tookDamageLastTurn = false;
        }
    }
    
    onEnemyDamaged(enemyId, amount) {
        const state = this.enemyStates.get(enemyId);
        if (state) {
            state.timesHit++;
            state.totalDamageTaken += amount;
            state.specialFlags.tookDamageLastTurn = true;
        }
    }
    
    executeIntent(enemy, intent, gameState) {
        if (!intent) return null;
        const result = { type: intent.type, success: true, effects: [] };
        
        if (this.statusSystem && !this.statusSystem.canEnemyAct(enemy.id)) {
            result.success = false;
            result.reason = 'stunned';
            return result;
        }
        
        switch (intent.type) {
            case INTENT_TYPES.ATTACK:
            case INTENT_TYPES.HEAVY_ATTACK:
                result.damage = this.calculateFinalDamage(enemy, intent.damage || intent.calculatedDamage);
                result.effects.push({ type: 'damage', value: result.damage });
                break;
            case INTENT_TYPES.MULTI_ATTACK:
                const hits = intent.hits || intent.times || 2;
                const perHitDamage = this.calculateFinalDamage(enemy, intent.damage);
                result.damage = perHitDamage;
                result.hits = hits;
                result.totalDamage = perHitDamage * hits;
                result.effects.push({ type: 'multi_damage', value: perHitDamage, hits });
                break;
            case INTENT_TYPES.ATTACK_DEBUFF:
                result.damage = this.calculateFinalDamage(enemy, intent.damage);
                result.effects.push({ type: 'damage', value: result.damage });
                result.effects.push({ type: 'debuff', status: intent.effect, stacks: intent.value || 1 });
                break;
            case INTENT_TYPES.DEFEND:
                result.block = intent.block || intent.value;
                result.effects.push({ type: 'block', value: result.block });
                break;
            case INTENT_TYPES.BUFF:
                result.effects.push({ type: 'self_buff', status: intent.effect, stacks: intent.value || 1 });
                break;
            case INTENT_TYPES.DEBUFF:
                result.effects.push({ type: 'debuff', status: intent.effect, stacks: intent.value || 1 });
                break;
            case INTENT_TYPES.HEAL:
                result.heal = intent.value || intent.heal;
                result.effects.push({ type: 'heal', value: result.heal });
                break;
            case INTENT_TYPES.SUMMON:
                result.effects.push({ type: 'summon', enemyId: intent.enemy || intent.summon });
                break;
        }
        
        return result;
    }
    
    calculateFinalDamage(enemy, baseDamage) {
        let damage = baseDamage;
        if (this.statusSystem) {
            damage = this.statusSystem.calculateEnemyDamage(enemy.id, damage);
        }
        return Math.max(0, Math.floor(damage));
    }
    
    getIntentDisplay(intent) {
        if (!intent) return { icon: '❓', color: '#888888', text: '' };
        
        const displays = {
            [INTENT_TYPES.ATTACK]: { icon: '⚔️', color: '#ff4444' },
            [INTENT_TYPES.HEAVY_ATTACK]: { icon: '💀', color: '#ff0000' },
            [INTENT_TYPES.MULTI_ATTACK]: { icon: '⚔️', color: '#ff4444' },
            [INTENT_TYPES.ATTACK_DEBUFF]: { icon: '⚔️☠️', color: '#ff6600' },
            [INTENT_TYPES.DEFEND]: { icon: '🛡️', color: '#4488ff' },
            [INTENT_TYPES.BUFF]: { icon: '💪', color: '#44ff44' },
            [INTENT_TYPES.DEBUFF]: { icon: '☠️', color: '#aa44aa' },
            [INTENT_TYPES.HEAL]: { icon: '💚', color: '#44ff44' },
            [INTENT_TYPES.SUMMON]: { icon: '👥', color: '#ffaa00' },
            [INTENT_TYPES.CHARGE]: { icon: '⚡', color: '#ffff00' }
        };
        
        const display = displays[intent.type] || { icon: '❓', color: '#888888' };
        let text = '';
        
        if (intent.damage) text = intent.calculatedDamage || intent.damage;
        if (intent.hits) text = `${intent.damage} x${intent.hits}`;
        if (intent.block) text = intent.block;
        if (intent.heal) text = intent.heal;
        
        return { ...display, text };
    }
}

let instance = null;
export function getEnemyAI(eventBus, statusSystem) {
    if (!instance) instance = new EnemyAI(eventBus, statusSystem);
    return instance;
}

export default EnemyAI;
