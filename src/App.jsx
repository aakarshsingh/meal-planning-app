import { useState, useEffect } from 'react';
import LeftoverInput from './components/LeftoverInput';
import WeekPreferences from './components/WeekPreferences';
import MealGrid from './components/MealGrid';
import WeeklyChart from './components/WeeklyChart';
import GroceryList from './components/GroceryList';

const STEP_LABELS = ['Leftovers', 'Preferences', 'Meal Plan'];

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

  // Load master meals once
  useEffect(() => {
    fetch('/api/meals')
      .then((r) => r.json())
      .then(setMasterMeals)
      .catch(() => {});
  }, []);

  function handleFinalize() {
    if (!plan) return;
    setFinalizing(true);

    // First save the current plan
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const currentWeek = {
      weekStart: monday.toISOString().slice(0, 10),
      weekEnd: saturday.toISOString().slice(0, 10),
      leftovers,
      preferences,
      plan,
      groceryList: [],
      finalized: false,
    };

    // Save current week then finalize
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
        setTimeout(() => {
          // Reset everything for next week
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
      .catch(() => setFinalizing(false));
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-amber-800 text-center">
            Weekly Meal Planner
          </h1>
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 ${step === 2 ? 'max-w-6xl' : 'max-w-4xl'}`}>
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
            />

            {plan && masterMeals && (
              <>
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
    </div>
  );
}

export default App;
