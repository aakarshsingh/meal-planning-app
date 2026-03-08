import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import MealCard from './MealCard';
import SwapModal from './SwapModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };
const MEAL_ROWS = ['breakfast', 'lunch', 'dinner', 'fruit'];
const ROW_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', fruit: 'Fruit' };

const FRUIT_ICONS = {
  'Guava': '\u{1F34F}',
  'Pomegranate': '\u{1F9C3}',
  'Apple': '\u{1F34E}',
  'Kiwi': '\u{1F95D}',
  'Grapes': '\u{1F347}',
  'Strawberry': '\u{1F353}',
};

function DroppableCell({ id, children, isSkipped }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-lg p-1 transition-all ${
        isSkipped
          ? 'bg-gray-50 border border-gray-200'
          : isOver
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

function TrashZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'trash-zone' });

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 py-4 rounded-xl border-2 border-dashed text-center transition-all ${
        isOver
          ? 'border-red-400 bg-red-50 text-red-500'
          : 'border-gray-200 bg-gray-50 text-gray-400'
      }`}
    >
      <span className="text-2xl">{'\u{1F5D1}\u{FE0F}'}</span>
      <p className="text-sm mt-1">{isOver ? 'Drop to remove' : 'Drag here to remove'}</p>
    </div>
  );
}

function DraggableTrayItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
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
  const [activeDragId, setActiveDragId] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

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

  // Generate plan on mount — ONE AI call here (the only AI call on Screen 3 load)
  useEffect(() => {
    if (plan) {
      setLoading(false);
      // Still fire AI call for alternative suggestions even when resuming
      if (!aiPlan && !aiFailed) {
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
          .catch(() => {
            setAiLoading(false);
            setAiFailed(true);
          });
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
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toastRef?.current?.error('Failed to generate meal plan');
      });

    // AI plan (async, single call)
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
      .catch(() => {
        setAiLoading(false);
        setAiFailed(true);
      });
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

  function parseDragId(dragId) {
    if (!dragId) return null;
    if (typeof dragId !== 'string') return null;
    if (dragId.startsWith('cell-')) {
      const parts = dragId.split('-');
      return { type: 'cell', day: parts[1], mealType: parts[2] };
    }
    if (dragId.startsWith('tray-')) {
      return { type: 'tray', mealId: dragId.slice(5) };
    }
    return null;
  }

  function getMealIdFromSlot(day, mealType) {
    if (!plan || !plan[day]) return null;
    if (mealType === 'fruit') return plan[day].fruit?.[0] || null;
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

    const targetId = typeof over.id === 'string' ? over.id : '';
    const target = parseDragId(targetId);
    if (!target || target.type !== 'cell') return;
    if (isSlotSkipped(target.day, target.mealType)) return;

    const newPlan = { ...plan };
    for (const d of DAYS) newPlan[d] = { ...newPlan[d] };

    if (source.type === 'tray') {
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

  function handleBaseChange(day, mealType, mealId, newBase) {
    toastRef?.current?.info(`Base changed to ${newBase} (visual only — meal stays the same)`);
  }

  function useAiPlan() {
    if (aiPlan) {
      setPlan(aiPlan);
      setAiPlan(null);
    }
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
        setMasterMeals((prev) => ({
          ...prev,
          meals: [...(prev?.meals || []), newMeal],
        }));
        setQuickAddText('');
        setQuickAddSaving(false);
        toastRef?.current?.success(`Added "${name}" to meals`);
      })
      .catch(() => {
        setQuickAddSaving(false);
        toastRef?.current?.error('Failed to add meal');
      });
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

  // Extract AI-only suggestions: meals in the AI plan that differ from the current plan
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

    // Meals the AI picked that aren't in the current plan
    const uniqueAiIds = [...aiMealIds].filter((id) => !currentMealIds.has(id) && !usedMealIds.has(id));
    return uniqueAiIds
      .map((id) => findMeal(id))
      .filter(Boolean)
      .slice(0, 5); // Show max 5 AI suggestions
  }, [aiPlan, plan, masterMeals, usedMealIds, findMeal]);

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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* AI plan banner */}
        {aiPlan && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">AI-generated plan available</p>
              <p className="text-xs text-purple-400 mt-0.5">Replace current plan with AI's suggestion</p>
            </div>
            <button
              onClick={useAiPlan}
              className="px-3 py-1.5 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors shrink-0"
            >
              Use AI Plan
            </button>
          </div>
        )}
        {aiLoading && (
          <div className="flex items-center gap-2 text-xs text-purple-400 justify-center py-1">
            <div className="animate-spin w-3.5 h-3.5 border-2 border-purple-200 border-t-purple-500 rounded-full" />
            AI is thinking...
          </div>
        )}
        {aiFailed && !aiLoading && (
          <div className="text-center text-xs text-gray-400 py-1">
            AI suggestions unavailable — using rule-based plan
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
                                const fruitIcon = fruit ? (FRUIT_ICONS[fruit.name] || '\u{1F34E}') : '\u{1F34E}';
                                return fruit ? (
                                  <div
                                    key={fid}
                                    className="flex items-center justify-between px-1.5 py-1 rounded bg-green-50 border border-green-200 text-xs text-green-800"
                                  >
                                    <span className="truncate">{fruitIcon} {fruit.name}</span>
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
            <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3 sticky top-4 max-h-[70vh] overflow-y-auto">
              <h3 className="text-xs font-semibold text-amber-700 mb-2">Suggestions</h3>

              {/* Quick add new dish */}
              <div className="flex gap-1 mb-3">
                <input
                  type="text"
                  value={quickAddText}
                  onChange={(e) => setQuickAddText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                  placeholder="New dish..."
                  className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-900 placeholder-amber-300"
                />
                <button
                  onClick={handleQuickAdd}
                  disabled={!quickAddText.trim() || quickAddSaving}
                  className="px-1.5 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
                >
                  +
                </button>
              </div>

              {/* AI-suggested meals (purple block) */}
              {aiSuggestionMeals.length > 0 && (
                <>
                  <div className="mb-1.5">
                    <span className="text-[10px] text-purple-500 uppercase font-medium">AI Picks</span>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {aiSuggestionMeals.map((m) => (
                      <DraggableTrayItem key={`ai-${m.id}`} id={`tray-${m.id}`}>
                        <TrayChip meal={m} aiPick />
                      </DraggableTrayItem>
                    ))}
                  </div>
                  <div className="border-t border-amber-100 pt-1.5 mb-1.5">
                    <span className="text-[10px] text-amber-400 uppercase font-medium">Other Meals</span>
                  </div>
                </>
              )}

              {trayMeals.length === 0 && trayFruits.length === 0 && aiSuggestionMeals.length === 0 ? (
                <p className="text-xs text-amber-300 text-center py-4">All meals planned!</p>
              ) : (
                <div className="space-y-1.5">
                  {trayMeals.filter((m) => !aiSuggestionMeals.some((ai) => ai.id === m.id)).map((m) => (
                    <DraggableTrayItem key={m.id} id={`tray-${m.id}`}>
                      <TrayChip meal={m} />
                    </DraggableTrayItem>
                  ))}
                  {trayFruits.length > 0 && (
                    <>
                      <div className="border-t border-amber-100 pt-1.5 mt-1.5">
                        <span className="text-[10px] text-amber-400 uppercase font-medium">Fruits</span>
                      </div>
                      {trayFruits.map((f) => (
                        <DraggableTrayItem key={f.id} id={`tray-${f.id}`}>
                          <TrayChip meal={{ ...f, type: 'fruit' }} />
                        </DraggableTrayItem>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Suggestion tray (mobile — below grid) */}
        <div className="lg:hidden bg-white rounded-xl border border-amber-100 shadow-sm p-3">
          <h3 className="text-xs font-semibold text-amber-700 mb-2">Available Meals</h3>
          <div className="flex gap-1 mb-2">
            <input
              type="text"
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              placeholder="Add new dish..."
              className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-900 placeholder-amber-300"
            />
            <button
              onClick={handleQuickAdd}
              disabled={!quickAddText.trim() || quickAddSaving}
              className="px-2 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
            >
              + Add
            </button>
          </div>

          {/* AI picks on mobile */}
          {aiSuggestionMeals.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] text-purple-500 uppercase font-medium">AI Picks</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {aiSuggestionMeals.map((m) => (
                  <DraggableTrayItem key={`ai-${m.id}`} id={`tray-${m.id}`}>
                    <TrayChip meal={m} aiPick />
                  </DraggableTrayItem>
                ))}
              </div>
            </div>
          )}

          {(trayMeals.length > 0 || trayFruits.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {trayMeals.filter((m) => !aiSuggestionMeals.some((ai) => ai.id === m.id)).map((m) => (
                <DraggableTrayItem key={m.id} id={`tray-${m.id}`}>
                  <TrayChip meal={m} />
                </DraggableTrayItem>
              ))}
              {trayFruits.map((f) => (
                <DraggableTrayItem key={f.id} id={`tray-${f.id}`}>
                  <TrayChip meal={{ ...f, type: 'fruit' }} />
                </DraggableTrayItem>
              ))}
            </div>
          )}

          {trayMeals.length === 0 && trayFruits.length === 0 && aiSuggestionMeals.length === 0 && (
            <p className="text-xs text-amber-300 text-center py-2">All meals planned!</p>
          )}
        </div>

        {/* Trash zone */}
        <TrashZone />

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

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragMeal ? (
          <div className="px-3 py-2 rounded-lg bg-white shadow-lg border border-amber-300 text-sm text-amber-900 opacity-90">
            {activeDragMeal.name}
          </div>
        ) : null}
      </DragOverlay>

      {/* Swap modal — rule-based only, no AI call */}
      {swapTarget && (
        <SwapModal
          day={swapTarget.day}
          mealType={swapTarget.mealType}
          currentPlan={plan}
          masterMeals={masterMeals}
          onSelect={handleSwapSelect}
          onClose={() => setSwapTarget(null)}
          toastRef={toastRef}
        />
      )}
    </DndContext>
  );
}

// Tray chip with optional AI pick styling
function TrayChip({ meal, aiPick }) {
  const TYPE_ICONS = { egg: '\u{1F95A}', chicken: '\u{1F357}' };
  const isFruit = meal.type === 'fruit';
  const isChicken = meal.type === 'chicken';
  const isEgg = meal.type === 'egg';
  const icon = isFruit
    ? (FRUIT_ICONS[meal.name] || '\u{1F34E}')
    : TYPE_ICONS[meal.type] || '';

  return (
    <div
      className={`px-2 py-1.5 rounded border text-xs cursor-grab active:cursor-grabbing truncate select-none ${
        aiPick
          ? 'bg-purple-50 border-purple-200 text-purple-800'
          : isFruit
            ? 'bg-green-50 border-green-200 text-green-800'
            : isChicken
              ? 'bg-orange-50 border-orange-200 text-orange-800'
              : isEgg
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}
    >
      {icon ? `${icon} ` : ''}{meal.name}
      {meal.base && <span className="text-[9px] text-amber-400 ml-1 capitalize">({meal.base})</span>}
    </div>
  );
}

export default MealGrid;
