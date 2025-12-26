import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
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
  const [appState, setAppState] = useState(createEmptyState);
  const [expandedDimensions, setExpandedDimensions] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  
  // Get assessment data from navigation state or location state
  const assessmentData = location.state?.assessmentData || {
    respondentName: 'N/A',
    organisation: 'N/A',
    city: 'N/A',
    borough: 'N/A',
    ward: 'N/A',
    createdAt: new Date(),
    id: null,
    collectionName: null,
  };

  const assessmentId = assessmentData.id;
  const collectionName = assessmentData.collectionName;

  // Calculate completion percentage - counts ALL fields
  const calculateCompletionPercentage = useMemo(() => {
    let totalFields = 0;
    let completedFields = 0;

    Object.entries(SAFE_DATA).forEach(([dimName, kpis]) => {
      Object.entries(kpis).forEach(([kpiName, metrics]) => {
        metrics.forEach((metric) => {
          const key = `${dimName}||${kpiName}||${metric.name}`;
          
          // Rating field (1-5)
          totalFields += 1;
          if (appState.ratings[key]) completedFields += 1;
          
          // Priority field (A/B/C)
          totalFields += 1;
          if (appState.priorities[key]) completedFields += 1;
          
          // Metric weight field
          totalFields += 1;
          if (appState.weights.metrics[key] !== undefined && appState.weights.metrics[key] > 0) {
            completedFields += 1;
          }
        });
        
        // KPI weight field
        const kpiKey = `${dimName}||${kpiName}`;
        totalFields += 1;
        if (appState.weights.kpis[kpiKey] !== undefined && appState.weights.kpis[kpiKey] > 0) {
          completedFields += 1;
        }
      });
    });

    if (totalFields === 0) return 0;
    const percentage = Math.round((completedFields / totalFields) * 100);
    return Math.min(percentage, 100);
  }, [appState.ratings, appState.priorities, appState.weights]);

  // Load assessment progress from Firestore on mount
  useEffect(() => {
    const loadAssessmentProgress = async () => {
      if (!user || !user.uid || !assessmentId || !collectionName) {
        // Fallback to localStorage if no Firestore data available
        const localState = loadInitialState();
        setAppState(localState);
        setLoading(false);
        return;
      }

      try {
        const assessmentRef = doc(
          db,
          'users',
          user.uid,
          collectionName,
          assessmentId
        );
        const docSnap = await getDoc(assessmentRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Load saved progress from Firestore
          if (data.ratings || data.priorities || data.weights) {
            setAppState({
              ratings: data.ratings || {},
              priorities: data.priorities || {},
              weights: {
                kpis: data.weights?.kpis || {},
                metrics: data.weights?.metrics || {},
              },
            });
          } else {
            // No saved progress, use empty state
            setAppState(createEmptyState());
          }
        } else {
          // Document doesn't exist, use empty state
          setAppState(createEmptyState());
        }
      } catch (error) {
        console.error('Error loading assessment progress:', error);
        // Fallback to localStorage on error
        const localState = loadInitialState();
        setAppState(localState);
      } finally {
        setLoading(false);
        isInitialLoadRef.current = false;
      }
    };

    loadAssessmentProgress();
  }, [user, assessmentId, collectionName]);

  // Auto-save to Firestore with debouncing
  useEffect(() => {
    // Skip saving on initial load
    if (isInitialLoadRef.current || loading) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save to localStorage immediately (as backup)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }

    // Save to Firestore with debouncing (wait 1 second after last change)
    if (user && user.uid && assessmentId && collectionName) {
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const assessmentRef = doc(
            db,
            'users',
            user.uid,
            collectionName,
            assessmentId
          );
          
          // Save completion percentage along with other data
          await updateDoc(assessmentRef, {
            ratings: appState.ratings,
            priorities: appState.priorities,
            weights: appState.weights,
            completionPercentage: calculateCompletionPercentage,
            lastUpdated: new Date(),
          });
          
          console.log('Assessment progress saved to Firestore');
        } catch (error) {
          console.error('Error saving assessment progress to Firestore:', error);
        }
      }, 1000); // Wait 1 second after last change before saving
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [appState, user, assessmentId, collectionName, loading, calculateCompletionPercentage]);

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
      let jsDate;
      if (date && typeof date.toDate === 'function') {
        jsDate = date.toDate();
      } else if (date.seconds) {
        // Firestore timestamp in format { seconds: 1234567, nanoseconds: 0 }
        jsDate = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        jsDate = date;
      } else if (typeof date === 'string' || typeof date === 'number') {
        jsDate = new Date(date);
      } else {
        return 'N/A';
      }
      
      if (isNaN(jsDate.getTime())) return 'N/A';
      
      // Only show date (e.g., "26 Dec 2025")
      return jsDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  };

 const handleViewDashboard = () => {
  // Navigate to the score dashboard with the current assessment's collectionName and id
  navigate(`/score-dashboard/${collectionName}/${assessmentId}`);
};

  const handleBackToInfo = () => {
    navigate('/');
  };

  let dimIndex = 0;

  // Show loading indicator while loading assessment progress
  if (loading) {
    return (
      <div className="assessment-dashboard">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '1.5rem' }}>Loading your assessment...</div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>Please wait while we restore your progress</div>
        </div>
      </div>
    );
  }

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
                  fill="#8b5cf6"
                  stroke="#7c3aed"
                  strokeWidth="2"
                />
                <line
                  x1="8"
                  y1="16"
                  x2="40"
                  y2="16"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="24" cy="12" r="2" fill="white" />
                <circle cx="30" cy="12" r="2" fill="white" />
                <path
                  d="M16 24L24 30L32 24"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
            <div className="dashboard-card">
              <h2 className="dashboard-title">
                Age-Friendliness Assessment
              </h2>

              {/* Minimal Progress Bar */}
              <div className="completion-section">
                <div className="completion-header">
                  <span className="completion-label">Assessment Progress</span>
                  <span className="completion-percentage">{calculateCompletionPercentage}%</span>
                </div>
                
                <div className="completion-bar-container">
                  <div className="completion-bar-track">
                    <div
                      className="completion-bar-fill"
                      style={{ width: `${calculateCompletionPercentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="completion-footer">
                  <span className="completion-status">
                    {calculateCompletionPercentage < 100 ? 'Complete all fields to finish' : 'Assessment completed'}
                  </span>
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
                    className="dimension-header bg-gradient-to-r from-purple-600 to-blue-500 text-white p-5 cursor-pointer flex justify-between items-center hover:brightness-110 transition-all rounded-lg"
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
                          className="mb-6 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200"
                        >
                          <div className="font-semibold text-white bg-gradient-to-r from-blue-500 to-teal-400 p-4 text-lg rounded-t-xl">
                            {kpiName}
                          </div>

                          <div className="p-5">
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

                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-300">
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