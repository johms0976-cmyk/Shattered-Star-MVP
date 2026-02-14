/**
 * CombatSystem - Handles all combat mechanics
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
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.eventBus.on('card:played', (card) => this.onCardPlayed(card));
    }

    /**
     * Start combat with enemies
     */
    startCombat(enemyData) {
        console.log('[CombatSystem] Starting combat');
        
        this.inCombat = true;
        this.turn = 0;
        this.phase = 'player';
        this.enemies = Array.isArray(enemyData) ? enemyData : [enemyData];
        
        // Initialize enemies
        this.enemies = this.enemies.map((enemy, index) => ({
            ...enemy,
            instanceId: `enemy_${index}_${Date.now()}`,
            currentHp: enemy.hp,
            block: 0,
            statusEffects: [],
            intentIndex: 0,
            currentIntent: null
        }));
        
        // Reset player combat state
        this.playerBlock = 0;
        this.playerEnergy = this.maxEnergy;
        this.overheat = 0;
        this.rage = 0;
        this.tookDamageThisTurn = false;
        
        // Setup deck
        this.deck.startCombat();
        
        // Emit combat start
        this.eventBus.emit('combat:start', {
            enemies: this.enemies
        });
        
        // Start first turn
        this.startPlayerTurn();
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
        
        // Reset block
        this.playerBlock = 0;
        
        // Draw cards
        this.deck.drawStartingHand();
        
        // Set enemy intents
        this.enemies.forEach(enemy => {
            this.setEnemyIntent(enemy);
        });
        
        // Update UI
        this.updateUI();
        
        this.eventBus.emit('turn:start', { turn: this.turn });
        this.eventBus.emit('player:turn:start');
    }

    /**
     * End player turn
     */
    endTurn() {
        if (this.phase !== 'player') return;
        
        console.log('[CombatSystem] Ending player turn');
        
        // Discard remaining hand
        this.deck.discardHand();
        
        this.eventBus.emit('player:turn:end');
        
        // Start enemy turn
        this.startEnemyTurn();
    }

    /**
     * Start enemy turn
     */
    startEnemyTurn() {
        this.phase = 'enemy';
        this.eventBus.emit('enemy:turn:start');
        
        // Execute enemy actions sequentially
        this.executeEnemyActions(0);
    }

    /**
     * Execute enemy actions one by one
     */
    executeEnemyActions(enemyIndex) {
        if (enemyIndex >= this.enemies.length) {
            // All enemies have acted
            this.endEnemyTurn();
            return;
        }
        
        const enemy = this.enemies[enemyIndex];
        
        // Skip dead enemies
        if (enemy.currentHp <= 0) {
            this.executeEnemyActions(enemyIndex + 1);
            return;
        }
        
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
        const intent = enemy.currentIntent;
        if (!intent) return;
        
        console.log(`[CombatSystem] ${enemy.name} executes:`, intent.type);
        
        switch (intent.type) {
            case 'attack':
                this.enemyAttack(enemy, intent.damage);
                break;
            case 'block':
            case 'defend':
                enemy.block += intent.value || intent.block || 0;
                break;
            case 'buff':
                this.applyStatusEffect(enemy, intent.effect, intent.value);
                break;
            case 'debuff':
                this.applyPlayerDebuff(intent.effect, intent.value);
                break;
            case 'summon':
                // TODO: Implement summoning
                break;
            case 'charge':
                // Charging - next attack is stronger
                enemy.charging = true;
                break;
        }
        
        // Advance intent index
        enemy.intentIndex++;
        
        this.eventBus.emit('enemy:action', { enemy, intent });
    }

    /**
     * Enemy attacks player
     */
    enemyAttack(enemy, baseDamage) {
        let damage = baseDamage;
        
        // Apply strength
        const strength = this.getStatusValue(enemy, 'strength');
        damage += strength;
        
        // Calculate actual damage after block
        const blockedDamage = Math.min(damage, this.playerBlock);
        this.playerBlock -= blockedDamage;
        const actualDamage = damage - blockedDamage;
        
        if (actualDamage > 0) {
            this.dealDamageToPlayer(actualDamage);
        }
        
        this.eventBus.emit('damage:dealt', {
            source: enemy,
            target: 'player',
            damage: actualDamage,
            blocked: blockedDamage
        });
    }

    /**
     * Deal damage to player
     */
    dealDamageToPlayer(amount) {
        const currentHp = this.state.get('hero.hp');
        const newHp = Math.max(0, currentHp - amount);
        
        this.state.set('hero.hp', newHp);
        this.tookDamageThisTurn = true;
        
        this.eventBus.emit('hp:changed', {
            current: newHp,
            max: this.state.get('hero.maxHp'),
            change: -amount
        });
        
        // Check for rage gain (Korvax)
        if (this.state.get('powers.rageProtocol')) {
            this.rage++;
            this.eventBus.emit('rage:changed', this.rage);
        }
        
        this.updateUI();
        
        if (newHp <= 0) {
            this.handlePlayerDeath();
        }
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
        
        // Check if combat is over
        if (!this.checkCombatEnd()) {
            // Start next player turn
            this.startPlayerTurn();
        }
    }

    /**
     * Set enemy intent for the turn
     */
    setEnemyIntent(enemy) {
        const intents = enemy.intents || [];
        if (intents.length === 0) return;
        
        // Handle phased bosses
        if (enemy.phases) {
            const hpPercent = enemy.currentHp / enemy.maxHp;
            const phase = enemy.phases.find(p => hpPercent <= p.threshold);
            if (phase) {
                const phaseIntents = phase.intents;
                enemy.currentIntent = phaseIntents[enemy.intentIndex % phaseIntents.length];
            }
        } else {
            // Regular pattern
            enemy.currentIntent = intents[enemy.intentIndex % intents.length];
        }
        
        this.eventBus.emit('enemy:intent:set', {
            enemy,
            intent: enemy.currentIntent
        });
    }

    /**
     * Select a card from hand
     */
    selectCard(instanceId) {
        const card = this.deck.getCardFromHand(instanceId);
        if (!card) return;
        
        // Check if player has enough energy
        if (card.cost > this.playerEnergy) {
            console.log('[CombatSystem] Not enough energy');
            return;
        }
        
        // For attack cards, need to select target
        if (card.target === 'enemy' && this.enemies.length > 1) {
            this.selectedCard = card;
            this.eventBus.emit('card:selected', card);
        } else {
            // Auto-target single enemy or self
            const target = card.target === 'enemy' ? this.enemies[0] : null;
            this.playSelectedCard(card, target);
        }
    }

    /**
     * Select card by index (keyboard shortcut)
     */
    selectCardByIndex(index) {
        const hand = this.deck.getHand();
        if (index < hand.length) {
            this.selectCard(hand[index].instanceId);
        }
    }

    /**
     * Play selected card on target
     */
    playSelectedCard(card, target) {
        if (this.phase !== 'player') return;
        if (card.cost > this.playerEnergy) return;
        
        console.log(`[CombatSystem] Playing card: ${card.name}`);
        
        // Spend energy
        this.playerEnergy -= card.cost;
        
        // Execute card effect
        this.executeCard(card, target);
        
        // Remove card from hand
        this.deck.playCard(card.instanceId);
        
        // Clear selection
        this.selectedCard = null;
        
        // Update UI
        this.updateUI();
        
        // Check combat end
        this.checkCombatEnd();
    }

    /**
     * Execute card effect
     */
    executeCard(card, target) {
        // Deal damage
        if (card.damage) {
            let damage = card.damage;
            
            // Apply Overheat bonus
            if (card.overheat && this.state.get('artifacts.thermal_regulator')) {
                damage += 1;
            }
            
            // Apply rage bonus
            damage += this.rage;
            
            // Check conditional damage (Rage Spike)
            if (card.conditionalDamage && card.condition === 'tookDamageThisTurn' && this.tookDamageThisTurn) {
                damage = card.conditionalDamage;
            }
            
            this.dealDamageToEnemy(target, damage);
        }
        
        // Meltdown special
        if (card.damageMultiplier === 'overheat') {
            const damage = this.overheat * (card.damagePerOverheat || 1);
            this.dealDamageToEnemy(target, damage);
            if (card.resetOverheat) {
                this.overheat = 0;
            }
        }
        
        // Gain block
        if (card.block) {
            this.playerBlock += card.block;
            this.eventBus.emit('block:gained', card.block);
        }
        
        // Gain overheat
        if (card.overheat) {
            this.overheat = Math.min(this.maxOverheat, this.overheat + card.overheat);
            this.eventBus.emit('overheat:changed', this.overheat);
        }
        
        // Reduce overheat
        if (card.overheatReduce) {
            this.overheat = Math.max(0, this.overheat - card.overheatReduce);
            this.eventBus.emit('overheat:changed', this.overheat);
        }
        
        // Gain energy
        if (card.energy) {
            this.playerEnergy += card.energy;
            this.eventBus.emit('energy:gained', card.energy);
        }
        
        // Draw cards
        if (card.draw) {
            this.deck.drawCards(card.draw);
        }
        
        // Self damage
        if (card.selfDamage) {
            this.dealDamageToPlayer(card.selfDamage);
        }
        
        // Gain armor
        if (card.armor) {
            this.applyPlayerBuff('armor', card.armor);
        }
        
        // Update stats
        this.state.increment('stats.cardsPlayed');
    }

    /**
     * Deal damage to enemy
     */
    dealDamageToEnemy(enemy, amount) {
        if (!enemy) {
            // Target first alive enemy if none specified
            enemy = this.enemies.find(e => e.currentHp > 0);
        }
        if (!enemy) return;
        
        // Calculate actual damage after block
        const blockedDamage = Math.min(amount, enemy.block);
        enemy.block -= blockedDamage;
        const actualDamage = amount - blockedDamage;
        
        if (actualDamage > 0) {
            enemy.currentHp = Math.max(0, enemy.currentHp - actualDamage);
            this.state.increment('stats.damageDealt', actualDamage);
        }
        
        this.eventBus.emit('damage:dealt', {
            source: 'player',
            target: enemy,
            damage: actualDamage,
            blocked: blockedDamage
        });
        
        // Check if enemy died
        if (enemy.currentHp <= 0) {
            this.handleEnemyDeath(enemy);
        }
        
        this.updateUI();
    }

    /**
     * Handle enemy death
     */
    handleEnemyDeath(enemy) {
        this.eventBus.emit('enemy:death', enemy);
        
        // Check if was boss
        if (enemy.type === 'boss') {
            this.eventBus.emit('boss:defeated');
        }
    }

    /**
     * Handle player death
     */
    handlePlayerDeath() {
        this.inCombat = false;
        this.phase = 'inactive';
        this.eventBus.emit('combat:defeat');
    }

    /**
     * Check if combat should end
     */
    checkCombatEnd() {
        const aliveEnemies = this.enemies.filter(e => e.currentHp > 0);
        
        if (aliveEnemies.length === 0) {
            this.handleCombatVictory();
            return true;
        }
        
        return false;
    }

    /**
     * Handle combat victory
     */
    handleCombatVictory() {
        console.log('[CombatSystem] Combat victory!');
        
        this.inCombat = false;
        this.phase = 'inactive';
        this.state.increment('stats.combatsWon');
        
        this.deck.endCombat();
        this.eventBus.emit('combat:victory');
    }

    /**
     * Called when a card is played
     */
    onCardPlayed(card) {
        // Increment cards played stat
        this.state.increment('stats.cardsPlayed');
    }

    /**
     * Apply status effect to entity
     */
    applyStatusEffect(entity, effect, value) {
        const existing = entity.statusEffects.find(s => s.type === effect);
        if (existing) {
            existing.value += value;
        } else {
            entity.statusEffects.push({ type: effect, value });
        }
    }

    /**
     * Get status effect value
     */
    getStatusValue(entity, effect) {
        const status = entity.statusEffects.find(s => s.type === effect);
        return status ? status.value : 0;
    }

    /**
     * Apply debuff to player
     */
    applyPlayerDebuff(effect, value) {
        const current = this.state.get(`debuffs.${effect}`) || 0;
        this.state.set(`debuffs.${effect}`, current + value);
        this.eventBus.emit('status:applied', { target: 'player', effect, value });
    }

    /**
     * Apply buff to player
     */
    applyPlayerBuff(effect, value) {
        const current = this.state.get(`buffs.${effect}`) || 0;
        this.state.set(`buffs.${effect}`, current + value);
        this.eventBus.emit('status:applied', { target: 'player', effect, value });
    }

    /**
     * Update combat UI
     */
    updateUI() {
        // Update energy display
        const energyCurrent = document.getElementById('energy-current');
        const energyMax = document.getElementById('energy-max');
        if (energyCurrent) energyCurrent.textContent = this.playerEnergy;
        if (energyMax) energyMax.textContent = this.maxEnergy;
        
        // Update block display
        const blockValue = document.getElementById('combat-block');
        if (blockValue) blockValue.textContent = this.playerBlock;
        
        // Update HP display
        const hp = this.state.get('hero.hp');
        const maxHp = this.state.get('hero.maxHp');
        const hpFill = document.getElementById('combat-hp-fill');
        const hpText = document.getElementById('combat-hp-text');
        if (hpFill) hpFill.style.width = `${(hp / maxHp) * 100}%`;
        if (hpText) hpText.textContent = `${hp}/${maxHp}`;
        
        // Render enemies
        this.renderEnemies();
        
        // Render hand
        this.renderHand();
    }

    /**
     * Render enemies in combat area
     */
    renderEnemies() {
        const container = document.getElementById('enemy-area');
        if (!container) return;
        
        container.innerHTML = this.enemies.map(enemy => `
            <div class="enemy ${enemy.currentHp <= 0 ? 'dead' : ''}" 
                 data-enemy-id="${enemy.instanceId}">
                <div class="enemy-intent">
                    ${this.renderIntent(enemy.currentIntent)}
                </div>
                <div class="enemy-sprite">
                    ${this.getEnemyIcon(enemy.type)}
                </div>
                <div class="enemy-name">${enemy.name}</div>
                <div class="enemy-hp-bar">
                    <div class="hp-fill" style="width: ${(enemy.currentHp / enemy.maxHp) * 100}%"></div>
                    <span class="hp-text">${enemy.currentHp}/${enemy.maxHp}</span>
                </div>
                ${enemy.block > 0 ? `<div class="enemy-block">🛡 ${enemy.block}</div>` : ''}
            </div>
        `).join('');
        
        // Add click handlers for targeting
        container.querySelectorAll('.enemy:not(.dead)').forEach(el => {
            el.addEventListener('click', () => {
                if (this.selectedCard && this.selectedCard.target === 'enemy') {
                    const enemy = this.enemies.find(e => e.instanceId === el.dataset.enemyId);
                    if (enemy) {
                        this.playSelectedCard(this.selectedCard, enemy);
                    }
                }
            });
        });
    }

    /**
     * Render intent indicator
     */
    renderIntent(intent) {
        if (!intent) return '';
        
        switch (intent.type) {
            case 'attack':
                return `<span class="intent-attack">⚔ ${intent.damage}</span>`;
            case 'block':
            case 'defend':
                return `<span class="intent-block">🛡 ${intent.value || intent.block || 0}</span>`;
            case 'buff':
                return `<span class="intent-buff">⬆ Buff</span>`;
            case 'debuff':
                return `<span class="intent-debuff">⬇ Debuff</span>`;
            case 'charge':
                return `<span class="intent-charge">💫 Charging</span>`;
            default:
                return `<span class="intent-unknown">?</span>`;
        }
    }

    /**
     * Get enemy icon
     */
    getEnemyIcon(type) {
        const icons = {
            basic: '👹',
            elite: '💀',
            boss: '👿'
        };
        return icons[type] || '👾';
    }

    /**
     * Render hand
     */
    renderHand() {
        const container = document.getElementById('hand-area');
        if (!container) return;
        
        const hand = this.deck.getHand();
        
        container.innerHTML = hand.map((card, index) => `
            <div class="card type-${card.type} rarity-${card.rarity} 
                        ${card.cost > this.playerEnergy ? 'unplayable' : ''}"
                 data-card-id="${card.instanceId}"
                 data-index="${index}">
                <div class="card-cost">${card.cost}</div>
                <div class="card-type-indicator"></div>
                <div class="card-art">${this.getCardIcon(card.type)}</div>
                <div class="card-name">${card.name}</div>
                <div class="card-description">${card.description}</div>
                <div class="card-footer">
                    <div class="card-rarity-indicator"></div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.card:not(.unplayable)').forEach(el => {
            el.addEventListener('click', () => {
                this.selectCard(el.dataset.cardId);
            });
        });
    }

    /**
     * Get card icon
     */
    getCardIcon(type) {
        const icons = {
            attack: '⚔️',
            skill: '🛡️',
            power: '⚡',
            corrupted: '👁️'
        };
        return icons[type] || '📜';
    }

    /**
     * Get current combat state for saving
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
        this.inCombat = savedState.inCombat;
        this.turn = savedState.turn;
        this.phase = savedState.phase;
        this.enemies = savedState.enemies;
        this.playerBlock = savedState.playerBlock;
        this.playerEnergy = savedState.playerEnergy;
        this.overheat = savedState.overheat;
        this.rage = savedState.rage;
        
        this.updateUI();
    }
}

export { CombatSystem };
