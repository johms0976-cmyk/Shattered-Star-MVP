/**
 * MapScreen - Node map screen handler
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
    
    // Setup when screen is shown
    game.eventBus.on('screen:changed', ({ to }) => {
        if (to === 'map-screen') {
            renderMapScreen(game);
        }
    });
    
    // Listen for map updates
    game.eventBus.on('map:updated', () => {
        renderMapScreen(game);
    });
}

function renderMapScreen(game) {
    updatePlayerStats(game);
    renderMap(game);
}

function updatePlayerStats(game) {
    const hp = game.state.get('hero.hp');
    const maxHp = game.state.get('hero.maxHp');
    const credits = game.state.get('credits') || 0;
    const corruption = game.state.get('corruption') || 0;
    
    document.getElementById('map-hp').textContent = `${hp}/${maxHp}`;
    document.getElementById('map-credits').textContent = credits;
    document.getElementById('map-corruption').textContent = `${corruption}%`;
    
    // Update act title
    const act = game.state.get('act') || 1;
    const actTitles = {
        1: 'ACT I: ASHES OF IRONSPINE',
        2: 'ACT II: THE DEEPENING SPIRAL',
        3: 'ACT III: THE SHATTERED CORE'
    };
    document.getElementById('act-title').textContent = actTitles[act] || actTitles[1];
}

function renderMap(game) {
    const mapContainer = document.getElementById('map-nodes');
    const map = game.state.get('map');
    
    if (!map || !map.nodes) {
        // Generate map if not exists
        game.mapGenerator.generateAct(game.state.get('act') || 1);
        return;
    }
    
    const nodes = map.nodes;
    const currentNodeId = map.currentNode;
    const visitedNodes = map.visitedNodes || [];
    
    // Clear existing nodes
    mapContainer.innerHTML = '';
    
    // Render connections first (behind nodes)
    renderConnections(game, mapContainer);
    
    // Render nodes
    nodes.forEach(node => {
        const nodeEl = createNodeElement(node, currentNodeId, visitedNodes, game);
        mapContainer.appendChild(nodeEl);
    });
}

function createNodeElement(node, currentNodeId, visitedNodes, game) {
    const el = document.createElement('div');
    el.className = `map-node node-${node.type}`;
    el.dataset.nodeId = node.id;
    
    // Position the node
    el.style.left = `${node.x}%`;
    el.style.top = `${100 - node.y}%`; // Invert Y so start is at bottom
    
    // Add state classes
    if (node.id === currentNodeId) {
        el.classList.add('current');
    }
    if (visitedNodes.includes(node.id)) {
        el.classList.add('visited');
    }
    if (node.available) {
        el.classList.add('available');
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
    
    // Click handler for available nodes
    if (node.available && !visitedNodes.includes(node.id)) {
        el.addEventListener('click', () => {
            handleNodeClick(game, node);
        });
    }
    
    // Tooltip on hover
    el.addEventListener('mouseenter', () => {
        showNodeTooltip(node, el);
    });
    
    el.addEventListener('mouseleave', () => {
        hideNodeTooltip();
    });
    
    return el;
}

function renderConnections(game, container) {
    const map = game.state.get('map');
    if (!map || !map.paths) return;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('map-connections');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    
    map.paths.forEach(path => {
        const fromNode = map.nodes.find(n => n.id === path.from);
        const toNode = map.nodes.find(n => n.id === path.to);
        
        if (fromNode && toNode) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', fromNode.x);
            line.setAttribute('y1', 100 - fromNode.y);
            line.setAttribute('x2', toNode.x);
            line.setAttribute('y2', 100 - toNode.y);
            line.classList.add('path-line');
            
            // Check if path is traveled
            const visitedNodes = map.visitedNodes || [];
            if (visitedNodes.includes(path.from) && visitedNodes.includes(path.to)) {
                line.classList.add('traveled');
            }
            
            svg.appendChild(line);
        }
    });
    
    container.appendChild(svg);
}

function handleNodeClick(game, node) {
    game.audioManager.playSFX('ui_click');
    
    // Mark node as visited
    const visitedNodes = game.state.get('map.visitedNodes') || [];
    visitedNodes.push(node.id);
    game.state.set('map.visitedNodes', visitedNodes);
    game.state.set('map.currentNode', node.id);
    game.state.set('currentNodeType', node.type);
    
    // Update available nodes
    game.mapGenerator.updateAvailableNodes(node.id);
    
    // Increment floor
    const floor = game.state.get('floor') || 0;
    game.state.set('floor', floor + 1);
    
    // Handle node type
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
            game.screenManager.transitionTo('shop-screen');
            break;
        case 'rest':
            game.screenManager.transitionTo('rest-screen');
            break;
        case 'treasure':
            handleTreasure(game);
            break;
        default:
            console.warn('Unknown node type:', node.type);
    }
}

function startCombat(game, difficulty) {
    // Get enemies based on difficulty
    const heroId = game.state.get('hero.id');
    const act = game.state.get('act') || 1;
    
    let enemies;
    if (difficulty === 'boss') {
        enemies = [game.dataLoader.getBoss(act)];
    } else if (difficulty === 'elite') {
        enemies = game.dataLoader.getEliteEncounter(act);
    } else {
        enemies = game.dataLoader.getRandomEncounter(act);
    }
    
    // Start combat with these enemies
    game.combat.startCombat(enemies);
    game.screenManager.transitionTo('combat-screen');
}

function startEvent(game) {
    const act = game.state.get('act') || 1;
    const event = game.dataLoader.getRandomEvent(act);
    
    if (event) {
        game.state.set('event.currentEvent', event);
        game.screenManager.transitionTo('event-screen');
    } else {
        // Fallback to map if no event found
        console.warn('No event found for act', act);
    }
}

function handleTreasure(game) {
    // Generate treasure rewards
    const artifact = game.dataLoader.getRandomArtifact('common');
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
    game.rewards.generateCombatRewards('treasure');
    game.screenManager.transitionTo('reward-screen');
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
        document.body.appendChild(tooltip);
    }
    
    tooltip.textContent = tooltips[node.type] || node.type;
    tooltip.style.display = 'block';
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 30}px`;
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
            <div class="artifact-item rarity-${a.rarity}">
                <div class="artifact-icon">${getArtifactIcon(a)}</div>
                <div class="artifact-name">${a.name}</div>
                <div class="artifact-desc">${a.description}</div>
            </div>
        `).join('')
        : '<p class="no-artifacts">No relics collected yet.</p>';
    
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
