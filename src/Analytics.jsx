// src/Analytics.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { COLORS } from './constants/colors';
import './Analytics.css';

const Analytics = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalIncidents: 0,
        avgResponseTime: 0,
        completionRate: 0,
        todayIncidents: 0,
    });
    const [categoryStats, setCategoryStats] = useState([]);
    const [timeStats, setTimeStats] = useState([]);

    useEffect(() => {
        loadAnalytics();
    }, []);

    const loadAnalytics = async () => {
        try {
            setIsLoading(true);

            // Fetch incidents (Broad visibility)
            let query = supabase.from('incidents').select('*');

            const { data: incidents, error } = await query;
            if (error) throw error;

            // Filter incidents based on role (matching mobile logic)
            const serviceType = getServiceTypeFromRole(user?.role);
            const stationIncidents = (incidents || []).filter(incident => {
                if (user?.role === 'admin') return true; // Super Admin sees all

                const mainCategories = ['police', 'fire', 'ambulance'];
                const incidentCategory = (incident.categories || []).find(cat =>
                    typeof cat === 'string' && mainCategories.includes(cat.toLowerCase())
                );
                return (incidentCategory || '').toLowerCase() === serviceType;
            });

            // 1. Calculate Core Stats
            const totalIncidentsCount = stationIncidents.length;
            const completedIncidents = stationIncidents.filter(i => i.status === 'completed').length;

            const responseTimes = stationIncidents
                .filter(i => i.response_time_minutes)
                .map(i => i.response_time_minutes || 0);

            const avgRT = responseTimes.length > 0
                ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
                : 0;

            const completionRate = totalIncidentsCount > 0
                ? Math.round((completedIncidents / totalIncidentsCount) * 100)
                : 0;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayIncidents = stationIncidents.filter(i =>
                new Date(i.created_at) >= today
            ).length;

            setStats({
                totalIncidents: totalIncidentsCount,
                avgResponseTime: Math.round(avgRT),
                completionRate,
                todayIncidents,
            });

            // 2. Category Breakdown
            const categories = {};
            stationIncidents.forEach(incident => {
                const mainCategories = ['police', 'fire', 'ambulance'];
                const otherCategories = (incident.categories || []).filter(cat =>
                    typeof cat === 'string' && !mainCategories.includes(cat.toLowerCase())
                );
                otherCategories.forEach(cat => {
                    categories[cat] = (categories[cat] || 0) + 1;
                });
            });

            const catBreakdown = Object.entries(categories)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            setCategoryStats(catBreakdown);

            // 3. Time Distribution
            const timeSlots = [
                { label: '12AM - 6AM', start: 0, end: 6, count: 0 },
                { label: '6AM - 12PM', start: 6, end: 12, count: 0 },
                { label: '12PM - 6PM', start: 12, end: 18, count: 0 },
                { label: '6PM - 12AM', start: 18, end: 24, count: 0 },
            ];

            stationIncidents.forEach(incident => {
                const hour = new Date(incident.created_at).getHours();
                const slot = timeSlots.find(s => hour >= s.start && hour < s.end);
                if (slot) slot.count++;
            });
            setTimeStats(timeSlots);

        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getServiceTypeFromRole = (role) => {
        if (!role) return 'none';
        const r = role.toLowerCase();
        if (r === 'admin') return 'all';
        if (r.includes('police')) return 'police';
        if (r.includes('fire')) return 'fire';
        if (r.includes('ambulance') || r.includes('medical')) return 'ambulance';
        return 'none';
    };

    const formatCategoryName = (name) => {
        return name.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    const getStatusColor = (value, type) => {
        if (type === 'rt') { // Response Time
            if (value <= 15) return { bg: '#D1FAE5', text: '#065F46', label: 'OPTIMAL' };
            if (value <= 30) return { bg: '#FEF3C7', text: '#92400E', label: 'ELEVATED' };
            return { bg: '#FEE2E2', text: '#991B1B', label: 'CRITICAL' };
        } else { // Completion Rate
            if (value >= 90) return { bg: '#D1FAE5', text: '#065F46', label: 'ELITE' };
            if (value >= 70) return { bg: '#FEF3C7', text: '#92400E', label: 'STABLE' };
            return { bg: '#FEE2E2', text: '#991B1B', label: 'ACTION NEEDED' };
        }
    };

    return (
        <div className="analytics-container">
            <div className="analytics-gradient-bg">
                <div className="analytics-content-wrapper">

                    {/* Header */}
                    <div className="analytics-header">
                        <div className="header-title-group">
                            <button className="back-btn" onClick={() => navigate(-1)}>⬅️</button>
                            <div>
                                <h1 className="page-title">{user?.role === 'admin' ? 'Global Command' : 'Force Analysis'}</h1>
                                <p className="page-subtitle">Intelligence Dashboard</p>
                            </div>
                        </div>
                        <button className="refresh-action-btn" onClick={loadAnalytics} disabled={isLoading}>
                            {isLoading ? '⌛ Refreshing...' : '🔄 Sync Data'}
                        </button>
                    </div>

                    {/* Strategic Overview */}
                    <div className="analytics-section-header">
                        <h2 className="section-title-web">Strategic Overview</h2>
                    </div>
                    <div className="overview-grid-web">
                        <div className="metric-card-web">
                            <div className="metric-icon-box" style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}>📢</div>
                            <div className="metric-data">
                                <span className="metric-value">{stats.totalIncidents}</span>
                                <span className="metric-label">Total Logs</span>
                                <div className="trend-badge-web" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                    📈 +12%
                                </div>
                            </div>
                        </div>

                        <div className="metric-card-web">
                            <div className="metric-icon-box" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>✅</div>
                            <div className="metric-data">
                                <span className="metric-value">{stats.completionRate}%</span>
                                <span className="metric-label">Success Rate</span>
                                <div className="trend-badge-web" style={{ backgroundColor: '#F3F4F6', color: '#666' }}>
                                    TARGET MET
                                </div>
                            </div>
                        </div>

                        <div className="metric-card-web">
                            <div className="metric-icon-box" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>⚡</div>
                            <div className="metric-data">
                                <span className="metric-value">{stats.avgResponseTime}m</span>
                                <span className="metric-label">Response Avg</span>
                                <div className="trend-badge-web" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                                    📉 -2m faster
                                </div>
                            </div>
                        </div>

                        <div className="metric-card-web">
                            <div className="metric-icon-box" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>🚨</div>
                            <div className="metric-data">
                                <span className="metric-value">{stats.todayIncidents}</span>
                                <span className="metric-label">Today's Active</span>
                                <div className="trend-badge-web" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                                    ALERT
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="analytics-sections-row">
                        {/* Category Breakdown */}
                        <div className="analytics-panel">
                            <h2 className="panel-title">Emergency Type Distribution</h2>
                            <div className="distribution-list">
                                {categoryStats.length === 0 ? (
                                    <div className="loading-overlay">Monitoring active pipelines...</div>
                                ) : (
                                    categoryStats.map((item, idx) => (
                                        <div key={idx} className="dist-item">
                                            <div className="dist-info">
                                                <span className="dist-name">{formatCategoryName(item.name)}</span>
                                                <span className="dist-count">{item.count} Cases</span>
                                            </div>
                                            <div className="progress-track">
                                                <div
                                                    className="progress-fill"
                                                    style={{
                                                        width: `${Math.min((item.count / stats.totalIncidents) * 100, 100)}%`,
                                                        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][idx % 5]
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Time Load */}
                        <div className="analytics-panel">
                            <h2 className="panel-title">24H Load Distribution</h2>
                            <div className="distribution-list">
                                {timeStats.map((slot, idx) => (
                                    <div key={idx} className="dist-item">
                                        <div className="dist-info">
                                            <span className="dist-name">{slot.label}</span>
                                            <span className="dist-count">{slot.count} Active</span>
                                        </div>
                                        <div className="progress-track">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${stats.totalIncidents > 0 ? (slot.count / stats.totalIncidents) * 100 : 0}%`,
                                                    backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][idx % 4]
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Performance Intelligence */}
                    <div className="analytics-panel">
                        <h2 className="panel-title">Performance Intelligence</h2>
                        <div className="performance-grid">

                            <div className="perf-item">
                                <div className="perf-label-group">
                                    <span className="perf-main-label">Operational Response Target</span>
                                    <span className="perf-sub-label">Measured against industry average (15m)</span>
                                </div>
                                <div className="perf-value-row">
                                    <div>
                                        <span className="perf-large-value">{stats.avgResponseTime} MINS</span>
                                        <p className="perf-comparison">Industry Avg: 15m</p>
                                    </div>
                                    {(() => {
                                        const status = getStatusColor(stats.avgResponseTime, 'rt');
                                        return (
                                            <div className="perf-status-indicator" style={{ backgroundColor: status.bg, color: status.text }}>
                                                {status.label}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="divider-line" />

                            <div className="perf-item">
                                <div className="perf-label-group">
                                    <span className="perf-main-label">Force Fulfillment Rate</span>
                                    <span className="perf-sub-label">Overall incident completion target (90%+)</span>
                                </div>
                                <div className="perf-value-row">
                                    <div>
                                        <span className="perf-large-value">{stats.completionRate}%</span>
                                        <p className="perf-comparison">Target: 90%+</p>
                                    </div>
                                    {(() => {
                                        const status = getStatusColor(stats.completionRate, 'comp');
                                        return (
                                            <div className="perf-status-indicator" style={{ backgroundColor: status.bg, color: status.text }}>
                                                {status.label}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Analytics;
