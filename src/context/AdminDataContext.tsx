import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Category, Competition, Unit, Participant, Team, Result } from '../types';

interface AdminDataContextType {
  categories: Category[];
  competitions: Competition[];
  units: Unit[];
  participants: Participant[];
  teams: Team[];
  results: Result[];
  registrations: any[];
  isLoadingMaster: boolean;
  masterLoaded: boolean;
  refreshMasterData: (force?: boolean) => Promise<void>;
  updateParticipantsLocally: (updater: (prev: Participant[]) => Participant[]) => void;
  updateResultsLocally: (updater: (prev: Result[]) => Result[]) => void;
  updateCompetitionsLocally: (updater: (prev: Competition[]) => Competition[]) => void;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

interface AdminDataProviderProps {
  children: React.ReactNode;
  token: string | null;
}

export const AdminDataProvider: React.FC<AdminDataProviderProps> = ({ children, token }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);
  const [masterLoaded, setMasterLoaded] = useState(false);
  
  const isFetchingRef = useRef(false);

  const refreshMasterData = useCallback(async (force = false) => {
    if (!token) return;
    if (isFetchingRef.current && !force) return;
    isFetchingRef.current = true;
    setIsLoadingMaster(true);

    try {
      const ts = Date.now();
      const authHeader = { 'Authorization': `Bearer ${token}` };

      const safeFetch = (url: string, headers?: any) => {
        const joiner = url.includes('?') ? '&' : '?';
        return fetch(`${url}${joiner}t=${ts}`, { headers })
          .then(r => r.ok ? r.json() : [])
          .catch(() => []);
      };

      const [cData, compData, uData, pData, tData, rData, regData] = await Promise.all([
        safeFetch('/api/categories'),
        safeFetch('/api/competitions'),
        safeFetch('/api/units'),
        safeFetch('/api/participants', authHeader),
        safeFetch('/api/teams', authHeader),
        safeFetch('/api/results', authHeader),
        safeFetch('/api/registrations', authHeader)
      ]);

      if (Array.isArray(cData)) setCategories(cData);
      if (Array.isArray(compData)) setCompetitions(compData);
      if (Array.isArray(uData)) setUnits(uData);
      if (Array.isArray(pData)) setParticipants(pData);
      if (Array.isArray(tData)) setTeams(tData);
      if (Array.isArray(rData)) setResults(rData);
      if (Array.isArray(regData)) setRegistrations(regData);

      setMasterLoaded(true);
    } catch (err) {
      console.error('Failed to load shared admin master data:', err);
    } finally {
      setIsLoadingMaster(false);
      isFetchingRef.current = false;
    }
  }, [token]);

  // Initial fetch on authenticated session
  useEffect(() => {
    if (token) {
      refreshMasterData();
    } else {
      // Clear in-memory cache on logout
      setCategories([]);
      setCompetitions([]);
      setUnits([]);
      setParticipants([]);
      setTeams([]);
      setResults([]);
      setRegistrations([]);
      setMasterLoaded(false);
    }
  }, [token, refreshMasterData]);

  const updateParticipantsLocally = useCallback((updater: (prev: Participant[]) => Participant[]) => {
    setParticipants(prev => updater(prev));
  }, []);

  const updateResultsLocally = useCallback((updater: (prev: Result[]) => Result[]) => {
    setResults(prev => updater(prev));
  }, []);

  const updateCompetitionsLocally = useCallback((updater: (prev: Competition[]) => Competition[]) => {
    setCompetitions(prev => updater(prev));
  }, []);

  return (
    <AdminDataContext.Provider
      value={{
        categories,
        competitions,
        units,
        participants,
        teams,
        results,
        registrations,
        isLoadingMaster,
        masterLoaded,
        refreshMasterData,
        updateParticipantsLocally,
        updateResultsLocally,
        updateCompetitionsLocally
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
};

export function useAdminData(): AdminDataContextType {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
}
