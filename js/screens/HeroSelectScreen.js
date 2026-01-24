/**
 * HeroSelectScreen - Hero selection screen handler
 * Shattered Star
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

export function setupHeroSelect(game) {
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
        });
    }

    // -----------------------------
    // Start run
    // -----------------------------
    if (btnStartRun) {
        btnStartRun.addEventListener('click', () => {
            if (!selectedHeroId) {
                console.warn('[HeroSelect] No hero selected');
                return;
            }

            game.audioManager.playSFX('ui_confirm');
            game.startNewRun(selectedHeroId);
        });
    }

    // -----------------------------
    // Screen transition handlers - use transition:start for immediate setup
    // -----------------------------
    game.eventBus.on('screen:transition:start', ({ to, from }) => {
        if (to === 'hero-select-screen') {
            // Set background immediately
            setScreenBackground(game, 'hero-select-screen', 'heroselect1');
            
            // Render hero cards immediately
            renderHeroCards(game);
        }
    });
}

/**
 * Set background image for a screen element
 */
function setScreenBackground(game, screenId, imageName) {
    const screenEl = document.getElementById(screenId);
    if (!screenEl) return;
    
    const bgPath = game.getBackgroundPath(imageName);
    console.log(`[HeroSelect] Setting ${screenId} background: ${bgPath}`);
    
    screenEl.style.backgroundImage = `url('${bgPath}')`;
    screenEl.style.backgroundSize = 'cover';
    screenEl.style.backgroundPosition = 'center';
    screenEl.style.backgroundRepeat = 'no-repeat';
    
    // Fallback: if image fails to load, try alternate paths
    const img = new Image();
    img.onerror = () => {
        console.warn(`[HeroSelect] Background not found: ${bgPath}, trying fallback...`);
        const fallbackPath = `assets/images/backgrounds/${imageName}.png`;
        screenEl.style.backgroundImage = `url('${fallbackPath}')`;
    };
    img.src = bgPath;
}

/**
 * Get heroes from dataLoader or use fallback
 */
function getHeroes(game) {
    let heroes = null;
    
    try {
        heroes = game.dataLoader?.getAllHeroes?.();
    } catch (e) {
        console.warn('[HeroSelect] DataLoader error:', e);
    }
    
    if (!heroes || heroes.length === 0) {
        console.log('[HeroSelect] Using fallback MVP heroes');
        return MVP_HEROES;
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
        console.error('[HeroSelect] Hero cards container not found');
        return;
    }

    const heroes = getHeroes(game);
    
    if (!heroes || heroes.length === 0) {
        console.error('[HeroSelect] No heroes available even after fallback');
        container.innerHTML = '<p class="error-message">No heroes available</p>';
        return;
    }

    console.log(`[HeroSelect] Rendering ${heroes.length} heroes`);

    container.innerHTML = heroes.map(hero => `
        <div class="hero-card ${hero.locked ? 'locked' : ''}"
             data-hero-id="${hero.id}">
             
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

    // Attach interactions ONLY to unlocked heroes
    container.querySelectorAll('.hero-card:not(.locked)').forEach(card => {
        const heroId = card.dataset.heroId;

        card.addEventListener('click', () => {
            selectHero(game, heroId);
        });

        card.addEventListener('mouseenter', () => {
            if (!selectedHeroId) {
                displayHeroDetails(game, heroId);
            }
        });
    });

    // Reset selection state
    selectedHeroId = null;
    if (btnStartRun) btnStartRun.disabled = true;
    clearHeroDetails();
    
    // Auto-display first unlocked hero details
    const firstUnlocked = heroes.find(h => !h.locked);
    if (firstUnlocked) {
        displayHeroDetails(game, firstUnlocked.id);
    }
}

/**
 * Select hero
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

    selectedHeroId = heroId;
    console.log(`[HeroSelect] Selected hero: ${heroId}`);

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
    
    return hero;
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
    const archetypes = document.getElementById('hero-archetypes');
    if (archetypes && hero.archetypes?.length) {
        archetypes.innerHTML = `
            <h4>Archetypes</h4>
            <div class="archetype-list">
                ${hero.archetypes.map(a => `
                    <div class="archetype">
                        <span class="archetype-name">${a.name}</span>
                        <span class="archetype-desc">${a.description}</span>
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
