/**
 * MapScreen - Node map screen handler
 * UPDATED: Scrollable map with enhanced path visualization
 * @version 0.3.0
 * 
 * Changes:
 * - Map now extends 3-4x viewport height, only ~25-30% visible at once
 * - Player can scroll vertically to see full map
 * - Paths rendered as curved bezier lines with glow effects
 * - Available paths pulsate and show directional arrows
 * - Auto-scroll to current position on load
 */

export function setupMapScreen(game) {
    console.log('[MapScreen] Setting up map screen v0.3.0 (scrollable)...');
    
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
 * Configuration for scrollable map
 */
const MAP_CONFIG = {
    // Map height as multiplier of viewport (3.5x = ~28% visible at once)
    heightMultiplier: 3.5,
    // Node size in pixels
    nodeSize: 60,
    // Padding at top/bottom in pixels
    verticalPadding: 80,
    // Path curve intensity (0 = straight, 1 = very curved)
    pathCurveIntensity: 0.4,
    // Animation duration for scroll
    scrollAnimationDuration: 500
};

/**
 * Render the map screen
 */
function renderMapScreen(game) {
    console.log('[MapScreen] renderMapScreen called (scrollable version)');
    
    // Update header stats
    updateMapHeader(game);
    
    // Get map data
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
    
    // Setup scrollable container
    setupScrollableMap(mapContainer, mapNodes, map);
    
    const nodes = map.nodes;
    const currentNodeId = map.currentNode;
    const visitedNodes = map.visitedNodes || [];
    
    // Clear existing nodes
    mapNodes.innerHTML = '';
    
    // Calculate the total height of the map content
    const containerHeight = mapContainer.clientHeight;
    const mapHeight = containerHeight * MAP_CONFIG.heightMultiplier;
    
    // Set the inner content height
    mapNodes.style.height = `${mapHeight}px`;
    mapNodes.style.position = 'relative';
    
    // Render connections first (behind nodes) with enhanced visualization
    renderEnhancedConnections(game, mapNodes, map, mapHeight);
    
    // Render nodes with adjusted positions for extended height
    nodes.forEach(node => {
        const nodeEl = createNodeElement(node, currentNodeId, visitedNodes, game, mapHeight);
        mapNodes.appendChild(nodeEl);
    });
    
    // Auto-scroll to current position or first available node
    scrollToCurrentPosition(mapContainer, map, mapHeight);
    
    // Debug: Count available nodes
    const availableCount = nodes.filter(n => n.available && !visitedNodes.includes(n.id)).length;
    console.log(`[MapScreen] Available nodes: ${availableCount}`);
    console.log('[MapScreen] Map rendering complete');
}

/**
 * Setup scrollable map container
 */
function setupScrollableMap(container, mapNodes, map) {
    // Enable scrolling on the container
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    container.style.position = 'relative';
    
    // Add scroll indicator if not present
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
        
        // Update scroll indicators on scroll
        container.addEventListener('scroll', () => {
            updateScrollIndicators(container);
        });
    }
    
    // Add CSS for scroll indicators if not present
    addScrollIndicatorStyles();
}

/**
 * Add scroll indicator styles
 */
function addScrollIndicatorStyles() {
    if (document.getElementById('map-scroll-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'map-scroll-styles';
    style.textContent = `
        .scroll-indicator {
            position: fixed;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            pointer-events: none;
        }
        
        .scroll-hint {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(0, 245, 255, 0.3);
            border-radius: 20px;
            color: rgba(0, 245, 255, 0.8);
            font-size: 0.75rem;
            letter-spacing: 0.1em;
            animation: scrollHintPulse 2s ease-in-out infinite;
        }
        
        .scroll-hint-up {
            position: fixed;
            top: 80px;
        }
        
        .scroll-hint-down {
            position: fixed;
            bottom: 20px;
        }
        
        .scroll-arrow {
            font-size: 1.2rem;
            animation: scrollArrowBounce 1s ease-in-out infinite;
        }
        
        .scroll-hint-up .scroll-arrow {
            animation: scrollArrowBounceUp 1s ease-in-out infinite;
        }
        
        @keyframes scrollHintPulse {
            0%, 100% { opacity: 0.8; }
            50% { opacity: 0.4; }
        }
        
        @keyframes scrollArrowBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(5px); }
        }
        
        @keyframes scrollArrowBounceUp {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        
        /* Enhanced path styles */
        .map-path {
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        
        .map-path.available {
            filter: url(#pathGlow);
            animation: pathPulse 2s ease-in-out infinite;
        }
        
        .map-path.visited {
            opacity: 0.4;
        }
        
        @keyframes pathPulse {
            0%, 100% { 
                stroke-opacity: 0.8;
                stroke-width: 3;
            }
            50% { 
                stroke-opacity: 1;
                stroke-width: 4;
            }
        }
        
        /* Path direction arrows */
        .path-arrow {
            fill: rgba(0, 245, 255, 0.8);
            animation: arrowPulse 1.5s ease-in-out infinite;
        }
        
        @keyframes arrowPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }
        
        /* Scrollable map specific */
        .map-container {
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
        }
        
        .map-nodes {
            min-height: 100%;
        }
        
        /* Node pulse for available nodes */
        .map-node.available::after,
        .map-node.accessible::after {
            content: '';
            position: absolute;
            top: -10px;
            left: -10px;
            right: -10px;
            bottom: -10px;
            border: 2px solid rgba(0, 245, 255, 0.5);
            border-radius: 50%;
            animation: nodeAvailablePulse 2s ease-in-out infinite;
        }
        
        @keyframes nodeAvailablePulse {
            0%, 100% { 
                transform: scale(1);
                opacity: 0.5;
            }
            50% { 
                transform: scale(1.2);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Update scroll indicators based on scroll position
 */
function updateScrollIndicators(container) {
    const scrollIndicator = container.querySelector('.scroll-indicator');
    if (!scrollIndicator) return;
    
    const hintUp = scrollIndicator.querySelector('.scroll-hint-up');
    const hintDown = scrollIndicator.querySelector('.scroll-hint-down');
    
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Show up indicator if not at top
    if (hintUp) {
        hintUp.style.display = scrollTop > 50 ? 'flex' : 'none';
    }
    
    // Show down indicator if not at bottom
    if (hintDown) {
        hintDown.style.display = (scrollTop + clientHeight) < (scrollHeight - 50) ? 'flex' : 'none';
    }
}

/**
 * Scroll to current position in the map
 */
function scrollToCurrentPosition(container, map, mapHeight) {
    // Find the current node or first available node
    let targetNode = null;
    
    if (map.currentNode) {
        targetNode = map.nodes.find(n => n.id === map.currentNode);
    }
    
    // If no current node, find first available
    if (!targetNode) {
        const visitedNodes = map.visitedNodes || [];
        targetNode = map.nodes.find(n => n.available && !visitedNodes.includes(n.id));
    }
    
    // If still no target, scroll to bottom (start of map)
    if (!targetNode) {
        targetNode = map.nodes.find(n => n.layer === 0);
    }
    
    if (targetNode) {
        // Calculate scroll position
        // Node y is percentage from bottom, convert to pixels from top
        const nodeYPercent = 100 - targetNode.y;
        const nodeYPixels = (nodeYPercent / 100) * mapHeight;
        
        // Center the node in viewport
        const containerHeight = container.clientHeight;
        const scrollTarget = nodeYPixels - (containerHeight / 2);
        
        // Smooth scroll after a short delay
        setTimeout(() => {
            container.scrollTo({
                top: Math.max(0, scrollTarget),
                behavior: 'smooth'
            });
        }, 100);
    }
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
 * Create a node element with adjusted positioning for extended map
 */
function createNodeElement(node, currentNodeId, visitedNodes, game, mapHeight) {
    const el = document.createElement('div');
    el.className = `map-node node-${node.type}`;
    el.dataset.nodeId = node.id;
    
    // Convert percentage position to pixels for the extended map
    // node.y is percentage from bottom (0 = bottom, 100 = top)
    // We need to invert it so start nodes are at bottom of scrollable area
    const xPercent = node.x;
    const yPercent = 100 - node.y; // Invert Y so bottom of map is start
    
    el.style.left = `${xPercent}%`;
    el.style.top = `${yPercent}%`;
    
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
 * Render enhanced connections between nodes with curves and glows
 */
function renderEnhancedConnections(game, container, map, mapHeight) {
    // Create SVG for connections
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
    
    // Add SVG filter definitions for glow effect
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
        <marker id="arrowAvailable" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
            <polygon points="0,0 10,5 0,10" class="path-arrow" fill="rgba(0, 245, 255, 0.8)"/>
        </marker>
        <marker id="arrowVisited" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <polygon points="0,0 8,4 0,8" fill="rgba(100, 100, 100, 0.5)"/>
        </marker>
    `;
    svg.appendChild(defs);
    
    const nodes = map.nodes;
    const paths = map.paths || [];
    const visitedNodes = map.visitedNodes || [];
    const currentNode = map.currentNode;
    
    // Sort paths so available ones render on top
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
    
    // Draw connections from paths array
    sortedPaths.forEach(path => {
        const fromNode = nodes.find(n => n.id === path.from);
        const toNode = nodes.find(n => n.id === path.to);
        
        if (!fromNode || !toNode) return;
        
        // Determine path state
        const isVisited = visitedNodes.includes(fromNode.id) && visitedNodes.includes(toNode.id);
        const isAvailable = visitedNodes.includes(fromNode.id) && toNode.available;
        const isFromCurrent = fromNode.id === currentNode;
        
        // Convert percentage positions
        const x1 = fromNode.x;
        const y1 = 100 - fromNode.y;
        const x2 = toNode.x;
        const y2 = 100 - toNode.y;
        
        // Calculate control points for bezier curve
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const curveOffset = dx * MAP_CONFIG.pathCurveIntensity;
        
        // Create curved path
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Use quadratic bezier for smooth curves
        const pathD = `M ${x1}% ${y1}% Q ${x1 + curveOffset}% ${midY}%, ${x2}% ${y2}%`;
        pathEl.setAttribute('d', pathD);
        pathEl.classList.add('map-path');
        
        // Style based on state
        if (isVisited) {
            pathEl.classList.add('visited');
            pathEl.setAttribute('stroke', 'rgba(80, 80, 100, 0.4)');
            pathEl.setAttribute('stroke-width', '2');
            pathEl.setAttribute('stroke-dasharray', '4,4');
        } else if (isAvailable) {
            pathEl.classList.add('available');
            if (isFromCurrent) {
                // Paths from current node are brighter
                pathEl.setAttribute('stroke', 'rgba(0, 245, 255, 0.9)');
                pathEl.setAttribute('stroke-width', '3');
                pathEl.setAttribute('filter', 'url(#pathGlowStrong)');
                pathEl.setAttribute('marker-mid', 'url(#arrowAvailable)');
            } else {
                pathEl.setAttribute('stroke', 'rgba(0, 245, 255, 0.6)');
                pathEl.setAttribute('stroke-width', '2.5');
                pathEl.setAttribute('filter', 'url(#pathGlow)');
            }
        } else {
            // Future/locked paths
            pathEl.setAttribute('stroke', 'rgba(40, 40, 50, 0.3)');
            pathEl.setAttribute('stroke-width', '1.5');
            pathEl.setAttribute('stroke-dasharray', '3,6');
        }
        
        svg.appendChild(pathEl);
        
        // Add direction arrow for available paths
        if (isAvailable && isFromCurrent) {
            addDirectionArrow(svg, x1, y1, x2, y2, curveOffset);
        }
    });
    
    container.appendChild(svg);
}

/**
 * Add animated direction arrow on a path
 */
function addDirectionArrow(svg, x1, y1, x2, y2, curveOffset) {
    // Calculate point along the bezier curve (around 60% of the way)
    const t = 0.6;
    const midY = (y1 + y2) / 2;
    
    // Quadratic bezier formula
    const px = (1-t)*(1-t)*x1 + 2*(1-t)*t*(x1 + curveOffset) + t*t*x2;
    const py = (1-t)*(1-t)*y1 + 2*(1-t)*t*midY + t*t*y2;
    
    // Calculate angle for arrow rotation
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    
    // Create arrow polygon
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrow.setAttribute('points', '-6,-4 6,0 -6,4');
    arrow.setAttribute('transform', `translate(${px}%, ${py}%) rotate(${angle})`);
    arrow.setAttribute('fill', 'rgba(0, 245, 255, 0.9)');
    arrow.setAttribute('filter', 'url(#pathGlow)');
    arrow.classList.add('path-arrow');
    
    svg.appendChild(arrow);
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
 */
function forceScreenTransition(game, targetScreen) {
    console.log(`[MapScreen] forceScreenTransition to: ${targetScreen}`);
    
    // Method 1: Try ScreenManager
    if (game.screenManager) {
        try {
            // Reset stuck state
            game.screenManager.transitioning = false;
            
            // Try normal transition
            game.screenManager.showScreen(targetScreen);
            console.log(`[MapScreen] ScreenManager.showScreen called`);
            
            // Verify transition worked
            setTimeout(() => {
                const targetEl = document.getElementById(targetScreen);
                if (targetEl && !targetEl.classList.contains('active')) {
                    console.warn('[MapScreen] ScreenManager transition may have failed, forcing...');
                    forceShowScreen(targetScreen);
                }
            }, 200);
            
            return;
        } catch (e) {
            console.error('[MapScreen] ScreenManager.showScreen failed:', e);
        }
    }
    
    // Method 2: Force show if ScreenManager failed
    forceShowScreen(targetScreen);
}

/**
 * Force show a screen by directly manipulating DOM
 */
function forceShowScreen(screenId) {
    console.log(`[MapScreen] Force showing screen: ${screenId}`);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'flex';
        targetScreen.style.opacity = '1';
        console.log(`[MapScreen] Screen ${screenId} force-shown`);
    } else {
        console.error(`[MapScreen] Target screen not found: ${screenId}`);
    }
}

/**
 * Start combat encounter
 */
function startCombat(game, difficulty) {
    console.log(`[MapScreen] ╔══════════════════════════════════════╗`);
    console.log(`[MapScreen] ║     STARTING COMBAT                  ║`);
    console.log(`[MapScreen] ╚══════════════════════════════════════╝`);
    console.log(`[MapScreen] Difficulty: ${difficulty}`);
    
    const act = game.state.get('act') || 1;
    let enemies = null;
    
    // Try to get enemies from DataLoader
    try {
        if (game.dataLoader && typeof game.dataLoader.getEnemiesForEncounter === 'function') {
            enemies = game.dataLoader.getEnemiesForEncounter(difficulty, act);
            console.log(`[MapScreen] Got enemies from DataLoader:`, enemies);
        }
    } catch (e) {
        console.warn('[MapScreen] Failed to get enemies from DataLoader:', e);
    }
    
    // Use fallback enemies if needed
    if (!enemies || enemies.length === 0) {
        console.log('[MapScreen] Using fallback enemies');
        enemies = getFallbackEnemies(difficulty, act);
    }
    
    // Store combat data in state for CombatScreen to pick up
    game.state.set('pendingCombat', {
        difficulty: difficulty,
        enemies: enemies,
        act: act
    });
    
    console.log(`[MapScreen] Combat enemies:`, enemies.map(e => e.name || e.id));
    
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
