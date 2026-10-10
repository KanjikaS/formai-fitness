import { describe, expect, it } from 'vitest';

import { fibreForCalories, mealMacroInsights, proteinFloor } from '@/lib/nutrition';

describe('nutrition formulas', () => {
  it('computes the weight-based protein floor (0.8 g/kg)', () => {
    expect(proteinFloor(68.5)).toBe(55);
    expect(proteinFloor(50)).toBe(40);
  });

  it('computes fibre as 14 g per 1,000 kcal', () => {
    expect(fibreForCalories(2000)).toBe(28);
    expect(fibreForCalories(500)).toBe(7);
  });

  it('flags a carb-heavy, low-protein meal correctly', () => {
    // 650 kcal → carbs target 73–106 g, protein target ~18 g (55 ÷ 3), fat 14–25 g, fibre 9 g
    const stats = mealMacroInsights(
      { calories: 650, macros: { protein: 8, carbs: 82, fat: 28, fibre: 9 } },
      68.5,
    );
    const byKey = Object.fromEntries(stats.map((s) => [s.key, s]));
    expect(byKey['carbs']?.status).toBe('on track');
    expect(byKey['carbs']?.target).toBe('73–106 g · 45–65% of kcal');
    expect(byKey['protein']?.status).toBe('low');
    expect(byKey['fat']?.status).toBe('high');
    expect(byKey['fibre']?.status).toBe('on track');
  });

  it('flags a protein-rich meal as on track and low carbs as low', () => {
    const stats = mealMacroInsights(
      { calories: 410, macros: { protein: 26, carbs: 18, fat: 24, fibre: 7 } },
      68.5,
    );
    const byKey = Object.fromEntries(stats.map((s) => [s.key, s]));
    expect(byKey['protein']?.status).toBe('on track');
    expect(byKey['carbs']?.status).toBe('low');
    expect(byKey['fat']?.status).toBe('high');
    expect(byKey['fibre']?.target).toBe('6 g · 14 g per 1,000 kcal');
  });

  it('marks fibre low when well under 14 g per 1,000 kcal', () => {
    const stats = mealMacroInsights(
      { calories: 540, macros: { protein: 19, carbs: 78, fat: 15, fibre: 2 } },
      68.5,
    );
    expect(stats.find((s) => s.key === 'fibre')?.status).toBe('low');
  });
});
