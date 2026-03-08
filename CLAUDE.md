# CLAUDE.md

## Build Milestones

> **Instructions**: Work through these milestones in order. After completing each one, mark it done by changing `[ ]` to `[x]`. Run the verification steps before marking complete. Do NOT skip ahead.

### Milestone 1: Project Scaffold + File Store
- [x] Initialize Node.js project with Express backend and React frontend (Vite)
- [x] Create `/server/index.js` — Express on port 3001
- [x] Create `/server/utils/fileStore.js` — readJSON(filename), writeJSON(filename, data), appendToHistory(weekData)
- [x] All file ops read/write from `/data` directory (seed files already exist — do NOT modify them)
- [x] Set up Vite on port 3000 with proxy to 3001 for `/api/*`
- [x] Install deps: express, cors, dotenv, concurrently, @anthropic-ai/sdk
- [x] Install dev deps: vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer
- [x] Configure Tailwind CSS
- [x] Create `.env.example` with ANTHROPIC_API_KEY placeholder
- [x] package.json scripts: `dev` (concurrent), `server`, `client`
- [x] Health check: `GET /api/health` → `{ status: "ok", meals: <count from master-meals.json> }`
- [x] **Verify**: `npm run server` then `curl http://localhost:3001/api/health` returns `{"status":"ok","meals":22}`

### Milestone 2: Backend API Routes — Meals & Planner
- [x] `server/routes/meals.js` — `GET /api/meals` (all breakfasts, meals, fruits), `GET /api/meals/:id`, `POST /api/meals`, `GET /api/ingredients`
- [x] `server/routes/planner.js` — `GET /api/planner/current`, `PUT /api/planner/current`, `PUT /api/planner/current/slot` (update single slot `{day, mealType, mealId}`), `POST /api/planner/finalize`, `GET /api/planner/history?weeks=N`
- [x] Register routes in `server/index.js`
- [x] Proper error handling on all routes
- [x] **Verify**: `curl /api/meals | jq '.meals | length'` → 22
- [x] **Verify**: `curl /api/ingredients | jq '.ingredients | length'` → 39
- [x] **Verify**: `PUT /api/planner/current/slot` with `{"day":"Monday","mealType":"lunch","mealId":"meal-04"}` updates current-week.json

### Milestone 3: Suggestion Engine (Rule-Based)
- [x] `server/utils/suggestionEngine.js` — `generateWeeklyPlan(leftovers, preferences, history)` returns full week plan
- [x] Breakfast: auto-rotate 9 options, no consecutive repeats, prefer leftover-using breakfasts
- [x] Lunch/Dinner: exclude meals from last 2 weeks (history.json), score +3 leftover usage / +1 base alternation / -10 same week
- [x] Enforce exactly 2 chicken meals per week (from config.json), rest veg/egg
- [x] No same meal twice within a week
- [x] Respect skipDays and skipMeals from preferences
- [x] Fruit: rotate 6 options, 1-2 per day, no same fruit consecutive days
- [x] `getSuggestions(day, mealType, currentPlan, history)` — returns 5 swap alternatives
- [x] `server/routes/suggest.js` — `POST /api/suggest/plan`, `POST /api/suggest/swap`
- [x] **Verify**: `POST /api/suggest/plan` with empty leftovers → 6 days filled, 2 chicken, no repeats

### Milestone 4: Grocery Builder
- [x] `server/utils/groceryBuilder.js` — `buildGroceryList(plan, leftovers)`
- [x] Aggregate ingredients from all planned meals for the week
- [x] Subtract leftover quantities
- [x] Round up to purchase units (from ingredients.json purchaseUnit/purchaseQty)
- [x] Always include milk, atta, oil, rice (config.json groceryDefaults.alwaysInclude)
- [x] Skip alwaysInStock items unless plan needs significantly more
- [x] Group by category: vegetable, dairy, protein, staple, bakery, ready-mix, fruit
- [x] `server/routes/groceries.js` — `POST /api/groceries/generate`
- [x] **Verify**: Generate plan → generate grocery list → items grouped by category, leftover quantities subtracted

### Milestone 5: Claude AI Integration
- [x] `server/utils/prompts.js` — prompt templates for plan generation, swap, grocery optimization
- [x] `server/routes/ai.js`:
  - [x] `POST /api/ai/generate-plan` — Claude generates full week plan as JSON, validate meal IDs exist
  - [x] `POST /api/ai/swap-suggestions` — 5 alternatives with reasoning
  - [x] `POST /api/ai/optimize-grocery` — bulk buy tips, missing staples, skip suggestions
- [x] Fallback to rule-based engine if Claude API fails (no error shown to user)
- [x] API key read from `.env`, never exposed to frontend
- [x] **Verify**: With ANTHROPIC_API_KEY set, `POST /api/ai/generate-plan` returns valid plan

### Milestone 6: Screen 1 — Leftover Input
- [ ] `src/App.jsx` — 3-step wizard with step indicator, Next/Back nav, global state for leftovers/preferences/plan/groceryList
- [ ] `src/components/LeftoverInput.jsx`:
  - [ ] Fetch ingredients from `GET /api/ingredients` on mount
  - [ ] Autocomplete search by ingredient name
  - [ ] Qty input + unit dropdown (pre-filled from ingredient data)
  - [ ] Add button → leftover chips grouped by category
  - [ ] Remove button on each chip
  - [ ] "No leftovers" shortcut button
- [ ] **Verify**: Type "pan" → autocomplete shows Paneer → add with qty → chip appears under Dairy → Next goes to Screen 2

### Milestone 7: Screen 2 — Week Preferences
- [ ] `src/components/WeekPreferences.jsx`:
  - [ ] Mon–Sat toggle buttons to skip full days
  - [ ] Click skipped day → checkboxes to skip individual meals (breakfast/lunch/dinner)
  - [ ] Special requests: free text + Add → removable tags
  - [ ] Chicken count stepper (default 2)
  - [ ] Summary card: "Planning for X days, Y meals, Z chicken dishes, N leftovers"
- [ ] Back preserves Screen 1 state, Next goes to Screen 3
- [ ] **Verify**: Skip Saturday dinner → summary updates → Back → leftovers preserved → Next → Screen 3

### Milestone 8: Screen 3 — Meal Grid with Drag & Drop
- [ ] Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- [ ] `src/components/MealGrid.jsx`:
  - [ ] Grid: rows = [Breakfast, Lunch, Dinner, Fruit], columns = Mon–Sat
  - [ ] Each cell = Droppable, each MealCard = Draggable
  - [ ] Right sidebar: "Suggestions Tray" with draggable meal cards
  - [ ] On mount: call `POST /api/suggest/plan` → populate grid
  - [ ] Async: also call `POST /api/ai/generate-plan` → "Use AI suggestion" button if it returns
  - [ ] Drag between cells = swap, drag from tray = replace, drag to 🗑️ zone = remove
  - [ ] Skipped days greyed out, chicken meals warm accent
- [ ] `src/components/MealCard.jsx`:
  - [ ] Meal name, type icon (🥬/🥚/🍗), base label
  - [ ] × remove, 🔄 swap, +/- qty adjuster
- [ ] `src/components/SwapModal.jsx`:
  - [ ] Triggered by 🔄 button
  - [ ] Calls `POST /api/suggest/swap` + `POST /api/ai/swap-suggestions`
  - [ ] Shows combined list with name, type, AI reasoning
  - [ ] Click to replace
- [ ] **Verify**: Grid populates, drag lunch Mon→Tue swaps, 🔄 opens modal with suggestions, × removes meal

### Milestone 9: Outputs — Weekly Chart & Grocery List
- [ ] `src/components/WeeklyChart.jsx`:
  - [ ] Formatted text matching PDF style (day headers, meal labels, quantities)
  - [ ] "Copy Day" per day, "Copy Full Week" button
  - [ ] navigator.clipboard.writeText + "Copied!" toast
- [ ] `src/components/GroceryList.jsx`:
  - [ ] Calls `POST /api/groceries/generate` when plan changes
  - [ ] Grouped by category with emoji headers (🥬🥛🍗🏪🍞📦🍎)
  - [ ] Leftover items shown struck-through with "(from leftovers)"
  - [ ] "Copy Grocery List" button
  - [ ] "Optimize with AI" button → shows Claude suggestions
- [ ] "Finalize Week" button: calls `POST /api/planner/finalize` → saves to history → resets to Screen 1
- [ ] **Verify**: Copy Full Week → paste in editor → correct format. Grocery list grouped. Finalize → history.json updated.

### Milestone 10: Polish & Edge Cases
- [ ] Toast notifications (red errors, green success)
- [ ] Claude API failure → silent fallback to rule-based
- [ ] Loading spinners on API calls
- [ ] Empty states: "Drop a meal here" dashed cells, "All meals planned!" in tray
- [ ] Validation: block finalize if lunch/dinner slots empty, warn if chicken count off
- [ ] Responsive: horizontal scroll on mobile grid, full-width modal on mobile
- [ ] Keyboard: Escape closes modal, Enter triggers search
- [ ] Auto-save current-week.json on plan changes (debounced 2s)
- [ ] On load: if current-week.json has plan → "Resume?" or "Start fresh" prompt
- [ ] "Manage Meals" modal: view all master meals, add new meal → writes to master-meals.json
- [ ] **Verify**: Resume works after browser close. Finalize with empty slots warns. Mobile layout scrolls.

## Project Overview

Weekly meal planner for a 2-person North Indian household. Local-first app with React frontend, Node.js/Express backend, local JSON file storage, and Claude AI for smart suggestions.

## Tech Stack

- **Frontend**: React (Vite), @dnd-kit/core for drag-and-drop, Tailwind CSS
- **Backend**: Node.js, Express (port 3001)
- **Storage**: Local JSON files in `/data` directory — no database
- **AI**: Claude API (Sonnet) via @anthropic-ai/sdk
- **API Key**: Stored in `.env` as `ANTHROPIC_API_KEY`

## Project Structure

```
meal-planner/
├── data/                        # JSON storage (DO NOT delete seed data)
│   ├── master-meals.json        # 9 breakfasts, 22 meals, 6 fruits with ingredient mappings
│   ├── ingredients.json         # 39 ingredients with categories, purchase units, shelf life
│   ├── history.json             # 10 weeks of actual meal history (Oct 2025 – Mar 2026)
│   ├── config.json              # Household rules, AI config, grocery defaults
│   └── current-week.json        # Active week plan template
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
│   ├── App.jsx                  # 3-step wizard: Leftovers → Preferences → Grid
│   └── components/
│       ├── LeftoverInput.jsx    # Screen 1: autocomplete ingredient search, qty input
│       ├── WeekPreferences.jsx  # Screen 2: skip days, special requests, chicken count
│       ├── MealGrid.jsx         # Screen 3: drag-and-drop weekly grid
│       ├── MealCard.jsx         # Draggable meal tile with swap/remove/qty buttons
│       ├── SwapModal.jsx        # Modal with rule-based + AI swap suggestions
│       ├── GroceryList.jsx      # Categorized grocery output with copy button
│       └── WeeklyChart.jsx      # Copyable day-wise meal text
├── .env                         # ANTHROPIC_API_KEY=sk-ant-...
├── .env.example
└── package.json
```

## Commands

- `npm run dev` — starts both frontend (Vite, port 3000) and backend (Express, port 3001) concurrently
- `npm run server` — backend only
- `npm run client` — frontend only

## Data Model — Key Rules

- **Servings**: All quantities are total for 2 people (not per person)
- **Meal slots**: Breakfast, Lunch, Dinner, Fruit — 4 rows in the grid
- **Plan days**: Monday through Saturday (6 days)
- **Breakfast**: Auto-suggested from a rotation of 9 options, user can override via drag-and-drop
- **Lunch/Dinner**: Flexible — same meal can go in either slot. 22 meals in master list
- **Chicken**: Target 2 dishes per week (configurable in config.json)
- **No-repeat rule**: Don't repeat meals from the last 2 weeks (reads history.json)
- **Within-week uniqueness**: No same meal twice in a single week
- **Fruits**: Shown as a separate row in the meal grid, 1-2 per day, 6 fruits available
- **Grocery calculation**: Dynamically calculated from planned meals, subtract leftovers, round up to purchase units, group by category

## Data File Formats

### master-meals.json
- `meta`: servings, cuisine, chickenPerWeek
- `breakfasts[]`: id (bf-XX), name, defaultQty, unit, accompaniment, ingredients[]
- `meals[]`: id (meal-XX), name, type (veg/egg/chicken), slot (flexible/dinner), base (rice/paratha/roti/pav/noodles), ingredients[]
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

## Claude API Usage Points

1. **Plan generation**: Send master meals + leftovers + preferences + last 2 weeks → get full week plan as JSON
2. **Swap suggestions**: Send current slot context → get 5 alternatives with reasoning
3. **Grocery optimization**: Send grocery list → get bulk buy tips, missing staples, skip suggestions
4. Always fall back to rule-based engine if API fails

## UI Flow

```
Screen 1 (LeftoverInput) → Screen 2 (WeekPreferences) → Screen 3 (MealGrid + Outputs)
```

Screen 3 contains:
- Drag-and-drop meal grid (main interaction)
- Suggestion tray sidebar (draggable source)
- SwapModal (triggered per cell)
- WeeklyChart (copyable text output below grid)
- GroceryList (categorized, copyable, below grid)
- "Finalize Week" button (saves to history, resets)

## Style Guide

- Tailwind CSS, warm color palette (food app feel)
- Meal type indicators: 🥬 veg, 🥚 egg, 🍗 chicken
- Chicken meals get a subtle warm accent highlight in the grid
- Skipped days are greyed out
- Drag targets show dashed border highlight
- Responsive: grid scrolls horizontally on mobile

## Important Constraints

- All file I/O goes through `fileStore.js` — never read/write JSON directly in routes
- Never modify the seed data files structure — only append/update values
- API key must never be exposed to the frontend — all Claude calls go through `/api/ai/*` routes
- Auto-save current-week.json on every plan change (debounced 2s)
- On app load, if current-week.json has existing plan, prompt "Resume?" or "Start fresh"