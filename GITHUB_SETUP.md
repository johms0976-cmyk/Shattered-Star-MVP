# Shattered Star - GitHub Repository Setup

## Repository Structure

```
shattered-star/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment
├── assets/
│   ├── images/
│   │   ├── heroes/             # Hero portrait SVGs
│   │   ├── enemies/            # Enemy sprites
│   │   ├── cards/              # Card art
│   │   ├── backgrounds/        # Background images
│   │   └── ui/                 # UI elements, logo
│   └── audio/
│       ├── music/              # Background tracks
│       └── sfx/                # Sound effects
├── css/
│   ├── main.css                # Core styles
│   ├── components/
│   │   ├── cards.css           # Card styling
│   │   ├── combat.css          # Combat screen
│   │   ├── map.css             # Map screen
│   │   └── ui.css              # General UI
│   └── themes/
│       ├── corruption-0.css    # Pure state
│       ├── corruption-25.css   # Touched
│       ├── corruption-50.css   # Corrupted
│       └── corruption-75.css   # Consumed
├── data/                       # (Optional) External JSON files
│   ├── heroes/
│   ├── cards/
│   ├── enemies/
│   ├── events/
│   └── artifacts/
├── docs/
│   ├── ARCHITECTURE.md         # Technical docs
│   └── EXPERT_PANEL_REVIEW.md  # Design decisions
├── js/
│   ├── main.js                 # Entry point
│   ├── core/
│   │   ├── EventBus.js         # Event system
│   │   ├── GameState.js        # State management
│   │   ├── SaveManager.js      # Save/load
│   │   ├── AudioManager.js     # Audio handling
│   │   ├── ScreenManager.js    # Screen transitions
│   │   └── DataLoader.js       # Data loading (with fallbacks)
│   ├── systems/
│   │   ├── CombatSystem.js     # Combat logic
│   │   ├── DeckManager.js      # Deck operations
│   │   ├── MapGenerator.js     # Map generation
│   │   ├── CorruptionSystem.js # Corruption mechanics
│   │   └── RewardSystem.js     # Rewards handling
│   └── screens/
│       ├── TitleScreen.js
│       ├── HeroSelectScreen.js
│       ├── MapScreen.js
│       ├── CombatScreen.js
│       ├── EventScreen.js
│       ├── ShopScreen.js
│       ├── RestScreen.js
│       └── RewardScreen.js
├── index.html                  # Main HTML
├── README.md                   # Project overview
├── LICENSE                     # License file
└── .gitignore
```

## Setup Commands

```bash
# 1. Create new GitHub repository
# Go to github.com and create new repo "shattered-star"

# 2. Clone locally
git clone https://github.com/YOUR_USERNAME/shattered-star.git
cd shattered-star

# 3. Copy game files (from download)
# Copy all files from downloaded shattered-star folder

# 4. Initialize git
git add .
git commit -m "Initial MVP - Shattered Star deckbuilder"
git push origin main

# 5. Enable GitHub Pages
# Go to Settings > Pages > Source: Deploy from branch (main)
```

## GitHub Actions Workflow (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## .gitignore

```
# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo

# Dependencies (if added later)
node_modules/

# Build outputs
dist/
build/

# Local testing
*.local
*.log
```

## Local Development

No build step required! Just serve the files:

```bash
# Python 3
python3 -m http.server 8080

# Node.js (if installed)
npx serve .

# Then open http://localhost:8080
```

## File Count Summary

- **JavaScript**: 14 files
- **CSS**: 5 files
- **HTML**: 1 file
- **SVG Assets**: 5 files
- **Documentation**: 3 files

**Total**: ~35 files, ~400KB

## Key URLs After Deployment

- **Game**: `https://YOUR_USERNAME.github.io/shattered-star/`
- **Repository**: `https://github.com/YOUR_USERNAME/shattered-star`

## Quick Verification Checklist

After deployment, verify:

1. [ ] Title screen loads with logo
2. [ ] "New Game" button works
3. [ ] Hero select shows Korvax
4. [ ] Intro text plays
5. [ ] Map generates and displays
6. [ ] Combat nodes start fights
7. [ ] Cards can be played
8. [ ] End turn works
9. [ ] Victory triggers rewards
10. [ ] Game over screen shows on death

## Troubleshooting

**Blank screen**: Check browser console (F12) for JS errors
**CORS errors**: Must serve via HTTP, not file://
**Missing styles**: Verify CSS file paths in index.html
**Cards not appearing**: Check DataLoader fallback data loaded
