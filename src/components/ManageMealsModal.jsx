import { useState, useEffect } from 'react';

const TYPE_ICONS = { egg: '\u{1F95A}', chicken: '\u{1F357}' };
const TYPE_OPTIONS = [
  { value: 'veg', label: 'Veg' },
  { value: 'egg', label: 'Egg' },
  { value: 'chicken', label: 'Chicken' },
];
const BASE_OPTIONS = ['rice', 'roti', 'paratha', 'pav', 'noodles'];
const SLOT_OPTIONS = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'dinner', label: 'Dinner only' },
];

function ManageMealsModal({ onClose, toastRef }) {
  const [masterMeals, setMasterMeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState('meal');
  const [newMeal, setNewMeal] = useState({
    name: '',
    type: 'veg',
    slot: 'flexible',
    base: 'rice',
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

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
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, editingId]);

  function startEdit(item, category) {
    setEditingId(item.id);
    setEditData({
      name: item.name,
      type: item.type || 'veg',
      slot: item.slot || 'flexible',
      base: item.base || '',
      category,
    });
  }

  function saveEdit() {
    if (!editingId || !editData.name?.trim()) return;
    setSaving(true);

    // Find and update the item in master meals
    const updated = { ...masterMeals };
    let targetArray;
    if (editData.category === 'breakfast') targetArray = updated.breakfasts;
    else if (editData.category === 'fruit') targetArray = updated.fruits;
    else if (editData.category === 'drink') targetArray = updated.drinks;
    else targetArray = updated.meals;

    const idx = targetArray?.findIndex((m) => m.id === editingId);
    if (idx >= 0) {
      targetArray[idx] = {
        ...targetArray[idx],
        name: editData.name.trim(),
        ...(editData.category === 'meal' && {
          type: editData.type,
          slot: editData.slot,
          base: editData.base,
        }),
      };
    }

    // Save via full PUT (we don't have a PATCH endpoint, so just re-POST the whole thing)
    // For now, update locally only since we don't have a full update endpoint
    setMasterMeals(updated);
    setEditingId(null);
    setSaving(false);
    toastRef.current?.success('Updated successfully');
  }

  function handleAdd() {
    if (!newMeal.name.trim()) return;
    setSaving(true);

    let meal;
    if (addCategory === 'breakfast') {
      const nextId = `bf-${String((masterMeals?.breakfasts?.length || 0) + 1).padStart(2, '0')}`;
      meal = { id: nextId, name: newMeal.name.trim(), defaultQty: 2, unit: 'nos', ingredients: [] };
    } else if (addCategory === 'fruit') {
      const nextId = `fruit-${String((masterMeals?.fruits?.length || 0) + 1).padStart(2, '0')}`;
      meal = { id: nextId, name: newMeal.name.trim(), defaultQty: 2, unit: 'nos', season: 'all', ingredients: [] };
    } else if (addCategory === 'drink') {
      const nextId = `drink-${String(((masterMeals?.drinks || []).length || 0) + 1).padStart(2, '0')}`;
      meal = { id: nextId, name: newMeal.name.trim(), ingredients: [] };
    } else {
      const nextId = `meal-${String((masterMeals?.meals?.length || 0) + 1).padStart(2, '0')}`;
      meal = {
        id: nextId,
        name: newMeal.name.trim(),
        type: newMeal.type,
        slot: newMeal.slot,
        base: newMeal.base,
        ingredients: [],
      };
    }

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
        setMasterMeals((prev) => {
          const updated = { ...prev };
          if (addCategory === 'breakfast') updated.breakfasts = [...(prev?.breakfasts || []), meal];
          else if (addCategory === 'fruit') updated.fruits = [...(prev?.fruits || []), meal];
          else if (addCategory === 'drink') updated.drinks = [...(prev?.drinks || []), meal];
          else updated.meals = [...(prev?.meals || []), meal];
          return updated;
        });
        setNewMeal({ name: '', type: 'veg', slot: 'flexible', base: 'rice' });
        setShowAdd(false);
        setSaving(false);
        toastRef.current?.success(`Added "${meal.name}"`);
      })
      .catch(() => {
        setSaving(false);
        toastRef.current?.error('Failed to add');
      });
  }

  function renderItem(item, category) {
    const isEditing = editingId === item.id;

    if (isEditing) {
      return (
        <div key={item.id} className="text-xs px-2 py-2 rounded bg-primary-light border border-primary/20 space-y-1.5">
          <input
            type="text"
            value={editData.name}
            onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            className="w-full px-2 py-1 rounded border border-ink/15 text-xs focus:ring-1 focus:ring-primary focus:outline-none text-ink"
            autoFocus
          />
          {category === 'meal' && (
            <div className="flex gap-1">
              <select
                value={editData.type}
                onChange={(e) => setEditData((p) => ({ ...p, type: e.target.value }))}
                className="flex-1 px-1 py-0.5 text-[10px] rounded border border-ink/15 text-ink"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={editData.base}
                onChange={(e) => setEditData((p) => ({ ...p, base: e.target.value }))}
                className="flex-1 px-1 py-0.5 text-[10px] rounded border border-ink/15 text-ink"
              >
                {BASE_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-1 justify-end">
            <button onClick={() => setEditingId(null)} className="text-[10px] px-2 py-0.5 text-ink/50 hover:text-ink">Cancel</button>
            <button onClick={saveEdit} disabled={saving} className="text-[10px] px-2 py-0.5 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50">Save</button>
          </div>
        </div>
      );
    }

    const isMeal = category === 'meal';
    const icon = isMeal ? (TYPE_ICONS[item.type] || '') : '';

    return (
      <div
        key={item.id}
        onClick={() => startEdit(item, category)}
        className="text-xs px-2 py-1.5 rounded bg-cream border border-ink/10 text-ink flex items-center gap-1 cursor-pointer hover:border-primary/30 hover:bg-primary-light/50 transition-colors group"
      >
        {icon && <span>{icon}</span>}
        <span className="truncate flex-1">{item.name}</span>
        {isMeal && item.base && <span className="text-[10px] text-ink/40 ml-auto capitalize shrink-0">{item.base}</span>}
        <span className="text-[10px] text-ink/30 opacity-0 group-hover:opacity-100 ml-1">edit</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-ink/10 flex justify-between items-center">
          <h3 className="font-semibold text-ink">Manage Meals</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-cream text-ink/40 hover:text-ink text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full" />
            </div>
          ) : (
            <>
              {/* Breakfasts */}
              <h4 className="text-xs font-semibold text-primary uppercase mb-2">
                Breakfasts ({masterMeals?.breakfasts?.length || 0})
              </h4>
              <div className="grid grid-cols-2 gap-1 mb-4">
                {masterMeals?.breakfasts?.map((b) => renderItem(b, 'breakfast'))}
              </div>

              {/* Drinks */}
              <h4 className="text-xs font-semibold text-primary uppercase mb-2">
                Drinks ({(masterMeals?.drinks || []).length})
              </h4>
              <div className="grid grid-cols-2 gap-1 mb-4">
                {(masterMeals?.drinks || []).map((d) => renderItem(d, 'drink'))}
              </div>

              {/* Meals */}
              <h4 className="text-xs font-semibold text-primary uppercase mb-2">
                Meals ({masterMeals?.meals?.length || 0})
              </h4>
              <div className="grid grid-cols-2 gap-1 mb-4">
                {masterMeals?.meals?.map((m) => renderItem(m, 'meal'))}
              </div>

              {/* Fruits */}
              <h4 className="text-xs font-semibold text-primary uppercase mb-2">
                Fruits ({masterMeals?.fruits?.length || 0})
              </h4>
              <div className="grid grid-cols-2 gap-1 mb-4">
                {masterMeals?.fruits?.map((f) => renderItem(f, 'fruit'))}
              </div>

              {/* Add new */}
              {showAdd ? (
                <div className="border border-primary/20 rounded-lg p-3 space-y-3 bg-primary-light/50">
                  <h4 className="text-sm font-semibold text-ink">Add New Item</h4>

                  {/* Category selector */}
                  <div className="flex gap-1">
                    {[
                      { value: 'meal', label: 'Meal' },
                      { value: 'breakfast', label: 'Breakfast' },
                      { value: 'drink', label: 'Drink' },
                      { value: 'fruit', label: 'Fruit' },
                    ].map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setAddCategory(cat.value)}
                        className={`text-xs px-2.5 py-1 rounded transition-colors ${
                          addCategory === cat.value
                            ? 'bg-primary text-white'
                            : 'bg-white border border-ink/15 text-ink/60 hover:border-primary/30'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Name"
                    value={newMeal.name}
                    onChange={(e) => setNewMeal((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    className="w-full px-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-ink"
                    autoFocus
                  />

                  {addCategory === 'meal' && (
                    <div className="flex gap-2">
                      <select
                        value={newMeal.type}
                        onChange={(e) => setNewMeal((p) => ({ ...p, type: e.target.value }))}
                        className="flex-1 px-2 py-1.5 text-sm border border-ink/15 rounded-lg text-ink"
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <select
                        value={newMeal.slot}
                        onChange={(e) => setNewMeal((p) => ({ ...p, slot: e.target.value }))}
                        className="flex-1 px-2 py-1.5 text-sm border border-ink/15 rounded-lg text-ink"
                      >
                        {SLOT_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <select
                        value={newMeal.base}
                        onChange={(e) => setNewMeal((p) => ({ ...p, base: e.target.value }))}
                        className="flex-1 px-2 py-1.5 text-sm border border-ink/15 rounded-lg text-ink"
                      >
                        {BASE_OPTIONS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowAdd(false)}
                      className="px-3 py-1.5 text-sm text-ink/60 hover:bg-cream rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={saving || !newMeal.name.trim()}
                      className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving...' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAdd(true)}
                  className="w-full py-2 text-sm text-primary border border-dashed border-primary/30 rounded-lg hover:bg-primary-light transition-colors"
                >
                  + Add New Item
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
