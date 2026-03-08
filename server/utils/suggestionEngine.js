import { readJSON } from './fileStore.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getLeftoverIngredientIds(leftovers) {
  return new Set(leftovers.map((l) => l.ingredientId));
}

function getMealIngredientIds(meal) {
  return (meal.ingredients || []).map((i) => i.ingredientId);
}

function usesLeftover(meal, leftoverIds) {
  return getMealIngredientIds(meal).some((id) => leftoverIds.has(id));
}

function countLeftoverOverlap(meal, leftoverIds) {
  return getMealIngredientIds(meal).filter((id) => leftoverIds.has(id)).length;
}

function getRecentMealIds(history, weeksBack) {
  const recentWeeks = history.weeks.slice(-weeksBack);
  const usedIds = new Set();
  for (const week of recentWeeks) {
    for (const day of Object.values(week.days)) {
      // Handle breakfast as array or string (backward compat with history)
      const bfIds = Array.isArray(day.breakfast) ? day.breakfast : (day.breakfast ? [day.breakfast] : []);
      for (const id of bfIds) usedIds.add(id);
      if (day.lunch) usedIds.add(day.lunch);
      if (day.dinner) usedIds.add(day.dinner);
    }
  }
  return usedIds;
}

function getRecentFruitIds(history, weeksBack) {
  const recentWeeks = history.weeks.slice(-weeksBack);
  const usedIds = new Set();
  for (const week of recentWeeks) {
    for (const day of Object.values(week.days)) {
      if (day.fruit) {
        for (const f of day.fruit) usedIds.add(f);
      }
    }
  }
  return usedIds;
}

function getCurrentWeekMealIds(plan) {
  const used = new Set();
  for (const day of DAYS) {
    if (!plan[day]) continue;
    const bfIds = Array.isArray(plan[day].breakfast) ? plan[day].breakfast : (plan[day].breakfast ? [plan[day].breakfast] : []);
    for (const id of bfIds) used.add(id);
    if (plan[day].lunch) used.add(plan[day].lunch);
    if (plan[day].dinner) used.add(plan[day].dinner);
  }
  return used;
}

function scoreMeal(meal, leftoverIds, currentWeekIds, lastBase) {
  let score = 0;
  // +3 per leftover ingredient used
  score += countLeftoverOverlap(meal, leftoverIds) * 3;
  // +1 for base alternation
  if (lastBase && meal.base !== lastBase) score += 1;
  // -10 if already used this week
  if (currentWeekIds.has(meal.id)) score -= 10;
  return score;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickBreakfasts(breakfasts, activeDays, leftovers, preferences) {
  const leftoverIds = getLeftoverIngredientIds(leftovers);
  const result = {};

  // Sort by leftover usage (prefer those using leftovers)
  const sorted = [...breakfasts].sort((a, b) => {
    const aScore = countLeftoverOverlap(a, leftoverIds);
    const bScore = countLeftoverOverlap(b, leftoverIds);
    return bScore - aScore;
  });

  // Build a rotation pool — leftover-using ones first, then rest shuffled
  const usingLeftovers = sorted.filter((b) => usesLeftover(b, leftoverIds));
  const rest = shuffle(sorted.filter((b) => !usesLeftover(b, leftoverIds)));
  const pool = [...usingLeftovers, ...rest];

  let lastBfId = null;
  let poolIdx = 0;

  for (const day of activeDays) {
    const skipMeals = preferences.skipMeals || [];
    if (skipMeals.some((s) => s.day === day && s.mealType === 'breakfast')) {
      result[day] = [];
      continue;
    }

    // Find next breakfast that isn't the same as last
    let chosen = null;
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[(poolIdx + i) % pool.length];
      if (candidate.id !== lastBfId || pool.length === 1) {
        chosen = candidate;
        poolIdx = (poolIdx + i + 1) % pool.length;
        break;
      }
    }
    result[day] = chosen ? [chosen.id] : [pool[0].id];
    lastBfId = chosen ? chosen.id : pool[0].id;
  }

  return result;
}

function pickMeals(allMeals, activeDays, leftovers, preferences, history, config) {
  const leftoverIds = getLeftoverIngredientIds(leftovers);
  const noRepeatWeeks = config.rules.noRepeatWithinWeeks || 3;
  const chickenTarget = config.rules.chickenPerWeek || 2;
  const recentIds = getRecentMealIds(history, noRepeatWeeks);

  // Prefer non-recent meals, but fall back to all if not enough
  const fresh = allMeals.filter((m) => !recentIds.has(m.id));
  const stale = allMeals.filter((m) => recentIds.has(m.id));

  // Chicken: prefer fresh, fall back to stale
  const freshChicken = shuffle(fresh.filter((m) => m.type === 'chicken'));
  const staleChicken = shuffle(stale.filter((m) => m.type === 'chicken'));
  const chickenMeals = [...freshChicken, ...staleChicken];

  // Veg/Egg: prefer fresh, fall back to stale
  const freshVegEgg = shuffle(fresh.filter((m) => m.type !== 'chicken'));
  const staleVegEgg = shuffle(stale.filter((m) => m.type !== 'chicken'));
  const vegEggMeals = [...freshVegEgg, ...staleVegEgg];

  // Build slots to fill: each active day needs lunch + dinner (minus skipped)
  const skipMeals = preferences.skipMeals || [];
  const slots = [];
  for (const day of activeDays) {
    for (const mealType of ['lunch', 'dinner']) {
      if (!skipMeals.some((s) => s.day === day && s.mealType === mealType)) {
        slots.push({ day, mealType });
      }
    }
  }

  const plan = {};
  for (const day of DAYS) {
    plan[day] = { lunch: null, dinner: null };
  }

  const usedThisWeek = new Set();
  let chickenCount = 0;
  let lastBase = null;

  // First pass: place chicken meals
  const chickenSlots = shuffle([...slots]);
  for (const slot of chickenSlots) {
    if (chickenCount >= chickenTarget) break;
    if (plan[slot.day].lunch || plan[slot.day].dinner) {
      // Don't put two chicken in same day if possible
      const otherSlot = slot.mealType === 'lunch' ? 'dinner' : 'lunch';
      const otherId = plan[slot.day][otherSlot];
      if (otherId) {
        const otherMeal = allMeals.find((m) => m.id === otherId);
        if (otherMeal && otherMeal.type === 'chicken') continue;
      }
    }

    for (const cm of chickenMeals) {
      if (usedThisWeek.has(cm.id)) continue;
      // Check slot compatibility (dinner-only meals)
      if (cm.slot === 'dinner' && slot.mealType !== 'dinner') continue;
      plan[slot.day][slot.mealType] = cm.id;
      usedThisWeek.add(cm.id);
      chickenCount++;
      lastBase = cm.base;
      break;
    }
  }

  // Second pass: fill remaining slots with veg/egg
  for (const slot of slots) {
    if (plan[slot.day][slot.mealType]) continue; // already filled

    // Score and sort candidates
    const scored = vegEggMeals
      .filter((m) => !usedThisWeek.has(m.id))
      .filter((m) => {
        if (m.slot === 'dinner' && slot.mealType !== 'dinner') return false;
        return true;
      })
      .map((m) => ({
        meal: m,
        score: scoreMeal(m, leftoverIds, usedThisWeek, lastBase),
      }))
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const chosen = scored[0].meal;
      plan[slot.day][slot.mealType] = chosen.id;
      usedThisWeek.add(chosen.id);
      lastBase = chosen.base;
    }
  }

  return plan;
}

function pickFruits(fruits, activeDays, preferences) {
  const skipMeals = preferences.skipMeals || [];
  const result = {};
  const pool = [...fruits];
  let lastFruitId = null;

  for (const day of activeDays) {
    if (skipMeals.some((s) => s.day === day && s.mealType === 'fruit')) {
      result[day] = [];
      continue;
    }

    // Pick 1-2 fruits, avoiding consecutive repeat
    const count = Math.random() < 0.5 ? 1 : 2;
    const dayFruits = [];

    for (let i = 0; i < count; i++) {
      const available = pool.filter(
        (f) => f.id !== lastFruitId && !dayFruits.includes(f.id)
      );
      if (available.length === 0) break;
      const pick = available[Math.floor(Math.random() * available.length)];
      dayFruits.push(pick.id);
      lastFruitId = pick.id;
    }

    result[day] = dayFruits;
  }

  return result;
}

export async function generateWeeklyPlan(leftovers = [], preferences = {}, historyData = null) {
  const masterMeals = await readJSON('master-meals.json');
  const config = await readJSON('config.json');
  const history = historyData || (await readJSON('history.json'));

  const skipDays = preferences.skipDays || [];
  const activeDays = DAYS.filter((d) => !skipDays.includes(d));

  // Generate each component
  const breakfasts = pickBreakfasts(masterMeals.breakfasts, activeDays, leftovers, preferences);
  const meals = pickMeals(masterMeals.meals, activeDays, leftovers, preferences, history, config);
  const fruits = pickFruits(masterMeals.fruits, activeDays, preferences);

  // Assemble plan
  const plan = {};
  for (const day of DAYS) {
    if (skipDays.includes(day)) {
      plan[day] = { breakfast: [], drinks: [], lunch: null, dinner: null, fruit: [] };
    } else {
      plan[day] = {
        breakfast: breakfasts[day] || [],
        drinks: ['drink-01'], // Default: Coffee
        lunch: meals[day]?.lunch || null,
        dinner: meals[day]?.dinner || null,
        fruit: fruits[day] || [],
      };
    }
  }

  return plan;
}

export async function getSuggestions(day, mealType, currentPlan = {}, historyData = null) {
  const masterMeals = await readJSON('master-meals.json');
  const config = await readJSON('config.json');
  const history = historyData || (await readJSON('history.json'));

  const noRepeatWeeks = config.rules.noRepeatWithinWeeks || 3;
  const recentIds = getRecentMealIds(history, noRepeatWeeks);
  const currentWeekIds = getCurrentWeekMealIds(currentPlan);

  if (mealType === 'breakfast') {
    const currentBfIds = Array.isArray(currentPlan[day]?.breakfast) ? currentPlan[day].breakfast : (currentPlan[day]?.breakfast ? [currentPlan[day].breakfast] : []);
    return masterMeals.breakfasts
      .filter((b) => !currentBfIds.includes(b.id))
      .slice(0, 5)
      .map((b) => ({ id: b.id, name: b.name, type: 'breakfast' }));
  }

  if (mealType === 'drinks') {
    const drinks = masterMeals.drinks || [];
    const currentDrinkIds = Array.isArray(currentPlan[day]?.drinks) ? currentPlan[day].drinks : [];
    return drinks
      .filter((d) => !currentDrinkIds.includes(d.id))
      .map((d) => ({ id: d.id, name: d.name, type: 'drink' }));
  }

  if (mealType === 'fruit') {
    const currentFruits = currentPlan[day]?.fruit || [];
    return masterMeals.fruits
      .filter((f) => !currentFruits.includes(f.id))
      .slice(0, 5)
      .map((f) => ({ id: f.id, name: f.name, type: 'fruit' }));
  }

  // Lunch/Dinner: score and rank (prefer non-recent, but include all)
  const currentMealId = currentPlan[day]?.[mealType];
  const leftoverIds = new Set(); // No leftover context in swap
  const candidates = masterMeals.meals
    .filter((m) => m.id !== currentMealId)
    .filter((m) => {
      if (m.slot === 'dinner' && mealType !== 'dinner') return false;
      return true;
    });

  // Determine last base from current plan for that day
  const otherSlot = mealType === 'lunch' ? 'dinner' : 'lunch';
  const otherMealId = currentPlan[day]?.[otherSlot];
  const otherMeal = otherMealId
    ? masterMeals.meals.find((m) => m.id === otherMealId)
    : null;
  const lastBase = otherMeal?.base || null;

  const scored = candidates
    .map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      base: m.base,
      score: scoreMeal(m, leftoverIds, currentWeekIds, lastBase) + (recentIds.has(m.id) ? -5 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5);
}
