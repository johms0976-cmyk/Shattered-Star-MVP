/**
 * AssetManager - Centralized asset loading and management
 * 
 * Designed for easy artwork upgrades:
 * - Supports placeholder → production art swapping via manifest
 * - Handles sprite sheets, layered backgrounds, animations
 * - Automatic fallback to placeholders when assets missing
 * - Preloading with progress tracking
 */

class AssetManager {
    constructor() {
        this.cache = new Map();
        this.loading = new Map();
        this.manifests = new Map();
        
        // Base paths - change these when upgrading assets
        this.basePaths = {
            images: './assets/images/',
            audio: './assets/audio/',
            sprites: './assets/sprites/',
            backgrounds: './assets/images/backgrounds/',
            heroes: './assets/images/heroes/',
            enemies: './assets/images/enemies/',
            effects: './assets/images/effects/',
            ui: './assets/images/ui/',
            cards: './assets/images/cards/'
        };
        
        // Asset quality setting (for future HD/SD options)
        this.quality = 'standard'; // 'low', 'standard', 'high'
        
        // Placeholder generators for missing assets
        this.placeholderGenerators = {
            hero: this.generateHeroPlaceholder.bind(this),
            enemy: this.generateEnemyPlaceholder.bind(this),
            card: this.generateCardPlaceholder.bind(this),
            background: this.generateBackgroundPlaceholder.bind(this),
            effect: this.generateEffectPlaceholder.bind(this)
        };
        
        // Define asset manifests (what assets exist)
        this.initializeManifests();
    }

    /**
     * Initialize asset manifests
     * Edit these when adding real artwork
     */
    initializeManifests() {
        // Hero sprites manifest
        this.manifests.set('heroes', {
            korvax: {
                idle: { type: 'svg', path: 'heroes/korvax.svg', frames: 1 },
                attack: { type: 'placeholder', frames: 4 },
                hurt: { type: 'placeholder', frames: 2 },
                death: { type: 'placeholder', frames: 6 },
                special: { type: 'placeholder', frames: 8 }
            },
            lyria: {
                idle: { type: 'placeholder', frames: 1 },
                attack: { type: 'placeholder', frames: 4 },
                hurt: { type: 'placeholder', frames: 2 },
                death: { type: 'placeholder', frames: 6 },
                special: { type: 'placeholder', frames: 8 }
            },
            auren: {
                idle: { type: 'placeholder', frames: 1 },
                attack: { type: 'placeholder', frames: 4 },
                hurt: { type: 'placeholder', frames: 2 },
                death: { type: 'placeholder', frames: 6 },
                special: { type: 'placeholder', frames: 8 }
            },
            shade: {
                idle: { type: 'placeholder', frames: 1 },
                attack: { type: 'placeholder', frames: 4 },
                hurt: { type: 'placeholder', frames: 2 },
                death: { type: 'placeholder', frames: 6 },
                special: { type: 'placeholder', frames: 8 }
            }
        });

        // Enemy sprites manifest
        this.manifests.set('enemies', {
            rustborn_raider: { type: 'placeholder', frames: 1 },
            scrap_golem: { type: 'placeholder', frames: 1 },
            sand_crawler: { type: 'placeholder', frames: 1 },
            rust_prophet: { type: 'placeholder', frames: 1 },
            feral_titan: { type: 'placeholder', frames: 1 },
            scrap_king: { type: 'svg', path: 'enemies/scrap_king.svg', frames: 1 },
            // Act 2 enemies
            choir_acolyte: { type: 'placeholder', frames: 1 },
            time_lost_beast: { type: 'placeholder', frames: 1 },
            echo_phantom: { type: 'placeholder', frames: 1 },
            marsh_siren: { type: 'placeholder', frames: 1 },
            // Bosses
            rust_titan: { type: 'placeholder', frames: 1 },
            the_witness: { type: 'placeholder', frames: 1 },
            xalkorath: { type: 'placeholder', frames: 1 }
        });

        // Backgrounds manifest
        this.manifests.set('backgrounds', {
            title: { type: 'generated', generator: 'starfield' },
            ironspine: { type: 'placeholder', layers: ['sky', 'far', 'mid', 'near'] },
            eclipse_marsh: { type: 'placeholder', layers: ['sky', 'far', 'mid', 'near'] },
            radiant_highlands: { type: 'placeholder', layers: ['sky', 'far', 'mid', 'near'] },
            obsidian_thicket: { type: 'placeholder', layers: ['sky', 'far', 'mid', 'near'] },
            cradle_abyss: { type: 'placeholder', layers: ['void', 'far', 'mid', 'near'] },
            combat_default: { type: 'svg', path: 'backgrounds/space_bg.svg' }
        });

        // UI elements manifest
        this.manifests.set('ui', {
            logo: { type: 'svg', path: 'ui/logo.svg' },
            card_frame_attack: { type: 'placeholder' },
            card_frame_skill: { type: 'placeholder' },
            card_frame_power: { type: 'placeholder' },
            card_frame_corrupted: { type: 'placeholder' },
            energy_orb: { type: 'placeholder' },
            health_bar: { type: 'placeholder' },
            corruption_meter: { type: 'placeholder' }
        });

        // Visual effects manifest
        this.manifests.set('effects', {
            damage_numbers: { type: 'generated' },
            hit_spark: { type: 'placeholder', frames: 4 },
            block_shield: { type: 'placeholder', frames: 3 },
            corruption_particle: { type: 'generated' },
            void_tendril: { type: 'generated' },
            radiance_burst: { type: 'placeholder', frames: 6 },
            overheat_steam: { type: 'generated' },
            temporal_distortion: { type: 'generated' }
        });
    }

    /**
     * Get asset - loads if needed, returns from cache if available
     * @param {string} category - Asset category
     * @param {string} id - Asset identifier
     * @param {string} variant - Optional variant (e.g., animation state)
     * @returns {Promise<HTMLImageElement|HTMLCanvasElement|Object>}
     */
    async getAsset(category, id, variant = 'default') {
        const cacheKey = `${category}:${id}:${variant}`;
        
        // Return cached asset
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Return loading promise if already loading
        if (this.loading.has(cacheKey)) {
            return this.loading.get(cacheKey);
        }
        
        // Start loading
        const loadPromise = this.loadAsset(category, id, variant);
        this.loading.set(cacheKey, loadPromise);
        
        try {
            const asset = await loadPromise;
            this.cache.set(cacheKey, asset);
            this.loading.delete(cacheKey);
            return asset;
        } catch (error) {
            this.loading.delete(cacheKey);
            console.warn(`[AssetManager] Failed to load ${cacheKey}, using placeholder`);
            return this.getPlaceholder(category, id);
        }
    }

    /**
     * Load an asset based on its manifest entry
     */
    async loadAsset(category, id, variant) {
        const manifest = this.manifests.get(category);
        if (!manifest) {
            throw new Error(`Unknown asset category: ${category}`);
        }
        
        let assetInfo = manifest[id];
        if (!assetInfo) {
            // Return placeholder for unknown assets
            return this.getPlaceholder(category, id);
        }
        
        // Handle variant (e.g., hero animations)
        if (variant !== 'default' && assetInfo[variant]) {
            assetInfo = assetInfo[variant];
        }
        
        switch (assetInfo.type) {
            case 'svg':
            case 'png':
            case 'jpg':
                return this.loadImage(this.basePaths.images + assetInfo.path);
            
            case 'spritesheet':
                return this.loadSpriteSheet(assetInfo);
            
            case 'generated':
                return this.generateAsset(category, id, assetInfo);
            
            case 'placeholder':
            default:
                return this.getPlaceholder(category, id, assetInfo);
        }
    }

    /**
     * Load an image file
     */
    loadImage(path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
            img.src = path;
        });
    }

    /**
     * Load a sprite sheet and return sprite data
     */
    async loadSpriteSheet(info) {
        const img = await this.loadImage(this.basePaths.sprites + info.path);
        return {
            image: img,
            frameWidth: info.frameWidth,
            frameHeight: info.frameHeight,
            frames: info.frames,
            animations: info.animations || {}
        };
    }

    /**
     * Generate a procedural asset
     */
    generateAsset(category, id, info) {
        switch (info.generator || id) {
            case 'starfield':
                return this.generateStarfield();
            case 'corruption_particle':
                return this.generateCorruptionParticle();
            case 'void_tendril':
                return this.generateVoidTendril();
            case 'overheat_steam':
                return this.generateOverheatSteam();
            case 'temporal_distortion':
                return this.generateTemporalDistortion();
            default:
                return this.getPlaceholder(category, id);
        }
    }

    /**
     * Get placeholder asset
     */
    getPlaceholder(category, id, info = {}) {
        const generator = this.placeholderGenerators[category];
        if (generator) {
            return generator(id, info);
        }
        return this.generateGenericPlaceholder(id);
    }

    // ==========================================
    // PLACEHOLDER GENERATORS
    // These create temporary visuals until real art is added
    // ==========================================

    /**
     * Generate hero placeholder sprite
     */
    generateHeroPlaceholder(heroId, info = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 192;
        const ctx = canvas.getContext('2d');
        
        // Hero-specific colors
        const colors = {
            korvax: { primary: '#ff4444', secondary: '#ff8800', accent: '#ffcc00' },
            lyria: { primary: '#8844ff', secondary: '#44aaff', accent: '#ffffff' },
            auren: { primary: '#ffdd44', secondary: '#ffffff', accent: '#ffaa00' },
            shade: { primary: '#333333', secondary: '#666666', accent: '#00ffaa' }
        };
        
        const c = colors[heroId] || colors.korvax;
        
        // Body
        ctx.fillStyle = c.primary;
        ctx.fillRect(44, 60, 40, 80);
        
        // Head
        ctx.fillStyle = c.secondary;
        ctx.beginPath();
        ctx.arc(64, 40, 25, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes (glowing)
        ctx.fillStyle = c.accent;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 10;
        ctx.fillRect(52, 35, 8, 4);
        ctx.fillRect(68, 35, 8, 4);
        ctx.shadowBlur = 0;
        
        // Arms
        ctx.fillStyle = c.primary;
        ctx.fillRect(24, 70, 20, 50);
        ctx.fillRect(84, 70, 20, 50);
        
        // Legs
        ctx.fillRect(44, 140, 16, 50);
        ctx.fillRect(68, 140, 16, 50);
        
        // Hero-specific details
        if (heroId === 'korvax') {
            // Reactor core
            ctx.fillStyle = c.accent;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(64, 100, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (heroId === 'lyria') {
            // Temporal halo
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(64, 40, 35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (heroId === 'auren') {
            // Radiant wings (simplified)
            ctx.fillStyle = 'rgba(255, 221, 68, 0.3)';
            ctx.beginPath();
            ctx.moveTo(64, 60);
            ctx.lineTo(10, 40);
            ctx.lineTo(30, 100);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(64, 60);
            ctx.lineTo(118, 40);
            ctx.lineTo(98, 100);
            ctx.closePath();
            ctx.fill();
        } else if (heroId === 'shade') {
            // Mask
            ctx.fillStyle = '#000000';
            ctx.fillRect(48, 28, 32, 20);
            ctx.fillStyle = c.accent;
            ctx.fillRect(52, 32, 8, 3);
            ctx.fillRect(68, 32, 8, 3);
        }
        
        return {
            canvas,
            type: 'placeholder',
            heroId
        };
    }

    /**
     * Generate enemy placeholder sprite
     */
    generateEnemyPlaceholder(enemyId, info = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        
        // Enemy type colors
        const typeColors = {
            rustborn: '#8b4513',
            scrap: '#666666',
            sand: '#d4a574',
            rust: '#a0522d',
            feral: '#8b0000',
            choir: '#6b5b95',
            time: '#4a90d9',
            echo: '#9b59b6',
            marsh: '#2e8b57',
            boss: '#ff0000'
        };
        
        // Determine color from enemy ID
        let color = '#666666';
        for (const [key, value] of Object.entries(typeColors)) {
            if (enemyId.includes(key)) {
                color = value;
                break;
            }
        }
        
        // Check if boss
        const isBoss = enemyId.includes('king') || enemyId.includes('titan') || 
                       enemyId.includes('witness') || enemyId.includes('xalkorath');
        
        if (isBoss) {
            canvas.width = 160;
            canvas.height = 160;
        }
        
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const size = isBoss ? 60 : 35;
        
        // Main body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Evil eyes
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx - size * 0.3, cy - size * 0.2, size * 0.15, 0, Math.PI * 2);
        ctx.arc(cx + size * 0.3, cy - size * 0.2, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Jagged details
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x1 = cx + Math.cos(angle) * size;
            const y1 = cy + Math.sin(angle) * size;
            const x2 = cx + Math.cos(angle) * (size + 10 + Math.random() * 10);
            const y2 = cy + Math.sin(angle) * (size + 10 + Math.random() * 10);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        return {
            canvas,
            type: 'placeholder',
            enemyId
        };
    }

    /**
     * Generate card art placeholder
     */
    generateCardPlaceholder(cardId, info = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Card type colors
        const typeColors = {
            attack: '#ff4444',
            skill: '#4488ff',
            power: '#ffaa00',
            corrupted: '#8800ff'
        };
        
        const cardType = info.type || 'attack';
        const color = typeColors[cardType] || typeColors.attack;
        
        // Background
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 40);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        // Icon based on type
        ctx.fillStyle = '#ffffff';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const icons = {
            attack: '⚔',
            skill: '🛡',
            power: '⚡',
            corrupted: '👁'
        };
        
        ctx.fillText(icons[cardType] || '?', 32, 32);
        
        return {
            canvas,
            type: 'placeholder',
            cardId
        };
    }

    /**
     * Generate background placeholder
     */
    generateBackgroundPlaceholder(bgId, info = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // Region-specific palettes
        const palettes = {
            ironspine: ['#1a0a00', '#3d1a0a', '#5c2a1a', '#8b4513'],
            eclipse_marsh: ['#0a1a2a', '#1a3a4a', '#2a4a5a', '#4a6a7a'],
            radiant_highlands: ['#2a2a3a', '#4a4a5a', '#6a6a7a', '#ffd700'],
            obsidian_thicket: ['#0a0a1a', '#1a1a2a', '#2a2a3a', '#00ff88'],
            cradle_abyss: ['#000000', '#0a0010', '#1a0020', '#ff00ff'],
            default: ['#0a0a1a', '#1a1a2a', '#2a2a3a', '#3a3a4a']
        };
        
        const palette = palettes[bgId] || palettes.default;
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, palette[0]);
        gradient.addColorStop(0.5, palette[1]);
        gradient.addColorStop(1, palette[2]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add stars/particles
        ctx.fillStyle = palette[3];
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height * 0.6;
            const size = Math.random() * 2 + 1;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Ground/horizon line
        ctx.fillStyle = palette[1];
        ctx.fillRect(0, canvas.height * 0.75, canvas.width, canvas.height * 0.25);
        
        return {
            canvas,
            type: 'placeholder',
            bgId,
            layers: info.layers || ['base']
        };
    }

    /**
     * Generate effect placeholder
     */
    generateEffectPlaceholder(effectId, info = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Simple radial burst effect
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#ffaa00');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        return {
            canvas,
            type: 'placeholder',
            effectId,
            frames: info.frames || 1
        };
    }

    /**
     * Generate generic placeholder
     */
    generateGenericPlaceholder(id) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 60, 60);
        ctx.moveTo(2, 2);
        ctx.lineTo(62, 62);
        ctx.moveTo(62, 2);
        ctx.lineTo(2, 62);
        ctx.stroke();
        
        return { canvas, type: 'placeholder', id };
    }

    // ==========================================
    // PROCEDURAL GENERATORS
    // For effects that are better generated than drawn
    // ==========================================

    generateStarfield() {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // Deep space background
        const gradient = ctx.createRadialGradient(960, 540, 0, 960, 540, 1000);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(1, '#000005');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Stars
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 2;
            const brightness = Math.random();
            
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Nebula hints
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#440066';
        ctx.beginPath();
        ctx.arc(300, 200, 200, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#004466';
        ctx.beginPath();
        ctx.arc(1600, 800, 250, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        return { canvas, type: 'generated', id: 'starfield' };
    }

    generateCorruptionParticle() {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        gradient.addColorStop(0, '#ff00ff');
        gradient.addColorStop(0.5, '#8800ff');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 16, 16);
        
        return { canvas, type: 'generated', id: 'corruption_particle' };
    }

    generateVoidTendril() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.strokeStyle = '#660066';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(16, 128);
        for (let y = 128; y > 0; y -= 8) {
            const x = 16 + Math.sin(y * 0.05) * 10;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        return { canvas, type: 'generated', id: 'void_tendril' };
    }

    generateOverheatSteam() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.4)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        
        return { canvas, type: 'generated', id: 'overheat_steam' };
    }

    generateTemporalDistortion() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 5; i++) {
            const radius = 10 + i * 8;
            ctx.beginPath();
            ctx.arc(32, 32, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        return { canvas, type: 'generated', id: 'temporal_distortion' };
    }

    // ==========================================
    // PRELOADING
    // ==========================================

    /**
     * Preload essential assets
     * @param {Function} progressCallback - Called with progress (0-1)
     */
    async preloadEssentials(progressCallback = () => {}) {
        const essentials = [
            { category: 'heroes', id: 'korvax', variant: 'idle' },
            { category: 'backgrounds', id: 'title' },
            { category: 'backgrounds', id: 'combat_default' },
            { category: 'ui', id: 'logo' }
        ];
        
        let loaded = 0;
        for (const asset of essentials) {
            await this.getAsset(asset.category, asset.id, asset.variant || 'default');
            loaded++;
            progressCallback(loaded / essentials.length);
        }
    }

    /**
     * Preload assets for a specific region
     */
    async preloadRegion(regionId, progressCallback = () => {}) {
        const enemies = this.manifests.get('enemies');
        const regionEnemies = Object.keys(enemies).filter(id => {
            // Filter enemies by region (you'd have region mapping data)
            return true; // Load all for now
        });
        
        let loaded = 0;
        const total = regionEnemies.length + 1; // +1 for background
        
        // Load background
        await this.getAsset('backgrounds', regionId);
        loaded++;
        progressCallback(loaded / total);
        
        // Load enemies
        for (const enemyId of regionEnemies) {
            await this.getAsset('enemies', enemyId);
            loaded++;
            progressCallback(loaded / total);
        }
    }

    /**
     * Clear cache (for memory management)
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cachedAssets: this.cache.size,
            loadingAssets: this.loading.size
        };
    }
}

// Singleton instance
const assetManager = new AssetManager();

export { AssetManager, assetManager };
export default assetManager;
