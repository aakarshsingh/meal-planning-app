import { Router } from 'express';
import { buildGroceryList } from '../utils/groceryBuilder.js';

const router = Router();

// POST /api/groceries/generate — generate categorized grocery list from plan
router.post('/generate', async (req, res) => {
  try {
    const { plan, leftovers, sideOverrides } = req.body;
    if (!plan) {
      return res.status(400).json({ error: 'plan is required' });
    }
    const groceryList = await buildGroceryList(plan, leftovers, sideOverrides);
    res.json(groceryList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
