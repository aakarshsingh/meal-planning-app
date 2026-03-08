import { useState } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

function WeekPreferences({ preferences, setPreferences, leftoversCount, onBack, onNext }) {
  const [requestText, setRequestText] = useState('');

  const { skipDays, skipMeals, specialRequests, chickenCount } = preferences;

  function toggleDay(day) {
    if (skipDays.includes(day)) {
      // Un-skip: remove from skipDays and clear any skipMeals for this day
      setPreferences((p) => ({
        ...p,
        skipDays: p.skipDays.filter((d) => d !== day),
        skipMeals: p.skipMeals.filter((s) => s.day !== day),
      }));
    } else {
      // Skip entire day: add to skipDays, remove individual meal skips
      setPreferences((p) => ({
        ...p,
        skipDays: [...p.skipDays, day],
        skipMeals: p.skipMeals.filter((s) => s.day !== day),
      }));
    }
  }

  function toggleMealSkip(day, mealType) {
    const exists = skipMeals.some((s) => s.day === day && s.mealType === mealType);
    if (exists) {
      setPreferences((p) => ({
        ...p,
        skipMeals: p.skipMeals.filter((s) => !(s.day === day && s.mealType === mealType)),
      }));
    } else {
      setPreferences((p) => ({
        ...p,
        skipMeals: [...p.skipMeals, { day, mealType }],
      }));
    }
  }

  function addRequest() {
    const text = requestText.trim();
    if (!text) return;
    setPreferences((p) => ({
      ...p,
      specialRequests: [...p.specialRequests, text],
    }));
    setRequestText('');
  }

  function removeRequest(idx) {
    setPreferences((p) => ({
      ...p,
      specialRequests: p.specialRequests.filter((_, i) => i !== idx),
    }));
  }

  function setChicken(val) {
    setPreferences((p) => ({ ...p, chickenCount: Math.max(0, Math.min(6, val)) }));
  }

  // Summary calculations
  const activeDays = DAYS.filter((d) => !skipDays.includes(d));
  const totalMealSlots = activeDays.reduce((sum, day) => {
    const skippedForDay = skipMeals.filter((s) => s.day === day).length;
    return sum + (3 - skippedForDay); // 3 meals per day minus skipped
  }, 0);

  // Check if a day has individual meal skips (partially skipped)
  function dayHasMealSkips(day) {
    return skipMeals.some((s) => s.day === day);
  }

  return (
    <div className="space-y-6">
      {/* Day skip toggles */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6">
        <h2 className="text-lg font-semibold text-amber-800 mb-1">
          Which days are you planning for?
        </h2>
        <p className="text-sm text-amber-500 mb-4">
          Toggle off days you're eating out or skipping. Click a skipped day to skip specific meals only.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {DAYS.map((day) => {
            const isSkipped = skipDays.includes(day);
            const hasPartialSkips = dayHasMealSkips(day);

            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => toggleDay(day)}
                  className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
                    isSkipped
                      ? 'bg-gray-100 text-gray-400 border border-gray-200'
                      : hasPartialSkips
                        ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                        : 'bg-amber-500 text-white shadow-sm hover:bg-amber-600'
                  }`}
                >
                  {DAY_SHORT[day]}
                </button>
                {isSkipped && (
                  <span className="text-xs text-gray-400">skipped</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Individual meal skip checkboxes for active days */}
        {activeDays.length > 0 && activeDays.length < 6 && (
          <div className="mt-4 pt-4 border-t border-amber-100">
            <p className="text-xs font-medium text-amber-500 uppercase tracking-wide mb-3">
              Skip specific meals
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeDays.map((day) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-amber-700 w-12">
                    {DAY_SHORT[day]}
                  </span>
                  {MEAL_TYPES.map((mt) => {
                    const isSkipped = skipMeals.some(
                      (s) => s.day === day && s.mealType === mt
                    );
                    return (
                      <label
                        key={mt}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSkipped}
                          onChange={() => toggleMealSkip(day, mt)}
                          className="rounded border-amber-300 text-amber-500 focus:ring-amber-400"
                        />
                        <span
                          className={`text-xs capitalize ${
                            isSkipped ? 'text-gray-400 line-through' : 'text-amber-600'
                          }`}
                        >
                          {mt}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Special requests */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6">
        <h2 className="text-lg font-semibold text-amber-800 mb-1">
          Special requests
        </h2>
        <p className="text-sm text-amber-500 mb-4">
          Any preferences for this week's meals?
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRequest()}
            placeholder="e.g. no rice this week, light meals on weekdays"
            className="flex-1 px-3 py-2 rounded-lg border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-amber-900 placeholder-amber-300 text-sm"
          />
          <button
            onClick={addRequest}
            disabled={!requestText.trim()}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Add
          </button>
        </div>

        {specialRequests.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {specialRequests.map((req, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-sm text-amber-800"
              >
                {req}
                <button
                  onClick={() => removeRequest(i)}
                  className="text-amber-400 hover:text-red-500 transition-colors"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chicken count */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6">
        <h2 className="text-lg font-semibold text-amber-800 mb-1">
          Chicken dishes this week
        </h2>
        <p className="text-sm text-amber-500 mb-4">
          How many chicken meals do you want?
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setChicken(chickenCount - 1)}
            disabled={chickenCount <= 0}
            className="w-10 h-10 rounded-lg border border-amber-200 text-amber-700 font-bold text-lg hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            -
          </button>
          <span className="w-8 text-center text-xl font-semibold text-amber-800">
            {chickenCount}
          </span>
          <button
            onClick={() => setChicken(chickenCount + 1)}
            disabled={chickenCount >= 6}
            className="w-10 h-10 rounded-lg border border-amber-200 text-amber-700 font-bold text-lg hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-amber-100 rounded-xl border border-amber-200 p-5">
        <h3 className="text-sm font-semibold text-amber-700 mb-2">Week summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-800">{activeDays.length}</p>
            <p className="text-xs text-amber-600">days</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-800">{totalMealSlots}</p>
            <p className="text-xs text-amber-600">meals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-800">{chickenCount}</p>
            <p className="text-xs text-amber-600">chicken</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-800">{leftoversCount}</p>
            <p className="text-xs text-amber-600">leftovers</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          Back
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

export default WeekPreferences;
