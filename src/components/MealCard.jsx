import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TYPE_ICONS = { egg: '\u{1F95A}', chicken: '\u{1F357}', breakfast: '\u{2615}' };

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

function MealCard({ id, meal, dragId, onRemove, onSwap, onQtyChange, onBaseChange, compact }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dragId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (!meal) return null;

  const isChicken = meal.type === 'chicken';
  const isEgg = meal.type === 'egg';
  const isFruit = meal.type === 'fruit';
  // Only show icons for egg, chicken, fruit — no icon for veg
  const icon = isFruit
    ? (FRUIT_ICONS[meal.name] || '\u{1F34E}')
    : TYPE_ICONS[meal.type] || '';

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`px-2 py-1 rounded border text-xs cursor-grab active:cursor-grabbing truncate ${
          isFruit
            ? 'bg-green-50 border-green-200 text-green-800'
            : isChicken
              ? 'bg-orange-50 border-orange-200 text-orange-800'
              : isEgg
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        {icon ? `${icon} ` : ''}{meal.name}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-2 text-sm transition-shadow ${
        isChicken
          ? 'bg-orange-50 border-orange-200 shadow-sm'
          : 'bg-white border-amber-200 shadow-sm'
      }`}
    >
      {/* Drag handle area */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex items-start gap-1 mb-1"
      >
        {icon && <span className="text-base leading-none">{icon}</span>}
        <span className="font-medium text-amber-900 leading-tight text-xs line-clamp-2 flex-1">
          {meal.name}
        </span>
      </div>

      {/* Base label with swap */}
      {meal.base && (
        <div className="flex items-center gap-1 mb-1">
          {onBaseChange ? (
            <div className="flex gap-0.5">
              {BASE_OPTIONS.map((b) => (
                <button
                  key={b}
                  onClick={(e) => { e.stopPropagation(); onBaseChange(b); }}
                  className={`text-[9px] px-1 py-0.5 rounded capitalize transition-colors ${
                    meal.base === b
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 text-amber-500 hover:bg-amber-200'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-amber-400 capitalize">{meal.base}</span>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between mt-1 pt-1 border-t border-amber-100">
        <div className="flex gap-1">
          {onSwap && (
            <button
              onClick={(e) => { e.stopPropagation(); onSwap(); }}
              className="w-6 h-6 rounded text-xs hover:bg-amber-100 text-amber-500 transition-colors"
              title="Swap"
            >
              {'\u{1F504}'}
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-6 h-6 rounded text-xs hover:bg-red-50 text-amber-400 hover:text-red-500 transition-colors"
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
              className="w-5 h-5 rounded text-[10px] border border-amber-200 hover:bg-amber-50 text-amber-600"
            >
              -
            </button>
            <span className="text-[10px] text-amber-600 w-4 text-center">
              {meal.qty || meal.defaultQty}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onQtyChange(1); }}
              className="w-5 h-5 rounded text-[10px] border border-amber-200 hover:bg-amber-50 text-amber-600"
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
