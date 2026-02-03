/**
 * MapScreen - Node map screen handler
 * FIXED VERSION: Robust screen transitions, proper state sync
 * @version 0.2.3
 */

export function setupMapScreen(game) {
    console.log('[MapScreen] Setting up map screen...');
    
    const btnDeck = document.getElementById('btn-deck');
    const btnArtifacts = document.getElementById('btn-artifacts');
    const btnMapMenu = document.getElementById('btn-map-menu');
    const btnCloseDeck = document.getElementById('btn-close-deck');
    
    // Deck button
    if (btnDeck) {
        btnDeck.addEventListener('click', () => {
            try { game.audioManager.playSFX('ui_click'); } catch(e) {}
            if (typeof game.openDeckModal === 'function') {
                game.openDeckModal();
            } else {
                showDeckModal(game);
            }
        });
    }
    
    // Close deck modal
    if (btnCloseDeck) {
        btnCloseDeck.addEventListener('click', () => {
            const modal = document.getElementById('deck-modal');
            if (modal) modal.classList.remove('active');
        });
    }
    
    // Artifacts button
    if (btnArtifacts) {
        btnArtifacts.addEventListener('click', () => {
            try { game.audioManager.playSFX('ui_click'); } catch(e) {}
            showArtifacts(game);
        });
    }
    
    // Menu button
    if (btnMapMenu) {
        btnMapMenu.addEventListener('click', () => {
            try { game.audioManager.playSFX('ui_click'); } catch(e) {}
            if (typeof game.openSettingsModal === 'function') {
                game.openSettingsModal();
            }
        });
    }
    
    // FIX: Handle ALL event formats for screen:changed
    game.eventBus.on('screen:changed', (data) => {
        const screenId = typeof data === 'string' ? data : (data?.to || data);
        if (screenId === 'map-screen') {
            console.log('[MapScreen] Screen changed to map-screen, rendering...');
            setTimeout(() => renderMapScreen(game), 50);
        }
    });
    
    // Also listen for screen:show
    game.eventBus.on('screen:show', (screenId) => {
        if (screenId === 'map-screen') {
            console.log('[MapScreen] screen:show event, rendering...');
            setTimeout(() => renderMapScreen(game), 50);
        }
    });
    
    // Listen for map updates
    game.eventBus.on('map:updated', () => {
        console.log('[MapScreen] Map updated event, re-rendering...');
        renderMapScreen(game);
    });
    
    // Listen for map generation
    game.eventBus.on('map:generated', () => {
        console.log('[MapScreen] Map generated event, re-rendering...');
        renderMapScreen(game);
    });
    
    // FIX: Add delegated click handler as BACKUP
    const mapContainer = document.getElementById('map-nodes');
    if (mapContainer) {
        mapContainer.addEventListener('click', (e) => {
            const nodeEl = e.target.closest('.map-node');
            if (!nodeEl) return;
            
            // Only handle if available
            if (!nodeEl.classList.contains('available') && !nodeEl.classList.contains('accessible')) {
                return;
            }
            
            const nodeId = nodeEl.dataset.nodeId;
            if (!nodeId) return;
            
            console.log('[MapScreen] Delegated click on node:', nodeId);
            
            const map = game.state.get('map');
            if (map && map.nodes) {
                const node = map.nodes.find(n => n.id === nodeId);
                if (node) {
                    handleNodeClick(game, node);
                }
            }
        });
    }
    
    console.log('[MapScreen] Setup complete');
}

/**
 * Render the map screen
 */
function renderMapScreen(game) {
    console.log('[MapScreen] renderMapScreen called');
    
    // Update header stats
    updateMapHeader(game);
    
    // Get map data
    const map = game.state.get('map');
    const mapContainer = document.getElementById('map-nodes');
    
    if (!mapContainer) {
        console.error('[MapScreen] map-nodes container not found!');
        return;
    }
    
    if (!map || !map.nodes || map.nodes.length === 0) {
        console.warn('[MapScreen] No map data available');
        mapContainer.innerHTML = '<p class="no-map">No map data. Please refresh.</p>';
        return;
    }
    
    console.log(`[MapScreen] Rendering map with ${map.nodes.length} nodes`);
    
    const nodes = map.nodes;
    const currentNodeId = map.currentNode;
    const visitedNodes = map.visitedNodes || [];
    
    // Clear existing nodes
    mapContainer.innerHTML = '';
    
    // Render connections first (behind nodes)
    renderConnections(game, mapContainer, map);
    
    // Render nodes
    nodes.forEach(node => {
        const nodeEl = createNodeElement(node, currentNodeId, visitedNodes, game);
        mapContainer.appendChild(nodeEl);
    });
    
    // Debug: Count available nodes
    const availableCount = nodes.filter(n => n.available && !visitedNodes.includes(n.id)).length;
    console.log(`[MapScreen] Available nodes: ${availableCount}`);
    console.log('[MapScreen] Map rendering complete');
}

/**
 * Update map header with current stats
 */
function updateMapHeader(game) {
    const hpEl = document.getElementById('map-hp');
    const creditsEl = document.getElementById('map-credits');
    const corruptionEl = document.getElementById('map-corruption');
    const actTitle = document.getElementById('act-title');
    
    if (hpEl) {
        const hp = game.state.get('hero.hp') || 80;
        const maxHp = game.state.get('hero.maxHp') || 80;
        hpEl.textContent = `${hp}/${maxHp}`;
    }
    
    if (creditsEl) {
        const credits = game.state.get('credits') || 0;
        creditsEl.textContent = credits;
    }
    
    if (corruptionEl) {
        const corruption = game.state.get('corruption') || 0;
        corruptionEl.textContent = `${corruption}%`;
    }
    
    if (actTitle) {
        const act = game.state.get('act') || 1;
        const actNames = {
            1: 'ACT I: ASHES OF IRONSPINE',
            2: 'ACT II: THE FRACTURED CORE',
            3: 'ACT III: BEYOND THE VEIL'
        };
        actTitle.textContent = actNames[act] || `ACT ${act}`;
    }
}

/**
 * Create a node element
 */
function createNodeElement(node, currentNodeId, visitedNodes, game) {
    const el = document.createElement('div');
    el.className = `map-node node-${node.type}`;
    el.dataset.nodeId = node.id;
    
    // Position the node (using percentages)
    el.style.left = `${node.x}%`;
    el.style.top = `${100 - node.y}%`; // Invert Y so start is at bottom
    
    // Add state classes
    if (node.id === currentNodeId) {
        el.classList.add('current');
    }
    if (visitedNodes.includes(node.id)) {
        el.classList.add('visited');
    }
    
    // Check if node is available for clicking
    const isAvailable = node.available && !visitedNodes.includes(node.id);
    
    // Use both 'available' and 'accessible' for CSS compatibility
    if (isAvailable) {
        el.classList.add('available');
        el.classList.add('accessible');
    }
    
    // Node icons
    const icons = {
        combat: '⚔️',
        elite: '💀',
        event: '❓',
        shop: '🛒',
        rest: '🔥',
        treasure: '💎',
        boss: '👁️',
        start: '🚀'
    };
    
    el.innerHTML = `
        <div class="node-icon">${icons[node.type] || '•'}</div>
        <div class="node-glow"></div>
    `;
    
    // FIX: ALWAYS set pointer-events explicitly based on state
    if (isAvailable) {
        el.style.cursor = 'pointer';
        el.style.pointerEvents = 'auto';
        
        // Click handler
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`[MapScreen] Direct click on node: ${node.id} (${node.type})`);
            handleNodeClick(game, node);
        });
        
        // Touch handler for mobile
        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`[MapScreen] Touch on node: ${node.id} (${node.type})`);
            handleNodeClick(game, node);
        });
    } else {
        el.style.cursor = visitedNodes.includes(node.id) ? 'default' : 'not-allowed';
        el.style.pointerEvents = 'none';
    }
    
    return el;
}

/**
 * Render connections between nodes
 */
function renderConnections(game, container, map) {
    // Create SVG for connections
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;';
    
    const nodes = map.nodes;
    const paths = map.paths || [];
    const visitedNodes = map.visitedNodes || [];
    
    // Draw connections from paths array
    paths.forEach(path => {
        const fromNode = nodes.find(n => n.id === path.from);
        const toNode = nodes.find(n => n.id === path.to);
        
        if (!fromNode || !toNode) return;
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        
        // Convert percentage to viewBox coordinates
        line.setAttribute('x1', `${fromNode.x}%`);
        line.setAttribute('y1', `${100 - fromNode.y}%`);
        line.setAttribute('x2', `${toNode.x}%`);
        line.setAttribute('y2', `${100 - toNode.y}%`);
        
        // Style based on state
        const isVisited = visitedNodes.includes(fromNode.id) && visitedNodes.includes(toNode.id);
        const isAvailable = visitedNodes.includes(fromNode.id) && toNode.available;
        
        if (isVisited) {
            line.setAttribute('stroke', 'rgba(100, 100, 100, 0.5)');
            line.setAttribute('stroke-width', '2');
        } else if (isAvailable) {
            line.setAttribute('stroke', 'rgba(0, 245, 255, 0.5)');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-dasharray', '5,5');
        } else {
            line.setAttribute('stroke', 'rgba(50, 50, 50, 0.3)');
            line.setAttribute('stroke-width', '1');
        }
        
        svg.appendChild(line);
    });
    
    container.appendChild(svg);
}

/**
 * Handle node click - CRITICAL FUNCTION
 * FIXED: More robust screen transitions, proper state sync, better logging
 */
function handleNodeClick(game, node) {
    console.log(`[MapScreen] ╔══════════════════════════════════════╗`);
    console.log(`[MapScreen] ║     NODE CLICKED                     ║`);
    console.log(`[MapScreen] ╚══════════════════════════════════════╝`);
    console.log(`[MapScreen] Node: ${node.id} | Type: ${node.type}`);
    console.log(`[MapScreen] Current screen: ${game.screenManager?.currentScreen}`);
    
    // Play click sound
    try {
        game.audioManager.playSFX('ui_click');
    } catch (e) {}
    
    // Select the node in MapGenerator
    try {
        if (game.mapGenerator && typeof game.mapGenerator.selectNode === 'function') {
            const selected = game.mapGenerator.selectNode(node.id);
            console.log(`[MapScreen] selectNode returned: ${selected}`);
        }
    } catch (e) {
        console.error('[MapScreen] Error in selectNode:', e);
    }
    
    // Backup: Manually mark the node visited in state
    try {
        const map = game.state.get('map');
        if (map) {
            const mapNode = map.nodes.find(n => n.id === node.id);
            if (mapNode) {
                mapNode.visited = true;
                mapNode.available = false;
                if (!map.visitedNodes) map.visitedNodes = [];
                if (!map.visitedNodes.includes(node.id)) {
                    map.visitedNodes.push(node.id);
                }
                map.currentNode = node.id;
                game.state.set('map', map);
            }
        }
    } catch (e) {
        console.error('[MapScreen] Error updating map state:', e);
    }
    
    // CRITICAL: Handle node type and transition
    console.log(`[MapScreen] Processing node type: "${node.type}" (typeof: ${typeof node.type})`);
    
    // FIX: Reset ScreenManager transitioning flag if stuck
    if (game.screenManager && game.screenManager.transitioning) {
        console.warn('[MapScreen] ScreenManager was stuck in transitioning state - resetting');
        game.screenManager.transitioning = false;
    }
    
    // FIX: Normalize node type (trim, lowercase)
    const nodeType = (node.type || '').toString().trim().toLowerCase();
    console.log(`[MapScreen] Normalized node type: "${nodeType}"`);
    
    switch (nodeType) {
        case 'combat':
            console.log('[MapScreen] → Dispatching to startCombat(normal)');
            startCombat(game, 'normal');
            break;
        case 'elite':
            console.log('[MapScreen] → Dispatching to startCombat(elite)');
            startCombat(game, 'elite');
            break;
        case 'boss':
            console.log('[MapScreen] → Dispatching to startCombat(boss)');
            startCombat(game, 'boss');
            break;
        case 'event':
            console.log('[MapScreen] → Dispatching to startEvent');
            startEvent(game);
            break;
        case 'shop':
            console.log('[MapScreen] → Transitioning to shop-screen');
            forceScreenTransition(game, 'shop-screen');
            break;
        case 'rest':
            console.log('[MapScreen] → Transitioning to rest-screen');
            forceScreenTransition(game, 'rest-screen');
            break;
        case 'treasure':
            console.log('[MapScreen] → Opening treasure');
            handleTreasure(game);
            break;
        case 'start':
            console.log('[MapScreen] → Start node (re-render map)');
            renderMapScreen(game);
            break;
        default:
            console.warn(`[MapScreen] Unknown/empty node type: "${nodeType}" - defaulting to combat`);
            startCombat(game, 'normal');
    }
    
    console.log(`[MapScreen] handleNodeClick END`);
}

/**
 * CRITICAL FIX: Force screen transition even if ScreenManager fails
 * IMPROVED: Always force visibility regardless of class state
 */
function forceScreenTransition(game, targetScreenId) {
    console.log(`[MapScreen] forceScreenTransition to: ${targetScreenId}`);
    
    const mapScreen = document.getElementById('map-screen');
    const targetScreen = document.getElementById(targetScreenId);
    
    if (!targetScreen) {
        console.error(`[MapScreen] Target screen not found: ${targetScreenId}`);
        return;
    }
    
    // STEP 1: Immediately hide the map screen to prevent visual overlap
    if (mapScreen) {
        console.log('[MapScreen] Hiding map-screen immediately');
        mapScreen.classList.remove('active', 'fade-in');
        mapScreen.classList.add('fade-out');
    }
    
    // STEP 2: Try normal ScreenManager transition
    try {
        if (game.screenManager) {
            game.screenManager.transitioning = false;
            game.screenManager.transitionTo(targetScreenId);
            console.log('[MapScreen] ScreenManager.transitionTo called');
        }
    } catch (e) {
        console.error('[MapScreen] screenManager.transitionTo failed:', e);
    }
    
    // STEP 3: ALWAYS force the transition after a delay (don't check for 'active')
    setTimeout(() => {
        console.log(`[MapScreen] Force-showing ${targetScreenId} (backup)`);
        
        // Hide ALL other screens first
        document.querySelectorAll('.screen').forEach(screen => {
            if (screen.id !== targetScreenId) {
                screen.classList.remove('active', 'fade-in');
                screen.style.cssText = '';  // Clear any inline styles
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
        game.eventBus.emit('screen:changed', { to: targetScreenId, from: 'map-screen' });
        game.eventBus.emit('screen:show', targetScreenId);
        game.eventBus.emit('screen:change', targetScreenId);
        
        console.log(`[MapScreen] Force transition complete. Target screen visible: ${targetScreen.classList.contains('active')}`);
    }, 100);  // Reduced delay for faster transition
}

/**
 * Start combat encounter - CRITICAL FUNCTION
 * FIXED: Better logging, pendingCombat storage, error handling
 */
function startCombat(game, difficulty) {
    console.log(`[MapScreen] ╔══════════════════════════════════════╗`);
    console.log(`[MapScreen] ║     STARTING COMBAT                  ║`);
    console.log(`[MapScreen] ╚══════════════════════════════════════╝`);
    console.log(`[MapScreen] Difficulty: ${difficulty}`);
    console.log(`[MapScreen] Current screen: ${game.screenManager?.currentScreen}`);
    
    const act = game.state.get('act') || 1;
    console.log(`[MapScreen] Current Act: ${act}`);
    
    let enemies = null;
    
    // Try to get enemies from DataLoader
    try {
        console.log(`[MapScreen] Attempting to get enemies from DataLoader...`);
        if (game.dataLoader) {
            if (difficulty === 'boss') {
                const boss = game.dataLoader.getBossForAct ? 
                    game.dataLoader.getBossForAct(act) : 
                    game.dataLoader.getBoss?.(act);
                enemies = boss ? [boss] : null;
                console.log(`[MapScreen] Got boss:`, boss?.name || 'none');
            } else if (difficulty === 'elite') {
                enemies = game.dataLoader.getEliteEncounter?.(act) || 
                          game.dataLoader.getEnemiesForAct?.(act, 'elite');
                console.log(`[MapScreen] Got elite encounter:`, enemies?.length || 0, 'enemies');
            } else {
                enemies = game.dataLoader.getRandomEncounter?.(act) || 
                          game.dataLoader.getEnemiesForAct?.(act, 'normal');
                console.log(`[MapScreen] Got normal encounter:`, enemies?.length || 0, 'enemies');
            }
        } else {
            console.warn(`[MapScreen] DataLoader not available`);
        }
    } catch (e) {
        console.warn('[MapScreen] Failed to get enemies from DataLoader:', e.message);
        enemies = null;
    }
    
    // Use fallback enemies if DataLoader fails
    if (!enemies || (Array.isArray(enemies) && enemies.length === 0)) {
        console.log('[MapScreen] Using fallback enemies');
        enemies = getFallbackEnemies(difficulty, act);
    }
    
    console.log(`[MapScreen] Final enemies:`, enemies?.map(e => `${e.name} (${e.hp}HP)`));
    
    // Ensure we have valid enemies
    if (!enemies || (Array.isArray(enemies) && enemies.length === 0)) {
        console.error('[MapScreen] CRITICAL: No enemies available!');
        enemies = getFallbackEnemies('normal', 1);
    }
    
    // CRITICAL FIX: Store pendingCombat in state BEFORE anything else
    // This ensures CombatScreen can start combat even if the call below fails
    console.log('[MapScreen] Storing pending combat in state...');
    game.state.set('pendingCombat', {
        enemies: enemies,
        difficulty: difficulty,
        act: act,
        timestamp: Date.now()
    });
    
    // FIX: Reset transitioning flag before combat
    if (game.screenManager) {
        game.screenManager.transitioning = false;
    }
    
    // Start combat
    let combatStarted = false;
    try {
        if (game.combat && typeof game.combat.startCombat === 'function') {
            console.log('[MapScreen] Calling game.combat.startCombat()...');
            const result = game.combat.startCombat(enemies);
            combatStarted = (result !== false);
            console.log(`[MapScreen] startCombat completed. inCombat: ${game.combat.inCombat}`);
            
            // Clear pendingCombat if successful
            if (game.combat.inCombat) {
                game.state.set('pendingCombat', null);
                console.log('[MapScreen] Combat started successfully, cleared pendingCombat');
            }
        } else {
            console.error('[MapScreen] Combat system not available!');
            console.log('[MapScreen] game.combat:', typeof game.combat);
            console.log('[MapScreen] game.combat.startCombat:', typeof game.combat?.startCombat);
        }
    } catch (e) {
        console.error('[MapScreen] Error starting combat:', e);
        console.error('[MapScreen] Stack:', e.stack);
        // pendingCombat remains set so CombatScreen can try to start it
    }
    
    // ALWAYS transition to combat screen
    console.log('[MapScreen] Transitioning to combat-screen...');
    forceScreenTransition(game, 'combat-screen');
    
    console.log(`[MapScreen] ╚══════════════════════════════════════╝`);
}

/**
 * Get fallback enemies when DataLoader fails
 */
function getFallbackEnemies(difficulty, act = 1) {
    const fallbackEnemies = {
        normal: [
            { 
                id: 'rustborn_raider', 
                name: 'Rustborn Raider', 
                type: 'basic',
                hp: 18 + (act * 4), 
                maxHp: 18 + (act * 4), 
                block: 0, 
                intents: [
                    { type: 'attack', damage: 5 + act },
                    { type: 'attack', damage: 7 + act },
                    { type: 'block', value: 5 }
                ]
            }
        ],
        elite: [
            { 
                id: 'scrap_golem', 
                name: 'Scrap Golem', 
                type: 'elite',
                hp: 40 + (act * 10), 
                maxHp: 40 + (act * 10), 
                block: 0, 
                intents: [
                    { type: 'attack', damage: 10 + act * 2 },
                    { type: 'block', value: 10 },
                    { type: 'attack', damage: 14 + act * 2 }
                ]
            }
        ],
        boss: [
            { 
                id: 'scrap_king', 
                name: 'The Scrap-King', 
                type: 'boss',
                hp: 80 + (act * 25), 
                maxHp: 80 + (act * 25), 
                block: 0, 
                intents: [
                    { type: 'attack', damage: 12 + act * 3 },
                    { type: 'buff', effect: 'strength', value: 2 },
                    { type: 'attack', damage: 8 + act * 2, times: 2 },
                    { type: 'block', value: 15 }
                ]
            }
        ]
    };
    
    return fallbackEnemies[difficulty] || fallbackEnemies.normal;
}

/**
 * Start event encounter
 */
function startEvent(game) {
    console.log('[MapScreen] Starting event...');
    
    // Try to get event from DataLoader
    let event = null;
    try {
        if (game.dataLoader && typeof game.dataLoader.getRandomEvent === 'function') {
            const act = game.state.get('act') || 1;
            event = game.dataLoader.getRandomEvent(act);
        }
    } catch (e) {
        console.warn('[MapScreen] Failed to get event:', e);
    }
    
    // Use fallback event
    if (!event) {
        event = {
            id: 'mysterious_merchant',
            name: 'Mysterious Merchant',
            description: 'A cloaked figure emerges from the shadows, offering wares of questionable origin.',
            choices: [
                { 
                    text: 'Browse the wares', 
                    effect: 'shop',
                    description: 'Open a small shop interface'
                },
                { 
                    text: 'Attack the merchant', 
                    effect: 'combat',
                    description: 'Start a combat encounter'
                },
                { 
                    text: 'Walk away', 
                    effect: 'leave',
                    description: 'Return to the map'
                }
            ]
        };
    }
    
    // Store event in state
    game.state.set('currentEvent', event);
    game.state.set('event.currentEvent', event);
    
    // Transition to event screen
    forceScreenTransition(game, 'event-screen');
}

/**
 * Handle treasure node
 */
function handleTreasure(game) {
    console.log('[MapScreen] Opening treasure...');
    
    // Generate random rewards
    const credits = Math.floor(Math.random() * 50) + 25;
    game.state.set('credits', (game.state.get('credits') || 0) + credits);
    
    // Try to use reward system
    try {
        if (game.rewards && typeof game.rewards.generateTreasureRewards === 'function') {
            game.rewards.generateTreasureRewards();
            forceScreenTransition(game, 'reward-screen');
            return;
        }
    } catch (e) {
        console.warn('[MapScreen] Reward system not available:', e);
    }
    
    // Fallback: Show alert and re-render map
    alert(`Found ${credits} credits!`);
    renderMapScreen(game);
}

/**
 * Show deck modal
 */
function showDeckModal(game) {
    let modal = document.getElementById('deck-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'deck-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Your Deck</h3>
                <div class="deck-cards"></div>
                <button class="btn-close-modal" id="btn-close-deck">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('#btn-close-deck').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    // Populate deck
    const deck = game.state.get('deck') || [];
    const cardsContainer = modal.querySelector('.deck-cards');
    
    cardsContainer.innerHTML = deck.map(card => `
        <div class="deck-card type-${card.type || 'skill'}">
            <span class="card-cost">${card.cost || 0}</span>
            <span class="card-name">${card.name || 'Unknown'}</span>
        </div>
    `).join('') || '<p>No cards in deck</p>';
    
    modal.classList.add('active');
}

/**
 * Show artifacts modal
 */
function showArtifacts(game) {
    let modal = document.getElementById('artifacts-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'artifacts-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Artifacts</h3>
                <div class="artifacts-list"></div>
                <button class="btn-close-modal">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.btn-close-modal').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    // Populate artifacts
    const artifacts = game.state.get('artifacts') || [];
    const artifactsContainer = modal.querySelector('.artifacts-list');
    
    artifactsContainer.innerHTML = artifacts.map(artifact => `
        <div class="artifact-item">
            <span class="artifact-icon">${artifact.icon || '💎'}</span>
            <div class="artifact-info">
                <span class="artifact-name">${artifact.name || 'Unknown Artifact'}</span>
                <span class="artifact-desc">${artifact.description || ''}</span>
            </div>
        </div>
    `).join('') || '<p>No artifacts collected</p>';
    
    modal.classList.add('active');
}
