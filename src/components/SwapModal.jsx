import { useState, useEffect } from 'react';

const TYPE_ICONS = { egg: '\u{1F95A}', chicken: '\u{1F357}' };

function SwapModal({
  day,
  mealType,
  currentPlan,
  masterMeals,
  cachedAiMeals,
  aiOverrideUsed,
  onAiOverrideUsed,
  onSelect,
  onClose,
  toastRef,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freshAiSuggestions, setFreshAiSuggestions] = useState([]);
  const [freshAiLoading, setFreshAiLoading] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);

  // Rule-based suggestions (instant)
  useEffect(() => {
    fetch('/api/suggest/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, mealType, currentPlan }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data.suggestions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [day, mealType, currentPlan]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Build used meal IDs from current plan (to filter out already-planned meals)
  const usedMealIds = new Set();
  if (currentPlan) {
    for (const d of Object.values(currentPlan)) {
      if (!d) continue;
      if (d.breakfast) usedMealIds.add(d.breakfast);
      if (d.lunch) usedMealIds.add(d.lunch);
      if (d.dinner) usedMealIds.add(d.dinner);
    }
  }

  // Merge rule-based suggestions
  const seenIds = new Set();
  const ruleSuggestions = [];
  for (const s of suggestions) {
    const id = s.id || s.mealId;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      ruleSuggestions.push({ ...s, mealId: id });
    }
  }

  // Cached AI suggestions: meals from the AI plan not in rule suggestions and not currently used
  const aiCachedSuggestions = (cachedAiMeals || [])
    .filter((m) => !seenIds.has(m.id) && !usedMealIds.has(m.id))
    .map((m) => ({ ...m, mealId: m.id, source: 'ai-cached' }));

  // Fresh AI override suggestions (from the 1 allowed call)
  const freshSuggestions = freshAiSuggestions
    .filter((s) => {
      const id = s.id || s.mealId;
      return !seenIds.has(id) && !aiCachedSuggestions.some((a) => a.mealId === id);
    })
    .map((s) => ({ ...s, mealId: s.id || s.mealId, source: 'ai-fresh' }));

  function handleFreshAiCall() {
    setFreshAiLoading(true);
    fetch('/api/ai/swap-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, mealType, currentPlan }),
    })
      .then((r) => r.json())
      .then((data) => {
        setFreshAiSuggestions(data.suggestions || []);
        setFreshAiLoading(false);
        onAiOverrideUsed(); // Mark override as used for the session
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
        setAddingSaving(false);
        toastRef?.current?.success(`Added "${name}" — selecting it`);
        onSelect(newMeal.id);
      })
      .catch(() => {
        setAddingSaving(false);
        toastRef?.current?.error('Failed to add meal');
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-2 sm:mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-amber-100 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-amber-800">Swap {mealType}</h3>
            <p className="text-xs text-amber-500">{day}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-amber-50 text-amber-400 hover:text-amber-700 text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading && (
            <div className="flex justify-center py-4">
              <div className="animate-spin w-6 h-6 border-3 border-amber-300 border-t-amber-600 rounded-full" />
            </div>
          )}

          {/* Rule-based suggestions */}
          {ruleSuggestions.map((s) => (
            <button
              key={s.mealId}
              onClick={() => onSelect(s.mealId)}
              className="w-full text-left p-3 rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {TYPE_ICONS[s.type] && <span className="text-base">{TYPE_ICONS[s.type]}</span>}
                <span className="font-medium text-sm text-amber-900 flex-1">{s.name}</span>
                {s.base && <span className="text-[10px] text-amber-400 capitalize">{s.base}</span>}
              </div>
              {s.reason && <p className="text-xs text-amber-500 mt-1 ml-7">{s.reason}</p>}
            </button>
          ))}

          {/* Cached AI suggestions (from mount call — no extra API cost) */}
          {aiCachedSuggestions.length > 0 && (
            <>
              <div className="pt-2 pb-1">
                <span className="text-[10px] text-purple-500 uppercase font-medium">AI Picks</span>
              </div>
              {aiCachedSuggestions.map((s) => (
                <button
                  key={s.mealId}
                  onClick={() => onSelect(s.mealId)}
                  className="w-full text-left p-3 rounded-lg border border-purple-100 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {TYPE_ICONS[s.type] && <span className="text-base">{TYPE_ICONS[s.type]}</span>}
                    <span className="font-medium text-sm text-purple-900 flex-1">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">AI</span>
                    {s.base && <span className="text-[10px] text-purple-400 capitalize">{s.base}</span>}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Fresh AI override suggestions */}
          {freshSuggestions.length > 0 && (
            <>
              <div className="pt-2 pb-1">
                <span className="text-[10px] text-purple-500 uppercase font-medium">Fresh AI Suggestions</span>
              </div>
              {freshSuggestions.map((s) => (
                <button
                  key={s.mealId}
                  onClick={() => onSelect(s.mealId)}
                  className="w-full text-left p-3 rounded-lg border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {TYPE_ICONS[s.type] && <span className="text-base">{TYPE_ICONS[s.type]}</span>}
                    <span className="font-medium text-sm text-purple-900 flex-1">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200 text-purple-700 font-medium">Fresh</span>
                    {s.base && <span className="text-[10px] text-purple-400 capitalize">{s.base}</span>}
                  </div>
                  {s.reason && <p className="text-xs text-purple-500 mt-1 ml-7">{s.reason}</p>}
                </button>
              ))}
            </>
          )}

          {!loading && ruleSuggestions.length === 0 && aiCachedSuggestions.length === 0 && freshSuggestions.length === 0 && (
            <p className="text-sm text-amber-400 text-center py-4">No suggestions available</p>
          )}

          {/* Override: fresh AI call (max 1 per session) */}
          {!aiOverrideUsed && freshSuggestions.length === 0 && !freshAiLoading && (
            <div className="pt-3 border-t border-gray-100 mt-2">
              <button
                onClick={handleFreshAiCall}
                className="w-full text-center py-2.5 rounded-lg border border-dashed border-purple-300 text-purple-500 text-xs hover:bg-purple-50 hover:border-purple-400 transition-colors"
              >
                Totally confused? Get a fresh suggestion from AI
              </button>
            </div>
          )}
          {freshAiLoading && (
            <div className="flex items-center gap-2 text-xs text-purple-400 py-3 justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full" />
              AI is thinking...
            </div>
          )}
        </div>

        {/* Add new dish inline */}
        <div className="p-3 border-t border-amber-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newDishName}
              onChange={(e) => setNewDishName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNewDish()}
              placeholder="Or type a new dish name..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-900 placeholder-amber-300"
            />
            <button
              onClick={handleAddNewDish}
              disabled={!newDishName.trim() || addingSaving}
              className="px-3 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              {addingSaving ? '...' : 'Add & Use'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SwapModal;
