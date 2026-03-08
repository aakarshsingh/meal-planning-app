# CLAUDE.md

## Project Overview

Weekly meal planner for a 2-person North Indian household. Local-first app with React frontend, Node.js/Express backend, local JSON file storage, and Claude AI for smart suggestions.

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS
- **Backend**: Node.js, Express (port 3001)
- **Storage**: Local JSON files in `/data` directory — no database
- **AI**: Claude API (Sonnet) via @anthropic-ai/sdk
- **API Key**: Stored in `.env` as `ANTHROPIC_API_KEY`

## Project Structure

```
meal-planner/
├── data/                        # JSON storage (DO NOT delete seed data)
│   ├── master-meals.json        # 9 breakfasts, 22 meals, 6 fruits, 3 drinks with ingredient mappings
│   ├── ingredients.json         # 39 ingredients with categories, purchase units, shelf life
│   ├── history.json             # 10 weeks of actual meal history (Oct 2025 – Mar 2026)
│   ├── config.json              # Household rules, AI config, grocery defaults
│   └── current-week.json        # Active week plan template
├── server/
│   ├── index.js                 # Express server entry
│   ├── routes/
│   │   ├── meals.js             # GET/POST/PUT/DELETE master meals and ingredients
│   │   ├── planner.js           # Current week CRUD, finalize to history
│   │   ├── groceries.js         # Grocery list generation
│   │   ├── suggest.js           # Rule-based suggestion engine routes
│   │   └── ai.js                # Claude API proxy routes (with noOp for all-skipped)
│   └── utils/
│       ├── fileStore.js         # readJSON, writeJSON, appendToHistory helpers
│       ├── suggestionEngine.js  # Rule-based plan generation and swap suggestions
│       ├── groceryBuilder.js    # Aggregate ingredients, subtract leftovers, group by category
│       └── prompts.js           # Claude API prompt templates (type-specific swaps, grocery fixes)
├── src/
│   ├── App.jsx                  # 3-step wizard with clickable steps, auto-save, resume, validation
│   └── components/
│       ├── LeftoverInput.jsx    # Screen 1: pantry stock input, fraction qty support
│       ├── WeekPreferences.jsx  # Screen 2: skip days, special requests, chicken count
│       ├── MealGrid.jsx         # Screen 3: HTML table grid, click-to-add/swap via modal
│       ├── MealCard.jsx         # Meal tile with base swap, qty adjust, swap/remove buttons
│       ├── SwapModal.jsx        # 3-section modal: AI suggestions, rule-based, everything else
│       ├── GroceryList.jsx      # Auto-AI-optimized grocery with edit/remove per item
│       ├── WeeklyChart.jsx      # Copyable day-wise meal text
│       ├── Toast.jsx            # Toast notification system (success/error/warning)
│       └── ManageMealsModal.jsx # CRUD meals with dedup check, categories, inline edit/delete
├── .env                         # ANTHROPIC_API_KEY=sk-ant-...
├── .env.example
└── package.json
```

## Commands

- `npm run dev` / `npm start` — starts both frontend (Vite, port 3000) and backend (Express, port 3001) concurrently
- `npm run server` — backend only
- `npm run client` — frontend only (auto-opens browser)

## Data Model — Key Rules

- **Servings**: All quantities are total for 2 people (not per person)
- **Meal slots**: Breakfast (includes drinks), Lunch, Dinner, Fruit — 4 visual rows in the grid
- **Plan days**: Monday through Saturday (6 days)
- **Meal definition**: Each meal is just the dish name (e.g., "Palak Paneer") with a suggestive base (e.g., paratha) that can be changed per-cell
- **Breakfast**: Auto-suggested from a rotation of 9 options, user can swap via modal
- **Lunch/Dinner**: Flexible — same meal can go in either slot. 22+ meals in master list
- **Chicken**: Target 2 dishes per week (configurable in config.json)
- **No-repeat rule**: Don't repeat meals from the last 2 weeks (reads history.json)
- **Within-week uniqueness**: No same meal twice in a single week
- **Fruits**: Shown as a separate row in the meal grid, 1-2 per day, 6 fruits available
- **Grocery calculation**: Dynamically calculated from planned meals, subtract leftovers, round up to purchase units, group by category, AI-fixed quantities

## Data File Formats

### master-meals.json
- `meta`: servings, cuisine, chickenPerWeek
- `breakfasts[]`: id (bf-XX), name, defaultQty, unit, accompaniment, ingredients[]
- `meals[]`: id (meal-XX), name, type (veg/egg/chicken), slot (flexible/dinner), base (rice/paratha/roti/pav/noodles), ingredients[]
- `drinks[]`: id (drink-XX), name, ingredients[]
- `fruits[]`: id (fruit-XX), name, defaultQty, unit, season
- Each ingredient reference: `{ ingredientId, qty, unit }`

### ingredients.json
- `ingredients[]`: id (ing-XXX), name, category (staple/vegetable/dairy/protein/bakery/ready-mix/spice), purchaseUnit, purchaseQty, shelfLifeDays, alwaysInStock (optional)

### history.json
- `weeks[]`: weekStart, weekEnd, days.{DayName}.{breakfast/lunch/dinner} = meal ID or null, days.{DayName}.fruit = [fruit IDs]

### current-week.json
- weekStart, weekEnd, leftovers[], preferences{}, plan{}, groceryList[], finalized

### config.json
- household: servings, cuisine, planDays, mealSlots
- rules: chickenPerWeek, noRepeatWithinWeeks, breakfastAutoSuggest, etc.
- groceryDefaults: alwaysInclude ingredient IDs, calculateFromMeals flag
- ai: provider, model, usagePoints

## Suggestion Engine Logic

1. Load last 2 weeks from history.json → get used meal IDs
2. Filter master meals: exclude recently used, exclude already-in-current-week
3. Score candidates: +3 uses leftover ingredient, +1 alternates rice/paratha base, -10 already this week
4. Enforce: exactly N chicken meals (from config), rest veg/egg
5. Breakfast: rotate through 9 options, prefer ones using leftovers
6. Fruit: rotate, no same fruit on consecutive days
7. Fallback to Claude API if rule-based engine can't fill all slots

## Claude API Usage

API calls are budgeted to save costs:

1. **Plan generation** (Screen 3 load): Single call to `/api/ai/generate-plan`. AI plan merged into grid (at least 1 AI meal guaranteed). Cached for SwapModal AI suggestions. NoOp if all days are skipped.
2. **Grocery optimization** (automatic on Review Plan): Auto-called when user clicks "Review Plan". Returns suggestions + quantity fixes (e.g., Mushroom 200g not pk, Coriander 1 bunch). No manual button needed.
3. **Swap override** (user-triggered, max 1 per session): "Get fresh AI suggestions" button in SwapModal. Type-specific: breakfast slots get breakfast suggestions, lunch/dinner get meal suggestions.
4. **SwapModal default**: Rule-based suggestions + cached AI meals from call #1 + "Everything else" full list. No API call on open.
5. Always fall back to rule-based engine if API fails — never block the user

## UI Flow

```
Screen 1 (Pantry Stock) → Screen 2 (Preferences) → Screen 3 Part 1 (Edit Grid) → Screen 3 Part 2 (Review + Finalize)
```

- **Header**: Calendar dropdown week picker, "Manage Meals" button
- **Step indicators**: Clickable — can navigate back to Pantry Stock or Preferences from any later step
- **Screen 1**: Autocomplete ingredient search, fraction qty support
- **Screen 2**: Day rows with meal skip checkboxes, quick prompt chips, chicken count stepper
- **Screen 3 Part 1** (Edit): HTML table grid (proper alignment), click empty slot → SwapModal, Clear All / Restore buttons, "Review Plan" button
- **Screen 3 Part 2** (Review): Weekly Chart + AI-optimized Grocery List + "Back to Edit" (no API call) + "Finalize Week"
- **SwapModal**: 3 sections — AI Suggestions, Rule-based Suggestions, Everything Else (full filtered list). Search filter, "Add & Use" for new dishes.
- **ManageMealsModal**: Categories (Breakfasts, Drinks, Mains, Fruits), inline edit, delete with confirmation, duplicate prevention
- **GroceryList**: Auto-optimized, per-item edit (click to change qty/unit) and remove (x button)

## Style Guide

- Tailwind CSS with Helvetica font
- Color palette: #EBEBD3 (cream/base), #00635D (teal/primary), #0C1B33 (navy/text), #F4D35E (gold/highlights), #DA4167 (red/accent)
- Meal type indicators: 🥚 egg, 🍗 chicken (no icon for veg)
- Per-fruit emoji icons, per-drink emoji icons
- Chicken meals get gold accent highlight
- Skipped days greyed out
- Responsive: grid scrolls horizontally on mobile

## Important Constraints

- All file I/O goes through `fileStore.js` — never read/write JSON directly in routes
- Never modify the seed data files structure — only append/update values
- API key must never be exposed to the frontend — all Claude calls go through `/api/ai/*` routes
- Auto-save current-week.json on every plan change (debounced 2s)
- On app load, if current-week.json has existing plan, prompt "Resume?" or "Start fresh"
- "Back to Edit" from Review must NOT trigger any API calls
- All days/meals skipped → noOp, no API call
