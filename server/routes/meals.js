import { Router } from 'express';
import { readJSON, writeJSON } from '../utils/fileStore.js';

const router = Router();

// GET /api/meals — all breakfasts, meals, fruits
router.get('/', async (req, res) => {
  try {
    const data = await readJSON('master-meals.json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meals/:id — single meal by ID (searches breakfasts, meals, fruits)
router.get('/:id', async (req, res) => {
  try {
    const data = await readJSON('master-meals.json');
    const { id } = req.params;
    const item =
      data.breakfasts.find((b) => b.id === id) ||
      data.meals.find((m) => m.id === id) ||
      data.fruits.find((f) => f.id === id);
    if (!item) {
      return res.status(404).json({ error: `Meal not found: ${id}` });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meals — add a new meal to master list
router.post('/', async (req, res) => {
  try {
    const data = await readJSON('master-meals.json');
    const meal = req.body;
    if (!meal.id || !meal.name) {
      return res.status(400).json({ error: 'id and name are required' });
    }
    if (meal.id.startsWith('bf-')) {
      data.breakfasts.push(meal);
    } else if (meal.id.startsWith('fruit-')) {
      data.fruits.push(meal);
    } else {
      data.meals.push(meal);
    }
    await writeJSON('master-meals.json', data);
    res.status(201).json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
