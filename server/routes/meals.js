import { Router } from 'express';
import { readJSON, writeJSON } from '../utils/fileStore.js';

const router = Router();

// GET /api/meals — all breakfasts, meals, fruits, drinks
router.get('/', async (req, res) => {
  try {
    const data = await readJSON('master-meals.json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meals/:id — single meal by ID
router.get('/:id', async (req, res) => {
  try {
    const data = await readJSON('master-meals.json');
    const { id } = req.params;
    const item =
      data.breakfasts.find((b) => b.id === id) ||
      data.meals.find((m) => m.id === id) ||
      (data.drinks || []).find((d) => d.id === id) ||
      data.fruits.find((f) => f.id === id);
    if (!item) {
      return res.status(404).json({ error: `Meal not found: ${id}` });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meals — add a new meal to master list (with duplicate check)
router.post('/', async (req, res) => {
  try {
    const data = await readJSON('master-meals.json');
    const meal = req.body;
    if (!meal.id || !meal.name) {
      return res.status(400).json({ error: 'id and name are required' });
    }

    // Duplicate name check within the target category
    let targetArray;
    if (meal.id.startsWith('bf-')) targetArray = data.breakfasts || [];
    else if (meal.id.startsWith('fruit-')) targetArray = data.fruits || [];
    else if (meal.id.startsWith('drink-')) targetArray = data.drinks || [];
    else if (meal.id.startsWith('side-')) targetArray = data.sides || [];
    else targetArray = data.meals || [];

    const targetNames = targetArray.map((m) => m.name.toLowerCase().trim());
    if (targetNames.includes(meal.name.toLowerCase().trim())) {
      return res.status(409).json({ error: `"${meal.name}" already exists` });
    }

    if (meal.id.startsWith('bf-')) {
      data.breakfasts.push(meal);
    } else if (meal.id.startsWith('fruit-')) {
      data.fruits.push(meal);
    } else if (meal.id.startsWith('drink-')) {
      if (!data.drinks) data.drinks = [];
      data.drinks.push(meal);
    } else if (meal.id.startsWith('side-')) {
      if (!data.sides) data.sides = [];
      data.sides.push(meal);
    } else {
      data.meals.push(meal);
    }
    await writeJSON('master-meals.json', data);
    res.status(201).json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/meals/:id — update an existing meal
router.put('/:id', async (req, res) => {
  try {
    const data = await readJSON('master-meals.json');
    const { id } = req.params;
    const updates = req.body;

    const arrays = [
      { key: 'breakfasts', arr: data.breakfasts || [] },
      { key: 'meals', arr: data.meals || [] },
      { key: 'drinks', arr: data.drinks || [] },
      { key: 'fruits', arr: data.fruits || [] },
      { key: 'sides', arr: data.sides || [] },
    ];

    let found = false;
    for (const { arr } of arrays) {
      const idx = arr.findIndex((m) => m.id === id);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...updates, id };
        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: `Meal not found: ${id}` });
    }

    await writeJSON('master-meals.json', data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/meals/:id — remove a meal from master list
router.delete('/:id', async (req, res) => {
  try {
    const data = await readJSON('master-meals.json');
    const { id } = req.params;

    let found = false;
    for (const key of ['breakfasts', 'meals', 'drinks', 'fruits', 'sides']) {
      const arr = data[key] || [];
      const idx = arr.findIndex((m) => m.id === id);
      if (idx >= 0) {
        arr.splice(idx, 1);
        data[key] = arr;
        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: `Meal not found: ${id}` });
    }

    await writeJSON('master-meals.json', data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
