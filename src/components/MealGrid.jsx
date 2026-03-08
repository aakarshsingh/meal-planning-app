import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import MealCard from './MealCard';
import SwapModal from './SwapModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };
const MEAL_ROWS = ['breakfast', 'lunch', 'dinner', 'fruit'];
const ROW_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', fruit: 'Fruit' };

function DroppableCell({ id, children, isSkipped, isOver }) {
  const { setNodeRef, isOver: cellIsOver } = useDroppable({ id });
  const highlight = isOver || cellIsOver;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-lg p-1 transition-all ${
        isSkipped
          ? 'bg-gray-50 border border-gray-200'
          : highlight
            ? 'bg-amber-100 border-2 border-dashed border-amber-400'
            : 'bg-amber-50/50 border border-amber-100'
      }`}
    >
      {isSkipped ? (
        <div className="h-full flex items-center justify-center text-xs text-gray-300">
          skipped
        </div>
      ) : children ? (
        children
      ) : (
        <div className="h-full flex items-center justify-center text-xs text-amber-300 border border-dashed border-amber-200 rounded-md m-0.5">
          Drop meal
        </div>
      )}
    </div>
  );
}

function TrashZone({ isOver }) {
  const { setNodeRef, isOver: trashIsOver } = useDroppable({ id: 'trash-zone' });
  const active = isOver || trashIsOver;

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 py-4 rounded-xl border-2 border-dashed text-center transition-all ${
        active
          ? 'border-red-400 bg-red-50 text-red-500'
          : 'border-gray-200 bg-gray-50 text-gray-400'
      }`}
    >
      <span className="text-2xl">{'\u{1F5D1}\u{FE0F}'}</span>
      <p className="text-sm mt-1">{active ? 'Drop to remove' : 'Drag here to remove'}</p>
    </div>
  );
}

function MealGrid({ leftovers, preferences, plan, setPlan, onBack }) {
  const [masterMeals, setMasterMeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [quantities, setQuantities] = useState({});

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

  // Generate plan on mount
  useEffect(() => {
    setLoading(true);
    fetch('/api/suggest/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leftovers, preferences }),
    })
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // AI plan (async enhancement)
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
        }
        setAiLoading(false);
      })
      .catch(() => setAiLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const findMeal = useCallback(
    (mealId) => {
      if (!masterMeals || !mealId) return null;
      return (
        masterMeals.breakfasts?.find((b) => b.id === mealId) ||
        masterMeals.meals?.find((m) => m.id === mealId) ||
        masterMeals.fruits?.find((f) => f.id === mealId)
      );
    },
    [masterMeals]
  );

  function isSlotSkipped(day, mealType) {
    if (skipDays.includes(day)) return true;
    return skipMeals.some((s) => s.day === day && s.mealType === mealType);
  }

  // Parse drag ID: "cell-Monday-lunch" or "tray-meal-04"
  function parseDragId(dragId) {
    if (!dragId) return null;
    if (dragId.startsWith('cell-')) {
      const parts = dragId.split('-');
      const day = parts[1];
      const mealType = parts[2];
      return { type: 'cell', day, mealType };
    }
    if (dragId.startsWith('tray-')) {
      return { type: 'tray', mealId: dragId.slice(5) };
    }
    return null;
  }

  function getMealIdFromSlot(day, mealType) {
    if (!plan || !plan[day]) return null;
    if (mealType === 'fruit') {
      return plan[day].fruit?.[0] || null;
    }
    return plan[day][mealType];
  }

  function handleDragStart(event) {
    setActiveDragId(event.active.id);
  }

  function handleDragEnd(event) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !plan) return;

    const source = parseDragId(active.id);
    if (!source) return;

    // Dropped on trash
    if (over.id === 'trash-zone') {
      if (source.type === 'cell') {
        const newPlan = { ...plan };
        newPlan[source.day] = { ...newPlan[source.day] };
        if (source.mealType === 'fruit') {
          newPlan[source.day].fruit = [];
        } else {
          newPlan[source.day][source.mealType] = null;
        }
        setPlan(newPlan);
      }
      return;
    }

    // Dropped on a cell
    const target = parseDragId(over.id);
    if (!target || target.type !== 'cell') return;
    if (isSlotSkipped(target.day, target.mealType)) return;

    const newPlan = { ...plan };
    for (const d of DAYS) {
      newPlan[d] = { ...newPlan[d] };
    }

    if (source.type === 'tray') {
      // Replace target cell with tray meal
      if (target.mealType === 'fruit') {
        const current = newPlan[target.day].fruit || [];
        if (current.length < 2 && !current.includes(source.mealId)) {
          newPlan[target.day].fruit = [...current, source.mealId];
        } else if (!current.includes(source.mealId)) {
          newPlan[target.day].fruit = [source.mealId];
        }
      } else {
        newPlan[target.day][target.mealType] = source.mealId;
      }
    } else if (source.type === 'cell') {
      // Swap the two cells
      if (source.mealType === 'fruit' && target.mealType === 'fruit') {
        const temp = newPlan[source.day].fruit;
        newPlan[source.day].fruit = newPlan[target.day].fruit;
        newPlan[target.day].fruit = temp;
      } else if (source.mealType !== 'fruit' && target.mealType !== 'fruit') {
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
    if (mealType === 'fruit') {
      newPlan[day].fruit = [mealId];
    } else {
      newPlan[day][mealType] = mealId;
    }
    setPlan(newPlan);
    setSwapTarget(null);
  }

  function handleRemove(day, mealType) {
    if (!plan) return;
    const newPlan = { ...plan };
    newPlan[day] = { ...newPlan[day] };
    if (mealType === 'fruit') {
      newPlan[day].fruit = [];
    } else {
      newPlan[day][mealType] = null;
    }
    setPlan(newPlan);
  }

  function handleQtyChange(mealId, delta) {
    setQuantities((prev) => {
      const meal = findMeal(mealId);
      const base = meal?.defaultQty || 2;
      const current = prev[mealId] || base;
      return { ...prev, [mealId]: Math.max(1, current + delta) };
    });
  }

  function useAiPlan() {
    if (aiPlan) {
      setPlan(aiPlan);
      setAiPlan(null);
    }
  }

  // Build suggestion tray: meals not currently in the plan
  const usedMealIds = new Set();
  if (plan) {
    for (const day of DAYS) {
      if (!plan[day]) continue;
      if (plan[day].breakfast) usedMealIds.add(plan[day].breakfast);
      if (plan[day].lunch) usedMealIds.add(plan[day].lunch);
      if (plan[day].dinner) usedMealIds.add(plan[day].dinner);
      for (const f of plan[day].fruit || []) usedMealIds.add(f);
    }
  }

  const trayMeals = masterMeals?.meals?.filter((m) => !usedMealIds.has(m.id)) || [];
  const trayFruits = masterMeals?.fruits?.filter((f) => !usedMealIds.has(f.id)) || [];

  // Active drag overlay
  const activeDragSource = parseDragId(activeDragId);
  let activeDragMeal = null;
  if (activeDragSource) {
    if (activeDragSource.type === 'tray') {
      activeDragMeal = findMeal(activeDragSource.mealId);
    } else if (activeDragSource.type === 'cell') {
      const id = getMealIdFromSlot(activeDragSource.day, activeDragSource.mealType);
      activeDragMeal = findMeal(id);
    }
  }

  if (loading || !masterMeals) {
    return (
      <div className="flex flex-col items-center py-12 gap-3">
        <div className="animate-spin w-8 h-8 border-4 border-amber-300 border-t-amber-600 rounded-full" />
        <p className="text-sm text-amber-500">Generating your meal plan...</p>
      </div>
    );
  }

  const allDragIds = [];
  for (const day of DAYS) {
    for (const mt of MEAL_ROWS) {
      allDragIds.push(`cell-${day}-${mt}`);
    }
  }
  for (const m of trayMeals) allDragIds.push(`tray-${m.id}`);
  for (const f of trayFruits) allDragIds.push(`tray-${f.id}`);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allDragIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {/* AI plan banner */}
          {aiPlan && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
              <p className="text-sm text-purple-700">AI-generated plan available</p>
              <button
                onClick={useAiPlan}
                className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors"
              >
                Use AI suggestion
              </button>
            </div>
          )}
          {aiLoading && (
            <div className="flex items-center gap-2 text-xs text-purple-400 justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full" />
              Generating AI plan...
            </div>
          )}

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
                        skipDays.includes(day) ? 'text-gray-300 bg-gray-50' : 'text-amber-700 bg-amber-100'
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
                      <span className="text-xs font-medium text-amber-500">
                        {ROW_LABELS[mealType]}
                      </span>
                    </div>
                    {DAYS.map((day) => {
                      const skipped = isSlotSkipped(day, mealType);
                      const cellId = `cell-${day}-${mealType}`;

                      if (mealType === 'fruit') {
                        const fruitIds = plan?.[day]?.fruit || [];
                        return (
                          <DroppableCell key={cellId} id={cellId} isSkipped={skipped}>
                            {fruitIds.length > 0 ? (
                              <div className="flex flex-col gap-1 p-0.5">
                                {fruitIds.map((fid) => {
                                  const fruit = findMeal(fid);
                                  return fruit ? (
                                    <div
                                      key={fid}
                                      className="flex items-center justify-between px-1.5 py-1 rounded bg-green-50 border border-green-200 text-xs text-green-800"
                                    >
                                      <span className="truncate">{'\u{1F34E}'} {fruit.name}</span>
                                      <button
                                        onClick={() => {
                                          const newPlan = { ...plan };
                                          newPlan[day] = { ...newPlan[day] };
                                          newPlan[day].fruit = fruitIds.filter((id) => id !== fid);
                                          setPlan(newPlan);
                                        }}
                                        className="text-green-400 hover:text-red-500 ml-1"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            ) : null}
                          </DroppableCell>
                        );
                      }

                      const mealId = plan?.[day]?.[mealType];
                      const meal = findMeal(mealId);
                      const mealWithQty = meal
                        ? { ...meal, qty: quantities[mealId] }
                        : null;

                      return (
                        <DroppableCell key={cellId} id={cellId} isSkipped={skipped}>
                          {mealWithQty && (
                            <MealCard
                              id={mealId}
                              meal={mealWithQty}
                              dragId={cellId}
                              onRemove={() => handleRemove(day, mealType)}
                              onSwap={() => setSwapTarget({ day, mealType })}
                              onQtyChange={(delta) => handleQtyChange(mealId, delta)}
                            />
                          )}
                        </DroppableCell>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Suggestion tray sidebar */}
            <div className="w-44 shrink-0 hidden lg:block">
              <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3 sticky top-4 max-h-[70vh] overflow-y-auto">
                <h3 className="text-xs font-semibold text-amber-700 mb-2">Suggestions</h3>
                {trayMeals.length === 0 && trayFruits.length === 0 ? (
                  <p className="text-xs text-amber-300 text-center py-4">All meals planned!</p>
                ) : (
                  <div className="space-y-1.5">
                    {trayMeals.map((m) => (
                      <MealCard
                        key={m.id}
                        id={m.id}
                        meal={m}
                        dragId={`tray-${m.id}`}
                        compact
                      />
                    ))}
                    {trayFruits.length > 0 && (
                      <>
                        <div className="border-t border-amber-100 pt-1.5 mt-1.5">
                          <span className="text-[10px] text-amber-400 uppercase font-medium">Fruits</span>
                        </div>
                        {trayFruits.map((f) => (
                          <MealCard
                            key={f.id}
                            id={f.id}
                            meal={{ ...f, type: 'fruit' }}
                            dragId={`tray-${f.id}`}
                            compact
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trash zone */}
          <TrashZone isOver={false} />

          {/* Back button */}
          <div className="flex justify-start pt-2">
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </SortableContext>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragMeal ? (
          <div className="px-3 py-2 rounded-lg bg-white shadow-lg border border-amber-300 text-sm text-amber-900 opacity-90">
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
          onSelect={handleSwapSelect}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </DndContext>
  );
}

export default MealGrid;
