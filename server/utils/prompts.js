const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatMealList(masterMeals) {
  const breakfasts = masterMeals.breakfasts
    .map((b) => `  ${b.id}: ${b.name}`)
    .join('\n');
  const meals = masterMeals.meals
    .map((m) => `  ${m.id}: ${m.name} [${m.type}, ${m.base}-based]`)
    .join('\n');
  const fruits = masterMeals.fruits
    .map((f) => `  ${f.id}: ${f.name}`)
    .join('\n');
  const drinks = (masterMeals.drinks || [])
    .map((d) => `  ${d.id}: ${d.name}`)
    .join('\n');
  return `Breakfasts:\n${breakfasts}\n\nDrinks:\n${drinks}\n\nLunch/Dinner meals:\n${meals}\n\nFruits:\n${fruits}`;
}

function formatLeftovers(leftovers) {
  if (!leftovers || leftovers.length === 0) return 'None';
  return leftovers.map((l) => `${l.ingredientId}: ${l.qty} ${l.unit}`).join(', ');
}

function formatPreferences(preferences) {
  const parts = [];
  if (preferences.skipDays?.length > 0) {
    parts.push(`Skip days: ${preferences.skipDays.join(', ')}`);
  }
  if (preferences.skipMeals?.length > 0) {
    parts.push(
      `Skip meals: ${preferences.skipMeals.map((s) => `${s.day} ${s.mealType}`).join(', ')}`
    );
  }
  if (preferences.specialRequests?.length > 0) {
    parts.push(`Special requests: ${preferences.specialRequests.join('; ')}`);
  }
  return parts.length > 0 ? parts.join('\n') : 'None';
}

function formatHistory(history) {
  if (!history || !history.weeks || history.weeks.length === 0) return 'No history';
  const recent = history.weeks.slice(-2);
  return recent
    .map((week) => {
      const days = Object.entries(week.days)
        .map(([day, meals]) => `  ${day}: L=${meals.lunch || 'none'}, D=${meals.dinner || 'none'}`)
        .join('\n');
      return `Week ${week.weekStart}:\n${days}`;
    })
    .join('\n\n');
}

export function buildPlanPrompt(masterMeals, leftovers, preferences, history) {
  const chickenCount = preferences.chickenCount || 2;

  return `You are an expert meal planner for a 2-person North Indian household. Generate a thoughtful weekly meal plan (Monday–Saturday) that feels curated, not random.

Available meals (use ONLY these IDs):
${formatMealList(masterMeals)}

Pantry leftovers to prioritize: ${formatLeftovers(leftovers)}

User preferences:
${formatPreferences(preferences)}

Recent history (AVOID repeating these):
${formatHistory(history)}

Planning rules:
1. Use ONLY meal IDs from the list above — do not invent IDs
2. Exactly ${chickenCount} chicken dishes total across the week
3. NEVER repeat the same meal ID twice in the same week
4. AVOID meals used in the last 2 weeks history above
5. If leftovers are available, choose meals that use those ingredients first
6. Alternate bases for variety: don't have 3 rice-based meals in a row; mix rice, roti, paratha, pav, noodles
7. Lighter meals (egg/breakfast-style) work well for weeknight dinners
8. Each day needs: 1 breakfast, 1 lunch, 1 dinner, and 1-2 fruits
9. Set skipped days/meals to null based on preferences above

Respond with ONLY valid JSON, no explanation:
{
  "Monday": { "breakfast": "bf-XX", "lunch": "meal-XX", "dinner": "meal-XX", "fruit": ["fruit-XX"] },
  "Tuesday": { "breakfast": "bf-XX", "lunch": "meal-XX", "dinner": "meal-XX", "fruit": ["fruit-XX"] },
  "Wednesday": { "breakfast": "bf-XX", "lunch": "meal-XX", "dinner": "meal-XX", "fruit": ["fruit-XX", "fruit-XX"] },
  "Thursday": { "breakfast": "bf-XX", "lunch": "meal-XX", "dinner": "meal-XX", "fruit": ["fruit-XX"] },
  "Friday": { "breakfast": "bf-XX", "lunch": "meal-XX", "dinner": "meal-XX", "fruit": ["fruit-XX"] },
  "Saturday": { "breakfast": "bf-XX", "lunch": "meal-XX", "dinner": "meal-XX", "fruit": ["fruit-XX", "fruit-XX"] }
}`;
}

export function buildSwapPrompt(day, mealType, currentPlan, masterMeals, reason) {
  const usedThisWeek = new Set();
  for (const d of DAYS) {
    if (!currentPlan[d]) continue;
    const bfIds = Array.isArray(currentPlan[d].breakfast) ? currentPlan[d].breakfast : (currentPlan[d].breakfast ? [currentPlan[d].breakfast] : []);
    for (const id of bfIds) usedThisWeek.add(id);
    const drinkIds = Array.isArray(currentPlan[d].drinks) ? currentPlan[d].drinks : (currentPlan[d].drinks ? [currentPlan[d].drinks] : []);
    for (const id of drinkIds) usedThisWeek.add(id);
    if (currentPlan[d].lunch) usedThisWeek.add(currentPlan[d].lunch);
    if (currentPlan[d].dinner) usedThisWeek.add(currentPlan[d].dinner);
    for (const f of currentPlan[d].fruit || []) usedThisWeek.add(f);
  }

  // Type-specific: send the right pool based on mealType
  let available;
  let currentMealId;
  let currentMeal;

  if (mealType === 'breakfast') {
    currentMealId = Array.isArray(currentPlan[day]?.breakfast) ? currentPlan[day].breakfast[0] : currentPlan[day]?.breakfast;
    currentMeal = currentMealId ? masterMeals.breakfasts.find((b) => b.id === currentMealId) : null;
    available = masterMeals.breakfasts
      .filter((b) => !usedThisWeek.has(b.id) || b.id === currentMealId)
      .map((b) => `${b.id}: ${b.name}`)
      .join('\n  ');
  } else if (mealType === 'drinks') {
    currentMealId = Array.isArray(currentPlan[day]?.drinks) ? currentPlan[day].drinks[0] : currentPlan[day]?.drinks;
    currentMeal = currentMealId ? (masterMeals.drinks || []).find((d) => d.id === currentMealId) : null;
    available = (masterMeals.drinks || [])
      .filter((d) => !usedThisWeek.has(d.id) || d.id === currentMealId)
      .map((d) => `${d.id}: ${d.name}`)
      .join('\n  ');
  } else if (mealType === 'fruit') {
    currentMealId = currentPlan[day]?.fruit?.[0];
    currentMeal = currentMealId ? masterMeals.fruits.find((f) => f.id === currentMealId) : null;
    available = masterMeals.fruits
      .filter((f) => !usedThisWeek.has(f.id) || f.id === currentMealId)
      .map((f) => `${f.id}: ${f.name}`)
      .join('\n  ');
  } else {
    // lunch or dinner
    currentMealId = currentPlan[day]?.[mealType];
    currentMeal = currentMealId ? masterMeals.meals.find((m) => m.id === currentMealId) : null;
    available = masterMeals.meals
      .filter((m) => !usedThisWeek.has(m.id) || m.id === currentMealId)
      .filter((m) => {
        if (m.slot === 'dinner' && mealType !== 'dinner') return false;
        return true;
      })
      .map((m) => `${m.id}: ${m.name} [${m.type}, ${m.base}]`)
      .join('\n  ');
  }

  const idPrefix = mealType === 'breakfast' ? 'bf-XX' : mealType === 'drinks' ? 'drink-XX' : mealType === 'fruit' ? 'fruit-XX' : 'meal-XX';

  return `You are a meal planner for a 2-person North Indian household.

Current ${mealType} on ${day}: ${currentMeal ? `${currentMeal.name} (${currentMealId})` : 'empty'}
${reason ? `Reason for swap: ${reason}` : ''}

Available alternatives (not already used this week):
  ${available}

Suggest up to 5 alternative ${mealType === 'breakfast' ? 'breakfast' : mealType === 'drinks' ? 'drink' : mealType === 'fruit' ? 'fruit' : 'meal'} options for ${day} ${mealType}. For each, give a brief reason why it's a good choice.

Respond with ONLY a JSON array, no other text:
[
  { "mealId": "${idPrefix}", "name": "Name", "reason": "brief reason" },
  ...
]`;
}

export function buildGroceryOptimizePrompt(groceryList, plan) {
  const items = groceryList.categories
    .map(
      (cat) =>
        `${cat.name}:\n` +
        cat.items.map((i) => `  ${i.name}: ${i.qty} ${i.unit}`).join('\n')
    )
    .join('\n\n');

  return `You are a grocery shopping advisor for a 2-person North Indian household planning meals for one week (Mon-Sat, 2 people).

Here is the grocery list for the week:
${items}

Review this list and provide TWO things:

1. "suggestions": General advice — bulk buy opportunities, missing staples, items to skip.

2. "fixes": Correct any nonsensical quantities. Common sense rules:
   - Mushroom should be in grams (typically 200g), NOT packets
   - Fresh coriander/dhaniya should always be 1 bunch
   - Cabbage should be 1 nos (whole), not 100
   - Onions, tomatoes, potatoes: reasonable amounts in kg for 2 people
   - Paneer: typically 200g-400g, not tiny amounts
   - Spice powders: small amounts in grams (50-100g)
   - If a quantity seems unreasonably high or low for 2 people for a week, fix it

Respond with ONLY a JSON object, no other text:
{
  "suggestions": ["suggestion 1", "suggestion 2"],
  "fixes": [
    { "name": "item name", "qty": correctedQty, "unit": "correctedUnit" },
    ...
  ]
}

If no fixes are needed, return an empty fixes array.`;
}
