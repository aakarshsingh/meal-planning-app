import { useState, useEffect } from 'react';

const TYPE_ICONS = { veg: '\u{1F96C}', egg: '\u{1F95A}', chicken: '\u{1F357}' };

function ManageMealsModal({ onClose, toastRef }) {
  const [masterMeals, setMasterMeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newMeal, setNewMeal] = useState({
    name: '',
    type: 'veg',
    slot: 'flexible',
    base: 'rice',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/meals')
      .then((r) => r.json())
      .then((data) => {
        setMasterMeals(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toastRef.current?.error('Failed to load meals');
      });
  }, [toastRef]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleAdd() {
    if (!newMeal.name.trim()) return;
    setSaving(true);

    const nextId = `meal-${String((masterMeals?.meals?.length || 0) + 1).padStart(2, '0')}`;
    const meal = {
      id: nextId,
      name: newMeal.name.trim(),
      type: newMeal.type,
      slot: newMeal.slot,
      base: newMeal.base,
      ingredients: [],
    };

    fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meal),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then(() => {
        setMasterMeals((prev) => ({
          ...prev,
          meals: [...(prev?.meals || []), meal],
        }));
        setNewMeal({ name: '', type: 'veg', slot: 'flexible', base: 'rice' });
        setShowAdd(false);
        setSaving(false);
        toastRef.current?.success(`Added "${meal.name}" to meals`);
      })
      .catch(() => {
        setSaving(false);
        toastRef.current?.error('Failed to add meal');
      });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-amber-100 flex justify-between items-center">
          <h3 className="font-semibold text-amber-800">Manage Meals</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-amber-50 text-amber-400 hover:text-amber-700 text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-3 border-amber-300 border-t-amber-600 rounded-full" />
            </div>
          ) : (
            <>
              {/* Breakfasts */}
              <h4 className="text-xs font-semibold text-amber-600 uppercase mb-2">
                Breakfasts ({masterMeals?.breakfasts?.length || 0})
              </h4>
              <div className="grid grid-cols-2 gap-1 mb-4">
                {masterMeals?.breakfasts?.map((b) => (
                  <div key={b.id} className="text-xs px-2 py-1.5 rounded bg-amber-50 text-amber-800">
                    {b.name}
                  </div>
                ))}
              </div>

              {/* Meals */}
              <h4 className="text-xs font-semibold text-amber-600 uppercase mb-2">
                Meals ({masterMeals?.meals?.length || 0})
              </h4>
              <div className="grid grid-cols-2 gap-1 mb-4">
                {masterMeals?.meals?.map((m) => (
                  <div key={m.id} className="text-xs px-2 py-1.5 rounded bg-amber-50 text-amber-800 flex items-center gap-1">
                    <span>{TYPE_ICONS[m.type] || TYPE_ICONS.veg}</span>
                    <span className="truncate">{m.name}</span>
                    <span className="text-[10px] text-amber-400 ml-auto capitalize shrink-0">{m.base}</span>
                  </div>
                ))}
              </div>

              {/* Fruits */}
              <h4 className="text-xs font-semibold text-amber-600 uppercase mb-2">
                Fruits ({masterMeals?.fruits?.length || 0})
              </h4>
              <div className="grid grid-cols-2 gap-1 mb-4">
                {masterMeals?.fruits?.map((f) => (
                  <div key={f.id} className="text-xs px-2 py-1.5 rounded bg-green-50 text-green-800">
                    {'\u{1F34E}'} {f.name}
                  </div>
                ))}
              </div>

              {/* Add new meal */}
              {showAdd ? (
                <div className="border border-amber-200 rounded-lg p-3 space-y-3">
                  <h4 className="text-sm font-semibold text-amber-700">Add New Meal</h4>
                  <input
                    type="text"
                    placeholder="Meal name"
                    value={newMeal.name}
                    onChange={(e) => setNewMeal((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-300 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <select
                      value={newMeal.type}
                      onChange={(e) => setNewMeal((p) => ({ ...p, type: e.target.value }))}
                      className="flex-1 px-2 py-1.5 text-sm border border-amber-200 rounded-lg"
                    >
                      <option value="veg">Veg</option>
                      <option value="egg">Egg</option>
                      <option value="chicken">Chicken</option>
                    </select>
                    <select
                      value={newMeal.slot}
                      onChange={(e) => setNewMeal((p) => ({ ...p, slot: e.target.value }))}
                      className="flex-1 px-2 py-1.5 text-sm border border-amber-200 rounded-lg"
                    >
                      <option value="flexible">Flexible</option>
                      <option value="dinner">Dinner only</option>
                    </select>
                    <select
                      value={newMeal.base}
                      onChange={(e) => setNewMeal((p) => ({ ...p, base: e.target.value }))}
                      className="flex-1 px-2 py-1.5 text-sm border border-amber-200 rounded-lg"
                    >
                      <option value="rice">Rice</option>
                      <option value="roti">Roti</option>
                      <option value="paratha">Paratha</option>
                      <option value="pav">Pav</option>
                      <option value="noodles">Noodles</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowAdd(false)}
                      className="px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={saving || !newMeal.name.trim()}
                      className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving...' : 'Add Meal'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAdd(true)}
                  className="w-full py-2 text-sm text-amber-600 border border-dashed border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  + Add New Meal
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManageMealsModal;
