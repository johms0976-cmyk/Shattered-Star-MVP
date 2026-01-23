/**
 * ShopScreen - Handles shop interactions
 */

export function setupShopScreen(game) {
    const screen = document.getElementById('shop-screen');
    
    let shopInventory = null;
    
    // Listen for shop events
    game.eventBus.on('shop:enter', () => generateShop());
    
    function generateShop() {
        const heroId = game.state.get('hero.id');
        
        shopInventory = {
            cards: [],
            artifacts: [],
            services: [
                { id: 'remove_card', name: 'Remove Card', cost: 75, type: 'service' },
                { id: 'cleanse', name: 'Cleanse Corruption', cost: 100, type: 'service', removes: 10 }
            ]
        };
        
        // Generate 3-5 cards for sale
        const cardCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < cardCount; i++) {
            const rarity = Math.random() < 0.7 ? 'common' : (Math.random() < 0.8 ? 'uncommon' : 'rare');
            const pool = game.dataLoader.getCardRewardPool(heroId, rarity);
            if (pool.length > 0) {
                const card = pool[Math.floor(Math.random() * pool.length)];
                const price = getCardPrice(card);
                shopInventory.cards.push({ ...card, price });
            }
        }
        
        // Generate 1-2 artifacts
        const artifactCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < artifactCount; i++) {
            const artifact = game.dataLoader.getRandomArtifact();
            if (artifact) {
                shopInventory.artifacts.push({ ...artifact, price: getArtifactPrice(artifact) });
            }
        }
        
        displayShop();
    }
    
    function getCardPrice(card) {
        const basePrices = { common: 50, uncommon: 75, rare: 150 };
        return basePrices[card.rarity] || 50;
    }
    
    function getArtifactPrice(artifact) {
        const basePrices = { common: 150, rare: 250 };
        return basePrices[artifact.rarity] || 150;
    }
    
    function displayShop() {
        const credits = game.state.get('credits') || 0;
        
        // Update credits display
        const creditsEl = document.getElementById('shop-credits');
        if (creditsEl) creditsEl.textContent = credits;
        
        // Display cards
        const cardsGrid = document.getElementById('shop-cards');
        if (cardsGrid && shopInventory) {
            cardsGrid.innerHTML = shopInventory.cards.map((card, i) => `
                <div class="shop-item card-item ${credits < card.price ? 'unaffordable' : ''}" 
                     data-type="card" data-index="${i}">
                    <div class="item-icon">⚔️</div>
                    <div class="item-name">${card.name}</div>
                    <div class="item-desc">${card.description}</div>
                    <div class="item-price">${card.price} 💰</div>
                </div>
            `).join('');
        }
        
        // Display artifacts
        const artifactsGrid = document.getElementById('shop-artifacts');
        if (artifactsGrid && shopInventory) {
            artifactsGrid.innerHTML = shopInventory.artifacts.map((artifact, i) => `
                <div class="shop-item artifact-item ${credits < artifact.price ? 'unaffordable' : ''}" 
                     data-type="artifact" data-index="${i}">
                    <div class="item-icon">💎</div>
                    <div class="item-name">${artifact.name}</div>
                    <div class="item-desc">${artifact.description}</div>
                    <div class="item-price">${artifact.price} 💰</div>
                </div>
            `).join('');
        }
        
        // Display services
        const servicesGrid = document.getElementById('shop-services');
        if (servicesGrid && shopInventory) {
            servicesGrid.innerHTML = shopInventory.services.map((service, i) => `
                <div class="shop-item service-item ${credits < service.cost ? 'unaffordable' : ''}" 
                     data-type="service" data-index="${i}">
                    <div class="item-icon">🔧</div>
                    <div class="item-name">${service.name}</div>
                    <div class="item-price">${service.cost} 💰</div>
                </div>
            `).join('');
        }
        
        // Add click handlers
        document.querySelectorAll('.shop-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const index = parseInt(item.dataset.index);
                purchaseItem(type, index);
            });
        });
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
        
        if (!item || credits < price) return;
        
        // Deduct credits
        game.state.set('credits', credits - price);
        
        // Apply purchase
        if (type === 'card') {
            const deck = game.state.get('deck') || [];
            deck.push({ ...item, instanceId: `card_${Date.now()}` });
            game.state.set('deck', deck);
            game.eventBus.emit('card:purchased', item);
            shopInventory.cards.splice(index, 1);
        } else if (type === 'artifact') {
            const artifacts = game.state.get('artifacts') || [];
            artifacts.push(item);
            game.state.set('artifacts', artifacts);
            game.eventBus.emit('artifact:purchased', item);
            shopInventory.artifacts.splice(index, 1);
        } else if (type === 'service') {
            if (item.id === 'remove_card') {
                game.eventBus.emit('shop:remove_card');
            } else if (item.id === 'cleanse') {
                game.eventBus.emit('corruption:lost', item.removes);
            }
        }
        
        displayShop();
    }
    
    // Leave shop button
    const leaveBtn = document.getElementById('leave-shop');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            game.mapGenerator.completeCurrentNode();
            game.screenManager.transitionTo('map-screen');
        });
    }
    
    return { generateShop, purchaseItem };
}
