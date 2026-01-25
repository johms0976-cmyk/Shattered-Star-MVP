/**
 * HeroSelectScreen - Hero selection screen handler
 * Shattered Star
 * 
 * FIXED: Ensures hero cards are visible with inline styles
 * FIXED: Background properly applied
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
        // CRITICAL FIX: Hide this screen when transitioning AWAY from it
        if (from === 'hero-select-screen' && to !== 'hero-select-screen') {
            hideHeroSelectScreen();
        }
    });
    
    // Backup: also listen for screen:changed
    game.eventBus.on('screen:changed', ({ to, from }) => {
        console.log(`[HeroSelect] screen:changed event: ${from} -> ${to}`);
        if (to === 'hero-select-screen') {
            // Small delay to ensure DOM is ready
            setTimeout(() => initializeHeroSelectScreen(game), 50);
        }
        // CRITICAL FIX: Hide this screen when changed away from it
        if (from === 'hero-select-screen' && to !== 'hero-select-screen') {
            hideHeroSelectScreen();
        }
    });
    
    // Backup: also listen for screen:show
    game.eventBus.on('screen:show', (screenId) => {
        console.log(`[HeroSelect] screen:show event: ${screenId}`);
        if (screenId === 'hero-select-screen') {
            setTimeout(() => initializeHeroSelectScreen(game), 50);
        }
        // CRITICAL FIX: Hide this screen when another screen is shown
        if (screenId !== 'hero-select-screen') {
            hideHeroSelectScreen();
        }
    });
}

/**
 * CRITICAL FIX: Aggressively hide the hero select screen
 * This counteracts the aggressive show styles we applied
 */
function hideHeroSelectScreen() {
    console.log('[HeroSelect] Hiding hero select screen');
    const screen = document.getElementById('hero-select-screen');
    if (screen) {
        screen.classList.remove('active');
        screen.style.cssText = `
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -1 !important;
        `;
    }
}

/**
 * Initialize the hero select screen (background + heroes)
 */
function initializeHeroSelectScreen(game) {
    console.log('[HeroSelect] Initializing hero select screen');
    
    // CRITICAL FIX: Hide ALL other screens first
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(screen => {
        if (screen.id !== 'hero-select-screen') {
            screen.classList.remove('active');
            screen.style.display = 'none';
            screen.style.visibility = 'hidden';
            screen.style.opacity = '0';
        }
    });
    console.log('[HeroSelect] Hidden all other screens');
    
    // CRITICAL FIX: Force the entire screen structure to be visible
    forceEntireScreenVisibility();
    
    // Set background
    setScreenBackground(game, 'hero-select-screen', 'heroselect1');
    
    // Render hero cards with a slight delay to ensure DOM is ready
    setTimeout(() => {
        renderHeroCards(game);
        forceHeroCardsVisibility();
    }, 100);
}

/**
 * CRITICAL FIX: Force the entire hero select screen to be visible
 * This addresses cases where CSS is hiding elements
 * ULTRA-AGGRESSIVE: Sets every possible style inline
 */
function forceEntireScreenVisibility() {
    console.log('[HeroSelect] FORCING entire screen visibility...');
    
    // Force screen visibility with EVERYTHING
    const screen = document.getElementById('hero-select-screen');
    if (screen) {
        // Add active class
        screen.classList.add('active');
        screen.classList.remove('fade-out');
        
        // Force all critical styles
        screen.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 100 !important;
            background-color: #0a0a1a !important;
            background-size: cover !important;
            background-position: center !important;
        `;
        console.log('[HeroSelect] Screen styles applied');
    } else {
        console.error('[HeroSelect] Screen element NOT FOUND!');
    }
    
    // Force overlay visibility with EVERYTHING
    const overlay = document.querySelector('#hero-select-screen .hero-select-overlay');
    if (overlay) {
        overlay.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            padding: 20px !important;
            background: linear-gradient(to bottom, rgba(10, 10, 26, 0.5), rgba(10, 10, 26, 0.7)) !important;
            z-index: 1 !important;
            box-sizing: border-box !important;
        `;
        console.log('[HeroSelect] Overlay styles applied');
    } else {
        console.error('[HeroSelect] Overlay NOT FOUND!');
    }
    
    // Force header visibility
    const header = document.querySelector('#hero-select-screen .screen-header');
    if (header) {
        header.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            visibility: visible !important;
            opacity: 1 !important;
            margin-bottom: 20px !important;
            padding-bottom: 15px !important;
            border-bottom: 1px solid #404060 !important;
            flex-shrink: 0 !important;
        `;
        console.log('[HeroSelect] Header styles applied');
    }
    
    // Force h2 visibility
    const h2 = document.querySelector('#hero-select-screen .screen-header h2');
    if (h2) {
        h2.style.cssText = `
            color: #00f5ff !important;
            visibility: visible !important;
            opacity: 1 !important;
            font-size: 1.25rem !important;
            letter-spacing: 0.15em !important;
            margin: 0 !important;
        `;
    }
    
    // Force back button visibility
    const backBtn = document.getElementById('btn-back-title');
    if (backBtn) {
        backBtn.style.cssText = `
            display: inline-block !important;
            visibility: visible !important;
            opacity: 1 !important;
            padding: 8px 16px !important;
            background: transparent !important;
            border: 1px solid #888 !important;
            color: #ccc !important;
            cursor: pointer !important;
        `;
    }
    
    // Force container visibility
    const container = document.querySelector('#hero-select-screen .hero-select-container');
    if (container) {
        container.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            flex: 1 !important;
            visibility: visible !important;
            opacity: 1 !important;
            gap: 20px !important;
            overflow-y: auto !important;
            min-height: 0 !important;
        `;
        console.log('[HeroSelect] Container styles applied');
    }
    
    // Force hero-cards container visibility
    const heroCards = document.getElementById('hero-cards');
    if (heroCards) {
        heroCards.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            visibility: visible !important;
            opacity: 1 !important;
            gap: 12px !important;
            min-height: 200px !important;
        `;
        console.log('[HeroSelect] Hero cards container styles applied');
    }
    
    // Force start button visibility
    const startBtn = document.getElementById('btn-start-run');
    if (startBtn) {
        startBtn.style.cssText = `
            display: block !important;
            visibility: visible !important;
            opacity: 0.5 !important;
            margin-top: 20px !important;
            padding: 15px 30px !important;
            background: rgba(0, 0, 0, 0.6) !important;
            border: 1px solid #00f5ff !important;
            color: #00f5ff !important;
            font-size: 1rem !important;
            cursor: pointer !important;
            flex-shrink: 0 !important;
        `;
    }
    
    console.log('[HeroSelect] Forced entire screen visibility COMPLETE');
}

/**
 * Set background image for a screen element with multiple fallback attempts
 * FIX: Uses inline styles to ensure visibility
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
 * FIX: Apply styles with proper CSS reset
 */
function tryBackgroundPaths(element, paths, index) {
    if (index >= paths.length) {
        console.warn('[HeroSelect] All background paths failed, using gradient fallback');
        applyFallbackBackground(element);
        return;
    }
    
    const path = paths[index];
    const img = new Image();
    
    img.onload = () => {
        console.log(`[HeroSelect] Background loaded successfully: ${path}`);
        applyBackground(element, path);
    };
    
    img.onerror = () => {
        console.warn(`[HeroSelect] Background failed to load: ${path}`);
        tryBackgroundPaths(element, paths, index + 1);
    };
    
    img.src = path;
}

/**
 * FIX: Apply background with proper CSS
 */
function applyBackground(element, path) {
    element.style.background = '';
    element.style.backgroundColor = '';
    element.style.backgroundImage = `url('${path}')`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.style.backgroundRepeat = 'no-repeat';
    element.style.backgroundColor = '#0a0a1a';
}

/**
 * FIX: Apply fallback gradient
 */
function applyFallbackBackground(element) {
    element.style.backgroundImage = '';
    element.style.background = 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)';
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
 * FIX: Force hero cards container and cards to be visible
 * ULTRA-AGGRESSIVE: Uses cssText for maximum override
 */
function forceHeroCardsVisibility() {
    const container = document.getElementById('hero-cards');
    if (container) {
        // Force container visibility with cssText
        container.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            visibility: visible !important;
            opacity: 1 !important;
            min-height: 200px !important;
            width: 100% !important;
        `;
        
        // Force each card visibility with cssText
        const cards = container.querySelectorAll('.hero-card');
        cards.forEach(card => {
            const isLocked = card.classList.contains('locked');
            card.style.cssText = `
                display: flex !important;
                visibility: visible !important;
                opacity: ${isLocked ? '0.4' : '1'} !important;
                min-height: 90px !important;
                align-items: center !important;
                gap: 16px !important;
                padding: 16px !important;
                background: rgba(37, 37, 56, 0.95) !important;
                border: 1px solid ${isLocked ? '#404060' : '#606080'} !important;
                border-radius: 4px !important;
                cursor: ${isLocked ? 'not-allowed' : 'pointer'} !important;
                width: 100% !important;
                box-sizing: border-box !important;
            `;
        });
        
        console.log(`[HeroSelect] Forced visibility on ${cards.length} hero cards`);
    }
}

/**
 * Render hero cards
 * FIX: Now applies inline styles to ensure visibility
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

    // FIX: Add inline styles to each card for guaranteed visibility
    container.innerHTML = heroes.map(hero => `
        <div class="hero-card ${hero.locked ? 'locked' : ''}"
             data-hero-id="${hero.id}"
             style="display: flex !important; 
                    visibility: visible !important; 
                    opacity: ${hero.locked ? '0.4' : '1'} !important;
                    min-height: 90px;
                    cursor: ${hero.locked ? 'not-allowed' : 'pointer'};
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: rgba(37, 37, 56, 0.9);
                    border: 1px solid #606080;
                    border-radius: 4px;">
             
            <div class="hero-card-portrait" style="width: 80px; height: 80px; min-width: 80px; background: #0a0a1a; border-radius: 2px; display: flex; align-items: center; justify-content: center;">
                <div class="hero-silhouette ${hero.id}" style="width: 100%; height: 100%; background-color: ${getHeroColor(hero.id)};"></div>
            </div>

            <div class="hero-card-info" style="flex: 1; min-width: 0;">
                <h3 class="hero-card-name" style="font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; letter-spacing: 0.1em; color: #e8e8f0; margin: 0;">${hero.name}</h3>
                <p class="hero-card-title" style="font-size: 0.875rem; color: #a0a0b8; margin: 0;">${hero.title}</p>
            </div>

            ${hero.locked ? `
                <div class="locked-overlay" style="margin-left: auto; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;">
                    <span class="lock-icon" style="font-size: 1.5rem;">🔒</span>
                    <span class="lock-text" style="max-width: 100px; font-size: 0.75rem; color: #606080;">Locked</span>
                </div>
            ` : ''}
        </div>
    `).join('');

    // FIX: Force container to be visible
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    container.style.visibility = 'visible';
    container.style.opacity = '1';
    
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
 * Get hero color for silhouette
 */
function getHeroColor(heroId) {
    const colors = {
        'korvax': '#ff6b35',
        'lyria': '#bf00ff',
        'auren': '#ffd700',
        'shade': '#00ff9f'
    };
    return colors[heroId] || '#00f5ff';
}

/**
 * Select hero - FIX: Sets BOTH variables for cross-compatibility
 */
function selectHero(game, heroId) {
    game.audioManager.playSFX('ui_click');

    document.querySelectorAll('.hero-card').forEach(card => {
        card.classList.remove('selected');
        // Reset inline styles for non-selected cards
        if (!card.classList.contains('locked')) {
            card.style.borderColor = '#606080';
            card.style.boxShadow = 'none';
            card.style.background = 'rgba(37, 37, 56, 0.9)';
        }
    });

    const selectedCard = document.querySelector(
        `.hero-card[data-hero-id="${heroId}"]`
    );

    if (selectedCard) {
        selectedCard.classList.add('selected');
        // Apply selected styles inline
        selectedCard.style.borderColor = '#00f5ff';
        selectedCard.style.boxShadow = '0 0 30px rgba(0, 245, 255, 0.3)';
        selectedCard.style.background = 'rgba(0, 245, 255, 0.1)';
    }

    // FIX: Set BOTH the module variable AND the game instance variable
    selectedHeroId = heroId;
    game.selectedHeroId = heroId;
    
    console.log(`[HeroSelect] Selected hero: ${heroId} (both variables set)`);

    const btnStartRun = document.getElementById('btn-start-run');
    if (btnStartRun) {
        btnStartRun.disabled = false;
        // FIX: Update visual appearance when enabled
        btnStartRun.style.opacity = '1';
        btnStartRun.style.cursor = 'pointer';
        btnStartRun.style.background = 'rgba(0, 245, 255, 0.1)';
        btnStartRun.style.borderColor = '#00f5ff';
        btnStartRun.style.color = '#00f5ff';
        btnStartRun.style.boxShadow = '0 0 20px rgba(0, 245, 255, 0.3)';
    }

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
