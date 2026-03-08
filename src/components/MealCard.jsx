const TYPE_ICONS = { egg: '\u{1F95A}', chicken: '\u{1F357}' };

const FRUIT_ICONS = {
  'Guava': '\u{1F34F}',
  'Pomegranate': '\u{1F9C3}',
  'Apple': '\u{1F34E}',
  'Kiwi': '\u{1F95D}',
  'Grapes': '\u{1F347}',
  'Strawberry': '\u{1F353}',
  'Banana': '\u{1F34C}',
  'Orange': '\u{1F34A}',
  'Mango': '\u{1F96D}',
  'Watermelon': '\u{1F349}',
  'Papaya': '\u{1F352}',
};

const BASE_OPTIONS = ['rice', 'roti', 'paratha', 'pav', 'noodles'];

function MealCard({ meal, onRemove, onSwap, onQtyChange, onBaseChange }) {
  if (!meal) return null;

  const isChicken = meal.type === 'chicken';
  const isFruit = meal.type === 'fruit';
  const icon = isFruit
    ? (FRUIT_ICONS[meal.name] || '\u{1F34E}')
    : TYPE_ICONS[meal.type] || '';

  return (
    <div
      className={`rounded-lg border p-2 text-sm transition-shadow ${
        isChicken
          ? 'bg-gold-light border-gold/30 shadow-sm'
          : 'bg-white border-ink/10 shadow-sm'
      }`}
    >
      <div className="flex items-start gap-1 mb-1">
        {icon && <span className="text-base leading-none">{icon}</span>}
        <span className="font-medium text-ink leading-tight text-xs line-clamp-2 flex-1">
          {meal.name}
        </span>
      </div>

      {meal.base && (
        <div className="flex items-center gap-1 mb-1">
          {onBaseChange ? (
            <div className="flex gap-0.5 flex-wrap">
              {BASE_OPTIONS.map((b) => (
                <button
                  key={b}
                  onClick={(e) => { e.stopPropagation(); onBaseChange(b); }}
                  className={`text-[9px] px-1 py-0.5 rounded capitalize transition-colors ${
                    meal.base === b
                      ? 'bg-primary text-white'
                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-ink/40 capitalize">{meal.base}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-1 pt-1 border-t border-ink/10">
        <div className="flex gap-1">
          {onSwap && (
            <button
              onClick={(e) => { e.stopPropagation(); onSwap(); }}
              className="w-6 h-6 rounded text-xs hover:bg-primary-light text-ink/50 transition-colors"
              title="Swap"
            >
              {'\u{1F504}'}
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-6 h-6 rounded text-xs hover:bg-accent-light text-ink/40 hover:text-accent transition-colors"
              title="Remove"
            >
              &times;
            </button>
          )}
        </div>
        {onQtyChange && meal.defaultQty && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onQtyChange(-1); }}
              className="w-5 h-5 rounded text-[10px] border border-ink/15 hover:bg-primary-light text-ink/60"
            >
              -
            </button>
            <span className="text-[10px] text-ink/60 w-4 text-center">
              {meal.qty || meal.defaultQty}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onQtyChange(1); }}
              className="w-5 h-5 rounded text-[10px] border border-ink/15 hover:bg-primary-light text-ink/60"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MealCard;
