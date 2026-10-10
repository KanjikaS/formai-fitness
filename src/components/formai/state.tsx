import { createContext, useContext, useState, type ReactNode } from 'react';
export type Profile = { name: string; age: string; sex: string; level: string; conditions: string[]; other: string; complete: boolean };
type Meal = { name: string; calories: number; type: string };
type AppState = { profile: Profile; setProfile: (p: Profile) => void; water: number; setWater: (n: number) => void; weight: number; setWeight: (n: number) => void; meals: Meal[]; addMeal: (m: Meal) => void; workouts: number; logWorkout: () => void };
const Context = createContext<AppState | null>(null);
export function FormProvider({ children }: { children: ReactNode }) {
 const [profile,setProfile] = useState<Profile>({name:'Alex',age:'25–34',sex:'Prefer not to say',level:'Beginner',conditions:[],other:'',complete:false});
 const [water,setWater]=useState(4); const [weight,setWeight]=useState(68.5); const [workouts,setWorkouts]=useState(1);
 const [meals,setMeals]=useState<Meal[]>([{name:'Avocado toast & eggs',calories:380,type:'Breakfast'},{name:'Fresh harvest bowl',calories:520,type:'Lunch'}]);
 return <Context.Provider value={{profile,setProfile,water,setWater,weight,setWeight,meals,addMeal:m=>setMeals(p=>[...p,m]),workouts,logWorkout:()=>setWorkouts(n=>n+1)}}>{children}</Context.Provider>;
}
export function useFormAI(){ const c=useContext(Context); if(!c) throw new Error('FormAI provider missing'); return c; }
