# Meal Planner — Weekly Meal Planning App

> A local-first weekly meal planning app for a 2-person North Indian household. Plan breakfast, lunch, dinner & fruits for the week, auto-generate grocery lists, and get AI-powered suggestions that learn from your history.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Tailwind CSS |
| Backend | Node.js + Express |
| Storage | Local JSON files (`/data/*.json`) |
| AI | Claude API (Sonnet) for suggestions |

## Features

- **Master meal library** — 9 breakfasts, 22 lunch/dinner meals, 6 fruits, 3 drinks seeded from ~6 months of real meal plans
- **Week selector** — Calendar dropdown in header, click any Monday to set the week
- **3-screen planning flow** — Pantry Stock → Preferences → Weekly grid
- **Click-to-add meal grid** — HTML table layout, click empty slot to open modal with AI + rule-based + full list
- **Swap modal with 3 sections** — AI Suggestions, Rule-based Suggestions, Everything Else (filterable)
- **Building blocks** — Meals shown as "Main + Base" (e.g., "Palak Paneer + Roti"), base changeable per cell
- **No-base option** — Dishes like Biryani, Veg Pulao need no base accompaniment
- **Smart qty** — Qty +/- only for countable items (roti/paratha/pav, certain breakfasts like Bread, Chilla)
- **Qty/base persistence** — Changes survive Edit ↔ Review transitions, reflected in chart & grocery list
- **AI-enhanced planning** — AI suggestions auto-merged into grid, shown with purple "AI pick" indicators
- **Type-specific AI suggestions** — Breakfast slots get breakfast options, lunch/dinner get meal options
- **Base swap per cell** — Inline rice/roti/paratha/pav/noodles/none buttons
- **Breakfast auto-rotation** with manual override via modal
- **Fruit row** in the grid (separate from meals)
- **Smart suggestions** — No repeats within the week, avoids last 2 weeks' history, uses leftovers first
- **Auto-optimized grocery list** — AI fixes nonsensical quantities (Mushroom→200g, Coriander→1 bunch), bulk buy tips
- **Editable grocery items** — Click to edit qty/unit, remove with x button
- **Copyable outputs** — Day-wise meal chart + grocery list as WhatsApp-friendly text
- **History tracking** — Saves finalized weeks, learns over time
- **Manage Meals** — CRUD for all meal categories with duplicate prevention, inline edit, delete
- **Clickable step indicators** — Navigate back to Pantry Stock or Preferences anytime
- **No wasted API calls** — All days skipped → noOp, Back to Edit → no re-call
- **Toast notifications** — Red errors, green success, yellow warnings
- **Auto-save & resume** — Plan auto-saves every 2s (incl. qty/base overrides); resume prompt on next visit
- **Responsive design** — Mobile grid scrolls horizontally, full-width modals

## Data Files

```
data/
├── master-meals.json    # Meal library with ingredients & quantities
├── ingredients.json     # 39 ingredients with categories, purchase units, shelf life
├── history.json         # 10 weeks of past meal plans (Oct 2025 – Mar 2026)
├── config.json          # Rules, preferences, AI config
└── current-week.json    # Active week's plan (working state, auto-saved)
```

## Screens

### Screen 1 — Pantry Stock
Autocomplete from ingredient master. Enter quantities of ingredients you have in stock. Supports fractions (1/2, 1 1/3) with quick-pick buttons for common units.

### Screen 2 — Week Preferences
- Day rows with inline breakfast/lunch/dinner skip checkboxes
- Clickable quick prompt chips: "No rice this week", "Light meals on weekdays", etc.
- Chicken count stepper (default 2)
- Summary card with active days/meals/chicken/pantry item counts

### Screen 3 — Meal Planner Grid
Weekly HTML table: Mon–Sat × Breakfast, Lunch, Dinner, Fruit.

- **Click empty slot** → SwapModal with 3 sections: AI, Suggestions, Everything Else
- **Swap button** on existing meals → same modal for replacement
- **Base swap** — Inline rice/roti/paratha/pav/noodles/none buttons per meal card
- **Meal titles** — "Main + Base" format (e.g., "Palak Paneer + Roti")
- **Smart qty** — +/- buttons only for countable bases (roti/paratha/pav) and breakfasts (Bread, Chilla, etc.)
- **AI indicators** — Purple-bordered cells with "AI pick" label for AI-placed meals
- **Free text dish** — "Add & Use" input in SwapModal to create new meals on the fly
- **Review Plan** → AI-optimized grocery list + weekly chart (with base/qty overrides) + finalize

### Output 1 — Weekly Meal Chart
Day-wise formatted text with base and qty overrides. One-click copy per day or full week.

### Output 2 — Grocery List
Auto-generated and AI-optimized (respects base overrides). Per-item edit (qty/unit) and remove. Grouped by category. AI fixes nonsensical quantities before display.

### Finalize
Saves week to history, validates slots, resets for next week.

## Setup

```bash
npm install
cp .env.example .env
# Add your Claude API key to .env
npm run dev
```

## Commands

- `npm run dev` / `npm start` — starts both frontend (port 3000) and backend (port 3001)
- `npm run server` — backend only
- `npm run client` — frontend only

## Environment Variables

```
ANTHROPIC_API_KEY=your-key-here
PORT=3001
```

---

## License

Personal project. Not for distribution.
