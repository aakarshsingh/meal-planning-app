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

- **Master meal library** — 11 breakfasts, 22+ lunch/dinner meals, 2 side dishes, 6 fruits, 3 drinks seeded from ~6 months of real meal plans
- **Side dishes** — Optional sides (Yellow Dal, Raita) linked to meals via `suggestedSide`. Side ingredients auto-included in grocery calculation
- **Week selector** — Calendar dropdown in header, click any Monday to set the week
- **3-screen planning flow** — Pantry Stock → Preferences → Weekly grid
- **Drag-and-drop swapping** — Drag meals between days within the same row, plus lunch↔dinner swaps. AI indicators follow
- **Click-to-add meal grid** — HTML table layout, click empty slot to open modal with AI + rule-based + full list
- **Swap modal with 3 sections** — AI Suggestions, Rule-based Suggestions, Everything Else. Sticky search filters all sections
- **Building blocks** — Meals shown as "Main + Base" (e.g., "Palak Paneer + Roti"), base changeable per cell
- **No-base option** — Dishes like Biryani, Veg Pulao need no base accompaniment
- **Smart qty** — Qty +/- only for countable items (roti/paratha/pav, certain breakfasts like Bread, Chilla, Poori)
- **Qty/base persistence** — Changes survive Edit ↔ Review transitions, reflected in chart & grocery list
- **AI-enhanced planning** — AI suggestions auto-merged into grid, shown with purple "AI pick" indicators. Cached — no duplicate calls
- **Type-specific AI suggestions** — Breakfast slots get breakfast options, lunch/dinner get meal options
- **Base swap per cell** — Inline rice/roti/paratha/pav/none buttons
- **Unlimited breakfast items** — Add as many breakfasts, drinks per day as desired
- **Breakfast auto-rotation** with manual override via modal
- **Dual-category items** — Breakfast items can optionally be added to Mains too (e.g., Aloo Paratha). Per-category dedup allows same name across categories
- **Fruit row** in the grid (separate from meals), fruits searchable in pantry stock
- **Special requests as hard constraints** — Type "Have Poori on Saturday" or "Chicken Gravy on Wed and Fri, two different kinds" — both rule-based engine and AI enforce them exactly
- **Smart suggestions** — No repeats within the week, avoids last 2 weeks' history, uses leftovers first
- **Pre-optimized grocery list** — AI fixes quantities before display (Mushroom→200g, Coriander→1 bunch), bulk buy tips. Generated once per plan, persists through edits
- **Editable grocery items** — Pencil icon + click to edit qty/unit, remove with x button
- **Copyable outputs** — Day-wise meal chart + grocery list as WhatsApp-friendly text
- **History tracking** — Saves finalized weeks with full state: pantry stock, preferences (skip days, special requests), qty/base/side overrides, grocery edits, and AI suggestions
- **Edit past weeks** — History dropdown in header lists all finalized weeks. Click to load into the grid with all original state restored (leftovers, skipped days, preferences, grocery edits, AI suggestions). Re-finalize upserts, no duplicates
- **Add custom grocery items** — "+ Add Item" button on grocery list to add items not derived from meals (with name, qty, unit, category). Dismissible with close button
- **Manage Meals** — CRUD for all categories (Breakfasts, Drinks, Mains, Sides, Fruits). Inline edit with suggestedSide selector. Closes only on cross/ESC. Batch add support. New items reflect immediately in grid
- **Unskip slots on grid** — Skipped cells show X on hover to revive them for planning
- **Clickable step indicators** — Navigate back to Pantry Stock or Preferences anytime
- **No wasted API calls** — All AI state cached in App.jsx. Back to Edit → no re-call. All days skipped → noOp
- **Toast notifications** — Red errors, green success, yellow warnings
- **Auto-save & resume** — Plan auto-saves every 2s (incl. qty/base overrides); resume prompt on next visit
- **Responsive design** — Mobile grid scrolls horizontally, full-width modals

## Data Files

```
data/
├── master-meals.json    # Meal library: breakfasts, meals, sides, drinks, fruits with ingredients
├── ingredients.json     # 39 ingredients with categories, purchase units, shelf life
├── history.json         # 10 weeks of past meal plans (Oct 2025 – Mar 2026)
├── config.json          # Rules, preferences, AI config
└── current-week.json    # Active week's plan (working state, auto-saved)
```

## Screens

### Screen 1 — Pantry Stock
Autocomplete from ingredient master + fruits. Enter quantities of ingredients you have in stock. Supports fractions (1/2, 1 1/3) with quick-pick buttons for common units.

### Screen 2 — Week Preferences
- Day rows with inline breakfast/lunch/dinner skip checkboxes
- Clickable quick prompt chips: "No rice this week", "Light meals on weekdays", etc.
- Meat count stepper (default 2) — covers chicken, mutton, etc.
- Summary card with active days/meals/meat/pantry item counts

### Screen 3 — Meal Planner Grid
Weekly HTML table: Mon–Sat x Breakfast, Lunch, Dinner, Fruit.

- **Click empty slot** → SwapModal with 3 sections: AI, Suggestions, Everything Else
- **Drag-and-drop** — Drag any meal to another day's same row to swap, or swap lunch↔dinner (same/different day)
- **Swap button** on existing meals → same modal for replacement
- **Base swap** — Inline rice/roti/paratha/pav/none buttons per meal card
- **Meal titles** — "Main + Base" format (e.g., "Palak Paneer + Roti"), with side dish label if linked
- **Smart qty** — +/- buttons only for countable bases (roti/paratha/pav) and breakfasts (Bread, Chilla, Poori, etc.)
- **AI indicators** — Purple-bordered cells with "AI pick" label for AI-placed meals
- **Free text dish** — "Add & Use" input in SwapModal to create new meals on the fly
- **Review Plan** → Pre-optimized grocery list + weekly chart (with base/qty overrides) + finalize

### Output 1 — Weekly Meal Chart
Day-wise formatted text with base, qty, and side dish overrides. One-click copy per day or full week.

### Output 2 — Grocery List
Auto-generated and AI-optimized before display (includes side dish ingredients). Pencil edit icon per item. Per-item edit (qty/unit) and remove. "+ Add Item" for custom entries (with close button). Grouped by category. All edits saved to history and restored on history load.

### Finalize
Saves week to history with full state (leftovers, preferences, quantities, base/side overrides, grocery edits, AI suggestions), validates slots, resets for next week. Re-finalizing an edited history week updates the existing entry (upsert by week start date).

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
