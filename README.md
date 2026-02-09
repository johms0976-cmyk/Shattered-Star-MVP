# Narrative Horror System - Updated Files for GitHub Upload

## File Structure
Upload these files to your GitHub repository, replacing existing files where indicated:

```
shattered-star/
├── js/
│   ├── main.js                    ← REPLACE existing
│   ├── core/
│   │   └── EventBus.js            ← REPLACE existing
│   ├── systems/
│   │   └── NarrativeSystem.js     ← NEW file
│   ├── ui/
│   │   └── VoidWhisperOverlay.js  ← NEW file
│   └── screens/
│       └── EventScreen.js         ← REPLACE existing
├── css/
│   ├── main.css                   ← REPLACE existing
│   └── components/
│       └── narrative-horror.css   ← NEW file
└── data/
    └── events/
        └── act1_events.json       ← REPLACE existing
```

## Changes Made

### main.js
- Added imports for `NarrativeSystem` and `VoidWhisperOverlay`
- Added `narrativeSystem` and `voidOverlay` properties to constructor
- Added initialization in `initializeSystems()` method

### EventBus.js
- Added new events for narrative horror system:
  - `DREAD_CHANGED`, `VOID_WHISPER`, `ATMOSPHERE_CHANGE`, `VOID_AWARENESS`
  - `CORRUPTION_CHANGED`, `BOSS_DEFEATED`, `PLAYER_DEATH`, `ACT_BEGIN`, `LORE_DISCOVERED`

### main.css
- Added note about linking narrative-horror.css

## index.html Update Required

Add this line to your `index.html` in the `<head>` section, after your main.css link:

```html
<link rel="stylesheet" href="css/components/narrative-horror.css">
```

## Testing After Upload

1. Start a new run and observe atmospheric node intro text
2. Enter combat and check dread indicator appears in corner
3. Take corruption and watch for void whispers at thresholds (15, 30, 50, 70)
4. Trigger events and verify typewriter text effect works
5. Check mobile responsiveness

## Features Enabled

- **Dread System**: Accumulates 0-100, affects atmosphere and whispers
- **Void Whispers**: Atmospheric messages in screen corners with glitch effects
- **Enhanced Events**: Typewriter reveal, consequence hints, 25 new horror events
- **Visual Overlays**: Corruption vignette, void eye, edge glow effects
