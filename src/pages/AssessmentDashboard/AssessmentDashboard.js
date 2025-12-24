import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SAFE_DATA } from '../../data';
import './AssessmentDashboard.css';

const STORAGE_KEY = 'safeAssessmentState';

const createEmptyState = () => ({
  ratings: {}, // key: "dim||kpi||metric" -> 1..5
  priorities: {}, // key -> "A" | "B" | "C"
  weights: {
    kpis: {}, // key: "dim||kpi" -> %
    metrics: {}, // key: "dim||kpi||metric" -> %
  },
});

const loadInitialState = () => {
  if (typeof window === 'undefined') return createEmptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyState();
    return {
      ...createEmptyState(),
      ...parsed,
      ratings: parsed.ratings || {},
      priorities: parsed.priorities || {},
      weights: {
        kpis: parsed.weights?.kpis || {},
        metrics: parsed.weights?.metrics || {},
      },
    };
  } catch {
    return createEmptyState();
  }
};

const AssessmentDashboard = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [appState, setAppState] = useState(loadInitialState);
  const [expandedDimensions, setExpandedDimensions] = useState(() => new Set());
  
  // Get assessment data from navigation state or location state
  const assessmentData = location.state?.assessmentData || {
    respondentName: 'N/A',
    organisation: 'N/A',
    city: 'N/A',
    borough: 'N/A',
    ward: 'N/A',
    createdAt: new Date(),
  };

  // Persist assessment state in localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      }
    } catch {
      // ignore storage errors
    }
  }, [appState]);

  const calculateCompletionPercentage = useMemo(() => {
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
  }, [appState.ratings]);

  const toggleDimension = (index) => {
    setExpandedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const updateRatingWithBadge = (metricKey, value) => {
    const rating = parseInt(value, 10);
    setAppState((prev) => ({
      ...prev,
      ratings: {
        ...prev.ratings,
        [metricKey]: rating,
      },
    }));
  };

  const updatePriority = (metricKey, value) => {
    setAppState((prev) => ({
      ...prev,
      priorities: {
        ...prev.priorities,
        [metricKey]: value,
      },
    }));
  };

  const updateMetricWeightNoCollapse = (metricKey, value) => {
    const weight = parseFloat(value);
    setAppState((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        metrics: {
          ...prev.weights.metrics,
          [metricKey]: isNaN(weight) ? 0 : weight,
        },
        kpis: { ...prev.weights.kpis },
      },
    }));
  };

  const updateKPIWeightNoCollapse = (kpiKey, value) => {
    const weight = parseFloat(value);
    setAppState((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        kpis: {
          ...prev.weights.kpis,
          [kpiKey]: isNaN(weight) ? 0 : weight,
        },
        metrics: { ...prev.weights.metrics },
      },
    }));
  };

  // Format the created date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      // Handle Firestore Timestamp
      const d = date.toDate ? date.toDate() : (date instanceof Date ? date : new Date(date));
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const handleViewDashboard = () => {
    navigate('/');
  };

  const handleBackToInfo = () => {
    navigate('/assessment');
  };

  let dimIndex = 0;

  return (
    <div className="assessment-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <div className="logo-container">
            <div className="logo-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect
                  x="8"
                  y="6"
                  width="32"
                  height="36"
                  rx="2"
                  fill="#3b82f6"
                  stroke="#2563eb"
                  strokeWidth="2"
                />
                <line
                  x1="14"
                  y1="14"
                  x2="34"
                  y2="14"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="14"
                  y1="20"
                  x2="34"
                  y2="20"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="14"
                  y1="26"
                  x2="28"
                  y2="26"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="logo-text">
              <div className="logo-title">SAFE</div>
              <div className="logo-subtitle">
                Smart Age-Friendliness Evaluation Platform
              </div>
              <div className="logo-lab">
                Future Cities and Assistive Technology Lab
              </div>
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="info-panel">
            <div className="info-item">
              <span className="info-label">Respondent:</span>
              <span className="info-value">
                {assessmentData.respondentName || 'N/A'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Organization:</span>
              <span className="info-value">
                {assessmentData.organisation || 'N/A'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Location:</span>
              <span className="info-value">
                {[assessmentData.city, assessmentData.borough, assessmentData.ward]
                  .filter(Boolean)
                  .join(', ') || 'N/A'}
              </span>
            </div>
            <div className="info-item created">
              <span className="info-label">Created:</span>
              <span className="info-value">
                {formatDate(assessmentData.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="assessment-dashboard-body">
          <div className="assessment-dashboard-topbar">
            <button className="btn-back-info" onClick={handleBackToInfo}>
              <svg
                className="btn-icon"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M12 15l-5-5 5-5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to Info
            </button>
            <button className="btn-view-dashboard" onClick={handleViewDashboard}>
              <svg
                className="btn-icon"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
              >
                <rect
                  x="2"
                  y="2"
                  width="6"
                  height="6"
                  rx="1"
                  fill="#6366f1"
                />
                <rect
                  x="10"
                  y="2"
                  width="6"
                  height="6"
                  rx="1"
                  fill="#8b5cf6"
                />
                <rect
                  x="2"
                  y="10"
                  width="6"
                  height="6"
                  rx="1"
                  fill="#ec4899"
                />
                <rect
                  x="10"
                  y="10"
                  width="6"
                  height="6"
                  rx="1"
                  fill="#f59e0b"
                />
              </svg>
              View Dashboard
            </button>
          </div>

          <div className="assessment-dashboard-main">
            <div className="bg-white rounded-xl p-6 mb-5 shadow-lg">
              <h2 className="text-purple-600 text-3xl font-bold mb-5">
                📊 Age-Friendliness Assessment
              </h2>

              <div className="h-8 bg-gray-200 rounded-full overflow-hidden mb-5 shadow-inner">
                <div
                  className="progress-fill h-full flex items-center justify-center text-white font-bold"
                  style={{ width: `${calculateCompletionPercentage}%` }}
                >
                  {calculateCompletionPercentage}% Complete
                </div>
              </div>
            </div>

            {Object.entries(SAFE_DATA).map(([dimName, kpis]) => {
              const isExpanded = expandedDimensions.has(dimIndex);
              const currentDimIndex = dimIndex;
              dimIndex += 1;

              // DIMENSION KPI WEIGHTAGES
              let kpiWeightSum = 0;
              Object.keys(kpis).forEach((kpiName) => {
                const kk = `${dimName}||${kpiName}`;
                const kw =
                  appState.weights.kpis[kk] ||
                  100 / Object.keys(kpis).length;
                kpiWeightSum += kw;
              });
              const kpisValid = Math.abs(kpiWeightSum - 100) < 0.01;

              return (
                <div
                  key={dimName}
                  className="bg-white rounded-lg overflow-hidden shadow-md mb-5 border-l-4 border-purple-600"
                >
                  <div
                    className="dimension-header bg-gradient-to-r from-purple-600 to-blue-500 text-white p-5 cursor-pointer flex justify-between items-center hover:brightness-110 transition-all"
                    onClick={() => toggleDimension(currentDimIndex)}
                  >
                    <h3 className="text-white text-xl font-semibold m-0">
                      {dimName}
                    </h3>
                    <span
                      id={`dim-arrow-${currentDimIndex}`}
                      className="text-2xl"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  <div
                    className={`dimension-content ${
                      isExpanded ? 'active' : ''
                    } p-5 bg-gray-50`}
                    id={`dim-content-${currentDimIndex}`}
                  >
                    <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-5 mb-6">
                      <h4 className="text-purple-600 text-xl font-semibold mb-4">
                        📊 Dimension KPI Theme Weightages
                      </h4>

                      {Object.keys(kpis).map((kpiName) => {
                        const kk = `${dimName}||${kpiName}`;
                        const kw =
                          appState.weights.kpis[kk] ||
                          100 / Object.keys(kpis).length;

                        return (
                          <div
                            key={kk}
                            className="kpi-weight-row"
                          >
                            <strong className="text-gray-800">
                              {kpiName}
                            </strong>
                            <div className="kpi-input">
                              <input
                                type="number"
                                value={kw.toFixed(2)}
                                min="0"
                                max="100"
                                step="0.1"
                                className="input-compact"
                                onChange={(e) =>
                                  updateKPIWeightNoCollapse(kk, e.target.value)
                                }
                              />
                              <span>%</span>
                            </div>
                          </div>
                        );
                      })}

                      <div className="mt-4 p-3 bg-white rounded-lg">
                        <strong>Total:</strong>
                        <span
                          className={`weightage-validation ${
                            kpisValid
                              ? 'weightage-valid'
                              : 'weightage-invalid'
                          }`}
                        >
                          {kpiWeightSum.toFixed(2)}%{' '}
                          {kpisValid ? '✓' : '✗ Must equal 100%'}
                        </span>
                      </div>
                    </div>

                    {Object.entries(kpis).map(([kpiName, metrics]) => {
                      // Metric weightages validation
                      let metricWeightSum = 0;
                      metrics.forEach((metric) => {
                        const mk = `${dimName}||${kpiName}||${metric.name}`;
                        metricWeightSum +=
                          appState.weights.metrics[mk] ||
                          100 / metrics.length;
                      });
                      const metricsValid =
                        Math.abs(metricWeightSum - 100) < 0.01;

                      return (
                        <div
                          key={`${dimName}-${kpiName}`}
                          className="mb-6 border-l-4 border-teal-400 bg-white p-4 rounded-lg"
                        >
                          <div className="font-semibold text-white bg-blue-500 p-3 -m-4 mb-4 rounded-t-lg text-lg">
                            {kpiName}
                          </div>

                          {metrics.map((metric) => {
                            const metricKey = `${dimName}||${kpiName}||${metric.name}`;
                            const currentRating =
                              appState.ratings[metricKey] || 3;
                            const currentPriority =
                              appState.priorities[metricKey] ||
                              metric.priority;
                            const currentWeight =
                              appState.weights.metrics[metricKey] ||
                              100 / metrics.length;

                            const ratingLabels = {
                              1: 'Poor',
                              2: 'Bad',
                              3: 'Good',
                              4: 'V.Good',
                              5: 'Excellent',
                            };

                            return (
                              <div
                                key={metricKey}
                                className="metric-row"
                              >
                                <div className={`priority-badge priority-${currentPriority}`}>
                                  {currentPriority}
                                </div>

                                <div className="metric-name">
                                  {metric.name}
                                </div>

                                <div className={`rating-badge rating-${currentRating}`}>
                                  {ratingLabels[currentRating]}
                                </div>

                                <div className="metric-field">
                                  <label>Priority</label>
                                  <select
                                    value={currentPriority}
                                    onChange={(e) =>
                                      updatePriority(metricKey, e.target.value)
                                    }
                                    className="select-compact"
                                  >
                                    <option value="A">A - Essential</option>
                                    <option value="B">B - Required</option>
                                    <option value="C">C - Desired</option>
                                  </select>
                                </div>

                                <div className="metric-field">
                                  <label>Rating</label>
                                  <select
                                    value={currentRating}
                                    onChange={(e) =>
                                      updateRatingWithBadge(
                                        metricKey,
                                        e.target.value
                                      )
                                    }
                                    className="select-compact"
                                  >
                                    <option value="1">1 - Poor</option>
                                    <option value="2">2 - Bad</option>
                                    <option value="3">3 - Good</option>
                                    <option value="4">4 - Very Good</option>
                                    <option value="5">5 - Excellent</option>
                                  </select>
                                </div>

                                <div className="metric-field">
                                  <label>Weight %</label>
                                  <input
                                    type="number"
                                    value={currentWeight.toFixed(2)}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    className="input-compact"
                                    onChange={(e) =>
                                      updateMetricWeightNoCollapse(
                                        metricKey,
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            );
                          })}

                          <div className="mt-4 p-4 bg-white rounded-lg border-2 border-gray-200">
                            <strong>Metric Weightages Total:</strong>
                            <span
                              className={`weightage-validation ${
                                metricsValid
                                  ? 'weightage-valid'
                                  : 'weightage-invalid'
                              }`}
                            >
                              {metricWeightSum.toFixed(2)}%{' '}
                              {metricsValid
                                ? '✓'
                                : '✗ Must equal 100%'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentDashboard;

