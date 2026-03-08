import { useState } from 'react';
import LeftoverInput from './components/LeftoverInput';
import WeekPreferences from './components/WeekPreferences';
import MealGrid from './components/MealGrid';

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
          <MealGrid
            leftovers={leftovers}
            preferences={preferences}
            plan={plan}
            setPlan={setPlan}
            onBack={() => setStep(1)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
