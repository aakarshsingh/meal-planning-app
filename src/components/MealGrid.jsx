import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MealCard from './MealCard';
import SwapModal from './SwapModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };
const MEAL_ROWS = ['morning', 'lunch', 'dinner', 'fruit'];
const ROW_LABELS = { morning: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', fruit: 'Fruit' };

const FRUIT_ICONS = {
  'Guava': '\u{1F34F}',
  'Pomegranate': '\u{1F9C3}',
  'Apple': '\u{1F34E}',
  'Kiwi': '\u{1F95D}',
  'Grapes': '\u{1F347}',
  'Strawberry': '\u{1F353}',
};

const DRINK_ICONS = {
  'Coffee': '\u{2615}',
  'Iced Tea': '\u{1F9CA}',
  'Nimbu Pani': '\u{1F34B}',
};

function MealGrid({ leftovers, preferences, plan, setPlan, quantities, setQuantities, baseOverrides, setBaseOverrides, onBack, toastRef }) {
  const [masterMeals, setMasterMeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [aiOverrideUsed, setAiOverrideUsed] = useState(false);
  const [freshAiSuggestions, setFreshAiSuggestions] = useState([]);
  const [swapTarget, setSwapTarget] = useState(null);
  // Track which day-slot combos were placed by AI (e.g. "Monday-lunch")
  const [aiPlacedSlots, setAiPlacedSlots] = useState(new Set());
  const initialPlanRef = useRef(null);
  const aiPlanLoadedRef = useRef(false);

  const { skipDays = [], skipMeals = [] } = preferences;

  useEffect(() => {
    fetch('/api/meals')
      .then((r) => r.json())
      .then((data) => setMasterMeals(data))
      .catch(() => {});
  }, []);

  // Check if all days/meals are skipped
  const allSkipped = useMemo(() => {
    const activeDays = DAYS.filter((d) => !skipDays.includes(d));
    if (activeDays.length === 0) return true;
    return activeDays.every((day) => {
      const skippedForDay = skipMeals.filter((s) => s.day === day);
      return skippedForDay.length >= 3;
    });
  }, [skipDays, skipMeals]);

  // Merge AI plan into existing plan and track which slots AI filled
  function mergeAiPlan(prevPlan, aiData) {
    if (!prevPlan) return aiData;
    const merged = { ...prevPlan };
    const placed = new Set();
    for (const day of DAYS) {
      merged[day] = { ...merged[day] };
      if (!merged[day].lunch && aiData[day]?.lunch) {
        merged[day].lunch = aiData[day].lunch;
        placed.add(`${day}-lunch`);
      }
      if (!merged[day].dinner && aiData[day]?.dinner) {
        merged[day].dinner = aiData[day].dinner;
        placed.add(`${day}-dinner`);
      }
    }
    setAiPlacedSlots(placed);
    initialPlanRef.current = JSON.parse(JSON.stringify(merged));
    return merged;
  }

  // Generate plan on mount
  useEffect(() => {
    if (plan) {
      setLoading(false);
      if (!initialPlanRef.current) initialPlanRef.current = JSON.parse(JSON.stringify(plan));
      // Only call AI once, skip if already loaded or failed
      if (!aiPlanLoadedRef.current && !aiFailed && !allSkipped) {
        aiPlanLoadedRef.current = true;
        setAiLoading(true);
        fetch('/api/ai/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leftovers, preferences }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.plan && data.source === 'ai') {
              setAiPlan(data.plan);
              setPlan((prev) => mergeAiPlan(prev, data.plan));
            }
            setAiLoading(false);
          })
          .catch(() => { setAiLoading(false); setAiFailed(true); });
      }
      return;
    }

    if (allSkipped) {
      const emptyPlan = {};
      for (const day of DAYS) {
        emptyPlan[day] = { breakfast: [], drinks: [], lunch: null, dinner: null, fruit: [] };
      }
      setPlan(emptyPlan);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch('/api/suggest/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leftovers, preferences }),
    })
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan);
        initialPlanRef.current = JSON.parse(JSON.stringify(data.plan));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toastRef?.current?.error('Failed to generate meal plan');
      });

    aiPlanLoadedRef.current = true;
    setAiLoading(true);
    fetch('/api/ai/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leftovers, preferences }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.plan && data.source === 'ai') {
          setAiPlan(data.plan);
          setPlan((prev) => mergeAiPlan(prev, data.plan));
        }
        setAiLoading(false);
      })
      .catch(() => { setAiLoading(false); setAiFailed(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const findMeal = useCallback(
    (mealId) => {
      if (!masterMeals || !mealId) return null;
      return (
        masterMeals.breakfasts?.find((b) => b.id === mealId) ||
        masterMeals.meals?.find((m) => m.id === mealId) ||
        (masterMeals.drinks || []).find((d) => d.id === mealId) ||
        masterMeals.fruits?.find((f) => f.id === mealId)
      );
    },
    [masterMeals]
  );

  function isSlotSkipped(day, mealType) {
    if (skipDays.includes(day)) return true;
    if (mealType === 'morning') return isSlotSkipped(day, 'breakfast');
    return skipMeals.some((s) => s.day === day && s.mealType === mealType);
  }

  function getMealCategory(mealId) {
    if (!masterMeals || !mealId) return null;
    if (masterMeals.breakfasts?.some((b) => b.id === mealId)) return 'breakfast';
    if ((masterMeals.drinks || []).some((d) => d.id === mealId)) return 'drinks';
    if (masterMeals.fruits?.some((f) => f.id === mealId)) return 'fruit';
    return 'meal';
  }

  function getSlotItems(day, mealType) {
    if (!plan || !plan[day]) return [];
    if (mealType === 'morning') {
      const bfIds = Array.isArray(plan[day].breakfast) ? plan[day].breakfast : (plan[day].breakfast ? [plan[day].breakfast] : []);
      const drinkIds = Array.isArray(plan[day].drinks) ? plan[day].drinks : (plan[day].drinks ? [plan[day].drinks] : []);
      return [...bfIds, ...drinkIds];
    }
    if (mealType === 'fruit') return plan[day].fruit || [];
    return plan[day][mealType] ? [plan[day][mealType]] : [];
  }

  function handleSwapSelect(mealId) {
    if (!swapTarget || !plan) return;
    const { day, mealType } = swapTarget;
    const newPlan = { ...plan };
    newPlan[day] = { ...newPlan[day] };

    if (mealType === 'morning') {
      const category = getMealCategory(mealId);
      if (category === 'breakfast') {
        const current = Array.isArray(newPlan[day].breakfast) ? newPlan[day].breakfast : [];
        if (current.length < 2) {
          newPlan[day].breakfast = [...current, mealId];
        } else {
          newPlan[day].breakfast = [mealId];
        }
      } else if (category === 'drinks') {
        const current = Array.isArray(newPlan[day].drinks) ? newPlan[day].drinks : [];
        if (current.length < 2) {
          newPlan[day].drinks = [...current, mealId];
        } else {
          newPlan[day].drinks = [mealId];
        }
      } else {
        const current = Array.isArray(newPlan[day].breakfast) ? newPlan[day].breakfast : [];
        newPlan[day].breakfast = [...current, mealId];
      }
    } else if (mealType === 'fruit') {
      const current = newPlan[day].fruit || [];
      if (current.length < 2) {
        newPlan[day].fruit = [...current, mealId];
      } else {
        newPlan[day].fruit = [mealId];
      }
    } else {
      newPlan[day][mealType] = mealId;
      // Clear AI indicator when user manually swaps
      setAiPlacedSlots((prev) => {
        const next = new Set(prev);
        next.delete(`${day}-${mealType}`);
        return next;
      });
    }
    setPlan(newPlan);
    setSwapTarget(null);
  }

  function handleRemoveItem(day, mealType, itemId) {
    if (!plan) return;
    const newPlan = { ...plan };
    newPlan[day] = { ...newPlan[day] };

    if (mealType === 'morning') {
      const category = getMealCategory(itemId);
      if (category === 'breakfast') {
        const arr = Array.isArray(newPlan[day].breakfast) ? newPlan[day].breakfast : [];
        newPlan[day].breakfast = arr.filter((id) => id !== itemId);
      } else if (category === 'drinks') {
        const arr = Array.isArray(newPlan[day].drinks) ? newPlan[day].drinks : [];
        newPlan[day].drinks = arr.filter((id) => id !== itemId);
      }
    } else if (mealType === 'fruit') {
      newPlan[day].fruit = (newPlan[day].fruit || []).filter((id) => id !== itemId);
    } else {
      newPlan[day][mealType] = null;
    }
    setPlan(newPlan);
  }

  function handleRemove(day, mealType) {
    if (!plan) return;
    const newPlan = { ...plan };
    newPlan[day] = { ...newPlan[day] };
    if (mealType === 'morning') {
      newPlan[day].breakfast = [];
      newPlan[day].drinks = [];
    } else if (mealType === 'fruit') {
      newPlan[day].fruit = [];
    } else {
      newPlan[day][mealType] = null;
      setAiPlacedSlots((prev) => {
        const next = new Set(prev);
        next.delete(`${day}-${mealType}`);
        return next;
      });
    }
    setPlan(newPlan);
  }

  function handleRemoveAll() {
    if (!plan) return;
    const newPlan = {};
    for (const day of DAYS) {
      newPlan[day] = { breakfast: [], drinks: [], lunch: null, dinner: null, fruit: [] };
    }
    setPlan(newPlan);
    setAiPlacedSlots(new Set());
    toastRef?.current?.info('All meals cleared');
  }

  function handleRestore() {
    if (!initialPlanRef.current) return;
    setPlan(JSON.parse(JSON.stringify(initialPlanRef.current)));
    toastRef?.current?.success('Plan restored');
  }

  function handleQtyChange(mealId, delta) {
    setQuantities((prev) => {
      const meal = findMeal(mealId);
      const base = meal?.defaultQty || 2;
      const current = prev[mealId] || base;
      return { ...prev, [mealId]: Math.max(1, current + delta) };
    });
  }

  function handleBaseChange(day, mealType, mealId, newBase) {
    setBaseOverrides((prev) => ({ ...prev, [`${day}-${mealType}`]: newBase }));
  }

  function handleMasterMealAdd(newMeal) {
    setMasterMeals((prev) => ({
      ...prev,
      meals: [...(prev?.meals || []), newMeal],
    }));
  }

  const cachedAiMeals = useMemo(() => {
    if (!aiPlan || !masterMeals) return [];
    const aiMealIds = new Set();
    for (const day of DAYS) {
      if (!aiPlan[day]) continue;
      for (const slot of ['breakfast', 'lunch', 'dinner']) {
        if (aiPlan[day][slot]) aiMealIds.add(aiPlan[day][slot]);
      }
    }
    return [...aiMealIds].map((id) => findMeal(id)).filter(Boolean);
  }, [aiPlan, masterMeals, findMeal]);

  if (loading || !masterMeals) {
    return (
      <div className="flex flex-col items-center py-12 gap-3">
        <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
        <p className="text-sm text-ink/50">Generating your meal plan...</p>
      </div>
    );
  }

  function renderArrayCell(day, mealType, skipped) {
    const items = getSlotItems(day, mealType);

    if (skipped) {
      return (
        <td key={`${day}-${mealType}`} className="p-1 align-top">
          <div className="bg-gray-50 border border-gray-200 rounded-lg min-h-[70px] flex items-center justify-center text-xs text-gray-300">
            skipped
          </div>
        </td>
      );
    }

    return (
      <td key={`${day}-${mealType}`} className="p-1 align-top">
        <div className="bg-cream/50 border border-ink/10 rounded-lg min-h-[70px] p-1">
          {items.length > 0 ? (
            <div className="flex flex-col gap-1">
              {items.map((itemId) => {
                const item = findMeal(itemId);
                if (!item) return null;
                const category = getMealCategory(itemId);
                const isDrink = category === 'drinks';
                const isFruit = category === 'fruit';
                const icon = isFruit
                  ? (FRUIT_ICONS[item.name] || '')
                  : isDrink
                    ? (DRINK_ICONS[item.name] || '')
                    : '';
                const colorClass = isFruit
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : isDrink
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-cream border-ink/10 text-ink';

                return (
                  <div
                    key={itemId}
                    className={`flex items-center justify-between px-1.5 py-1 rounded border text-xs ${colorClass}`}
                  >
                    <span className="truncate">{icon ? `${icon} ` : ''}{item.name}</span>
                    <button
                      onClick={() => handleRemoveItem(day, mealType, itemId)}
                      className="text-ink/30 hover:text-accent ml-1 shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
              {((mealType === 'morning' && items.length < 4) || (mealType === 'fruit' && items.length < 2)) && (
                <button
                  onClick={() => setSwapTarget({ day, mealType })}
                  className="text-[10px] text-ink/30 hover:text-primary text-center py-0.5"
                >
                  + add
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSwapTarget({ day, mealType })}
              className="w-full h-full flex items-center justify-center text-xs text-ink/30 border border-dashed border-ink/10 rounded-md hover:bg-primary-light hover:text-primary cursor-pointer min-h-[60px]"
            >
              + Add
            </button>
          )}
        </div>
      </td>
    );
  }

  function renderSingleCell(day, mealType, skipped) {
    if (skipped) {
      return (
        <td key={`${day}-${mealType}`} className="p-1 align-top">
          <div className="bg-gray-50 border border-gray-200 rounded-lg min-h-[70px] flex items-center justify-center text-xs text-gray-300">
            skipped
          </div>
        </td>
      );
    }

    const mealId = plan?.[day]?.[mealType];
    const meal = findMeal(mealId);
    const overriddenBase = baseOverrides[`${day}-${mealType}`] ?? meal?.base;
    const isAiPlaced = aiPlacedSlots.has(`${day}-${mealType}`);
    const mealWithOverrides = meal
      ? { ...meal, qty: quantities[mealId], base: overriddenBase }
      : null;

    return (
      <td key={`${day}-${mealType}`} className="p-1 align-top">
        <div className={`rounded-lg min-h-[70px] p-1 ${
          isAiPlaced
            ? 'bg-purple-50 border-2 border-purple-300'
            : 'bg-cream/50 border border-ink/10'
        }`}>
          {isAiPlaced && (
            <div className="text-[8px] text-purple-500 font-semibold text-center mb-0.5 uppercase tracking-wide">
              AI pick
            </div>
          )}
          {mealWithOverrides ? (
            <MealCard
              meal={mealWithOverrides}
              onRemove={() => handleRemove(day, mealType)}
              onSwap={() => setSwapTarget({ day, mealType })}
              onQtyChange={(delta) => handleQtyChange(mealId, delta)}
              onBaseChange={(newBase) => handleBaseChange(day, mealType, mealId, newBase)}
            />
          ) : (
            <button
              onClick={() => setSwapTarget({ day, mealType })}
              className="w-full h-full flex items-center justify-center text-xs text-ink/30 border border-dashed border-ink/10 rounded-md hover:bg-primary-light hover:text-primary cursor-pointer min-h-[60px]"
            >
              + Add
            </button>
          )}
        </div>
      </td>
    );
  }

  return (
    <div className="space-y-4">
      {aiLoading && (
        <div className="flex items-center gap-2 text-xs text-purple-500 justify-center py-2 bg-purple-50 rounded-lg border border-purple-200">
          <div className="animate-spin w-3.5 h-3.5 border-2 border-purple-200 border-t-purple-500 rounded-full" />
          AI is enhancing your plan...
        </div>
      )}
      {aiFailed && !aiLoading && (
        <div className="text-center text-xs text-ink/40 py-1">
          AI suggestions unavailable — using rule-based plan
        </div>
      )}
      {!aiLoading && aiPlacedSlots.size > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-purple-600 py-1">
          <span className="inline-block w-3 h-3 rounded border-2 border-purple-300 bg-purple-50" />
          Purple cells = AI-enhanced picks ({aiPlacedSlots.size} slots)
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={handleRemoveAll}
          className="text-xs px-3 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent-light transition-colors"
        >
          Clear All
        </button>
        {initialPlanRef.current && (
          <button
            onClick={handleRestore}
            className="text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary-light transition-colors"
          >
            Restore
          </button>
        )}
      </div>

      {/* Meal grid as HTML table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="w-20 p-1" />
              {DAYS.map((day) => (
                <th
                  key={day}
                  className={`text-center text-xs font-semibold py-2 px-1 ${
                    skipDays.includes(day) ? 'text-gray-300 bg-gray-50' : 'text-ink bg-primary-light'
                  } rounded-t-lg`}
                >
                  {DAY_SHORT[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_ROWS.map((mealType) => (
              <tr key={mealType}>
                <td className="text-right pr-2 align-top pt-3">
                  <span className="text-xs font-medium text-ink/50">
                    {ROW_LABELS[mealType]}
                  </span>
                </td>
                {DAYS.map((day) => {
                  const skipped = isSlotSkipped(day, mealType);
                  if (mealType === 'morning' || mealType === 'fruit') {
                    return renderArrayCell(day, mealType, skipped);
                  }
                  return renderSingleCell(day, mealType, skipped);
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Back button */}
      <div className="flex justify-start pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg border border-ink/20 text-ink/70 hover:bg-primary-light transition-colors"
        >
          Back
        </button>
      </div>

      {/* Swap/Add modal */}
      {swapTarget && (
        <SwapModal
          day={swapTarget.day}
          mealType={swapTarget.mealType}
          currentPlan={plan}
          masterMeals={masterMeals}
          cachedAiMeals={cachedAiMeals}
          aiOverrideUsed={aiOverrideUsed}
          onAiOverrideUsed={() => setAiOverrideUsed(true)}
          freshAiSuggestions={freshAiSuggestions}
          onFreshAiSuggestions={setFreshAiSuggestions}
          onMasterMealsUpdate={handleMasterMealAdd}
          onSelect={handleSwapSelect}
          onClose={() => setSwapTarget(null)}
          toastRef={toastRef}
        />
      )}
    </div>
  );
}

export default MealGrid;
