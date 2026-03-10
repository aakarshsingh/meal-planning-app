import { Router } from 'express';
import { generateWeeklyPlan, getSuggestions } from '../utils/suggestionEngine.js';

const router = Router();

// POST /api/suggest/plan — generate a full weekly plan
router.post('/plan', async (req, res) => {
  try {
    const { leftovers, preferences, history } = req.body;
    const result = await generateWeeklyPlan(leftovers, preferences, history);
    res.json({ plan: result.plan, constrainedSlots: result.constrainedSlots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/suggest/swap — get 5 swap suggestions for a slot
router.post('/swap', async (req, res) => {
  try {
    const { day, mealType, currentPlan, history } = req.body;
    if (!day || !mealType) {
      return res.status(400).json({ error: 'day and mealType are required' });
    }
    const suggestions = await getSuggestions(day, mealType, currentPlan, history);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
