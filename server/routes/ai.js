import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { readJSON } from '../utils/fileStore.js';
import { generateWeeklyPlan } from '../utils/suggestionEngine.js';
import {
  buildPlanPrompt,
  buildSwapPrompt,
  buildGroceryOptimizePrompt,
} from '../utils/prompts.js';

const router = Router();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MODEL = 'claude-sonnet-4-20250514';

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }
  return new Anthropic();
}

function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/) || text.match(/(\[[\s\S]*\])/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    throw new Error('Could not extract JSON from response');
  }
}

function validatePlan(plan, masterMeals) {
  const validIds = new Set([
    ...masterMeals.breakfasts.map((b) => b.id),
    ...masterMeals.meals.map((m) => m.id),
    ...masterMeals.fruits.map((f) => f.id),
  ]);

  for (const day of DAYS) {
    if (!plan[day]) {
      plan[day] = { breakfast: null, lunch: null, dinner: null, fruit: [] };
      continue;
    }
    for (const slot of ['breakfast', 'lunch', 'dinner']) {
      if (plan[day][slot] && !validIds.has(plan[day][slot])) {
        plan[day][slot] = null;
      }
    }
    if (plan[day].fruit) {
      plan[day].fruit = plan[day].fruit.filter((id) => validIds.has(id));
    } else {
      plan[day].fruit = [];
    }
  }
  return plan;
}

// Check if all days/meals are skipped — return noOp
function isAllSkipped(preferences) {
  const { skipDays = [], skipMeals = [] } = preferences || {};
  const activeDays = DAYS.filter((d) => !skipDays.includes(d));
  if (activeDays.length === 0) return true;
  // Check if every active day has all 3 meals skipped
  return activeDays.every((day) => {
    const skippedMeals = skipMeals.filter((s) => s.day === day);
    return skippedMeals.length >= 3;
  });
}

// POST /api/ai/generate-plan
router.post('/generate-plan', async (req, res) => {
  try {
    const { leftovers, preferences } = req.body;

    // NoOp if everything is skipped
    if (isAllSkipped(preferences)) {
      const emptyPlan = {};
      for (const day of DAYS) {
        emptyPlan[day] = { breakfast: null, lunch: null, dinner: null, fruit: [] };
      }
      return res.json({ plan: emptyPlan, source: 'noOp' });
    }

    const masterMeals = await readJSON('master-meals.json');
    const history = await readJSON('history.json');

    let plan;
    let source = 'ai';
    try {
      const client = getClient();
      const prompt = buildPlanPrompt(masterMeals, leftovers, preferences, history);

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text;
      plan = extractJSON(text);
      plan = validatePlan(plan, masterMeals);
    } catch (aiErr) {
      console.error('AI plan generation failed, falling back to rule-based:', aiErr.message);
      const fallback = await generateWeeklyPlan(leftovers, preferences, history);
      plan = fallback.plan;
      source = 'rule-based';
    }

    res.json({ plan, source });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/swap-suggestions
router.post('/swap-suggestions', async (req, res) => {
  try {
    const { day, mealType, currentPlan, reason } = req.body;
    if (!day || !mealType) {
      return res.status(400).json({ error: 'day and mealType are required' });
    }

    const masterMeals = await readJSON('master-meals.json');
    const client = getClient();
    const prompt = buildSwapPrompt(day, mealType, currentPlan, masterMeals, reason);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    let suggestions = extractJSON(text);

    // Validate meal IDs exist based on type
    let validIds;
    if (mealType === 'breakfast') {
      validIds = new Set(masterMeals.breakfasts.map((b) => b.id));
    } else if (mealType === 'drinks') {
      validIds = new Set((masterMeals.drinks || []).map((d) => d.id));
    } else if (mealType === 'fruit') {
      validIds = new Set(masterMeals.fruits.map((f) => f.id));
    } else {
      validIds = new Set(masterMeals.meals.map((m) => m.id));
    }

    suggestions = suggestions
      .filter((s) => validIds.has(s.mealId))
      .slice(0, 5);

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/optimize-grocery
router.post('/optimize-grocery', async (req, res) => {
  try {
    const { groceryList, plan } = req.body;
    if (!groceryList) {
      return res.status(400).json({ error: 'groceryList is required' });
    }

    const client = getClient();
    const prompt = buildGroceryOptimizePrompt(groceryList, plan);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const result = extractJSON(text);

    res.json({
      suggestions: result.suggestions || [],
      fixes: result.fixes || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
