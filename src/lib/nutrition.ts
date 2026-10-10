import type { Macros } from '@/components/formai/state';

export type MacroStatus = 'low' | 'on track' | 'high';

export type MealMacroStat = {
  key: keyof Macros;
  label: string;
  value: number;
  status: MacroStatus;
  target: string;
};

export const GRAMS = { protein: 4, carbs: 4, fat: 9 } as const;

/** Weight-based protein floor for the day (0.8 g × body weight kg). */
export function proteinFloor(weightKg: number): number {
  return Math.round(0.8 * weightKg);
}

/** Fibre goal for a calorie amount: 14 g per 1,000 kcal. */
export function fibreForCalories(kcal: number): number {
  return Math.round((kcal / 1000) * 14);
}

const within = (value: number, lo: number, hi: number): MacroStatus =>
  value < lo ? 'low' : value > hi ? 'high' : 'on track';

/**
 * Per-meal macro check against the standard formulas:
 * carbs 45–65% of calories, fat 20–35% of calories,
 * protein vs its share of the 0.8 g/kg daily floor, fibre 14 g / 1,000 kcal.
 */
export function mealMacroInsights(meal: { calories: number; macros: Macros }, weightKg: number, mealsPerDay = 3): MealMacroStat[] {
  const kcal = Math.max(meal.calories, 0);
  const { protein, carbs, fat, fibre } = meal.macros;

  const carbsLo = Math.round((kcal * 0.45) / GRAMS.carbs);
  const carbsHi = Math.round((kcal * 0.65) / GRAMS.carbs);
  const fatLo = Math.round((kcal * 0.2) / GRAMS.fat);
  const fatHi = Math.round((kcal * 0.35) / GRAMS.fat);
  const proteinTarget = Math.max(1, Math.round(proteinFloor(weightKg) / mealsPerDay));
  const proteinLo = Math.round(proteinTarget * 0.8);
  const proteinHi = Math.round(proteinTarget * 1.5);
  const fibreTarget = fibreForCalories(kcal);
  const fibreLo = Math.round(fibreTarget * 0.6);

  return [
    {
      key: 'carbs',
      label: 'Carbs',
      value: carbs,
      status: kcal === 0 ? 'low' : within(carbs, carbsLo, carbsHi),
      target: `${carbsLo}–${carbsHi} g · 45–65% of kcal`,
    },
    {
      key: 'protein',
      label: 'Protein',
      value: protein,
      status: within(protein, proteinLo, proteinHi),
      target: `~${proteinTarget} g · 0.8 g × ${weightKg} kg ÷ ${mealsPerDay} meals`,
    },
    {
      key: 'fat',
      label: 'Fat',
      value: fat,
      status: kcal === 0 ? 'low' : within(fat, fatLo, fatHi),
      target: `${fatLo}–${fatHi} g · 20–35% of kcal`,
    },
    {
      key: 'fibre',
      label: 'Fibre',
      value: fibre,
      status: fibre < fibreLo ? 'low' : 'on track',
      target: `${fibreTarget} g · 14 g per 1,000 kcal`,
    },
  ];
}
