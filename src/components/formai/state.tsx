import { createContext, useContext, useState, type ReactNode } from 'react';
export type Profile = { name: string; age: string; sex: string; level: string; conditions: string[]; other: string; complete: boolean };
export type Macros = { protein: number; carbs: number; fat: number; fibre: number };
export type Meal = { name: string; calories: number; type: string; source: 'photo' | 'manual' | 'sample'; macros: Macros; date: string };
type WeightEntry = { day: string; kg: number };
type AppState = { profile: Profile; setProfile: (p: Profile) => void; water: number; setWater: (n: number) => void; weight: number; setWeight: (n: number) => void; weightLog: WeightEntry[]; meals: Meal[]; allMeals: Meal[]; addMeal: (m: Meal) => void; clearMeals: (date: string) => void; workouts: number; logWorkout: () => void };
const Context = createContext<AppState | null>(null);
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return dateKey(d); };
export function FormProvider({ children }: { children: ReactNode }) {
 const [profile,setProfile] = useState<Profile>({name:'Alex',age:'25–34',sex:'Prefer not to say',level:'Beginner',conditions:[],other:'',complete:false});
 const [water,setWater]=useState(0); const [weight,setWeight]=useState(68.5); const [workouts,setWorkouts]=useState(0);
 const [weightLog,setWeightLog]=useState<WeightEntry[]>([{day:'Mon',kg:69.4},{day:'Tue',kg:69.1},{day:'Wed',kg:68.9},{day:'Thu',kg:68.7},{day:'Fri',kg:68.6},{day:'Sat',kg:68.5}]);
 const logWeight=(n:number)=>{setWeight(n);setWeightLog(p=>[...p,{day:`Day ${p.length+1}`,kg:n}]);};
 const [allMeals,setMeals]=useState<Meal[]>(()=>[
  {name:'Chole Bhature',calories:650,type:'Lunch',source:'sample',macros:{protein:18,carbs:78,fat:30,fibre:11},date:shift(0)},
  {name:'Masala oats with veggies',calories:320,type:'Breakfast',source:'sample',macros:{protein:11,carbs:48,fat:8,fibre:7},date:shift(-1)},
  {name:'Dal, rice & salad',calories:540,type:'Dinner',source:'sample',macros:{protein:20,carbs:85,fat:12,fibre:10},date:shift(-1)},
  {name:'Paneer tikka wrap',calories:480,type:'Lunch',source:'sample',macros:{protein:24,carbs:50,fat:20,fibre:6},date:shift(-2)},
 ]);
 const today=shift(0); const meals=allMeals.filter(m=>m.date===today);
 return <Context.Provider value={{profile,setProfile,water,setWater,weight,setWeight:logWeight,weightLog,meals,allMeals,addMeal:m=>setMeals(p=>[...p,m]),clearMeals:d=>setMeals(p=>p.filter(m=>m.date!==d)),workouts,logWorkout:()=>setWorkouts(n=>n+1)}}>{children}</Context.Provider>;
}
export function useFormAI(){ const c=useContext(Context); if(!c) throw new Error('FormAI provider missing'); return c; }
