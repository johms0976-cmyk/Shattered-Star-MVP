/**
 * RestScreen - Handles rest site interactions
 * FIXED: Now properly initializes when screen becomes visible
 * FIXED: Correct button IDs matching HTML
 */

export function setupRestScreen(game) {
    const screen = document.getElementById('rest-screen');
    const healPercent = 0.30; // 30% heal
    
    console.log('[RestScreen] Setting up rest screen');
    
    // FIXED: Listen for screen:show event to initialize
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'rest-screen') {
            console.log('[RestScreen] Screen shown, initializing...');
            initializeRestScreen();
        }
    });
    
    // Also listen for screen:changed for compatibility
    game.eventBus.on('screen:changed', (data) => {
        const targetScreen = typeof data === 'string' ? data : (data?.to || data);
        if (targetScreen === 'rest-screen') {
            console.log('[RestScreen] Screen changed to rest, initializing...');
            initializeRestScreen();
        }
    });
    
    // Legacy event listener
    game.eventBus.on('rest:enter', () => {
        console.log('[RestScreen] rest:enter event received');
        initializeRestScreen();
    });
    
    function initializeRestScreen() {
        console.log('[RestScreen] Initializing rest options...');
        updateRestOptions();
        setupButtons();
    }
    
    function updateRestOptions() {
        const hp = game.state.get('hp') || 50;
        const maxHp = game.state.get('maxHp') || 80;
        const healAmount = Math.floor(maxHp * healPercent);
        const wouldHealTo = Math.min(maxHp, hp + healAmount);
        const actualHeal = wouldHealTo - hp;
        
        console.log(`[RestScreen] HP: ${hp}/${maxHp}, would heal: ${actualHeal}`);
        
        // FIXED: Correct button ID - btn-rest-heal
        const healBtn = document.getElementById('btn-rest-heal');
        if (healBtn) {
            healBtn.innerHTML = `
                <span class="option-icon">♥</span>
                <span class="option-text">REST</span>
                <span class="option-desc">Heal ${actualHeal} HP (${hp}→${wouldHealTo})</span>
            `;
            healBtn.disabled = hp >= maxHp;
            console.log('[RestScreen] Heal button updated');
        } else {
            console.warn('[RestScreen] Heal button not found (btn-rest-heal)');
        }
        
        // FIXED: Correct button ID - btn-rest-upgrade
        const upgradeBtn = document.getElementById('btn-rest-upgrade');
        if (upgradeBtn) {
            const deck = game.state.get('deck') || [];
            const upgradeable = deck.filter(c => !c.upgraded);
            upgradeBtn.innerHTML = `
                <span class="option-icon">⬆</span>
                <span class="option-text">UPGRADE</span>
                <span class="option-desc">Enhance a card (${upgradeable.length} available)</span>
            `;
            upgradeBtn.disabled = upgradeable.length === 0;
            console.log(`[RestScreen] Upgrade button updated (${upgradeable.length} upgradeable)`);
        } else {
            console.warn('[RestScreen] Upgrade button not found (btn-rest-upgrade)');
        }
        
        // Update current HP display if it exists
        const hpDisplay = document.getElementById('rest-hp-display');
        if (hpDisplay) {
            hpDisplay.textContent = `${hp}/${maxHp} HP`;
        }
    }
    
    function setupButtons() {
        // FIXED: Use correct button IDs
        const healBtn = document.getElementById('btn-rest-heal');
        const upgradeBtn = document.getElementById('btn-rest-upgrade');
        
        // Remove old listeners and add new ones
        if (healBtn) {
            const newHealBtn = healBtn.cloneNode(true);
            healBtn.parentNode.replaceChild(newHealBtn, healBtn);
            
            newHealBtn.addEventListener('click', () => {
                console.log('[RestScreen] Heal clicked');
                game.audioManager?.playSFX?.('ui_click');
                
                const hp = game.state.get('hp') || 50;
                const maxHp = game.state.get('maxHp') || 80;
                const healAmount = Math.floor(maxHp * healPercent);
                const newHp = Math.min(maxHp, hp + healAmount);
                
                game.state.set('hp', newHp);
                game.eventBus.emit('heal', newHp - hp);
                game.eventBus.emit('hp:changed', { current: newHp, max: maxHp });
                
                completeRest();
            });
        }
        
        if (upgradeBtn) {
            const newUpgradeBtn = upgradeBtn.cloneNode(true);
            upgradeBtn.parentNode.replaceChild(newUpgradeBtn, upgradeBtn);
            
            newUpgradeBtn.addEventListener('click', () => {
                console.log('[RestScreen] Upgrade clicked');
                game.audioManager?.playSFX?.('ui_click');
                showUpgradeSelection();
            });
        }
    }
    
    function showUpgradeSelection() {
        const deck = game.state.get('deck') || [];
        const upgradeable = deck.filter(c => !c.upgraded);
        
        if (upgradeable.length === 0) {
            console.log('[RestScreen] No cards to upgrade');
            completeRest();
            return;
        }
        
        // Create upgrade modal content
        const modal = document.getElementById('deck-modal');
        const content = document.getElementById('deck-view-cards') || document.getElementById('deck-cards');
        
        if (content) {
            content.innerHTML = `
                <h3 style="color: var(--color-highlight); margin-bottom: 1rem;">Select a card to upgrade</h3>
                <div class="upgrade-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
                    ${upgradeable.map(card => `
                        <div class="upgrade-card card type-${card.type || 'attack'}" data-instance="${card.instanceId}" style="cursor: pointer; padding: 1rem; border: 1px solid var(--color-accent); border-radius: 8px;">
                            <div class="card-cost" style="color: var(--color-energy);">${card.cost}</div>
                            <div class="card-name" style="font-weight: bold;">${card.name}</div>
                            <div class="card-description" style="font-size: 0.8em; opacity: 0.8;">${card.description || ''}</div>
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
            console.log(`[RestScreen] Upgrading card: ${card.name}`);
            
            // Apply upgrade
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
        console.log('[RestScreen] Rest complete, returning to map');
        game.mapGenerator.completeCurrentNode();
        game.eventBus.emit('map:updated');
        forceScreenTransition(game, 'map-screen');
    }
    
    /**
     * Force screen transition (same pattern as other screens)
     */
    function forceScreenTransition(game, targetScreenId) {
        console.log(`[RestScreen] forceScreenTransition to: ${targetScreenId}`);
        
        const restScreen = document.getElementById('rest-screen');
        const targetScreen = document.getElementById(targetScreenId);
        
        if (!targetScreen) {
            console.error(`[RestScreen] Target screen not found: ${targetScreenId}`);
            return;
        }
        
        // Hide the rest screen
        if (restScreen) {
            restScreen.classList.remove('active', 'fade-in');
            restScreen.style.cssText = '';
        }
        
        // Try normal ScreenManager transition
        try {
            if (game.screenManager) {
                game.screenManager.transitioning = false;
                game.screenManager.transitionTo(targetScreenId);
            }
        } catch (e) {
            console.error('[RestScreen] screenManager.transitionTo failed:', e);
        }
        
        // Force the transition
        setTimeout(() => {
            document.querySelectorAll('.screen').forEach(screen => {
                if (screen.id !== targetScreenId) {
                    screen.classList.remove('active', 'fade-in');
                    screen.style.cssText = '';
                }
            });
            
            targetScreen.classList.remove('fade-out');
            targetScreen.classList.add('active');
            targetScreen.style.cssText = `
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: 1000 !important;
                pointer-events: auto !important;
            `;
            
            if (game.screenManager) {
                game.screenManager.previousScreen = game.screenManager.currentScreen;
                game.screenManager.currentScreen = targetScreenId;
                game.screenManager.transitioning = false;
            }
            
            game.eventBus.emit('screen:changed', { to: targetScreenId, from: 'rest-screen' });
            game.eventBus.emit('screen:show', targetScreenId);
        }, 100);
    }
    
    return { updateRestOptions, upgradeCard, initializeRestScreen };
}
