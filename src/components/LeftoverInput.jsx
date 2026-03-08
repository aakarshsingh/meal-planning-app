import { useState, useEffect, useRef } from 'react';

const CATEGORY_LABELS = {
  vegetable: 'Vegetables',
  dairy: 'Dairy',
  protein: 'Protein',
  staple: 'Staples',
  bakery: 'Bakery',
  'ready-mix': 'Ready Mix',
  spice: 'Spices',
  fruit: 'Fruit',
};

const UNIT_OPTIONS = ['g', 'kg', 'ml', 'l', 'nos', 'pk', 'bunch', 'slices', 'box', 'pc'];

const FRACTION_PRESETS = ['1/4', '1/3', '1/2', '2/3', '3/4'];

function parseFraction(val) {
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  // Handle fractions like "1/2"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) return Number(fractionMatch[1]) / Number(fractionMatch[2]);
  // Handle mixed like "1 1/2"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) return Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3]);
  const n = Number(str);
  return isNaN(n) ? 0 : n;
}

function LeftoverInput({ leftovers, setLeftovers, onNext }) {
  const [ingredients, setIngredients] = useState([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('g');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetch('/api/ingredients')
      .then((r) => r.json())
      .then((data) => {
        setIngredients(data.ingredients || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search.length > 0
    ? ingredients.filter(
        (ing) =>
          ing.name.toLowerCase().includes(search.toLowerCase()) &&
          !leftovers.some((l) => l.ingredientId === ing.id)
      )
    : [];

  function handleSelect(ing) {
    setSelected(ing);
    setSearch(ing.name);
    // Don't auto-fill qty — user's stock is almost always less than purchase qty
    setQty('');
    setUnit(ing.purchaseUnit || 'g');
    setShowDropdown(false);
    setTimeout(() => {
      const qtyInput = document.getElementById('leftover-qty');
      if (qtyInput) qtyInput.focus();
    }, 50);
  }

  function handleAdd() {
    if (!selected || !qty) return;
    const parsed = parseFraction(qty);
    if (parsed <= 0) return;
    setLeftovers((prev) => [
      ...prev,
      {
        ingredientId: selected.id,
        name: selected.name,
        category: selected.category,
        qty: parsed,
        qtyDisplay: qty, // preserve "1/2" for display
        unit,
      },
    ]);
    setSelected(null);
    setSearch('');
    setQty('');
    setUnit('g');
    inputRef.current?.focus();
  }

  function handleRemove(ingredientId) {
    setLeftovers((prev) => prev.filter((l) => l.ingredientId !== ingredientId));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (selected) {
        handleAdd();
      } else if (filtered.length === 1) {
        handleSelect(filtered[0]);
      }
    }
  }

  // Group leftovers by category
  const grouped = {};
  for (const l of leftovers) {
    const cat = l.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(l);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-amber-300 border-t-amber-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6">
        <h2 className="text-lg font-semibold text-amber-800 mb-1">
          What's in your pantry?
        </h2>
        <p className="text-sm text-amber-500 mb-4">
          Add ingredients you already have in stock so we can plan meals around them.
        </p>

        {/* Search + Add row */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
                setShowDropdown(true);
              }}
              onFocus={() => search.length > 0 && setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search ingredients..."
              className="w-full px-3 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-amber-900 placeholder-amber-300"
            />
            {showDropdown && filtered.length > 0 && (
              <ul
                ref={dropdownRef}
                className="absolute z-10 w-full mt-1 bg-white border border-amber-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {filtered.map((ing) => (
                  <li
                    key={ing.id}
                    onClick={() => handleSelect(ing)}
                    className="px-3 py-2 hover:bg-amber-50 cursor-pointer text-amber-800 flex justify-between items-center"
                  >
                    <span>{ing.name}</span>
                    <span className="text-xs text-amber-400 capitalize">{ing.category}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <input
                id="leftover-qty"
                type="text"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Qty"
                className="w-20 px-3 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-900 placeholder-amber-300"
              />
              {/* Fraction quick-picks shown when qty is focused and unit is bunch/nos/pc */}
              {selected && ['bunch', 'nos', 'pc', 'pk', 'box'].includes(unit) && !qty && (
                <div className="absolute top-full left-0 mt-1 flex gap-1 z-10">
                  {FRACTION_PRESETS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setQty(f)}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="px-2 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-900 bg-white"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selected || !qty}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Added stock items */}
      {leftovers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6">
          <h3 className="text-sm font-semibold text-amber-700 mb-3">
            Pantry stock ({leftovers.length})
          </h3>
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">
                  {CATEGORY_LABELS[cat] || cat}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((l) => (
                    <span
                      key={l.ingredientId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-sm text-amber-800"
                    >
                      <span className="font-medium">{l.name}</span>
                      <span className="text-amber-500">
                        {l.qtyDisplay || l.qty} {l.unit}
                      </span>
                      <button
                        onClick={() => handleRemove(l.ingredientId)}
                        className="ml-1 text-amber-400 hover:text-red-500 transition-colors"
                        aria-label={`Remove ${l.name}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => {
            setLeftovers([]);
            onNext();
          }}
          className="text-sm text-amber-500 hover:text-amber-700 underline underline-offset-2 transition-colors"
        >
          Nothing in stock, skip
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 shadow-sm transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default LeftoverInput;
