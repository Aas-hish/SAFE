import { SAFE_DATA } from './data';

export function calculateCompletionFromState(appState) {
  let totalMetrics = 0;
  let ratedMetrics = 0;

  Object.entries(SAFE_DATA).forEach(([dimName, kpis]) => {
    Object.entries(kpis).forEach(([kpiName, metrics]) => {
      metrics.forEach((metric) => {
        const key = `${dimName}||${kpiName}||${metric.name}`;
        totalMetrics += 1;
        if (appState.ratings[key]) ratedMetrics += 1;
      });
    });
  });

  if (totalMetrics === 0) return 0;
  return Math.round((ratedMetrics / totalMetrics) * 100);
}

export function calculateScoresFromState(appState) {
  const dimensions = {};

  Object.entries(SAFE_DATA).forEach(([dimName, kpis]) => {
    let dimScoreSum = 0;
    let dimWeightSum = 0;

    Object.entries(kpis).forEach(([kpiName, metrics]) => {
      const kpiKey = `${dimName}||${kpiName}`;
      const kpiWeight =
        appState.weights.kpis[kpiKey] ||
        100 / Object.keys(kpis).length;

      let kpiMetricScoreSum = 0;
      let kpiMetricWeightSum = 0;

      metrics.forEach((metric) => {
        const metricKey = `${dimName}||${kpiName}||${metric.name}`;
        const rating = appState.ratings[metricKey] || 0;
        const metricWeight =
          appState.weights.metrics[metricKey] ||
          100 / metrics.length;

        kpiMetricScoreSum += rating * metricWeight;
        kpiMetricWeightSum += metricWeight;
      });

      const kpiAverage =
        kpiMetricWeightSum > 0
          ? kpiMetricScoreSum / kpiMetricWeightSum
          : 0;

      dimScoreSum += kpiAverage * kpiWeight;
      dimWeightSum += kpiWeight;
    });

    const dimScore =
      dimWeightSum > 0 ? dimScoreSum / dimWeightSum : 0;

    dimensions[dimName] = { score: dimScore };
  });

  const dimValues = Object.values(dimensions);
  const overall =
    dimValues.length > 0
      ? dimValues.reduce((sum, d) => sum + d.score, 0) /
        dimValues.length
      : 0;

  return { overall, dimensions };
}

export function countNonZeroWeightageMetrics(appState) {
  let count = 0;
  Object.entries(SAFE_DATA).forEach(([dimName, kpis]) => {
    Object.entries(kpis).forEach(([kpiName, metrics]) => {
      metrics.forEach((metric) => {
        const metricKey = `${dimName}||${kpiName}||${metric.name}`;
        const weight =
          appState.weights.metrics[metricKey] ||
          100 / metrics.length;
        if (weight > 0) count += 1;
      });
    });
  });
  return count;
}

export function getPerformanceCategory(overallScore) {
  if (overallScore >= 4.5) {
    return { name: 'Excellent', class: 'badge-excellent' };
  }
  if (overallScore >= 3.5) {
    return { name: 'Good', class: 'badge-good' };
  }
  if (overallScore >= 2.5) {
    return { name: 'Needs Improvement', class: 'badge-warning' };
  }
  return { name: 'Critical', class: 'badge-critical' };
}

export function getCriticalMetrics(appState) {
  const aPriorityMetrics = Object.entries(appState.priorities)
    .filter(([, priority]) => priority === 'A')
    .map(([key]) => ({
      key,
      score: appState.ratings[key] || 0,
      name: key.split('||')[2] || key,
    }))
    .sort((a, b) => a.score - b.score);

  const bottom10Percent = Math.ceil(aPriorityMetrics.length * 0.1);
  return aPriorityMetrics.slice(0, bottom10Percent || 0);
}

export function generateInsights(scores) {
  const insights = [];
  const dimensionsArray = Object.entries(scores.dimensions).map(
    ([name, data]) => ({ name, score: data.score })
  );

  if (dimensionsArray.length === 0) return insights;

  const sorted = [...dimensionsArray].sort(
    (a, b) => b.score - a.score
  );

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  insights.push({
    title: 'Strongest Dimension',
    description: `${best.name} is currently your strongest area with an average score of ${best.score.toFixed(
      2
    )}/5.`,
  });

  insights.push({
    title: 'Weakest Dimension',
    description: `${worst.name} is the lowest-performing dimension at ${worst.score.toFixed(
      2
    )}/5. Prioritise targeted interventions here.`,
  });

  insights.push({
    title: 'Overall Performance',
    description: `Your overall SAFE score is ${scores.overall.toFixed(
      2
    )}/5. Use this as a baseline and track improvements over time.`,
  });

  return insights;
}


