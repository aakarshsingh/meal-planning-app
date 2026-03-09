import { useState } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

const QUICK_REQUESTS = [
  'No rice this week',
  'Light meals on weekdays',
  'More parathas',
  'Something Punjabi',
  'No eggs this week',
  'Extra veggies',
  'Quick meals only',
  'Something new / experimental',
];

function WeekPreferences({ preferences, setPreferences, leftoversCount, onBack, onNext }) {
  const [requestText, setRequestText] = useState('');

  const { skipDays, skipMeals, specialRequests, chickenCount } = preferences;

  function toggleDay(day) {
    if (skipDays.includes(day)) {
      setPreferences((p) => ({
        ...p,
        skipDays: p.skipDays.filter((d) => d !== day),
        skipMeals: p.skipMeals.filter((s) => s.day !== day),
      }));
    } else {
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
      const otherSkips = skipMeals.filter((s) => s.day === day);
      if (otherSkips.length === 2) {
        setPreferences((p) => ({
          ...p,
          skipDays: [...p.skipDays, day],
          skipMeals: p.skipMeals.filter((s) => s.day !== day),
        }));
      } else {
        setPreferences((p) => ({
          ...p,
          skipMeals: [...p.skipMeals, { day, mealType }],
        }));
      }
    }
  }

  function addRequest(text) {
    const t = (text || requestText).trim();
    if (!t || specialRequests.includes(t)) return;
    setPreferences((p) => ({
      ...p,
      specialRequests: [...p.specialRequests, t],
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

  const activeDays = DAYS.filter((d) => !skipDays.includes(d));
  const totalMealSlots = activeDays.reduce((sum, day) => {
    const skippedForDay = skipMeals.filter((s) => s.day === day).length;
    return sum + (3 - skippedForDay);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Day & meal planning */}
      <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">
          Plan your week
        </h2>
        <p className="text-sm text-ink/50 mb-4">
          Toggle days off or skip individual meals. Tap a day button to skip the entire day.
        </p>

        <div className="space-y-2">
          {DAYS.map((day) => {
            const isFullySkipped = skipDays.includes(day);

            return (
              <div
                key={day}
                className={`rounded-lg p-3 transition-colors ${
                  isFullySkipped ? 'bg-gray-50' : 'bg-cream/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDay(day)}
                    className={`w-14 py-1.5 rounded-md font-medium text-sm transition-all shrink-0 ${
                      isFullySkipped
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {DAY_SHORT[day]}
                  </button>

                  {isFullySkipped ? (
                    <span className="text-xs text-gray-400 italic">Entire day skipped</span>
                  ) : (
                    <div className="flex gap-3 flex-1">
                      {MEAL_TYPES.map((mt) => {
                        const isSkipped = skipMeals.some(
                          (s) => s.day === day && s.mealType === mt
                        );
                        return (
                          <label
                            key={mt}
                            className="flex items-center gap-1.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={!isSkipped}
                              onChange={() => toggleMealSkip(day, mt)}
                              className="rounded border-ink/20 text-primary focus:ring-primary"
                            />
                            <span
                              className={`text-xs capitalize ${
                                isSkipped ? 'text-gray-400 line-through' : 'text-ink/70'
                              }`}
                            >
                              {mt}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Special requests */}
      <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">
          Special requests
        </h2>
        <p className="text-sm text-ink/50 mb-3">
          Any preferences for this week's meals?
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_REQUESTS.filter((q) => !specialRequests.includes(q)).map((q) => (
            <button
              key={q}
              onClick={() => addRequest(q)}
              className="text-xs px-2.5 py-1 rounded-full border border-ink/15 text-ink/60 hover:bg-primary-light hover:border-primary/30 hover:text-primary transition-colors"
            >
              + {q}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRequest()}
            placeholder="Or type your own..."
            className="flex-1 px-3 py-2 rounded-lg border border-ink/15 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-ink placeholder-ink/30 text-sm"
          />
          <button
            onClick={() => addRequest()}
            disabled={!requestText.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Add
          </button>
        </div>

        {specialRequests.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {specialRequests.map((req, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream border border-ink/15 text-sm text-ink"
              >
                {req}
                <button
                  onClick={() => removeRequest(i)}
                  className="text-ink/40 hover:text-accent transition-colors"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Meat count */}
      <div className="bg-white rounded-xl shadow-sm border border-ink/10 p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">
          Meat dishes this week
        </h2>
        <p className="text-sm text-ink/50 mb-4">
          How many meat meals do you want? (chicken, mutton, etc.)
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setChicken(chickenCount - 1)}
            disabled={chickenCount <= 0}
            className="w-10 h-10 rounded-lg border border-ink/15 text-ink font-bold text-lg hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            -
          </button>
          <span className="w-8 text-center text-xl font-semibold text-ink">
            {chickenCount}
          </span>
          <button
            onClick={() => setChicken(chickenCount + 1)}
            disabled={chickenCount >= 6}
            className="w-10 h-10 rounded-lg border border-ink/15 text-ink font-bold text-lg hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-primary-light rounded-xl border border-primary/20 p-5">
        <h3 className="text-sm font-semibold text-primary mb-2">Week summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-ink">{activeDays.length}</p>
            <p className="text-xs text-ink/60">days</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ink">{totalMealSlots}</p>
            <p className="text-xs text-ink/60">meals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ink">{chickenCount}</p>
            <p className="text-xs text-ink/60">meat</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ink">{leftoversCount}</p>
            <p className="text-xs text-ink/60">pantry items</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg border border-ink/20 text-ink/70 hover:bg-primary-light transition-colors"
        >
          Back
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

export default WeekPreferences;
