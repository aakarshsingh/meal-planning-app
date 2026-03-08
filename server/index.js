import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readJSON } from './utils/fileStore.js';
import mealsRouter from './routes/meals.js';
import plannerRouter from './routes/planner.js';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const masterMeals = await readJSON('master-meals.json');
    const mealCount = masterMeals.meals.length;
    res.json({ status: 'ok', meals: mealCount });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/meals', mealsRouter);
app.get('/api/ingredients', async (req, res) => {
  try {
    const data = await readJSON('ingredients.json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.use('/api/planner', plannerRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
