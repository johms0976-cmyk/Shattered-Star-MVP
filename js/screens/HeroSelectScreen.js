/**
 * HeroSelectScreen - Hero selection screen handler
 * Shattered Star
 * 
 * FIXED: Ensures hero selection works regardless of initialization path
 */

let selectedHeroId = null;

// MVP Fallback heroes if DataLoader fails
const MVP_HEROES = [
    {
        id: 'korvax',
        name: 'Korvax Rend',
        title: 'The Broken Titan',
        description: 'A former shock trooper engineered for frontline devastation. His Overheat systems malfunction on Vharos, forcing him to battle both enemies and himself.',
        hp: 80,
        energy: 3,
        locked: false,
        archetypes: [
            { name: 'Rage', description: 'Self-damage fuels power' },
            { name: 'Overheat', description: 'Tech-berserker reactor management' },
            { name: 'Titan', description: 'Defense and counters' }
        ],
        startingDeck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'thermal_vent', 'rage_spike', 'system_check']
    },
    {
        id: 'lyria',
        name: 'Lyria Voss',
        title: 'The Fractured Mind',
        description: 'A temporal mage experiencing nonlinear time. The Marsh amplifies her abilities and her instability.',
        hp: 70,
        energy: 3,
        locked: true,
        archetypes: [
            { name: 'Astral', description: 'Scaling cosmic damage' },
            { name: 'Temporal', description: 'Draw and cost manipulation' },
            { name: 'Void', description: 'High-risk corruption magic' }
        ],
        startingDeck: []
    },
    {
        id: 'auren',
        name: 'Auren Solari',
        title: 'The Fallen Light',
        description: 'A former holy knight seeking redemption in the Radiant Highlands. His faith shattered years ago.',
        hp: 85,
        energy: 3,
        locked: true,
        archetypes: [
            { name: 'Radiant', description: 'Holy DoT that builds and burns' },
            { name: 'Aegis', description: 'Defense and counters' },
            { name: 'Judgment', description: 'Punish debuffed enemies' }
        ],
        startingDeck: []
    },
    {
        id: 'shade',
        name: 'Shade',
        title: 'The Faceless',
        description: 'A covert operative with no memory of their true identity. The Thicket awakens forgotten echoes.',
        hp: 65,
        energy: 3,
        locked: true,
        archetypes: [
            { name: 'Stealth', description: 'Vanish and burst' },
            { name: 'Bleed', description: 'Stacking DoT pressure' },
            { name: 'Identity Theft', description: 'Copy enemy abilities' }
        ],
        startingDeck: []
    }
];

// Store game reference for cross-function access
let gameRef = null;

export function setupHeroSelect(game) {
    console.log('[HeroSelect] Setting up hero select screen');
    gameRef = game;
    
    const btnBack = document.getElementById('btn-back-title');
    const btnStartRun = document.getElementById('btn-start-run');

    // -----------------------------
    // Back to start screen
    // -----------------------------
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            game.screenManager.transitionTo('start-screen');
            selectedHeroId = null;
            game.selectedHeroId = null;
        });
    }

    // -----------------------------
    // Start run - FIX: Check BOTH possible hero ID locations
    // -----------------------------
    if (btnStartRun) {
        btnStartRun.addEventListener('click', () => {
            // Check both the module variable AND the game instance variable
            const heroId = selectedHeroId || game.selectedHeroId;
            
            if (!heroId) {
                console.warn('[HeroSelect] No hero selected (checked both paths)');
                return;
            }

            console.log(`[HeroSelect] Starting run with hero: ${heroId}`);
            game.audioManager.playSFX('ui_confirm');
            game.startNewRun(heroId);
        });
    }

    // -----------------------------
    // Screen transition handlers
    // Try multiple event types for compatibility
    // -----------------------------
    game.eventBus.on('screen:transition:start', ({ to, from }) => {
        console.log(`[HeroSelect] transition:start event: ${from} -> ${to}`);
        if (to === 'hero-select-screen') {
            initializeHeroSelectScreen(game);
        }
    });
    
    // Backup: also listen for screen:changed
    game.eventBus.on('screen:changed', ({ to, from }) => {
        console.log(`[HeroSelect] screen:changed event: ${from} -> ${to}`);
        if (to === 'hero-select-screen') {
            // Small delay to ensure DOM is ready
            setTimeout(() => initializeHeroSelectScreen(game), 50);
        }
    });
    
    // Backup: also listen for screen:show
    game.eventBus.on('screen:show', (screenId) => {
        console.log(`[HeroSelect] screen:show event: ${screenId}`);
        if (screenId === 'hero-select-screen') {
            setTimeout(() => initializeHeroSelectScreen(game), 50);
        }
    });
}

/**
 * Initialize the hero select screen (background + heroes)
 */
function initializeHeroSelectScreen(game) {
    console.log('[HeroSelect] Initializing hero select screen');
    
    // Set background
    setScreenBackground(game, 'hero-select-screen', 'heroselect1');
    
    // Render hero cards
    renderHeroCards(game);
}

/**
 * Set background image for a screen element with multiple fallback attempts
 */
function setScreenBackground(game, screenId, imageName) {
    const screenEl = document.getElementById(screenId);
    if (!screenEl) {
        console.error(`[HeroSelect] Screen element not found: ${screenId}`);
        return;
    }
    
    // Get fallback paths
    const paths = game.getBackgroundFallbacks ? 
        game.getBackgroundFallbacks(imageName) : 
        [game.getBackgroundPath(imageName)];
    
    console.log(`[HeroSelect] Trying background paths for ${screenId}:`, paths);
    
    // Try each path until one works
    tryBackgroundPaths(screenEl, paths, 0);
}

/**
 * Recursively try background paths until one loads
 */
function tryBackgroundPaths(element, paths, index) {
    if (index >= paths.length) {
        console.warn('[HeroSelect] All background paths failed, using gradient fallback');
        element.style.background = 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)';
        return;
    }
    
    const path = paths[index];
    const img = new Image();
    
    img.onload = () => {
        console.log(`[HeroSelect] Background loaded successfully: ${path}`);
        element.style.backgroundImage = `url('${path}')`;
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
        element.style.backgroundRepeat = 'no-repeat';
    };
    
    img.onerror = () => {
        console.warn(`[HeroSelect] Background failed to load: ${path}`);
        tryBackgroundPaths(element, paths, index + 1);
    };
    
    img.src = path;
}

/**
 * Normalize hero data to handle different formats
 */
function normalizeHero(hero) {
    if (!hero) return null;
    
    // Handle locked vs unlocked property
    let isLocked = hero.locked;
    if (isLocked === undefined) {
        // Check for 'unlocked' property (inverse)
        isLocked = hero.unlocked === false;
    }
    
    // Normalize archetypes - convert strings to objects if needed
    let archetypes = hero.archetypes || [];
    if (archetypes.length > 0 && typeof archetypes[0] === 'string') {
        const descriptions = {
            'rage': 'Self-damage fuels power',
            'overheat': 'Tech-berserker reactor management',
            'titan': 'Defense and counters',
            'astral': 'Scaling cosmic damage',
            'temporal': 'Draw and cost manipulation',
            'void': 'High-risk corruption magic',
            'radiant': 'Holy DoT that builds and burns',
            'aegis': 'Persistent shields',
            'judgment': 'Punish debuffed enemies',
            'stealth': 'Vanish and burst',
            'bleed': 'Stacking DoT pressure',
            'identity theft': 'Copy enemy abilities',
            'identity_theft': 'Copy enemy abilities'
        };
        
        archetypes = archetypes.map(a => ({
            name: a.charAt(0).toUpperCase() + a.slice(1).replace(/_/g, ' '),
            description: descriptions[a.toLowerCase()] || 'Unique playstyle'
        }));
    }
    
    return {
        ...hero,
        locked: isLocked,
        archetypes: archetypes,
        hp: hero.hp || hero.maxHp || 80,
        energy: hero.energy || 3
    };
}

/**
 * Get heroes from dataLoader or use fallback
 */
function getHeroes(game) {
    let heroes = [];
    
    try {
        const loadedHeroes = game.dataLoader?.getAllHeroes?.();
        if (loadedHeroes && loadedHeroes.length > 0) {
            console.log(`[HeroSelect] Got ${loadedHeroes.length} heroes from dataLoader`);
            heroes = loadedHeroes.map(normalizeHero).filter(h => h !== null);
        }
    } catch (e) {
        console.warn('[HeroSelect] DataLoader error:', e);
    }
    
    if (heroes.length === 0) {
        console.log('[HeroSelect] Using fallback MVP heroes');
        heroes = MVP_HEROES;
    }
    
    return heroes;
}

/**
 * Render hero cards
 */
function renderHeroCards(game) {
    const container = document.getElementById('hero-cards');
    const btnStartRun = document.getElementById('btn-start-run');

    if (!container) {
        console.error('[HeroSelect] Hero cards container #hero-cards not found!');
        return;
    }

    const heroes = getHeroes(game);
    
    if (!heroes || heroes.length === 0) {
        console.error('[HeroSelect] No heroes available even after fallback');
        container.innerHTML = '<p class="error-message" style="color: #ff6b6b; text-align: center; padding: 40px;">No heroes available. Check console for errors.</p>';
        return;
    }

    console.log(`[HeroSelect] Rendering ${heroes.length} heroes:`, heroes.map(h => `${h.id}(${h.locked ? 'locked' : 'unlocked'})`));

    container.innerHTML = heroes.map(hero => `
        <div class="hero-card ${hero.locked ? 'locked' : ''}"
             data-hero-id="${hero.id}"
             style="cursor: ${hero.locked ? 'not-allowed' : 'pointer'}">
             
            <div class="hero-card-portrait">
                <div class="hero-silhouette ${hero.id}"></div>
            </div>

            <div class="hero-card-info">
                <h3 class="hero-card-name">${hero.name}</h3>
                <p class="hero-card-title">${hero.title}</p>
            </div>

            ${hero.locked ? `
                <div class="locked-overlay">
                    <span class="lock-icon">🔒</span>
                    <span class="lock-text">Complete previous hero to unlock</span>
                </div>
            ` : ''}
        </div>
    `).join('');

    // FIX: Force container to be visible
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    
    // Attach interactions ONLY to unlocked heroes
    container.querySelectorAll('.hero-card:not(.locked)').forEach(card => {
        const heroId = card.dataset.heroId;

        card.addEventListener('click', () => {
            selectHero(game, heroId);
        });

        card.addEventListener('mouseenter', () => {
            if (!selectedHeroId && !game.selectedHeroId) {
                displayHeroDetails(game, heroId);
            }
        });
    });

    // Reset selection state on BOTH variables
    selectedHeroId = null;
    game.selectedHeroId = null;
    if (btnStartRun) btnStartRun.disabled = true;
    
    // Auto-display first unlocked hero details
    const firstUnlocked = heroes.find(h => !h.locked);
    if (firstUnlocked) {
        displayHeroDetails(game, firstUnlocked.id);
    } else {
        clearHeroDetails();
    }
    
    console.log('[HeroSelect] Hero cards rendered successfully');
}

/**
 * Select hero - FIX: Sets BOTH variables for cross-compatibility
 */
function selectHero(game, heroId) {
    game.audioManager.playSFX('ui_click');

    document.querySelectorAll('.hero-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(
        `.hero-card[data-hero-id="${heroId}"]`
    );

    if (selectedCard) {
        selectedCard.classList.add('selected');
    }

    // FIX: Set BOTH the module variable AND the game instance variable
    selectedHeroId = heroId;
    game.selectedHeroId = heroId;
    
    console.log(`[HeroSelect] Selected hero: ${heroId} (both variables set)`);

    const btnStartRun = document.getElementById('btn-start-run');
    if (btnStartRun) btnStartRun.disabled = false;

    displayHeroDetails(game, heroId);
}

/**
 * Get hero data from dataLoader or fallback
 */
function getHeroData(game, heroId) {
    let hero = null;
    
    try {
        hero = game.dataLoader?.getHero?.(heroId);
    } catch (e) {
        console.warn('[HeroSelect] DataLoader getHero error:', e);
    }
    
    if (!hero) {
        hero = MVP_HEROES.find(h => h.id === heroId);
    }
    
    return hero ? normalizeHero(hero) : null;
}

/**
 * Display hero details panel
 */
function displayHeroDetails(game, heroId) {
    const hero = getHeroData(game, heroId);
    if (!hero) {
        console.warn(`[HeroSelect] Hero not found: ${heroId}`);
        return;
    }

    // Portrait
    const portrait = document.getElementById('hero-portrait');
    if (portrait) {
        portrait.className = `hero-portrait ${heroId}`;
        portrait.innerHTML = `<div class="hero-portrait-inner"></div>`;
    }

    // Text
    setText('hero-name', hero.name);
    setText('hero-title', hero.title);
    setText('hero-desc', hero.description);

    // Stats
    const stats = document.getElementById('hero-stats');
    if (stats) {
        stats.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">HP</span>
                <span class="stat-value">${hero.hp}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Energy</span>
                <span class="stat-value">${hero.energy}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Starting Cards</span>
                <span class="stat-value">${hero.startingDeck?.length || 10}</span>
            </div>
        `;
    }

    // Archetypes
    const archetypesEl = document.getElementById('hero-archetypes');
    if (archetypesEl && hero.archetypes?.length) {
        archetypesEl.innerHTML = `
            <h4>Archetypes</h4>
            <div class="archetype-list">
                ${hero.archetypes.map(a => `
                    <div class="archetype">
                        <span class="archetype-name">${a.name || a}</span>
                        <span class="archetype-desc">${a.description || ''}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

/**
 * Clear hero details panel
 */
function clearHeroDetails() {
    setText('hero-name', 'Select a Hero');
    setText('hero-title', '');
    setText(
        'hero-desc',
        'Choose your operative for this descent into the void.'
    );

    const stats = document.getElementById('hero-stats');
    if (stats) stats.innerHTML = '';

    const archetypes = document.getElementById('hero-archetypes');
    if (archetypes) archetypes.innerHTML = '';

    const portrait = document.getElementById('hero-portrait');
    if (portrait) {
        portrait.className = 'hero-portrait';
        portrait.innerHTML = '';
    }
}

/**
 * Utility
 */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/**
 * Export for external access (used by main.js direct initialization)
 */
export function getSelectedHeroId() {
    return selectedHeroId;
}

export function setSelectedHeroId(heroId) {
    selectedHeroId = heroId;
}
