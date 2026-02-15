/**
 * HeroResourcesToggle — Makes hero resource bars (Heat/Rage/Corruption)
 * collapsible on mobile. Tap to expand/collapse.
 * @version 1.0.0
 */

export function setupHeroResourcesToggle() {
    // All possible selectors for the hero resource container
    const selectors = [
        '.hero-resources',
        '.hero-resource-bars', 
        '.combat-resources',
        '#hero-resources'
    ];
    
    selectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (!el) return;
        
        // Start collapsed on mobile
        if (window.innerWidth <= 768) {
            el.classList.remove('expanded');
        }
        
        // Toggle on click/tap
        el.addEventListener('click', (e) => {
            // Don't toggle if clicking a button or interactive child
            if (e.target.closest('button, a, input')) return;
            
            el.classList.toggle('expanded');
        });
    });
    
    console.log('[HeroResourcesToggle] Initialized');
}

export default setupHeroResourcesToggle;
