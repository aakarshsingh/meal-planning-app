import { Router } from 'express';
import { readJSON, writeJSON, appendToHistory } from '../utils/fileStore.js';

const router = Router();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MEAL_TYPES = ['breakfast', 'drinks', 'lunch', 'dinner', 'fruit'];

// GET /api/planner/current
router.get('/current', async (req, res) => {
  try {
    const current = await readJSON('current-week.json');
    res.json(current);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/planner/current — full replacement
router.put('/current', async (req, res) => {
  try {
    const plan = req.body;
    await writeJSON('current-week.json', plan);
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/planner/current/slot — update single slot { day, mealType, mealId }
router.put('/current/slot', async (req, res) => {
  try {
    const { day, mealType, mealId } = req.body;
    if (!day || !mealType) {
      return res.status(400).json({ error: 'day and mealType are required' });
    }
    if (!DAYS.includes(day)) {
      return res.status(400).json({ error: `Invalid day: ${day}` });
    }
    if (!MEAL_TYPES.includes(mealType)) {
      return res.status(400).json({ error: `Invalid mealType: ${mealType}` });
    }

    const current = await readJSON('current-week.json');
    if (!current.plan[day]) {
      current.plan[day] = { breakfast: [], drinks: [], lunch: null, dinner: null, fruit: [] };
    }

    if (mealType === 'fruit' || mealType === 'breakfast' || mealType === 'drinks') {
      current.plan[day][mealType] = Array.isArray(mealId) ? mealId : [mealId];
    } else {
      current.plan[day][mealType] = mealId;
    }

    await writeJSON('current-week.json', current);
    res.json(current);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/planner/finalize — save to history, reset current week
router.post('/finalize', async (req, res) => {
  try {
    const current = await readJSON('current-week.json');
    if (current.finalized) {
      return res.status(400).json({ error: 'Week already finalized' });
    }

    const weekData = {
      weekStart: current.weekStart,
      weekEnd: current.weekEnd,
      days: current.plan,
    };
    await appendToHistory(weekData);

    // Reset current week
    const blank = {
      weekStart: null,
      weekEnd: null,
      leftovers: [],
      preferences: {
        skipDays: [],
        skipMeals: [],
        specialRequests: [],
        chickenDays: [],
      },
      plan: {},
      groceryList: [],
      finalized: false,
    };
    for (const day of DAYS) {
      blank.plan[day] = { breakfast: [], drinks: [], lunch: null, dinner: null, fruit: [] };
    }
    await writeJSON('current-week.json', blank);

    res.json({ message: 'Week finalized and saved to history' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/planner/history?weeks=N
router.get('/history', async (req, res) => {
  try {
    const history = await readJSON('history.json');
    const n = parseInt(req.query.weeks) || 3;
    const weeks = history.weeks.slice(-n);
    res.json({ weeks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
