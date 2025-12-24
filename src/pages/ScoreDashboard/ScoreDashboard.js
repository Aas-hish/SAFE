import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  calculateScoresFromState,
  calculateCompletionFromState,
  countNonZeroWeightageMetrics,
  getPerformanceCategory,
  getCriticalMetrics,
  generateInsights,
} from '../../scoring';
import './ScoreDashboard.css';

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
          'users',
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
        // eslint-disable-next-line no-console
        console.error('Error loading assessment for score dashboard:', err);
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
    const completionPercent = calculateCompletionFromState(appState);
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
  }, [appState]);

  useEffect(() => {
    if (!computed || !chartRef.current) return;
    const { scores } = computed;
    const canvas = chartRef.current;
    const ctx = canvas.getContext('2d');
    const { Chart } = window;
    if (!Chart) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const labels = Object.keys(scores.dimensions);
    const data = Object.values(scores.dimensions).map((d) => d.score);

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.map((l) =>
          l.length > 35 ? `${l.substring(0, 35)}...` : l
        ),
        datasets: [
          {
            label: 'Dimension Score',
            data,
            backgroundColor: 'rgba(107, 70, 193, 0.8)',
            borderColor: 'rgba(107, 70, 193, 1)',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 5,
            ticks: {
              callback: (value) => `${value}/5`,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: 'Performance Across All Dimensions',
            font: {
              size: 16,
            },
          },
        },
      },
    });
  }, [computed]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      if (Number.isNaN(d.getTime())) return 'N/A';
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

  if (loading) {
    return (
      <div className="score-dashboard-loading">
        Loading score dashboard...
      </div>
    );
  }

  if (!appState || !computed) {
    return (
      <div className="score-dashboard-loading">
        No assessment results found.
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
    if (!title) return '💡';
    if (title.toLowerCase().includes('overall')) return '📊';
    if (title.toLowerCase().includes('gap')) return '🎯';
    if (title.toLowerCase().includes('critical')) return '🚨';
    if (title.toLowerCase().includes('completion')) return '✅';
    if (title.toLowerCase().includes('strength')) return '🌟';
    return '💡';
  };

  return (
    <div className="score-dashboard">
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
                {meta?.respondentName || 'N/A'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Organization:</span>
              <span className="info-value">{meta?.organisation || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Location:</span>
              <span className="info-value">
                {[meta?.city, meta?.borough, meta?.ward]
                  .filter(Boolean)
                  .join(', ') || 'N/A'}
              </span>
            </div>
            <div className="info-item created">
              <span className="info-label">Created:</span>
              <span className="info-value">
                {formatDate(meta?.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="assessment-dashboard-main score-dashboard-main">
          <div className="bg-white rounded-xl p-6 mb-6 shadow-lg score-hero-card">
            <h2 className="text-purple-600 text-3xl font-bold mb-5">
              📊 SAFE Assessment Dashboard
            </h2>
            <p className="mt-3">
              <strong>Assessment Date:</strong> {formatDate(meta?.createdAt)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10 score-summary-grid">
            <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-6 rounded-xl shadow-lg score-summary-card">
              <div className="text-lg opacity-90 mb-2">Overall Score</div>
              <div className="text-5xl font-bold mb-2">
                {scores.overall.toFixed(2)}/5
              </div>
              <div className="text-lg opacity-90 mb-2">
                {((scores.overall / 5) * 100).toFixed(1)}%
              </div>
              <span
                className={`performance-badge ${performanceCategory.class} inline-block px-4 py-2 rounded-full text-sm font-semibold`}
              >
                {performanceCategory.name}
              </span>
            </div>

            <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-6 rounded-xl shadow-lg score-summary-card">
              <div className="text-lg opacity-90 mb-2">Metrics Assessed</div>
              <div className="text-5xl font-bold mb-2">{nonZeroMetrics}</div>
              <div className="text-lg opacity-90">with non-zero weightage</div>
            </div>

            <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-6 rounded-xl shadow-lg score-summary-card">
              <div className="text-lg opacity-90 mb-2">Critical Issues</div>
              <div className="text-5xl font-bold mb-2">
                {criticalMetrics.length}
              </div>
              <div className="text-lg opacity-90">
                A-priority metrics need attention
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-6 rounded-xl shadow-lg score-summary-card">
              <div className="text-lg opacity-90 mb-2">Completion Status</div>
              <div className="text-5xl font-bold mb-2">
                {completionPercent}%
              </div>
              <div className="text-lg opacity-90">Assessment progress</div>
            </div>
          </div>

          <div className="score-sections-grid">
            <div className="score-section">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-2xl font-bold mb-5">
                  🏆 Top Performing Dimensions
                </h3>
                {top3Dims.map((dim, i) => (
                  <div key={dim.name} className="mb-4">
                    <strong className="text-lg">
                      {i + 1}. {dim.name}
                    </strong>
                    <div className="h-5 bg-gray-200 rounded-full overflow-hidden mt-2 shadow-inner">
                      <div
                        className="progress-fill h-full flex items-center justify-center text-white text-sm"
                        style={{ width: `${(dim.score / 5) * 100}%` }}
                      >
                        {dim.score.toFixed(2)} / 5
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="score-section">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-2xl font-bold mb-5">
                  ⚠️ Areas Needing Improvement
                </h3>
                {bottom3Dims.map((dim, i) => (
                  <div key={dim.name} className="mb-4">
                    <strong className="text-lg">
                      {i + 1}. {dim.name}
                    </strong>
                    <div className="h-5 bg-gray-200 rounded-full overflow-hidden mt-2 shadow-inner">
                      <div
                        className="h-full flex items-center justify-center text-white text-sm bg-gradient-to-r from-red-400 to-red-600"
                        style={{ width: `${(dim.score / 5) * 100}%` }}
                      >
                        {dim.score.toFixed(2)} / 5
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="score-section score-section-tall">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-2xl font-bold mb-5">
                  🔴 Critical A-Priority Metrics (Bottom 10%)
                </h3>
                <p className="mb-5 text-lg">
                  These essential metrics require immediate attention:
                </p>
                {criticalMetrics.slice(0, 10).map((metric) => (
                  <div
                    key={metric.key}
                    className="bg-gradient-to-r from-purple-50 to-transparent border-l-4 border-teal-400 p-5 mb-4 rounded-lg"
                  >
                    <h4 className="text-purple-600 font-semibold text-lg mb-2">
                      {metric.name}
                    </h4>
                    <p className="mb-1">
                      <strong>Current Rating:</strong> {metric.score}/5
                    </p>
                    <p>
                      <strong>Status:</strong>{' '}
                      <span className="performance-badge badge-critical inline-block px-3 py-1 rounded-full text-sm font-semibold">
                        Critical
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="score-section score-section-tall">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-2xl font-bold mb-5">
                  📈 Dimension Breakdown
                </h3>
                <div className="chart-container">
                  <canvas ref={chartRef} />
                </div>
              </div>
            </div>

            <div className="score-section score-section-full">
              <div className="bg-white rounded-xl p-6 shadow-lg key-insights">
                <h3 className="text-2xl font-bold mb-5">
                  <span role="img" aria-label="Insights">
                    💡
                  </span>{' '}
                  Key Insights
                </h3>
                <div className="key-insights-list">
                  {insights.map((insight) => (
                    <div key={insight.title} className="key-insight-card">
                      <div className="key-insight-icon">
                        {getInsightIcon(insight.title)}
                      </div>
                      <div className="key-insight-content">
                        <div className="key-insight-title">
                          {insight.title}
                        </div>
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

          <div className="assessment-dashboard-topbar">
            <button
              type="button"
              className="btn-back-info"
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreDashboard;


