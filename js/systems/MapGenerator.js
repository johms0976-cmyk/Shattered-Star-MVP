/**
 * MapGenerator - Generates procedural node maps for each act
 * Fixed: Position calculations use percentages, property names match MapScreen expectations
 * Fixed: Proper state synchronization for selectNode
 * @version 0.2.1
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
                1: 40,
                2: 60,
                3: 40
            },
            minPaths: 1,
            maxPaths: 3,
            nodeTypes: {
                combat: { weight: 40, icon: '⚔️', name: 'Combat' },
                elite: { weight: 10, icon: '💀', name: 'Elite' },
                event: { weight: 20, icon: '❓', name: 'Event' },
                shop: { weight: 10, icon: '🏪', name: 'Shop' },
                rest: { weight: 10, icon: '🔥', name: 'Rest' },
                treasure: { weight: 5, icon: '💎', name: 'Treasure' },
                boss: { weight: 0, icon: '👿', name: 'Boss' },
                start: { weight: 0, icon: '🚀', name: 'Start' }
            }
        };
    }

    /**
     * Ensure currentMap is synced with state
     * This fixes the desync issue where this.currentMap can be null
     * while the map exists in game state
     */
    syncFromState() {
        if (!this.currentMap) {
            const stateMap = this.state.get('map');
            if (stateMap && stateMap.nodes && stateMap.nodes.length > 0) {
                console.log('[MapGenerator] Syncing currentMap from state');
                this.currentMap = stateMap;
            }
        }
        return this.currentMap;
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
            paths: [], // Fixed: Use 'paths' instead of 'connections' to match MapScreen
            currentNode: null,
            visitedNodes: []
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
            x: 50, // Center
            y: 95  // Near top
        };
        map.nodes.push(bossNode);
        
        // Generate connections between layers
        this.generateConnections(map, layers);
        
        // Calculate node positions for rendering (as percentages)
        this.calculateNodePositions(map, layers);
        
        // Store map in BOTH places
        this.currentMap = map;
        this.state.set('map', map);
        
        console.log(`[MapGenerator] Map generated with ${map.nodes.length} nodes and ${map.paths.length} paths`);
        this.eventBus.emit('map:generated', map);
        this.eventBus.emit('map:updated');
        
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
            .filter(([type, config]) => type !== 'boss' && type !== 'start' && config.weight > 0);
        
        const totalWeight = types.reduce((sum, [, config]) => sum + config.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const [type, config] of types) {
            random -= config.weight;
            if (random <= 0) {
                // Ensure elites don't appear too early
                if (type === 'elite' && layerIndex < 3) {
                    return 'combat';
                }
                return type;
            }
        }
        
        return 'combat';
    }

    /**
     * Generate connections between nodes
     * Fixed: Store in 'paths' array with 'from' and 'to' properties
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
                    map.paths.push({
                        from: node.id,
                        to: shuffledNext[i].id
                    });
                }
            });
            
            // Ensure each next node has at least one incoming connection
            nextLayerNodes.forEach(nextNode => {
                const hasConnection = map.paths.some(c => c.to === nextNode.id);
                if (!hasConnection) {
                    const randomCurrent = currentLayerNodes[
                        Math.floor(Math.random() * currentLayerNodes.length)
                    ];
                    map.paths.push({
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
        
        if (bossNode) {
            preBossNodes.forEach(node => {
                map.paths.push({
                    from: node.id,
                    to: bossNode.id
                });
            });
        }
    }

    /**
     * Calculate node positions for rendering
     * Fixed: Calculate as PERCENTAGES (0-100) instead of pixels
     */
    calculateNodePositions(map, layers) {
        const totalLayers = layers.length + 1; // +1 for boss
        const layerHeightPercent = 85 / totalLayers; // Leave margins at top and bottom
        const startY = 10; // Start at 10% from bottom
        
        layers.forEach((layer, layerIndex) => {
            const layerNodes = map.nodes.filter(n => n.layer === layerIndex);
            const nodeCount = layerNodes.length;
            
            // Distribute nodes horizontally with some randomness
            const baseWidth = 80 / (nodeCount + 1); // Use 80% of width, leaving 10% margins
            
            layerNodes.forEach((node, nodeIndex) => {
                // Calculate base position
                const baseX = 10 + baseWidth * (nodeIndex + 1);
                // Add slight random offset for organic look
                const offsetX = (Math.random() - 0.5) * (baseWidth * 0.3);
                const offsetY = (Math.random() - 0.5) * (layerHeightPercent * 0.2);
                
                node.x = Math.max(10, Math.min(90, baseX + offsetX));
                node.y = startY + (layerIndex * layerHeightPercent) + offsetY;
            });
        });
        
        // Position boss node at the top center
        const bossNode = map.nodes.find(n => n.type === 'boss');
        if (bossNode) {
            bossNode.x = 50;
            bossNode.y = startY + (layers.length * layerHeightPercent);
        }
    }

    /**
     * Select a node to travel to
     * FIXED: Now syncs from state if currentMap is null
     */
    selectNode(nodeId) {
        // FIX: Sync from state if currentMap is null
        this.syncFromState();
        
        if (!this.currentMap) {
            console.error('[MapGenerator] Cannot select node - no map available (even after sync)');
            return false;
        }
        
        const node = this.currentMap.nodes.find(n => n.id === nodeId);
        
        // Better debugging - tell us exactly why selection failed
        if (!node) {
            console.error(`[MapGenerator] Cannot select node - node "${nodeId}" not found in map`);
            return false;
        }
        
        if (!node.available) {
            console.warn(`[MapGenerator] Cannot select node - node "${nodeId}" is not available (available: ${node.available})`);
            return false;
        }
        
        if (node.visited) {
            console.warn(`[MapGenerator] Cannot select node - node "${nodeId}" already visited`);
            return false;
        }
        
        console.log(`[MapGenerator] Selected node: ${node.id} (${node.type})`);
        
        // Mark as current and visited
        node.visited = true;
        this.currentMap.currentNode = nodeId;
        
        // Add to visited nodes
        if (!this.currentMap.visitedNodes) {
            this.currentMap.visitedNodes = [];
        }
        this.currentMap.visitedNodes.push(nodeId);
        
        this.state.set('currentNode', node);
        this.state.set('currentNodeType', node.type);
        
        // FIX: Use try-catch for increment in case it's not available
        try {
            this.state.increment('floor');
        } catch (e) {
            // Fallback if increment doesn't exist
            const floor = this.state.get('floor') || 0;
            this.state.set('floor', floor + 1);
        }
        
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
        // FIX: Sync from state if needed
        this.syncFromState();
        
        if (!this.currentMap) return;
        
        // First, mark all nodes as unavailable
        this.currentMap.nodes.forEach(node => {
            node.available = false;
        });
        
        // Then, mark connected nodes as available
        const paths = this.currentMap.paths.filter(c => c.from === currentNodeId);
        paths.forEach(path => {
            const targetNode = this.currentMap.nodes.find(n => n.id === path.to);
            if (targetNode && !targetNode.visited) {
                targetNode.available = true;
            }
        });
        
        // Update state
        this.state.set('map', this.currentMap);
        this.eventBus.emit('map:updated');
    }

    /**
     * Mark current node as completed
     */
    completeCurrentNode() {
        this.syncFromState();
        if (!this.currentMap) return;
        
        const nodeId = this.currentMap.currentNode;
        if (!nodeId) return;
        
        this.eventBus.emit('node:completed', nodeId);
    }

    /**
     * Get current map
     */
    getCurrentMap() {
        this.syncFromState();
        return this.currentMap;
    }

    /**
     * Get node by ID
     */
    getNode(nodeId) {
        this.syncFromState();
        return this.currentMap?.nodes.find(n => n.id === nodeId);
    }

    /**
     * Get available nodes
     */
    getAvailableNodes() {
        this.syncFromState();
        return this.currentMap?.nodes.filter(n => n.available && !n.visited) || [];
    }

    /**
     * Check if at boss
     */
    isAtBoss() {
        this.syncFromState();
        const current = this.currentMap?.currentNode;
        const node = this.getNode(current);
        return node?.type === 'boss';
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
