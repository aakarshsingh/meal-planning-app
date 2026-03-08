import { useState } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BASE_LABELS = { rice: 'Rice', roti: 'Roti', paratha: 'Paratha', pav: 'Pav', noodles: 'Noodles', none: '' };
const COUNTABLE_BASES = ['roti', 'paratha', 'pav'];

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
          : 'bg-cream text-ink/60 border border-ink/15 hover:bg-primary-light hover:text-primary'
      }`}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

function WeeklyChart({ plan, masterMeals, preferences, baseOverrides = {}, quantities = {} }) {
  if (!plan || !masterMeals) return null;

  const { skipDays = [] } = preferences;

  function findMeal(mealId) {
    if (!mealId) return null;
    return (
      masterMeals.breakfasts?.find((b) => b.id === mealId) ||
      masterMeals.meals?.find((m) => m.id === mealId) ||
      (masterMeals.drinks || []).find((d) => d.id === mealId) ||
      masterMeals.fruits?.find((f) => f.id === mealId)
    );
  }

  function formatMealText(mealId, day, slot) {
    const meal = findMeal(mealId);
    if (!meal) return 'None';

    // Use overridden base if available
    const slotKey = `${day}-${slot}`;
    const base = baseOverrides[slotKey] ?? meal.base;

    // Build name with base
    let name = meal.name;
    if (base && base !== 'none') {
      name = `${meal.name} + ${BASE_LABELS[base] || base}`;
    }

    // Use overridden qty for countable items
    const isCountable = COUNTABLE_BASES.includes(base);
    if (isCountable) {
      const qty = quantities[mealId] || meal.defaultQty || 2;
      return `${name} x ${qty}`;
    }

    // For breakfasts with qty
    if (meal.id?.startsWith('bf-') && meal.defaultQty) {
      const qty = quantities[mealId] || meal.defaultQty;
      return `${name} x ${qty}`;
    }

    const accompaniment = meal.accompaniment ? `${meal.accompaniment}, ` : '';
    return `${accompaniment}${name}`;
  }

  function formatArraySlot(ids) {
    if (!ids || ids.length === 0) return 'None';
    return ids.map((id) => {
      const item = findMeal(id);
      return item ? item.name : id;
    }).join(', ');
  }

  function formatDay(day) {
    if (skipDays.includes(day)) return `${day}:\n  Skipped`;
    const d = plan[day];
    if (!d) return `${day}:\n  No plan`;
    const bfIds = Array.isArray(d.breakfast) ? d.breakfast : (d.breakfast ? [d.breakfast] : []);
    const drinkIds = Array.isArray(d.drinks) ? d.drinks : (d.drinks ? [d.drinks] : []);
    const lines = [
      `${day}:`,
      `  Breakfast: ${bfIds.length > 0 ? bfIds.map((id) => formatMealText(id, day, 'breakfast')).join(' + ') : 'None'}`,
    ];
    if (drinkIds.length > 0) {
      lines.push(`  Drinks: ${formatArraySlot(drinkIds)}`);
    }
    lines.push(
      `  Lunch: ${formatMealText(d.lunch, day, 'lunch')}`,
      `  Dinner: ${formatMealText(d.dinner, day, 'dinner')}`,
      `  Fruit: ${formatArraySlot(d.fruit)}`,
    );
    return lines.join('\n');
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const dateRange = `${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${saturday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const fullText = `Meal Plan: ${dateRange}\n\n${DAYS.map(formatDay).join('\n\n')}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">Weekly Meal Chart</h2>
        <CopyButton text={fullText} label="Copy Full Week" />
      </div>

      <div className="space-y-4">
        {DAYS.map((day) => {
          const isSkipped = skipDays.includes(day);
          const d = plan[day];
          const dayText = formatDay(day);
          const bfIds = d ? (Array.isArray(d.breakfast) ? d.breakfast : (d.breakfast ? [d.breakfast] : [])) : [];
          const drinkIds = d ? (Array.isArray(d.drinks) ? d.drinks : (d.drinks ? [d.drinks] : [])) : [];

          return (
            <div
              key={day}
              className={`rounded-lg p-3 ${isSkipped ? 'bg-gray-50' : 'bg-cream/50'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3
                  className={`text-sm font-semibold ${
                    isSkipped ? 'text-gray-400' : 'text-ink'
                  }`}
                >
                  {day}
                </h3>
                {!isSkipped && <CopyButton text={dayText} label="Copy" />}
              </div>

              {isSkipped ? (
                <p className="text-xs text-gray-400 italic">Skipped</p>
              ) : d ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <span className="text-primary font-medium">Breakfast</span>
                    <p className="text-ink mt-0.5">
                      {bfIds.length > 0 ? bfIds.map((id) => formatMealText(id, day, 'breakfast')).join(' + ') : 'None'}
                    </p>
                  </div>
                  {drinkIds.length > 0 && (
                    <div>
                      <span className="text-blue-500 font-medium">Drinks</span>
                      <p className="text-ink mt-0.5">{formatArraySlot(drinkIds)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-primary font-medium">Lunch</span>
                    <p className="text-ink mt-0.5">{formatMealText(d.lunch, day, 'lunch')}</p>
                  </div>
                  <div>
                    <span className="text-primary font-medium">Dinner</span>
                    <p className="text-ink mt-0.5">{formatMealText(d.dinner, day, 'dinner')}</p>
                  </div>
                  <div>
                    <span className="text-primary font-medium">Fruit</span>
                    <p className="text-ink mt-0.5">{formatArraySlot(d.fruit)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink/40">No plan</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyChart;
