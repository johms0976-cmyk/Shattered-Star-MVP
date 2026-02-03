/**
 * MapScreen - Node map screen handler
 * UPDATED: Scrollable map + shop/rest event fixes
 * @version 0.3.1
 * 
 * Changes:
 * - Map now extends 3.5x viewport height, only ~25-30% visible at once
 * - Player can scroll vertically to see full map
 * - Paths rendered as curved bezier lines with glow effects
 * - Available paths pulsate and show directional arrows
 * - Auto-scroll to current position on load
 * - FIX: Emits shop:enter and rest:enter events before screen transitions
 */

export function setupMapScreen(game) {
    console.log('[MapScreen] Setting up map screen v0.3.1 (scrollable + shop fix)...');
    
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
    
    // Handle screen:changed events
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
    
    // Add delegated click handler as BACKUP
    const mapContainer = document.getElementById('map-nodes');
    if (mapContainer) {
        mapContainer.addEventListener('click', (e) => {
            const nodeEl = e.target.closest('.map-node');
            if (!nodeEl) return;
            
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

// Configuration for scrollable map
const MAP_CONFIG = {
    heightMultiplier: 3.5,
    nodeSize: 60,
    verticalPadding: 80,
    pathCurveIntensity: 0.4,
    scrollAnimationDuration: 500
};

function renderMapScreen(game) {
    console.log('[MapScreen] renderMapScreen called (scrollable version)');
    
    updateMapHeader(game);
    
    const map = game.state.get('map');
    const mapContainer = document.getElementById('map-container') || document.querySelector('.map-container');
    const mapNodes = document.getElementById('map-nodes');
    
    if (!mapContainer || !mapNodes) {
        console.error('[MapScreen] map-container or map-nodes not found!');
        return;
    }
    
    if (!map || !map.nodes || map.nodes.length === 0) {
        console.warn('[MapScreen] No map data available');
        mapNodes.innerHTML = '<p class="no-map">No map data. Please refresh.</p>';
        return;
    }
    
    console.log(`[MapScreen] Rendering scrollable map with ${map.nodes.length} nodes`);
    
    setupScrollableMap(mapContainer, mapNodes, map);
    
    const nodes = map.nodes;
    const currentNodeId = map.currentNode;
    const visitedNodes = map.visitedNodes || [];
    
    mapNodes.innerHTML = '';
    
    const containerHeight = mapContainer.clientHeight;
    const mapHeight = containerHeight * MAP_CONFIG.heightMultiplier;
    
    mapNodes.style.height = `${mapHeight}px`;
    mapNodes.style.position = 'relative';
    
    renderEnhancedConnections(game, mapNodes, map, mapHeight);
    
    nodes.forEach(node => {
        const nodeEl = createNodeElement(node, currentNodeId, visitedNodes, game, mapHeight);
        mapNodes.appendChild(nodeEl);
    });
    
    scrollToCurrentPosition(mapContainer, map, mapHeight);
    
    const availableCount = nodes.filter(n => n.available && !visitedNodes.includes(n.id)).length;
    console.log(`[MapScreen] Available nodes: ${availableCount}`);
}

function setupScrollableMap(container, mapNodes, map) {
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    container.style.position = 'relative';
    
    let scrollIndicator = container.querySelector('.scroll-indicator');
    if (!scrollIndicator) {
        scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'scroll-indicator';
        scrollIndicator.innerHTML = `
            <div class="scroll-hint scroll-hint-up" style="display: none;">
                <span class="scroll-arrow">▲</span>
                <span class="scroll-text">Scroll up</span>
            </div>
            <div class="scroll-hint scroll-hint-down">
                <span class="scroll-arrow">▼</span>
                <span class="scroll-text">Scroll down</span>
            </div>
        `;
        container.appendChild(scrollIndicator);
        
        container.addEventListener('scroll', () => {
            updateScrollIndicators(container);
        });
    }
}

function updateScrollIndicators(container) {
    const scrollIndicator = container.querySelector('.scroll-indicator');
    if (!scrollIndicator) return;
    
    const hintUp = scrollIndicator.querySelector('.scroll-hint-up');
    const hintDown = scrollIndicator.querySelector('.scroll-hint-down');
    
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    if (hintUp) {
        hintUp.style.display = scrollTop > 50 ? 'flex' : 'none';
    }
    
    if (hintDown) {
        hintDown.style.display = (scrollTop + clientHeight) < (scrollHeight - 50) ? 'flex' : 'none';
    }
}

function scrollToCurrentPosition(container, map, mapHeight) {
    let targetNode = null;
    
    if (map.currentNode) {
        targetNode = map.nodes.find(n => n.id === map.currentNode);
    }
    
    if (!targetNode) {
        const visitedNodes = map.visitedNodes || [];
        targetNode = map.nodes.find(n => n.available && !visitedNodes.includes(n.id));
    }
    
    if (!targetNode) {
        targetNode = map.nodes.find(n => n.layer === 0);
    }
    
    if (targetNode) {
        const nodeYPercent = 100 - targetNode.y;
        const nodeYPixels = (nodeYPercent / 100) * mapHeight;
        const containerHeight = container.clientHeight;
        const scrollTarget = nodeYPixels - (containerHeight / 2);
        
        setTimeout(() => {
            container.scrollTo({
                top: Math.max(0, scrollTarget),
                behavior: 'smooth'
            });
        }, 100);
    }
}

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

function createNodeElement(node, currentNodeId, visitedNodes, game, mapHeight) {
    const el = document.createElement('div');
    el.className = `map-node node-${node.type}`;
    el.dataset.nodeId = node.id;
    
    const xPercent = node.x;
    const yPercent = 100 - node.y;
    
    el.style.left = `${xPercent}%`;
    el.style.top = `${yPercent}%`;
    
    if (node.id === currentNodeId) {
        el.classList.add('current');
    }
    if (visitedNodes.includes(node.id)) {
        el.classList.add('visited');
    }
    
    const isAvailable = node.available && !visitedNodes.includes(node.id);
    
    if (isAvailable) {
        el.classList.add('available');
        el.classList.add('accessible');
    }
    
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
    
    if (isAvailable) {
        el.style.cursor = 'pointer';
        el.style.pointerEvents = 'auto';
        
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNodeClick(game, node);
        });
        
        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNodeClick(game, node);
        });
    } else {
        el.style.cursor = visitedNodes.includes(node.id) ? 'default' : 'not-allowed';
        el.style.pointerEvents = 'none';
    }
    
    return el;
}

function renderEnhancedConnections(game, container, map, mapHeight) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
    `;
    svg.setAttribute('preserveAspectRatio', 'none');
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <filter id="pathGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
        <filter id="pathGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    `;
    svg.appendChild(defs);
    
    const nodes = map.nodes;
    const paths = map.paths || [];
    const visitedNodes = map.visitedNodes || [];
    const currentNode = map.currentNode;
    
    const sortedPaths = [...paths].sort((a, b) => {
        const aFromVisited = visitedNodes.includes(a.from);
        const aToAvailable = nodes.find(n => n.id === a.to)?.available;
        const bFromVisited = visitedNodes.includes(b.from);
        const bToAvailable = nodes.find(n => n.id === b.to)?.available;
        
        const aIsAvailable = aFromVisited && aToAvailable;
        const bIsAvailable = bFromVisited && bToAvailable;
        
        if (aIsAvailable && !bIsAvailable) return 1;
        if (!aIsAvailable && bIsAvailable) return -1;
        return 0;
    });
    
    sortedPaths.forEach(path => {
        const fromNode = nodes.find(n => n.id === path.from);
        const toNode = nodes.find(n => n.id === path.to);
        
        if (!fromNode || !toNode) return;
        
        const isVisited = visitedNodes.includes(fromNode.id) && visitedNodes.includes(toNode.id);
        const isAvailable = visitedNodes.includes(fromNode.id) && toNode.available;
        const isFromCurrent = fromNode.id === currentNode;
        
        const x1 = fromNode.x;
        const y1 = 100 - fromNode.y;
        const x2 = toNode.x;
        const y2 = 100 - toNode.y;
        
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const curveOffset = dx * MAP_CONFIG.pathCurveIntensity;
        
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const pathD = `M ${x1}% ${y1}% Q ${x1 + curveOffset}% ${midY}%, ${x2}% ${y2}%`;
        pathEl.setAttribute('d', pathD);
        pathEl.classList.add('map-path');
        
        if (isVisited) {
            pathEl.classList.add('visited');
            pathEl.setAttribute('stroke', 'rgba(80, 80, 100, 0.4)');
            pathEl.setAttribute('stroke-width', '2');
            pathEl.setAttribute('stroke-dasharray', '4,4');
        } else if (isAvailable) {
            pathEl.classList.add('available');
            if (isFromCurrent) {
                pathEl.setAttribute('stroke', 'rgba(0, 245, 255, 0.9)');
                pathEl.setAttribute('stroke-width', '3');
                pathEl.setAttribute('filter', 'url(#pathGlowStrong)');
            } else {
                pathEl.setAttribute('stroke', 'rgba(0, 245, 255, 0.6)');
                pathEl.setAttribute('stroke-width', '2.5');
                pathEl.setAttribute('filter', 'url(#pathGlow)');
            }
        } else {
            pathEl.setAttribute('stroke', 'rgba(40, 40, 50, 0.3)');
            pathEl.setAttribute('stroke-width', '1.5');
            pathEl.setAttribute('stroke-dasharray', '3,6');
        }
        
        svg.appendChild(pathEl);
        
        if (isAvailable && isFromCurrent) {
            addDirectionArrow(svg, x1, y1, x2, y2, curveOffset);
        }
    });
    
    container.appendChild(svg);
}

function addDirectionArrow(svg, x1, y1, x2, y2, curveOffset) {
    const t = 0.6;
    const midY = (y1 + y2) / 2;
    
    const px = (1-t)*(1-t)*x1 + 2*(1-t)*t*(x1 + curveOffset) + t*t*x2;
    const py = (1-t)*(1-t)*y1 + 2*(1-t)*t*midY + t*t*y2;
    
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrow.setAttribute('points', '-6,-4 6,0 -6,4');
    arrow.setAttribute('transform', `translate(${px}%, ${py}%) rotate(${angle})`);
    arrow.setAttribute('fill', 'rgba(0, 245, 255, 0.9)');
    arrow.setAttribute('filter', 'url(#pathGlow)');
    arrow.classList.add('path-arrow');
    
    svg.appendChild(arrow);
}

function handleNodeClick(game, node) {
    console.log(`[MapScreen] ╔══════════════════════════════════════╗`);
    console.log(`[MapScreen] ║     NODE CLICKED                     ║`);
    console.log(`[MapScreen] ╚══════════════════════════════════════╝`);
    console.log(`[MapScreen] Node: ${node.id} | Type: ${node.type}`);
    
    try {
        game.audioManager.playSFX('ui_click');
    } catch (e) {}
    
    try {
        if (game.mapGenerator && typeof game.mapGenerator.selectNode === 'function') {
            game.mapGenerator.selectNode(node.id);
        }
    } catch (e) {
        console.error('[MapScreen] Error in selectNode:', e);
    }
    
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
    
    if (game.screenManager && game.screenManager.transitioning) {
        game.screenManager.transitioning = false;
    }
    
    const nodeType = (node.type || '').toString().trim().toLowerCase();
    
    switch (nodeType) {
        case 'combat':
            startCombat(game, 'normal');
            break;
        case 'elite':
            startCombat(game, 'elite');
            break;
        case 'boss':
            startCombat(game, 'boss');
            break;
        case 'event':
            startEvent(game);
            break;
        case 'shop':
            startShop(game);
            break;
        case 'rest':
            startRest(game);
            break;
        case 'treasure':
            handleTreasure(game);
            break;
        case 'start':
            renderMapScreen(game);
            break;
        default:
            startCombat(game, 'normal');
    }
}

/**
 * Start shop - FIXED: Emits shop:enter event before transition
 */
function startShop(game) {
    console.log('[MapScreen] ╔══════════════════════════════════════╗');
    console.log('[MapScreen] ║     ENTERING SHOP                    ║');
    console.log('[MapScreen] ╚══════════════════════════════════════╝');
    
    // CRITICAL FIX: Emit shop:enter event so ShopScreen generates inventory
    console.log('[MapScreen] Emitting shop:enter event...');
    game.eventBus.emit('shop:enter');
    
    setTimeout(() => {
        forceScreenTransition(game, 'shop-screen');
    }, 50);
}

/**
 * Start rest - FIXED: Emits rest:enter event before transition
 */
function startRest(game) {
    console.log('[MapScreen] ╔══════════════════════════════════════╗');
    console.log('[MapScreen] ║     ENTERING REST SITE               ║');
    console.log('[MapScreen] ╚══════════════════════════════════════╝');
    
    console.log('[MapScreen] Emitting rest:enter event...');
    game.eventBus.emit('rest:enter');
    
    setTimeout(() => {
        forceScreenTransition(game, 'rest-screen');
    }, 50);
}

function forceScreenTransition(game, targetScreen) {
    console.log(`[MapScreen] forceScreenTransition to: ${targetScreen}`);
    
    if (game.screenManager) {
        try {
            game.screenManager.transitioning = false;
            game.screenManager.showScreen(targetScreen);
            
            setTimeout(() => {
                const targetEl = document.getElementById(targetScreen);
                if (targetEl && !targetEl.classList.contains('active')) {
                    forceShowScreen(targetScreen);
                }
            }, 200);
            
            return;
        } catch (e) {
            console.error('[MapScreen] ScreenManager.showScreen failed:', e);
        }
    }
    
    forceShowScreen(targetScreen);
}

function forceShowScreen(screenId) {
    console.log(`[MapScreen] Force showing screen: ${screenId}`);
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'flex';
        targetScreen.style.opacity = '1';
    }
}

function startCombat(game, difficulty) {
    console.log(`[MapScreen] Starting ${difficulty} combat...`);
    
    const act = game.state.get('act') || 1;
    let enemies = null;
    
    try {
        if (game.dataLoader && typeof game.dataLoader.getEnemiesForEncounter === 'function') {
            enemies = game.dataLoader.getEnemiesForEncounter(difficulty, act);
        }
    } catch (e) {
        console.warn('[MapScreen] Failed to get enemies from DataLoader:', e);
    }
    
    if (!enemies || enemies.length === 0) {
        enemies = getFallbackEnemies(difficulty, act);
    }
    
    game.state.set('pendingCombat', { difficulty, enemies, act });
    
    if (game.screenManager) {
        game.screenManager.transitioning = false;
    }
    
    try {
        if (game.combat && typeof game.combat.startCombat === 'function') {
            game.combat.startCombat(enemies);
            if (game.combat.inCombat) {
                game.state.set('pendingCombat', null);
            }
        }
    } catch (e) {
        console.error('[MapScreen] Error starting combat:', e);
    }
    
    forceScreenTransition(game, 'combat-screen');
}

function getFallbackEnemies(difficulty, act = 1) {
    const fallbackEnemies = {
        normal: [{ 
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
        }],
        elite: [{ 
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
        }],
        boss: [{ 
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
        }]
    };
    
    return fallbackEnemies[difficulty] || fallbackEnemies.normal;
}

function startEvent(game) {
    let event = null;
    try {
        if (game.dataLoader && typeof game.dataLoader.getRandomEvent === 'function') {
            event = game.dataLoader.getRandomEvent(game.state.get('act') || 1);
        }
    } catch (e) {}
    
    if (!event) {
        event = {
            id: 'mysterious_merchant',
            name: 'Mysterious Merchant',
            description: 'A cloaked figure emerges from the shadows, offering wares of questionable origin.',
            choices: [
                { text: 'Browse the wares', effect: 'shop', description: 'Open a small shop interface' },
                { text: 'Attack the merchant', effect: 'combat', description: 'Start a combat encounter' },
                { text: 'Walk away', effect: 'leave', description: 'Return to the map' }
            ]
        };
    }
    
    game.state.set('currentEvent', event);
    game.state.set('event.currentEvent', event);
    forceScreenTransition(game, 'event-screen');
}

function handleTreasure(game) {
    const credits = Math.floor(Math.random() * 50) + 25;
    game.state.set('credits', (game.state.get('credits') || 0) + credits);
    
    try {
        if (game.rewards && typeof game.rewards.generateTreasureRewards === 'function') {
            game.rewards.generateTreasureRewards();
            forceScreenTransition(game, 'reward-screen');
            return;
        }
    } catch (e) {}
    
    alert(`Found ${credits} credits!`);
    renderMapScreen(game);
}

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
