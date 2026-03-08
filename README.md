# Meal Planner — Weekly Meal Planning App

> A local-first weekly meal planning app for a 2-person North Indian household. Plan breakfast, lunch, dinner & fruits for the week, auto-generate grocery lists, and get AI-powered suggestions that learn from your history.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + `@dnd-kit/core` + Tailwind CSS |
| Backend | Node.js + Express |
| Storage | Local JSON files (`/data/*.json`) |
| AI | Claude API (Sonnet) for suggestions |

## Features

- **Master meal library** — 9 breakfasts, 22 lunch/dinner meals, 6 fruits seeded from ~6 months of real meal plans
- **3-screen planning flow** — Leftovers → Preferences → Drag-and-drop weekly grid
- **Drag & drop meal grid** — Swap meals between slots, drag from suggestion tray, drag out to remove
- **Breakfast auto-rotation** with manual override
- **Fruit row** in the grid (separate from meals)
- **Smart suggestions** — No repeats within the week, avoids last 3 weeks' history, uses leftovers first
- **Claude AI integration** — Swap suggestions, initial plan generation, grocery optimization
- **Grocery list builder** — Calculates quantities from planned meals, subtracts leftovers, groups by category
- **Copyable outputs** — Day-wise meal chart + grocery list as WhatsApp-friendly text
- **History tracking** — Saves finalized weeks, learns over time
- **2 chicken dishes/week** default (configurable)
- **Cooking for 2** — All quantities are total for 2 people

## Data Files

```
data/
├── master-meals.json    # Meal library with ingredients & quantities
├── ingredients.json     # 39 ingredients with categories, purchase units, shelf life
├── history.json         # 10 weeks of past meal plans (Oct 2025 – Mar 2026)
├── config.json          # Rules, preferences, AI config
├── current-week.json    # Active week's plan (working state)
└── grocery-lists.json   # Archived grocery lists
```

## Screens

### Screen 1 — Leftover Input
Autocomplete from ingredient master. Enter quantities of leftover groceries from last week. These become constraints — use expiring items first.

### Screen 2 — Week Preferences
- Skip specific days or meals (e.g., "eating out Wednesday dinner")
- Special requests (e.g., "no rice this week", "something Punjabi on Sunday")
- Stored as weekly config

### Screen 3 — Meal Planner Grid
Weekly table: Mon–Sat × Breakfast, Lunch, Dinner, Fruit.

- **Drag & drop** — Move meals between cells using `@dnd-kit`
- **Suggestion tray** — Sidebar with AI + rule-based suggestions
- **Swap button** — Per cell, shows 3-5 alternatives from master list + Claude suggestions
- **Quantity adjust** — Quick +/- buttons per meal
- **Auto-filled breakfast** — Rotated from 9 breakfast options, overridable

### Output 1 — Weekly Meal Chart
Day-wise formatted text. One-click copy per day or full week. WhatsApp-friendly format.

### Output 2 — Grocery List
Aggregated from all planned meals. Subtracted leftovers. Grouped by category (Vegetables, Dairy, Protein, Staples, Bakery, Ready-mix). Rounded to standard purchase units.

## Suggestion Engine

```
Priority layers:
1. Hard constraints — use leftovers before expiry, respect skipped days
2. Uniqueness — no repeat meals within week
3. History — avoid last 3 weeks' meals
4. Variety — mix rice/paratha/roti bases across the week
5. Chicken — target 2 chicken dishes per week
6. AI layer — Claude API for creative suggestions and swap options
```

## Setup

```bash
npm install
# Add your Claude API key
cp .env.example .env
# Start dev server
npm run dev
```

## Environment Variables

```
ANTHROPIC_API_KEY=your-key-here
PORT=3001
```

---

## License

Personal project. Not for distribution.
