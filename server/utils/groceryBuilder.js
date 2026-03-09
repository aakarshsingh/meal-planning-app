import { readJSON } from './fileStore.js';

const CATEGORY_ORDER = ['vegetable', 'dairy', 'protein', 'staple', 'bakery', 'ready-mix', 'spice', 'fruit'];

// Unit conversion: normalize to base units (g, ml) for consistent aggregation
function toGrams(qty, unit) {
  if (unit === 'kg') return qty * 1000;
  if (unit === 'g') return qty;
  return null; // not a weight unit
}

function toMl(qty, unit) {
  if (unit === 'l') return qty * 1000;
  if (unit === 'ml') return qty;
  return null; // not a volume unit
}

// Convert aggregated base-unit qty to purchase unit
function toPurchaseUnit(qty, recipeUnit, purchaseUnit) {
  // Weight conversions
  if (recipeUnit === 'g' && purchaseUnit === 'kg') return qty / 1000;
  if (recipeUnit === 'kg' && purchaseUnit === 'g') return qty * 1000;
  // Volume conversions
  if (recipeUnit === 'ml' && purchaseUnit === 'l') return qty / 1000;
  if (recipeUnit === 'l' && purchaseUnit === 'ml') return qty * 1000;
  // Same unit or non-convertible (nos, pk, bunch, etc.)
  return qty;
}

function findMealById(masterMeals, mealId) {
  return (
    masterMeals.breakfasts.find((b) => b.id === mealId) ||
    masterMeals.meals.find((m) => m.id === mealId) ||
    (masterMeals.drinks || []).find((d) => d.id === mealId) ||
    masterMeals.fruits.find((f) => f.id === mealId) ||
    (masterMeals.sides || []).find((s) => s.id === mealId)
  );
}

function aggregateIngredients(plan, masterMeals, sideOverrides = {}) {
  const totals = {}; // ingredientId -> { qty, unit }

  for (const [dayName, day] of Object.entries(plan)) {
    // Breakfast can be array or string
    const breakfastIds = Array.isArray(day.breakfast) ? day.breakfast : [day.breakfast];
    const drinkIds = Array.isArray(day.drinks) ? day.drinks : (day.drinks ? [day.drinks] : []);
    // Track which slot each mealId came from for side override lookup
    const slotMeals = [
      ...breakfastIds.map((id) => ({ id, slot: 'breakfast' })),
      ...drinkIds.map((id) => ({ id, slot: 'drinks' })),
      { id: day.lunch, slot: 'lunch' },
      { id: day.dinner, slot: 'dinner' },
    ].filter((s) => s.id);

    for (const { id: mealId, slot } of slotMeals) {
      const meal = findMealById(masterMeals, mealId);
      if (!meal || !meal.ingredients) continue;

      // Determine effective side: check override first, then fall back to suggestedSide
      const slotKey = `${dayName}-${slot}`;
      const overriddenSide = sideOverrides[slotKey];
      const effectiveSideId = overriddenSide !== undefined ? overriddenSide : meal.suggestedSide;

      const sideIngs = [];
      if (effectiveSideId && masterMeals.sides) {
        const side = masterMeals.sides.find((s) => s.id === effectiveSideId);
        if (side?.ingredients) sideIngs.push(...side.ingredients);
      }

      for (const ing of [...meal.ingredients, ...sideIngs]) {
        if (!totals[ing.ingredientId]) {
          totals[ing.ingredientId] = { qty: 0, unit: ing.unit };
        }
        // Normalize to same unit before summing
        const existingUnit = totals[ing.ingredientId].unit;
        if (ing.unit === existingUnit) {
          totals[ing.ingredientId].qty += ing.qty;
        } else {
          // Try converting to existing unit
          const gExisting = toGrams(totals[ing.ingredientId].qty, existingUnit);
          const gNew = toGrams(ing.qty, ing.unit);
          if (gExisting !== null && gNew !== null) {
            totals[ing.ingredientId] = { qty: gExisting + gNew, unit: 'g' };
          } else {
            const mlExisting = toMl(totals[ing.ingredientId].qty, existingUnit);
            const mlNew = toMl(ing.qty, ing.unit);
            if (mlExisting !== null && mlNew !== null) {
              totals[ing.ingredientId] = { qty: mlExisting + mlNew, unit: 'ml' };
            } else {
              // Can't convert, just add raw
              totals[ing.ingredientId].qty += ing.qty;
            }
          }
        }
      }
    }

    // Fruits — they are the items themselves
    if (day.fruit && day.fruit.length > 0) {
      for (const fruitId of day.fruit) {
        const fruit = masterMeals.fruits.find((f) => f.id === fruitId);
        if (!fruit) continue;
        if (!totals[fruitId]) {
          totals[fruitId] = { qty: 0, unit: fruit.unit };
        }
        totals[fruitId].qty += fruit.defaultQty;
      }
    }
  }

  return totals;
}

function subtractLeftovers(totals, leftovers) {
  for (const leftover of leftovers) {
    if (totals[leftover.ingredientId]) {
      const totalUnit = totals[leftover.ingredientId].unit;
      const leftoverUnit = leftover.unit || totalUnit;
      // Convert leftover to total's unit before subtracting
      let leftoverQty = leftover.qty;
      if (leftoverUnit !== totalUnit) {
        leftoverQty = toPurchaseUnit(leftover.qty, leftoverUnit, totalUnit);
      }
      totals[leftover.ingredientId].qty -= leftoverQty;
      totals[leftover.ingredientId].leftover = leftoverQty;
    }
  }
  return totals;
}

function roundUpToPurchaseUnit(needed, purchaseQty) {
  if (needed <= 0) return 0;
  return Math.ceil(needed / purchaseQty) * purchaseQty;
}

export async function buildGroceryList(plan, leftovers = [], sideOverrides = {}) {
  const masterMeals = await readJSON('master-meals.json');
  const ingredientsData = await readJSON('ingredients.json');
  const config = await readJSON('config.json');

  const ingredientMap = {};
  for (const ing of ingredientsData.ingredients) {
    ingredientMap[ing.id] = ing;
  }

  // Also map fruits as pseudo-ingredients for the grocery list
  for (const fruit of masterMeals.fruits) {
    if (!ingredientMap[fruit.id]) {
      ingredientMap[fruit.id] = {
        id: fruit.id,
        name: fruit.name,
        category: 'fruit',
        purchaseUnit: fruit.unit,
        purchaseQty: fruit.defaultQty,
        shelfLifeDays: 7,
      };
    }
  }

  // Aggregate all ingredients from planned meals
  const totals = aggregateIngredients(plan, masterMeals, sideOverrides);

  // Always include defaults from config
  const alwaysInclude = config.groceryDefaults.alwaysInclude || [];
  for (const ingId of alwaysInclude) {
    if (!totals[ingId]) {
      const ing = ingredientMap[ingId];
      if (ing) {
        totals[ingId] = { qty: ing.purchaseQty, unit: ing.purchaseUnit };
      }
    }
  }

  // Subtract leftovers
  subtractLeftovers(totals, leftovers);

  // Build items grouped by category
  const categoryMap = {};

  for (const [ingId, { qty: rawQty, unit: recipeUnit, leftover }] of Object.entries(totals)) {
    const ing = ingredientMap[ingId];
    if (!ing) continue;

    // Convert from recipe unit (g/ml) to purchase unit (kg/l) before rounding
    const convertedQty = toPurchaseUnit(rawQty, recipeUnit, ing.purchaseUnit);
    const needed = Math.max(0, convertedQty);

    // Skip alwaysInStock items unless plan needs significantly more than 1 purchase unit
    if (ing.alwaysInStock && needed <= ing.purchaseQty && !alwaysInclude.includes(ingId)) {
      continue;
    }

    const purchaseQty = roundUpToPurchaseUnit(needed, ing.purchaseQty);
    if (purchaseQty <= 0 && !alwaysInclude.includes(ingId)) continue;

    const category = ing.category || 'other';
    if (!categoryMap[category]) {
      categoryMap[category] = [];
    }

    // Convert leftover to purchase unit for display
    const leftoverDisplay = leftover ? toPurchaseUnit(leftover, recipeUnit, ing.purchaseUnit) : 0;

    categoryMap[category].push({
      id: ingId,
      name: ing.name,
      qty: purchaseQty || ing.purchaseQty,
      unit: ing.purchaseUnit,
      needed: Math.max(0, convertedQty),
      leftover: leftoverDisplay,
    });
  }

  // Sort categories by defined order, build output
  const categories = CATEGORY_ORDER
    .filter((cat) => categoryMap[cat] && categoryMap[cat].length > 0)
    .map((cat) => ({
      name: cat,
      items: categoryMap[cat].sort((a, b) => a.name.localeCompare(b.name)),
    }));

  // Add any categories not in the predefined order
  for (const cat of Object.keys(categoryMap)) {
    if (!CATEGORY_ORDER.includes(cat) && categoryMap[cat].length > 0) {
      categories.push({
        name: cat,
        items: categoryMap[cat].sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
  }

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);

  return { categories, totalItems };
}
