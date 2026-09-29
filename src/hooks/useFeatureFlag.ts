import { useMemo } from 'react';

interface FeatureFlags {
  PREDICTIVE_ENGINE: boolean;
  SETTLEMENT_CHAIN_VIZ: boolean;
  COCO_CLI_REPLAY: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  PREDICTIVE_ENGINE: false,
  SETTLEMENT_CHAIN_VIZ: false,
  COCO_CLI_REPLAY: false,
};

export const useFeatureFlag = (flag: keyof FeatureFlags): boolean => {
  const flags = useMemo((): FeatureFlags => {
    if (typeof window === 'undefined') return DEFAULT_FLAGS;
    
    return {
      PREDICTIVE_ENGINE: import.meta.env.VITE_PREDICTIVE_ENGINE === 'true',
      SETTLEMENT_CHAIN_VIZ: import.meta.env.VITE_SETTLEMENT_CHAIN_VIZ === 'true',
      COCO_CLI_REPLAY: import.meta.env.VITE_COCO_CLI_REPLAY === 'true',
    };
  }, []);

  return flags[flag] ?? DEFAULT_FLAGS[flag];
};

export const getAllFeatureFlags = (): FeatureFlags => {
  if (typeof window === 'undefined') return DEFAULT_FLAGS;
  
  return {
    PREDICTIVE_ENGINE: import.meta.env.VITE_PREDICTIVE_ENGINE === 'true',
    SETTLEMENT_CHAIN_VIZ: import.meta.env.VITE_SETTLEMENT_CHAIN_VIZ === 'true',
    COCO_CLI_REPLAY: import.meta.env.VITE_COCO_CLI_REPLAY === 'true',
  };
};