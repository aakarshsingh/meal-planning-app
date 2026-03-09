import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MealCard, { isCountable } from './MealCard';
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

function MealGrid({ leftovers, preferences, setPreferences, plan, setPlan, quantities, setQuantities, baseOverrides, setBaseOverrides, aiPlanCache, setAiPlanCache, aiOverrideUsed, setAiOverrideUsed, freshAiSuggestions, setFreshAiSuggestions, masterMealsVersion, onBack, toastRef }) {
  const [masterMeals, setMasterMeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  // Track which day-slot combos were placed by AI (e.g. "Monday-lunch")
  const [aiPlacedSlots, setAiPlacedSlots] = useState(new Set());
  // Slots placed by special request constraints — never overridden by AI merge
  const [constrainedSlots, setConstrainedSlots] = useState(new Set());
  const constrainedSlotsRef = useRef(new Set());
  const initialPlanRef = useRef(null);
  const aiCallInFlightRef = useRef(false);
  // Drag-and-drop state
  const [dragSource, setDragSource] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const { skipDays = [], skipMeals = [] } = preferences;

  useEffect(() => {
    fetch('/api/meals')
      .then((r) => r.json())
      .then((data) => setMasterMeals(data))
      .catch(() => {});
  }, [masterMealsVersion]);

  // Check if all days/meals are skipped
  const allSkipped = useMemo(() => {
    const activeDays = DAYS.filter((d) => !skipDays.includes(d));
    if (activeDays.length === 0) return true;
    return activeDays.every((day) => {
      const skippedForDay = skipMeals.filter((s) => s.day === day);
      return skippedForDay.length >= 3;
    });
  }, [skipDays, skipMeals]);

  // Merge AI plan into existing plan: REPLACE some rule-based slots with AI picks
  // NEVER override constrained slots (from special requests)
  function mergeAiPlan(prevPlan, aiData) {
    if (!prevPlan) {
      // No existing plan — use AI plan directly, mark all lunch/dinner as AI
      const placed = new Set();
      for (const day of DAYS) {
        if (aiData[day]?.lunch) placed.add(`${day}-lunch`);
        if (aiData[day]?.dinner) placed.add(`${day}-dinner`);
      }
      setAiPlacedSlots(placed);
      return aiData;
    }

    const merged = { ...prevPlan };
    const placed = new Set();
    const protected_ = constrainedSlotsRef.current;

    // Find slots where AI suggests something DIFFERENT from rule-based
    const candidates = [];
    for (const day of DAYS) {
      if (skipDays.includes(day)) continue;
      for (const slot of ['lunch', 'dinner']) {
        const key = `${day}-${slot}`;
        // NEVER override constrained slots
        if (protected_.has(key)) continue;
        const isSkipped = skipMeals.some((s) => s.day === day && s.mealType === slot);
        if (isSkipped) continue;
        const aiMeal = aiData[day]?.[slot];
        const currentMeal = merged[day]?.[slot];
        if (aiMeal && aiMeal !== currentMeal) {
          candidates.push({ day, slot, aiMealId: aiMeal });
        }
      }
    }

    // Replace at least 2 slots (or all if fewer candidates)
    const toReplace = candidates.slice(0, Math.max(2, Math.ceil(candidates.length * 0.3)));

    // Track all meal IDs in merged plan (to prevent duplicates)
    const usedIds = new Set();
    for (const day of DAYS) {
      if (merged[day]?.lunch) usedIds.add(merged[day].lunch);
      if (merged[day]?.dinner) usedIds.add(merged[day].dinner);
    }

    for (const { day, slot, aiMealId } of toReplace) {
      if (usedIds.has(aiMealId)) continue;
      const oldMealId = merged[day]?.[slot];
      if (oldMealId) usedIds.delete(oldMealId);
      merged[day] = { ...merged[day] };
      merged[day][slot] = aiMealId;
      usedIds.add(aiMealId);
      placed.add(`${day}-${slot}`);
    }

    // Also fill any truly empty slots with AI suggestions
    for (const day of DAYS) {
      if (skipDays.includes(day)) continue;
      merged[day] = { ...merged[day] };
      for (const slot of ['lunch', 'dinner']) {
        if (!merged[day][slot] && aiData[day]?.[slot] && !usedIds.has(aiData[day][slot])) {
          merged[day][slot] = aiData[day][slot];
          usedIds.add(aiData[day][slot]);
          placed.add(`${day}-${slot}`);
        }
      }
    }

    setAiPlacedSlots(placed);
    initialPlanRef.current = JSON.parse(JSON.stringify(merged));
    return merged;
  }

  // Fire AI call — guarded by aiCallInFlightRef to prevent StrictMode double-calls
  function fireAiCall() {
    if (aiCallInFlightRef.current || aiPlanCache || aiFailed || allSkipped) return;
    aiCallInFlightRef.current = true;
    setAiLoading(true);
    fetch('/api/ai/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leftovers, preferences }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`AI API returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.plan && data.source === 'ai') {
          setAiPlanCache(data.plan);
          setPlan((prev) => mergeAiPlan(prev, data.plan));
          toastRef?.current?.success('AI enhanced your plan!');
        } else if (data.source === 'rule-based') {
          console.warn('AI generation fell back to rule-based on server');
        }
        setAiLoading(false);
      })
      .catch((err) => {
        console.error('AI plan call failed:', err);
        setAiLoading(false);
        setAiFailed(true);
      });
  }

  // Generate plan on mount — AI call only once, cached in App.jsx
  useEffect(() => {
    if (plan) {
      setLoading(false);
      if (!initialPlanRef.current) initialPlanRef.current = JSON.parse(JSON.stringify(plan));
      // Skip AI if already cached (e.g. coming back from Review)
      fireAiCall();
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
        // Capture constrained slots from rule-based engine before AI merge
        if (data.constrainedSlots) {
          const cs = new Set(data.constrainedSlots);
          constrainedSlotsRef.current = cs;
          setConstrainedSlots(cs);
        }
        setLoading(false);
        // Now fire AI call — constraints are set, merge will respect them
        fireAiCall();
      })
      .catch(() => {
        setLoading(false);
        toastRef?.current?.error('Failed to generate meal plan');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const findMeal = useCallback(
    (mealId) => {
      if (!masterMeals || !mealId) return null;
      return (
        masterMeals.breakfasts?.find((b) => b.id === mealId) ||
        masterMeals.meals?.find((m) => m.id === mealId) ||
        (masterMeals.drinks || []).find((d) => d.id === mealId) ||
        masterMeals.fruits?.find((f) => f.id === mealId) ||
        (masterMeals.sides || []).find((s) => s.id === mealId)
      );
    },
    [masterMeals]
  );

  function isSlotSkipped(day, mealType) {
    if (skipDays.includes(day)) return true;
    if (mealType === 'morning') return isSlotSkipped(day, 'breakfast');
    return skipMeals.some((s) => s.day === day && s.mealType === mealType);
  }

  function handleUnskip(day, mealType) {
    if (!setPreferences) return;
    setPreferences((prev) => {
      const next = { ...prev };
      if (mealType === 'day') {
        // Remove entire day skip
        next.skipDays = (prev.skipDays || []).filter((d) => d !== day);
        // Also remove any individual meal skips for that day
        next.skipMeals = (prev.skipMeals || []).filter((s) => s.day !== day);
      } else {
        // Remove individual meal skip
        const actualType = mealType === 'morning' ? 'breakfast' : mealType;
        next.skipMeals = (prev.skipMeals || []).filter(
          (s) => !(s.day === day && s.mealType === actualType)
        );
      }
      return next;
    });
    // Initialize the slot in the plan if needed
    if (plan && plan[day]) {
      const newPlan = { ...plan };
      newPlan[day] = { ...newPlan[day] };
      if (mealType === 'day') {
        // Initialize all slots for the day
        if (!newPlan[day].breakfast) newPlan[day].breakfast = [];
        if (!newPlan[day].drinks) newPlan[day].drinks = [];
        if (!newPlan[day].lunch) newPlan[day].lunch = null;
        if (!newPlan[day].dinner) newPlan[day].dinner = null;
        if (!newPlan[day].fruit) newPlan[day].fruit = [];
      }
      setPlan(newPlan);
    }
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
        if (!current.includes(mealId)) {
          newPlan[day].breakfast = [...current, mealId];
        }
      } else if (category === 'drinks') {
        const current = Array.isArray(newPlan[day].drinks) ? newPlan[day].drinks : [];
        if (!current.includes(mealId)) {
          newPlan[day].drinks = [...current, mealId];
        }
      } else {
        const current = Array.isArray(newPlan[day].breakfast) ? newPlan[day].breakfast : [];
        if (!current.includes(mealId)) {
          newPlan[day].breakfast = [...current, mealId];
        }
      }
    } else if (mealType === 'fruit') {
      const current = newPlan[day].fruit || [];
      if (!current.includes(mealId)) {
        newPlan[day].fruit = [...current, mealId];
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

  // Drag-and-drop swap handlers
  function handleDragStart(day, mealType, itemId) {
    setDragSource({ day, mealType, itemId });
  }

  function handleDragOver(e, day, mealType) {
    e.preventDefault();
    const key = `${day}-${mealType}`;
    if (dragOver !== key) setDragOver(key);
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  function handleDrop(day, mealType) {
    setDragOver(null);
    if (!dragSource || !plan) return;
    const src = dragSource;
    setDragSource(null);

    // Same cell — no-op
    if (src.day === day && src.mealType === mealType) return;

    // Allow swap: same row type across days, OR lunch↔dinner (same or different day)
    const isLunchDinner = (t) => t === 'lunch' || t === 'dinner';
    const bothLunchDinner = isLunchDinner(src.mealType) && isLunchDinner(mealType);
    if (src.mealType !== mealType && !bothLunchDinner) return;

    const newPlan = { ...plan };
    newPlan[src.day] = { ...newPlan[src.day] };
    if (src.day !== day) newPlan[day] = { ...newPlan[day] };

    if (bothLunchDinner) {
      // Swap lunch/dinner cells (same or different day)
      const temp = newPlan[src.day][src.mealType];
      newPlan[src.day][src.mealType] = newPlan[day][mealType];
      newPlan[day][mealType] = temp;
      // Swap base overrides
      const srcKey = `${src.day}-${src.mealType}`;
      const dstKey = `${day}-${mealType}`;
      setBaseOverrides((prev) => {
        const next = { ...prev };
        const tempBase = next[srcKey];
        next[srcKey] = next[dstKey];
        next[dstKey] = tempBase;
        if (next[srcKey] === undefined) delete next[srcKey];
        if (next[dstKey] === undefined) delete next[dstKey];
        return next;
      });
      // Swap AI placed indicators
      setAiPlacedSlots((prev) => {
        const next = new Set(prev);
        const srcHad = prev.has(srcKey);
        const dstHad = prev.has(dstKey);
        if (srcHad) next.add(dstKey); else next.delete(dstKey);
        if (dstHad) next.add(srcKey); else next.delete(srcKey);
        return next;
      });
    } else if (mealType === 'morning') {
      // Swap entire morning (breakfast + drinks)
      const tempBf = newPlan[src.day].breakfast;
      const tempDr = newPlan[src.day].drinks;
      newPlan[src.day].breakfast = newPlan[day].breakfast;
      newPlan[src.day].drinks = newPlan[day].drinks;
      newPlan[day].breakfast = tempBf;
      newPlan[day].drinks = tempDr;
    } else if (mealType === 'fruit') {
      const temp = newPlan[src.day].fruit;
      newPlan[src.day].fruit = newPlan[day].fruit;
      newPlan[day].fruit = temp;
    }

    const label = src.day === day ? `Swapped ${src.mealType} ↔ ${mealType}` : `Swapped ${src.day} ↔ ${day}`;
    setPlan(newPlan);
    toastRef?.current?.success(label);
  }

  function handleDragEnd() {
    setDragSource(null);
    setDragOver(null);
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
    if (!aiPlanCache || !masterMeals) return [];
    const aiMealIds = new Set();
    for (const day of DAYS) {
      if (!aiPlanCache[day]) continue;
      for (const slot of ['breakfast', 'lunch', 'dinner']) {
        if (aiPlanCache[day][slot]) aiMealIds.add(aiPlanCache[day][slot]);
      }
    }
    return [...aiMealIds].map((id) => findMeal(id)).filter(Boolean);
  }, [aiPlanCache, masterMeals, findMeal]);

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
      const isDaySkip = skipDays.includes(day);
      return (
        <td key={`${day}-${mealType}`} className="p-1 align-top">
          <div className="bg-gray-50 border border-gray-200 rounded-lg min-h-[70px] flex items-center justify-center text-xs text-gray-300 relative group">
            skipped
            <button
              onClick={() => handleUnskip(day, isDaySkip ? 'day' : mealType)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-200 text-gray-400 hover:bg-accent hover:text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              title={isDaySkip ? `Unskip ${day}` : 'Unskip this slot'}
            >
              &times;
            </button>
          </div>
        </td>
      );
    }

    const isDragTarget = dragOver === `${day}-${mealType}`;

    return (
      <td key={`${day}-${mealType}`} className="p-1 align-top">
        <div
          className={`bg-cream/50 border rounded-lg min-h-[70px] p-1 transition-colors ${
            isDragTarget ? 'border-primary border-2 bg-primary-light/30' : 'border-ink/10'
          }`}
          onDragOver={(e) => handleDragOver(e, day, mealType)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(day, mealType)}
        >
          {items.length > 0 ? (
            <div className="flex flex-col gap-1">
              {items.map((itemId) => {
                const item = findMeal(itemId);
                if (!item) return null;
                const category = getMealCategory(itemId);
                const isDrink = category === 'drinks';
                const isFruit = category === 'fruit';
                const isBreakfast = category === 'breakfast';
                const countable = isBreakfast && isCountable(item);
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
                    draggable
                    onDragStart={() => handleDragStart(day, mealType, itemId)}
                    onDragEnd={handleDragEnd}
                    className={`px-1.5 py-1 rounded border text-xs cursor-grab active:cursor-grabbing ${colorClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{icon ? `${icon} ` : ''}{item.name}</span>
                      <button
                        onClick={() => handleRemoveItem(day, mealType, itemId)}
                        className="text-ink/30 hover:text-accent ml-1 shrink-0"
                      >
                        &times;
                      </button>
                    </div>
                    {countable && (
                      <div className="flex items-center gap-0.5 mt-0.5 justify-end">
                        <button
                          onClick={() => handleQtyChange(itemId, -1)}
                          className="w-4 h-4 rounded text-[9px] border border-ink/15 hover:bg-primary-light text-ink/60"
                        >
                          -
                        </button>
                        <span className="text-[9px] text-ink/60 w-3 text-center font-medium">
                          {quantities[itemId] || item.defaultQty || 2}
                        </span>
                        <button
                          onClick={() => handleQtyChange(itemId, 1)}
                          className="w-4 h-4 rounded text-[9px] border border-ink/15 hover:bg-primary-light text-ink/60"
                        >
                          +
                        </button>
                      </div>
                    )}
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
      const isDaySkip = skipDays.includes(day);
      return (
        <td key={`${day}-${mealType}`} className="p-1 align-top">
          <div className="bg-gray-50 border border-gray-200 rounded-lg min-h-[70px] flex items-center justify-center text-xs text-gray-300 relative group">
            skipped
            <button
              onClick={() => handleUnskip(day, isDaySkip ? 'day' : mealType)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-200 text-gray-400 hover:bg-accent hover:text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              title={isDaySkip ? `Unskip ${day}` : 'Unskip this slot'}
            >
              &times;
            </button>
          </div>
        </td>
      );
    }

    const mealId = plan?.[day]?.[mealType];
    const meal = findMeal(mealId);
    const overriddenBase = baseOverrides[`${day}-${mealType}`] ?? meal?.base;
    const isAiPlaced = aiPlacedSlots.has(`${day}-${mealType}`);
    const isDragTarget = dragOver === `${day}-${mealType}`;
    const mealWithOverrides = meal
      ? { ...meal, qty: quantities[mealId], base: overriddenBase }
      : null;

    return (
      <td key={`${day}-${mealType}`} className="p-1 align-top">
        <div
          className={`rounded-lg min-h-[70px] p-1 transition-colors ${
            isDragTarget
              ? 'bg-primary-light/30 border-2 border-primary'
              : isAiPlaced
                ? 'bg-purple-50 border-2 border-purple-300'
                : 'bg-cream/50 border border-ink/10'
          }`}
          draggable={!!mealWithOverrides}
          onDragStart={() => mealWithOverrides && handleDragStart(day, mealType, mealId)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, day, mealType)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(day, mealType)}
        >
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
              sideName={meal?.suggestedSide ? (masterMeals?.sides || []).find((s) => s.id === meal.suggestedSide)?.name : undefined}
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
          freshAiSuggestions={freshAiSuggestions || []}
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
