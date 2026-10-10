import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type Profile = { name: string; age: string; sex: string; level: string; conditions: string[]; other: string; complete: boolean };
export type Macros = { protein: number; carbs: number; fat: number };
type Meal = { name: string; calories: number; type: string; source: 'photo' | 'manual'; macros: Macros };
type GymUser = { user_id: number; username: string } | null;
type WeightEntry = { day: string; kg: number };
type AppState = { profile: Profile; setProfile: (p: Profile) => void; water: number; setWater: (n: number) => void; weight: number; setWeight: (n: number) => void; weightLog: WeightEntry[]; meals: Meal[]; addMeal: (m: Meal) => void; clearMeals: () => void; workouts: number; logWorkout: () => void; gymUser: GymUser; setGymUser: (u: GymUser) => void };
const Context = createContext<AppState | null>(null);
export function FormProvider({ children }: { children: ReactNode }) {
 const [profile,setProfile] = useState<Profile>({name:'Alex',age:'25–34',sex:'Prefer not to say',level:'Beginner',conditions:[],other:'',complete:false});
 const [water,setWater]=useState(0); const [weight,setWeight]=useState(68.5); const [workouts,setWorkouts]=useState(0);
 const [weightLog,setWeightLog]=useState<WeightEntry[]>([{day:'Mon',kg:69.4},{day:'Tue',kg:69.1},{day:'Wed',kg:68.9},{day:'Thu',kg:68.7},{day:'Fri',kg:68.6},{day:'Sat',kg:68.5}]);
 const logWeight=(n:number)=>{setWeight(n);setWeightLog(p=>[...p,{day:`Day ${p.length+1}`,kg:n}]);};
 const [meals,setMeals]=useState<Meal[]>([]);
 const [gymUser,setGymUser]=useState<GymUser>(null);
 useEffect(()=>{const id=localStorage.getItem('gym_user_id');const name=localStorage.getItem('gym_username');if(id&&name)setGymUser({user_id:parseInt(id),username:name})},[]);
 const handleSetGymUser=(u:GymUser)=>{setGymUser(u);if(u){localStorage.setItem('gym_user_id',String(u.user_id));localStorage.setItem('gym_username',u.username)}else{localStorage.removeItem('gym_user_id');localStorage.removeItem('gym_username')}};
 return <Context.Provider value={{profile,setProfile,water,setWater,weight,setWeight:logWeight,weightLog,meals,addMeal:m=>setMeals(p=>[...p,m]),clearMeals:()=>setMeals([]),workouts,logWorkout:()=>setWorkouts(n=>n+1),gymUser,setGymUser:handleSetGymUser}}>{children}</Context.Provider>;
}
export function useFormAI(){ const c=useContext(Context); if(!c) throw new Error('FormAI provider missing'); return c; }
