# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unofficial online grimoire tool for Blood on the Clocktower (血染钟楼). Vue 2 + Vuex SPA that runs in browser, with WebSocket support for live sessions. Based on bra1n/townsquare, customized for Chinese version (中文魔典).

## Commands

```bash
# Development
npm run serve          # Start dev server (http://localhost:8080)
npm run build          # Production build
npm run lint           # Lint and auto-fix
npm run lint-ci        # Lint without fixes (CI mode)
```

## Architecture

### State Management (Vuex)
- `src/store/index.js` — Root store with grimoire state (night/day, zoom, muted, etc.), edition/role management
- `src/store/modules/players.js` — Player state (seats, roles, reminders, death status, vote status)
- `src/store/modules/session.js` — Live session state (WebSocket connection, nominations, voting)
- `src/store/persistence.js` — localStorage persistence for grimoire settings and session data
- `src/store/socket.js` — WebSocket handling for live sessions

### Data Flow
Roles and editions are loaded from JSON files at startup:
- `src/roles.json` — Character definitions (id, name, team, ability, night order, reminders)
- `src/editions.json` — Edition/script definitions (tb, bmr, snv, custom)
- `src/fabled.json` — Fabled/traveler character definitions
- `src/game.json` — Role distribution rules by player count
- `src/hatred.json` — Jinx (相克) relationships between characters

### Component Structure
- `App.vue` — Root component, renders TownSquare + Menu + Modals
- `TownSquare.vue` — Main grimoire view with player circle, bluffs panel, fabled panel
- `Player.vue` — Individual player token (life/death toggle, role assignment, reminders)
- `Token.vue` — Role token display (icon, name, reminders, night order indicators)
- `Vote.vue` — Voting overlay with countdown and vote tracking
- `Menu.vue` — Settings menu (tabs: 游戏/玩家/角色/设置)
- `modals/` — All modal dialogs (EditionModal, RoleModal, ReminderModal, etc.)

### Key Patterns
- Player actions use `$emit('trigger', ['methodName', params])` pattern to bubble up to TownSquare
- Modal visibility controlled by `modals` state in root store (`toggleModal` mutation)
- Custom images require `grimoire.isImageOptIn` flag (security for custom JSON scripts)
- Night order calculated from `firstNight`/`otherNight` properties in role definitions
- Session state persisted to localStorage via `persistence.js` plugin

### FontAwesome Icons
Icons registered in `src/main.js` as `faIcons` array. Remove unused icons from this array to reduce bundle size.

### Styling
- SCSS with scoped styles in components
- Global variables in `src/vars.scss` (team colors: $townsfolk, $outsider, $minion, $demon, $traveler, $fabled)
- Background images in `src/assets/` (shroud, life, token, leaves, etc.)
- Role token icons in `src/assets/icons/` (named by role ID, e.g., `washerwoman.png`)

## Custom Script Format

Supports official Script Tool JSON plus custom `_meta` object:
```json
[
  { "id": "_meta", "name": "Script Name", "author": "Author", "logo": "url" },
  { "id": "washerwoman" },
  { "id": "custom_char", "name": "Custom", "team": "outsider", "ability": "...", ... }
]
```

Required role properties: `id`, `name`, `team`, `ability`. Optional: `image`, `edition`, `firstNight`, `otherNight`, `reminders`, `setup`, etc.
