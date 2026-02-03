/**
 * MapGenerator - Generates procedural node maps for each act
 * UPDATED: Adjusted positioning for scrollable extended map
 * @version 0.3.0
 */
class MapGenerator {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        
        this.currentMap = null;
        this.currentNodeIndex = 0;
        
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
                shop: { weight: 10, icon: '🛒', name: 'Shop' },
                rest: { weight: 10, icon: '🔥', name: 'Rest' },
                treasure: { weight: 5, icon: '💎', name: 'Treasure' },
                boss: { weight: 0, icon: '👁️', name: 'Boss' },
                start: { weight: 0, icon: '🚀', name: 'Start' }
            },
            positioning: {
                usableHeight: 90,
                topMargin: 5,
                bottomMargin: 5,
                horizontalMargin: 8,
                positionRandomness: 0.25
            }
        };
    }

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

    generateAct(actNumber) {
        console.log(`[MapGenerator] Generating Act ${actNumber} map (scrollable version)`);
        
        const nodeCount = this.config.nodesPerAct[actNumber] || 15;
        const map = {
            act: actNumber,
            nodes: [],
            paths: [],
            currentNode: null,
            visitedNodes: []
        };
        
        const layers = this.generateLayers(nodeCount);
        console.log(`[MapGenerator] Generated ${layers.length} layers`);
        
        let nodeId = 0;
        layers.forEach((layer, layerIndex) => {
            layer.forEach((nodeType, posIndex) => {
                const node = {
                    id: `node_${nodeId++}`,
                    type: nodeType,
                    layer: layerIndex,
                    position: posIndex,
                    visited: false,
                    available: layerIndex === 0,
                    x: 0,
                    y: 0
                };
                map.nodes.push(node);
            });
        });
        
        const bossNode = {
            id: `node_boss`,
            type: 'boss',
            layer: layers.length,
            position: 0,
            visited: false,
            available: false,
            x: 50,
            y: 95
        };
        map.nodes.push(bossNode);
        
        this.generateConnections(map, layers);
        this.calculateNodePositions(map, layers);
        
        this.currentMap = map;
        this.state.set('map', map);
        
        console.log(`[MapGenerator] Map generated with ${map.nodes.length} nodes and ${map.paths.length} paths`);
        this.eventBus.emit('map:generated', map);
        this.eventBus.emit('map:updated');
        
        return map;
    }

    generateLayers(totalNodes) {
        const layers = [];
        let remaining = totalNodes;
        
        const firstLayerCount = Math.min(remaining, 2 + Math.floor(Math.random() * 2));
        layers.push(this.generateLayer(firstLayerCount, 0));
        remaining -= firstLayerCount;
        
        while (remaining > 4) {
            const layerCount = Math.min(remaining - 3, 2 + Math.floor(Math.random() * 3));
            layers.push(this.generateLayer(layerCount, layers.length));
            remaining -= layerCount;
        }
        
        const preBossLayer = this.generateLayer(Math.min(remaining, 3), layers.length, true);
        layers.push(preBossLayer);
        
        return layers;
    }

    generateLayer(count, layerIndex, includeRest = false) {
        const layer = [];
        
        if (includeRest) {
            layer.push('rest');
            count--;
        }
        
        for (let i = 0; i < count; i++) {
            const type = this.getRandomNodeType(layerIndex);
            layer.push(type);
        }
        
        return this.shuffleArray(layer);
    }

    getRandomNodeType(layerIndex) {
        const types = Object.entries(this.config.nodeTypes)
            .filter(([type, config]) => type !== 'boss' && type !== 'start' && config.weight > 0);
        
        const totalWeight = types.reduce((sum, [, config]) => sum + config.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const [type, config] of types) {
            random -= config.weight;
            if (random <= 0) {
                if (type === 'elite' && layerIndex < 3) {
                    return 'combat';
                }
                return type;
            }
        }
        
        return 'combat';
    }

    generateConnections(map, layers) {
        for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
            const currentLayerNodes = map.nodes.filter(n => n.layer === layerIndex);
            const nextLayerNodes = map.nodes.filter(n => n.layer === layerIndex + 1);
            
            if (nextLayerNodes.length === 0) continue;
            
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

    calculateNodePositions(map, layers) {
        const pos = this.config.positioning;
        const totalLayers = layers.length + 1;
        
        const layerHeight = pos.usableHeight / totalLayers;
        const startY = pos.bottomMargin;
        
        console.log(`[MapGenerator] Positioning ${totalLayers} layers across ${pos.usableHeight}% height`);
        
        layers.forEach((layer, layerIndex) => {
            const layerNodes = map.nodes.filter(n => n.layer === layerIndex);
            const nodeCount = layerNodes.length;
            
            const baseY = startY + (layerIndex * layerHeight) + (layerHeight / 2);
            
            const usableWidth = 100 - (pos.horizontalMargin * 2);
            const nodeSpacing = usableWidth / (nodeCount + 1);
            
            layerNodes.forEach((node, nodeIndex) => {
                const baseX = pos.horizontalMargin + nodeSpacing * (nodeIndex + 1);
                
                const randomFactor = pos.positionRandomness;
                const offsetX = (Math.random() - 0.5) * nodeSpacing * randomFactor;
                const offsetY = (Math.random() - 0.5) * layerHeight * randomFactor * 0.5;
                
                node.x = Math.max(
                    pos.horizontalMargin + 5, 
                    Math.min(100 - pos.horizontalMargin - 5, baseX + offsetX)
                );
                node.y = Math.max(
                    pos.bottomMargin, 
                    Math.min(pos.bottomMargin + pos.usableHeight, baseY + offsetY)
                );
            });
        });
        
        const bossNode = map.nodes.find(n => n.type === 'boss');
        if (bossNode) {
            bossNode.x = 50;
            bossNode.y = pos.bottomMargin + pos.usableHeight - (layerHeight / 4);
        }
    }

    selectNode(nodeId) {
        this.syncFromState();
        
        if (!this.currentMap) {
            console.error('[MapGenerator] Cannot select node - no map available');
            return false;
        }
        
        const node = this.currentMap.nodes.find(n => n.id === nodeId);
        
        if (!node) {
            console.error(`[MapGenerator] Node "${nodeId}" not found`);
            return false;
        }
        
        if (!node.available) {
            console.warn(`[MapGenerator] Node "${nodeId}" is not available`);
            return false;
        }
        
        if (node.visited) {
            console.warn(`[MapGenerator] Node "${nodeId}" already visited`);
            return false;
        }
        
        console.log(`[MapGenerator] Selected node: ${node.id} (${node.type})`);
        
        node.visited = true;
        this.currentMap.currentNode = nodeId;
        
        if (!this.currentMap.visitedNodes) {
            this.currentMap.visitedNodes = [];
        }
        this.currentMap.visitedNodes.push(nodeId);
        
        this.state.set('currentNode', node);
        this.state.set('currentNodeType', node.type);
        
        try {
            this.state.increment('floor');
        } catch (e) {
            const floor = this.state.get('floor') || 0;
            this.state.set('floor', floor + 1);
        }
        
        this.updateAvailableNodes(nodeId);
        
        this.state.set('map', this.currentMap);
        this.eventBus.emit('node:selected', node);
        
        return true;
    }

    updateAvailableNodes(currentNodeId) {
        this.syncFromState();
        
        if (!this.currentMap) return;
        
        this.currentMap.nodes.forEach(node => {
            node.available = false;
        });
        
        const paths = this.currentMap.paths.filter(c => c.from === currentNodeId);
        paths.forEach(path => {
            const targetNode = this.currentMap.nodes.find(n => n.id === path.to);
            if (targetNode && !targetNode.visited) {
                targetNode.available = true;
            }
        });
        
        this.state.set('map', this.currentMap);
        this.eventBus.emit('map:updated');
    }

    completeCurrentNode() {
        this.syncFromState();
        if (!this.currentMap) return;
        
        const nodeId = this.currentMap.currentNode;
        if (!nodeId) return;
        
        this.eventBus.emit('node:completed', nodeId);
    }

    getCurrentMap() {
        this.syncFromState();
        return this.currentMap;
    }

    getNode(nodeId) {
        this.syncFromState();
        return this.currentMap?.nodes.find(n => n.id === nodeId);
    }

    getAvailableNodes() {
        this.syncFromState();
        return this.currentMap?.nodes.filter(n => n.available && !n.visited) || [];
    }

    isAtBoss() {
        this.syncFromState();
        const current = this.currentMap?.currentNode;
        const node = this.getNode(current);
        return node?.type === 'boss';
    }

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
