
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { CATEGORY_CONFIG } from './constants/category';
import './ActiveReports.css';

const ActiveReports = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null);

    useEffect(() => {
        fetchActiveIncidents();

        
        const subscription = supabase
            .channel('active_incidents_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, payload => {
                fetchActiveIncidents();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [user]);

    const fetchActiveIncidents = async () => {
        try {
            if (!user) return;
            setLoading(true);

            let query = supabase.from('incidents').select(`
                *,
                user:profiles!incidents_user_id_fkey(id, name, phone)
            `);

            
            query = query.in('status', ['pending', 'accepted', 'arrived', 'in_progress']);

            
            const role = user.role || '';
            if (role !== 'admin') {
                if (role.toLowerCase().includes('police')) {
                    query = query.contains('categories', ['police']);
                } else if (role.toLowerCase().includes('fire')) {
                    query = query.contains('categories', ['fire']);
                } else if (role.toLowerCase().includes('ambulance') || role.toLowerCase().includes('medical')) {
                    query = query.contains('categories', ['ambulance']);
                }
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setIncidents(data || []);
        } catch (error) {
            console.error('Error fetching active reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredReports = useMemo(() => {
        if (!selectedCategory) return incidents;
        return incidents.filter(i => i.categories.includes(selectedCategory));
    }, [incidents, selectedCategory]);

    const handleStatusUpdate = async (incident) => {
        try {
            let nextStatus = '';
            let message = '';

            if (incident.status === 'accepted') {
                nextStatus = 'in_progress';
                message = 'Responder is en route.';
            } else if (incident.status === 'in_progress') {
                nextStatus = 'arrived';
                message = 'Responder has arrived on-site.';
            } else if (incident.status === 'arrived') {
                if (!window.confirm('Are you sure you want to resolve this emergency?')) return;
                nextStatus = 'completed';
                message = 'Incident successfully resolved.';
            }

            if (!nextStatus) return;

            const { error: updateError } = await supabase
                .from('incidents')
                .update({ status: nextStatus })
                .eq('id', incident.id);

            if (updateError) throw updateError;

            
            await supabase.from('incident_updates').insert({
                incident_id: incident.id,
                status: nextStatus,
                message: message,
                user_id: user?.id,
                created_at: new Date().toISOString()
            });

            
            if (nextStatus === 'completed' && incident.responder_id) {
                await supabase.from('profiles')
                    .update({ status: 'available', current_incident_id: null })
                    .eq('id', incident.responder_id);
            }

            fetchActiveIncidents();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Status update failed');
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending': return 'WAITING';
            case 'accepted': return 'RESPONDER ASSIGNED';
            case 'arrived': return 'ON-SITE';
            case 'in_progress': return 'RESOLVING';
            default: return 'ACTIVE';
        }
    };

    const visibleCategories = useMemo(() => {
        const allCats = Object.keys(CATEGORY_CONFIG);
        if (user?.role === 'admin') return allCats;

        const role = user?.role?.toLowerCase() || '';
        if (role.includes('police')) return allCats.filter(c => c === 'police' || c === 'traffic');
        if (role.includes('fire')) return allCats.filter(c => c === 'fire');
        if (role.includes('ambulance') || role.includes('medical')) return allCats.filter(c => c === 'ambulance' || c === 'medical');

        return [];
    }, [user]);

    return (
        <div className="active-reports-container">
            <div className="active-reports-gradient-bg">
                <div className="active-reports-content-wrapper">

                    {/* Header */}
                    <div className="active-reports-header">
                        <div className="active-reports-title-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <button className="back-btn" onClick={() => navigate(-1)}>⬅️</button>
                                <h1 className="active-reports-page-title">Ongoing Missions</h1>
                            </div>
                            <button className="refresh-btn" onClick={fetchActiveIncidents}>🔄 Refresh</button>
                        </div>

                        {/* Filter Bar */}
                        <div className="active-reports-toolbar">
                            <div className="active-reports-filters">
                                <div
                                    className={`filter-pill-web ${!selectedCategory ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory(null)}
                                >
                                    All Missions
                                </div>
                                {visibleCategories.length > 1 && visibleCategories.map(cat => (
                                    <div
                                        key={cat}
                                        className={`filter-pill-web ${selectedCategory === cat ? 'active' : ''}`}
                                        onClick={() => setSelectedCategory(cat)}
                                    >
                                        {CATEGORY_CONFIG[cat].label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Missions List */}
                    <div className="active-missions-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {loading && incidents.length === 0 ? (
                            <div className="loading-overlay">⏳ Loading active missions...</div>
                        ) : filteredReports.length === 0 ? (
                            <div className="empty-missions-web">
                                <span className="empty-icon">📡</span>
                                <span className="empty-text">No active emergencies currently reported</span>
                                {selectedCategory && (
                                    <button className="clear-all-btn" onClick={() => setSelectedCategory(null)}>Clear filter</button>
                                )}
                            </div>
                        ) : (
                            filteredReports.map(incident => (
                                <div key={incident.id} className="active-card-web">
                                    <div className="active-card-header">
                                        <div className="pulse-group">
                                            <div className="pulse-dot-web" />
                                            <span className="urgent-badge">INCIDENT ACTIVE</span>
                                        </div>
                                        <div className="mission-status-pill">
                                            {getStatusLabel(incident.status)}
                                        </div>
                                    </div>

                                    <h2 className="active-title-web">{incident.title}</h2>
                                    <p className="active-desc-web">{incident.description || 'Our team is processing this report.'}</p>

                                    <div className="active-footer-web">
                                        <button
                                            className="action-btn-web track-btn-web"
                                            onClick={() => navigate(`/map?trackingIncidentId=${incident.id}`)}
                                        >
                                            🗺️ Track
                                        </button>

                                        {/* Responder Quick Action Logic */}
                                        {incident.responder_id === user?.id && (
                                            <button
                                                className={`action-btn-web status-update-btn-web status-${incident.status}`}
                                                onClick={() => handleStatusUpdate(incident)}
                                            >
                                                {incident.status === 'accepted' ? '▶️ Start Mission' :
                                                    incident.status === 'in_progress' ? '📍 Arrived' :
                                                        '🏁 Complete Mission'}
                                            </button>
                                        )}

                                        <button
                                            className="action-btn-web details-btn-web"
                                            onClick={() => navigate(`/incident-details/${incident.id}`)}
                                        >
                                            ℹ️ Details
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ActiveReports;
