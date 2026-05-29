export const DRILLDOWN_BACK_ACTION = '__drilldown_back__';

export interface DrilldownStateValue {
  path: string[];
  values: string[];
}

export const buildFullDrilldownSequence = (
  drilldownLevels: string[],
  baseDimensionField?: string,
  isCrossRef = false,
): string[] => {
  if (isCrossRef) {
    return drilldownLevels;
  }

  const normalizedLevels = (drilldownLevels || []).filter(Boolean);
  if (!baseDimensionField) {
    return normalizedLevels;
  }

  if (normalizedLevels[0] === baseDimensionField) {
    return normalizedLevels;
  }

  return [baseDimensionField, ...normalizedLevels];
};

interface ResolveDrilldownStateParams {
  currentState?: DrilldownStateValue;
  drilldownLevel: string;
  drilldownValue: string;
  drilldownLevels: string[];
  isCrossRef?: boolean;
  baseDimensionField?: string;
}

const buildDrilldownPath = (
  values: string[],
  drilldownLevels: string[],
  isCrossRef: boolean,
  baseDimensionField?: string,
): string[] => {
  if (isCrossRef) {
    const path = values.slice(1).map((_, index) => drilldownLevels[index] || '');
    return values.length > 0 ? ['', ...path] : [];
  }

  const drillSequence = buildFullDrilldownSequence(drilldownLevels, baseDimensionField, false);
  return drillSequence.slice(0, values.length);
};

export const resolveDrilldownState = ({
  currentState,
  drilldownLevel,
  drilldownValue,
  drilldownLevels,
  isCrossRef = false,
  baseDimensionField,
}: ResolveDrilldownStateParams): DrilldownStateValue => {
  const safeCurrentState: DrilldownStateValue = currentState || { path: [], values: [] };
  const drillSequence = buildFullDrilldownSequence(drilldownLevels, baseDimensionField, isCrossRef);

  if (!drilldownLevel && !drilldownValue) {
    return { path: [], values: [] };
  }

  if (drilldownLevel === DRILLDOWN_BACK_ACTION) {
    const newValues = safeCurrentState.values.slice(0, -1);
    return {
      path: buildDrilldownPath(newValues, drilldownLevels, isCrossRef, baseDimensionField),
      values: newValues,
    };
  }

  const currentValues = [...safeCurrentState.values];

  if (isCrossRef) {
    if (!drilldownValue) {
      return safeCurrentState;
    }

    if (currentValues.length === 0) {
      const newValues = [drilldownValue];
      return {
        path: buildDrilldownPath(newValues, drilldownLevels, true, baseDimensionField),
        values: newValues,
      };
    }

    const nextIndex = currentValues.length;
    if (nextIndex < drilldownLevels.length + 1) {
      const newValues = [...currentValues];
      newValues[nextIndex] = drilldownValue;
      newValues.splice(nextIndex + 1);
      return {
        path: buildDrilldownPath(newValues, drilldownLevels, true, baseDimensionField),
        values: newValues,
      };
    }

    return safeCurrentState;
  }

  const nextIndex = currentValues.length;
  const expectedNextLevel = drillSequence[nextIndex];

  if (drilldownValue && drilldownLevel === expectedNextLevel) {
    const newValues = [...currentValues];
    newValues[nextIndex] = drilldownValue;
    newValues.splice(nextIndex + 1);

    return {
      path: buildDrilldownPath(newValues, drilldownLevels, false, baseDimensionField),
      values: newValues,
    };
  }

  const existingIndex = currentValues.findIndex(
    (value, index) => drillSequence[index] === drilldownLevel && value === drilldownValue,
  );

  if (existingIndex >= 0) {
    const newValues = currentValues.slice(0, existingIndex + 1);
    return {
      path: buildDrilldownPath(newValues, drilldownLevels, false, baseDimensionField),
      values: newValues,
    };
  }

  const firstMatchingLevelIndex = drillSequence.findIndex(
    (level, index) => level === drilldownLevel && index >= Math.max(0, currentValues.length - 1),
  );

  if (firstMatchingLevelIndex >= 0 && drilldownValue) {
    const newValues = currentValues.slice(0, firstMatchingLevelIndex);
    newValues[firstMatchingLevelIndex] = drilldownValue;
    return {
      path: buildDrilldownPath(newValues, drilldownLevels, false, baseDimensionField),
      values: newValues,
    };
  }

  return safeCurrentState;
};