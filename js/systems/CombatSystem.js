/**
 * CombatSystem - Handles all combat mechanics
 * FIXED VERSION: Aligned property names, proper state sync, robust error handling
 * @version 0.2.2
 */
class CombatSystem {
    constructor(state, eventBus, deckManager) {
        this.state = state;
        this.eventBus = eventBus;
        this.deck = deckManager;
        
        this.inCombat = false;
        this.turn = 0;
        this.phase = 'inactive'; // inactive, player, enemy
        this.enemies = [];
        this.selectedCard = null;
        
        this.playerBlock = 0;
        this.playerEnergy = 0;
        this.maxEnergy = 3;
        
        // Korvax-specific
        this.overheat = 0;
        this.maxOverheat = 10;
        this.rage = 0;
        
        this.tookDamageThisTurn = false;
        
        // FIX: Add isPlayerTurn getter for compatibility
        Object.defineProperty(this, 'isPlayerTurn', {
            get: () => this.phase === 'player'
        });
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on('card:play', (data) => this.onCardPlayed(data));
    }

    /**
     * Start combat with enemies
     * FIX: Normalize enemy data structure for UI compatibility
     */
    startCombat(enemyData) {
        console.log('[CombatSystem] Starting combat with:', enemyData);
        
        if (!enemyData || (Array.isArray(enemyData) && enemyData.length === 0)) {
            console.error('[CombatSystem] No enemy data provided!');
            return false;
        }
        
        this.inCombat = true;
        this.turn = 0;
        this.phase = 'player';
        
        // Normalize to array
        const enemyArray = Array.isArray(enemyData) ? enemyData : [enemyData];
        
        // FIX: Initialize enemies with CONSISTENT property names for UI
        this.enemies = enemyArray.map((enemy, index) => {
            const maxHp = enemy.maxHp || enemy.hp || 20;
            const currentHp = enemy.currentHp || enemy.hp || maxHp;
            
            return {
                // Core identity
                id: enemy.id || `enemy_${index}`,
                instanceId: `enemy_${index}_${Date.now()}`,
                name: enemy.name || 'Unknown Enemy',
                type: enemy.type || 'basic',
                
                // FIX: Use BOTH hp and currentHp for compatibility
                hp: currentHp,           // Used by CombatScreen
                currentHp: currentHp,    // Used internally
                maxHp: maxHp,            // Max HP for percentage calculations
                
                // Combat stats
                block: enemy.block || 0,
                statusEffects: enemy.statusEffects || [],
                
                // Intent system
                intents: enemy.intents || [{ type: 'attack', damage: 6 }],
                intentIndex: 0,
                currentIntent: null,
                intent: null,  // FIX: CombatScreen uses 'intent' not 'currentIntent'
                
                // Boss phases (optional)
                phases: enemy.phases || null
            };
        });
        
        console.log('[CombatSystem] Initialized enemies:', this.enemies);
        
        // Reset player combat state
        this.playerBlock = 0;
        this.maxEnergy = this.state.get('hero.maxEnergy') || 3;
        this.playerEnergy = this.maxEnergy;
        this.overheat = 0;
        this.rage = 0;
        this.tookDamageThisTurn = false;
        
        // FIX: Sync energy to state for UI
        this.syncStateToUI();
        
        // Setup deck for combat
        if (this.deck && typeof this.deck.startCombat === 'function') {
            this.deck.startCombat();
        } else {
            console.warn('[CombatSystem] DeckManager not available or missing startCombat');
        }
        
        // Emit combat start
        this.eventBus.emit('combat:start', {
            enemies: this.enemies
        });
        
        // Start first turn
        this.startPlayerTurn();
        
        return true;
    }

    /**
     * FIX: Sync combat state to game state for UI access
     */
    syncStateToUI() {
        this.state.set('hero.energy', this.playerEnergy);
        this.state.set('hero.maxEnergy', this.maxEnergy);
        this.state.set('hero.block', this.playerBlock);
        this.state.set('combat.turn', this.turn);
        this.state.set('combat.phase', this.phase);
        this.state.set('combat.enemies', this.enemies);
        this.state.set('combat.overheat', this.overheat);
        this.state.set('combat.rage', this.rage);
    }

    /**
     * Start player turn
     */
    startPlayerTurn() {
        this.turn++;
        this.phase = 'player';
        this.tookDamageThisTurn = false;
        
        // Reset energy
        this.playerEnergy = this.maxEnergy;
        
        // Reset block (block doesn't carry over by default)
        this.playerBlock = 0;
        
        // Set enemy intents for this turn
        this.enemies.forEach(enemy => {
            if (enemy.hp > 0) {
                this.setEnemyIntent(enemy);
            }
        });
        
        // Draw cards
        if (this.deck && typeof this.deck.drawStartingHand === 'function') {
            this.deck.drawStartingHand();
        }
        
        // Sync state
        this.syncStateToUI();
        
        // Emit events
        this.eventBus.emit('turn:start', { turn: this.turn });
        this.eventBus.emit('turn:player');
        this.eventBus.emit('player:turn:start');
        this.eventBus.emit('combat:ui:update');
        
        console.log(`[CombatSystem] Player turn ${this.turn} started`);
    }

    /**
     * End player turn
     */
    endTurn() {
        if (this.phase !== 'player') {
            console.warn('[CombatSystem] Cannot end turn - not player phase');
            return;
        }
        
        console.log('[CombatSystem] Ending player turn');
        
        // Discard remaining hand
        if (this.deck && typeof this.deck.discardHand === 'function') {
            this.deck.discardHand();
        }
        
        this.eventBus.emit('player:turn:end');
        
        // Start enemy turn
        this.startEnemyTurn();
    }

    /**
     * Start enemy turn
     */
    startEnemyTurn() {
        this.phase = 'enemy';
        this.syncStateToUI();
        
        this.eventBus.emit('turn:enemy');
        this.eventBus.emit('enemy:turn:start');
        
        // Execute enemy actions sequentially
        this.executeEnemyActions(0);
    }

    /**
     * Execute enemy actions one by one
     */
    executeEnemyActions(enemyIndex) {
        // Filter to living enemies
        const livingEnemies = this.enemies.filter(e => e.hp > 0);
        
        if (enemyIndex >= livingEnemies.length) {
            // All enemies have acted
            this.endEnemyTurn();
            return;
        }
        
        const enemy = livingEnemies[enemyIndex];
        
        // Execute intent
        this.executeEnemyIntent(enemy);
        
        // Move to next enemy after delay
        setTimeout(() => {
            this.executeEnemyActions(enemyIndex + 1);
        }, 600);
    }

    /**
     * Execute a single enemy's intent
     */
    executeEnemyIntent(enemy) {
        const intent = enemy.intent || enemy.currentIntent;
        if (!intent) {
            console.warn(`[CombatSystem] No intent for ${enemy.name}`);
            return;
        }
        
        console.log(`[CombatSystem] ${enemy.name} executes: ${intent.type}`);
        
        this.eventBus.emit('enemy:action', { enemy, intent });
        
        switch (intent.type) {
            case 'attack':
                const damage = intent.damage || 6;
                const times = intent.times || 1;
                for (let i = 0; i < times; i++) {
                    this.enemyAttack(enemy, damage);
                }
                break;
                
            case 'block':
            case 'defend':
                enemy.block += (intent.value || intent.block || 5);
                this.eventBus.emit('enemy:block', { enemy, amount: intent.value || intent.block });
                break;
                
            case 'buff':
                this.applyStatusEffect(enemy, intent.effect, intent.value);
                break;
                
            case 'debuff':
                this.applyPlayerDebuff(intent.effect, intent.value);
                break;
                
            case 'heal':
                const healAmount = intent.value || 5;
                enemy.hp = Math.min(enemy.hp + healAmount, enemy.maxHp);
                enemy.currentHp = enemy.hp;
                this.eventBus.emit('enemy:heal', { enemy, amount: healAmount });
                break;
                
            case 'charge':
                // Charging - next attack will be stronger
                enemy.charging = true;
                this.eventBus.emit('enemy:charge', { enemy });
                break;
                
            default:
                console.warn(`[CombatSystem] Unknown intent type: ${intent.type}`);
        }
        
        // Advance intent index for next turn
        enemy.intentIndex++;
        
        this.eventBus.emit('combat:ui:update');
    }

    /**
     * Enemy attacks player
     */
    enemyAttack(enemy, baseDamage) {
        let damage = baseDamage;
        
        // Apply enemy strength buff
        const strength = this.getStatusEffect(enemy, 'strength');
        if (strength) damage += strength.value;
        
        // Check if enemy was charging
        if (enemy.charging) {
            damage *= 2;
            enemy.charging = false;
        }
        
        // Calculate actual damage after block
        let blocked = 0;
        if (this.playerBlock > 0) {
            blocked = Math.min(this.playerBlock, damage);
            this.playerBlock -= blocked;
            damage -= blocked;
        }
        
        // Apply damage to player
        if (damage > 0) {
            const currentHp = this.state.get('hero.hp');
            const newHp = Math.max(0, currentHp - damage);
            this.state.set('hero.hp', newHp);
            this.tookDamageThisTurn = true;
            
            this.eventBus.emit('player:damaged', { 
                damage, 
                blocked,
                source: enemy 
            });
            
            // Check for player death
            if (newHp <= 0) {
                this.handlePlayerDeath();
            }
        } else {
            this.eventBus.emit('player:damaged', { damage: 0, blocked });
        }
        
        this.syncStateToUI();
    }

    /**
     * End enemy turn
     */
    endEnemyTurn() {
        // Reset enemy blocks
        this.enemies.forEach(enemy => {
            enemy.block = 0;
        });
        
        this.eventBus.emit('enemy:turn:end');
        
        // Check if combat should end
        if (!this.checkCombatEnd()) {
            // Start next player turn
            this.startPlayerTurn();
        }
    }

    /**
     * Set enemy intent for the turn
     * FIX: Set BOTH currentIntent and intent for compatibility
     */
    setEnemyIntent(enemy) {
        const intents = enemy.intents || [];
        if (intents.length === 0) {
            enemy.currentIntent = { type: 'attack', damage: 6 };
            enemy.intent = enemy.currentIntent;
            return;
        }
        
        let selectedIntent;
        
        // Handle phased bosses
        if (enemy.phases && enemy.maxHp) {
            const hpPercent = enemy.hp / enemy.maxHp;
            const phase = enemy.phases.find(p => hpPercent <= p.threshold);
            if (phase && phase.intents) {
                selectedIntent = phase.intents[enemy.intentIndex % phase.intents.length];
            }
        }
        
        // Regular pattern if no phase matched
        if (!selectedIntent) {
            selectedIntent = intents[enemy.intentIndex % intents.length];
        }
        
        // FIX: Set both properties
        enemy.currentIntent = { ...selectedIntent };
        enemy.intent = enemy.currentIntent;
        
        this.eventBus.emit('enemy:intent:set', {
            enemy,
            intent: enemy.intent
        });
    }

    /**
     * Play a card by index
     */
    playCard(cardIndex, targetId) {
        if (this.phase !== 'player') {
            console.warn('[CombatSystem] Cannot play card - not player turn');
            return false;
        }
        
        const hand = this.deck ? this.deck.getHand() : [];
        if (cardIndex < 0 || cardIndex >= hand.length) {
            console.warn('[CombatSystem] Invalid card index:', cardIndex);
            return false;
        }
        
        const card = hand[cardIndex];
        
        // Check energy
        if (card.cost > this.playerEnergy) {
            console.log('[CombatSystem] Not enough energy');
            this.eventBus.emit('card:insufficient-energy', { card });
            return false;
        }
        
        // Find target
        let target = null;
        if (card.type === 'attack' || card.target === 'enemy') {
            if (targetId) {
                target = this.enemies.find(e => e.id === targetId || e.instanceId === targetId);
            }
            // Auto-target first living enemy if no target specified
            if (!target) {
                target = this.enemies.find(e => e.hp > 0);
            }
        }
        
        console.log(`[CombatSystem] Playing card: ${card.name}`, { target: target?.name });
        
        // Spend energy
        this.playerEnergy -= card.cost;
        
        // Execute card effect
        this.executeCard(card, target);
        
        // Remove card from hand
        if (this.deck && typeof this.deck.playCard === 'function') {
            this.deck.playCard(card.instanceId || cardIndex);
        }
        
        // Clear selection
        this.selectedCard = null;
        
        // Sync state
        this.syncStateToUI();
        
        // Emit events
        this.eventBus.emit('card:played', { card, target });
        this.eventBus.emit('combat:ui:update');
        
        // Check combat end
        this.checkCombatEnd();
        
        return true;
    }

    /**
     * Select card by index (keyboard shortcut)
     */
    selectCardByIndex(index) {
        const hand = this.deck ? this.deck.getHand() : [];
        if (index >= 0 && index < hand.length) {
            const card = hand[index];
            if (card.cost <= this.playerEnergy) {
                // Auto-play on single enemy
                const livingEnemies = this.enemies.filter(e => e.hp > 0);
                if (livingEnemies.length === 1 || card.type !== 'attack') {
                    this.playCard(index, livingEnemies[0]?.instanceId);
                } else {
                    // Need to select target
                    this.selectedCard = { card, index };
                    this.eventBus.emit('card:selected', { card, index });
                }
            }
        }
    }

    /**
     * Execute card effect
     */
    executeCard(card, target) {
        // Deal damage
        if (card.damage && target) {
            let damage = card.damage;
            
            // Apply rage bonus (Korvax)
            damage += this.rage;
            
            // Check conditional damage (Rage Spike)
            if (card.conditionalDamage && card.condition === 'tookDamageThisTurn' && this.tookDamageThisTurn) {
                damage = card.conditionalDamage;
            }
            
            this.dealDamageToEnemy(target, damage);
        }
        
        // Gain block
        if (card.block) {
            this.playerBlock += card.block;
            this.eventBus.emit('block:gained', { amount: card.block });
        }
        
        // Draw cards
        if (card.draw && this.deck) {
            this.deck.drawCards(card.draw);
        }
        
        // Gain overheat (Korvax)
        if (card.overheat) {
            this.overheat += card.overheat;
            this.eventBus.emit('overheat:changed', { 
                current: this.overheat, 
                max: this.maxOverheat 
            });
            
            // Check overheat threshold
            if (this.overheat >= this.maxOverheat) {
                this.handleOverheat();
            }
        }
        
        // Gain energy
        if (card.energy) {
            this.playerEnergy += card.energy;
        }
        
        // Apply status effects
        if (card.applyStatus && target) {
            this.applyStatusEffect(target, card.applyStatus, card.statusValue || 1);
        }
        
        // Self status effects
        if (card.selfStatus) {
            // Apply to player (stored in state)
            const currentEffects = this.state.get('hero.statusEffects') || [];
            currentEffects.push({ 
                effect: card.selfStatus, 
                value: card.selfStatusValue || 1 
            });
            this.state.set('hero.statusEffects', currentEffects);
        }
        
        // Exhaust card if marked
        if (card.exhaust && this.deck && typeof this.deck.exhaustCard === 'function') {
            this.deck.exhaustCard(card.instanceId);
        }
    }

    /**
     * Deal damage to enemy
     */
    dealDamageToEnemy(enemy, baseDamage) {
        let damage = baseDamage;
        
        // Apply vulnerable debuff
        const vulnerable = this.getStatusEffect(enemy, 'vulnerable');
        if (vulnerable) {
            damage = Math.floor(damage * 1.5);
        }
        
        // Apply block
        if (enemy.block > 0) {
            const blocked = Math.min(enemy.block, damage);
            enemy.block -= blocked;
            damage -= blocked;
        }
        
        // Apply damage
        if (damage > 0) {
            enemy.hp -= damage;
            enemy.currentHp = enemy.hp;
            
            this.eventBus.emit('enemy:damaged', { enemy, damage });
            
            // Check for death
            if (enemy.hp <= 0) {
                enemy.hp = 0;
                enemy.currentHp = 0;
                this.handleEnemyDeath(enemy);
            }
        }
    }

    /**
     * Handle enemy death
     */
    handleEnemyDeath(enemy) {
        console.log(`[CombatSystem] ${enemy.name} defeated!`);
        this.eventBus.emit('enemy:defeated', { enemy });
    }

    /**
     * Handle player death
     */
    handlePlayerDeath() {
        console.log('[CombatSystem] Player defeated!');
        this.inCombat = false;
        this.phase = 'inactive';
        this.eventBus.emit('combat:defeat');
    }

    /**
     * Check if combat should end
     */
    checkCombatEnd() {
        const livingEnemies = this.enemies.filter(e => e.hp > 0);
        
        if (livingEnemies.length === 0) {
            // Victory!
            console.log('[CombatSystem] Combat victory!');
            this.inCombat = false;
            this.phase = 'inactive';
            this.eventBus.emit('combat:victory');
            return true;
        }
        
        const playerHp = this.state.get('hero.hp');
        if (playerHp <= 0) {
            // Already handled in enemyAttack
            return true;
        }
        
        return false;
    }

    /**
     * Handle Korvax overheat
     */
    handleOverheat() {
        console.log('[CombatSystem] OVERHEAT! Taking damage...');
        const currentHp = this.state.get('hero.hp');
        const damage = 5;
        this.state.set('hero.hp', Math.max(0, currentHp - damage));
        this.overheat = 0;
        
        this.eventBus.emit('overheat:triggered', { damage });
        this.eventBus.emit('player:damaged', { damage, blocked: 0, source: 'overheat' });
    }

    /**
     * Apply status effect to entity
     */
    applyStatusEffect(entity, effect, value) {
        if (!entity.statusEffects) entity.statusEffects = [];
        
        const existing = entity.statusEffects.find(s => s.effect === effect);
        if (existing) {
            existing.value += value;
        } else {
            entity.statusEffects.push({ effect, value });
        }
        
        this.eventBus.emit('status:applied', { entity, effect, value });
    }

    /**
     * Get status effect from entity
     */
    getStatusEffect(entity, effect) {
        if (!entity.statusEffects) return null;
        return entity.statusEffects.find(s => s.effect === effect);
    }

    /**
     * Apply debuff to player
     */
    applyPlayerDebuff(effect, value) {
        const currentEffects = this.state.get('hero.statusEffects') || [];
        const existing = currentEffects.find(s => s.effect === effect);
        if (existing) {
            existing.value += value;
        } else {
            currentEffects.push({ effect, value });
        }
        this.state.set('hero.statusEffects', currentEffects);
        
        this.eventBus.emit('player:debuffed', { effect, value });
    }

    /**
     * Get current hand
     */
    getHand() {
        return this.deck ? this.deck.getHand() : [];
    }

    /**
     * Get combat state for saving
     */
    getCombatState() {
        return {
            inCombat: this.inCombat,
            turn: this.turn,
            phase: this.phase,
            enemies: this.enemies,
            playerBlock: this.playerBlock,
            playerEnergy: this.playerEnergy,
            overheat: this.overheat,
            rage: this.rage
        };
    }

    /**
     * Restore combat state from save
     */
    restoreCombatState(savedState) {
        if (!savedState) return;
        
        this.inCombat = savedState.inCombat;
        this.turn = savedState.turn;
        this.phase = savedState.phase;
        this.enemies = savedState.enemies || [];
        this.playerBlock = savedState.playerBlock || 0;
        this.playerEnergy = savedState.playerEnergy || this.maxEnergy;
        this.overheat = savedState.overheat || 0;
        this.rage = savedState.rage || 0;
        
        this.syncStateToUI();
        this.eventBus.emit('combat:ui:update');
    }
}

export { CombatSystem };
