
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { CATEGORY_CONFIG, STATUS_CONFIG } from './constants/category';
import './Incidents.css';

const Incidents = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    const [incidents, setIncidents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || null);
    const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || null);
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        fetchIncidents();
    }, [user]);

    const fetchIncidents = async () => {
        try {
            if (!user) return;
            setIsLoading(true);

            let query = supabase.from('incidents').select(`
        *,
        user:profiles!incidents_user_id_fkey(id, name, phone)
      `);

            
            if (user.role === 'police_station') {
                query = query.contains('categories', ['police']);
            } else if (user.role === 'fire_station') {
                query = query.contains('categories', ['fire']);
            } else if (user.role === 'ambulance_station') {
                query = query.contains('categories', ['ambulance']);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setIncidents(data || []);
        } catch (error) {
            console.error('Error fetching incidents:', error);
            alert('Failed to load incidents');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredIncidents = useMemo(() => {
        let result = [...incidents];

        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(i =>
                i.title.toLowerCase().includes(query) ||
                i.description?.toLowerCase().includes(query) ||
                i.address?.toLowerCase().includes(query)
            );
        }

        
        if (selectedCategory) {
            result = result.filter(i => i.categories.includes(selectedCategory));
        }

        
        if (selectedStatus) {
            result = result.filter(i => i.status === selectedStatus);
        }

        
        result.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [incidents, searchQuery, selectedCategory, selectedStatus, sortOrder]);

    const handleIncidentPress = (incidentId) => {
        navigate(`/incident-details/${incidentId}`);
    };

    const categories = Object.keys(CATEGORY_CONFIG);
    const statuses = Object.keys(STATUS_CONFIG);

    return (
        <div className="incidents-container">
            <div className="incidents-gradient-bg">
                <div className="incidents-content-wrapper">

                    {/* Header */}
                    <div className="incidents-header">
                        <div className="incidents-title-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <button className="back-btn" onClick={() => navigate(-1)}>⬅️</button>
                                <h1 className="incidents-page-title">Incident Hub</h1>
                            </div>
                            <button
                                className="sort-toggle-btn"
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            >
                                {sortOrder === 'desc' ? '🔽 Newest First' : '🔼 Oldest First'}
                            </button>
                        </div>

                        {/* Toolbar */}
                        <div className="incidents-toolbar">
                            <div className="search-bar-web">
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    className="search-input-web"
                                    placeholder="Search by title, description, or address..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button className="clear-all-btn" style={{ marginTop: 0 }} onClick={() => setSearchQuery('')}>✖️</button>
                                )}
                            </div>

                            <div className="filters-row-web">
                                <div
                                    className={`filter-pill-web ${!selectedCategory ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory(null)}
                                >
                                    All Types
                                </div>
                                {categories.map(cat => (
                                    <div
                                        key={cat}
                                        className={`filter-pill-web ${selectedCategory === cat ? 'active' : ''}`}
                                        onClick={() => setSelectedCategory(cat)}
                                    >
                                        {CATEGORY_CONFIG[cat].label}
                                    </div>
                                ))}

                                <div className="filter-divider-web" />

                                <div
                                    className={`filter-pill-web ${!selectedStatus ? 'active' : ''}`}
                                    onClick={() => setSelectedStatus(null)}
                                >
                                    All Status
                                </div>
                                {statuses.map(status => (
                                    <div
                                        key={status}
                                        className={`filter-pill-web ${selectedStatus === status ? 'active' : ''}`}
                                        onClick={() => setSelectedStatus(status)}
                                    >
                                        {STATUS_CONFIG[status].label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Incidents List */}
                    <div className="incidents-list-web">
                        {isLoading && incidents.length === 0 ? (
                            <div className="loading-overlay">⏳ Loading incidents history...</div>
                        ) : filteredIncidents.length === 0 ? (
                            <div className="empty-state-web">
                                <span className="empty-icon">📂</span>
                                <span className="empty-text">No incidents match your current filters</span>
                                {(searchQuery || selectedCategory || selectedStatus) && (
                                    <button className="clear-all-btn" onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCategory(null);
                                        setSelectedStatus(null);
                                    }}>
                                        Clear all filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredIncidents.map(incident => {
                                const statusConfig = STATUS_CONFIG[incident.status] || STATUS_CONFIG.pending;
                                return (
                                    <div
                                        key={incident.id}
                                        className="incident-card-web"
                                        onClick={() => handleIncidentPress(incident.id)}
                                    >
                                        <div className="card-header-web">
                                            <div className="categories-pills-web">
                                                {incident.categories.map(cat => {
                                                    const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
                                                    return (
                                                        <span
                                                            key={cat}
                                                            className="cat-pill-web"
                                                            style={{ backgroundColor: config.color }}
                                                        >
                                                            {config.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            <div className="status-pill-web" style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}>
                                                {statusConfig.label}
                                            </div>
                                        </div>

                                        <h2 className="incident-title-web">{incident.title}</h2>
                                        <p className="incident-desc-web">{incident.description}</p>

                                        <div className="card-footer-web">
                                            <div className="time-box-web">
                                                <span>⏰</span> {new Date(incident.created_at).toLocaleString()}
                                            </div>
                                            <div className="time-box-web">
                                                <span>📍</span> {incident.address || 'Location Unknown'}
                                            </div>
                                            <span style={{ color: '#D1D5DB' }}>➡️</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Incidents;
