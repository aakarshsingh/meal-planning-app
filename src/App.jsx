import { useState, useEffect, useRef, useCallback } from 'react';
import LeftoverInput from './components/LeftoverInput';
import WeekPreferences from './components/WeekPreferences';
import MealGrid from './components/MealGrid';
import WeeklyChart from './components/WeeklyChart';
import GroceryList from './components/GroceryList';
import ManageMealsModal from './components/ManageMealsModal';
import { ToastContainer } from './components/Toast';

const STEP_LABELS = ['Pantry Stock', 'Preferences', 'Meal Plan'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekMonday(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i < currentStep
                ? 'bg-amber-600 text-white'
                : i === currentStep
                  ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                  : 'bg-amber-100 text-amber-400'
            }`}
          >
            {i < currentStep ? '\u2713' : i + 1}
          </div>
          <span
            className={`text-sm hidden sm:inline ${
              i === currentStep ? 'text-amber-800 font-semibold' : 'text-amber-400'
            }`}
          >
            {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={`w-8 h-0.5 ${i < currentStep ? 'bg-amber-500' : 'bg-amber-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function App() {
  const [step, setStep] = useState(0);
  const [leftovers, setLeftovers] = useState([]);
  const [preferences, setPreferences] = useState({
    skipDays: [],
    skipMeals: [],
    specialRequests: [],
    chickenCount: 2,
  });
  const [plan, setPlan] = useState(null);
  const [groceryList, setGroceryList] = useState(null);
  const [masterMeals, setMasterMeals] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [showManageMeals, setShowManageMeals] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(null);

  // Week date range — find Monday of current week (app is used Sat/Sun for next week)
  const [weekMonday, setWeekMonday] = useState(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    // If it's Sat(6) or Sun(0), plan for next week's Monday
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + (dayOfWeek === 0 ? 1 : 2));
      return nextMon.toISOString().slice(0, 10);
    }
    return getWeekMonday(now).toISOString().slice(0, 10);
  });

  const weekSaturday = (() => {
    const mon = new Date(weekMonday + 'T00:00:00');
    const sat = new Date(mon);
    sat.setDate(mon.getDate() + 5);
    return sat;
  })();

  const weekLabel = `${formatDateShort(new Date(weekMonday + 'T00:00:00'))} - ${formatDateShort(weekSaturday)}`;

  const toastRef = useRef(null);
  const autoSaveTimer = useRef(null);

  // Load master meals once
  useEffect(() => {
    fetch('/api/meals')
      .then((r) => r.json())
      .then(setMasterMeals)
      .catch(() => toastRef.current?.error('Failed to load meals data'));
  }, []);

  // Check for existing plan on load (resume prompt)
  useEffect(() => {
    fetch('/api/planner/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.plan && Object.keys(data.plan).length > 0) {
          const hasContent = DAYS.some(
            (day) =>
              data.plan[day] &&
              (data.plan[day].breakfast || data.plan[day].lunch || data.plan[day].dinner || (data.plan[day].fruit && data.plan[day].fruit.length > 0))
          );
          if (hasContent && !data.finalized) {
            setResumePrompt(data);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Auto-save current week on plan change (debounced 2s)
  const autoSave = useCallback(() => {
    if (!plan) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const currentWeek = {
        weekStart: weekMonday,
        weekEnd: weekSaturday.toISOString().slice(0, 10),
        leftovers,
        preferences,
        plan,
        groceryList: [],
        finalized: false,
      };

      fetch('/api/planner/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentWeek),
      }).catch(() => {});
    }, 2000);
  }, [plan, leftovers, preferences, weekMonday, weekSaturday]);

  useEffect(() => {
    autoSave();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [autoSave]);

  function handleResume() {
    if (!resumePrompt) return;
    setPlan(resumePrompt.plan);
    if (resumePrompt.leftovers) setLeftovers(resumePrompt.leftovers);
    if (resumePrompt.preferences) setPreferences(resumePrompt.preferences);
    if (resumePrompt.weekStart) setWeekMonday(resumePrompt.weekStart);
    setStep(2);
    setResumePrompt(null);
    toastRef.current?.success('Resumed previous plan');
  }

  function handleStartFresh() {
    setResumePrompt(null);
  }

  function validatePlan() {
    if (!plan) return { errors: ['No plan generated yet'], warnings: [] };
    const errors = [];
    const warnings = [];

    for (const day of DAYS) {
      if (preferences.skipDays?.includes(day)) continue;
      const d = plan[day];
      if (!d) {
        errors.push(`${day} has no plan`);
        continue;
      }
      const isLunchSkipped = preferences.skipMeals?.some((s) => s.day === day && s.mealType === 'lunch');
      const isDinnerSkipped = preferences.skipMeals?.some((s) => s.day === day && s.mealType === 'dinner');
      if (!d.lunch && !isLunchSkipped) errors.push(`${day} lunch is empty`);
      if (!d.dinner && !isDinnerSkipped) errors.push(`${day} dinner is empty`);
    }

    if (masterMeals) {
      let chickenCount = 0;
      for (const day of DAYS) {
        if (!plan[day]) continue;
        for (const slot of ['breakfast', 'lunch', 'dinner']) {
          const mealId = plan[day][slot];
          if (!mealId) continue;
          const meal = masterMeals.meals?.find((m) => m.id === mealId);
          if (meal?.type === 'chicken') chickenCount++;
        }
      }
      const target = preferences.chickenCount || 2;
      if (chickenCount !== target) {
        warnings.push(`Chicken dishes: ${chickenCount} (target: ${target})`);
      }
    }

    const mealCounts = {};
    for (const day of DAYS) {
      if (!plan[day]) continue;
      for (const slot of ['lunch', 'dinner']) {
        const mealId = plan[day][slot];
        if (!mealId) continue;
        mealCounts[mealId] = (mealCounts[mealId] || 0) + 1;
      }
    }
    for (const [mealId, count] of Object.entries(mealCounts)) {
      if (count > 1) {
        const meal = masterMeals?.meals?.find((m) => m.id === mealId);
        warnings.push(`"${meal?.name || mealId}" appears ${count} times`);
      }
    }

    return { errors, warnings };
  }

  function handleFinalize() {
    if (!plan) return;

    const { errors, warnings } = validatePlan();
    if (errors.length > 0) {
      toastRef.current?.error(`Cannot finalize: ${errors[0]}`);
      return;
    }
    if (warnings.length > 0) {
      for (const w of warnings) {
        toastRef.current?.warning(w);
      }
    }

    setFinalizing(true);

    const currentWeek = {
      weekStart: weekMonday,
      weekEnd: weekSaturday.toISOString().slice(0, 10),
      leftovers,
      preferences,
      plan,
      groceryList: [],
      finalized: false,
    };

    fetch('/api/planner/current', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentWeek),
    })
      .then(() =>
        fetch('/api/planner/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .then((r) => r.json())
      .then(() => {
        setFinalized(true);
        setFinalizing(false);
        toastRef.current?.success('Week finalized and saved to history!');
        setTimeout(() => {
          setPlan(null);
          setLeftovers([]);
          setPreferences({
            skipDays: [],
            skipMeals: [],
            specialRequests: [],
            chickenCount: 2,
          });
          setGroceryList(null);
          setFinalized(false);
          setStep(0);
        }, 2000);
      })
      .catch(() => {
        setFinalizing(false);
        toastRef.current?.error('Failed to finalize week. Please try again.');
      });
  }

  function shiftWeek(delta) {
    const mon = new Date(weekMonday + 'T00:00:00');
    mon.setDate(mon.getDate() + (delta * 7));
    setWeekMonday(mon.toISOString().slice(0, 10));
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <ToastContainer toastRef={toastRef} />

      <header className="bg-white border-b border-amber-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-amber-800 shrink-0">
            Meal Planner
          </h1>

          {/* Week selector */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftWeek(-1)}
              className="w-7 h-7 rounded-md border border-amber-200 text-amber-500 hover:bg-amber-50 text-sm transition-colors"
            >
              &lsaquo;
            </button>
            <span className="text-sm text-amber-700 font-medium whitespace-nowrap">
              {weekLabel}
            </span>
            <button
              onClick={() => shiftWeek(1)}
              className="w-7 h-7 rounded-md border border-amber-200 text-amber-500 hover:bg-amber-50 text-sm transition-colors"
            >
              &rsaquo;
            </button>
          </div>

          <button
            onClick={() => setShowManageMeals(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors shrink-0"
          >
            Manage Meals
          </button>
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 ${step === 2 ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {/* Resume prompt */}
        {resumePrompt && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">You have an in-progress meal plan</p>
              <p className="text-xs text-blue-500 mt-0.5">
                Week of {resumePrompt.weekStart} to {resumePrompt.weekEnd}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleStartFresh}
                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Start Fresh
              </button>
              <button
                onClick={handleResume}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Resume
              </button>
            </div>
          </div>
        )}

        <StepIndicator currentStep={step} />

        {step === 0 && (
          <LeftoverInput
            leftovers={leftovers}
            setLeftovers={setLeftovers}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <WeekPreferences
            preferences={preferences}
            setPreferences={setPreferences}
            leftoversCount={leftovers.length}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <div className="space-y-6">
            <MealGrid
              leftovers={leftovers}
              preferences={preferences}
              plan={plan}
              setPlan={setPlan}
              onBack={() => setStep(1)}
              toastRef={toastRef}
            />

            {plan && masterMeals && (
              <>
                {/* Validation warnings */}
                {(() => {
                  const { warnings } = validatePlan();
                  if (warnings.length === 0) return null;
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      {warnings.map((w, i) => (
                        <p key={i} className="text-xs text-yellow-700 flex items-center gap-1.5">
                          <span className="text-yellow-500">&#9888;</span> {w}
                        </p>
                      ))}
                    </div>
                  );
                })()}

                <WeeklyChart
                  plan={plan}
                  masterMeals={masterMeals}
                  preferences={preferences}
                />

                <GroceryList plan={plan} leftovers={leftovers} />

                {/* Finalize button */}
                <div className="flex justify-center pt-2 pb-8">
                  {finalized ? (
                    <div className="px-6 py-3 rounded-xl bg-green-100 border border-green-300 text-green-700 font-medium">
                      Week finalized! Resetting...
                    </div>
                  ) : (
                    <button
                      onClick={handleFinalize}
                      disabled={finalizing}
                      className="px-8 py-3 rounded-xl bg-amber-600 text-white font-semibold text-lg hover:bg-amber-700 shadow-md disabled:opacity-50 transition-colors"
                    >
                      {finalizing ? 'Saving...' : 'Finalize Week'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {showManageMeals && (
        <ManageMealsModal
          onClose={() => setShowManageMeals(false)}
          toastRef={toastRef}
        />
      )}
    </div>
  );
}

export default App;
