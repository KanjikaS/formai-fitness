import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type Profile = { name: string; age: string; sex: string; level: string; conditions: string[]; other: string; complete: boolean; restrictedExercises?: string[] };
export type Macros = { protein: number; carbs: number; fat: number };
type Meal = { name: string; calories: number; type: string; source: 'photo' | 'manual'; macros: Macros };
type GymUser = { user_id: number; username: string } | null;
type WeightEntry = { day: string; kg: number };
export type StoredProfile = Profile & { id: string; tagline: string };
const PROFILES_KEY = 'profiles';
const ACTIVE_KEY = 'active_profile_id';
const DEFAULT_PROFILES: StoredProfile[] = [
  { id: 'alice', name: 'Alice', age: '25–34', sex: 'Female', level: 'Intermediate', conditions: [], other: '', complete: true, tagline: '32 · Intermediate flexibility', restrictedExercises: [] },
  { id: 'bob', name: 'Bob', age: '35–44', sex: 'Male', level: 'Beginner', conditions: ['Heart risk', 'Diabetes'], other: '', complete: true, tagline: '40 · Heart condition · Diabetes', restrictedExercises: ['Shoulder Press', 'Biceps Curls (Dumbbell)'] },
];
function loadProfiles(): StoredProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) return JSON.parse(raw) as StoredProfile[];
  } catch { /* fall through to seed */ }
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(DEFAULT_PROFILES)); } catch { /* storage unavailable */ }
  return DEFAULT_PROFILES;
}
type AppState = { profile: Profile; setProfile: (p: Profile) => void; profiles: StoredProfile[]; activeProfileId: string; switchProfile: (id: string) => void; water: number; setWater: (n: number) => void; weight: number; setWeight: (n: number) => void; weightLog: WeightEntry[]; meals: Meal[]; addMeal: (m: Meal) => void; clearMeals: () => void; workouts: number; logWorkout: () => void; gymUser: GymUser; setGymUser: (u: GymUser) => void };
const Context = createContext<AppState | null>(null);
export function FormProvider({ children }: { children: ReactNode }) {
 const [profiles] = useState<StoredProfile[]>(loadProfiles);
 const [activeProfileId, setActiveProfileId] = useState<string>(() => {
   try { return localStorage.getItem(ACTIVE_KEY) ?? DEFAULT_PROFILES[0]!.id; } catch { return DEFAULT_PROFILES[0]!.id; }
 });
 const active = profiles.find(p => p.id === activeProfileId) ?? profiles[0] ?? DEFAULT_PROFILES[0]!;
 const [profile, setProfileState] = useState<Profile>(active);
 const switchProfile = (id: string) => {
   const next = profiles.find(p => p.id === id);
   if (!next) return;
   setActiveProfileId(id);
   setProfileState(next);
   try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* storage unavailable */ }
 };
 const setProfile = (p: Profile) => setProfileState(p);
 const [water,setWater]=useState(0); const [weight,setWeight]=useState(68.5); const [workouts,setWorkouts]=useState(0);
 const [weightLog,setWeightLog]=useState<WeightEntry[]>([{day:'Mon',kg:69.4},{day:'Tue',kg:69.1},{day:'Wed',kg:68.9},{day:'Thu',kg:68.7},{day:'Fri',kg:68.6},{day:'Sat',kg:68.5}]);
 const logWeight=(n:number)=>{setWeight(n);setWeightLog(p=>[...p,{day:`Day ${p.length+1}`,kg:n}]);};
 const [meals,setMeals]=useState<Meal[]>([]);
 const [gymUser,setGymUser]=useState<GymUser>(null);
 useEffect(()=>{const id=localStorage.getItem('gym_user_id');const name=localStorage.getItem('gym_username');if(id&&name)setGymUser({user_id:parseInt(id),username:name})},[]);
 const handleSetGymUser=(u:GymUser)=>{setGymUser(u);if(u){localStorage.setItem('gym_user_id',String(u.user_id));localStorage.setItem('gym_username',u.username)}else{localStorage.removeItem('gym_user_id');localStorage.removeItem('gym_username')}};
 return <Context.Provider value={{profile,setProfile,profiles,activeProfileId,switchProfile,water,setWater,weight,setWeight:logWeight,weightLog,meals,addMeal:m=>setMeals(p=>[...p,m]),clearMeals:()=>setMeals([]),workouts,logWorkout:()=>setWorkouts(n=>n+1),gymUser,setGymUser:handleSetGymUser}}>{children}</Context.Provider>;
}
export function useFormAI(){ const c=useContext(Context); if(!c) throw new Error('FormAI provider missing'); return c; }
