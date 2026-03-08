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

// Format date as YYYY-MM-DD using LOCAL timezone (not UTC)
function toLocalDateStr(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

function WeekCalendarPicker({ selMonday, onSelect }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(selMonday + 'T00:00:00'));
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selMon = new Date(selMonday + 'T00:00:00');
  const selSat = new Date(selMon);
  selSat.setDate(selMon.getDate() + 5);
  const weekLabel = `${formatDateShort(selMon)} - ${formatDateShort(selSat)}`;

  function handleDayClick(day) {
    if (!day) return;
    const clicked = new Date(year, month, day);
    if (clicked.getDay() !== 1) return;
    // Use local date string — NOT toISOString() which converts to UTC
    onSelect(toLocalDateStr(clicked));
    setOpen(false);
  }

  function shiftMonth(delta) {
    setViewDate(new Date(year, month + delta, 1));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); setViewDate(new Date(selMonday + 'T00:00:00')); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink/15 hover:bg-primary-light transition-colors"
      >
        <span className="text-sm text-ink font-medium whitespace-nowrap">{weekLabel}</span>
        <svg className={`w-3.5 h-3.5 text-ink/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-xl border border-ink/10 p-3 w-72">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => shiftMonth(-1)} className="w-7 h-7 rounded-md hover:bg-primary-light text-primary text-sm">&lsaquo;</button>
            <span className="text-sm font-semibold text-ink">{monthName}</span>
            <button onClick={() => shiftMonth(1)} className="w-7 h-7 rounded-md hover:bg-primary-light text-primary text-sm">&rsaquo;</button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="text-[10px] text-ink/40 text-center font-medium py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const date = new Date(year, month, day);
              const isMonday = date.getDay() === 1;
              const isSelected = isMonday && date.getTime() === selMon.getTime();
              const isToday = date.getTime() === today.getTime();
              const inSelectedWeek = date >= selMon && date <= selSat && date.getDay() !== 0;

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(day)}
                  disabled={!isMonday}
                  className={`w-8 h-8 mx-auto rounded-md text-xs transition-colors ${
                    isSelected
                      ? 'bg-primary text-white font-bold'
                      : inSelectedWeek
                        ? 'bg-primary-light text-primary font-medium'
                        : isToday
                          ? 'ring-1 ring-primary text-ink font-medium'
                          : isMonday
                            ? 'text-ink hover:bg-primary-light font-medium cursor-pointer'
                            : 'text-ink/30 cursor-default'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-ink/40 text-center mt-2">Click a Monday to select the week</p>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <button
            onClick={() => onStepClick(i)}
            disabled={i > currentStep}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i < currentStep
                ? 'bg-primary text-white cursor-pointer hover:bg-primary-dark'
                : i === currentStep
                  ? 'bg-gold text-ink ring-2 ring-gold/50'
                  : 'bg-ink/10 text-ink/40 cursor-not-allowed'
            }`}
          >
            {i < currentStep ? '\u2713' : i + 1}
          </button>
          <button
            onClick={() => onStepClick(i)}
            disabled={i > currentStep}
            className={`text-sm hidden sm:inline transition-colors ${
              i < currentStep
                ? 'text-primary cursor-pointer hover:text-primary-dark'
                : i === currentStep
                  ? 'text-ink font-semibold'
                  : 'text-ink/40 cursor-not-allowed'
            }`}
          >
            {label}
          </button>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={`w-8 h-0.5 ${i < currentStep ? 'bg-primary' : 'bg-ink/15'}`}
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
  const [planReady, setPlanReady] = useState(false);
  const [masterMeals, setMasterMeals] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [showManageMeals, setShowManageMeals] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(null);
  // Lifted state: qty/base overrides persist across Edit ↔ Review
  const [quantities, setQuantities] = useState({});
  const [baseOverrides, setBaseOverrides] = useState({});

  const [weekMonday, setWeekMonday] = useState(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + (dayOfWeek === 0 ? 1 : 2));
      return toLocalDateStr(nextMon);
    }
    return toLocalDateStr(getWeekMonday(now));
  });

  const weekSaturdayStr = (() => {
    const mon = new Date(weekMonday + 'T00:00:00');
    const sat = new Date(mon);
    sat.setDate(mon.getDate() + 5);
    return toLocalDateStr(sat);
  })();

  const toastRef = useRef(null);
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    fetch('/api/meals')
      .then((r) => r.json())
      .then(setMasterMeals)
      .catch(() => toastRef.current?.error('Failed to load meals data'));
  }, []);

  useEffect(() => {
    fetch('/api/planner/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.plan && Object.keys(data.plan).length > 0) {
          const hasContent = DAYS.some(
            (day) =>
              data.plan[day] &&
              ((Array.isArray(data.plan[day].breakfast) ? data.plan[day].breakfast.length > 0 : data.plan[day].breakfast) || data.plan[day].lunch || data.plan[day].dinner || (data.plan[day].fruit && data.plan[day].fruit.length > 0))
          );
          if (hasContent && !data.finalized) {
            setResumePrompt(data);
          }
        }
      })
      .catch(() => {});
  }, []);

  const autoSave = useCallback(() => {
    if (!plan) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const currentWeek = {
        weekStart: weekMonday,
        weekEnd: weekSaturdayStr,
        leftovers,
        preferences,
        plan,
        quantities,
        baseOverrides,
        groceryList: [],
        finalized: false,
      };

      fetch('/api/planner/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentWeek),
      }).catch(() => {});
    }, 2000);
  }, [plan, leftovers, preferences, weekMonday, weekSaturdayStr, quantities, baseOverrides]);

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
    if (resumePrompt.quantities) setQuantities(resumePrompt.quantities);
    if (resumePrompt.baseOverrides) setBaseOverrides(resumePrompt.baseOverrides);
    setStep(2);
    setResumePrompt(null);
    toastRef.current?.success('Resumed previous plan');
  }

  function handleStartFresh() {
    setResumePrompt(null);
  }

  function handleStepClick(targetStep) {
    if (targetStep < step) {
      if (step === 2 && planReady) {
        setPlanReady(false);
        if (targetStep < 2) {
          setStep(targetStep);
        }
      } else {
        setStep(targetStep);
      }
    }
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
        const allIds = [plan[day].lunch, plan[day].dinner].filter(Boolean);
        for (const mealId of allIds) {
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

  function handleReviewPlan() {
    if (!plan) return;
    const { errors } = validatePlan();
    if (errors.length > 0) {
      toastRef.current?.error(`Fix before reviewing: ${errors[0]}`);
      return;
    }
    setPlanReady(true);
  }

  function handleBackToEdit() {
    setPlanReady(false);
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
      weekEnd: weekSaturdayStr,
      leftovers,
      preferences,
      plan,
      quantities,
      baseOverrides,
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
          setPlanReady(false);
          setLeftovers([]);
          setPreferences({
            skipDays: [],
            skipMeals: [],
            specialRequests: [],
            chickenCount: 2,
          });
          setQuantities({});
          setBaseOverrides({});
          setFinalized(false);
          setStep(0);
        }, 2000);
      })
      .catch(() => {
        setFinalizing(false);
        toastRef.current?.error('Failed to finalize week. Please try again.');
      });
  }

  return (
    <div className="min-h-screen bg-cream">
      <ToastContainer toastRef={toastRef} />

      <header className="bg-white border-b border-ink/10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-ink shrink-0">
            Meal Planner
          </h1>

          <WeekCalendarPicker selMonday={weekMonday} onSelect={setWeekMonday} />

          <button
            onClick={() => setShowManageMeals(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-ink/15 text-ink/70 hover:bg-primary-light hover:text-primary transition-colors shrink-0"
          >
            Manage Meals
          </button>
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 ${step === 2 ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {resumePrompt && (
          <div className="mb-6 bg-primary-light border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">You have an in-progress meal plan</p>
              <p className="text-xs text-ink/50 mt-0.5">
                Week of {resumePrompt.weekStart} to {resumePrompt.weekEnd}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleStartFresh}
                className="px-3 py-1.5 text-sm text-ink/60 hover:bg-white/50 rounded-lg transition-colors"
              >
                Start Fresh
              </button>
              <button
                onClick={handleResume}
                className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Resume
              </button>
            </div>
          </div>
        )}

        <StepIndicator currentStep={step} onStepClick={handleStepClick} />

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
            {!planReady && (
              <>
                <MealGrid
                  leftovers={leftovers}
                  preferences={preferences}
                  plan={plan}
                  setPlan={setPlan}
                  quantities={quantities}
                  setQuantities={setQuantities}
                  baseOverrides={baseOverrides}
                  setBaseOverrides={setBaseOverrides}
                  onBack={() => setStep(1)}
                  toastRef={toastRef}
                />

                {plan && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleReviewPlan}
                      className="px-8 py-3 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary-dark shadow-md transition-colors"
                    >
                      Review Plan
                    </button>
                  </div>
                )}
              </>
            )}

            {planReady && plan && masterMeals && (
              <>
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleBackToEdit}
                    className="px-4 py-2 rounded-lg border border-ink/15 text-ink/70 hover:bg-primary-light transition-colors text-sm"
                  >
                    &larr; Back to Edit
                  </button>
                  <h2 className="text-lg font-semibold text-ink">Review Your Plan</h2>
                  <div className="w-24" />
                </div>

                {(() => {
                  const { warnings } = validatePlan();
                  if (warnings.length === 0) return null;
                  return (
                    <div className="bg-gold-light border border-gold/30 rounded-lg p-3">
                      {warnings.map((w, i) => (
                        <p key={i} className="text-xs text-ink/70 flex items-center gap-1.5">
                          <span className="text-gold">&#9888;</span> {w}
                        </p>
                      ))}
                    </div>
                  );
                })()}

                <WeeklyChart
                  plan={plan}
                  masterMeals={masterMeals}
                  preferences={preferences}
                  baseOverrides={baseOverrides}
                  quantities={quantities}
                />

                <GroceryList plan={plan} leftovers={leftovers} baseOverrides={baseOverrides} />

                <div className="flex justify-center pt-2 pb-8">
                  {finalized ? (
                    <div className="px-6 py-3 rounded-xl bg-green-100 border border-green-300 text-green-700 font-medium">
                      Week finalized! Resetting...
                    </div>
                  ) : (
                    <button
                      onClick={handleFinalize}
                      disabled={finalizing}
                      className="px-8 py-3 rounded-xl bg-accent text-white font-semibold text-lg hover:bg-accent/90 shadow-md disabled:opacity-50 transition-colors"
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
