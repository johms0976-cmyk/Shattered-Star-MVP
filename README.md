# 🌟 SHATTERED STAR

> *A sci-fi noir cosmic horror deck-building RPG*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha-blue.svg)]()
[![Status](https://img.shields.io/badge/status-in%20development-orange.svg)]()

---

<p align="center">
  <img src="assets/images/ui/logo_placeholder.png" alt="Shattered Star Logo" width="400">
</p>

<p align="center">
  <em>"Blade Runner meets Slay the Spire. A noir detective story where the mystery is cosmic, the cards are your weapons, and the world remembers every choice you make."</em>
</p>

---

## 🎮 About

**Shattered Star** is a gritty sci-fi noir deck-building RPG set on the dying planet Vharos, where stranded operatives must navigate a fractured world, manipulate warring factions, and confront a cosmic entity known as **Xal'Korath, the World-Eater**.

The game blends:
- 🃏 Slay-the-Spire-style deckbuilding
- 🗺️ Branching node-based exploration
- ⚖️ Faction alignment & narrative consequences
- 🎨 Pixel-art sci-fi noir aesthetics
- 👁️ Cosmic horror themes
- 🔄 Replayable roguelike structure

## 🚀 Quick Start

### Play Online
Visit: `https://[your-username].github.io/shattered-star`

### Run Locally
```bash
# Clone the repository
git clone https://github.com/[your-username]/shattered-star.git

# Navigate to directory
cd shattered-star

# Open in browser (no build step required!)
# Option 1: Direct file
open index.html

# Option 2: Local server (recommended)
python -m http.server 8000
# Then visit http://localhost:8000
```

## 🎯 Current MVP Features

### ✅ Implemented
- [ ] Loading screen with animated transitions
- [ ] Title screen with logo animation
- [ ] Main menu (New Game, Continue, Settings)
- [ ] Act I intro cinematic
- [ ] Procedural node map
- [ ] Turn-based combat system
- [ ] Card draw/play/discard mechanics
- [ ] Enemy intent system
- [ ] Basic status effects
- [ ] Save/load functionality

### 🚧 In Progress
- [ ] Korvax hero (Overheat mechanic)
- [ ] 30 card base set
- [ ] 5 enemy types
- [ ] Scrap-King boss encounter
- [ ] Event system

### 📋 Planned
- [ ] Additional heroes (Lyria, Auren, Shade)
- [ ] Faction reputation system
- [ ] Corruption mechanics
- [ ] Additional regions
- [ ] Meta-progression

## 🏗️ Project Structure

```
shattered-star/
├── index.html              # Entry point
├── src/
│   ├── main.js             # Game initialization
│   ├── core/               # Engine systems
│   ├── game/               # Game logic
│   ├── ui/                 # UI components
│   └── data/               # Data loaders
├── data/                   # Game content (JSON)
├── assets/                 # Images & audio
├── styles/                 # CSS
├── config/                 # Configuration
└── docs/                   # Documentation
```

## 🎨 Art Style

Shattered Star employs a distinctive **noir + cosmic horror** visual identity:

| Aspect | Description |
|--------|-------------|
| **Palette** | Deep blacks, rust oranges, toxic yellows, neon cyan |
| **Style** | High-fidelity pixel art with modern lighting |
| **Tone** | Heavy shadows, fractured reality, glitch effects |

## 📖 Lore

The Stellar Concord vessel *Dawnseeker* receives a mysterious signal from the dead world Vharos. When the crew investigates, a cosmic pulse tears the ship apart, scattering four operatives across the planet.

**Playable Heroes:**
- **Korvax Rend** - "The Broken Titan" - Tech-berserker with unstable Overheat systems
- **Lyria Voss** - "The Fractured Mind" - Temporal mage experiencing nonlinear time
- **Auren Solari** - "The Fallen Light" - Ex-paladin seeking redemption
- **Shade** - "The Faceless" - Identity-shifting operative with stolen memories

**Factions:**
- Rustborn Tribes - Survival, strength, ingenuity
- Veiled Choir - Knowledge, illusion, temporal mastery
- First Light Remnants - Purity, discipline, divine order
- Mask Syndicate - Secrecy, identity, control
- Abyssal Whisperers - Corruption, entropy, cosmic ascension

## 🛠️ Development

### Tech Stack
- **Language:** Vanilla JavaScript (ES6+)
- **Rendering:** HTML5 Canvas
- **Styling:** CSS3
- **Data:** JSON/YAML
- **Build:** None required (static files)

### Contributing
See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Documentation
- [Expert Panel Review](docs/EXPERT_PANEL_REVIEW.md) - Design analysis
- [Architecture](docs/ARCHITECTURE.md) - Technical documentation
- [Game Bible](docs/) - Full game design document

## 📊 Targets

| Platform | Resolution | Frame Rate |
|----------|------------|------------|
| Desktop | 1920x1080 | 60 FPS |
| Tablet | 1024x768 | 60 FPS |
| Mobile | 375x667 | 30 FPS |

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by *Slay the Spire*, *Inscryption*, *Griftlands*
- Cosmic horror influences from Lovecraft, *Sunless Sea*, *Darkest Dungeon*
- Noir aesthetics from *Blade Runner*, *Cowboy Bebop*

---

<p align="center">
  <strong>The void is watching.</strong>
</p>

<p align="center">
  <em>Made with 🖤 by [Your Name]</em>
</p>
