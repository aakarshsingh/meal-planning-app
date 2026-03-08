import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
} from '@dnd-kit/core';
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

function DroppableCell({ id, children, isSkipped, onClick, isPlaceTarget }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`min-h-[80px] rounded-lg p-1 transition-all ${
        isSkipped
          ? 'bg-gray-50 border border-gray-200'
          : isPlaceTarget
            ? 'bg-gold-light border-2 border-dashed border-gold animate-pulse cursor-pointer'
            : isOver
              ? 'bg-primary-light border-2 border-dashed border-primary'
              : 'bg-cream/50 border border-ink/10'
      }`}
    >
      {isSkipped ? (
        <div className="h-full flex items-center justify-center text-xs text-gray-300">
          skipped
        </div>
      ) : children ? (
        children
      ) : (
        <div className="h-full flex items-center justify-center text-xs text-ink/30 border border-dashed border-ink/10 rounded-md m-0.5 hover:bg-primary-light hover:text-primary cursor-pointer min-h-[60px]">
          + Add
        </div>
      )}
    </div>
  );
}

function TrashZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'trash-zone' });

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 py-4 rounded-xl border-2 border-dashed text-center transition-all ${
        isOver
          ? 'border-accent bg-accent-light text-accent'
          : 'border-ink/15 bg-ink/5 text-ink/40'
      }`}
    >
      <span className="text-2xl">{'\u{1F5D1}\u{FE0F}'}</span>
      <p className="text-sm mt-1">{isOver ? 'Drop to remove' : 'Drag here to remove'}</p>
    </div>
  );
}

function DraggableTrayItem({ id, children, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
    >
      {children}
    </div>
  );
}

function MealGrid({ leftovers, preferences, plan, setPlan, onBack, toastRef }) {
  const [masterMeals, setMasterMeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [aiOverrideUsed, setAiOverrideUsed] = useState(false);
  const [freshAiSuggestions, setFreshAiSuggestions] = useState([]);
  const [activeDragId, setActiveDragId] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [baseOverrides, setBaseOverrides] = useState({});
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [placingMealId, setPlacingMealId] = useState(null);
  const initialPlanRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const { skipDays = [], skipMeals = [] } = preferences;

  // Load master meals
  useEffect(() => {
    fetch('/api/meals')
      .then((r) => r.json())
      .then((data) => setMasterMeals(data))
      .catch(() => {});
  }, []);

  // Escape key cancels placement mode
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') setPlacingMealId(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Generate plan on mount
  useEffect(() => {
    if (plan) {
      setLoading(false);
      if (!initialPlanRef.current) initialPlanRef.current = JSON.parse(JSON.stringify(plan));
      if (!aiPlan && !aiFailed) {
        setAiLoading(true);
        fetch('/api/ai/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leftovers, preferences }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.plan && data.source === 'ai') setAiPlan(data.plan);
            setAiLoading(false);
          })
          .catch(() => { setAiLoading(false); setAiFailed(true); });
      }
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
          setPlan((prevPlan) => {
            if (!prevPlan) return data.plan;
            const merged = { ...prevPlan };
            for (const day of DAYS) {
              merged[day] = { ...merged[day] };
              if (!merged[day].lunch && data.plan[day]?.lunch) merged[day].lunch = data.plan[day].lunch;
              if (!merged[day].dinner && data.plan[day]?.dinner) merged[day].dinner = data.plan[day].dinner;
            }
            initialPlanRef.current = JSON.parse(JSON.stringify(merged));
            return merged;
          });
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

  function parseDragId(dragId) {
    if (!dragId || typeof dragId !== 'string') return null;
    if (dragId.startsWith('cell-')) {
      const parts = dragId.split('-');
      return { type: 'cell', day: parts[1], mealType: parts[2] };
    }
    if (dragId.startsWith('tray-')) {
      return { type: 'tray', mealId: dragId.slice(5) };
    }
    return null;
  }

  function getMealCategory(mealId) {
    if (!masterMeals || !mealId) return null;
    if (masterMeals.breakfasts?.some((b) => b.id === mealId)) return 'breakfast';
    if ((masterMeals.drinks || []).some((d) => d.id === mealId)) return 'drinks';
    if (masterMeals.fruits?.some((f) => f.id === mealId)) return 'fruit';
    return 'meal';
  }

  // Get items for a visual row
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

  // Check if a meal can be placed in a row
  function isCompatibleRow(mealId, rowType) {
    const category = getMealCategory(mealId);
    if (rowType === 'morning') return category === 'breakfast' || category === 'drinks';
    if (rowType === 'fruit') return category === 'fruit';
    if (rowType === 'lunch' || rowType === 'dinner') return category === 'meal';
    return false;
  }

  // Check if a cell is a valid placement target
  function isPlaceTarget(day, mealType) {
    if (!placingMealId || isSlotSkipped(day, mealType)) return false;
    if (!isCompatibleRow(placingMealId, mealType)) return false;
    const items = getSlotItems(day, mealType);
    if (mealType === 'morning') return items.length < 4 && !items.includes(placingMealId);
    if (mealType === 'fruit') return items.length < 2 && !items.includes(placingMealId);
    return items.length === 0;
  }

  function handlePlaceClick(day, mealType) {
    if (!placingMealId || !plan) return;
    if (!isPlaceTarget(day, mealType)) return;

    const category = getMealCategory(placingMealId);
    const newPlan = { ...plan };
    newPlan[day] = { ...newPlan[day] };

    if (mealType === 'morning') {
      if (category === 'breakfast') {
        const current = Array.isArray(newPlan[day].breakfast) ? newPlan[day].breakfast : [];
        newPlan[day].breakfast = [...current, placingMealId];
      } else if (category === 'drinks') {
        const current = Array.isArray(newPlan[day].drinks) ? newPlan[day].drinks : [];
        newPlan[day].drinks = [...current, placingMealId];
      }
    } else if (mealType === 'fruit') {
      const current = newPlan[day].fruit || [];
      newPlan[day].fruit = [...current, placingMealId];
    } else {
      newPlan[day][mealType] = placingMealId;
    }

    setPlan(newPlan);
    setPlacingMealId(null);
  }

  function handleDragStart(event) {
    setActiveDragId(event.active.id);
    setPlacingMealId(null);
  }

  function handleDragEnd(event) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !plan) return;

    const source = parseDragId(active.id);
    if (!source) return;

    if (over.id === 'trash-zone') {
      if (source.type === 'cell') {
        const newPlan = { ...plan };
        newPlan[source.day] = { ...newPlan[source.day] };
        if (source.mealType === 'morning') {
          newPlan[source.day].breakfast = [];
          newPlan[source.day].drinks = [];
        } else if (source.mealType === 'fruit') {
          newPlan[source.day].fruit = [];
        } else {
          newPlan[source.day][source.mealType] = null;
        }
        setPlan(newPlan);
      }
      return;
    }

    const targetId = typeof over.id === 'string' ? over.id : '';
    const target = parseDragId(targetId);
    if (!target || target.type !== 'cell') return;
    if (isSlotSkipped(target.day, target.mealType)) return;

    if (source.type === 'tray') {
      if (!isCompatibleRow(source.mealId, target.mealType)) return;
    }
    if (source.type === 'cell') {
      if (source.mealType !== target.mealType) return;
    }

    const newPlan = { ...plan };
    for (const d of DAYS) newPlan[d] = { ...newPlan[d] };

    if (source.type === 'tray') {
      const category = getMealCategory(source.mealId);
      if (target.mealType === 'morning') {
        if (category === 'breakfast') {
          const current = Array.isArray(newPlan[target.day].breakfast) ? newPlan[target.day].breakfast : [];
          if (current.length < 2 && !current.includes(source.mealId)) {
            newPlan[target.day].breakfast = [...current, source.mealId];
          }
        } else if (category === 'drinks') {
          const current = Array.isArray(newPlan[target.day].drinks) ? newPlan[target.day].drinks : [];
          if (current.length < 2 && !current.includes(source.mealId)) {
            newPlan[target.day].drinks = [...current, source.mealId];
          }
        }
      } else if (target.mealType === 'fruit') {
        const current = newPlan[target.day].fruit || [];
        if (current.length < 2 && !current.includes(source.mealId)) {
          newPlan[target.day].fruit = [...current, source.mealId];
        }
      } else {
        newPlan[target.day][target.mealType] = source.mealId;
      }
    } else if (source.type === 'cell') {
      if (source.mealType === 'morning') {
        const tempBf = newPlan[source.day].breakfast;
        const tempDr = newPlan[source.day].drinks;
        newPlan[source.day].breakfast = newPlan[target.day].breakfast;
        newPlan[source.day].drinks = newPlan[target.day].drinks;
        newPlan[target.day].breakfast = tempBf;
        newPlan[target.day].drinks = tempDr;
      } else if (source.mealType === 'fruit') {
        const temp = newPlan[source.day].fruit;
        newPlan[source.day].fruit = newPlan[target.day].fruit;
        newPlan[target.day].fruit = temp;
      } else {
        const temp = newPlan[source.day][source.mealType];
        newPlan[source.day][source.mealType] = newPlan[target.day][target.mealType];
        newPlan[target.day][target.mealType] = temp;
      }
    }

    setPlan(newPlan);
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
      }
    } else if (mealType === 'fruit') {
      newPlan[day].fruit = [mealId];
    } else {
      newPlan[day][mealType] = mealId;
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

  function handleQuickAdd() {
    const name = quickAddText.trim();
    if (!name) return;
    setQuickAddSaving(true);

    const nextNum = (masterMeals?.meals?.length || 0) + 1;
    const newMeal = {
      id: `meal-${String(nextNum).padStart(2, '0')}`,
      name,
      type: 'veg',
      slot: 'flexible',
      base: 'rice',
      ingredients: [],
    };

    fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMeal),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then(() => {
        handleMasterMealAdd(newMeal);
        setQuickAddText('');
        setQuickAddSaving(false);
        toastRef?.current?.success(`Added "${name}" to meals`);
      })
      .catch(() => {
        setQuickAddSaving(false);
        toastRef?.current?.error('Failed to add meal');
      });
  }

  function handleTrayClick(mealId) {
    if (placingMealId === mealId) {
      setPlacingMealId(null);
    } else {
      setPlacingMealId(mealId);
    }
  }

  // Build suggestion tray
  const usedMealIds = new Set();
  if (plan) {
    for (const day of DAYS) {
      if (!plan[day]) continue;
      const bfIds = Array.isArray(plan[day].breakfast) ? plan[day].breakfast : (plan[day].breakfast ? [plan[day].breakfast] : []);
      for (const id of bfIds) usedMealIds.add(id);
      const drinkIds = Array.isArray(plan[day].drinks) ? plan[day].drinks : (plan[day].drinks ? [plan[day].drinks] : []);
      for (const id of drinkIds) usedMealIds.add(id);
      if (plan[day].lunch) usedMealIds.add(plan[day].lunch);
      if (plan[day].dinner) usedMealIds.add(plan[day].dinner);
      for (const f of plan[day].fruit || []) usedMealIds.add(f);
    }
  }

  const trayMeals = masterMeals?.meals?.filter((m) => !usedMealIds.has(m.id)) || [];
  const trayFruits = masterMeals?.fruits?.filter((f) => !usedMealIds.has(f.id)) || [];
  const trayBreakfasts = masterMeals?.breakfasts?.filter((b) => !usedMealIds.has(b.id)) || [];
  const trayDrinks = (masterMeals?.drinks || []).filter((d) => !usedMealIds.has(d.id));

  const aiSuggestionMeals = useMemo(() => {
    if (!aiPlan || !masterMeals || !plan) return [];
    const aiMealIds = new Set();
    const currentMealIds = new Set();

    for (const day of DAYS) {
      if (plan[day]) {
        if (plan[day].lunch) currentMealIds.add(plan[day].lunch);
        if (plan[day].dinner) currentMealIds.add(plan[day].dinner);
      }
      if (aiPlan[day]) {
        if (aiPlan[day].lunch) aiMealIds.add(aiPlan[day].lunch);
        if (aiPlan[day].dinner) aiMealIds.add(aiPlan[day].dinner);
      }
    }

    const uniqueAiIds = [...aiMealIds].filter((id) => !currentMealIds.has(id) && !usedMealIds.has(id));
    return uniqueAiIds.map((id) => findMeal(id)).filter(Boolean).slice(0, 5);
  }, [aiPlan, plan, masterMeals, usedMealIds, findMeal]);

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

  const activeDragSource = parseDragId(activeDragId);
  let activeDragMeal = null;
  if (activeDragSource) {
    if (activeDragSource.type === 'tray') {
      activeDragMeal = findMeal(activeDragSource.mealId);
    } else if (activeDragSource.type === 'cell') {
      const items = getSlotItems(activeDragSource.day, activeDragSource.mealType);
      activeDragMeal = findMeal(items[0]);
    }
  }

  if (loading || !masterMeals) {
    return (
      <div className="flex flex-col items-center py-12 gap-3">
        <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
        <p className="text-sm text-ink/50">Generating your meal plan...</p>
      </div>
    );
  }

  // Helper to render morning (breakfast + drinks combined) and fruit rows
  function renderArrayCell(day, mealType, cellId, skipped) {
    const items = getSlotItems(day, mealType);
    const placeTarget = isPlaceTarget(day, mealType);

    return (
      <DroppableCell
        key={cellId}
        id={cellId}
        isSkipped={skipped}
        isPlaceTarget={placeTarget}
        onClick={
          placeTarget
            ? () => handlePlaceClick(day, mealType)
            : !skipped && items.length === 0
              ? () => setSwapTarget({ day, mealType })
              : undefined
        }
      >
        {items.length > 0 ? (
          <div className="flex flex-col gap-1 p-0.5">
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
                    className="text-ink/30 hover:text-accent ml-1"
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
        ) : null}
      </DroppableCell>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Status indicators */}
        {aiLoading && (
          <div className="flex items-center gap-2 text-xs text-purple-400 justify-center py-1">
            <div className="animate-spin w-3.5 h-3.5 border-2 border-purple-200 border-t-purple-500 rounded-full" />
            AI is thinking...
          </div>
        )}
        {aiFailed && !aiLoading && (
          <div className="text-center text-xs text-ink/40 py-1">
            AI suggestions unavailable — using rule-based plan
          </div>
        )}

        {/* Placement mode indicator */}
        {placingMealId && (
          <div className="flex items-center justify-center gap-2 py-2 bg-gold-light rounded-lg border border-gold/30">
            <span className="text-xs text-ink/70">Click a highlighted cell to place <strong>{findMeal(placingMealId)?.name}</strong></span>
            <button
              onClick={() => setPlacingMealId(null)}
              className="text-xs text-ink/40 hover:text-accent px-2 py-0.5 rounded border border-ink/15"
            >
              Cancel
            </button>
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

        <div className="flex gap-4">
          {/* Main grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header row */}
              <div className="grid grid-cols-[80px_repeat(6,1fr)] gap-1 mb-1">
                <div />
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className={`text-center text-xs font-semibold py-2 rounded-t-lg ${
                      skipDays.includes(day) ? 'text-gray-300 bg-gray-50' : 'text-ink bg-primary-light'
                    }`}
                  >
                    {DAY_SHORT[day]}
                  </div>
                ))}
              </div>

              {/* Meal rows */}
              {MEAL_ROWS.map((mealType) => (
                <div key={mealType} className="grid grid-cols-[80px_repeat(6,1fr)] gap-1 mb-1">
                  <div className="flex items-center justify-end pr-2">
                    <span className="text-xs font-medium text-ink/50">
                      {ROW_LABELS[mealType]}
                    </span>
                  </div>
                  {DAYS.map((day) => {
                    const skipped = isSlotSkipped(day, mealType);
                    const cellId = `cell-${day}-${mealType}`;

                    // Array-based rows: morning (breakfast+drinks), fruit
                    if (mealType === 'morning' || mealType === 'fruit') {
                      return renderArrayCell(day, mealType, cellId, skipped);
                    }

                    // Single-meal rows: lunch, dinner
                    const mealId = plan?.[day]?.[mealType];
                    const meal = findMeal(mealId);
                    const overriddenBase = baseOverrides[`${day}-${mealType}`] || meal?.base;
                    const mealWithQty = meal
                      ? { ...meal, qty: quantities[mealId], base: overriddenBase }
                      : null;
                    const placeTarget = isPlaceTarget(day, mealType);

                    return (
                      <DroppableCell
                        key={cellId}
                        id={cellId}
                        isSkipped={skipped}
                        isPlaceTarget={placeTarget}
                        onClick={
                          placeTarget
                            ? () => handlePlaceClick(day, mealType)
                            : !skipped && !mealWithQty
                              ? () => setSwapTarget({ day, mealType })
                              : undefined
                        }
                      >
                        {mealWithQty && (
                          <MealCard
                            id={mealId}
                            meal={mealWithQty}
                            dragId={cellId}
                            onRemove={() => handleRemove(day, mealType)}
                            onSwap={() => setSwapTarget({ day, mealType })}
                            onQtyChange={(delta) => handleQtyChange(mealId, delta)}
                            onBaseChange={meal?.base ? (newBase) => handleBaseChange(day, mealType, mealId, newBase) : undefined}
                          />
                        )}
                      </DroppableCell>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Suggestion tray sidebar (desktop) */}
          <div className="w-48 shrink-0 hidden lg:block">
            <div className="bg-white rounded-xl border border-ink/10 shadow-sm p-3 sticky top-4 max-h-[70vh] overflow-y-auto">
              <h3 className="text-xs font-semibold text-ink/70 mb-2">Suggestions</h3>
              <p className="text-[10px] text-ink/40 mb-2">Click to place or drag</p>

              {/* Quick add */}
              <div className="flex gap-1 mb-3">
                <input
                  type="text"
                  value={quickAddText}
                  onChange={(e) => setQuickAddText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                  placeholder="New dish..."
                  className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-ink/15 focus:outline-none focus:ring-1 focus:ring-primary text-ink placeholder-ink/30"
                />
                <button
                  onClick={handleQuickAdd}
                  disabled={!quickAddText.trim() || quickAddSaving}
                  className="px-1.5 py-1 text-xs rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-40 transition-colors shrink-0"
                >
                  +
                </button>
              </div>

              {/* AI-suggested meals */}
              {aiSuggestionMeals.length > 0 && (
                <>
                  <div className="mb-1.5">
                    <span className="text-[10px] text-purple-500 uppercase font-medium">AI Picks</span>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {aiSuggestionMeals.map((m) => (
                      <DraggableTrayItem key={`ai-${m.id}`} id={`tray-${m.id}`} onClick={() => handleTrayClick(m.id)}>
                        <TrayChip meal={m} aiPick active={placingMealId === m.id} />
                      </DraggableTrayItem>
                    ))}
                  </div>
                  <div className="border-t border-ink/10 pt-1.5 mb-1.5">
                    <span className="text-[10px] text-ink/40 uppercase font-medium">Other Meals</span>
                  </div>
                </>
              )}

              {trayMeals.length === 0 && trayFruits.length === 0 && trayDrinks.length === 0 && trayBreakfasts.length === 0 && aiSuggestionMeals.length === 0 ? (
                <p className="text-xs text-ink/30 text-center py-4">All meals planned!</p>
              ) : (
                <div className="space-y-1.5">
                  {trayMeals.filter((m) => !aiSuggestionMeals.some((ai) => ai.id === m.id)).map((m) => (
                    <DraggableTrayItem key={m.id} id={`tray-${m.id}`} onClick={() => handleTrayClick(m.id)}>
                      <TrayChip meal={m} active={placingMealId === m.id} />
                    </DraggableTrayItem>
                  ))}
                  {(trayBreakfasts.length > 0 || trayDrinks.length > 0) && (
                    <>
                      <div className="border-t border-ink/10 pt-1.5 mt-1.5">
                        <span className="text-[10px] text-ink/40 uppercase font-medium">Breakfast & Drinks</span>
                      </div>
                      {trayBreakfasts.map((b) => (
                        <DraggableTrayItem key={b.id} id={`tray-${b.id}`} onClick={() => handleTrayClick(b.id)}>
                          <TrayChip meal={{ ...b, type: 'breakfast' }} active={placingMealId === b.id} />
                        </DraggableTrayItem>
                      ))}
                      {trayDrinks.map((d) => (
                        <DraggableTrayItem key={d.id} id={`tray-${d.id}`} onClick={() => handleTrayClick(d.id)}>
                          <TrayChip meal={{ ...d, type: 'drink' }} active={placingMealId === d.id} />
                        </DraggableTrayItem>
                      ))}
                    </>
                  )}
                  {trayFruits.length > 0 && (
                    <>
                      <div className="border-t border-ink/10 pt-1.5 mt-1.5">
                        <span className="text-[10px] text-ink/40 uppercase font-medium">Fruits</span>
                      </div>
                      {trayFruits.map((f) => (
                        <DraggableTrayItem key={f.id} id={`tray-${f.id}`} onClick={() => handleTrayClick(f.id)}>
                          <TrayChip meal={{ ...f, type: 'fruit' }} active={placingMealId === f.id} />
                        </DraggableTrayItem>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Suggestion tray (mobile) */}
        <div className="lg:hidden bg-white rounded-xl border border-ink/10 shadow-sm p-3">
          <h3 className="text-xs font-semibold text-ink/70 mb-2">Available Meals <span className="font-normal text-ink/40">(tap to place)</span></h3>
          <div className="flex gap-1 mb-2">
            <input
              type="text"
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              placeholder="Add new dish..."
              className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-ink/15 focus:outline-none focus:ring-1 focus:ring-primary text-ink placeholder-ink/30"
            />
            <button
              onClick={handleQuickAdd}
              disabled={!quickAddText.trim() || quickAddSaving}
              className="px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-40 transition-colors shrink-0"
            >
              + Add
            </button>
          </div>

          {aiSuggestionMeals.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] text-purple-500 uppercase font-medium">AI Picks</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {aiSuggestionMeals.map((m) => (
                  <DraggableTrayItem key={`ai-${m.id}`} id={`tray-${m.id}`} onClick={() => handleTrayClick(m.id)}>
                    <TrayChip meal={m} aiPick active={placingMealId === m.id} />
                  </DraggableTrayItem>
                ))}
              </div>
            </div>
          )}

          {(trayMeals.length > 0 || trayFruits.length > 0 || trayDrinks.length > 0 || trayBreakfasts.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {trayMeals.filter((m) => !aiSuggestionMeals.some((ai) => ai.id === m.id)).map((m) => (
                <DraggableTrayItem key={m.id} id={`tray-${m.id}`} onClick={() => handleTrayClick(m.id)}>
                  <TrayChip meal={m} active={placingMealId === m.id} />
                </DraggableTrayItem>
              ))}
              {trayBreakfasts.map((b) => (
                <DraggableTrayItem key={b.id} id={`tray-${b.id}`} onClick={() => handleTrayClick(b.id)}>
                  <TrayChip meal={{ ...b, type: 'breakfast' }} active={placingMealId === b.id} />
                </DraggableTrayItem>
              ))}
              {trayDrinks.map((d) => (
                <DraggableTrayItem key={d.id} id={`tray-${d.id}`} onClick={() => handleTrayClick(d.id)}>
                  <TrayChip meal={{ ...d, type: 'drink' }} active={placingMealId === d.id} />
                </DraggableTrayItem>
              ))}
              {trayFruits.map((f) => (
                <DraggableTrayItem key={f.id} id={`tray-${f.id}`} onClick={() => handleTrayClick(f.id)}>
                  <TrayChip meal={{ ...f, type: 'fruit' }} active={placingMealId === f.id} />
                </DraggableTrayItem>
              ))}
            </div>
          )}

          {trayMeals.length === 0 && trayFruits.length === 0 && trayDrinks.length === 0 && trayBreakfasts.length === 0 && aiSuggestionMeals.length === 0 && (
            <p className="text-xs text-ink/30 text-center py-2">All meals planned!</p>
          )}
        </div>

        {/* Trash zone */}
        <TrashZone />

        {/* Back button */}
        <div className="flex justify-start pt-2">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-lg border border-ink/20 text-ink/70 hover:bg-primary-light transition-colors"
          >
            Back
          </button>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragMeal ? (
          <div className="px-3 py-2 rounded-lg bg-white shadow-lg border border-primary/30 text-sm text-ink opacity-90">
            {activeDragMeal.name}
          </div>
        ) : null}
      </DragOverlay>

      {/* Swap modal */}
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
    </DndContext>
  );
}

function TrayChip({ meal, aiPick, active }) {
  const TYPE_ICONS = { egg: '\u{1F95A}', chicken: '\u{1F357}' };
  const isFruit = meal.type === 'fruit';
  const isDrink = meal.type === 'drink';
  const isBreakfast = meal.type === 'breakfast';
  const isChicken = meal.type === 'chicken';
  const isEgg = meal.type === 'egg';
  const icon = isFruit
    ? (FRUIT_ICONS[meal.name] || '\u{1F34E}')
    : isDrink
      ? (DRINK_ICONS[meal.name] || '\u{2615}')
      : TYPE_ICONS[meal.type] || '';

  return (
    <div
      className={`px-2 py-1.5 rounded border text-xs cursor-grab active:cursor-grabbing truncate select-none transition-all ${
        active
          ? 'bg-gold-light border-gold text-ink ring-1 ring-gold'
          : aiPick
            ? 'bg-purple-50 border-purple-200 text-purple-800'
            : isFruit
              ? 'bg-green-50 border-green-200 text-green-800'
              : isDrink || isBreakfast
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : isChicken
                  ? 'bg-gold-light border-gold/30 text-ink'
                  : isEgg
                    ? 'bg-gold-light/50 border-gold/20 text-ink/80'
                    : 'bg-cream border-ink/15 text-ink'
      }`}
    >
      {icon ? `${icon} ` : ''}{meal.name}
      {meal.base && <span className="text-[9px] text-ink/40 ml-1 capitalize">({meal.base})</span>}
    </div>
  );
}

export default MealGrid;
