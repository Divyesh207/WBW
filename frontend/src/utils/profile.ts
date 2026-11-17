import { useCallback, useEffect, useState } from "react";

/** Demo-user profile. No authentication in the prototype; this lives in localStorage. */
export interface Profile {
  name: string;
  organisation: string;
  basis: "batch" | "unit";
}

const KEY = "wbw.profile";
const EVENT = "wbw-profile";
export const DEFAULT_PROFILE: Profile = { name: "Demo User", organisation: "Academic demonstration", basis: "batch" };

function read(): Profile {
  try {
    return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function useProfile(): [Profile, (next: Profile) => void] {
  const [profile, setProfile] = useState<Profile>(read);
  useEffect(() => {
    const sync = () => setProfile(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const save = useCallback((next: Profile) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [profile, save];
}
