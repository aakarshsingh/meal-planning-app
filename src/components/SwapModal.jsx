import { useState, useEffect } from 'react';

const TYPE_ICONS = { egg: '\u{1F95A}', chicken: '\u{1F357}' };

function SwapModal({ day, mealType, currentPlan, masterMeals, onSelect, onClose, toastRef }) {
  const [suggestions, setSuggestions] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);
  const [newDishName, setNewDishName] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);

  useEffect(() => {
    // Rule-based suggestions
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

    // AI suggestions (async enhancement)
    fetch('/api/ai/swap-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, mealType, currentPlan }),
    })
      .then((r) => r.json())
      .then((data) => {
        setAiSuggestions(data.suggestions || []);
        setAiLoading(false);
      })
      .catch(() => setAiLoading(false));
  }, [day, mealType, currentPlan]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Merge: rule-based first, then AI (dedup by mealId)
  const seenIds = new Set();
  const allSuggestions = [];
  for (const s of suggestions) {
    const id = s.id || s.mealId;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      allSuggestions.push({ ...s, mealId: id, source: 'rule' });
    }
  }
  for (const s of aiSuggestions) {
    const id = s.id || s.mealId;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      allSuggestions.push({ ...s, mealId: id, source: 'ai' });
    }
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

          {!loading && allSuggestions.length === 0 && (
            <p className="text-sm text-amber-400 text-center py-4">No suggestions available</p>
          )}

          {allSuggestions.map((s) => (
            <button
              key={s.mealId}
              onClick={() => onSelect(s.mealId)}
              className="w-full text-left p-3 rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                {TYPE_ICONS[s.type] && (
                  <span className="text-base">{TYPE_ICONS[s.type]}</span>
                )}
                <span className="font-medium text-sm text-amber-900 flex-1">{s.name}</span>
                {s.source === 'ai' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">
                    AI
                  </span>
                )}
                {s.base && (
                  <span className="text-[10px] text-amber-400 capitalize">{s.base}</span>
                )}
              </div>
              {s.reason && (
                <p className="text-xs text-amber-500 mt-1 ml-7">{s.reason}</p>
              )}
            </button>
          ))}

          {aiLoading && !loading && (
            <div className="flex items-center gap-2 text-xs text-purple-400 py-2 justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full" />
              Loading AI suggestions...
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
