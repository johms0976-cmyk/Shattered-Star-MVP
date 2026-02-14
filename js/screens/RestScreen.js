/**
 * RestScreen - Handles rest site interactions
 * FIXED: Now properly initializes when screen becomes visible
 * FIXED: Correct button IDs matching HTML
 * FIXED: Added upgrade preview showing before/after stats
 * @version 0.2.2
 */

export function setupRestScreen(game) {
    const screen = document.getElementById('rest-screen');
    const healPercent = 0.30; // 30% heal
    
    console.log('[RestScreen] Setting up rest screen v0.2.2');
    
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
        const hp = game.state.get('hero.hp') || 50;
        const maxHp = game.state.get('hero.maxHp') || 80;
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
                
                const hp = game.state.get('hero.hp') || 50;
                const maxHp = game.state.get('hero.maxHp') || 80;
                const healAmount = Math.floor(maxHp * healPercent);
                const newHp = Math.min(maxHp, hp + healAmount);
                
                game.state.set('hero.hp', newHp);
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
    
    /**
     * Calculate what a card's stats will be after upgrade
     */
    function calculateUpgradedStats(card) {
        const upgraded = {
            name: card.name + '+',
            cost: card.cost,
            damage: card.damage,
            block: card.block,
            draw: card.draw,
            heal: card.heal,
            description: card.description
        };
        
        // Damage increase: +25% (rounded up)
        if (card.damage && card.damage > 0) {
            upgraded.damage = Math.ceil(card.damage * 1.25);
        }
        
        // Block increase: +25% (rounded up)
        if (card.block && card.block > 0) {
            upgraded.block = Math.ceil(card.block * 1.25);
        }
        
        // Draw increase: +1 if card draws
        if (card.draw && card.draw > 0) {
            upgraded.draw = card.draw + 1;
        }
        
        // Heal increase: +25%
        if (card.heal && card.heal > 0) {
            upgraded.heal = Math.ceil(card.heal * 1.25);
        }
        
        // Cost reduction: 30% chance, but only if cost > 0
        // For preview, we'll show potential cost reduction
        if (card.cost > 0) {
            // Show as "may reduce cost" rather than guaranteeing it
            upgraded.costMayReduce = true;
        }
        
        // Build upgraded description
        upgraded.description = buildUpgradedDescription(card, upgraded);
        
        return upgraded;
    }
    
    /**
     * Build a description showing the upgraded effects
     */
    function buildUpgradedDescription(original, upgraded) {
        const parts = [];
        
        if (upgraded.damage && original.damage) {
            parts.push(`Deal ${upgraded.damage} damage`);
        }
        
        if (upgraded.block && original.block) {
            parts.push(`Gain ${upgraded.block} Block`);
        }
        
        if (upgraded.draw && original.draw) {
            parts.push(`Draw ${upgraded.draw} card${upgraded.draw > 1 ? 's' : ''}`);
        }
        
        if (upgraded.heal && original.heal) {
            parts.push(`Heal ${upgraded.heal} HP`);
        }
        
        // Keep other effects from original description that aren't stat-based
        if (original.applyVulnerable) {
            parts.push(`Apply ${original.applyVulnerable} Vulnerable`);
        }
        
        if (original.applyWeak) {
            parts.push(`Apply ${original.applyWeak} Weak`);
        }
        
        return parts.length > 0 ? parts.join('. ') + '.' : original.description;
    }
    
    /**
     * Format stat change for display
     */
    function formatStatChange(label, oldVal, newVal) {
        if (!oldVal && !newVal) return '';
        if (oldVal === newVal) return `<span class="stat-unchanged">${label}: ${oldVal}</span>`;
        return `<span class="stat-improved">${label}: ${oldVal} → <strong>${newVal}</strong></span>`;
    }
    
    function showUpgradeSelection() {
        const deck = game.state.get('deck') || [];
        const upgradeable = deck.filter(c => !c.upgraded);
        
        if (upgradeable.length === 0) {
            console.log('[RestScreen] No cards to upgrade');
            completeRest();
            return;
        }
        
        // Remove any existing overlay
        const existingOverlay = document.getElementById('upgrade-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        // Create upgrade overlay with preview
        const overlay = document.createElement('div');
        overlay.id = 'upgrade-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
            overflow-y: auto;
        `;
        
        overlay.innerHTML = `
            <div style="max-width: 900px; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="color: #00f5ff; margin: 0; font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.1em;">
                        SELECT A CARD TO UPGRADE
                    </h2>
                    <button id="cancel-upgrade" style="background: none; border: 1px solid #666; color: #999; padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px; transition: all 0.2s;">
                        Cancel
                    </button>
                </div>
                <p style="color: #888; margin-bottom: 1.5rem; text-align: center;">
                    Click a card to see what it will become after upgrading
                </p>
                <div id="upgrade-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
                    ${upgradeable.map(card => {
                        const upgraded = calculateUpgradedStats(card);
                        const typeColor = card.type === 'attack' ? '#ff2d55' : card.type === 'skill' ? '#00a5ff' : '#ffd700';
                        
                        return `
                            <div class="upgrade-card-container" data-instance="${card.instanceId}" style="
                                background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
                                border: 2px solid ${typeColor};
                                border-radius: 12px;
                                padding: 1rem;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                position: relative;
                            ">
                                <!-- Current Card -->
                                <div class="current-card" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #333;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                        <span style="font-weight: bold; color: #e8e8f0; font-size: 1.1rem;">${card.name}</span>
                                        <span style="background: #f5c542; color: #000; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${card.cost}</span>
                                    </div>
                                    <div style="font-size: 0.75rem; color: #888; text-transform: uppercase; margin-bottom: 0.5rem;">${card.type || 'attack'}</div>
                                    <div style="font-size: 0.85rem; color: #aaa;">${card.description || ''}</div>
                                    ${card.damage ? `<div style="color: #ff6b6b; font-size: 0.9rem; margin-top: 0.25rem;">⚔️ ${card.damage} damage</div>` : ''}
                                    ${card.block ? `<div style="color: #4da6ff; font-size: 0.9rem; margin-top: 0.25rem;">🛡️ ${card.block} block</div>` : ''}
                                    ${card.draw ? `<div style="color: #9b59b6; font-size: 0.9rem; margin-top: 0.25rem;">📤 Draw ${card.draw}</div>` : ''}
                                </div>
                                
                                <!-- Arrow -->
                                <div style="text-align: center; color: #00f5ff; font-size: 1.5rem; margin: 0.5rem 0;">
                                    ⬇️ UPGRADE ⬇️
                                </div>
                                
                                <!-- Upgraded Preview -->
                                <div class="upgraded-card" style="background: rgba(0, 245, 255, 0.1); border-radius: 8px; padding: 0.75rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                        <span style="font-weight: bold; color: #00f5ff; font-size: 1.1rem;">${upgraded.name}</span>
                                        <span style="background: ${upgraded.costMayReduce ? 'linear-gradient(135deg, #f5c542, #00f5ff)' : '#f5c542'}; color: #000; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${card.cost}${upgraded.costMayReduce ? '?' : ''}</span>
                                    </div>
                                    <div style="font-size: 0.85rem; color: #ccc;">${upgraded.description}</div>
                                    ${upgraded.damage ? `<div style="color: #ff9999; font-size: 0.9rem; margin-top: 0.25rem; font-weight: bold;">⚔️ ${card.damage} → <span style="color: #4ade80;">${upgraded.damage}</span> damage (+${upgraded.damage - card.damage})</div>` : ''}
                                    ${upgraded.block ? `<div style="color: #7dd3fc; font-size: 0.9rem; margin-top: 0.25rem; font-weight: bold;">🛡️ ${card.block} → <span style="color: #4ade80;">${upgraded.block}</span> block (+${upgraded.block - card.block})</div>` : ''}
                                    ${upgraded.draw ? `<div style="color: #c084fc; font-size: 0.9rem; margin-top: 0.25rem; font-weight: bold;">📤 Draw ${card.draw} → <span style="color: #4ade80;">${upgraded.draw}</span> (+${upgraded.draw - card.draw})</div>` : ''}
                                    ${upgraded.costMayReduce ? `<div style="color: #ffd700; font-size: 0.8rem; margin-top: 0.5rem; font-style: italic;">✨ 30% chance: Cost reduced by 1</div>` : ''}
                                </div>
                                
                                <!-- Click to upgrade indicator -->
                                <div style="text-align: center; margin-top: 1rem; padding: 0.5rem; background: rgba(0, 245, 255, 0.2); border-radius: 4px; color: #00f5ff; font-weight: bold;">
                                    CLICK TO UPGRADE
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Add hover effects
        overlay.querySelectorAll('.upgrade-card-container').forEach(el => {
            el.addEventListener('mouseenter', () => {
                el.style.transform = 'scale(1.02)';
                el.style.boxShadow = '0 0 30px rgba(0, 245, 255, 0.4)';
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = 'scale(1)';
                el.style.boxShadow = 'none';
            });
            
            // Click to upgrade
            el.addEventListener('click', () => {
                const instanceId = el.dataset.instance;
                overlay.remove();
                upgradeCard(instanceId);
            });
        });
        
        // Cancel button
        document.getElementById('cancel-upgrade').addEventListener('click', () => {
            overlay.remove();
        });
        
        // Click outside to cancel
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
    
    function upgradeCard(instanceId) {
        const deck = game.state.get('deck') || [];
        const card = deck.find(c => c.instanceId === instanceId);
        
        if (card && !card.upgraded) {
            console.log(`[RestScreen] Upgrading card: ${card.name}`);
            
            // Apply upgrade
            card.upgraded = true;
            card.name = card.name + '+';
            
            // Damage increase: +25% rounded up
            if (card.damage && card.damage > 0) {
                const oldDamage = card.damage;
                card.damage = Math.ceil(card.damage * 1.25);
                console.log(`[RestScreen] Damage: ${oldDamage} → ${card.damage}`);
            }
            
            // Block increase: +25% rounded up
            if (card.block && card.block > 0) {
                const oldBlock = card.block;
                card.block = Math.ceil(card.block * 1.25);
                console.log(`[RestScreen] Block: ${oldBlock} → ${card.block}`);
            }
            
            // Draw increase: +1
            if (card.draw && card.draw > 0) {
                card.draw = card.draw + 1;
                console.log(`[RestScreen] Draw: +1`);
            }
            
            // Heal increase: +25%
            if (card.heal && card.heal > 0) {
                card.heal = Math.ceil(card.heal * 1.25);
            }
            
            // Cost reduction: 30% chance if cost > 0
            if (card.cost > 0 && Math.random() < 0.3) {
                const oldCost = card.cost;
                card.cost = Math.max(0, card.cost - 1);
                console.log(`[RestScreen] Cost reduced: ${oldCost} → ${card.cost}`);
            }
            
            // Update effects array if it exists
            if (card.effects && Array.isArray(card.effects)) {
                card.effects.forEach(effect => {
                    if (effect.type === 'damage' && effect.value) {
                        effect.value = Math.ceil(effect.value * 1.25);
                    }
                    if (effect.type === 'block' && effect.value) {
                        effect.value = Math.ceil(effect.value * 1.25);
                    }
                    if (effect.type === 'draw' && effect.value) {
                        effect.value = effect.value + 1;
                    }
                    if (effect.type === 'heal' && effect.value) {
                        effect.value = Math.ceil(effect.value * 1.25);
                    }
                });
            }
            
            // Update description
            card.description = buildUpgradedDescription(card, card);
            
            game.state.set('deck', deck);
            game.eventBus.emit('card:upgraded', card);
            
            // Show upgrade confirmation
            showUpgradeConfirmation(card);
        }
        
        completeRest();
    }
    
    /**
     * Show a brief confirmation of the upgrade
     */
    function showUpgradeConfirmation(card) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a1a2e, #0f0f1a);
            border: 2px solid #00f5ff;
            border-radius: 12px;
            padding: 2rem;
            z-index: 3000;
            text-align: center;
            animation: upgradePopIn 0.3s ease-out;
        `;
        
        toast.innerHTML = `
            <style>
                @keyframes upgradePopIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
            </style>
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">✨</div>
            <div style="color: #00f5ff; font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;">
                UPGRADED!
            </div>
            <div style="color: #e8e8f0; font-size: 1.2rem;">
                ${card.name}
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 1000);
    }
    
    function completeRest() {
        console.log('[RestScreen] Rest complete, returning to map');
        
        if (game.mapGenerator?.completeCurrentNode) {
            game.mapGenerator.completeCurrentNode();
        }
        
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
    
    return { updateRestOptions, upgradeCard, initializeRestScreen, showUpgradeSelection };
}
