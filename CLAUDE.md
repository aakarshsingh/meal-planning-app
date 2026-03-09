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
│   ├── master-meals.json        # 11 breakfasts, 22+ meals, 2 sides, 6 fruits, 3 drinks with ingredient mappings
│   ├── ingredients.json         # 39 ingredients with categories, purchase units, shelf life
│   ├── history.json             # 10 weeks of actual meal history (Oct 2025 – Mar 2026)
│   ├── config.json              # Household rules, AI config, grocery defaults
│   └── current-week.json        # Active week plan template
├── server/
│   ├── index.js                 # Express server entry
│   ├── routes/
│   │   ├── meals.js             # GET/POST/PUT/DELETE master meals, sides, and ingredients
│   │   ├── planner.js           # Current week CRUD, finalize to history
│   │   ├── groceries.js         # Grocery list generation (accepts baseOverrides)
│   │   ├── suggest.js           # Rule-based suggestion engine routes
│   │   └── ai.js                # Claude API proxy routes (with noOp for all-skipped)
│   └── utils/
│       ├── fileStore.js         # readJSON, writeJSON, appendToHistory helpers
│       ├── suggestionEngine.js  # Rule-based plan generation and swap suggestions
│       ├── groceryBuilder.js    # Aggregate ingredients (incl. side dishes), subtract leftovers, group by category
│       └── prompts.js           # Claude API prompt templates (type-specific swaps, grocery fixes)
├── src/
│   ├── App.jsx                  # 3-step wizard, lifted qty/base/AI state, auto-save, resume, validation
│   └── components/
│       ├── LeftoverInput.jsx    # Screen 1: pantry stock input (ingredients + fruits), fraction qty support
│       ├── WeekPreferences.jsx  # Screen 2: skip days, special requests, chicken count
│       ├── MealGrid.jsx         # Screen 3: HTML table grid, AI indicators, drag-and-drop swap, click-to-add
│       ├── MealCard.jsx         # Meal tile: "Name + Base" title, base swap, smart qty, side dish label
│       ├── SwapModal.jsx        # 3-section modal: AI suggestions, rule-based, everything else
│       ├── GroceryList.jsx      # Pre-optimized grocery with edit icon, per-item edit/remove
│       ├── WeeklyChart.jsx      # Copyable day-wise meal text with base/qty overrides
│       ├── Toast.jsx            # Toast notification system (success/error/warning)
│       └── ManageMealsModal.jsx # CRUD meals/sides with dedup check, categories, suggestedSide, inline edit/delete
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
- **Building blocks**: Each meal = main dish + base. Title shows "Palak Paneer + Roti". Base can be rice/roti/paratha/pav/none
- **No-base meals**: Dishes like Biryani, Veg Pulao use base "none" — no accompaniment needed
- **Side dishes**: Optional sides (Yellow Dal, Raita, etc.) linked to meals via `suggestedSide` field. Sides section in master-meals.json. Side ingredients auto-included in grocery calculation
- **Countable qty**: Only roti/paratha/pav bases show qty +/- buttons. Also countable breakfasts: Bread, Aloo Paratha, Chilla, French Toast, Poori. Rice/none are non-countable
- **Breakfast**: Auto-suggested from a rotation of 11 options, user can swap via modal. No limit on items per day
- **Dual-category items**: Breakfast items can optionally be added to Mains too (e.g., Aloo Paratha usable in lunch/dinner)
- **Lunch/Dinner**: Flexible — same meal can go in either slot. 22+ meals in master list
- **Meat**: Target 2 meat dishes per week — chicken, mutton, etc. (configurable in config.json as `meatPerWeek`)
- **No-repeat rule**: Don't repeat meals from the last 2 weeks (reads history.json)
- **Within-week uniqueness**: No same meal twice in a single week
- **Fruits**: Shown as a separate row in the meal grid, editable in pantry stock screen, 6 fruits available
- **Grocery calculation**: Dynamically calculated from planned meals (with base overrides + side dishes), subtract leftovers, round up to purchase units, group by category, AI-optimized before display
- **Drag-and-drop**: Users can drag meals between days within the same row (breakfast, lunch, dinner, fruit) to swap

## State Management

- **Lifted state**: `quantities`, `baseOverrides`, `aiPlanCache`, `aiOverrideUsed`, `freshAiSuggestions`, `masterMealsVersion` are owned by App.jsx, not MealGrid
- **Persistence**: qty/base/AI cache persist across Edit ↔ Review transitions — no extra API calls on "Back to Edit"
- **Auto-save**: current-week.json saves quantities and baseOverrides (debounced 2s)
- **Resume**: Restores quantities and baseOverrides from saved state
- **AI tracking**: `aiPlacedSlots` Set in MealGrid tracks which day-slot combos were AI-placed (purple indicator)

## Data File Formats

### master-meals.json
- `meta`: servings, cuisine, meatPerWeek
- `breakfasts[]`: id (bf-XX), name, defaultQty, unit, accompaniment, ingredients[]
- `meals[]`: id (meal-XX), name, type (veg/egg/meat), slot (flexible/dinner), base (rice/paratha/roti/pav/none), suggestedSide (optional side-XX ref), ingredients[]
- `sides[]`: id (side-XX), name, ingredients[]
- `drinks[]`: id (drink-XX), name, ingredients[]
- `fruits[]`: id (fruit-XX), name, defaultQty, unit, season
- Each ingredient reference: `{ ingredientId, qty, unit }`

### ingredients.json
- `ingredients[]`: id (ing-XXX), name, category (staple/vegetable/dairy/protein/bakery/ready-mix/spice), purchaseUnit, purchaseQty, shelfLifeDays, alwaysInStock (optional)

### history.json
- `weeks[]`: weekStart, weekEnd, days.{DayName}.{breakfast/lunch/dinner} = meal ID or null, days.{DayName}.fruit = [fruit IDs]

### current-week.json
- weekStart, weekEnd, leftovers[], preferences{}, plan{}, quantities{}, baseOverrides{}, groceryList[], finalized

### config.json
- household: servings, cuisine, planDays, mealSlots
- rules: meatPerWeek, noRepeatWithinWeeks, breakfastAutoSuggest, etc.
- groceryDefaults: alwaysInclude ingredient IDs, calculateFromMeals flag
- ai: provider, model, usagePoints

## Suggestion Engine Logic

1. Load last 2 weeks from history.json → get used meal IDs
2. Parse special requests into hard constraints (e.g., "Have Poori on Saturday" → breakfast constraint, "Chicken Gravy on Wed and Fri" → lunch/dinner constraints). Handles "two different kinds" by placing distinct meals of the same type
3. Filter master meals: exclude recently used, exclude already-in-current-week
4. Score candidates: +3 uses leftover ingredient, +1 alternates rice/paratha base, -10 already this week
5. Pre-place constrained meals (from special requests) before any random fill
6. Enforce: exactly N meat meals (from config, adjusted for constrained meat), rest veg/egg
7. Breakfast: rotate through 11 options, prefer ones using leftovers. Honor breakfast constraints first
8. Fruit: rotate, no same fruit on consecutive days
9. Fallback to Claude API if rule-based engine can't fill all slots

## Claude API Usage

API calls are budgeted to save costs. AI state is lifted to App.jsx and cached — no duplicate calls on navigation.

1. **Plan generation** (Screen 3 first load only): Single call to `/api/ai/generate-plan`. Cached in `aiPlanCache` at App.jsx level. AI meals merged into grid slots. AI-placed cells shown with purple border + "AI pick" badge. NoOp if all days are skipped. NOT re-called on Back to Edit.
2. **Grocery optimization** (pre-render on Review Plan): Called before grocery list is shown. List stays in loading state until both generation and AI optimization complete. Returns suggestions + quantity fixes.
3. **Swap override** (user-triggered, max 1 per session): "Get fresh AI suggestions" button in SwapModal. `freshAiSuggestions` cached in App.jsx. Type-specific: breakfast slots get breakfast suggestions, lunch/dinner get meal suggestions.
4. **SwapModal default**: Rule-based suggestions + cached AI meals from call #1 + "Everything else" full list. No API call on open.
5. Always fall back to rule-based engine if API fails — never block the user

## UI Flow

```
Screen 1 (Pantry Stock) → Screen 2 (Preferences) → Screen 3 Part 1 (Edit Grid) → Screen 3 Part 2 (Review + Finalize)
```

- **Header**: Calendar dropdown week picker (local timezone safe), "Manage Meals" button
- **Step indicators**: Clickable — can navigate back to Pantry Stock or Preferences from any later step
- **Screen 1**: Autocomplete ingredient search (ingredients + fruits), fraction qty support
- **Screen 2**: Day rows with meal skip checkboxes, quick prompt chips, chicken count stepper, special requests (free text, parsed into hard constraints)
- **Screen 3 Part 1** (Edit): HTML table grid, purple-bordered AI-placed cells, drag-and-drop swap between days, click empty slot → SwapModal, base swap buttons (incl. "No base"), smart qty buttons, skipped cells show X on hover to unskip, Clear All / Restore, "Review Plan" button
- **Screen 3 Part 2** (Review): Weekly Chart (with base/qty overrides) + pre-optimized Grocery List + "Back to Edit" (no API call, AI cached) + "Finalize Week"
- **SwapModal**: 3 sections — AI Suggestions, Rule-based Suggestions, Everything Else (full filtered list). Search filter, "Add & Use" for new dishes.
- **ManageMealsModal**: Categories (Breakfasts, Drinks, Mains, Sides, Fruits). Closes only on cross/ESC. Inline edit with suggestedSide selector for mains. "Also add to Mains" checkbox for breakfasts. Add form stays open for batch adds.
- **GroceryList**: Pre-optimized (loading until AI fixes applied), pencil edit icon per item, per-item edit (qty/unit) and remove (x button)

## Style Guide

- Tailwind CSS with Helvetica font
- Color palette: #EBEBD3 (cream/base), #00635D (teal/primary), #0C1B33 (navy/text), #F4D35E (gold/highlights), #DA4167 (red/accent)
- Meal type indicators: veg (seedling), egg, meat (drumstick) — all types have icons
- Per-fruit emoji icons, per-drink emoji icons
- Meat meals get gold accent highlight
- AI-placed cells: purple border + "AI pick" label
- Drag-and-drop: highlight target cell on drag-over
- Skipped days greyed out
- Responsive: grid scrolls horizontally on mobile

## Important Constraints

- All file I/O goes through `fileStore.js` — never read/write JSON directly in routes
- Never modify the seed data files structure — only append/update values
- API key must never be exposed to the frontend — all Claude calls go through `/api/ai/*` routes
- Auto-save current-week.json on every plan change (debounced 2s), includes quantities and baseOverrides
- On app load, if current-week.json has existing plan, prompt "Resume?" or "Start fresh"
- "Back to Edit" from Review must NOT trigger any API calls — AI plan cached in App.jsx state
- All days/meals skipped → noOp, no API call
- Date handling uses `toLocalDateStr()` — never `toISOString().slice(0,10)` (UTC shift bug in IST)
- Qty/base overrides and AI cache are lifted to App.jsx so they persist across Edit ↔ Review transitions
- ManageMealsModal closes only via cross button or ESC — not on backdrop click
- When ManageMealsModal closes, `masterMealsVersion` increments → both App.jsx and MealGrid re-fetch master meals so newly added items appear immediately
- Grocery list waits for AI optimization before rendering (no partial display)
- No limit on breakfast/drink items per day — user can add as many as desired
- Special requests in preferences are hard constraints — both rule-based engine and AI prompt enforce them
- Skipped slots on Screen 3 can be unskipped via hover X button — revives the slot for planning
