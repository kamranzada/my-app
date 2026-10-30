const AppState = {
  currentStep: 1,
  formData: {
    age: null, gender: null, height: null, weight: null,
    goal: null, activityLevel: null,
    daysPerWeek: null, workoutType: null, duration: null
  },
  results: {
    bmr: null, tdee: null, calorieTarget: null,
    macros: { protein: 0, carbs: 0, fat: 0 },
    mealPlan: null
  }
};

const Calculations = {
  ACTIVITY_MULTIPLIERS: {
    sedentary:         1.2,
    lightly_active:    1.375,
    moderately_active: 1.55,
    very_active:       1.725
  },
  GOAL_ADJUSTMENTS: { lose: -500, maintain: 0, build: 300 },
  MACRO_SPLITS: {
    lose:     { p: 0.40, c: 0.30, f: 0.30 },
    maintain: { p: 0.30, c: 0.40, f: 0.30 },
    build:    { p: 0.35, c: 0.45, f: 0.20 }
  },
  CALS_PER_GRAM: { protein: 4, carbs: 4, fat: 9 },

  calcBMR(data) {
    const base = (10 * data.weight) + (6.25 * data.height) - (5 * data.age);
    return data.gender === 'male' ? base + 5 : base - 161;
  },
  calcTDEE(bmr, activityLevel) {
    return bmr * this.ACTIVITY_MULTIPLIERS[activityLevel];
  },
  calcCalorieTarget(tdee, goal) {
    return tdee + this.GOAL_ADJUSTMENTS[goal];
  },
  calcMacros(calorieTarget, goal) {
    const s = this.MACRO_SPLITS[goal];
    return {
      protein: Math.round((calorieTarget * s.p) / this.CALS_PER_GRAM.protein),
      carbs:   Math.round((calorieTarget * s.c) / this.CALS_PER_GRAM.carbs),
      fat:     Math.round((calorieTarget * s.f) / this.CALS_PER_GRAM.fat)
    };
  },
  runAll(data) {
    const bmr           = Math.round(this.calcBMR(data));
    const tdee          = Math.round(this.calcTDEE(bmr, data.activityLevel));
    const calorieTarget = Math.round(this.calcCalorieTarget(tdee, data.goal));
    const macros        = this.calcMacros(calorieTarget, data.goal);
    return { bmr, tdee, calorieTarget, macros };
  }
};

const MealSelector = {
  DISTRIBUTION: { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 },

  selectMeals(calorieTarget, db) {
    const plan = {};
    for (const category of Object.keys(this.DISTRIBUTION)) {
      const target = calorieTarget * this.DISTRIBUTION[category];
      plan[category] = db[category].reduce((best, meal) =>
        Math.abs(meal.calories - target) < Math.abs(best.calories - target) ? meal : best
      );
    }
    return plan;
  }
};

const Renderer = {
  ICONS: { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' },
  MACRO_PCT: {
    lose:     { p: 40, c: 30, f: 30 },
    maintain: { p: 30, c: 40, f: 30 },
    build:    { p: 35, c: 45, f: 20 }
  },

  buildResultsHTML(results) {
    const { bmr, tdee, calorieTarget, macros, mealPlan } = results;
    const goal   = AppState.formData.goal;
    const splits = this.MACRO_PCT[goal];

    const totals = Object.values(mealPlan).reduce((acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein:  acc.protein  + meal.protein,
      carbs:    acc.carbs    + meal.carbs,
      fat:      acc.fat      + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const mealCardsHTML = Object.entries(mealPlan).map(([category, meal]) => `
      <div class="meal-card">
        <div class="meal-card-header">
          <span class="meal-category-icon">${this.ICONS[category]}</span>
          <span class="meal-category-label">${category}</span>
        </div>
        <div class="meal-name">${meal.name}</div>
        <div class="meal-calories">${meal.calories.toLocaleString()} <span>cal</span></div>
        <div class="meal-macros">
          <span class="macro-chip macro-chip--protein">P ${meal.protein}g</span>
          <span class="macro-chip macro-chip--carbs">C ${meal.carbs}g</span>
          <span class="macro-chip macro-chip--fat">F ${meal.fat}g</span>
        </div>
      </div>
    `).join('');

    return `
      <div class="results-title">Your Daily Nutrition Plan</div>

      <div class="stats-row">
        <div class="stat-tile">
          <div class="stat-label">BMR</div>
          <div class="stat-value">${bmr.toLocaleString()}</div>
          <div class="stat-unit">cal/day at rest</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">TDEE</div>
          <div class="stat-value">${tdee.toLocaleString()}</div>
          <div class="stat-unit">cal/day w/ activity</div>
        </div>
        <div class="stat-tile stat-tile--highlight">
          <div class="stat-label">Your Target</div>
          <div class="stat-value">${calorieTarget.toLocaleString()}</div>
          <div class="stat-unit">calories per day</div>
        </div>
      </div>

      <div class="macros-section">
        <div class="section-title">Daily Macros Target</div>
        <div class="macro-bar-item">
          <div class="macro-bar-header">
            <span class="macro-name">Protein</span>
            <span><span class="macro-grams">${macros.protein}g</span><span class="macro-pct">${splits.p}%</span></span>
          </div>
          <div class="macro-track"><div class="macro-fill macro-fill--protein" style="width:${splits.p}%"></div></div>
        </div>
        <div class="macro-bar-item">
          <div class="macro-bar-header">
            <span class="macro-name">Carbohydrates</span>
            <span><span class="macro-grams">${macros.carbs}g</span><span class="macro-pct">${splits.c}%</span></span>
          </div>
          <div class="macro-track"><div class="macro-fill macro-fill--carbs" style="width:${splits.c}%"></div></div>
        </div>
        <div class="macro-bar-item">
          <div class="macro-bar-header">
            <span class="macro-name">Fat</span>
            <span><span class="macro-grams">${macros.fat}g</span><span class="macro-pct">${splits.f}%</span></span>
          </div>
          <div class="macro-track"><div class="macro-fill macro-fill--fat" style="width:${splits.f}%"></div></div>
        </div>
      </div>

      <div class="meals-section">
        <div class="section-title">Suggested Meal Plan</div>
        <div class="meals-grid">${mealCardsHTML}</div>
      </div>

      <div class="plan-totals">
        <div class="section-title">Plan Totals</div>
        <div class="totals-row">
          <div class="total-item">
            <div class="total-label">Calories</div>
            <div class="total-value total-value--calories">${totals.calories.toLocaleString()}</div>
          </div>
          <div class="total-item">
            <div class="total-label">Protein</div>
            <div class="total-value total-value--protein">${totals.protein}g</div>
          </div>
          <div class="total-item">
            <div class="total-label">Carbs</div>
            <div class="total-value total-value--carbs">${totals.carbs}g</div>
          </div>
          <div class="total-item">
            <div class="total-label">Fat</div>
            <div class="total-value total-value--fat">${totals.fat}g</div>
          </div>
        </div>
      </div>
    `;
  }
};

const Validator = {
  setError(fieldId, message) {
    const errorEl = document.getElementById(fieldId + '-error');
    if (errorEl) errorEl.textContent = message;
    const inputEl = document.getElementById(fieldId);
    if (inputEl) inputEl.classList.add('is-invalid');
  },
  clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  },
  validateStep(step) {
    this.clearErrors();
    let valid = true;

    if (step === 1) {
      const age = parseInt(document.getElementById('age').value);
      if (!age || age < 15 || age > 100) {
        this.setError('age', 'Enter a valid age (15–100)');
        valid = false;
      }
      if (!document.querySelector('input[name="gender"]:checked')) {
        this.setError('gender', 'Please select a gender');
        valid = false;
      }
      const height = parseFloat(document.getElementById('height').value);
      if (!height || height < 100 || height > 250) {
        this.setError('height', 'Enter a valid height (100–250 cm)');
        valid = false;
      }
      const weight = parseFloat(document.getElementById('weight').value);
      if (!weight || weight < 30 || weight > 300) {
        this.setError('weight', 'Enter a valid weight (30–300 kg)');
        valid = false;
      }
      if (!document.querySelector('input[name="goal"]:checked')) {
        this.setError('goal', 'Please select a fitness goal');
        valid = false;
      }
      if (!document.querySelector('input[name="activityLevel"]:checked')) {
        this.setError('activityLevel', 'Please select an activity level');
        valid = false;
      }
    }

    if (step === 2) {
      const days = parseInt(document.getElementById('daysPerWeek').value);
      if (!days || days < 1 || days > 7) {
        this.setError('daysPerWeek', 'Enter a valid number of days (1–7)');
        valid = false;
      }
      const duration = parseInt(document.getElementById('duration').value);
      if (!duration || duration < 10 || duration > 300) {
        this.setError('duration', 'Enter a valid duration (10–300 min)');
        valid = false;
      }
      if (!document.querySelector('input[name="workoutType"]:checked')) {
        this.setError('workoutType', 'Please select a workout type');
        valid = false;
      }
    }

    return valid;
  }
};

const UIController = {
  btnNext: null,
  btnBack: null,

  init() {
    this.btnNext = document.getElementById('btn-next');
    this.btnBack = document.getElementById('btn-back');
    this.btnNext.addEventListener('click', () => this.handleNext());
    this.btnBack.addEventListener('click', () => this.handleBack());
    this.loadFromStorage();
    this.showStep(1);
  },

  showStep(stepNumber) {
    document.querySelectorAll('.form-step').forEach(el => {
      el.classList.remove('active', 'visible');
    });
    const stepEl = document.getElementById('step-' + stepNumber);
    stepEl.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stepEl.classList.add('visible');
      });
    });
    this.updateProgress(stepNumber);
    this.updateNavButtons(stepNumber);
  },

  updateProgress(stepNumber) {
    document.querySelectorAll('.progress-step').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.remove('active', 'completed');
      const bubble = el.querySelector('.step-bubble');
      if (s < stepNumber) {
        el.classList.add('completed');
        bubble.textContent = '✓';
      } else if (s === stepNumber) {
        el.classList.add('active');
        bubble.textContent = s;
      } else {
        bubble.textContent = s;
      }
    });
    document.querySelectorAll('.progress-connector').forEach((el, i) => {
      el.classList.toggle('completed', i + 1 < stepNumber);
    });
  },

  updateNavButtons(stepNumber) {
    this.btnBack.classList.toggle('hidden', stepNumber === 1);
    if (stepNumber === 1)      this.btnNext.textContent = 'Next →';
    else if (stepNumber === 2) this.btnNext.textContent = 'Get My Plan →';
    else                       this.btnNext.textContent = 'Start Over';
  },

  collectStepData(stepNumber) {
    if (stepNumber === 1) {
      AppState.formData.age           = parseInt(document.getElementById('age').value);
      AppState.formData.gender        = document.querySelector('input[name="gender"]:checked').value;
      AppState.formData.height        = parseFloat(document.getElementById('height').value);
      AppState.formData.weight        = parseFloat(document.getElementById('weight').value);
      AppState.formData.goal          = document.querySelector('input[name="goal"]:checked').value;
      AppState.formData.activityLevel = document.querySelector('input[name="activityLevel"]:checked').value;
    }
    if (stepNumber === 2) {
      AppState.formData.daysPerWeek  = parseInt(document.getElementById('daysPerWeek').value);
      AppState.formData.duration     = parseInt(document.getElementById('duration').value);
      AppState.formData.workoutType  = document.querySelector('input[name="workoutType"]:checked').value;
    }
    localStorage.setItem('fuelfit_data', JSON.stringify(AppState.formData));
  },

  loadFromStorage() {
    const saved = localStorage.getItem('fuelfit_data');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      Object.assign(AppState.formData, data);
      if (data.age)         document.getElementById('age').value         = data.age;
      if (data.height)      document.getElementById('height').value      = data.height;
      if (data.weight)      document.getElementById('weight').value      = data.weight;
      if (data.daysPerWeek) document.getElementById('daysPerWeek').value = data.daysPerWeek;
      if (data.duration)    document.getElementById('duration').value    = data.duration;
      ['gender', 'goal', 'activityLevel', 'workoutType'].forEach(name => {
        if (data[name]) {
          const radio = document.querySelector(`input[name="${name}"][value="${data[name]}"]`);
          if (radio) radio.checked = true;
        }
      });
    } catch (e) {
      localStorage.removeItem('fuelfit_data');
    }
  },

  handleNext() {
    if (AppState.currentStep === 3) {
      location.reload();
      return;
    }
    if (!Validator.validateStep(AppState.currentStep)) return;

    this.collectStepData(AppState.currentStep);

    if (AppState.currentStep === 2) {
      const calcResults = Calculations.runAll(AppState.formData);
      const mealPlan    = MealSelector.selectMeals(calcResults.calorieTarget, MEAL_DB);
      AppState.results  = { ...calcResults, mealPlan };
      document.getElementById('results-container').innerHTML =
        Renderer.buildResultsHTML(AppState.results);
    }

    AppState.currentStep++;
    this.showStep(AppState.currentStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  handleBack() {
    AppState.currentStep--;
    this.showStep(AppState.currentStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

document.addEventListener('DOMContentLoaded', () => UIController.init());
