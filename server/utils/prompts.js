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
  return `Breakfasts:\n${breakfasts}\n\nLunch/Dinner meals:\n${meals}\n\nFruits:\n${fruits}`;
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
  return `You are a meal planner for a 2-person North Indian household. Generate a weekly meal plan for Monday through Saturday.

Available meals:
${formatMealList(masterMeals)}

Leftovers to use first: ${formatLeftovers(leftovers)}

Preferences:
${formatPreferences(preferences)}

Last 2 weeks history (avoid repeating these meals):
${formatHistory(history)}

Rules:
- Exactly 2 chicken dishes per week, rest should be veg or egg
- Do NOT repeat any lunch/dinner meal from the last 2 weeks history
- No same meal twice within the same week
- Use leftovers first — prefer meals that use leftover ingredients
- Aim for 1 rice-based meal for every 2 roti/paratha-based meals for variety
- Each day needs: breakfast, lunch, dinner, and 1-2 fruits
- Skipped days/meals should be null
- Only use meal IDs from the available meals list above

Respond with ONLY a JSON object in this exact format, no other text:
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
  const currentMealId = currentPlan[day]?.[mealType];
  const currentMeal = currentMealId
    ? masterMeals.meals.find((m) => m.id === currentMealId) ||
      masterMeals.breakfasts.find((b) => b.id === currentMealId)
    : null;

  const usedThisWeek = new Set();
  for (const d of DAYS) {
    if (!currentPlan[d]) continue;
    if (currentPlan[d].lunch) usedThisWeek.add(currentPlan[d].lunch);
    if (currentPlan[d].dinner) usedThisWeek.add(currentPlan[d].dinner);
  }

  const available = masterMeals.meals
    .filter((m) => !usedThisWeek.has(m.id) || m.id === currentMealId)
    .filter((m) => {
      if (m.slot === 'dinner' && mealType !== 'dinner') return false;
      return true;
    })
    .map((m) => `${m.id}: ${m.name} [${m.type}, ${m.base}]`)
    .join('\n  ');

  return `You are a meal planner for a 2-person North Indian household.

Current ${mealType} on ${day}: ${currentMeal ? `${currentMeal.name} (${currentMealId})` : 'empty'}
${reason ? `Reason for swap: ${reason}` : ''}

Available alternatives (not already used this week):
  ${available}

Suggest exactly 5 alternative meals for ${day} ${mealType}. For each, give a brief reason why it's a good swap (variety, nutrition, base alternation, etc).

Respond with ONLY a JSON array, no other text:
[
  { "mealId": "meal-XX", "name": "Meal Name", "reason": "brief reason" },
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

  return `You are a grocery shopping advisor for a 2-person North Indian household.

Here is the grocery list for the week:
${items}

Review this list and provide:
1. Bulk buy opportunities (items that are cheaper in larger quantities)
2. Missing staples that a North Indian kitchen should always have
3. Items that could be skipped this week (already likely in stock or not essential)

Respond with ONLY a JSON object, no other text:
{
  "suggestions": [
    "suggestion 1",
    "suggestion 2",
    ...
  ]
}`;
}
