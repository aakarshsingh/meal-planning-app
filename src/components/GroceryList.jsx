import { useState, useEffect } from 'react';

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

function GroceryList({ plan, leftovers }) {
  const [groceryData, setGroceryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setLoading(true);
    fetch('/api/groceries/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, leftovers }),
    })
      .then((r) => r.json())
      .then((data) => {
        setGroceryData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [plan, leftovers]);

  function buildCopyText() {
    if (!groceryData) return '';
    const lines = ['Grocery List', ''];
    for (const cat of groceryData.categories) {
      const icon = CATEGORY_ICONS[cat.name] || '';
      const label = CATEGORY_LABELS[cat.name] || cat.name;
      lines.push(`${icon} ${label}:`);
      for (const item of cat.items) {
        const leftoverNote = item.leftover > 0 ? ` (${item.leftover} from leftovers)` : '';
        lines.push(`  ${item.name}: ${item.qty} ${item.unit}${leftoverNote}`);
      }
      lines.push('');
    }
    lines.push(`Total items: ${groceryData.totalItems}`);
    return lines.join('\n');
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleOptimize() {
    if (!groceryData) return;
    setAiLoading(true);
    fetch('/api/ai/optimize-grocery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groceryList: groceryData, plan }),
    })
      .then((r) => r.json())
      .then((data) => {
        setAiSuggestions(data.suggestions || []);
        setAiLoading(false);
      })
      .catch(() => {
        setAiSuggestions(['Could not get AI suggestions. Try again later.']);
        setAiLoading(false);
      });
  }

  if (!plan) return null;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
        <div className="flex items-center gap-3 justify-center py-8">
          <div className="animate-spin w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full" />
          <span className="text-sm text-ink/50">Generating grocery list...</span>
        </div>
      </div>
    );
  }

  if (!groceryData) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">
          Grocery List
          <span className="text-sm font-normal text-ink/50 ml-2">
            ({groceryData.totalItems} items)
          </span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleOptimize}
            disabled={aiLoading}
            className="text-xs px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 disabled:opacity-50 transition-colors"
          >
            {aiLoading ? 'Optimizing...' : 'Optimize with AI'}
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
            <h4 className="text-xs font-semibold text-purple-700">AI Suggestions</h4>
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

      <div className="space-y-4">
        {groceryData.categories.map((cat) => {
          const icon = CATEGORY_ICONS[cat.name] || '';
          const label = CATEGORY_LABELS[cat.name] || cat.name;

          return (
            <div key={cat.name}>
              <h3 className="text-sm font-semibold text-ink/70 mb-2">
                {icon} {label}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {cat.items.map((item) => {
                  const hasLeftover = item.leftover > 0;
                  return (
                    <div
                      key={item.id || item.name}
                      className={`flex items-center justify-between px-3 py-1.5 rounded text-sm ${
                        hasLeftover && item.needed === 0
                          ? 'bg-gray-50 text-gray-400'
                          : 'bg-cream/50 text-ink'
                      }`}
                    >
                      <span className={hasLeftover && item.needed === 0 ? 'line-through' : ''}>
                        {item.name}
                      </span>
                      <span className="text-xs text-ink/50 shrink-0 ml-2">
                        {item.qty}{' '}
                        <span title={UNIT_LABELS[item.unit] || item.unit} className="cursor-help border-b border-dotted border-ink/20">
                          {item.unit}
                        </span>
                        {hasLeftover && (
                          <span className="text-ink/40 ml-1 italic">
                            (-{item.leftover} leftover)
                          </span>
                        )}
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
