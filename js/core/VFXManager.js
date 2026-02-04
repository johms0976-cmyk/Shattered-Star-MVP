/**
 * VFXManager - Centralized Visual Effects System
 * Handles damage numbers, screen shake, flashes, particles, and combat juice
 * @version 1.0.0
 */

class VFXManager {
    constructor(eventBus = null) {
        this.eventBus = eventBus;
        this.container = null;
        this.particlePool = [];
        this.activeEffects = new Set();
        this.shakeTimeout = null;
        
        // Configuration
        this.config = {
            floatingText: {
                duration: 1200,
                rise: 80,
                fadeStart: 0.7, // Start fading at 70% through animation
                fontSize: {
                    small: '1rem',
                    medium: '1.5rem',
                    large: '2rem',
                    critical: '2.5rem'
                }
            },
            screenShake: {
                defaultIntensity: 5,
                defaultDuration: 300,
                maxIntensity: 20
            },
            flash: {
                duration: 150,
                defaultColor: '#ffffff'
            },
            particles: {
                poolSize: 100,
                defaultCount: 10
            }
        };
        
        // Text type styling
        this.textStyles = {
            damage: {
                color: '#ff4757',
                shadowColor: '#8b0000',
                prefix: '-',
                size: 'medium'
            },
            'damage-critical': {
                color: '#ff0000',
                shadowColor: '#8b0000',
                prefix: '-',
                suffix: '!',
                size: 'critical',
                shake: true
            },
            'damage-blocked': {
                color: '#4a9eff',
                shadowColor: '#1a4a8f',
                prefix: '',
                size: 'small'
            },
            block: {
                color: '#4a9eff',
                shadowColor: '#1a4a8f',
                prefix: '+',
                size: 'medium',
                icon: '🛡️'
            },
            heal: {
                color: '#44ff44',
                shadowColor: '#0a5f0a',
                prefix: '+',
                size: 'medium',
                icon: '💚'
            },
            energy: {
                color: '#ffd700',
                shadowColor: '#8b7500',
                prefix: '+',
                size: 'small',
                icon: '⚡'
            },
            corruption: {
                color: '#bf00ff',
                shadowColor: '#4a0066',
                prefix: '+',
                size: 'medium',
                icon: '◉'
            },
            'corruption-loss': {
                color: '#00ff9f',
                shadowColor: '#006644',
                prefix: '-',
                size: 'medium'
            },
            buff: {
                color: '#00f5ff',
                shadowColor: '#006666',
                size: 'small'
            },
            debuff: {
                color: '#ff6b35',
                shadowColor: '#8b3a1a',
                size: 'small'
            },
            miss: {
                color: '#888888',
                shadowColor: '#333333',
                size: 'small',
                text: 'MISS'
            },
            immune: {
                color: '#ffffff',
                shadowColor: '#666666',
                size: 'small',
                text: 'IMMUNE'
            },
            overheat: {
                color: '#ff6b35',
                shadowColor: '#8b3a1a',
                prefix: '+',
                size: 'small',
                icon: '🔥'
            },
            rage: {
                color: '#ff2d55',
                shadowColor: '#8b1a2e',
                prefix: '+',
                size: 'small',
                icon: '💢'
            }
        };
        
        this.init();
    }
    
    /**
     * Initialize the VFX system
     */
    init() {
        // Create VFX container if it doesn't exist
        this.container = document.getElementById('vfx-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'vfx-container';
            this.container.className = 'vfx-container';
            document.body.appendChild(this.container);
        }
        
        // Initialize particle pool
        this.initParticlePool();
        
        // Setup event listeners if eventBus provided
        if (this.eventBus) {
            this.setupEventListeners();
        }
        
        console.log('[VFXManager] Initialized');
    }
    
    /**
     * Setup EventBus listeners for automatic VFX triggers
     */
    setupEventListeners() {
        // Damage events
        this.eventBus.on('damage:dealt', (data) => {
            const { target, amount, blocked, critical } = data;
            const targetEl = this.resolveTarget(target);
            
            if (blocked && blocked > 0) {
                this.floatingText(targetEl, blocked, 'damage-blocked');
            }
            
            if (amount > 0) {
                const type = critical ? 'damage-critical' : 'damage';
                this.floatingText(targetEl, amount, type);
                this.flashElement(targetEl, '#ff0000');
                
                if (amount >= 10 || critical) {
                    this.screenShake(Math.min(amount / 2, 15));
                }
                
                this.particleBurst(targetEl, 'hit');
            }
        });
        
        // Player damage
        this.eventBus.on('player:damaged', (data) => {
            const { amount, blocked } = data;
            const playerEl = document.getElementById('player-character') || 
                            document.querySelector('.player-area');
            
            if (playerEl) {
                if (amount > 0) {
                    this.floatingText(playerEl, amount, 'damage');
                    this.flashElement(playerEl, '#ff0000');
                    this.screenShake(Math.min(amount / 3, 10));
                    this.particleBurst(playerEl, 'hit');
                }
            }
        });
        
        // Block gained
        this.eventBus.on('block:gained', (data) => {
            const { target, amount } = data;
            const targetEl = this.resolveTarget(target) || 
                            document.getElementById('player-character');
            if (targetEl && amount > 0) {
                this.floatingText(targetEl, amount, 'block');
                this.particleBurst(targetEl, 'shield');
            }
        });
        
        // Heal
        this.eventBus.on('heal', (data) => {
            const amount = typeof data === 'number' ? data : data.amount;
            const playerEl = document.getElementById('player-character') || 
                            document.querySelector('.player-area');
            if (playerEl && amount > 0) {
                this.floatingText(playerEl, amount, 'heal');
                this.particleBurst(playerEl, 'heal');
            }
        });
        
        // Energy
        this.eventBus.on('energy:gained', (data) => {
            const amount = typeof data === 'number' ? data : data.amount;
            const energyEl = document.querySelector('.energy-display');
            if (energyEl && amount > 0) {
                this.floatingText(energyEl, amount, 'energy');
                this.pulseElement(energyEl);
            }
        });
        
        // Corruption
        this.eventBus.on('corruption:gained', (data) => {
            const amount = typeof data === 'number' ? data : data.amount;
            const playerEl = document.getElementById('player-character');
            if (playerEl && amount > 0) {
                this.floatingText(playerEl, amount, 'corruption');
                this.particleBurst(playerEl, 'corruption');
                this.voidPulse();
            }
        });
        
        // Overheat (Korvax)
        this.eventBus.on('overheat:changed', (data) => {
            const { current, previous, max } = data;
            if (current > (previous || 0)) {
                const overheatEl = document.getElementById('overheat-ui') || 
                                  document.getElementById('player-character');
                if (overheatEl) {
                    this.floatingText(overheatEl, current - (previous || 0), 'overheat');
                    if (current >= max * 0.8) {
                        this.screenShake(3, 200);
                        this.particleBurst(overheatEl, 'fire');
                    }
                }
            }
        });
        
        // Card played
        this.eventBus.on('card:played', (data) => {
            const handArea = document.getElementById('hand-area');
            if (handArea) {
                this.cardPlayEffect(data.card);
            }
        });
        
        // Enemy death
        this.eventBus.on('enemy:death', (data) => {
            const enemyEl = data.element || document.querySelector(`.enemy[data-index="${data.index}"]`);
            if (enemyEl) {
                this.deathEffect(enemyEl);
            }
        });
        
        // Combat victory
        this.eventBus.on('combat:victory', () => {
            this.victoryEffect();
        });
        
        // Combat defeat
        this.eventBus.on('combat:defeat', () => {
            this.defeatEffect();
        });
    }
    
    /**
     * Resolve target element from various input types
     */
    resolveTarget(target) {
        if (!target) return null;
        if (target instanceof HTMLElement) return target;
        if (typeof target === 'string') return document.querySelector(target);
        if (typeof target === 'number') {
            return document.querySelector(`.enemy[data-index="${target}"]`);
        }
        if (target.element) return target.element;
        if (target.index !== undefined) {
            return document.querySelector(`.enemy[data-index="${target.index}"]`);
        }
        return null;
    }
    
    /**
     * Get element center position
     */
    getElementCenter(element) {
        if (!element) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }
    
    // ==========================================
    // FLOATING TEXT
    // ==========================================
    
    /**
     * Display floating text at a target
     * @param {HTMLElement|string} target - Target element or selector
     * @param {number|string} value - Value to display
     * @param {string} type - Text type (damage, heal, block, etc.)
     * @param {Object} options - Additional options
     */
    floatingText(target, value, type = 'damage', options = {}) {
        const targetEl = this.resolveTarget(target);
        const pos = this.getElementCenter(targetEl);
        
        const style = this.textStyles[type] || this.textStyles.damage;
        const config = this.config.floatingText;
        
        // Create text element
        const textEl = document.createElement('div');
        textEl.className = `vfx-floating-text vfx-text-${type}`;
        
        // Build display text
        let displayText = style.text || '';
        if (!displayText) {
            displayText = (style.icon ? style.icon + ' ' : '') +
                         (style.prefix || '') +
                         value +
                         (style.suffix || '');
        }
        
        textEl.textContent = displayText;
        
        // Apply styling
        textEl.style.cssText = `
            position: fixed;
            left: ${pos.x}px;
            top: ${pos.y}px;
            font-family: 'Bebas Neue', sans-serif;
            font-size: ${config.fontSize[style.size] || config.fontSize.medium};
            font-weight: bold;
            color: ${options.color || style.color};
            text-shadow: 
                0 0 10px ${style.shadowColor},
                0 0 20px ${style.shadowColor},
                2px 2px 0 ${style.shadowColor};
            pointer-events: none;
            z-index: 10000;
            transform: translate(-50%, -50%);
            white-space: nowrap;
        `;
        
        // Add random horizontal offset
        const offsetX = (Math.random() - 0.5) * 40;
        
        // Add to container
        this.container.appendChild(textEl);
        
        // Animate
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / config.duration, 1);
            
            // Eased rise
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const rise = easeOut * config.rise;
            
            // Fade out near end
            const opacity = progress > config.fadeStart 
                ? 1 - ((progress - config.fadeStart) / (1 - config.fadeStart))
                : 1;
            
            // Scale pop at start
            const scale = progress < 0.1 
                ? 0.5 + (progress / 0.1) * 0.7 
                : progress < 0.2 
                    ? 1.2 - ((progress - 0.1) / 0.1) * 0.2 
                    : 1;
            
            textEl.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% - ${rise}px)) scale(${scale})`;
            textEl.style.opacity = opacity;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                textEl.remove();
            }
        };
        
        requestAnimationFrame(animate);
        
        // Trigger shake for critical hits
        if (style.shake) {
            this.screenShake(8, 200);
        }
        
        return textEl;
    }
    
    // ==========================================
    // SCREEN SHAKE
    // ==========================================
    
    /**
     * Shake the screen
     * @param {number} intensity - Shake intensity in pixels
     * @param {number} duration - Duration in milliseconds
     */
    screenShake(intensity = null, duration = null) {
        const config = this.config.screenShake;
        intensity = Math.min(intensity || config.defaultIntensity, config.maxIntensity);
        duration = duration || config.defaultDuration;
        
        const gameContainer = document.getElementById('combat-screen') || 
                             document.querySelector('.screen.active') ||
                             document.body;
        
        // Clear existing shake
        if (this.shakeTimeout) {
            clearTimeout(this.shakeTimeout);
            gameContainer.style.transform = '';
        }
        
        const startTime = performance.now();
        
        const shake = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                gameContainer.style.transform = '';
                return;
            }
            
            // Decreasing intensity over time
            const currentIntensity = intensity * (1 - progress);
            
            // Random offset
            const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
            const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
            
            gameContainer.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            
            requestAnimationFrame(shake);
        };
        
        requestAnimationFrame(shake);
        
        // Cleanup timeout
        this.shakeTimeout = setTimeout(() => {
            gameContainer.style.transform = '';
        }, duration + 50);
    }
    
    // ==========================================
    // ELEMENT FLASH
    // ==========================================
    
    /**
     * Flash an element with a color overlay
     * @param {HTMLElement|string} target - Target element
     * @param {string} color - Flash color
     * @param {number} duration - Flash duration
     */
    flashElement(target, color = null, duration = null) {
        const targetEl = this.resolveTarget(target);
        if (!targetEl) return;
        
        color = color || this.config.flash.defaultColor;
        duration = duration || this.config.flash.duration;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'vfx-flash-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: ${color};
            opacity: 0.7;
            pointer-events: none;
            z-index: 100;
            mix-blend-mode: overlay;
            border-radius: inherit;
        `;
        
        // Ensure parent has position
        const originalPosition = targetEl.style.position;
        if (!originalPosition || originalPosition === 'static') {
            targetEl.style.position = 'relative';
        }
        
        targetEl.appendChild(overlay);
        
        // Animate out
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                overlay.remove();
                if (!originalPosition || originalPosition === 'static') {
                    targetEl.style.position = originalPosition || '';
                }
                return;
            }
            
            overlay.style.opacity = 0.7 * (1 - progress);
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Pulse an element (scale up and down)
     */
    pulseElement(target, scale = 1.2, duration = 200) {
        const targetEl = this.resolveTarget(target);
        if (!targetEl) return;
        
        targetEl.style.transition = `transform ${duration / 2}ms ease-out`;
        targetEl.style.transform = `scale(${scale})`;
        
        setTimeout(() => {
            targetEl.style.transform = 'scale(1)';
            setTimeout(() => {
                targetEl.style.transition = '';
            }, duration / 2);
        }, duration / 2);
    }
    
    // ==========================================
    // PARTICLE SYSTEM
    // ==========================================
    
    /**
     * Initialize particle pool
     */
    initParticlePool() {
        for (let i = 0; i < this.config.particles.poolSize; i++) {
            const particle = document.createElement('div');
            particle.className = 'vfx-particle';
            particle.style.cssText = `
                position: fixed;
                pointer-events: none;
                z-index: 9999;
                opacity: 0;
            `;
            this.particlePool.push(particle);
        }
    }
    
    /**
     * Get a particle from the pool
     */
    getParticle() {
        let particle = this.particlePool.find(p => !p.parentElement);
        if (!particle) {
            particle = document.createElement('div');
            particle.className = 'vfx-particle';
            this.particlePool.push(particle);
        }
        return particle;
    }
    
    /**
     * Create a burst of particles at a target
     * @param {HTMLElement|string} target - Target element
     * @param {string} type - Particle type (hit, heal, shield, fire, corruption)
     * @param {Object} options - Additional options
     */
    particleBurst(target, type = 'hit', options = {}) {
        const targetEl = this.resolveTarget(target);
        const pos = this.getElementCenter(targetEl);
        
        const count = options.count || this.config.particles.defaultCount;
        const particleConfigs = this.getParticleConfig(type);
        
        for (let i = 0; i < count; i++) {
            this.spawnParticle(pos.x, pos.y, particleConfigs);
        }
    }
    
    /**
     * Get particle configuration by type
     */
    getParticleConfig(type) {
        const configs = {
            hit: {
                colors: ['#ff4757', '#ff6b7a', '#ffffff'],
                size: { min: 3, max: 8 },
                speed: { min: 50, max: 150 },
                lifetime: { min: 300, max: 600 },
                gravity: 100,
                shape: 'circle'
            },
            heal: {
                colors: ['#44ff44', '#88ff88', '#ffffff'],
                size: { min: 4, max: 10 },
                speed: { min: 30, max: 80 },
                lifetime: { min: 500, max: 800 },
                gravity: -50, // Float up
                shape: 'circle'
            },
            shield: {
                colors: ['#4a9eff', '#7ab8ff', '#ffffff'],
                size: { min: 3, max: 7 },
                speed: { min: 40, max: 100 },
                lifetime: { min: 400, max: 700 },
                gravity: 0,
                shape: 'square'
            },
            fire: {
                colors: ['#ff6b35', '#ff9500', '#ffcc00'],
                size: { min: 4, max: 12 },
                speed: { min: 20, max: 60 },
                lifetime: { min: 400, max: 800 },
                gravity: -80,
                shape: 'circle'
            },
            corruption: {
                colors: ['#bf00ff', '#8800aa', '#4400ff'],
                size: { min: 3, max: 8 },
                speed: { min: 30, max: 70 },
                lifetime: { min: 500, max: 900 },
                gravity: -30,
                shape: 'circle'
            },
            spark: {
                colors: ['#ffffff', '#ffff00', '#ffd700'],
                size: { min: 2, max: 5 },
                speed: { min: 100, max: 200 },
                lifetime: { min: 200, max: 400 },
                gravity: 150,
                shape: 'circle'
            },
            death: {
                colors: ['#333333', '#666666', '#000000'],
                size: { min: 5, max: 15 },
                speed: { min: 50, max: 120 },
                lifetime: { min: 600, max: 1000 },
                gravity: 50,
                shape: 'circle'
            }
        };
        
        return configs[type] || configs.hit;
    }
    
    /**
     * Spawn a single particle
     */
    spawnParticle(x, y, config) {
        const particle = this.getParticle();
        
        // Random properties
        const angle = Math.random() * Math.PI * 2;
        const speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min);
        const size = config.size.min + Math.random() * (config.size.max - config.size.min);
        const lifetime = config.lifetime.min + Math.random() * (config.lifetime.max - config.lifetime.min);
        const color = config.colors[Math.floor(Math.random() * config.colors.length)];
        
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        // Style particle
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.background = color;
        particle.style.borderRadius = config.shape === 'circle' ? '50%' : '0';
        particle.style.boxShadow = `0 0 ${size}px ${color}`;
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.opacity = '1';
        
        this.container.appendChild(particle);
        
        // Animate
        const startTime = performance.now();
        let currentX = x;
        let currentY = y;
        let currentVy = vy;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const dt = 1 / 60; // Assume 60fps
            const progress = elapsed / lifetime;
            
            if (progress >= 1) {
                particle.remove();
                return;
            }
            
            // Apply gravity
            currentVy += config.gravity * dt;
            
            // Update position
            currentX += vx * dt;
            currentY += currentVy * dt;
            
            // Update style
            particle.style.left = `${currentX}px`;
            particle.style.top = `${currentY}px`;
            particle.style.opacity = 1 - progress;
            particle.style.transform = `scale(${1 - progress * 0.5})`;
            
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }
    
    // ==========================================
    // SPECIAL EFFECTS
    // ==========================================
    
    /**
     * Card play effect - card flies to target
     */
    cardPlayEffect(card, targetEl = null) {
        // Find the played card or create a ghost
        const cardEl = document.querySelector('.combat-card.selected') ||
                      document.querySelector('.card.selected');
        
        if (!cardEl) return;
        
        const startRect = cardEl.getBoundingClientRect();
        const targetPos = targetEl 
            ? this.getElementCenter(targetEl)
            : { x: window.innerWidth / 2, y: window.innerHeight / 3 };
        
        // Create flying card ghost
        const ghost = cardEl.cloneNode(true);
        ghost.className = 'vfx-card-ghost';
        ghost.style.cssText = `
            position: fixed;
            left: ${startRect.left}px;
            top: ${startRect.top}px;
            width: ${startRect.width}px;
            height: ${startRect.height}px;
            pointer-events: none;
            z-index: 10000;
            transition: none;
        `;
        
        this.container.appendChild(ghost);
        
        // Animate to target
        requestAnimationFrame(() => {
            ghost.style.transition = 'all 0.3s ease-out';
            ghost.style.left = `${targetPos.x - startRect.width / 2}px`;
            ghost.style.top = `${targetPos.y - startRect.height / 2}px`;
            ghost.style.transform = 'scale(0.5) rotate(10deg)';
            ghost.style.opacity = '0';
            
            setTimeout(() => {
                ghost.remove();
                // Spawn impact particles based on card type
                if (card?.type === 'attack') {
                    this.particleBurst({ x: targetPos.x, y: targetPos.y }, 'spark', { count: 8 });
                } else if (card?.type === 'skill') {
                    this.particleBurst({ x: targetPos.x, y: targetPos.y }, 'shield', { count: 6 });
                }
            }, 300);
        });
    }
    
    /**
     * Enemy death effect
     */
    deathEffect(targetEl) {
        const pos = this.getElementCenter(targetEl);
        
        // Big particle burst
        this.particleBurst(targetEl, 'death', { count: 20 });
        
        // Screen flash
        this.screenFlash('#ff0000', 0.3, 200);
        
        // Fade out the enemy
        if (targetEl) {
            targetEl.style.transition = 'all 0.5s ease-out';
            targetEl.style.transform = 'scale(1.2)';
            targetEl.style.opacity = '0';
            targetEl.style.filter = 'brightness(3)';
        }
    }
    
    /**
     * Victory effect
     */
    victoryEffect() {
        // Golden particle shower
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const x = Math.random() * window.innerWidth;
                this.particleBurst(
                    { x, y: 0 },
                    'spark',
                    { count: 15 }
                );
            }, i * 200);
        }
        
        // Screen flash
        this.screenFlash('#ffd700', 0.4, 500);
        
        // Display "VICTORY" text
        this.bigText('VICTORY', '#ffd700');
    }
    
    /**
     * Defeat effect
     */
    defeatEffect() {
        // Screen shake
        this.screenShake(15, 500);
        
        // Red flash
        this.screenFlash('#ff0000', 0.5, 800);
        
        // Display "DEFEAT" text
        this.bigText('DEFEAT', '#ff0000');
    }
    
    /**
     * Flash the entire screen
     */
    screenFlash(color, opacity = 0.5, duration = 300) {
        const flash = document.createElement('div');
        flash.className = 'vfx-screen-flash';
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: ${color};
            opacity: ${opacity};
            pointer-events: none;
            z-index: 9998;
        `;
        
        document.body.appendChild(flash);
        
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                flash.remove();
                return;
            }
            
            flash.style.opacity = opacity * (1 - progress);
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Display big centered text
     */
    bigText(text, color = '#ffffff', duration = 1500) {
        const el = document.createElement('div');
        el.className = 'vfx-big-text';
        el.textContent = text;
        el.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            font-family: 'Bebas Neue', sans-serif;
            font-size: 5rem;
            font-weight: bold;
            color: ${color};
            text-shadow: 
                0 0 20px ${color},
                0 0 40px ${color},
                4px 4px 0 rgba(0,0,0,0.5);
            pointer-events: none;
            z-index: 10001;
            letter-spacing: 0.3em;
        `;
        
        document.body.appendChild(el);
        
        // Animate in
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            el.style.transform = 'translate(-50%, -50%) scale(1)';
            
            // Fade out
            setTimeout(() => {
                el.style.transition = 'all 0.5s ease-out';
                el.style.opacity = '0';
                el.style.transform = 'translate(-50%, -50%) scale(1.2)';
                
                setTimeout(() => el.remove(), 500);
            }, duration - 500);
        });
    }
    
    /**
     * Corruption/void pulse effect
     */
    voidPulse() {
        const pulse = document.createElement('div');
        pulse.className = 'vfx-void-pulse';
        pulse.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            width: 10px;
            height: 10px;
            background: transparent;
            border: 3px solid #bf00ff;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 9997;
        `;
        
        document.body.appendChild(pulse);
        
        const startTime = performance.now();
        const duration = 800;
        const maxSize = Math.max(window.innerWidth, window.innerHeight) * 1.5;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                pulse.remove();
                return;
            }
            
            const size = progress * maxSize;
            const opacity = 1 - progress;
            
            pulse.style.width = `${size}px`;
            pulse.style.height = `${size}px`;
            pulse.style.opacity = opacity;
            pulse.style.borderWidth = `${3 * (1 - progress)}px`;
            
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Combo counter effect
     */
    comboText(count) {
        if (count < 2) return;
        
        const el = document.createElement('div');
        el.className = 'vfx-combo';
        el.innerHTML = `<span class="combo-count">${count}</span><span class="combo-label">COMBO!</span>`;
        el.style.cssText = `
            position: fixed;
            top: 20%;
            right: 10%;
            font-family: 'Bebas Neue', sans-serif;
            color: #ffd700;
            text-shadow: 0 0 10px #ffd700;
            pointer-events: none;
            z-index: 10000;
            text-align: center;
        `;
        
        const countStyle = `
            font-size: 3rem;
            display: block;
        `;
        const labelStyle = `
            font-size: 1rem;
            letter-spacing: 0.2em;
            display: block;
        `;
        
        el.querySelector('.combo-count').style.cssText = countStyle;
        el.querySelector('.combo-label').style.cssText = labelStyle;
        
        document.body.appendChild(el);
        
        // Pop animation
        el.style.transform = 'scale(0)';
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            el.style.transform = 'scale(1)';
            
            setTimeout(() => {
                el.style.transition = 'all 0.3s ease-out';
                el.style.opacity = '0';
                el.style.transform = 'scale(1.2) translateY(-20px)';
                setTimeout(() => el.remove(), 300);
            }, 800);
        });
    }
    
    /**
     * Clean up all active effects
     */
    cleanup() {
        // Remove all VFX elements
        this.container.innerHTML = '';
        
        // Clear shake
        if (this.shakeTimeout) {
            clearTimeout(this.shakeTimeout);
        }
        
        // Reset any screen transforms
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.style.transform = '');
    }
}

// Create singleton instance
const vfxManager = new VFXManager();

export { VFXManager, vfxManager };
export default vfxManager;
