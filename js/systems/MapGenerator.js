/**
 * MapGenerator - Generates procedural node maps for each act
 */
class MapGenerator {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        this.currentMap = null;
        this.currentNodeIndex = 0;
        
        // Map configuration
        this.config = {
            nodesPerAct: {
                1: 15,
                2: 18,
                3: 12
            },
            minPaths: 2,
            maxPaths: 4,
            nodeTypes: {
                combat: { weight: 40, icon: '⚔️', name: 'Combat' },
                elite: { weight: 10, icon: '💀', name: 'Elite' },
                event: { weight: 20, icon: '❓', name: 'Event' },
                shop: { weight: 10, icon: '🏪', name: 'Shop' },
                rest: { weight: 10, icon: '🔥', name: 'Rest' },
                treasure: { weight: 5, icon: '💎', name: 'Treasure' },
                boss: { weight: 0, icon: '👿', name: 'Boss' }
            }
        };
    }

    /**
     * Generate a new act map
     */
    generateAct(actNumber) {
        console.log(`[MapGenerator] Generating Act ${actNumber} map`);
        
        const nodeCount = this.config.nodesPerAct[actNumber] || 15;
        const map = {
            act: actNumber,
            nodes: [],
            connections: [],
            currentNodeId: null
        };
        
        // Generate node layers
        const layers = this.generateLayers(nodeCount);
        
        // Create nodes from layers
        let nodeId = 0;
        layers.forEach((layer, layerIndex) => {
            layer.forEach((nodeType, posIndex) => {
                const node = {
                    id: `node_${nodeId++}`,
                    type: nodeType,
                    layer: layerIndex,
                    position: posIndex,
                    visited: false,
                    available: layerIndex === 0, // First layer is available
                    x: 0, // Will be calculated for rendering
                    y: 0
                };
                map.nodes.push(node);
            });
        });
        
        // Add boss node at the end
        const bossNode = {
            id: `node_boss`,
            type: 'boss',
            layer: layers.length,
            position: 0,
            visited: false,
            available: false,
            x: 0,
            y: 0
        };
        map.nodes.push(bossNode);
        
        // Generate connections between layers
        this.generateConnections(map, layers);
        
        // Calculate node positions for rendering
        this.calculateNodePositions(map, layers);
        
        // Store map
        this.currentMap = map;
        this.state.set('map', map);
        
        this.eventBus.emit('map:generated', map);
        
        return map;
    }

    /**
     * Generate node layers
     */
    generateLayers(totalNodes) {
        const layers = [];
        let remaining = totalNodes;
        
        // First layer: 2-3 starting nodes
        const firstLayerCount = Math.min(remaining, 2 + Math.floor(Math.random() * 2));
        layers.push(this.generateLayer(firstLayerCount, 0));
        remaining -= firstLayerCount;
        
        // Middle layers
        while (remaining > 4) {
            const layerCount = Math.min(remaining - 3, 2 + Math.floor(Math.random() * 3));
            layers.push(this.generateLayer(layerCount, layers.length));
            remaining -= layerCount;
        }
        
        // Pre-boss layer: must include a rest node option
        const preBossLayer = this.generateLayer(Math.min(remaining, 3), layers.length, true);
        layers.push(preBossLayer);
        
        return layers;
    }

    /**
     * Generate a single layer of nodes
     */
    generateLayer(count, layerIndex, includeRest = false) {
        const layer = [];
        
        // Ensure at least one rest node in pre-boss layer
        if (includeRest) {
            layer.push('rest');
            count--;
        }
        
        // Generate remaining nodes
        for (let i = 0; i < count; i++) {
            const type = this.getRandomNodeType(layerIndex);
            layer.push(type);
        }
        
        // Shuffle layer
        return this.shuffleArray(layer);
    }

    /**
     * Get random node type based on weights
     */
    getRandomNodeType(layerIndex) {
        const types = Object.entries(this.config.nodeTypes)
            .filter(([type, config]) => type !== 'boss' && config.weight > 0);
        
        const totalWeight = types.reduce((sum, [, config]) => sum + config.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const [type, config] of types) {
            random -= config.weight;
            if (random <= 0) {
                // Ensure elites don't appear too early
                if (type === 'elite' && layerIndex < 3) {
                    return 'combat';
                }
                // Don't have two rest nodes in a row (handled separately)
                return type;
            }
        }
        
        return 'combat';
    }

    /**
     * Generate connections between nodes
     */
    generateConnections(map, layers) {
        for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
            const currentLayerNodes = map.nodes.filter(n => n.layer === layerIndex);
            const nextLayerNodes = map.nodes.filter(n => n.layer === layerIndex + 1);
            
            if (nextLayerNodes.length === 0) continue;
            
            // Each node must connect to at least one next node
            currentLayerNodes.forEach(node => {
                const connectionCount = 1 + Math.floor(Math.random() * 2);
                const shuffledNext = this.shuffleArray([...nextLayerNodes]);
                
                for (let i = 0; i < Math.min(connectionCount, shuffledNext.length); i++) {
                    map.connections.push({
                        from: node.id,
                        to: shuffledNext[i].id
                    });
                }
            });
            
            // Ensure each next node has at least one incoming connection
            nextLayerNodes.forEach(nextNode => {
                const hasConnection = map.connections.some(c => c.to === nextNode.id);
                if (!hasConnection) {
                    const randomCurrent = currentLayerNodes[
                        Math.floor(Math.random() * currentLayerNodes.length)
                    ];
                    map.connections.push({
                        from: randomCurrent.id,
                        to: nextNode.id
                    });
                }
            });
        }
        
        // Connect pre-boss layer to boss
        const lastLayer = layers.length - 1;
        const preBossNodes = map.nodes.filter(n => n.layer === lastLayer);
        const bossNode = map.nodes.find(n => n.type === 'boss');
        
        preBossNodes.forEach(node => {
            map.connections.push({
                from: node.id,
                to: bossNode.id
            });
        });
    }

    /**
     * Calculate node positions for rendering
     */
    calculateNodePositions(map, layers) {
        const containerWidth = 600;
        const containerHeight = 800;
        const layerHeight = containerHeight / (layers.length + 2); // +2 for boss and padding
        
        layers.forEach((layer, layerIndex) => {
            const layerNodes = map.nodes.filter(n => n.layer === layerIndex);
            const layerWidth = containerWidth / (layerNodes.length + 1);
            
            layerNodes.forEach((node, nodeIndex) => {
                node.x = layerWidth * (nodeIndex + 1);
                node.y = containerHeight - (layerHeight * (layerIndex + 1));
            });
        });
        
        // Position boss node
        const bossNode = map.nodes.find(n => n.type === 'boss');
        if (bossNode) {
            bossNode.x = containerWidth / 2;
            bossNode.y = layerHeight;
        }
    }

    /**
     * Select a node to travel to
     */
    selectNode(nodeId) {
        const node = this.currentMap.nodes.find(n => n.id === nodeId);
        
        if (!node || !node.available || node.visited) {
            console.log('[MapGenerator] Cannot select this node');
            return false;
        }
        
        console.log(`[MapGenerator] Selected node: ${node.type}`);
        
        // Mark as current and visited
        node.visited = true;
        this.currentMap.currentNodeId = nodeId;
        this.state.set('currentNode', node);
        this.state.set('currentNodeType', node.type);
        this.state.increment('floor');
        
        // Update available nodes (only nodes connected from this one)
        this.updateAvailableNodes(nodeId);
        
        this.state.set('map', this.currentMap);
        this.eventBus.emit('node:selected', node);
        
        return true;
    }

    /**
     * Update which nodes are available after visiting a node
     */
    updateAvailableNodes(currentNodeId) {
        // First, mark all nodes as unavailable
        this.currentMap.nodes.forEach(node => {
            node.available = false;
        });
        
        // Then, mark connected nodes as available
        const connections = this.currentMap.connections.filter(c => c.from === currentNodeId);
        connections.forEach(conn => {
            const targetNode = this.currentMap.nodes.find(n => n.id === conn.to);
            if (targetNode && !targetNode.visited) {
                targetNode.available = true;
            }
        });
    }

    /**
     * Mark current node as completed
     */
    completeCurrentNode() {
        const nodeId = this.currentMap.currentNodeId;
        if (!nodeId) return;
        
        this.eventBus.emit('node:completed', nodeId);
    }

    /**
     * Get current map
     */
    getCurrentMap() {
        return this.currentMap;
    }

    /**
     * Get node by ID
     */
    getNode(nodeId) {
        return this.currentMap?.nodes.find(n => n.id === nodeId);
    }

    /**
     * Get available nodes
     */
    getAvailableNodes() {
        return this.currentMap?.nodes.filter(n => n.available && !n.visited) || [];
    }

    /**
     * Check if at boss
     */
    isAtBoss() {
        const current = this.currentMap?.currentNodeId;
        const node = this.getNode(current);
        return node?.type === 'boss';
    }

    /**
     * Render map to DOM
     */
    renderMap() {
        const container = document.getElementById('map-nodes');
        if (!container || !this.currentMap) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Draw connections first (as SVG lines)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'map-connections');
        svg.style.position = 'absolute';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        
        this.currentMap.connections.forEach(conn => {
            const fromNode = this.getNode(conn.from);
            const toNode = this.getNode(conn.to);
            
            if (fromNode && toNode) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', fromNode.x);
                line.setAttribute('y1', fromNode.y);
                line.setAttribute('x2', toNode.x);
                line.setAttribute('y2', toNode.y);
                line.setAttribute('class', `connection ${fromNode.visited && toNode.visited ? 'visited' : ''}`);
                svg.appendChild(line);
            }
        });
        
        container.appendChild(svg);
        
        // Draw nodes
        this.currentMap.nodes.forEach(node => {
            const nodeEl = document.createElement('div');
            nodeEl.className = `map-node type-${node.type}`;
            nodeEl.className += node.visited ? ' visited' : '';
            nodeEl.className += node.available ? ' available' : '';
            nodeEl.className += this.currentMap.currentNodeId === node.id ? ' current' : '';
            
            nodeEl.style.left = `${node.x}px`;
            nodeEl.style.top = `${node.y}px`;
            
            const typeConfig = this.config.nodeTypes[node.type];
            nodeEl.innerHTML = `
                <div class="node-icon">${typeConfig.icon}</div>
                <div class="node-label">${typeConfig.name}</div>
            `;
            
            // Add click handler for available nodes
            if (node.available && !node.visited) {
                nodeEl.addEventListener('click', () => {
                    this.selectNode(node.id);
                });
            }
            
            container.appendChild(nodeEl);
        });
    }

    /**
     * Shuffle array helper
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

export { MapGenerator };
