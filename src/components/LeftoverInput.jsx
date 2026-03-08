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
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) return Number(fractionMatch[1]) / Number(fractionMatch[2]);
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [search]);

  function handleSelect(ing) {
    setSelected(ing);
    setSearch(ing.name);
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
        qtyDisplay: qty,
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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showDropdown && filtered.length > 0) setShowDropdown(true);
      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (selected) {
        handleAdd();
      } else if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        handleSelect(filtered[highlightedIndex]);
      } else if (filtered.length === 1) {
        handleSelect(filtered[0]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  const grouped = {};
  for (const l of leftovers) {
    const cat = l.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(l);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">
          What's in your pantry?
        </h2>
        <p className="text-sm text-ink/50 mb-4">
          Add ingredients you already have in stock so we can plan meals around them.
        </p>

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
              className="w-full px-3 py-2 rounded-lg border border-ink/15 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-ink placeholder-ink/30"
            />
            {showDropdown && filtered.length > 0 && (
              <ul
                ref={dropdownRef}
                className="absolute z-10 w-full mt-1 bg-white border border-ink/15 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {filtered.map((ing, index) => (
                  <li
                    key={ing.id}
                    onClick={() => handleSelect(ing)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2 cursor-pointer text-ink flex justify-between items-center ${
                      index === highlightedIndex ? 'bg-primary-light' : 'hover:bg-cream'
                    }`}
                  >
                    <span>{ing.name}</span>
                    <span className="text-xs text-ink/40 capitalize">{ing.category}</span>
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
                className="w-20 px-3 py-2 rounded-lg border border-ink/15 focus:outline-none focus:ring-2 focus:ring-primary text-ink placeholder-ink/30"
              />
              {selected && ['bunch', 'nos', 'pc', 'pk', 'box'].includes(unit) && !qty && (
                <div className="absolute top-full left-0 mt-1 flex gap-1 z-10">
                  {FRACTION_PRESETS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setQty(f)}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-primary-light text-primary hover:bg-primary/20 border border-primary/20"
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
              className="px-2 py-2 rounded-lg border border-ink/15 focus:outline-none focus:ring-2 focus:ring-primary text-ink bg-white"
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
              className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {leftovers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
          <h3 className="text-sm font-semibold text-ink/70 mb-3">
            Pantry stock ({leftovers.length})
          </h3>
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-medium text-ink/40 uppercase tracking-wide mb-2">
                  {CATEGORY_LABELS[cat] || cat}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((l) => (
                    <span
                      key={l.ingredientId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream border border-ink/15 text-sm text-ink"
                    >
                      <span className="font-medium">{l.name}</span>
                      <span className="text-ink/50">
                        {l.qtyDisplay || l.qty} {l.unit}
                      </span>
                      <button
                        onClick={() => handleRemove(l.ingredientId)}
                        className="ml-1 text-ink/40 hover:text-accent transition-colors"
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

      <div className="flex justify-between items-center">
        <button
          onClick={() => {
            setLeftovers([]);
            onNext();
          }}
          className="text-sm text-ink/50 hover:text-primary underline underline-offset-2 transition-colors"
        >
          Nothing in stock, skip
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark shadow-sm transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default LeftoverInput;
