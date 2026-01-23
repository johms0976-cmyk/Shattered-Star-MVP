/**
 * CombatScreen - Combat screen handler
 */

export function setupCombatScreen(game) {
    const btnEndTurn = document.getElementById('btn-end-turn');
    
    // End turn button
    if (btnEndTurn) {
        btnEndTurn.addEventListener('click', () => {
            if (game.combat.isPlayerTurn) {
                game.audioManager.playSFX('ui_click');
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
    
    // Setup when screen is shown
    game.eventBus.on('screen:changed', ({ to }) => {
        if (to === 'combat-screen') {
            initCombatUI(game);
        }
    });
    
    // Listen for combat events
    setupCombatEventListeners(game);
}

function setupCombatEventListeners(game) {
    // Turn changes
    game.eventBus.on('turn:player', () => {
        document.getElementById('btn-end-turn').disabled = false;
        document.getElementById('btn-end-turn').textContent = 'END TURN';
    });
    
    game.eventBus.on('turn:enemy', () => {
        document.getElementById('btn-end-turn').disabled = true;
        document.getElementById('btn-end-turn').textContent = 'ENEMY TURN...';
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
        showDamageNumber(enemy.id, damage, 'damage');
        updateEnemyUI(game);
    });
    
    // Enemy defeated
    game.eventBus.on('enemy:defeated', ({ enemy }) => {
        const enemyEl = document.querySelector(`[data-enemy-id="${enemy.id}"]`);
        if (enemyEl) {
            enemyEl.classList.add('defeated');
            setTimeout(() => enemyEl.remove(), 500);
        }
    });
    
    // Player damaged
    game.eventBus.on('player:damaged', ({ damage, blocked }) => {
        showDamageNumber('player', damage, blocked > 0 ? 'blocked' : 'damage');
        updatePlayerUI(game);
        shakeScreen();
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
    
    // Combat victory
    game.eventBus.on('combat:victory', () => {
        showVictoryAnimation();
    });
}

function initCombatUI(game) {
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
}

function updatePlayerUI(game) {
    const hp = game.state.get('hero.hp');
    const maxHp = game.state.get('hero.maxHp');
    const block = game.state.get('hero.block') || 0;
    
    // Update HP bar
    const hpFill = document.getElementById('combat-hp-fill');
    if (hpFill) {
        hpFill.style.width = `${(hp / maxHp) * 100}%`;
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
        blockValue.parentElement.style.display = block > 0 ? 'flex' : 'none';
    }
}

function updateEnergyUI(game) {
    const energy = game.state.get('hero.energy');
    const maxEnergy = game.state.get('hero.maxEnergy');
    
    document.getElementById('energy-current').textContent = energy;
    document.getElementById('energy-max').textContent = maxEnergy;
    
    // Visual feedback for energy state
    const energyDisplay = document.querySelector('.energy-display');
    if (energyDisplay) {
        energyDisplay.classList.toggle('empty', energy === 0);
        energyDisplay.classList.toggle('low', energy === 1);
    }
}

function updateHandUI(game) {
    const handArea = document.getElementById('hand-area');
    const hand = game.deck.hand || [];
    const energy = game.state.get('hero.energy');
    
    handArea.innerHTML = hand.map((card, index) => `
        <div class="card-in-hand type-${card.type} rarity-${card.rarity} ${card.cost > energy ? 'unplayable' : ''}" 
             data-card-index="${index}"
             data-card-id="${card.instanceId}">
            <div class="card-cost">${card.cost}</div>
            <div class="card-type-indicator"></div>
            <div class="card-art">${getCardIcon(card.type)}</div>
            <div class="card-name">${card.name}</div>
            <div class="card-description">${formatCardDescription(card, game)}</div>
            <div class="card-footer">
                <div class="card-rarity-indicator"></div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers to cards
    handArea.querySelectorAll('.card-in-hand:not(.unplayable)').forEach(cardEl => {
        cardEl.addEventListener('click', () => {
            const cardIndex = parseInt(cardEl.dataset.cardIndex);
            handleCardClick(game, cardIndex);
        });
        
        // Hover effects
        cardEl.addEventListener('mouseenter', () => {
            cardEl.classList.add('hovered');
        });
        
        cardEl.addEventListener('mouseleave', () => {
            cardEl.classList.remove('hovered');
        });
    });
}

function handleCardClick(game, cardIndex) {
    const card = game.deck.hand[cardIndex];
    if (!card) return;
    
    const enemies = game.combat.enemies;
    
    // Check if card needs a target
    if (card.targetRequired && enemies.length > 1) {
        // Enter targeting mode
        enterTargetingMode(game, cardIndex);
    } else {
        // Play card (auto-target first enemy if needed)
        const targetId = enemies.length > 0 ? enemies[0].id : null;
        game.combat.playCard(cardIndex, targetId);
    }
}

function enterTargetingMode(game, cardIndex) {
    const handArea = document.getElementById('hand-area');
    const enemyArea = document.getElementById('enemy-area');
    
    // Highlight the selected card
    handArea.querySelectorAll('.card-in-hand').forEach((c, i) => {
        c.classList.toggle('selected', i === cardIndex);
    });
    
    // Make enemies targetable
    enemyArea.querySelectorAll('.enemy').forEach(enemyEl => {
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

function exitTargetingMode() {
    document.querySelectorAll('.card-in-hand').forEach(c => {
        c.classList.remove('selected');
    });
    document.querySelectorAll('.enemy').forEach(e => {
        e.classList.remove('targetable');
    });
}

function updateEnemyUI(game) {
    const enemyArea = document.getElementById('enemy-area');
    const enemies = game.combat.enemies || [];
    
    enemyArea.innerHTML = enemies.map(enemy => `
        <div class="enemy" data-enemy-id="${enemy.id}">
            <div class="enemy-intent">
                ${renderIntent(enemy.intent)}
            </div>
            <div class="enemy-sprite ${enemy.id}">
                <div class="enemy-image"></div>
            </div>
            <div class="enemy-info">
                <div class="enemy-name">${enemy.name}</div>
                <div class="enemy-hp-bar">
                    <div class="enemy-hp-fill" style="width: ${(enemy.hp / enemy.maxHp) * 100}%"></div>
                    <span class="enemy-hp-text">${enemy.hp}/${enemy.maxHp}</span>
                </div>
                ${enemy.block > 0 ? `<div class="enemy-block">🛡 ${enemy.block}</div>` : ''}
                ${renderStatusEffects(enemy.statusEffects)}
            </div>
        </div>
    `).join('');
}

function renderIntent(intent) {
    if (!intent) return '';
    
    const intentIcons = {
        attack: '⚔️',
        block: '🛡️',
        buff: '⬆️',
        debuff: '⬇️',
        heal: '💚',
        charge: '⚡',
        unknown: '❓'
    };
    
    const icon = intentIcons[intent.type] || intentIcons.unknown;
    const value = intent.value ? ` ${intent.value}` : '';
    const multi = intent.times > 1 ? ` x${intent.times}` : '';
    
    return `
        <div class="intent-icon intent-${intent.type}">
            ${icon}${value}${multi}
        </div>
    `;
}

function renderStatusEffects(effects) {
    if (!effects || effects.length === 0) return '';
    
    return `
        <div class="status-effects">
            ${effects.map(e => `
                <span class="status-effect status-${e.type}" title="${e.name}: ${e.description}">
                    ${getStatusIcon(e.type)} ${e.stacks || ''}
                </span>
            `).join('')}
        </div>
    `;
}

function getStatusIcon(type) {
    const icons = {
        vulnerable: '💔',
        weak: '📉',
        strength: '💪',
        poison: '☠️',
        burn: '🔥',
        bleed: '🩸',
        regen: '💚'
    };
    return icons[type] || '•';
}

function updatePileCounts(game) {
    const drawCount = game.deck.drawPile?.length || 0;
    const discardCount = game.deck.discardPile?.length || 0;
    
    document.querySelector('#draw-pile .pile-count').textContent = drawCount;
    document.querySelector('#discard-pile .pile-count').textContent = discardCount;
}

function showOverheatBar(game) {
    let overheatUI = document.getElementById('overheat-ui');
    if (!overheatUI) {
        overheatUI = document.createElement('div');
        overheatUI.id = 'overheat-ui';
        overheatUI.className = 'overheat-bar';
        overheatUI.innerHTML = `
            <div class="overheat-label">OVERHEAT</div>
            <div class="overheat-track">
                <div class="overheat-fill" id="overheat-fill"></div>
                <div class="overheat-segments"></div>
            </div>
            <div class="overheat-value"><span id="overheat-value">0</span>/10</div>
        `;
        document.querySelector('.combat-ui').prepend(overheatUI);
    }
    
    const overheat = game.state.get('hero.overheat') || 0;
    updateOverheatUI(overheat, 10);
}

function updateOverheatUI(current, max) {
    const fill = document.getElementById('overheat-fill');
    const value = document.getElementById('overheat-value');
    
    if (fill) {
        fill.style.width = `${(current / max) * 100}%`;
        
        // Color based on level
        if (current >= 8) {
            fill.className = 'overheat-fill critical';
        } else if (current >= 5) {
            fill.className = 'overheat-fill warning';
        } else {
            fill.className = 'overheat-fill';
        }
    }
    
    if (value) {
        value.textContent = current;
    }
}

function getCardIcon(type) {
    const icons = {
        attack: '⚔️',
        skill: '🛡️',
        power: '⚡',
        corrupted: '👁️'
    };
    return icons[type] || '📜';
}

function formatCardDescription(card, game) {
    let desc = card.description;
    
    // Replace dynamic values
    if (card.damage) {
        let damage = card.damage;
        // Apply overheat bonus for Korvax
        if (game.state.get('hero.id') === 'korvax') {
            const overheat = game.state.get('hero.overheat') || 0;
            if (card.overheeatScaling) {
                damage += overheat;
            }
        }
        desc = desc.replace('{damage}', damage);
    }
    
    if (card.block) {
        desc = desc.replace('{block}', card.block);
    }
    
    return desc;
}

function showDamageNumber(targetId, amount, type) {
    const targetEl = targetId === 'player' 
        ? document.getElementById('player-character')
        : document.querySelector(`[data-enemy-id="${targetId}"]`);
    
    if (!targetEl) return;
    
    const rect = targetEl.getBoundingClientRect();
    const damageNum = document.createElement('div');
    damageNum.className = `damage-number ${type}`;
    damageNum.textContent = type === 'blocked' ? `Blocked!` : `-${amount}`;
    damageNum.style.left = `${rect.left + rect.width / 2}px`;
    damageNum.style.top = `${rect.top}px`;
    
    document.body.appendChild(damageNum);
    
    setTimeout(() => damageNum.remove(), 1000);
}

function showFloatingText(targetId, text, type) {
    const targetEl = targetId === 'player'
        ? document.getElementById('player-character')
        : document.querySelector(`[data-enemy-id="${targetId}"]`);
    
    if (!targetEl) return;
    
    const rect = targetEl.getBoundingClientRect();
    const floatText = document.createElement('div');
    floatText.className = `floating-text ${type}`;
    floatText.textContent = text;
    floatText.style.left = `${rect.left + rect.width / 2}px`;
    floatText.style.top = `${rect.top - 20}px`;
    
    document.body.appendChild(floatText);
    
    setTimeout(() => floatText.remove(), 1000);
}

function shakeScreen() {
    const settings = JSON.parse(localStorage.getItem('shattered-star-settings') || '{}');
    if (settings.screenShake === false) return;
    
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 200);
}

function showVictoryAnimation() {
    const overlay = document.createElement('div');
    overlay.className = 'victory-overlay';
    overlay.innerHTML = '<div class="victory-text">VICTORY!</div>';
    document.getElementById('combat-screen').appendChild(overlay);
    
    setTimeout(() => overlay.remove(), 1500);
}

function showPileView(game, pileType) {
    const pile = pileType === 'draw' ? game.deck.drawPile : game.deck.discardPile;
    const title = pileType === 'draw' ? 'Draw Pile' : 'Discard Pile';
    
    // Create pile view modal
    let modal = document.getElementById('pile-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pile-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content pile-view">
                <div class="modal-header">
                    <h2 id="pile-title"></h2>
                    <button class="close-btn" id="btn-close-pile">×</button>
                </div>
                <div class="pile-cards" id="pile-cards"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('btn-close-pile').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    document.getElementById('pile-title').textContent = `${title} (${pile.length})`;
    document.getElementById('pile-cards').innerHTML = pile.map(card => `
        <div class="card type-${card.type} rarity-${card.rarity}">
            <div class="card-cost">${card.cost}</div>
            <div class="card-name">${card.name}</div>
        </div>
    `).join('');
    
    modal.classList.add('active');
}
