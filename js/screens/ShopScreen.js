/**
 * ShopScreen - Enhanced with Void Merchant tab
 * Shattered Star
 * 
 * Adds a toggleable "Void Merchant" section alongside the standard shop.
 * The Void Merchant appears conditionally (node 5+, corruption-weighted).
 * 
 * FIX: Uses dynamic import for VoidMerchant to prevent module crash if file missing.
 * FIX: Preserves standard shop HTML structure when switching tabs.
 * FIX: Leave button bound immediately with correct selector.
 */

// Dynamic import - won't crash the module if VoidMerchant.js is missing
let VoidMerchantClass = null;

export function setupShopScreen(game) {
    const screen = document.getElementById('shop-screen');
    
    let shopInventory = null;
    let voidMerchant = null;
    let activeTab = 'standard'; // 'standard' or 'void'
    let standardShopHTML = ''; // Cache standard shop HTML for tab switching
    
    // ─── LEAVE BUTTON (bind immediately, before anything else) ───
    setupLeaveButton();
    
    // ─── VOID MERCHANT (async, non-blocking) ───
    loadVoidMerchant();
    
    async function loadVoidMerchant() {
        try {
            const module = await import('../systems/VoidMerchant.js');
            VoidMerchantClass = module.default;
            voidMerchant = new VoidMerchantClass(game.state, game.eventBus);
            console.log('[ShopScreen] VoidMerchant loaded successfully');
        } catch (e) {
            console.warn('[ShopScreen] VoidMerchant not available (file missing or error):', e.message);
            voidMerchant = null;
        }
    }
    
    // Listen for shop events
    game.eventBus.on('shop:enter', () => generateShop());
    
    function generateShop() {
        const heroId = game.state.get('hero.id');
        activeTab = 'standard';
        
        console.log('[ShopScreen] ═══════════════════════════════════');
        console.log('[ShopScreen] Generating shop for hero:', heroId);
        
        shopInventory = {
            cards: [],
            artifacts: [],
            services: [
                { id: 'remove_card', name: 'Remove Card', cost: 75, type: 'service', icon: '✂️' },
                { id: 'cleanse', name: 'Cleanse Corruption', cost: 100, type: 'service', removes: 10, icon: '✨' }
            ]
        };
        
        // Generate 3-5 cards
        const cardCount = 3 + Math.floor(Math.random() * 3);
        const usedIds = new Set();
        for (let i = 0; i < cardCount; i++) {
            const rarity = Math.random() < 0.6 ? 'common' : (Math.random() < 0.75 ? 'uncommon' : 'rare');
            try {
                const pool = game.dataLoader.getCardRewardPool(heroId, rarity);
                if (!pool || pool.length === 0) {
                    console.warn(`[ShopScreen] Empty card pool for ${heroId}/${rarity}`);
                    continue;
                }
                const available = pool.filter(c => !usedIds.has(c.id));
                if (available.length > 0) {
                    const card = available[Math.floor(Math.random() * available.length)];
                    usedIds.add(card.id);
                    shopInventory.cards.push({ ...card, price: getCardPrice(card) });
                }
            } catch (e) {
                console.warn('[ShopScreen] Card pool error:', e);
            }
        }
        
        // Generate 1-2 artifacts
        const artifactCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < artifactCount; i++) {
            try {
                const artifact = game.dataLoader.getRandomArtifact();
                if (artifact) {
                    shopInventory.artifacts.push({ ...artifact, price: getArtifactPrice(artifact) });
                }
            } catch (e) {
                console.warn('[ShopScreen] Artifact error:', e);
            }
        }
        
        console.log(`[ShopScreen] Generated: ${shopInventory.cards.length} cards, ${shopInventory.artifacts.length} artifacts, ${shopInventory.services.length} services`);
        
        // Check if Void Merchant appears
        let voidAvailable = false;
        if (voidMerchant) {
            try {
                if (voidMerchant.shouldAppear()) {
                    voidMerchant.generateInventory();
                    voidAvailable = true;
                    console.log('[ShopScreen] Void Merchant appeared!');
                }
            } catch (e) {
                console.warn('[ShopScreen] VoidMerchant check failed:', e);
            }
        }
        
        displayShop(voidAvailable);
    }
    
    function getCardPrice(card) {
        const basePrices = { common: 50, uncommon: 75, rare: 150, legendary: 250 };
        return basePrices[card.rarity] || 50;
    }
    
    function getArtifactPrice(artifact) {
        const basePrices = { common: 150, rare: 250, cosmic: 300 };
        return basePrices[artifact.rarity] || 150;
    }
    
    function displayShop(voidAvailable = false) {
        const credits = game.state.get('credits') || 0;
        
        // Update credits display
        const creditsEl = document.getElementById('shop-credits');
        if (creditsEl) creditsEl.textContent = credits;
        
        // Add tab buttons if void merchant is available
        const shopHeader = screen.querySelector('.shop-header');
        if (shopHeader) {
            // Remove existing tabs
            const existingTabs = document.getElementById('shop-tabs');
            if (existingTabs) existingTabs.remove();
            
            if (voidAvailable) {
                const tabsHtml = `
                    <div class="shop-tabs" id="shop-tabs">
                        <button class="shop-tab ${activeTab === 'standard' ? 'active' : ''}" 
                                data-tab="standard">TRADER</button>
                        <button class="shop-tab void-tab ${activeTab === 'void' ? 'active' : ''}" 
                                data-tab="void">👁 VOID MERCHANT</button>
                    </div>
                `;
                shopHeader.insertAdjacentHTML('afterend', tabsHtml);
                
                // Tab click handlers
                document.querySelectorAll('.shop-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        activeTab = tab.dataset.tab;
                        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        displayShopContent(credits, voidAvailable);
                    });
                });
            }
        }
        
        // Cache the standard shop HTML structure before any tab switching
        const shopSections = screen.querySelector('.shop-sections');
        if (shopSections && !standardShopHTML) {
            standardShopHTML = shopSections.innerHTML;
        }
        
        displayShopContent(credits, voidAvailable);
    }
    
    function displayShopContent(credits, voidAvailable) {
        const shopSections = screen.querySelector('.shop-sections');
        if (!shopSections) {
            console.warn('[ShopScreen] .shop-sections not found');
            return;
        }
        
        if (activeTab === 'void' && voidAvailable && voidMerchant) {
            // Show Void Merchant content - replace shop sections
            shopSections.innerHTML = voidMerchant.renderVoidTab(credits);
            
            // Add void item click handlers
            shopSections.querySelectorAll('.void-item').forEach(item => {
                item.addEventListener('click', () => {
                    const type = item.dataset.type;
                    const index = parseInt(item.dataset.index);
                    handleVoidPurchase(type, index);
                });
            });
        } else {
            // Restore standard shop HTML structure if it was replaced by void tab
            if (!document.getElementById('shop-cards')) {
                shopSections.innerHTML = standardShopHTML;
            }
            // Show standard shop content
            displayStandardShop(credits);
        }
    }
    
    function displayStandardShop(credits) {
        // Display cards
        const cardsGrid = document.getElementById('shop-cards');
        if (cardsGrid && shopInventory) {
            if (shopInventory.cards.length === 0) {
                cardsGrid.innerHTML = '<div class="shop-empty">No cards available</div>';
            } else {
                cardsGrid.innerHTML = shopInventory.cards.map((card, i) => `
                    <div class="shop-item card-item ${credits < card.price ? 'unaffordable' : ''}" 
                         data-type="card" data-index="${i}">
                        <div class="item-icon">${getTypeIcon(card.type)}</div>
                        <div class="item-details">
                            <div class="item-name">${card.name}</div>
                            <div class="item-desc">${card.description || ''}</div>
                            <div class="item-rarity rarity-${card.rarity}">${card.rarity}</div>
                        </div>
                        <div class="item-price">${card.price} ◈</div>
                    </div>
                `).join('');
            }
        }
        
        // Display artifacts
        const artifactsGrid = document.getElementById('shop-artifacts');
        if (artifactsGrid && shopInventory) {
            if (shopInventory.artifacts.length === 0) {
                artifactsGrid.innerHTML = '<div class="shop-empty">No relics available</div>';
            } else {
                artifactsGrid.innerHTML = shopInventory.artifacts.map((artifact, i) => `
                    <div class="shop-item artifact-item ${credits < artifact.price ? 'unaffordable' : ''}" 
                         data-type="artifact" data-index="${i}">
                        <div class="item-icon">💎</div>
                        <div class="item-details">
                            <div class="item-name">${artifact.name}</div>
                            <div class="item-desc">${artifact.description || ''}</div>
                        </div>
                        <div class="item-price">${artifact.price} ◈</div>
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
                    <div class="item-icon">${service.icon || '🔧'}</div>
                    <div class="item-details">
                        <div class="item-name">${service.name}</div>
                    </div>
                    <div class="item-price">${service.cost} ◈</div>
                </div>
            `).join('');
        }
        
        // Standard item click handlers
        screen.querySelectorAll('.shop-item[data-type="card"], .shop-item[data-type="artifact"], .shop-item[data-type="service"]').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const index = parseInt(item.dataset.index);
                purchaseItem(type, index);
            });
        });
    }
    
    function getTypeIcon(type) {
        const icons = { attack: '⚔️', skill: '🛡️', power: '⚡', corrupted: '👁️' };
        return icons[type] || '📜';
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
                const corruption = game.state.get('corruption') || 0;
                game.state.set('corruption', Math.max(0, corruption - item.removes));
                game.eventBus.emit('corruption:lost', item.removes);
            }
        }
        
        displayShop(voidMerchant?.isRevealed || false);
    }
    
    function handleVoidPurchase(type, index) {
        if (!voidMerchant) return;
        
        let result = null;
        if (type === 'void-card') {
            result = voidMerchant.purchaseCard(index);
        } else if (type === 'void-artifact') {
            result = voidMerchant.purchaseArtifact(index);
        } else if (type === 'void-bargain') {
            result = voidMerchant.acceptBargain(index);
        }
        
        if (result) {
            displayShop(true);
        }
    }
    
    // ─── LEAVE SHOP BUTTON ───
    function setupLeaveButton() {
        // Try all possible selectors immediately
        const selectors = ['#btn-leave-shop', '#leave-shop', '.leave-btn'];
        
        function bindLeave() {
            for (const sel of selectors) {
                const btn = screen?.querySelector(sel) || document.querySelector(sel);
                if (btn) {
                    // Remove old listeners by cloning
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);
                    newBtn.addEventListener('click', leaveShop);
                    console.log('[ShopScreen] Leave button bound:', sel);
                    return true;
                }
            }
            return false;
        }
        
        if (!bindLeave()) {
            // Retry after DOM settles
            setTimeout(bindLeave, 300);
            setTimeout(bindLeave, 800);
        }
    }
    
    function leaveShop() {
        console.log('[ShopScreen] Leaving shop...');
        
        // Reset cached HTML for next visit
        standardShopHTML = '';
        
        try {
            game.mapGenerator.completeCurrentNode();
        } catch (e) {
            console.warn('[ShopScreen] completeCurrentNode failed:', e);
        }
        
        // Force transition with fallback
        try {
            game.screenManager.transitionTo('map-screen');
        } catch (e) {
            console.warn('[ShopScreen] Screen transition failed, using fallback:', e);
            document.querySelectorAll('.screen').forEach(s => {
                s.classList.remove('active');
                s.style.display = 'none';
            });
            const mapScreen = document.getElementById('map-screen');
            if (mapScreen) {
                mapScreen.classList.add('active');
                mapScreen.style.display = '';
            }
        }
    }
    
    return { generateShop, purchaseItem };
}
