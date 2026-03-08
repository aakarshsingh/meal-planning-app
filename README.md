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
- **Week selector** — Calendar dropdown in header, click to open month view, select any Monday to set the week
- **3-screen planning flow** — Pantry Stock → Preferences → Drag-and-drop weekly grid
- **Drag & drop meal grid** — Swap meals between slots, drag from suggestion tray, drag out to remove
- **Breakfast auto-rotation** with manual override
- **Fruit row** in the grid (separate from meals)
- **Smart suggestions** — No repeats within the week, avoids last 2 weeks' history, uses leftovers first
- **Claude AI integration** — Max 3 API calls per session: plan generation on load (fuels AI Picks tray + SwapModal), grocery optimization (manual), and 1 optional fresh AI swap override. Subtle failure handling
- **Grocery list builder** — Calculates quantities from planned meals, subtracts leftovers, groups by category
- **Copyable outputs** — Day-wise meal chart + grocery list as WhatsApp-friendly text
- **History tracking** — Saves finalized weeks, learns over time
- **2 chicken dishes/week** default (configurable)
- **Cooking for 2** — All quantities are total for 2 people
- **Toast notifications** — Red errors, green success, yellow warnings for validation
- **Auto-save & resume** — Plan auto-saves every 2s; resume prompt on next visit
- **Finalize validation** — Blocks finalize on empty lunch/dinner, warns on chicken count mismatch or duplicate meals
- **Manage Meals modal** — View all master meals, add new meals from the UI
- **Responsive design** — Mobile grid scrolls horizontally, suggestion tray moves below grid, full-width modals

## Data Files

```
data/
├── master-meals.json    # Meal library with ingredients & quantities
├── ingredients.json     # 39 ingredients with categories, purchase units, shelf life
├── history.json         # 10 weeks of past meal plans (Oct 2025 – Mar 2026)
├── config.json          # Rules, preferences, AI config
└── current-week.json    # Active week's plan (working state, auto-saved)
```

## Project Structure

```
meal-planner/
├── data/                        # JSON storage (seed data)
│   ├── master-meals.json        # 9 breakfasts, 22 meals, 6 fruits with ingredient mappings
│   ├── ingredients.json         # 39 ingredients with categories, purchase units, shelf life
│   ├── history.json             # 10 weeks of actual meal history (Oct 2025 – Mar 2026)
│   ├── config.json              # Household rules, AI config, grocery defaults
│   └── current-week.json        # Active week plan (auto-saved)
├── server/
│   ├── index.js                 # Express server entry
│   ├── routes/
│   │   ├── meals.js             # GET/POST master meals and ingredients
│   │   ├── planner.js           # Current week CRUD, finalize to history
│   │   ├── groceries.js         # Grocery list generation
│   │   ├── suggest.js           # Rule-based suggestion engine routes
│   │   └── ai.js                # Claude API proxy routes
│   └── utils/
│       ├── fileStore.js         # readJSON, writeJSON, appendToHistory helpers
│       ├── suggestionEngine.js  # Rule-based plan generation and swap suggestions
│       ├── groceryBuilder.js    # Aggregate ingredients, subtract leftovers, group by category
│       └── prompts.js           # Claude API prompt templates
├── src/
│   ├── App.jsx                  # 3-step wizard with auto-save, resume, validation
│   └── components/
│       ├── LeftoverInput.jsx    # Screen 1: pantry stock input, fraction support
│       ├── WeekPreferences.jsx  # Screen 2: skip days, special requests, chicken count
│       ├── MealGrid.jsx         # Screen 3: drag-and-drop weekly grid
│       ├── MealCard.jsx         # Draggable meal tile with swap/remove/qty buttons
│       ├── SwapModal.jsx        # Modal with rule-based + AI swap suggestions
│       ├── GroceryList.jsx      # Categorized grocery output with copy button
│       ├── WeeklyChart.jsx      # Copyable day-wise meal text
│       ├── Toast.jsx            # Toast notification system (success/error/warning)
│       └── ManageMealsModal.jsx # View all meals, add new meal to master list
├── .env                         # ANTHROPIC_API_KEY=sk-ant-...
├── .env.example
└── package.json
```

## Screens

### Screen 1 — Pantry Stock
Autocomplete from ingredient master. Enter quantities of ingredients you have in stock. Supports fractions (1/2, 1 1/3) with quick-pick buttons for common units (bunch, nos, pc). These become constraints — use available items first.

### Screen 2 — Week Preferences
- Day rows with inline breakfast/lunch/dinner skip checkboxes (no extra clicks needed)
- Clickable quick prompt chips: "No rice this week", "Light meals on weekdays", "Something Punjabi", etc.
- Special requests: free text + Add → removable tags
- Chicken count stepper (default 2)
- Summary card with active days/meals/chicken/pantry item counts

### Screen 3 — Meal Planner Grid
Weekly table: Mon–Sat × Breakfast, Lunch, Dinner, Fruit.

- **Drag & drop** — Move meals between cells using `@dnd-kit`
- **Suggestion tray** — Sidebar on desktop, below grid on mobile, with rule-based + AI Picks (purple)
- **Swap button** — Per cell, shows alternatives from master list + cached AI suggestions + 1 fresh AI override
- **Base swap** — Inline rice/roti/paratha/pav/noodles buttons per meal card
- **Free text dish** — "Add & Use" input in SwapModal and quick add in tray to create new meals on the fly
- **Quantity adjust** — Quick +/- buttons per meal
- **Auto-filled breakfast** — Rotated from 9 breakfast options, overridable
- **Validation warnings** — Yellow banner for chicken count mismatch, duplicate meals

### Output 1 — Weekly Meal Chart
Day-wise formatted text. One-click copy per day or full week. WhatsApp-friendly format.

### Output 2 — Grocery List
Aggregated from all planned meals. Subtracted leftovers. Grouped by category (Vegetables, Dairy, Protein, Staples, Bakery, Ready-mix). Rounded to standard purchase units. AI optimization option.

### Finalize
Saves week to history, validates slots, resets for next week. Blocks if lunch/dinner slots are empty.

## Suggestion Engine

```
Priority layers:
1. Hard constraints — use leftovers before expiry, respect skipped days
2. Uniqueness — no repeat meals within week
3. History — avoid last 2 weeks' meals
4. Variety — mix rice/paratha/roti bases across the week
5. Chicken — target 2 chicken dishes per week
6. AI layer — 1 call on load (cached for tray + swap), 1 optional fresh swap override, 1 grocery optimize
```

## Setup

```bash
npm install
# Add your Claude API key
cp .env.example .env
# Start dev server
npm run dev
```

## Commands

- `npm run dev` / `npm start` — starts both frontend (Vite, port 3000) and backend (Express, port 3001) concurrently
- `npm run server` — backend only
- `npm run client` — frontend only (auto-opens browser)

## Environment Variables

```
ANTHROPIC_API_KEY=your-key-here
PORT=3001
```

---

## License

Personal project. Not for distribution.
