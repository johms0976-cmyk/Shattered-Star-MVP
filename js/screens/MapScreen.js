/**
 * MapScreen - Node map screen handler
 * FIXED: Event format handling, click robustness, pointer-events explicit
 */

export function setupMapScreen(game) {
    const btnDeck = document.getElementById('btn-deck');
    const btnArtifacts = document.getElementById('btn-artifacts');
    const btnMapMenu = document.getElementById('btn-map-menu');
    const btnCloseDeck = document.getElementById('btn-close-deck');
    
    // Deck button
    if (btnDeck) {
        btnDeck.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            game.openDeckModal();
        });
    }
    
    // Close deck modal
    if (btnCloseDeck) {
        btnCloseDeck.addEventListener('click', () => {
            document.getElementById('deck-modal').classList.remove('active');
        });
    }
    
    // Artifacts button
    if (btnArtifacts) {
        btnArtifacts.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            showArtifacts(game);
        });
    }
    
    // Menu button
    if (btnMapMenu) {
        btnMapMenu.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            game.openSettingsModal();
        });
    }
    
    // FIX #1: Handle BOTH event formats (string or object with 'to' property)
    game.eventBus.on('screen:changed', (data) => {
        // Support: emit('screen:changed', 'map-screen') OR emit('screen:changed', { to: 'map-screen' })
        const screenId = typeof data === 'string' ? data : (data?.to || data);
        if (screenId === 'map-screen') {
            console.log('[MapScreen] Screen changed to map-screen, rendering...');
            renderMapScreen(game);
        }
    });
    
    // Listen for map updates
    game.eventBus.on('map:updated', () => {
        console.log('[MapScreen] Map updated event received, re-rendering...');
        renderMapScreen(game);
    });
    
    // Listen for map generation
    game.eventBus.on('map:generated', () => {
        console.log('[MapScreen] Map generated event received, re-rendering...');
        renderMapScreen(game);
    });
    
    // FIX #2: Add delegated click handler as BACKUP
    // This catches clicks even if individual node handlers fail
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
            console.log(`[MapScreen] Delegated click captured for node: ${nodeId}`);
            
            // Find node in map state
            const map = game.state.get('map');
            if (map && map.nodes) {
                const node = map.nodes.find(n => n.id === nodeId);
                if (node && !node.visited) {
                    handleNodeClick(game, node);
                }
            }
        });
    }
}

function renderMapScreen(game) {
    console.log('[MapScreen] renderMapScreen called');
    updatePlayerStats(game);
    renderMap(game);
}

function updatePlayerStats(game) {
    const hp = game.state.get('hero.hp') || 80;
    const maxHp = game.state.get('hero.maxHp') || 80;
    const credits = game.state.get('credits') || 0;
    const corruption = game.state.get('corruption') || 0;
    
    const hpEl = document.getElementById('map-hp');
    const creditsEl = document.getElementById('map-credits');
    const corruptionEl = document.getElementById('map-corruption');
    
    if (hpEl) hpEl.textContent = `${hp}/${maxHp}`;
    if (creditsEl) creditsEl.textContent = credits;
    if (corruptionEl) corruptionEl.textContent = `${corruption}%`;
    
    // Update act title
    const act = game.state.get('act') || 1;
    const actTitles = {
        1: 'ACT I: ASHES OF IRONSPINE',
        2: 'ACT II: THE DEEPENING SPIRAL',
        3: 'ACT III: THE SHATTERED CORE'
    };
    const actTitleEl = document.getElementById('act-title');
    if (actTitleEl) actTitleEl.textContent = actTitles[act] || actTitles[1];
}

function renderMap(game) {
    const mapContainer = document.getElementById('map-nodes');
    if (!mapContainer) {
        console.error('[MapScreen] map-nodes container not found');
        return;
    }
    
    let map = game.state.get('map');
    
    // Generate map if not exists
    if (!map || !map.nodes || map.nodes.length === 0) {
        console.log('[MapScreen] No map found, generating...');
        const act = game.state.get('act') || 1;
        map = game.mapGenerator.generateAct(act);
        // The generateAct will emit map:generated which will trigger re-render
        // But let's continue to render since we have the map now
    }
    
    if (!map || !map.nodes) {
        console.error('[MapScreen] Failed to generate or retrieve map');
        mapContainer.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">Error loading map. Please refresh.</p>';
        return;
    }
    
    console.log(`[MapScreen] Rendering map with ${map.nodes.length} nodes`);
    
    const nodes = map.nodes;
    const currentNodeId = map.currentNode;
    const visitedNodes = map.visitedNodes || [];
    
    // DEBUG: Log available nodes
    const availableCount = nodes.filter(n => n.available && !visitedNodes.includes(n.id)).length;
    console.log(`[MapScreen] Available nodes: ${availableCount}`);
    
    // Clear existing nodes
    mapContainer.innerHTML = '';
    
    // Render connections first (behind nodes)
    renderConnections(game, mapContainer, map);
    
    // Render nodes
    nodes.forEach(node => {
        const nodeEl = createNodeElement(node, currentNodeId, visitedNodes, game);
        mapContainer.appendChild(nodeEl);
    });
    
    console.log('[MapScreen] Map rendering complete');
}

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
    
    // Fixed: Use both 'available' and 'accessible' for CSS compatibility
    if (isAvailable) {
        el.classList.add('available');
        el.classList.add('accessible'); // CSS uses 'accessible' class
    }
    
    // Node icon
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
    
    // FIX #3: ALWAYS set pointer-events explicitly based on state
    if (isAvailable) {
        el.style.cursor = 'pointer';
        el.style.pointerEvents = 'auto';  // EXPLICIT - ensures clicks work
        
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
        el.style.pointerEvents = visitedNodes.includes(node.id) ? 'none' : 'auto';
    }
    
    // Tooltip on hover
    el.addEventListener('mouseenter', (e) => {
        showNodeTooltip(node, el);
    });
    
    el.addEventListener('mouseleave', () => {
        hideNodeTooltip();
    });
    
    return el;
}

function renderConnections(game, container, map) {
    if (!map || !map.paths || map.paths.length === 0) {
        console.log('[MapScreen] No paths to render');
        return;
    }
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('map-connections');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';
    
    const visitedNodes = map.visitedNodes || [];
    
    map.paths.forEach(path => {
        const fromNode = map.nodes.find(n => n.id === path.from);
        const toNode = map.nodes.find(n => n.id === path.to);
        
        if (fromNode && toNode) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', fromNode.x);
            line.setAttribute('y1', 100 - fromNode.y); // Invert Y
            line.setAttribute('x2', toNode.x);
            line.setAttribute('y2', 100 - toNode.y); // Invert Y
            
            // Base styling
            line.setAttribute('stroke', 'rgba(100, 100, 120, 0.5)');
            line.setAttribute('stroke-width', '0.5');
            line.setAttribute('stroke-dasharray', '2,2');
            
            // Check if path is traveled
            if (visitedNodes.includes(path.from) && visitedNodes.includes(path.to)) {
                line.classList.add('traveled');
                line.setAttribute('stroke', 'rgba(0, 245, 255, 0.3)');
                line.setAttribute('stroke-width', '0.8');
            }
            
            // Check if path is available (from current node)
            if (path.from === map.currentNode) {
                line.classList.add('available');
                line.setAttribute('stroke', 'rgba(0, 245, 255, 0.7)');
                line.setAttribute('stroke-width', '1');
                line.setAttribute('stroke-dasharray', 'none');
            }
            
            // Highlight paths from first layer if no current node (start of game)
            if (!map.currentNode && fromNode.layer === 0) {
                line.setAttribute('stroke', 'rgba(0, 245, 255, 0.5)');
                line.setAttribute('stroke-dasharray', 'none');
            }
            
            svg.appendChild(line);
        }
    });
    
    container.appendChild(svg);
}

function handleNodeClick(game, node) {
    console.log(`[MapScreen] handleNodeClick START: ${node.id} (${node.type})`);
    
    try {
        game.audioManager.playSFX('ui_click');
    } catch (e) {
        console.warn('[MapScreen] Failed to play click sound:', e);
    }
    
    // FIX #4: Don't BLOCK on selectNode failure - warn but continue
    let selected = false;
    try {
        selected = game.mapGenerator.selectNode(node.id);
        if (!selected) {
            console.warn('[MapScreen] selectNode returned false - continuing anyway');
            // Manually mark the node visited in state as backup
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
        }
    } catch (e) {
        console.error('[MapScreen] Error in selectNode:', e);
        // Don't return - continue to transition
    }
    
    // Handle node type - this should ALWAYS run
    console.log(`[MapScreen] Processing node type: ${node.type}`);
    
    try {
        switch (node.type) {
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
                console.log('[MapScreen] Transitioning to shop-screen');
                game.screenManager.transitionTo('shop-screen');
                break;
            case 'rest':
                console.log('[MapScreen] Transitioning to rest-screen');
                game.screenManager.transitionTo('rest-screen');
                break;
            case 'treasure':
                handleTreasure(game);
                break;
            default:
                console.warn('[MapScreen] Unknown node type:', node.type);
                // Default to combat for unknown types
                startCombat(game, 'normal');
        }
    } catch (e) {
        console.error('[MapScreen] Error handling node type:', e);
    }
    
    console.log(`[MapScreen] handleNodeClick END`);
}

function startCombat(game, difficulty) {
    console.log(`[MapScreen] Starting combat with difficulty: ${difficulty}`);
    
    const act = game.state.get('act') || 1;
    
    let enemies;
    try {
        if (difficulty === 'boss') {
            enemies = [game.dataLoader.getBoss(act)];
        } else if (difficulty === 'elite') {
            enemies = game.dataLoader.getEliteEncounter(act);
        } else {
            enemies = game.dataLoader.getRandomEncounter(act);
        }
    } catch (e) {
        console.warn('[MapScreen] Failed to get enemies from DataLoader:', e);
        enemies = null;
    }
    
    // Fallback enemies if DataLoader fails
    if (!enemies || enemies.length === 0) {
        console.log('[MapScreen] Using fallback enemies');
        const fallbackEnemies = {
            normal: [{ id: 'rustborn_raider', name: 'Rustborn Raider', hp: 20, maxHp: 20, block: 0, intents: [{ type: 'attack', damage: 6 }] }],
            elite: [{ id: 'scrap_golem', name: 'Scrap Golem', hp: 45, maxHp: 45, block: 0, intents: [{ type: 'attack', damage: 12 }] }],
            boss: [{ id: 'scrap_king', name: 'Scrap-King', hp: 100, maxHp: 100, block: 0, intents: [{ type: 'attack', damage: 15 }] }]
        };
        enemies = fallbackEnemies[difficulty] || fallbackEnemies.normal;
    }
    
    console.log(`[MapScreen] Combat enemies:`, enemies);
    
    // Start combat with these enemies
    try {
        if (game.combat && typeof game.combat.startCombat === 'function') {
            game.combat.startCombat(enemies);
        } else {
            console.error('[MapScreen] Combat system not initialized properly');
            // Store enemies in state for combat screen to use
            game.state.set('combat.enemies', enemies);
        }
    } catch (e) {
        console.error('[MapScreen] Error starting combat:', e);
        game.state.set('combat.enemies', enemies);
    }
    
    console.log('[MapScreen] Transitioning to combat-screen');
    game.screenManager.transitionTo('combat-screen');
}

function startEvent(game) {
    const act = game.state.get('act') || 1;
    let event = null;
    
    try {
        event = game.dataLoader.getRandomEvent(act);
    } catch (e) {
        console.warn('[MapScreen] Failed to get event:', e);
    }
    
    if (event) {
        game.state.set('event.currentEvent', event);
        game.screenManager.transitionTo('event-screen');
    } else {
        // Fallback: return to map if no event found
        console.warn('No event found for act', act);
        game.mapGenerator.completeCurrentNode();
        game.eventBus.emit('map:updated');
    }
}

function handleTreasure(game) {
    let artifact = null;
    try {
        artifact = game.dataLoader.getRandomArtifact('common');
    } catch (e) {
        console.warn('[MapScreen] Failed to get artifact:', e);
    }
    
    const credits = Math.floor(Math.random() * 50) + 25;
    
    // Add rewards
    if (artifact) {
        const artifacts = game.state.get('artifacts') || [];
        artifacts.push(artifact);
        game.state.set('artifacts', artifacts);
        game.eventBus.emit('artifact:gained', artifact);
    }
    
    const currentCredits = game.state.get('credits') || 0;
    game.state.set('credits', currentCredits + credits);
    
    // Show rewards and return to map
    try {
        game.rewards.generateCombatRewards('treasure');
        game.screenManager.transitionTo('reward-screen');
    } catch (e) {
        console.warn('[MapScreen] Failed to generate rewards:', e);
        // Fallback: return to map
        game.mapGenerator.completeCurrentNode();
        game.eventBus.emit('map:updated');
    }
}

function showNodeTooltip(node, element) {
    const tooltips = {
        combat: 'Combat - Face enemies',
        elite: 'Elite - Powerful foe, better rewards',
        event: 'Event - Narrative encounter',
        shop: 'Shop - Buy cards and artifacts',
        rest: 'Rest - Heal or upgrade',
        treasure: 'Treasure - Free rewards',
        boss: 'Boss - Act finale',
        start: 'Starting point'
    };
    
    // Create tooltip if it doesn't exist
    let tooltip = document.getElementById('node-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'node-tooltip';
        tooltip.className = 'node-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(10, 10, 26, 0.95);
            border: 1px solid rgba(0, 245, 255, 0.5);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            color: #e8e8f0;
            pointer-events: none;
            z-index: 1000;
            white-space: nowrap;
        `;
        document.body.appendChild(tooltip);
    }
    
    tooltip.textContent = tooltips[node.type] || node.type;
    tooltip.style.display = 'block';
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 35}px`;
    tooltip.style.transform = 'translateX(-50%)';
}

function hideNodeTooltip() {
    const tooltip = document.getElementById('node-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

function showArtifacts(game) {
    const artifacts = game.state.get('artifacts') || [];
    
    // Create artifacts modal if needed
    let modal = document.getElementById('artifacts-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'artifacts-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content artifacts-view">
                <div class="modal-header">
                    <h2>YOUR RELICS</h2>
                    <button class="close-btn" id="btn-close-artifacts">×</button>
                </div>
                <div class="artifacts-grid" id="artifacts-grid"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('btn-close-artifacts').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }
    
    // Populate artifacts
    const grid = document.getElementById('artifacts-grid');
    grid.innerHTML = artifacts.length > 0 
        ? artifacts.map(a => `
            <div class="artifact-item rarity-${a.rarity || 'common'}">
                <div class="artifact-icon">${getArtifactIcon(a)}</div>
                <div class="artifact-name">${a.name || 'Unknown'}</div>
                <div class="artifact-desc">${a.description || ''}</div>
            </div>
        `).join('')
        : '<p class="no-artifacts" style="color: #888; text-align: center; padding: 20px;">No relics collected yet.</p>';
    
    modal.classList.add('active');
}

function getArtifactIcon(artifact) {
    const icons = {
        thermal_regulator: '🔥',
        scrap_capacitor: '⚡',
        void_vial: '🌀',
        rust_heart: '❤️',
        signal_beacon: '📡'
    };
    return icons[artifact.id] || '💎';
}
