/**
 * RestScreen - Handles rest site interactions
 */

export function setupRestScreen(game) {
    const screen = document.getElementById('rest-screen');
    
    const healPercent = 0.30; // 30% heal
    
    // Listen for rest events
    game.eventBus.on('rest:enter', () => updateRestOptions());
    
    function updateRestOptions() {
        const hp = game.state.get('hp');
        const maxHp = game.state.get('maxHp');
        const healAmount = Math.floor(maxHp * healPercent);
        const wouldHealTo = Math.min(maxHp, hp + healAmount);
        const actualHeal = wouldHealTo - hp;
        
        // Update heal button text
        const healBtn = document.getElementById('rest-heal');
        if (healBtn) {
            healBtn.innerHTML = `
                <span class="rest-icon">❤️</span>
                <span class="rest-action">Rest</span>
                <span class="rest-desc">Heal ${actualHeal} HP (${hp}→${wouldHealTo})</span>
            `;
            healBtn.disabled = hp >= maxHp;
        }
        
        // Update upgrade button
        const upgradeBtn = document.getElementById('rest-upgrade');
        if (upgradeBtn) {
            const deck = game.state.get('deck') || [];
            const upgradeable = deck.filter(c => !c.upgraded);
            upgradeBtn.innerHTML = `
                <span class="rest-icon">⚡</span>
                <span class="rest-action">Smith</span>
                <span class="rest-desc">Upgrade a card (${upgradeable.length} available)</span>
            `;
            upgradeBtn.disabled = upgradeable.length === 0;
        }
        
        // Update current HP display
        const hpDisplay = document.getElementById('rest-hp-display');
        if (hpDisplay) {
            hpDisplay.textContent = `${hp}/${maxHp} HP`;
        }
    }
    
    // Rest/Heal action
    const healBtn = document.getElementById('rest-heal');
    if (healBtn) {
        healBtn.addEventListener('click', () => {
            const hp = game.state.get('hp');
            const maxHp = game.state.get('maxHp');
            const healAmount = Math.floor(maxHp * healPercent);
            const newHp = Math.min(maxHp, hp + healAmount);
            
            game.state.set('hp', newHp);
            game.eventBus.emit('heal', newHp - hp);
            
            completeRest();
        });
    }
    
    // Upgrade action
    const upgradeBtn = document.getElementById('rest-upgrade');
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', () => {
            showUpgradeSelection();
        });
    }
    
    function showUpgradeSelection() {
        const deck = game.state.get('deck') || [];
        const upgradeable = deck.filter(c => !c.upgraded);
        
        // Create upgrade modal content
        const modal = document.getElementById('deck-modal');
        const content = document.getElementById('deck-cards');
        
        if (content) {
            content.innerHTML = `
                <h3 style="color: var(--color-highlight); margin-bottom: 1rem;">Select a card to upgrade</h3>
                <div class="upgrade-grid">
                    ${upgradeable.map(card => `
                        <div class="upgrade-card card type-${card.type}" data-instance="${card.instanceId}">
                            <div class="card-cost">${card.cost}</div>
                            <div class="card-name">${card.name}</div>
                            <div class="card-description">${card.description}</div>
                            ${card.upgraded ? '<div class="upgraded-badge">+</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Add click handlers
            content.querySelectorAll('.upgrade-card').forEach(el => {
                el.addEventListener('click', () => {
                    upgradeCard(el.dataset.instance);
                    game.screenManager.hideModal('deck-modal');
                });
            });
        }
        
        game.screenManager.showModal('deck-modal');
    }
    
    function upgradeCard(instanceId) {
        const deck = game.state.get('deck') || [];
        const card = deck.find(c => c.instanceId === instanceId);
        
        if (card && !card.upgraded) {
            // Apply upgrade (simple version: +25% values)
            card.upgraded = true;
            card.name = card.name + '+';
            
            if (card.damage) card.damage = Math.floor(card.damage * 1.25);
            if (card.block) card.block = Math.floor(card.block * 1.25);
            if (card.cost > 0 && Math.random() < 0.3) card.cost = Math.max(0, card.cost - 1);
            
            game.state.set('deck', deck);
            game.eventBus.emit('card:upgraded', card);
        }
        
        completeRest();
    }
    
    function completeRest() {
        game.mapGenerator.completeCurrentNode();
        game.screenManager.transitionTo('map-screen');
    }
    
    return { updateRestOptions, upgradeCard };
}
