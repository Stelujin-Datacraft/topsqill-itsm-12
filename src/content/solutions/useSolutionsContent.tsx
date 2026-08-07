import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { solutionStepsById, type SolutionStep } from './steps';

export type SolutionContent = {
  id: string;
  label: string;
  title: ReactNode;
  tagline: string;
  chips: string[];
  scenarioTitle: string;
  scenarioBody: string;
  steps: SolutionStep[];
};

const solutionIds = ['onboarding', 'grc', 'itsm', 'vendor', 'security', 'hr'] as const;

export function useSolutionsContent(): SolutionContent[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      solutionIds.map((id) => ({
        id,
        label: t(`solutionsPage.items.${id}.label`),
        title: (
          <>
            {t(`solutionsPage.items.${id}.titleMain`)}
            <br />
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {t(`solutionsPage.items.${id}.titleHighlight`)}
            </span>
          </>
        ),
        tagline: t(`solutionsPage.items.${id}.tagline`),
        chips: t(`solutionsPage.items.${id}.chips`, { returnObjects: true }) as string[],
        scenarioTitle: t(`solutionsPage.items.${id}.scenarioTitle`),
        scenarioBody: t(`solutionsPage.items.${id}.scenarioBody`),
        steps: solutionStepsById[id] ?? [],
      })),
    [t],
  );
}
