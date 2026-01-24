/**
 * ScreenManager - Handles screen transitions and state
 * 
 * FIXED: Now emits screen:show event for compatibility
 */
class ScreenManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentScreen = 'loading-screen';
        this.previousScreen = null;
        this.screens = new Map();
        this.transitioning = false;
        this.transitionDuration = 300;
        
        this.init();
    }

    /**
     * Initialize screen manager
     */
    init() {
        // Register all screens
        document.querySelectorAll('.screen').forEach(screen => {
            this.screens.set(screen.id, screen);
        });
        
        console.log(`[ScreenManager] Registered ${this.screens.size} screens`);
    }

    /**
     * Transition to a new screen
     */
    transitionTo(screenId, options = {}) {
        if (this.transitioning) {
            console.warn('[ScreenManager] Transition already in progress');
            return;
        }

        const targetScreen = this.screens.get(screenId);
        if (!targetScreen) {
            console.error(`[ScreenManager] Screen not found: ${screenId}`);
            return;
        }

        const currentScreenEl = this.screens.get(this.currentScreen);
        const fromScreen = this.currentScreen;
        
        this.transitioning = true;
        
        // Emit transition start event
        this.eventBus.emit('screen:transition:start', { 
            from: fromScreen, 
            to: screenId 
        });

        // Fade out current screen
        if (currentScreenEl) {
            currentScreenEl.classList.add('fade-out');
        }

        setTimeout(() => {
            // Hide current screen
            if (currentScreenEl) {
                currentScreenEl.classList.remove('active', 'fade-out');
            }

            // Store previous screen
            this.previousScreen = fromScreen;
            this.currentScreen = screenId;

            // Show new screen
            targetScreen.classList.add('active', 'fade-in');

            setTimeout(() => {
                targetScreen.classList.remove('fade-in');
                this.transitioning = false;
                
                // Emit transition end event
                this.eventBus.emit('screen:transition:end', { 
                    from: this.previousScreen, 
                    to: screenId 
                });
                
                // FIX: Emit ALL THREE event types for maximum compatibility
                // Some listeners use screen:change (just the screenId string)
                this.eventBus.emit('screen:change', screenId);
                
                // Some listeners use screen:changed (with from/to object)
                this.eventBus.emit('screen:changed', { 
                    to: screenId, 
                    from: this.previousScreen 
                });
                
                // FIX: Also emit screen:show (just the screenId string)
                this.eventBus.emit('screen:show', screenId);
                
                console.log(`[ScreenManager] Transitioned to: ${screenId}`);
                
            }, this.transitionDuration);
        }, this.transitionDuration);
    }

    /**
     * Go back to previous screen
     */
    goBack() {
        if (this.previousScreen) {
            this.transitionTo(this.previousScreen);
        }
    }

    /**
     * Get current screen ID
     */
    getCurrentScreen() {
        return this.currentScreen;
    }

    /**
     * Check if on a specific screen
     */
    isOnScreen(screenId) {
        return this.currentScreen === screenId;
    }

    /**
     * Show a modal overlay
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.eventBus.emit('modal:open', modalId);
        }
    }

    /**
     * Hide a modal overlay
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            this.eventBus.emit('modal:close', modalId);
        }
    }

    /**
     * Hide all modals
     */
    hideAllModals() {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
}

export { ScreenManager };
