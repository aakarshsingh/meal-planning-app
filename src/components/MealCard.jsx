import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TYPE_ICONS = { veg: '\u{1F96C}', egg: '\u{1F95A}', chicken: '\u{1F357}', breakfast: '\u{2615}', fruit: '\u{1F34E}' };

function MealCard({ id, meal, dragId, onRemove, onSwap, onQtyChange, compact }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dragId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (!meal) return null;

  const isChicken = meal.type === 'chicken';
  const icon = TYPE_ICONS[meal.type] || TYPE_ICONS.veg;

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800 cursor-grab active:cursor-grabbing truncate"
      >
        {icon} {meal.name}
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
        <span className="text-base leading-none">{icon}</span>
        <span className="font-medium text-amber-900 leading-tight text-xs line-clamp-2 flex-1">
          {meal.name}
        </span>
      </div>

      {/* Base label */}
      {meal.base && (
        <span className="text-[10px] text-amber-400 capitalize">{meal.base}</span>
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
