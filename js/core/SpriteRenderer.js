/**
 * SpriteRenderer - Handles sprite rendering, animation, and layered compositions
 * 
 * Designed for easy upgrade path:
 * - Start with placeholder canvases
 * - Upgrade to sprite sheets when art is ready
 * - Supports layered parallax backgrounds
 * - Animation state machines
 */

import assetManager from '../core/AssetManager.js';

class SpriteRenderer {
    constructor() {
        this.activeAnimations = new Map();
        this.animationCallbacks = new Map();
    }

    /**
     * Render a sprite to a canvas context
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {string} category - Asset category (heroes, enemies, etc.)
     * @param {string} id - Asset identifier
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Rendering options
     */
    async render(ctx, category, id, x, y, options = {}) {
        const asset = await assetManager.getAsset(category, id);
        
        if (!asset) return;
        
        const {
            scale = 1,
            alpha = 1,
            flipX = false,
            flipY = false,
            rotation = 0,
            frame = 0,
            animation = null,
            tint = null,
            shadowColor = null,
            shadowBlur = 0
        } = options;
        
        ctx.save();
        
        // Apply transformations
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        
        if (rotation) {
            ctx.rotate(rotation);
        }
        
        if (flipX || flipY) {
            ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        }
        
        ctx.scale(scale, scale);
        
        // Apply shadow
        if (shadowColor) {
            ctx.shadowColor = shadowColor;
            ctx.shadowBlur = shadowBlur;
        }
        
        // Determine source based on asset type
        let source = asset.canvas || asset.image;
        let sx = 0, sy = 0, sw = asset.width, sh = asset.height;
        
        // Handle sprite sheets
        if (asset.type === 'spritesheet') {
            const frameIndex = this.getAnimationFrame(id, animation, frame);
            const framesPerRow = asset.framesPerRow || 1;
            
            sx = (frameIndex % framesPerRow) * asset.frameWidth;
            sy = Math.floor(frameIndex / framesPerRow) * asset.frameHeight;
            sw = asset.frameWidth;
            sh = asset.frameHeight;
        }
        
        // Draw the sprite
        const drawX = -sw / 2;
        const drawY = -sh / 2;
        
        if (source) {
            ctx.drawImage(source, sx, sy, sw, sh, drawX, drawY, sw, sh);
        }
        
        // Apply tint overlay
        if (tint) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = tint;
            ctx.fillRect(drawX, drawY, sw, sh);
        }
        
        ctx.restore();
    }

    /**
     * Render synchronously using cached/placeholder assets
     */
    renderSync(ctx, category, id, x, y, options = {}) {
        const asset = assetManager.getAssetSync(category, id);
        
        if (!asset) return;
        
        const {
            scale = 1,
            alpha = 1,
            flipX = false,
            rotation = 0,
            frame = 0
        } = options;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        
        if (rotation) ctx.rotate(rotation);
        if (flipX) ctx.scale(-1, 1);
        ctx.scale(scale, scale);
        
        const source = asset.canvas || asset.image;
        if (source) {
            ctx.drawImage(source, -asset.width / 2, -asset.height / 2);
        }
        
        ctx.restore();
    }

    /**
     * Render a layered background with parallax
     * @param {CanvasRenderingContext2D} ctx - Target context
     * @param {string} bgId - Background identifier
     * @param {number} cameraX - Camera X offset for parallax
     * @param {number} cameraY - Camera Y offset for parallax
     */
    async renderBackground(ctx, bgId, cameraX = 0, cameraY = 0) {
        const asset = await assetManager.getAsset('backgrounds', bgId);
        
        if (!asset) return;
        
        if (asset.type === 'layered' && asset.layers) {
            // Render each layer with parallax
            for (const layer of asset.layers) {
                const offsetX = cameraX * (layer.parallax || 0);
                const offsetY = cameraY * (layer.parallax || 0);
                
                ctx.drawImage(
                    layer.image,
                    -offsetX,
                    -offsetY,
                    ctx.canvas.width,
                    ctx.canvas.height
                );
            }
        } else {
            // Single layer background
            const source = asset.canvas || asset.image;
            if (source) {
                ctx.drawImage(source, 0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        }
    }

    /**
     * Render background synchronously
     */
    renderBackgroundSync(ctx, bgId, cameraX = 0, cameraY = 0) {
        const asset = assetManager.getAssetSync('backgrounds', bgId);
        
        if (!asset) return;
        
        const source = asset.canvas || asset.image;
        if (source) {
            ctx.drawImage(source, 0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    }

    // ===========================================
    // ANIMATION SYSTEM
    // ===========================================

    /**
     * Start an animation
     * @param {string} entityId - Unique identifier for the animated entity
     * @param {string} animationName - Name of the animation
     * @param {Object} animationData - Animation configuration
     * @param {Function} onComplete - Callback when animation completes
     */
    startAnimation(entityId, animationName, animationData, onComplete = null) {
        const animation = {
            name: animationName,
            frames: animationData.frames || [0],
            speed: animationData.speed || 100, // ms per frame
            loop: animationData.loop !== false,
            currentFrame: 0,
            lastFrameTime: performance.now(),
            playing: true
        };
        
        this.activeAnimations.set(entityId, animation);
        
        if (onComplete) {
            this.animationCallbacks.set(entityId, onComplete);
        }
    }

    /**
     * Stop an animation
     */
    stopAnimation(entityId) {
        this.activeAnimations.delete(entityId);
        this.animationCallbacks.delete(entityId);
    }

    /**
     * Update all active animations
     */
    updateAnimations() {
        const now = performance.now();
        
        for (const [entityId, anim] of this.activeAnimations) {
            if (!anim.playing) continue;
            
            const elapsed = now - anim.lastFrameTime;
            
            if (elapsed >= anim.speed) {
                anim.currentFrame++;
                anim.lastFrameTime = now;
                
                if (anim.currentFrame >= anim.frames.length) {
                    if (anim.loop) {
                        anim.currentFrame = 0;
                    } else {
                        anim.playing = false;
                        const callback = this.animationCallbacks.get(entityId);
                        if (callback) {
                            callback();
                            this.animationCallbacks.delete(entityId);
                        }
                    }
                }
            }
        }
    }

    /**
     * Get current animation frame for an entity
     */
    getAnimationFrame(entityId, animationName, defaultFrame = 0) {
        const anim = this.activeAnimations.get(entityId);
        
        if (!anim || anim.name !== animationName) {
            return defaultFrame;
        }
        
        return anim.frames[anim.currentFrame];
    }

    /**
     * Check if animation is playing
     */
    isAnimating(entityId) {
        const anim = this.activeAnimations.get(entityId);
        return anim?.playing || false;
    }

    // ===========================================
    // ENTITY RENDERING HELPERS
    // ===========================================

    /**
     * Render a hero with all effects
     */
    async renderHero(ctx, heroId, x, y, state = {}) {
        const {
            animation = 'idle',
            hp = 100,
            maxHp = 100,
            overheat = 0,
            effects = [],
            facing = 'right'
        } = state;
        
        // Determine tint based on state
        let tint = null;
        let shadowColor = null;
        let shadowBlur = 0;
        
        if (hp < maxHp * 0.25) {
            tint = 'rgba(255, 0, 0, 0.3)'; // Low HP warning
        }
        
        if (overheat > 50) {
            shadowColor = '#ff4400';
            shadowBlur = overheat / 5;
        }
        
        // Check for status effects
        if (effects.includes('stealth')) {
            tint = 'rgba(0, 0, 0, 0.5)';
        }
        
        await this.render(ctx, 'heroes', heroId, x, y, {
            animation,
            flipX: facing === 'left',
            tint,
            shadowColor,
            shadowBlur,
            scale: 1
        });
        
        // Render status effect indicators
        this.renderStatusEffects(ctx, x, y - 100, effects);
    }

    /**
     * Render an enemy with intent indicator
     */
    async renderEnemy(ctx, enemyId, x, y, state = {}) {
        const {
            hp = 100,
            maxHp = 100,
            intent = null,
            effects = [],
            animation = 'idle'
        } = state;
        
        // Render enemy sprite
        await this.render(ctx, 'enemies', enemyId, x, y, {
            animation,
            scale: 1
        });
        
        // Render HP bar
        this.renderHealthBar(ctx, x, y + 50, hp, maxHp, 60);
        
        // Render intent
        if (intent) {
            this.renderIntent(ctx, x, y - 60, intent);
        }
        
        // Render status effects
        this.renderStatusEffects(ctx, x, y - 80, effects);
    }

    /**
     * Render a health bar
     */
    renderHealthBar(ctx, x, y, current, max, width = 60) {
        const height = 6;
        const padding = 1;
        
        // Background
        ctx.fillStyle = '#333333';
        ctx.fillRect(x - width / 2, y, width, height);
        
        // Health fill
        const healthPercent = Math.max(0, current / max);
        const healthColor = healthPercent > 0.5 ? '#44ff44' : 
                           healthPercent > 0.25 ? '#ffaa00' : '#ff4444';
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(
            x - width / 2 + padding,
            y + padding,
            (width - padding * 2) * healthPercent,
            height - padding * 2
        );
        
        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - width / 2, y, width, height);
    }

    /**
     * Render enemy intent indicator
     */
    renderIntent(ctx, x, y, intent) {
        const icons = {
            attack: '⚔️',
            defend: '🛡️',
            buff: '⬆️',
            debuff: '⬇️',
            unknown: '❓'
        };
        
        const icon = icons[intent.type] || icons.unknown;
        
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(icon, x, y);
        
        if (intent.value) {
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = intent.type === 'attack' ? '#ff4444' : '#ffffff';
            ctx.fillText(intent.value.toString(), x, y + 18);
        }
    }

    /**
     * Render status effect icons
     */
    renderStatusEffects(ctx, x, y, effects = []) {
        if (effects.length === 0) return;
        
        const iconSize = 16;
        const spacing = 4;
        const totalWidth = effects.length * (iconSize + spacing) - spacing;
        let currentX = x - totalWidth / 2;
        
        const effectIcons = {
            bleed: { icon: '🩸', color: '#ff0000' },
            burn: { icon: '🔥', color: '#ff6600' },
            poison: { icon: '☠️', color: '#00ff00' },
            weak: { icon: '💔', color: '#888888' },
            vulnerable: { icon: '🎯', color: '#ffaa00' },
            strength: { icon: '💪', color: '#ff4444' },
            dexterity: { icon: '⚡', color: '#44ff44' },
            block: { icon: '🛡️', color: '#4488ff' },
            stealth: { icon: '👤', color: '#333333' },
            corruption: { icon: '👁', color: '#8800ff' },
            overheat: { icon: '🌡️', color: '#ff4400' },
            radiance: { icon: '✨', color: '#ffdd00' }
        };
        
        ctx.font = `${iconSize}px Arial`;
        ctx.textAlign = 'center';
        
        for (const effect of effects) {
            const effectData = effectIcons[effect.type] || { icon: '?', color: '#ffffff' };
            
            ctx.fillText(effectData.icon, currentX + iconSize / 2, y);
            
            if (effect.stacks && effect.stacks > 1) {
                ctx.font = '10px Arial';
                ctx.fillStyle = effectData.color;
                ctx.fillText(effect.stacks.toString(), currentX + iconSize, y + 8);
                ctx.font = `${iconSize}px Arial`;
            }
            
            currentX += iconSize + spacing;
        }
    }

    // ===========================================
    // CARD RENDERING
    // ===========================================

    /**
     * Render a card
     */
    renderCard(ctx, cardData, x, y, options = {}) {
        const {
            scale = 1,
            hover = false,
            selected = false,
            playable = true,
            corrupted = false
        } = options;
        
        const width = 120 * scale;
        const height = 160 * scale;
        
        ctx.save();
        ctx.translate(x, y);
        
        // Card background
        const cardColors = {
            attack: '#4a1a1a',
            skill: '#1a1a4a',
            power: '#4a4a1a',
            corrupted: '#2a1a3a'
        };
        
        const cardType = corrupted ? 'corrupted' : (cardData.type || 'attack');
        const bgColor = cardColors[cardType] || cardColors.attack;
        
        // Shadow
        if (hover) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 15;
        }
        
        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        
        // Border
        ctx.strokeStyle = hover ? '#ffffff' : (selected ? '#ffff00' : '#666666');
        ctx.lineWidth = hover ? 3 : 2;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        
        // Not playable overlay
        if (!playable) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(-width / 2, -height / 2, width, height);
        }
        
        // Energy cost
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.arc(-width / 2 + 15, -height / 2 + 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${14 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cardData.cost?.toString() || '0', -width / 2 + 15, -height / 2 + 15);
        
        // Card name
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${12 * scale}px Arial`;
        ctx.fillText(cardData.name || 'Card', 0, -height / 2 + 40);
        
        // Type indicator
        ctx.font = `${10 * scale}px Arial`;
        ctx.fillStyle = '#888888';
        ctx.fillText(cardType.toUpperCase(), 0, -height / 2 + 55);
        
        // Description (simplified)
        ctx.font = `${9 * scale}px Arial`;
        ctx.fillStyle = '#cccccc';
        const desc = cardData.description || '';
        const words = desc.split(' ');
        let line = '';
        let lineY = 0;
        
        for (const word of words) {
            const testLine = line + word + ' ';
            if (ctx.measureText(testLine).width > width - 20) {
                ctx.fillText(line, 0, lineY);
                line = word + ' ';
                lineY += 12 * scale;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 0, lineY);
        
        // Corruption effect
        if (corrupted) {
            ctx.strokeStyle = '#8800ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10);
            ctx.setLineDash([]);
        }
        
        ctx.restore();
    }

    /**
     * Clear all animations
     */
    clearAllAnimations() {
        this.activeAnimations.clear();
        this.animationCallbacks.clear();
    }
}

const spriteRenderer = new SpriteRenderer();
export { SpriteRenderer, spriteRenderer };
export default spriteRenderer;
