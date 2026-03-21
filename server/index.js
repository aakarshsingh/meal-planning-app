import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readJSON } from './utils/fileStore.js';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import mealsRouter from './routes/meals.js';
import plannerRouter from './routes/planner.js';
import suggestRouter from './routes/suggest.js';
import groceriesRouter from './routes/groceries.js';
import aiRouter from './routes/ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use('/api/suggest', suggestRouter);
app.use('/api/groceries', groceriesRouter);
app.use('/api/ai', aiRouter);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
