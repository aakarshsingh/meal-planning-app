import { useState, useEffect } from 'react';

const TYPE_ICONS = { veg: '\u{1F331}', egg: '\u{1F95A}', meat: '\u{1F356}' };
const FRUIT_ICONS = {
  'Guava': '\u{1F34F}', 'Pomegranate': '\u{1F9C3}', 'Apple': '\u{1F34E}',
  'Kiwi': '\u{1F95D}', 'Grapes': '\u{1F347}', 'Strawberry': '\u{1F353}',
};
const DRINK_ICONS = {
  'Coffee': '\u{2615}', 'Iced Tea': '\u{1F9CA}', 'Nimbu Pani': '\u{1F34B}',
};

function SwapModal({
  day,
  mealType,
  currentPlan,
  masterMeals,
  cachedAiMeals,
  aiOverrideUsed,
  onAiOverrideUsed,
  freshAiSuggestions,
  onFreshAiSuggestions,
  onMasterMealsUpdate,
  onSelect,
  onClose,
  toastRef,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freshAiLoading, setFreshAiLoading] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Map visual row type to API mealType
  const apiMealType = mealType === 'morning' ? 'breakfast' : mealType;

  // Collect used meal IDs for filtering
  const usedMealIds = new Set();
  if (currentPlan) {
    for (const d of Object.values(currentPlan)) {
      if (!d) continue;
      const bfIds = Array.isArray(d.breakfast) ? d.breakfast : (d.breakfast ? [d.breakfast] : []);
      for (const id of bfIds) usedMealIds.add(id);
      const drinkIds = Array.isArray(d.drinks) ? d.drinks : (d.drinks ? [d.drinks] : []);
      for (const id of drinkIds) usedMealIds.add(id);
      if (d.lunch) usedMealIds.add(d.lunch);
      if (d.dinner) usedMealIds.add(d.dinner);
      for (const f of d.fruit || []) usedMealIds.add(f);
    }
  }

  // Rule-based suggestions
  useEffect(() => {
    fetch('/api/suggest/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, mealType: apiMealType, currentPlan }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data.suggestions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [day, mealType, apiMealType, currentPlan]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Deduplicated rule suggestions
  const seenIds = new Set();
  const ruleSuggestions = [];
  for (const s of suggestions) {
    const id = s.id || s.mealId;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      ruleSuggestions.push({ ...s, mealId: id });
    }
  }

  // AI suggestions: cached + fresh, filtered by type
  const aiCachedSuggestions = (cachedAiMeals || [])
    .filter((m) => {
      if (!m) return false;
      // Filter by type compatibility
      if (mealType === 'morning') {
        return m.id?.startsWith('bf-') || m.id?.startsWith('drink-');
      }
      if (mealType === 'fruit') return m.id?.startsWith('fruit-');
      // lunch/dinner: only meal-* items
      return m.id?.startsWith('meal-');
    })
    .filter((m) => !seenIds.has(m.id) && !usedMealIds.has(m.id))
    .map((m) => ({ ...m, mealId: m.id, source: 'ai-cached' }));

  const freshSuggestions = (freshAiSuggestions || [])
    .filter((s) => {
      const id = s.id || s.mealId;
      return !seenIds.has(id) && !aiCachedSuggestions.some((a) => a.mealId === id);
    })
    .map((s) => ({ ...s, mealId: s.id || s.mealId, source: 'ai-fresh' }));

  // "Everything else" — full list filtered by type, excluding already shown
  const shownIds = new Set([
    ...ruleSuggestions.map((s) => s.mealId),
    ...aiCachedSuggestions.map((s) => s.mealId),
    ...freshSuggestions.map((s) => s.mealId),
  ]);

  let everythingElse = [];
  if (mealType === 'morning') {
    const bfs = (masterMeals?.breakfasts || [])
      .filter((b) => !shownIds.has(b.id) && !usedMealIds.has(b.id))
      .map((b) => ({ ...b, mealId: b.id, itemType: 'breakfast' }));
    const drinks = (masterMeals?.drinks || [])
      .filter((d) => !shownIds.has(d.id) && !usedMealIds.has(d.id))
      .map((d) => ({ ...d, mealId: d.id, itemType: 'drink' }));
    everythingElse = [...bfs, ...drinks];
  } else if (mealType === 'fruit') {
    everythingElse = (masterMeals?.fruits || [])
      .filter((f) => !shownIds.has(f.id) && !usedMealIds.has(f.id))
      .map((f) => ({ ...f, mealId: f.id, itemType: 'fruit' }));
  } else {
    everythingElse = (masterMeals?.meals || [])
      .filter((m) => !shownIds.has(m.id) && !usedMealIds.has(m.id))
      .map((m) => ({ ...m, mealId: m.id, itemType: 'meal' }));
  }

  // Apply search filter
  if (searchFilter) {
    const q = searchFilter.toLowerCase();
    everythingElse = everythingElse.filter((m) => m.name.toLowerCase().includes(q));
  }

  function handleFreshAiCall() {
    setFreshAiLoading(true);
    fetch('/api/ai/swap-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, mealType: apiMealType, currentPlan }),
    })
      .then((r) => r.json())
      .then((data) => {
        onFreshAiSuggestions(data.suggestions || []);
        setFreshAiLoading(false);
        onAiOverrideUsed();
      })
      .catch(() => {
        setFreshAiLoading(false);
        onAiOverrideUsed();
        toastRef?.current?.error('AI suggestion failed');
      });
  }

  function handleAddNewDish() {
    const name = newDishName.trim();
    if (!name) return;
    setAddingSaving(true);

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
        if (onMasterMealsUpdate) onMasterMealsUpdate(newMeal);
        setAddingSaving(false);
        toastRef?.current?.success(`Added "${name}" — selecting it`);
        setTimeout(() => onSelect(newMeal.id), 50);
      })
      .catch(() => {
        setAddingSaving(false);
        toastRef?.current?.error('Failed to add meal');
      });
  }

  function getItemIcon(item) {
    if (item.itemType === 'fruit') return FRUIT_ICONS[item.name] || '\u{1F34E}';
    if (item.itemType === 'drink') return DRINK_ICONS[item.name] || '\u{2615}';
    return TYPE_ICONS[item.type] || '';
  }

  const displayMealType = mealType === 'morning' ? 'Breakfast' : mealType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-2 sm:mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-ink/10 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-ink capitalize">
              {usedMealIds.has(currentPlan?.[day]?.[apiMealType]) ? 'Swap' : 'Add'} {displayMealType}
            </h3>
            <p className="text-xs text-ink/50">{day}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-cream text-ink/40 hover:text-ink text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-4">
              <div className="animate-spin w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full" />
            </div>
          )}

          {/* Section 1: AI Suggestions */}
          {(aiCachedSuggestions.length > 0 || freshSuggestions.length > 0 || (!aiOverrideUsed && freshSuggestions.length === 0)) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-purple-500 uppercase font-semibold tracking-wide">AI Suggestions</span>
                <div className="flex-1 h-px bg-purple-100" />
              </div>

              {aiCachedSuggestions.map((s) => (
                <button
                  key={s.mealId}
                  onClick={() => onSelect(s.mealId)}
                  className="w-full text-left p-3 rounded-lg border border-purple-100 hover:border-purple-300 hover:bg-purple-50 transition-colors mb-1.5"
                >
                  <div className="flex items-center gap-2">
                    {TYPE_ICONS[s.type] && <span className="text-base">{TYPE_ICONS[s.type]}</span>}
                    <span className="font-medium text-sm text-purple-900 flex-1">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">AI</span>
                  </div>
                </button>
              ))}

              {freshSuggestions.map((s) => (
                <button
                  key={s.mealId}
                  onClick={() => onSelect(s.mealId)}
                  className="w-full text-left p-3 rounded-lg border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors mb-1.5"
                >
                  <div className="flex items-center gap-2">
                    {TYPE_ICONS[s.type] && <span className="text-base">{TYPE_ICONS[s.type]}</span>}
                    <span className="font-medium text-sm text-purple-900 flex-1">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200 text-purple-700 font-medium">Fresh</span>
                  </div>
                  {s.reason && <p className="text-xs text-purple-500 mt-1 ml-7">{s.reason}</p>}
                </button>
              ))}

              {!aiOverrideUsed && freshSuggestions.length === 0 && !freshAiLoading && (
                <button
                  onClick={handleFreshAiCall}
                  className="w-full text-center py-2 rounded-lg border border-dashed border-purple-300 text-purple-500 text-xs hover:bg-purple-50 hover:border-purple-400 transition-colors"
                >
                  Get fresh AI suggestions
                </button>
              )}
              {freshAiLoading && (
                <div className="flex items-center gap-2 text-xs text-purple-400 py-2 justify-center">
                  <div className="animate-spin w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full" />
                  AI is thinking...
                </div>
              )}
            </div>
          )}

          {/* Section 2: Rule-based Suggestions */}
          {ruleSuggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-primary uppercase font-semibold tracking-wide">Suggestions</span>
                <div className="flex-1 h-px bg-primary/20" />
              </div>

              {ruleSuggestions.map((s) => (
                <button
                  key={s.mealId}
                  onClick={() => onSelect(s.mealId)}
                  className="w-full text-left p-3 rounded-lg border border-ink/10 hover:border-primary/30 hover:bg-primary-light transition-colors mb-1.5"
                >
                  <div className="flex items-center gap-2">
                    {TYPE_ICONS[s.type] && <span className="text-base">{TYPE_ICONS[s.type]}</span>}
                    <span className="font-medium text-sm text-ink flex-1">{s.name}</span>
                    {s.base && <span className="text-[10px] text-ink/40 capitalize">{s.base}</span>}
                  </div>
                  {s.reason && <p className="text-xs text-ink/50 mt-1 ml-7">{s.reason}</p>}
                </button>
              ))}
            </div>
          )}

          {/* Section 3: Everything Else */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-ink/50 uppercase font-semibold tracking-wide">All {displayMealType}s</span>
              <div className="flex-1 h-px bg-ink/10" />
            </div>

            {everythingElse.length > 5 && (
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter..."
                className="w-full px-3 py-1.5 mb-2 rounded-lg border border-ink/15 focus:outline-none focus:ring-1 focus:ring-primary text-sm text-ink placeholder-ink/30"
              />
            )}

            {everythingElse.length > 0 ? (
              <div className="space-y-1">
                {everythingElse.map((item) => {
                  const icon = getItemIcon(item);
                  return (
                    <button
                      key={item.mealId}
                      onClick={() => onSelect(item.mealId)}
                      className="w-full text-left p-2.5 rounded-lg border border-ink/10 hover:border-primary/30 hover:bg-primary-light transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {icon && <span className="text-base">{icon}</span>}
                        <span className="font-medium text-sm text-ink flex-1">{item.name}</span>
                        {item.base && <span className="text-[10px] text-ink/40 capitalize">{item.base}</span>}
                        {item.type && (
                          <span className="text-[10px] text-ink/40 capitalize">{item.type}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-ink/30 text-center py-2">All items are already in use</p>
            )}
          </div>

          {!loading && ruleSuggestions.length === 0 && aiCachedSuggestions.length === 0 && freshSuggestions.length === 0 && everythingElse.length === 0 && (
            <p className="text-sm text-ink/40 text-center py-4">No options available</p>
          )}
        </div>

        {/* Add new dish inline */}
        {(mealType === 'lunch' || mealType === 'dinner') && (
          <div className="p-3 border-t border-ink/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNewDish()}
                placeholder="Or type a new dish name..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-ink/15 focus:outline-none focus:ring-2 focus:ring-primary text-ink placeholder-ink/30"
              />
              <button
                onClick={handleAddNewDish}
                disabled={!newDishName.trim() || addingSaving}
                className="px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-40 transition-colors"
              >
                {addingSaving ? '...' : 'Add & Use'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SwapModal;
