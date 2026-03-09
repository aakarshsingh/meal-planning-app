import { useState, useEffect, useRef } from 'react';

const CATEGORY_ICONS = {
  vegetable: '\u{1F96C}',
  dairy: '\u{1F95B}',
  protein: '\u{1F357}',
  staple: '\u{1F3EA}',
  bakery: '\u{1F35E}',
  'ready-mix': '\u{1F4E6}',
  spice: '\u{1F9C2}',
  fruit: '\u{1F34E}',
};

const CATEGORY_LABELS = {
  vegetable: 'Vegetables',
  dairy: 'Dairy',
  protein: 'Protein',
  staple: 'Staples',
  bakery: 'Bakery',
  'ready-mix': 'Ready Mix',
  spice: 'Spices',
  fruit: 'Fruits',
};

const UNIT_LABELS = {
  g: 'grams',
  kg: 'kilograms',
  ml: 'millilitres',
  l: 'litres',
  nos: 'numbers / pieces',
  pk: 'packets',
  bunch: 'bunches',
  slices: 'slices',
  box: 'box',
  pc: 'piece',
};

function GroceryList({ plan, leftovers, baseOverrides = {}, sideOverrides = {}, groceryCache, setGroceryCache }) {
  const [groceryData, setGroceryDataLocal] = useState(groceryCache?.groceryData || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(groceryCache?.aiSuggestions || null);
  const [removedItems, setRemovedItems] = useState(() => new Set(groceryCache?.removedItems || []));
  const [editingItem, setEditingItem] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState('');
  const [addUnit, setAddUnit] = useState('nos');
  const [addCategory, setAddCategory] = useState('vegetable');
  const editRef = useRef(null);
  const addNameRef = useRef(null);

  // Wrapper to sync grocery data to parent cache
  function setGroceryData(updater) {
    setGroceryDataLocal((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }

  // Sync all grocery edits to parent cache whenever they change
  useEffect(() => {
    if (!setGroceryCache || !groceryData) return;
    setGroceryCache({
      groceryData,
      aiSuggestions,
      removedItems: [...removedItems],
    });
  }, [groceryData, aiSuggestions, removedItems]);

  // Generate grocery list AND optimize with AI before showing
  // Skip if we already have cached data from a previous render
  useEffect(() => {
    if (!plan) return;
    if (groceryCache?.groceryData) return; // Already have cached data

    setLoading(true);
    setRemovedItems(new Set());
    setGroceryData(null);

    fetch('/api/groceries/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, leftovers, baseOverrides, sideOverrides }),
    })
      .then((r) => r.json())
      .then((data) => {
        // Now optimize with AI before showing
        return fetch('/api/ai/optimize-grocery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groceryList: data, plan }),
        })
          .then((r) => r.json())
          .then((aiData) => {
            let optimized = data;
            // Apply AI quantity fixes
            if (aiData.fixes && aiData.fixes.length > 0) {
              optimized = {
                ...data,
                categories: data.categories.map((cat) => ({
                  ...cat,
                  items: cat.items.map((item) => {
                    const fix = aiData.fixes.find(
                      (f) => f.name && f.name.toLowerCase() === item.name.toLowerCase()
                    );
                    if (fix) {
                      return { ...item, qty: fix.qty, unit: fix.unit || item.unit };
                    }
                    return item;
                  }),
                })),
              };
            }
            setGroceryData(optimized);
            setAiSuggestions(aiData.suggestions || []);
            setLoading(false);
          })
          .catch(() => {
            // AI failed, show un-optimized list
            setGroceryData(data);
            setLoading(false);
          });
      })
      .catch(() => setLoading(false));
  }, [plan, leftovers]);

  function buildCopyText() {
    if (!groceryData) return '';
    const lines = ['Grocery List', ''];
    for (const cat of groceryData.categories) {
      const icon = CATEGORY_ICONS[cat.name] || '';
      const label = CATEGORY_LABELS[cat.name] || cat.name;
      const visibleItems = cat.items.filter((item) => !removedItems.has(item.id || item.name));
      if (visibleItems.length === 0) continue;
      lines.push(`${icon} ${label}:`);
      for (const item of visibleItems) {
        const leftoverNote = item.leftover > 0 ? ` (${item.leftover} from leftovers)` : '';
        lines.push(`  ${item.name}: ${item.qty} ${item.unit}${leftoverNote}`);
      }
      lines.push('');
    }
    const total = groceryData.categories.reduce(
      (sum, cat) => sum + cat.items.filter((i) => !removedItems.has(i.id || i.name)).length,
      0
    );
    lines.push(`Total items: ${total}`);
    return lines.join('\n');
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleRemoveItem(itemKey) {
    setRemovedItems((prev) => new Set([...prev, itemKey]));
  }

  function startEdit(item) {
    setEditingItem(item.id || item.name);
    setEditQty(String(item.qty));
    setEditUnit(item.unit);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  function saveEdit() {
    if (!editingItem) return;
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) return;

    setGroceryData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) => ({
          ...cat,
          items: cat.items.map((item) => {
            if ((item.id || item.name) === editingItem) {
              return { ...item, qty, unit: editUnit };
            }
            return item;
          }),
        })),
      };
    });
    setEditingItem(null);
  }

  function handleAddItem() {
    const name = addName.trim();
    const qty = parseFloat(addQty);
    if (!name || isNaN(qty) || qty <= 0) return;

    setGroceryData((prev) => {
      if (!prev) return prev;
      const newItem = { name, qty, unit: addUnit, id: `custom-${Date.now()}` };
      const catIndex = prev.categories.findIndex((c) => c.name === addCategory);
      if (catIndex >= 0) {
        const updated = [...prev.categories];
        updated[catIndex] = {
          ...updated[catIndex],
          items: [...updated[catIndex].items, newItem],
        };
        return { ...prev, categories: updated };
      }
      // Category doesn't exist yet, add it
      return {
        ...prev,
        categories: [...prev.categories, { name: addCategory, items: [newItem] }],
      };
    });

    setAddName('');
    setAddQty('');
    setAddUnit('nos');
    // Keep form open and focus name for quick batch adds
    setTimeout(() => addNameRef.current?.focus(), 50);
  }

  if (!plan) return null;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
        <div className="flex items-center gap-3 justify-center py-8">
          <div className="animate-spin w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full" />
          <span className="text-sm text-ink/50">Generating & optimizing grocery list...</span>
        </div>
      </div>
    );
  }

  if (!groceryData) return null;

  const visibleTotal = groceryData.categories.reduce(
    (sum, cat) => sum + cat.items.filter((i) => !removedItems.has(i.id || i.name)).length,
    0
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">
          Grocery List
          <span className="text-sm font-normal text-ink/50 ml-2">
            ({visibleTotal} items)
          </span>
        </h2>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              setShowAddForm((v) => !v);
              if (!showAddForm) setTimeout(() => addNameRef.current?.focus(), 50);
            }}
            className="text-xs px-2.5 py-1 rounded-md transition-all bg-cream text-ink/60 border border-ink/15 hover:bg-primary-light hover:text-primary"
          >
            + Add Item
          </button>
          <button
            onClick={handleCopy}
            className={`text-xs px-2.5 py-1 rounded-md transition-all ${
              copied
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-cream text-ink/60 border border-ink/15 hover:bg-primary-light hover:text-primary'
            }`}
          >
            {copied ? 'Copied!' : 'Copy List'}
          </button>
        </div>
      </div>

      {/* AI optimization suggestions */}
      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="mb-4 bg-purple-50 rounded-lg border border-purple-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-purple-700">AI Tips</h4>
            <button
              onClick={() => setAiSuggestions(null)}
              className="text-purple-400 hover:text-purple-600 text-sm"
            >
              &times;
            </button>
          </div>
          <ul className="space-y-1">
            {aiSuggestions.map((s, i) => (
              <li key={i} className="text-xs text-purple-800 flex gap-2">
                <span className="text-purple-400 shrink-0">&bull;</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add item form */}
      {showAddForm && (
        <div className="mb-4 bg-cream/50 rounded-lg border border-ink/10 p-3 relative">
          <button
            onClick={() => setShowAddForm(false)}
            className="absolute top-1.5 right-2 text-ink/30 hover:text-ink/60 text-lg leading-none"
            title="Close"
          >
            &times;
          </button>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-ink/50 uppercase tracking-wide">Name</label>
              <input
                ref={addNameRef}
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                placeholder="e.g. Paneer"
                className="w-full px-2 py-1 text-sm rounded border border-ink/15 text-ink"
              />
            </div>
            <div className="w-20">
              <label className="text-[10px] text-ink/50 uppercase tracking-wide">Qty</label>
              <input
                type="number"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                placeholder="1"
                className="w-full px-2 py-1 text-sm rounded border border-ink/15 text-ink"
              />
            </div>
            <div className="w-20">
              <label className="text-[10px] text-ink/50 uppercase tracking-wide">Unit</label>
              <select
                value={addUnit}
                onChange={(e) => setAddUnit(e.target.value)}
                className="w-full px-1 py-1 text-sm rounded border border-ink/15 text-ink"
              >
                {Object.entries(UNIT_LABELS).map(([u, label]) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="text-[10px] text-ink/50 uppercase tracking-wide">Category</label>
              <select
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
                className="w-full px-1 py-1 text-sm rounded border border-ink/15 text-ink"
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddItem}
              className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groceryData.categories.map((cat) => {
          const icon = CATEGORY_ICONS[cat.name] || '';
          const label = CATEGORY_LABELS[cat.name] || cat.name;
          const visibleItems = cat.items.filter((item) => !removedItems.has(item.id || item.name));
          if (visibleItems.length === 0) return null;

          return (
            <div key={cat.name}>
              <h3 className="text-sm font-semibold text-ink/70 mb-2">
                {icon} {label}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {visibleItems.map((item) => {
                  const itemKey = item.id || item.name;
                  const hasLeftover = item.leftover > 0;
                  const isEditing = editingItem === itemKey;

                  if (isEditing) {
                    return (
                      <div
                        key={itemKey}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-primary-light border border-primary/20"
                      >
                        <span className="text-sm text-ink flex-1 truncate">{item.name}</span>
                        <input
                          ref={editRef}
                          type="number"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                          className="w-16 px-1 py-0.5 text-xs rounded border border-ink/15 text-ink"
                        />
                        <select
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          className="px-1 py-0.5 text-xs rounded border border-ink/15 text-ink"
                        >
                          {Object.keys(UNIT_LABELS).map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                        <button
                          onClick={saveEdit}
                          className="text-[10px] px-1.5 py-0.5 bg-primary text-white rounded"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingItem(null)}
                          className="text-[10px] px-1 text-ink/40"
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={itemKey}
                      className={`flex items-center justify-between px-3 py-1.5 rounded text-sm group ${
                        hasLeftover && item.needed === 0
                          ? 'bg-gray-50 text-gray-400'
                          : 'bg-cream/50 text-ink'
                      }`}
                    >
                      <span
                        className={`cursor-pointer hover:text-primary ${hasLeftover && item.needed === 0 ? 'line-through' : ''}`}
                        onClick={() => startEdit(item)}
                        title="Click to edit"
                      >
                        {item.name}
                      </span>
                      <span className="text-xs text-ink/50 shrink-0 ml-2 flex items-center gap-1">
                        <button
                          onClick={() => startEdit(item)}
                          className="text-ink/25 hover:text-primary transition-colors"
                          title="Edit quantity"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <span
                          className="cursor-pointer hover:text-primary"
                          onClick={() => startEdit(item)}
                          title="Click to edit"
                        >
                          {item.qty}{' '}
                          <span title={UNIT_LABELS[item.unit] || item.unit} className="cursor-help border-b border-dotted border-ink/20">
                            {item.unit}
                          </span>
                        </span>
                        {hasLeftover && (
                          <span className="text-ink/40 italic">
                            (-{item.leftover} leftover)
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveItem(itemKey)}
                          className="text-ink/20 hover:text-accent ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove from list"
                        >
                          &times;
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GroceryList;
