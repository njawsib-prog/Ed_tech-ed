import { useMemo } from 'react';
import { instituteConfig, InstituteConfig } from '@/config/institute.config';

export function useInstitute(): InstituteConfig {
  return useMemo(() => instituteConfig, []);
}

export function useFeatureFlag(feature: keyof InstituteConfig['features']): boolean {
  const config = useInstitute();
  return config.features[feature];
}

export default useInstitute;