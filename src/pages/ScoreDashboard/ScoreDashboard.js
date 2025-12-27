import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import {
  calculateScoresFromState,
  calculateCompletionFromState,
  countNonZeroWeightageMetrics,
  getPerformanceCategory,
  getCriticalMetrics,
  generateInsights,
} from "../../scoring";
import "./ScoreDashboard.css";

const ScoreDashboard = ({ user }) => {
  const navigate = useNavigate();
  const { collectionName, assessmentId } = useParams();
  const [appState, setAppState] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        if (!user || !user.uid) return;
        const assessmentRef = doc(
          db,
          "users",
          user.uid,
          collectionName,
          assessmentId
        );
        const snap = await getDoc(assessmentRef);
        if (!snap.exists()) {
          setLoading(false);
          return;
        }
        const data = snap.data();
        setMeta({
          respondentName: data.respondentName,
          organisation: data.organisation,
          city: data.city,
          borough: data.borough,
          ward: data.ward,
          createdAt: data.createdAt,
          completionPercentage: data.completionPercentage, // Fetch from Firestore
        });
        setAppState(
          data.ratings && data.priorities && data.weights
            ? {
                ratings: data.ratings,
                priorities: data.priorities,
                weights: data.weights,
              }
            : null
        );
      } catch (err) {
        console.error("Error loading assessment for score dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [user, collectionName, assessmentId]);

  const computed = useMemo(() => {
    if (!appState) {
      return null;
    }
    const scores = calculateScoresFromState(appState);
    // Use completionPercentage from Firestore (meta), fallback to calculation if not available
    const completionPercent = meta?.completionPercentage !== undefined 
      ? meta.completionPercentage 
      : calculateCompletionFromState(appState);
    const nonZeroMetrics = countNonZeroWeightageMetrics(appState);
    const performanceCategory = getPerformanceCategory(scores.overall);
    const criticalMetrics = getCriticalMetrics(appState);
    const insights = generateInsights(scores);
    return {
      scores,
      completionPercent,
      nonZeroMetrics,
      performanceCategory,
      criticalMetrics,
      insights,
    };
  }, [appState, meta]);

  useEffect(() => {
    if (!computed || !chartRef.current) return;
    const { scores } = computed;
    const canvas = chartRef.current;
    const ctx = canvas.getContext("2d");
    const { Chart } = window;
    if (!Chart) {
      console.error("Chart.js not loaded");
      return;
    }

    // Destroy previous chart instance if exists
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const labels = Object.keys(scores.dimensions);
    const data = Object.values(scores.dimensions).map((d) => d.score);
    
    // Create gradient for bars
    const createGradient = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0.4)');
      return gradient;
    };

    // Create hover gradient
    const createHoverGradient = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 1)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0.6)');
      return gradient;
    };

    chartInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels.map((l) =>
          l.length > 20 ? `${l.substring(0, 20)}...` : l
        ),
        datasets: [
          {
            label: "Dimension Score",
            data,
            backgroundColor: createGradient(),
            borderColor: '#7c3aed',
            borderWidth: 1,
            borderRadius: 8,
            hoverBackgroundColor: createHoverGradient(),
            hoverBorderColor: '#6d28d9',
            hoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 5,
            grid: {
              color: 'rgba(226, 232, 240, 0.3)',
              drawBorder: false,
            },
            ticks: {
              color: "#64748b",
              font: {
                size: 12,
                family: "'Inter', sans-serif"
              },
              callback: (value) => `${value}/5`,
              padding: 8,
            },
            border: {
              display: false,
            }
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: "#475569",
              font: {
                size: 12,
                family: "'Inter', sans-serif",
                weight: 500
              },
              maxRotation: 45,
              minRotation: 45,
            },
            border: {
              display: false,
            }
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#f8fafc',
            borderColor: '#475569',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function(context) {
                const label = labels[context.dataIndex] || '';
                const fullLabel = label.length > 30 ? `${label.substring(0, 30)}...` : label;
                return `${fullLabel}: ${context.parsed.y.toFixed(2)}/5`;
              },
              title: function() {
                return '';
              }
            }
          },
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    });

    // Cleanup function
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [computed]);

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      if (Number.isNaN(d.getTime())) return "N/A";
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return "N/A";
    }
  };



  if (loading) {
    return (
      <div className="score-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading assessment results...</p>
      </div>
    );
  }

  if (!appState || !computed) {
    return (
      <div className="score-dashboard-loading">
        <p>No assessment results found.</p>
        <button className="btn-back-home" onClick={() => navigate("/")}>
          Return to Home
        </button>
      </div>
    );
  }

  const {
    scores,
    completionPercent,
    nonZeroMetrics,
    performanceCategory,
    criticalMetrics,
    insights,
  } = computed;

  const dimScores = Object.entries(scores.dimensions)
    .map(([name, data]) => ({
      name,
      score: data.score,
    }))
    .sort((a, b) => b.score - a.score);

  const top3Dims = dimScores.slice(0, 3);
  const bottom3Dims = dimScores.slice(-3).reverse();

  const getInsightIcon = (title) => {
    if (!title) return "💡";
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("overall")) return "📊";
    if (lowerTitle.includes("gap") || lowerTitle.includes("priority")) return "🎯";
    if (lowerTitle.includes("critical") || lowerTitle.includes("urgent")) return "🚨";
    if (lowerTitle.includes("completion") || lowerTitle.includes("progress")) return "✅";
    if (lowerTitle.includes("strength") || lowerTitle.includes("strong")) return "🌟";
    if (lowerTitle.includes("improve") || lowerTitle.includes("weak")) return "📉";
    if (lowerTitle.includes("recommend") || lowerTitle.includes("action")) return "📋";
    return "💡";
  };

  return (
    <div className="score-dashboard">
      {/* Header Section */}
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
                Smart Age-Friendliness Evaluation
              </div>
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="info-panel">
            <div className="info-item">
              <span className="info-label">Respondent:</span>
              <span className="info-value">
                {meta?.respondentName || "N/A"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Organization:</span>
              <span className="info-value">{meta?.organisation || "N/A"}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Location:</span>
              <span className="info-value">
                {[meta?.city, meta?.borough, meta?.ward]
                  .filter(Boolean)
                  .join(", ") || "N/A"}
              </span>
            </div>
            <div className="info-item created">
              <span className="info-label">Created:</span>
              <span className="info-value">{formatDate(meta?.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        <div className="score-dashboard-main">
          {/* Hero Section */}
          <div className="score-hero-card">
            <h2 className="dashboard-title">Assessment Results</h2>
            <p className="dashboard-subtitle">
              Comprehensive analysis of your age-friendliness assessment
            </p>
          </div>

          {/* Summary Cards */}
          <div className="score-summary-grid">
            <div className="score-summary-card">
              <div className="summary-label">Overall Score</div>
              <div className="summary-value">{scores.overall.toFixed(1)}/5</div>
              <div className="summary-percentage">
                {((scores.overall / 5) * 100).toFixed(0)}%
              </div>
              <div className={`performance-badge ${performanceCategory.class}`}>
                {performanceCategory.name}
              </div>
            </div>

            <div className="score-summary-card">
              <div className="summary-label">Metrics Assessed</div>
              <div className="summary-value">{nonZeroMetrics}</div>
              <div className="summary-subtitle">with non-zero weightage</div>
            </div>

            <div className="score-summary-card">
              <div className="summary-label">Critical Issues</div>
              <div className="summary-value">{criticalMetrics.length}</div>
              <div className="summary-subtitle">A-priority metrics</div>
            </div>

            <div className="score-summary-card">
              <div className="summary-label">Completion</div>
              <div className="summary-value">{completionPercent}%</div>
              <div className="summary-subtitle">assessment progress</div>
            </div>
          </div>

          {/* Vertical Sections */}
          <div className="score-vertical-sections">
            {/* Top Performing Dimensions */}
            <div className="score-vertical-card">
              <div className="section-header top-performing">
                <div className="section-icon">🏆</div>
                <div className="section-header-content">
                  <h3 className="section-title">Top Performing Dimensions</h3>
                  <p className="section-subtitle">Your strongest areas</p>
                </div>
              </div>

              <div className="section-content">
                {top3Dims.map((dim, i) => (
                  <div key={dim.name} className="dimension-item">
                    <div className="dimension-rank">{i + 1}</div>
                    <div className="dimension-info">
                      <div className="dimension-name">{dim.name}</div>
                      <div className="dimension-score">
                        {dim.score.toFixed(2)} / 5
                      </div>
                    </div>
                    <div className="dimension-progress">
                      <div className="dimension-progress-bar">
                        <div
                          className="dimension-progress-fill"
                          style={{ width: `${(dim.score / 5) * 100}%` }}
                        />
                      </div>
                      <div className="dimension-percentage">
                        {((dim.score / 5) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Areas Needing Improvement */}
            <div className="score-vertical-card">
              <div className="section-header areas-improvement">
                <div className="section-icon">⚠️</div>
                <div className="section-header-content">
                  <h3 className="section-title">Areas Needing Improvement</h3>
                  <p className="section-subtitle">
                    Dimensions requiring attention
                  </p>
                </div>
              </div>
              <div className="section-content">
                {bottom3Dims.map((dim, i) => (
                  <div key={dim.name} className="dimension-item">
                    <div className="dimension-rank">{i + 1}</div>
                    <div className="dimension-info">
                      <div className="dimension-name">{dim.name}</div>
                      <div className="dimension-score">
                        {dim.score.toFixed(2)} / 5
                      </div>
                    </div>
                    <div className="dimension-progress">
                      <div className="dimension-progress-bar">
                        <div
                          className="dimension-progress-fill"
                          style={{ width: `${(dim.score / 5) * 100}%` }}
                        />
                      </div>
                      <div className="dimension-percentage">
                        {((dim.score / 5) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical A-Priority Metrics */}
            <div className="score-vertical-card">
              <div className="section-header critical-metrics">
                <div className="section-icon">🔴</div>
                <div className="section-header-content">
                  <h3 className="section-title">Critical Metrics</h3>
                  <p className="section-subtitle">
                    Requiring immediate attention
                  </p>
                </div>
              </div>
              <div className="section-content">
                {criticalMetrics.map((metric, index) => (
                  <div key={metric.key} className="critical-metric-card">
                    <div className="critical-metric-icon">{index + 1}</div>
                    <div className="critical-metric-content">
                      <div className="critical-metric-name">{metric.metricName}</div>
                      <div className="critical-metric-details">
                        <span>Dimension: {metric.dimensionName}</span>
                        <span>KPI: {metric.kpiName}</span>
                        <span>Rating: {metric.rating.toFixed(1)}/5</span>
                      </div>
                    </div>
                    <span className="critical-badge">Critical</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimension Breakdown Chart */}
            <div className="score-vertical-card">
              <div className="section-header dimension-breakdown">
                <div className="section-icon">📈</div>
                <div className="section-header-content">
                  <h3 className="section-title">Dimension Breakdown</h3>
                  <p className="section-subtitle">
                    Performance across all dimensions (out of 5)
                  </p>
                </div>
              </div>
              <div className="section-content">
                <div className="chart-container">
                  <canvas ref={chartRef} />
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-color" style={{backgroundColor: '#8b5cf6'}}></div>
                    <span>Dimension Score</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{backgroundColor: '#e2e8f0'}}></div>
                    <span>Scale: 0-5</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Insights */}
            <div className="score-vertical-card">
              <div className="section-header">
                <div className="section-icon">💡</div>
                <div className="section-header-content">
                  <h3 className="section-title">Key Insights</h3>
                  <p className="section-subtitle">Actionable recommendations</p>
                </div>
              </div>
              <div className="section-content">
                <div className="key-insights-list">
                  {insights.slice(0, 4).map((insight, index) => (
                    <div key={`${insight.title}-${index}`} className="key-insight-card">
                      <div className="key-insight-icon">
                        {getInsightIcon(insight.title)}
                      </div>
                      <div className="key-insight-content">
                        <div className="key-insight-title">{insight.title}</div>
                        <p className="key-insight-text">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="dashboard-footer">
            <div className="footer-buttons-group">
              <button
                type="button"
                className="btn-view-comparison"
                onClick={() => {
                  // TODO: Implement view comparison functionality
                  alert('View Comparison feature coming soon!');
                }}
              >
                <svg
                  className="btn-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M8 2L2 8l6 6M14 2L8 8l6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                View Comparison
              </button>
              <button
                type="button"
                className="btn-generate-result"
                onClick={() => {
                  navigate(`/results/${collectionName}/${assessmentId}`);
                }}
              >
                <svg
                  className="btn-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M14 2H2a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V3a1 1 0 00-1-1zM5 8h6M8 5v6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Generate Result
              </button>
            </div>
            <button
              type="button"
              className="btn-back-home"
              onClick={() => navigate("/")}
            >
              <svg
                className="btn-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M10 12l-4-4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreDashboard;