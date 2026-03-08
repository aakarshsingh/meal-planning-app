import { readJSON } from './fileStore.js';

const CATEGORY_ORDER = ['vegetable', 'dairy', 'protein', 'staple', 'bakery', 'ready-mix', 'spice', 'fruit'];

function findMealById(masterMeals, mealId) {
  return (
    masterMeals.breakfasts.find((b) => b.id === mealId) ||
    masterMeals.meals.find((m) => m.id === mealId) ||
    masterMeals.fruits.find((f) => f.id === mealId)
  );
}

function aggregateIngredients(plan, masterMeals) {
  const totals = {}; // ingredientId -> { qty, unit }

  for (const day of Object.values(plan)) {
    const mealIds = [day.breakfast, day.lunch, day.dinner].filter(Boolean);

    for (const mealId of mealIds) {
      const meal = findMealById(masterMeals, mealId);
      if (!meal || !meal.ingredients) continue;

      for (const ing of meal.ingredients) {
        if (!totals[ing.ingredientId]) {
          totals[ing.ingredientId] = { qty: 0, unit: ing.unit };
        }
        totals[ing.ingredientId].qty += ing.qty;
      }
    }

    // Fruits don't have ingredient refs in the same way — they are the items themselves
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
      totals[leftover.ingredientId].qty -= leftover.qty;
      totals[leftover.ingredientId].leftover = leftover.qty;
    }
  }
  return totals;
}

function roundUpToPurchaseUnit(needed, purchaseQty) {
  if (needed <= 0) return 0;
  return Math.ceil(needed / purchaseQty) * purchaseQty;
}

export async function buildGroceryList(plan, leftovers = []) {
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
  const totals = aggregateIngredients(plan, masterMeals);

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

  for (const [ingId, { qty: rawQty, unit, leftover }] of Object.entries(totals)) {
    const ing = ingredientMap[ingId];
    if (!ing) continue;

    const needed = Math.max(0, rawQty);

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

    categoryMap[category].push({
      id: ingId,
      name: ing.name,
      qty: purchaseQty || ing.purchaseQty,
      unit: ing.purchaseUnit,
      needed: Math.max(0, rawQty),
      leftover: leftover || 0,
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
