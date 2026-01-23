/**
 * HeroSelectScreen - Hero selection screen handler
 */

let selectedHeroId = null;

export function setupHeroSelect(game) {
    const heroCardsContainer = document.getElementById('hero-cards');
    const btnBack = document.getElementById('btn-back-title');
    const btnStartRun = document.getElementById('btn-start-run');
    
    // Back button
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            game.audioManager.playSFX('ui_click');
            game.screenManager.transitionTo('title-screen');
            selectedHeroId = null;
        });
    }
    
    // Start run button
    if (btnStartRun) {
        btnStartRun.addEventListener('click', () => {
            if (selectedHeroId) {
                game.audioManager.playSFX('ui_confirm');
                game.startNewRun(selectedHeroId);
            }
        });
    }
    
    // Setup when screen is shown
    game.eventBus.on('screen:changed', ({ to }) => {
        if (to === 'hero-select-screen') {
            renderHeroCards(game);
        }
    });
}

function renderHeroCards(game) {
    const container = document.getElementById('hero-cards');
    if (!container) return;
    
    // Get available heroes from data loader
    const heroes = game.dataLoader.getAllHeroes();
    
    container.innerHTML = heroes.map(hero => `
        <div class="hero-card ${hero.locked ? 'locked' : ''}" 
             data-hero-id="${hero.id}"
             ${hero.locked ? 'data-locked="true"' : ''}>
            <div class="hero-card-portrait">
                <div class="hero-silhouette ${hero.id}"></div>
            </div>
            <div class="hero-card-info">
                <h3 class="hero-card-name">${hero.name}</h3>
                <p class="hero-card-title">${hero.title}</p>
            </div>
            ${hero.locked ? '<div class="locked-overlay"><span>🔒</span></div>' : ''}
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.hero-card:not([data-locked])').forEach(card => {
        card.addEventListener('click', () => {
            selectHero(game, card.dataset.heroId);
        });
        
        card.addEventListener('mouseenter', () => {
            previewHero(game, card.dataset.heroId);
        });
    });
    
    // Reset selection
    selectedHeroId = null;
    document.getElementById('btn-start-run').disabled = true;
    clearHeroDetails();
}

function selectHero(game, heroId) {
    game.audioManager.playSFX('ui_click');
    
    // Update visual selection
    document.querySelectorAll('.hero-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-hero-id="${heroId}"]`)?.classList.add('selected');
    
    selectedHeroId = heroId;
    document.getElementById('btn-start-run').disabled = false;
    
    displayHeroDetails(game, heroId);
}

function previewHero(game, heroId) {
    if (!selectedHeroId) {
        displayHeroDetails(game, heroId);
    }
}

function displayHeroDetails(game, heroId) {
    const hero = game.dataLoader.getHero(heroId);
    if (!hero) return;
    
    // Update portrait
    const portrait = document.getElementById('hero-portrait');
    if (portrait) {
        portrait.className = `hero-portrait ${heroId}`;
        portrait.innerHTML = `<div class="hero-portrait-inner"></div>`;
    }
    
    // Update text info
    document.getElementById('hero-name').textContent = hero.name;
    document.getElementById('hero-title').textContent = hero.title;
    document.getElementById('hero-desc').textContent = hero.description;
    
    // Update stats
    const statsContainer = document.getElementById('hero-stats');
    if (statsContainer) {
        statsContainer.innerHTML = `
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
    
    // Update archetypes
    const archetypesContainer = document.getElementById('hero-archetypes');
    if (archetypesContainer && hero.archetypes) {
        archetypesContainer.innerHTML = `
            <h4>Archetypes</h4>
            <div class="archetype-list">
                ${hero.archetypes.map(arch => `
                    <div class="archetype">
                        <span class="archetype-name">${arch.name}</span>
                        <span class="archetype-desc">${arch.description}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function clearHeroDetails() {
    document.getElementById('hero-name').textContent = 'Select a Hero';
    document.getElementById('hero-title').textContent = '';
    document.getElementById('hero-desc').textContent = 'Choose your operative for this descent into the void.';
    document.getElementById('hero-stats').innerHTML = '';
    document.getElementById('hero-archetypes').innerHTML = '';
    
    const portrait = document.getElementById('hero-portrait');
    if (portrait) {
        portrait.className = 'hero-portrait';
        portrait.innerHTML = '';
    }
}
