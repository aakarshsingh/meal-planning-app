import { useState, useEffect } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-2.5 py-1 rounded-md transition-all ${
        copied
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
      }`}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

function WeeklyChart({ plan, masterMeals, preferences }) {
  if (!plan || !masterMeals) return null;

  const { skipDays = [] } = preferences;

  function findMeal(mealId) {
    if (!mealId) return null;
    return (
      masterMeals.breakfasts?.find((b) => b.id === mealId) ||
      masterMeals.meals?.find((m) => m.id === mealId) ||
      masterMeals.fruits?.find((f) => f.id === mealId)
    );
  }

  function formatMealText(mealId) {
    const meal = findMeal(mealId);
    if (!meal) return 'None';
    const qty = meal.defaultQty ? ` x ${meal.defaultQty}` : '';
    const accompaniment = meal.accompaniment ? `${meal.accompaniment}, ` : '';
    return `${accompaniment}${meal.name}${qty}`;
  }

  function formatFruits(fruitIds) {
    if (!fruitIds || fruitIds.length === 0) return 'None';
    return fruitIds
      .map((id) => {
        const fruit = findMeal(id);
        return fruit ? fruit.name : id;
      })
      .join(', ');
  }

  function formatDay(day) {
    if (skipDays.includes(day)) return `${day}:\n  Skipped`;
    const d = plan[day];
    if (!d) return `${day}:\n  No plan`;
    const lines = [
      `${day}:`,
      `  Breakfast: ${formatMealText(d.breakfast)}`,
      `  Lunch: ${formatMealText(d.lunch)}`,
      `  Dinner: ${formatMealText(d.dinner)}`,
      `  Fruit: ${formatFruits(d.fruit)}`,
    ];
    return lines.join('\n');
  }

  // Date range for header
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const dateRange = `${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${saturday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const fullText = `Meal Plan: ${dateRange}\n\n${DAYS.map(formatDay).join('\n\n')}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-amber-800">Weekly Meal Chart</h2>
        <CopyButton text={fullText} label="Copy Full Week" />
      </div>

      <div className="space-y-4">
        {DAYS.map((day) => {
          const isSkipped = skipDays.includes(day);
          const d = plan[day];
          const dayText = formatDay(day);

          return (
            <div
              key={day}
              className={`rounded-lg p-3 ${isSkipped ? 'bg-gray-50' : 'bg-amber-50/50'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3
                  className={`text-sm font-semibold ${
                    isSkipped ? 'text-gray-400' : 'text-amber-800'
                  }`}
                >
                  {day}
                </h3>
                {!isSkipped && <CopyButton text={dayText} label="Copy" />}
              </div>

              {isSkipped ? (
                <p className="text-xs text-gray-400 italic">Skipped</p>
              ) : d ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-amber-500 font-medium">Breakfast</span>
                    <p className="text-amber-900 mt-0.5">{formatMealText(d.breakfast)}</p>
                  </div>
                  <div>
                    <span className="text-amber-500 font-medium">Lunch</span>
                    <p className="text-amber-900 mt-0.5">{formatMealText(d.lunch)}</p>
                  </div>
                  <div>
                    <span className="text-amber-500 font-medium">Dinner</span>
                    <p className="text-amber-900 mt-0.5">{formatMealText(d.dinner)}</p>
                  </div>
                  <div>
                    <span className="text-amber-500 font-medium">Fruit</span>
                    <p className="text-amber-900 mt-0.5">{formatFruits(d.fruit)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-400">No plan</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyChart;
