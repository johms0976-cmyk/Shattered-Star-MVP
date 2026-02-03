/**
 * ShopScreen - Handles shop interactions
 * FIXED: Now properly initializes when screen becomes visible
 */

export function setupShopScreen(game) {
    const screen = document.getElementById('shop-screen');
    
    console.log('[ShopScreen] Setting up shop screen');
    
    // FIXED: Listen for screen:show event to initialize
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'shop-screen') {
            console.log('[ShopScreen] Screen shown, initializing...');
            initializeShop();
        }
    });
    
    // Also listen for screen:changed for compatibility
    game.eventBus.on('screen:changed', (data) => {
        const targetScreen = typeof data === 'string' ? data : (data?.to || data);
        if (targetScreen === 'shop-screen') {
            console.log('[ShopScreen] Screen changed to shop, initializing...');
            initializeShop();
        }
    });
    
    // Legacy event listener
    game.eventBus.on('shop:enter', () => {
        console.log('[ShopScreen] shop:enter event received');
        initializeShop();
    });
    
    function initializeShop() {
        console.log('[ShopScreen] Initializing shop...');
        generateShopItems();
        updateCreditsDisplay();
        setupLeaveButton();
    }
    
    function generateShopItems() {
        const cardsContainer = document.getElementById('shop-cards');
        const artifactsContainer = document.getElementById('shop-artifacts');
        const servicesContainer = document.getElementById('shop-services');
        
        // Generate shop cards
        if (cardsContainer) {
            const cards = getShopCards();
            cardsContainer.innerHTML = cards.map(card => createCardElement(card)).join('');
            
            // Add click handlers
            cardsContainer.querySelectorAll('.shop-item').forEach(el => {
                el.addEventListener('click', () => {
                    const cardId = el.dataset.id;
                    const price = parseInt(el.dataset.price);
                    purchaseCard(cardId, price);
                });
            });
            console.log(`[ShopScreen] Generated ${cards.length} cards`);
        }
        
        // Generate shop artifacts
        if (artifactsContainer) {
            const artifacts = getShopArtifacts();
            artifactsContainer.innerHTML = artifacts.map(artifact => createArtifactElement(artifact)).join('');
            
            // Add click handlers
            artifactsContainer.querySelectorAll('.shop-item').forEach(el => {
                el.addEventListener('click', () => {
                    const artifactId = el.dataset.id;
                    const price = parseInt(el.dataset.price);
                    purchaseArtifact(artifactId, price);
                });
            });
            console.log(`[ShopScreen] Generated ${artifacts.length} artifacts`);
        }
        
        // Generate services
        if (servicesContainer) {
            servicesContainer.innerHTML = `
                <div class="shop-item service" data-service="remove" data-price="75">
                    <div class="service-icon">🗑️</div>
                    <div class="service-name">Remove Card</div>
                    <div class="service-price">75 credits</div>
                </div>
                <div class="shop-item service" data-service="heal" data-price="50">
                    <div class="service-icon">❤️</div>
                    <div class="service-name">Heal 25%</div>
                    <div class="service-price">50 credits</div>
                </div>
            `;
            
            servicesContainer.querySelectorAll('.shop-item').forEach(el => {
                el.addEventListener('click', () => {
                    const service = el.dataset.service;
                    const price = parseInt(el.dataset.price);
                    purchaseService(service, price);
                });
            });
            console.log('[ShopScreen] Generated services');
        }
    }
    
    function getShopCards() {
        const heroId = game.state.get('heroId') || 'korvax';
        const act = game.state.get('act') || 1;
        
        try {
            // Try to get cards from data loader
            const allCards = game.dataLoader?.getCardsForHero?.(heroId) || [];
            const shopCards = allCards
                .filter(c => c.rarity !== 'starter' && c.rarity !== 'legendary')
                .sort(() => Math.random() - 0.5)
                .slice(0, 5);
            
            return shopCards.map(card => ({
                ...card,
                price: getCardPrice(card)
            }));
        } catch (e) {
            console.warn('[ShopScreen] Failed to get cards, using fallback:', e);
            return getFallbackCards();
        }
    }
    
    function getFallbackCards() {
        return [
            { id: 'heavy_strike', name: 'Heavy Strike', type: 'attack', cost: 2, damage: 14, rarity: 'common', price: 50, description: 'Deal 14 damage.' },
            { id: 'reinforce', name: 'Reinforce', type: 'skill', cost: 1, block: 8, rarity: 'common', price: 50, description: 'Gain 8 Block.' },
            { id: 'power_up', name: 'Power Up', type: 'power', cost: 1, rarity: 'uncommon', price: 100, description: 'Gain 2 Strength.' }
        ];
    }
    
    function getShopArtifacts() {
        try {
            const artifacts = [];
            for (let i = 0; i < 3; i++) {
                const rarity = i === 0 ? 'common' : (i === 1 ? 'uncommon' : 'rare');
                const artifact = game.dataLoader?.getRandomArtifact?.(rarity);
                if (artifact) {
                    artifacts.push({
                        ...artifact,
                        price: getArtifactPrice(artifact)
                    });
                }
            }
            return artifacts;
        } catch (e) {
            console.warn('[ShopScreen] Failed to get artifacts, using fallback:', e);
            return getFallbackArtifacts();
        }
    }
    
    function getFallbackArtifacts() {
        return [
            { id: 'energy_core', name: 'Energy Core', rarity: 'common', price: 150, description: 'Start each combat with 1 extra Energy.' },
            { id: 'iron_plating', name: 'Iron Plating', rarity: 'uncommon', price: 200, description: 'Start each combat with 5 Block.' }
        ];
    }
    
    function getCardPrice(card) {
        const basePrices = { common: 50, uncommon: 100, rare: 175 };
        return basePrices[card.rarity] || 75;
    }
    
    function getArtifactPrice(artifact) {
        const basePrices = { common: 150, uncommon: 200, rare: 300 };
        return basePrices[artifact.rarity] || 200;
    }
    
    function createCardElement(card) {
        return `
            <div class="shop-item card-item type-${card.type || 'attack'}" data-id="${card.id}" data-price="${card.price}">
                <div class="card-cost">${card.cost}</div>
                <div class="card-name">${card.name}</div>
                <div class="card-description">${card.description || ''}</div>
                <div class="card-price">${card.price} credits</div>
            </div>
        `;
    }
    
    function createArtifactElement(artifact) {
        return `
            <div class="shop-item artifact-item rarity-${artifact.rarity}" data-id="${artifact.id}" data-price="${artifact.price}">
                <div class="artifact-icon">🔮</div>
                <div class="artifact-name">${artifact.name}</div>
                <div class="artifact-description">${artifact.description || ''}</div>
                <div class="artifact-price">${artifact.price} credits</div>
            </div>
        `;
    }
    
    function updateCreditsDisplay() {
        const credits = game.state.get('credits') || 0;
        const display = document.getElementById('shop-credits');
        if (display) {
            display.textContent = `Credits: ${credits}`;
        }
        
        // Update item affordability
        const items = document.querySelectorAll('.shop-item');
        items.forEach(item => {
            const price = parseInt(item.dataset.price) || 0;
            if (price > credits) {
                item.classList.add('unaffordable');
            } else {
                item.classList.remove('unaffordable');
            }
        });
    }
    
    function purchaseCard(cardId, price) {
        const credits = game.state.get('credits') || 0;
        
        if (credits < price) {
            console.log('[ShopScreen] Not enough credits');
            game.audioManager?.playSFX?.('ui_error');
            return;
        }
        
        // Find card data
        let card;
        try {
            card = game.dataLoader?.getCard?.(cardId);
        } catch (e) {
            // Fallback
            card = { id: cardId, name: cardId, type: 'attack', cost: 1 };
        }
        
        if (card) {
            // Add unique instance ID
            const instanceCard = {
                ...card,
                instanceId: `${cardId}_${Date.now()}`
            };
            
            // Add to deck
            const deck = game.state.get('deck') || [];
            deck.push(instanceCard);
            game.state.set('deck', deck);
            
            // Deduct credits
            game.state.set('credits', credits - price);
            
            game.audioManager?.playSFX?.('card_draw');
            game.eventBus.emit('card:obtained', instanceCard);
            
            console.log(`[ShopScreen] Purchased card: ${card.name}`);
            
            // Remove from shop display
            const element = document.querySelector(`.shop-item[data-id="${cardId}"]`);
            if (element) {
                element.classList.add('purchased');
                element.style.opacity = '0.5';
                element.style.pointerEvents = 'none';
            }
            
            updateCreditsDisplay();
        }
    }
    
    function purchaseArtifact(artifactId, price) {
        const credits = game.state.get('credits') || 0;
        
        if (credits < price) {
            console.log('[ShopScreen] Not enough credits');
            game.audioManager?.playSFX?.('ui_error');
            return;
        }
        
        let artifact;
        try {
            artifact = game.dataLoader?.getArtifact?.(artifactId);
        } catch (e) {
            artifact = { id: artifactId, name: artifactId };
        }
        
        if (artifact) {
            const artifacts = game.state.get('artifacts') || [];
            artifacts.push(artifact);
            game.state.set('artifacts', artifacts);
            
            game.state.set('credits', credits - price);
            
            game.audioManager?.playSFX?.('artifact_obtain');
            game.eventBus.emit('artifact:gained', artifact);
            
            console.log(`[ShopScreen] Purchased artifact: ${artifact.name}`);
            
            // Remove from shop display
            const element = document.querySelector(`.shop-item[data-id="${artifactId}"]`);
            if (element) {
                element.classList.add('purchased');
                element.style.opacity = '0.5';
                element.style.pointerEvents = 'none';
            }
            
            updateCreditsDisplay();
        }
    }
    
    function purchaseService(service, price) {
        const credits = game.state.get('credits') || 0;
        
        if (credits < price) {
            console.log('[ShopScreen] Not enough credits');
            game.audioManager?.playSFX?.('ui_error');
            return;
        }
        
        if (service === 'remove') {
            showCardRemoval();
        } else if (service === 'heal') {
            const hp = game.state.get('hp') || 50;
            const maxHp = game.state.get('maxHp') || 80;
            const healAmount = Math.floor(maxHp * 0.25);
            const newHp = Math.min(maxHp, hp + healAmount);
            
            game.state.set('hp', newHp);
            game.state.set('credits', credits - price);
            
            game.audioManager?.playSFX?.('heal');
            game.eventBus.emit('heal', healAmount);
            
            console.log(`[ShopScreen] Healed ${healAmount} HP`);
            updateCreditsDisplay();
        }
    }
    
    function showCardRemoval() {
        const deck = game.state.get('deck') || [];
        const removable = deck.filter(c => !c.starter);
        
        const modal = document.getElementById('deck-modal');
        const content = document.getElementById('deck-view-cards') || document.getElementById('deck-cards');
        
        if (content) {
            content.innerHTML = `
                <h3 style="color: var(--color-highlight); margin-bottom: 1rem;">Select a card to remove</h3>
                <div class="remove-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
                    ${removable.map(card => `
                        <div class="remove-card card type-${card.type || 'attack'}" data-instance="${card.instanceId}" style="cursor: pointer;">
                            <div class="card-cost">${card.cost}</div>
                            <div class="card-name">${card.name}</div>
                            <div class="card-description">${card.description || ''}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            content.querySelectorAll('.remove-card').forEach(el => {
                el.addEventListener('click', () => {
                    removeCard(el.dataset.instance);
                    game.screenManager.hideModal('deck-modal');
                });
            });
        }
        
        game.screenManager.showModal('deck-modal');
    }
    
    function removeCard(instanceId) {
        const deck = game.state.get('deck') || [];
        const index = deck.findIndex(c => c.instanceId === instanceId);
        
        if (index !== -1) {
            const removed = deck.splice(index, 1)[0];
            game.state.set('deck', deck);
            
            const credits = game.state.get('credits') || 0;
            game.state.set('credits', credits - 75);
            
            game.eventBus.emit('card:removed', removed);
            console.log(`[ShopScreen] Removed card: ${removed.name}`);
            
            updateCreditsDisplay();
        }
    }
    
    function setupLeaveButton() {
        const leaveBtn = document.getElementById('btn-leave-shop');
        if (leaveBtn) {
            // Remove old listeners
            const newBtn = leaveBtn.cloneNode(true);
            leaveBtn.parentNode.replaceChild(newBtn, leaveBtn);
            
            newBtn.addEventListener('click', () => {
                console.log('[ShopScreen] Leaving shop');
                game.audioManager?.playSFX?.('ui_click');
                leaveShop();
            });
        }
    }
    
    function leaveShop() {
        game.mapGenerator.completeCurrentNode();
        game.eventBus.emit('map:updated');
        forceScreenTransition(game, 'map-screen');
    }
    
    /**
     * Force screen transition (same pattern as other screens)
     */
    function forceScreenTransition(game, targetScreenId) {
        console.log(`[ShopScreen] forceScreenTransition to: ${targetScreenId}`);
        
        const shopScreen = document.getElementById('shop-screen');
        const targetScreen = document.getElementById(targetScreenId);
        
        if (!targetScreen) {
            console.error(`[ShopScreen] Target screen not found: ${targetScreenId}`);
            return;
        }
        
        // Hide the shop screen
        if (shopScreen) {
            shopScreen.classList.remove('active', 'fade-in');
            shopScreen.style.cssText = '';
        }
        
        // Try normal ScreenManager transition
        try {
            if (game.screenManager) {
                game.screenManager.transitioning = false;
                game.screenManager.transitionTo(targetScreenId);
            }
        } catch (e) {
            console.error('[ShopScreen] screenManager.transitionTo failed:', e);
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
            
            game.eventBus.emit('screen:changed', { to: targetScreenId, from: 'shop-screen' });
            game.eventBus.emit('screen:show', targetScreenId);
        }, 100);
    }
    
    return { initializeShop, updateCreditsDisplay };
}
