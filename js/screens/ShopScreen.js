/**
 * ShopScreen - Handles shop interactions
 * FIXED: Added transitioning flag reset before screen transitions
 * FIXED: Improved leave button handling with DOM ready check
 * @version 0.2.3
 */

export function setupShopScreen(game) {
    console.log('[ShopScreen] Setting up shop screen v0.2.3...');
    
    const screen = document.getElementById('shop-screen');
    
    let shopInventory = null;
    let shopGenerated = false;
    
    // PRIMARY: Listen for shop:enter events
    game.eventBus.on('shop:enter', () => {
        console.log('[ShopScreen] shop:enter event received');
        generateShop();
    });
    
    // BACKUP: Also listen for screen changes to shop-screen
    game.eventBus.on('screen:changed', (data) => {
        const screenId = typeof data === 'string' ? data : (data?.to || data);
        if (screenId === 'shop-screen') {
            console.log('[ShopScreen] screen:changed to shop-screen');
            // If shop hasn't been generated yet, generate it now
            if (!shopGenerated || !shopInventory) {
                console.log('[ShopScreen] Shop not generated, generating now...');
                generateShop();
            } else {
                // Just refresh the display
                displayShop();
            }
            // Ensure leave button is set up when screen is shown
            setupLeaveButton();
        }
    });
    
    // Also use MutationObserver as last resort
    if (screen) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && screen.classList.contains('active')) {
                    console.log('[ShopScreen] Screen became active via class change');
                    if (!shopGenerated || !shopInventory) {
                        generateShop();
                    }
                    // Ensure leave button is set up
                    setupLeaveButton();
                }
            });
        });
        observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
    }
    
    function generateShop() {
        console.log('[ShopScreen] Generating shop inventory...');
        
        const heroId = game.state.get('hero.id') || 'korvax';
        
        shopInventory = {
            cards: [],
            artifacts: [],
            services: [
                { id: 'remove_card', name: 'Remove Card', cost: 75, type: 'service', description: 'Remove a card from your deck' },
                { id: 'cleanse', name: 'Cleanse Corruption', cost: 100, type: 'service', removes: 10, description: 'Remove 10 corruption' }
            ]
        };
        
        // Generate 3-5 cards for sale
        const cardCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < cardCount; i++) {
            const rarity = Math.random() < 0.7 ? 'common' : (Math.random() < 0.8 ? 'uncommon' : 'rare');
            
            let card = null;
            try {
                if (game.dataLoader && typeof game.dataLoader.getCardRewardPool === 'function') {
                    const pool = game.dataLoader.getCardRewardPool(heroId, rarity);
                    if (pool && pool.length > 0) {
                        card = pool[Math.floor(Math.random() * pool.length)];
                    }
                }
            } catch (e) {
                console.warn('[ShopScreen] Failed to get card from DataLoader:', e);
            }
            
            // Use fallback cards if DataLoader fails
            if (!card) {
                card = getFallbackCard(rarity, heroId);
            }
            
            if (card) {
                const price = getCardPrice(card);
                shopInventory.cards.push({ ...card, price });
            }
        }
        
        // Generate 1-2 artifacts
        const artifactCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < artifactCount; i++) {
            let artifact = null;
            
            try {
                if (game.dataLoader && typeof game.dataLoader.getRandomArtifact === 'function') {
                    artifact = game.dataLoader.getRandomArtifact();
                }
            } catch (e) {
                console.warn('[ShopScreen] Failed to get artifact from DataLoader:', e);
            }
            
            // Use fallback artifact if DataLoader fails
            if (!artifact) {
                artifact = getFallbackArtifact();
            }
            
            if (artifact) {
                shopInventory.artifacts.push({ ...artifact, price: getArtifactPrice(artifact) });
            }
        }
        
        shopGenerated = true;
        console.log('[ShopScreen] Shop generated:', {
            cards: shopInventory.cards.length,
            artifacts: shopInventory.artifacts.length,
            services: shopInventory.services.length
        });
        
        displayShop();
    }
    
    function getFallbackCard(rarity, heroId) {
        const fallbackCards = {
            common: [
                { id: 'strike_plus', name: 'Strike+', type: 'attack', rarity: 'common', cost: 1, damage: 8, description: 'Deal 8 damage.' },
                { id: 'defend_plus', name: 'Defend+', type: 'skill', rarity: 'common', cost: 1, block: 7, description: 'Gain 7 Block.' },
                { id: 'power_surge', name: 'Power Surge', type: 'skill', rarity: 'common', cost: 1, description: 'Gain 2 Energy.' }
            ],
            uncommon: [
                { id: 'heavy_blow', name: 'Heavy Blow', type: 'attack', rarity: 'uncommon', cost: 2, damage: 14, description: 'Deal 14 damage.' },
                { id: 'iron_wall', name: 'Iron Wall', type: 'skill', rarity: 'uncommon', cost: 2, block: 12, description: 'Gain 12 Block.' },
                { id: 'battle_rage', name: 'Battle Rage', type: 'skill', rarity: 'uncommon', cost: 1, description: 'Draw 2 cards.' }
            ],
            rare: [
                { id: 'devastate', name: 'Devastate', type: 'attack', rarity: 'rare', cost: 3, damage: 25, description: 'Deal 25 damage.' },
                { id: 'fortress', name: 'Fortress', type: 'power', rarity: 'rare', cost: 2, description: 'Gain 3 Block at the start of each turn.' }
            ]
        };
        
        const pool = fallbackCards[rarity] || fallbackCards.common;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    function getFallbackArtifact() {
        const fallbackArtifacts = [
            { id: 'rust_plating', name: 'Rust Plating', rarity: 'common', icon: '🛡️', description: 'Start each combat with 5 Block.' },
            { id: 'energy_cell', name: 'Energy Cell', rarity: 'common', icon: '⚡', description: 'Gain 1 additional Energy each turn.' },
            { id: 'void_shard', name: 'Void Shard', rarity: 'rare', icon: '💎', description: 'Deal 3 damage to a random enemy at the start of each turn.' }
        ];
        
        return fallbackArtifacts[Math.floor(Math.random() * fallbackArtifacts.length)];
    }
    
    function getCardPrice(card) {
        const basePrices = { common: 50, uncommon: 75, rare: 150, legendary: 300 };
        return basePrices[card.rarity] || 50;
    }
    
    function getArtifactPrice(artifact) {
        const basePrices = { common: 150, rare: 250, legendary: 400 };
        return basePrices[artifact.rarity] || 150;
    }
    
    function displayShop() {
        console.log('[ShopScreen] Displaying shop...');
        
        const credits = game.state.get('credits') || 0;
        
        // Update credits display
        const creditsEl = document.getElementById('shop-credits');
        if (creditsEl) {
            creditsEl.textContent = credits;
        }
        
        // Display cards
        const cardsGrid = document.getElementById('shop-cards');
        if (cardsGrid && shopInventory) {
            if (shopInventory.cards.length === 0) {
                cardsGrid.innerHTML = '<p class="shop-empty">No cards available</p>';
            } else {
                cardsGrid.innerHTML = shopInventory.cards.map((card, i) => `
                    <div class="shop-item card-item ${credits < card.price ? 'unaffordable' : ''}" 
                         data-type="card" data-index="${i}">
                        <div class="item-icon">⚔️</div>
                        <div class="item-info">
                            <div class="item-name">${card.name}</div>
                            <div class="item-desc">${card.description || ''}</div>
                        </div>
                        <div class="item-price">${card.price} 💰</div>
                    </div>
                `).join('');
            }
        }
        
        // Display artifacts
        const artifactsGrid = document.getElementById('shop-artifacts');
        if (artifactsGrid && shopInventory) {
            if (shopInventory.artifacts.length === 0) {
                artifactsGrid.innerHTML = '<p class="shop-empty">No relics available</p>';
            } else {
                artifactsGrid.innerHTML = shopInventory.artifacts.map((artifact, i) => `
                    <div class="shop-item artifact-item ${credits < artifact.price ? 'unaffordable' : ''}" 
                         data-type="artifact" data-index="${i}">
                        <div class="item-icon">${artifact.icon || '💎'}</div>
                        <div class="item-info">
                            <div class="item-name">${artifact.name}</div>
                            <div class="item-desc">${artifact.description || ''}</div>
                        </div>
                        <div class="item-price">${artifact.price} 💰</div>
                    </div>
                `).join('');
            }
        }
        
        // Display services
        const servicesGrid = document.getElementById('shop-services');
        if (servicesGrid && shopInventory) {
            servicesGrid.innerHTML = shopInventory.services.map((service, i) => `
                <div class="shop-item service-item ${credits < service.cost ? 'unaffordable' : ''}" 
                     data-type="service" data-index="${i}">
                    <div class="item-icon">${service.id === 'remove_card' ? '🗑️' : '✨'}</div>
                    <div class="item-info">
                        <div class="item-name">${service.name}</div>
                        <div class="item-desc">${service.description || ''}</div>
                    </div>
                    <div class="item-price">${service.cost} 💰</div>
                </div>
            `).join('');
        }
        
        // Add click handlers
        document.querySelectorAll('.shop-item').forEach(item => {
            // Remove old listeners by cloning
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', () => {
                const type = newItem.dataset.type;
                const index = parseInt(newItem.dataset.index);
                purchaseItem(type, index);
            });
        });
        
        console.log('[ShopScreen] Shop display complete');
    }
    
    function purchaseItem(type, index) {
        const credits = game.state.get('credits') || 0;
        let item, price;
        
        if (type === 'card') {
            item = shopInventory.cards[index];
            price = item?.price;
        } else if (type === 'artifact') {
            item = shopInventory.artifacts[index];
            price = item?.price;
        } else if (type === 'service') {
            item = shopInventory.services[index];
            price = item?.cost;
        }
        
        if (!item) {
            console.warn('[ShopScreen] Item not found:', type, index);
            return;
        }
        
        if (credits < price) {
            console.log('[ShopScreen] Cannot afford item');
            // Could add visual feedback here
            return;
        }
        
        console.log(`[ShopScreen] Purchasing ${type}: ${item.name || item.id}`);
        
        // Deduct credits
        game.state.set('credits', credits - price);
        
        // Play purchase sound
        try {
            game.audioManager.playSFX('purchase');
        } catch (e) {}
        
        // Apply purchase
        if (type === 'card') {
            const deck = game.state.get('deck') || [];
            const newCard = { ...item, instanceId: `card_${Date.now()}` };
            deck.push(newCard);
            game.state.set('deck', deck);
            game.eventBus.emit('card:purchased', item);
            console.log(`[ShopScreen] Card added to deck. Deck now has ${deck.length} cards`);
            shopInventory.cards.splice(index, 1);
        } else if (type === 'artifact') {
            const artifacts = game.state.get('artifacts') || [];
            artifacts.push(item);
            game.state.set('artifacts', artifacts);
            game.eventBus.emit('artifact:purchased', item);
            console.log(`[ShopScreen] Artifact added. Total artifacts: ${artifacts.length}`);
            shopInventory.artifacts.splice(index, 1);
        } else if (type === 'service') {
            if (item.id === 'remove_card') {
                game.eventBus.emit('shop:remove_card');
                // Could transition to card select screen
            } else if (item.id === 'cleanse') {
                const corruption = game.state.get('corruption') || 0;
                game.state.set('corruption', Math.max(0, corruption - item.removes));
                game.eventBus.emit('corruption:lost', item.removes);
            }
        }
        
        displayShop();
    }
    
    /**
     * FIX: Force screen transition with transitioning flag reset
     * This ensures the transition works even if the flag got stuck
     */
    function forceScreenTransition(targetScreenId) {
        console.log(`[ShopScreen] forceScreenTransition to: ${targetScreenId}`);
        
        const shopScreen = document.getElementById('shop-screen');
        const targetScreen = document.getElementById(targetScreenId);
        
        if (!targetScreen) {
            console.error(`[ShopScreen] Target screen not found: ${targetScreenId}`);
            return;
        }
        
        // STEP 1: Immediately hide the shop screen
        if (shopScreen) {
            console.log('[ShopScreen] Hiding shop-screen immediately');
            shopScreen.classList.remove('active', 'fade-in');
            shopScreen.classList.add('fade-out');
            shopScreen.style.cssText = '';  // Clear inline styles
        }
        
        // STEP 2: Try normal ScreenManager transition with flag reset
        try {
            if (game.screenManager) {
                // FIX: Reset transitioning flag before calling transitionTo
                game.screenManager.transitioning = false;
                game.screenManager.transitionTo(targetScreenId);
                console.log('[ShopScreen] ScreenManager.transitionTo called');
            }
        } catch (e) {
            console.error('[ShopScreen] screenManager.transitionTo failed:', e);
        }
        
        // STEP 3: ALWAYS force the transition after a delay as backup
        setTimeout(() => {
            console.log(`[ShopScreen] Force-showing ${targetScreenId} (backup)`);
            
            // Hide ALL other screens first
            document.querySelectorAll('.screen').forEach(screen => {
                if (screen.id !== targetScreenId) {
                    screen.classList.remove('active', 'fade-in');
                    screen.style.cssText = '';
                }
            });
            
            // Force show the target screen
            targetScreen.classList.remove('fade-out');
            targetScreen.classList.add('active');
            
            // Apply aggressive inline styles to guarantee visibility
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
            
            // Update ScreenManager state
            if (game.screenManager) {
                game.screenManager.previousScreen = game.screenManager.currentScreen;
                game.screenManager.currentScreen = targetScreenId;
                game.screenManager.transitioning = false;
            }
            
            // Emit events so screen handlers initialize
            game.eventBus.emit('screen:changed', { to: targetScreenId, from: 'shop-screen' });
            game.eventBus.emit('screen:show', targetScreenId);
            game.eventBus.emit('screen:change', targetScreenId);
            
            console.log(`[ShopScreen] Force transition complete.`);
        }, 100);
    }
    
    /**
     * Handle leaving the shop
     */
    function handleLeaveShop() {
        console.log('[ShopScreen] Leave shop button clicked!');
        
        // Play click sound
        try {
            game.audioManager.playSFX('ui_click');
        } catch (e) {}
        
        // Complete the node
        try {
            if (game.mapGenerator) {
                game.mapGenerator.completeCurrentNode();
            }
        } catch (e) {
            console.warn('[ShopScreen] Failed to complete node:', e);
        }
        
        // Reset shop state for next visit
        shopGenerated = false;
        shopInventory = null;
        
        // FIX: Use force transition instead of regular transition
        forceScreenTransition('map-screen');
    }
    
    /**
     * FIXED: Setup leave button with multiple approaches
     * This function can be called multiple times safely
     */
    let leaveButtonSetup = false;
    
    function setupLeaveButton() {
        // Try multiple selectors
        const leaveBtn = document.getElementById('btn-leave-shop') || 
                         document.getElementById('leave-shop') ||
                         document.querySelector('#shop-screen .leave-btn') ||
                         document.querySelector('.leave-btn');
        
        if (leaveBtn) {
            // Only set up once per button instance
            if (leaveBtn.dataset.listenerAttached === 'true') {
                console.log('[ShopScreen] Leave button already has listener');
                return;
            }
            
            // Remove any existing listeners by cloning
            const newBtn = leaveBtn.cloneNode(true);
            leaveBtn.parentNode.replaceChild(newBtn, leaveBtn);
            
            // Add click handler
            newBtn.addEventListener('click', handleLeaveShop);
            
            // Mark as setup
            newBtn.dataset.listenerAttached = 'true';
            leaveButtonSetup = true;
            
            console.log('[ShopScreen] Leave button setup complete');
        } else {
            console.warn('[ShopScreen] Leave button not found, will retry on screen show');
        }
    }
    
    // Initial setup attempt
    setupLeaveButton();
    
    // Also try setup when DOM is fully ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupLeaveButton);
    } else {
        // DOM already loaded, try again after a short delay
        setTimeout(setupLeaveButton, 100);
    }
    
    console.log('[ShopScreen] Setup complete');
    
    return { generateShop, purchaseItem, setupLeaveButton };
}
