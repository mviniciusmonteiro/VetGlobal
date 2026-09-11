import { useState, useEffect, useCallback, useMemo } from 'react';
import { listPets, checkHealth } from '../services/api';
import type { Pet, BackendStatus } from '../types';

export function usePatients() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [isLoading, setIsLoading] = useState(false);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      await checkHealth();
      setBackendStatus('online');
    } catch {
      setBackendStatus('offline');
    }

    try {
      const data = await listPets();
      setPets(data);
      if (data.length > 0) {
        setSelectedPetId((current) => current ?? data[0].id);
      }
    } catch {
      // Ignora falha silenciosa para não travar a UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const selectPet = useCallback((petId: number) => {
    setSelectedPetId(petId);
  }, []);

  const addPet = useCallback((newPet: Pet) => {
    setPets((prev) => [newPet, ...prev]);
    setSelectedPetId(newPet.id);
  }, []);

  const selectedPet = useMemo(
    () => pets.find((p) => p.id === selectedPetId),
    [pets, selectedPetId]
  );

  return {
    pets,
    selectedPet,
    selectedPetId,
    backendStatus,
    isLoading,
    selectPet,
    addPet,
    refreshPets: loadInitialData,
  };
}
