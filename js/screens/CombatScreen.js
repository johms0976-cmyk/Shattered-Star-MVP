/**
 * CombatScreen - Combat screen handler
 * FIXED VERSION: All missing functions implemented, proper event handling
 * @version 0.2.2
 */

export function setupCombatScreen(game) {
    console.log('[CombatScreen] Setting up combat screen...');
    
    const btnEndTurn = document.getElementById('btn-end-turn');
    
    // End turn button
    if (btnEndTurn) {
        btnEndTurn.addEventListener('click', () => {
            // FIX: Check phase instead of isPlayerTurn for compatibility
            if (game.combat && (game.combat.isPlayerTurn || game.combat.phase === 'player')) {
                try {
                    game.audioManager.playSFX('ui_click');
                } catch (e) {}
                game.combat.endTurn();
            }
        });
    }
    
    // Draw pile click (view draw pile)
    const drawPile = document.getElementById('draw-pile');
    if (drawPile) {
        drawPile.addEventListener('click', () => {
            showPileView(game, 'draw');
        });
    }
    
    // Discard pile click (view discard pile)
    const discardPile = document.getElementById('discard-pile');
    if (discardPile) {
        discardPile.addEventListener('click', () => {
            showPileView(game, 'discard');
        });
    }
    
    // FIX: Handle multiple event formats for screen:changed
    game.eventBus.on('screen:changed', (data) => {
        const screenId = typeof data === 'string' ? data : (data?.to || data);
        if (screenId === 'combat-screen') {
            console.log('[CombatScreen] Screen changed to combat-screen, initializing UI...');
            // Small delay to ensure DOM is ready
            setTimeout(() => initCombatUI(game), 50);
        }
    });
    
    // Also listen for screen:show event
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'combat-screen') {
            console.log('[CombatScreen] screen:show event, initializing UI...');
            setTimeout(() => initCombatUI(game), 50);
        }
    });
    
    // Listen for combat start directly
    game.eventBus.on('combat:start', ({ enemies }) => {
        console.log('[CombatScreen] Combat started with enemies:', enemies);
        setTimeout(() => initCombatUI(game), 100);
    });
    
    // Listen for UI update requests
    game.eventBus.on('combat:ui:update', () => {
        updateAllUI(game);
    });
    
    // Listen for combat events
    setupCombatEventListeners(game);
    
    console.log('[CombatScreen] Setup complete');
}

function setupCombatEventListeners(game) {
    // Turn changes
    game.eventBus.on('turn:player', () => {
        const btn = document.getElementById('btn-end-turn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'END TURN';
        }
    });
    
    game.eventBus.on('turn:enemy', () => {
        const btn = document.getElementById('btn-end-turn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'ENEMY TURN...';
        }
    });
    
    // Card played
    game.eventBus.on('card:played', ({ card }) => {
        updateHandUI(game);
        updateEnergyUI(game);
        updatePileCounts(game);
    });
    
    // Hand updated
    game.eventBus.on('hand:updated', () => {
        updateHandUI(game);
    });
    
    // Enemy damaged
    game.eventBus.on('enemy:damaged', ({ enemy, damage }) => {
        showDamageNumber(enemy.instanceId || enemy.id, damage, 'damage');
        updateEnemyUI(game);
    });
    
    // Enemy defeated
    game.eventBus.on('enemy:defeated', ({ enemy }) => {
        const enemyEl = document.querySelector(`[data-enemy-id="${enemy.instanceId}"], [data-enemy-id="${enemy.id}"]`);
        if (enemyEl) {
            enemyEl.classList.add('defeated');
            setTimeout(() => enemyEl.remove(), 500);
        }
    });
    
    // Player damaged
    game.eventBus.on('player:damaged', ({ damage, blocked }) => {
        if (damage > 0) {
            showDamageNumber('player', damage, 'damage');
            shakeScreen();
        } else if (blocked > 0) {
            showDamageNumber('player', blocked, 'blocked');
        }
        updatePlayerUI(game);
    });
    
    // Block gained
    game.eventBus.on('block:gained', ({ amount }) => {
        updatePlayerUI(game);
        showFloatingText('player', `+${amount} Block`, 'block');
    });
    
    // Heal
    game.eventBus.on('heal', ({ amount }) => {
        updatePlayerUI(game);
        showFloatingText('player', `+${amount} HP`, 'heal');
    });
    
    // Overheat changed (Korvax)
    game.eventBus.on('overheat:changed', ({ current, max }) => {
        updateOverheatUI(current, max);
    });
    
    // Overheat triggered
    game.eventBus.on('overheat:triggered', ({ damage }) => {
        showFloatingText('player', `OVERHEAT! -${damage}`, 'overheat');
        shakeScreen();
    });
    
    // Combat victory
    game.eventBus.on('combat:victory', () => {
        showVictoryAnimation(game);
    });
    
    // Combat defeat
    game.eventBus.on('combat:defeat', () => {
        showDefeatAnimation(game);
    });
    
    // Card selected (for targeting)
    game.eventBus.on('card:selected', ({ card, index }) => {
        enterTargetingMode(game, index);
    });
}

/**
 * Initialize combat UI
 */
function initCombatUI(game) {
    console.log('[CombatScreen] Initializing combat UI...');
    
    if (!game.combat) {
        console.error('[CombatScreen] Combat system not available!');
        return;
    }
    
    updatePlayerUI(game);
    updateEnergyUI(game);
    updateHandUI(game);
    updateEnemyUI(game);
    updatePileCounts(game);
    
    // Show hero-specific UI elements
    const heroId = game.state.get('hero.id');
    if (heroId === 'korvax') {
        showOverheatBar(game);
    }
    
    // Enable end turn button
    const btn = document.getElementById('btn-end-turn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'END TURN';
    }
    
    console.log('[CombatScreen] Combat UI initialized');
}

/**
 * Update all UI elements
 */
function updateAllUI(game) {
    updatePlayerUI(game);
    updateEnergyUI(game);
    updateHandUI(game);
    updateEnemyUI(game);
    updatePileCounts(game);
}

/**
 * Update player UI
 */
function updatePlayerUI(game) {
    const hp = game.state.get('hero.hp') || 80;
    const maxHp = game.state.get('hero.maxHp') || 80;
    const block = game.combat ? game.combat.playerBlock : (game.state.get('hero.block') || 0);
    
    // Update HP bar
    const hpFill = document.getElementById('combat-hp-fill');
    if (hpFill) {
        const percentage = Math.max(0, Math.min(100, (hp / maxHp) * 100));
        hpFill.style.width = `${percentage}%`;
    }
    
    // Update HP text
    const hpText = document.getElementById('combat-hp-text');
    if (hpText) {
        hpText.textContent = `${hp}/${maxHp}`;
    }
    
    // Update block
    const blockValue = document.getElementById('combat-block');
    if (blockValue) {
        blockValue.textContent = block;
        const blockContainer = blockValue.parentElement;
        if (blockContainer) {
            blockContainer.style.display = block > 0 ? 'flex' : 'none';
        }
    }
}

/**
 * Update energy UI
 */
function updateEnergyUI(game) {
    // FIX: Get energy from combat system first, fallback to state
    const energy = game.combat ? game.combat.playerEnergy : (game.state.get('hero.energy') || 3);
    const maxEnergy = game.combat ? game.combat.maxEnergy : (game.state.get('hero.maxEnergy') || 3);
    
    const currentEl = document.getElementById('energy-current');
    const maxEl = document.getElementById('energy-max');
    
    if (currentEl) currentEl.textContent = energy;
    if (maxEl) maxEl.textContent = maxEnergy;
    
    // Visual feedback for energy state
    const energyDisplay = document.querySelector('.energy-display');
    if (energyDisplay) {
        energyDisplay.classList.remove('empty', 'low', 'full');
        if (energy === 0) {
            energyDisplay.classList.add('empty');
        } else if (energy === 1) {
            energyDisplay.classList.add('low');
        } else if (energy === maxEnergy) {
            energyDisplay.classList.add('full');
        }
    }
}

/**
 * Update hand UI
 */
function updateHandUI(game) {
    const handArea = document.getElementById('hand-area');
    if (!handArea) return;
    
    // FIX: Get hand from deck manager or combat system
    let hand = [];
    if (game.deck && typeof game.deck.getHand === 'function') {
        hand = game.deck.getHand() || [];
    } else if (game.combat && typeof game.combat.getHand === 'function') {
        hand = game.combat.getHand() || [];
    }
    
    const energy = game.combat ? game.combat.playerEnergy : (game.state.get('hero.energy') || 0);
    
    if (hand.length === 0) {
        handArea.innerHTML = '<div class="empty-hand">No cards in hand</div>';
        return;
    }
    
    handArea.innerHTML = hand.map((card, index) => `
        <div class="card-in-hand type-${card.type || 'skill'} rarity-${card.rarity || 'common'} ${card.cost > energy ? 'unplayable' : ''}"
             data-card-id="${card.instanceId || index}"
             data-card-index="${index}">
            <div class="card-cost">${card.cost || 0}</div>
            <div class="card-art">${getCardIcon(card.type)}</div>
            <div class="card-name">${card.name || 'Unknown'}</div>
            <div class="card-description">${card.description || ''}</div>
        </div>
    `).join('');
    
    // Add click handlers
    handArea.querySelectorAll('.card-in-hand:not(.unplayable)').forEach((cardEl, index) => {
        cardEl.addEventListener('click', () => {
            handleCardClick(game, index);
        });
    });
}

/**
 * Handle card click
 */
function handleCardClick(game, cardIndex) {
    if (!game.combat || game.combat.phase !== 'player') return;
    
    const hand = game.deck ? game.deck.getHand() : [];
    const card = hand[cardIndex];
    if (!card) return;
    
    // Check if attack card needs targeting
    const enemies = game.combat.enemies.filter(e => e.hp > 0);
    
    if (card.type === 'attack' && enemies.length > 1) {
        // Need to select target
        enterTargetingMode(game, cardIndex);
    } else {
        // Auto-target or self-targeting card
        const targetId = enemies.length > 0 ? (enemies[0].instanceId || enemies[0].id) : null;
        game.combat.playCard(cardIndex, targetId);
    }
}

/**
 * Enter targeting mode
 */
function enterTargetingMode(game, cardIndex) {
    const handArea = document.getElementById('hand-area');
    const enemyArea = document.getElementById('enemy-area');
    
    // Highlight the selected card
    handArea.querySelectorAll('.card-in-hand').forEach((c, i) => {
        c.classList.toggle('selected', i === cardIndex);
    });
    
    // Make enemies targetable
    enemyArea.querySelectorAll('.enemy:not(.defeated)').forEach(enemyEl => {
        enemyEl.classList.add('targetable');
        
        const clickHandler = () => {
            const targetId = enemyEl.dataset.enemyId;
            game.combat.playCard(cardIndex, targetId);
            exitTargetingMode();
        };
        
        enemyEl.addEventListener('click', clickHandler, { once: true });
    });
    
    // Cancel targeting on right-click or escape
    const cancelHandler = (e) => {
        if (e.type === 'contextmenu' || e.key === 'Escape') {
            e.preventDefault();
            exitTargetingMode();
        }
    };
    
    document.addEventListener('contextmenu', cancelHandler, { once: true });
    document.addEventListener('keydown', cancelHandler, { once: true });
}

/**
 * Exit targeting mode
 */
function exitTargetingMode() {
    document.querySelectorAll('.card-in-hand').forEach(c => {
        c.classList.remove('selected');
    });
    document.querySelectorAll('.enemy').forEach(e => {
        e.classList.remove('targetable');
    });
}

/**
 * Update enemy UI
 */
function updateEnemyUI(game) {
    const enemyArea = document.getElementById('enemy-area');
    if (!enemyArea) return;
    
    const enemies = game.combat ? game.combat.enemies : [];
    
    if (!enemies || enemies.length === 0) {
        enemyArea.innerHTML = '<div class="no-enemies">No enemies</div>';
        return;
    }
    
    enemyArea.innerHTML = enemies.map(enemy => {
        // FIX: Handle both hp/currentHp property names
        const currentHp = enemy.hp || enemy.currentHp || 0;
        const maxHp = enemy.maxHp || enemy.hp || 20;
        const hpPercent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
        const isDead = currentHp <= 0;
        
        return `
            <div class="enemy ${isDead ? 'defeated' : ''}" 
                 data-enemy-id="${enemy.instanceId || enemy.id}">
                <div class="enemy-intent">
                    ${renderIntent(enemy.intent || enemy.currentIntent)}
                </div>
                <div class="enemy-sprite ${enemy.id || ''}">
                    <div class="enemy-image">${getEnemyIcon(enemy.type)}</div>
                </div>
                <div class="enemy-info">
                    <div class="enemy-name">${enemy.name || 'Enemy'}</div>
                    <div class="enemy-hp-bar">
                        <div class="enemy-hp-fill" style="width: ${hpPercent}%"></div>
                        <span class="enemy-hp-text">${currentHp}/${maxHp}</span>
                    </div>
                    ${enemy.block > 0 ? `<div class="enemy-block">🛡 ${enemy.block}</div>` : ''}
                    ${renderStatusEffects(enemy.statusEffects)}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render intent indicator
 */
function renderIntent(intent) {
    if (!intent) return '<span class="intent-unknown">?</span>';
    
    const intentIcons = {
        attack: '⚔️',
        block: '🛡️',
        defend: '🛡️',
        buff: '⬆️',
        debuff: '⬇️',
        heal: '💚',
        charge: '⚡',
        unknown: '❓'
    };
    
    const icon = intentIcons[intent.type] || intentIcons.unknown;
    const value = intent.damage || intent.value || intent.block || '';
    const times = intent.times > 1 ? ` x${intent.times}` : '';
    
    return `<span class="intent-${intent.type}">${icon} ${value}${times}</span>`;
}

/**
 * Render status effects
 */
function renderStatusEffects(effects) {
    if (!effects || effects.length === 0) return '';
    
    const icons = {
        strength: '💪',
        vulnerable: '🎯',
        weak: '📉',
        poison: '☠️',
        burn: '🔥',
        bleed: '🩸',
        shield: '🛡️',
        regen: '💚'
    };
    
    return `<div class="status-effects">
        ${effects.map(s => `
            <span class="status-effect status-${s.effect}" title="${s.effect}: ${s.value}">
                ${icons[s.effect] || '•'} ${s.value}
            </span>
        `).join('')}
    </div>`;
}

/**
 * Update pile counts
 */
function updatePileCounts(game) {
    const drawCount = document.getElementById('draw-count');
    const discardCount = document.getElementById('discard-count');
    
    if (game.deck) {
        if (drawCount) {
            const count = game.deck.drawPile ? game.deck.drawPile.length : 0;
            drawCount.textContent = count;
        }
        if (discardCount) {
            const count = game.deck.discardPile ? game.deck.discardPile.length : 0;
            discardCount.textContent = count;
        }
    }
}

/**
 * Show pile view modal
 */
function showPileView(game, pileType) {
    const modal = document.getElementById('pile-modal') || createPileModal();
    const title = modal.querySelector('.modal-title') || modal.querySelector('h3');
    const content = modal.querySelector('.pile-content') || modal.querySelector('.modal-body');
    
    let cards = [];
    if (game.deck) {
        if (pileType === 'draw') {
            cards = game.deck.drawPile || [];
            if (title) title.textContent = 'Draw Pile';
        } else {
            cards = game.deck.discardPile || [];
            if (title) title.textContent = 'Discard Pile';
        }
    }
    
    if (content) {
        if (cards.length === 0) {
            content.innerHTML = '<p class="empty-pile">No cards</p>';
        } else {
            content.innerHTML = cards.map(card => `
                <div class="pile-card type-${card.type || 'skill'}">
                    <span class="card-cost">${card.cost || 0}</span>
                    <span class="card-name">${card.name || 'Unknown'}</span>
                </div>
            `).join('');
        }
    }
    
    modal.classList.add('active');
}

/**
 * Create pile modal if it doesn't exist
 */
function createPileModal() {
    const modal = document.createElement('div');
    modal.id = 'pile-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3 class="modal-title">Pile</h3>
            <div class="pile-content modal-body"></div>
            <button class="btn-close-modal">Close</button>
        </div>
    `;
    
    modal.querySelector('.btn-close-modal').addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    document.body.appendChild(modal);
    return modal;
}

/**
 * Show damage number animation
 */
function showDamageNumber(targetId, amount, type = 'damage') {
    const targetEl = targetId === 'player' 
        ? document.getElementById('player-character')
        : document.querySelector(`[data-enemy-id="${targetId}"]`);
    
    if (!targetEl) return;
    
    const dmgEl = document.createElement('div');
    dmgEl.className = `damage-number ${type}`;
    dmgEl.textContent = type === 'blocked' ? `Blocked ${amount}` : `-${amount}`;
    
    // Position relative to target
    const rect = targetEl.getBoundingClientRect();
    dmgEl.style.position = 'fixed';
    dmgEl.style.left = `${rect.left + rect.width / 2}px`;
    dmgEl.style.top = `${rect.top}px`;
    dmgEl.style.transform = 'translateX(-50%)';
    dmgEl.style.zIndex = '1000';
    dmgEl.style.fontSize = '2rem';
    dmgEl.style.fontWeight = 'bold';
    dmgEl.style.color = type === 'damage' ? '#ff4444' : type === 'blocked' ? '#4488ff' : '#ffaa00';
    dmgEl.style.textShadow = '2px 2px 4px black';
    dmgEl.style.pointerEvents = 'none';
    
    document.body.appendChild(dmgEl);
    
    // Animate
    dmgEl.animate([
        { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
        { opacity: 0, transform: 'translateX(-50%) translateY(-50px)' }
    ], {
        duration: 1000,
        easing: 'ease-out'
    }).onfinish = () => dmgEl.remove();
}

/**
 * Show floating text
 */
function showFloatingText(targetId, text, type = 'info') {
    const targetEl = targetId === 'player' 
        ? document.getElementById('player-character')
        : document.querySelector(`[data-enemy-id="${targetId}"]`);
    
    if (!targetEl) return;
    
    const textEl = document.createElement('div');
    textEl.className = `floating-text ${type}`;
    textEl.textContent = text;
    
    const rect = targetEl.getBoundingClientRect();
    textEl.style.position = 'fixed';
    textEl.style.left = `${rect.left + rect.width / 2}px`;
    textEl.style.top = `${rect.top - 20}px`;
    textEl.style.transform = 'translateX(-50%)';
    textEl.style.zIndex = '1000';
    textEl.style.fontSize = '1.2rem';
    textEl.style.fontWeight = 'bold';
    textEl.style.pointerEvents = 'none';
    
    const colors = {
        block: '#4488ff',
        heal: '#44ff44',
        info: '#ffffff',
        overheat: '#ff8800'
    };
    textEl.style.color = colors[type] || '#ffffff';
    textEl.style.textShadow = '2px 2px 4px black';
    
    document.body.appendChild(textEl);
    
    textEl.animate([
        { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
        { opacity: 0, transform: 'translateX(-50%) translateY(-40px)' }
    ], {
        duration: 1200,
        easing: 'ease-out'
    }).onfinish = () => textEl.remove();
}

/**
 * Shake screen effect
 */
function shakeScreen() {
    const combatScreen = document.getElementById('combat-screen');
    if (!combatScreen) return;
    
    combatScreen.classList.add('shake');
    setTimeout(() => combatScreen.classList.remove('shake'), 300);
}

/**
 * Show overheat bar (Korvax specific)
 */
function showOverheatBar(game) {
    let overheatContainer = document.getElementById('overheat-container');
    
    if (!overheatContainer) {
        overheatContainer = document.createElement('div');
        overheatContainer.id = 'overheat-container';
        overheatContainer.className = 'overheat-bar-container';
        overheatContainer.innerHTML = `
            <div class="overheat-label">OVERHEAT</div>
            <div class="overheat-bar">
                <div class="overheat-fill" id="overheat-fill"></div>
            </div>
            <div class="overheat-value"><span id="overheat-current">0</span>/<span id="overheat-max">10</span></div>
        `;
        
        const playerArea = document.querySelector('.player-area');
        if (playerArea) {
            playerArea.appendChild(overheatContainer);
        }
    }
    
    const current = game.combat ? game.combat.overheat : 0;
    const max = game.combat ? game.combat.maxOverheat : 10;
    updateOverheatUI(current, max);
}

/**
 * Update overheat UI
 */
function updateOverheatUI(current, max) {
    const fill = document.getElementById('overheat-fill');
    const currentEl = document.getElementById('overheat-current');
    const maxEl = document.getElementById('overheat-max');
    
    if (fill) {
        const percent = (current / max) * 100;
        fill.style.width = `${percent}%`;
        
        // Change color based on level
        if (percent >= 80) {
            fill.style.backgroundColor = '#ff4444';
        } else if (percent >= 50) {
            fill.style.backgroundColor = '#ff8800';
        } else {
            fill.style.backgroundColor = '#ffcc00';
        }
    }
    
    if (currentEl) currentEl.textContent = current;
    if (maxEl) maxEl.textContent = max;
}

/**
 * Show victory animation
 */
function showVictoryAnimation(game) {
    const overlay = document.createElement('div');
    overlay.className = 'combat-result-overlay victory';
    overlay.innerHTML = `
        <div class="result-content">
            <h2>VICTORY!</h2>
            <p>All enemies defeated</p>
            <button class="btn-continue">Continue</button>
        </div>
    `;
    
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;
    
    const content = overlay.querySelector('.result-content');
    content.style.cssText = `
        text-align: center;
        color: #44ff44;
        font-size: 2rem;
    `;
    
    const btn = overlay.querySelector('.btn-continue');
    btn.style.cssText = `
        margin-top: 20px;
        padding: 15px 30px;
        font-size: 1.2rem;
        cursor: pointer;
        background: #44aa44;
        border: none;
        color: white;
        border-radius: 5px;
    `;
    
    btn.addEventListener('click', () => {
        overlay.remove();
        // Transition to reward screen or map
        if (game.screenManager) {
            game.screenManager.transitionTo('reward-screen');
        }
    });
    
    document.body.appendChild(overlay);
}

/**
 * Show defeat animation
 */
function showDefeatAnimation(game) {
    const overlay = document.createElement('div');
    overlay.className = 'combat-result-overlay defeat';
    overlay.innerHTML = `
        <div class="result-content">
            <h2>DEFEATED</h2>
            <p>Your journey ends here...</p>
            <button class="btn-restart">Return to Title</button>
        </div>
    `;
    
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;
    
    const content = overlay.querySelector('.result-content');
    content.style.cssText = `
        text-align: center;
        color: #ff4444;
        font-size: 2rem;
    `;
    
    const btn = overlay.querySelector('.btn-restart');
    btn.style.cssText = `
        margin-top: 20px;
        padding: 15px 30px;
        font-size: 1.2rem;
        cursor: pointer;
        background: #aa4444;
        border: none;
        color: white;
        border-radius: 5px;
    `;
    
    btn.addEventListener('click', () => {
        overlay.remove();
        if (game.screenManager) {
            game.screenManager.transitionTo('title-screen');
        }
    });
    
    document.body.appendChild(overlay);
}

/**
 * Get card icon
 */
function getCardIcon(type) {
    const icons = {
        attack: '⚔️',
        skill: '🛡️',
        power: '⚡',
        corrupted: '👁️',
        curse: '💀'
    };
    return icons[type] || '📜';
}

/**
 * Get enemy icon
 */
function getEnemyIcon(type) {
    const icons = {
        basic: '👹',
        elite: '💀',
        boss: '👿',
        swarm: '🐀',
        construct: '🤖'
    };
    return icons[type] || '👾';
}
