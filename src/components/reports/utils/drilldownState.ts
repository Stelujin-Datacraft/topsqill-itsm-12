export const DRILLDOWN_BACK_ACTION = '__drilldown_back__';

export interface DrilldownStateValue {
  path: string[];
  values: string[];
}

interface ResolveDrilldownStateParams {
  currentState?: DrilldownStateValue;
  drilldownLevel: string;
  drilldownValue: string;
  drilldownLevels: string[];
  isCrossRef?: boolean;
}

const buildDrilldownPath = (
  values: string[],
  drilldownLevels: string[],
  isCrossRef: boolean,
): string[] => {
  if (isCrossRef) {
    const path = values.slice(1).map((_, index) => drilldownLevels[index] || '');
    return values.length > 0 ? ['', ...path] : [];
  }

  return drilldownLevels.slice(0, values.length);
};

export const resolveDrilldownState = ({
  currentState,
  drilldownLevel,
  drilldownValue,
  drilldownLevels,
  isCrossRef = false,
}: ResolveDrilldownStateParams): DrilldownStateValue => {
  const safeCurrentState: DrilldownStateValue = currentState || { path: [], values: [] };

  if (!drilldownLevel && !drilldownValue) {
    return { path: [], values: [] };
  }

  if (drilldownLevel === DRILLDOWN_BACK_ACTION) {
    const newValues = safeCurrentState.values.slice(0, -1);
    return {
      path: buildDrilldownPath(newValues, drilldownLevels, isCrossRef),
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
        path: buildDrilldownPath(newValues, drilldownLevels, true),
        values: newValues,
      };
    }

    const nextIndex = currentValues.length;
    if (nextIndex < drilldownLevels.length + 1) {
      const newValues = [...currentValues];
      newValues[nextIndex] = drilldownValue;
      newValues.splice(nextIndex + 1);
      return {
        path: buildDrilldownPath(newValues, drilldownLevels, true),
        values: newValues,
      };
    }

    return safeCurrentState;
  }

  const nextIndex = currentValues.length;
  const expectedNextLevel = drilldownLevels[nextIndex];

  if (drilldownValue && drilldownLevel === expectedNextLevel) {
    const newValues = [...currentValues];
    newValues[nextIndex] = drilldownValue;
    newValues.splice(nextIndex + 1);

    return {
      path: buildDrilldownPath(newValues, drilldownLevels, false),
      values: newValues,
    };
  }

  const existingIndex = currentValues.findIndex(
    (value, index) => drilldownLevels[index] === drilldownLevel && value === drilldownValue,
  );

  if (existingIndex >= 0) {
    const newValues = currentValues.slice(0, existingIndex + 1);
    return {
      path: buildDrilldownPath(newValues, drilldownLevels, false),
      values: newValues,
    };
  }

  const firstMatchingLevelIndex = drilldownLevels.findIndex(
    (level, index) => level === drilldownLevel && index >= Math.max(0, currentValues.length - 1),
  );

  if (firstMatchingLevelIndex >= 0 && drilldownValue) {
    const newValues = currentValues.slice(0, firstMatchingLevelIndex);
    newValues[firstMatchingLevelIndex] = drilldownValue;
    return {
      path: buildDrilldownPath(newValues, drilldownLevels, false),
      values: newValues,
    };
  }

  // Fallback: if a value is provided but the level identifier doesn't match
  // any configured level (different chart click handlers can infer the field
  // name differently after a drill), still advance to the next configured
  // level so multi-level drilldown keeps working past level 1.
  if (drilldownValue && nextIndex < drilldownLevels.length) {
    const newValues = [...currentValues];
    newValues[nextIndex] = drilldownValue;
    newValues.splice(nextIndex + 1);
    return {
      path: buildDrilldownPath(newValues, drilldownLevels, false),
      values: newValues,
    };
  }

  return safeCurrentState;
};