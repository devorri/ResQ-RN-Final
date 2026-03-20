
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import { supabase } from './supabaseClient';
import { useAuth } from './contexts/AuthContext';
import { CATEGORY_CONFIG } from './constants/category';
import { Navigation, X, ChevronLeft, MapPin, Radio } from 'lucide-react';
import './Map.css';


const INITIAL_CENTER = { lat: 15.1450, lng: 120.5887 }; 

const MapDashboard = () => {
    const [searchParams] = useSearchParams();
    const trackingIncidentId = searchParams.get('trackingIncidentId');
    const { user } = useAuth();
    const [incidents, setIncidents] = useState([]);
    const [responderLocations, setResponderLocations] = useState({});
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [map, setMap] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });

    const channelRef = useRef(null);

    useEffect(() => {
        fetchInitialData();
        setupRealtime();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, []);

    
    useEffect(() => {
        if (trackingIncidentId && incidents.length > 0 && map) {
            const target = incidents.find(i => i.id.toString() === trackingIncidentId);
            if (target) {
                handleSelectIncident(target);
            }
        }
    }, [trackingIncidentId, incidents, map]);

    const fetchInitialData = async () => {
        try {
            
            const { data: incidentsData, error: incidentsError } = await supabase
                .from('incidents')
                .select('*, responder:profiles!incidents_responder_id_fkey(id, name, role)')
                .order('created_at', { ascending: false });

            if (incidentsError) throw incidentsError;
            setIncidents(incidentsData || []);

            
            const { data: locationsData, error: locationsError } = await supabase
                .from('responder_locations')
                .select('*, user:profiles(id, name, role)');

            if (locationsError) throw locationsError;

            const locMap = {};
            locationsData?.forEach(loc => {
                if (!loc.user_id) return;

                const profile = loc.user;
                if (!profile) return;

                
                if (user?.role !== 'admin') {
                    const myRole = user.role.toLowerCase();
                    const targetRole = (profile.role || '').toLowerCase();

                    
                    if (targetRole !== 'user') {
                        const myDept = myRole.split('_')[0]; 
                        const targetDept = targetRole.includes('fire') ? 'fire' : targetRole.split('_')[0];

                        
                        if (myDept !== targetDept && myRole !== 'admin') return;
                    }
                }

                locMap[loc.user_id] = loc;
            });
            setResponderLocations(locMap);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    };

    const setupRealtime = () => {
        const channel = supabase.channel('dashboard-map-google')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'responder_locations' }, (payload) => {
                const { eventType, new: newData, old: oldData } = payload;
                setResponderLocations(prev => {
                    const next = { ...prev };
                    if (eventType === 'DELETE') {
                        delete next[oldData.user_id];
                    } else {
                        const existing = prev[newData.user_id];
                        
                        
                        next[newData.user_id] = {
                            ...newData,
                            user: existing?.user || newData.user
                        };
                    }
                    return next;
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
                fetchInitialData();
            })
            .subscribe();

        channelRef.current = channel;
    };

    const visibleIncidents = useMemo(() => {
        const activeStatuses = ['pending', 'accepted', 'arrived', 'in_progress'];
        let filtered = incidents.filter(i => activeStatuses.includes(i.status));

        if (user?.role !== 'admin') {
            const role = (user?.role || '').toLowerCase();
            let serviceType = 'none';
            if (role.includes('police')) serviceType = 'police';
            else if (role.includes('fire')) serviceType = 'fire';
            else if (role.includes('ambulance') || role.includes('medical')) serviceType = 'ambulance';

            filtered = filtered.filter(i => i.categories?.includes(serviceType));
        }

        const counts = {
            all: filtered.length,
            pending: filtered.filter(i => i.status === 'pending').length,
            progress: filtered.filter(i => ['accepted', 'arrived', 'in_progress'].includes(i.status)).length
        };

        if (filterStatus !== 'all') {
            if (filterStatus === 'progress') {
                filtered = filtered.filter(i => ['accepted', 'arrived', 'in_progress'].includes(i.status));
            } else {
                filtered = filtered.filter(i => i.status === filterStatus);
            }
        }

        return { filtered, counts };
    }, [incidents, user, filterStatus]);

    const onLoad = useCallback((m) => {
        setMap(m);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    const handleSelectIncident = (incident) => {
        setSelectedIncident(incident);
        if (map && incident.latitude && incident.longitude) {
            map.panTo({ lat: parseFloat(incident.latitude), lng: parseFloat(incident.longitude) });
            map.setZoom(16);
        }
    };

    if (!isLoaded) {
        return (
            <div className="loading-container-map">
                <div className="loading-spinner-map"></div>
                <p>Establishing Satellite Connection...</p>
            </div>
        );
    }

    return (
        <div className="map-dashboard-container">
            <header className="map-header">
                <div className="map-header-top">
                    <div className="map-title-group">
                        <button className="map-back-btn" onClick={() => navigate('/dashboard')}>
                            <ChevronLeft size={24} />
                        </button>
                        <div className="map-title-text">
                            <h1>ResQ Map</h1>
                            <p className="map-subtitle">
                                {Object.keys(responderLocations).length} Units Active • {visibleIncidents.counts.all} Emergency Signals
                            </p>
                        </div>
                    </div>
                </div>

                <div className="map-filters">
                    <button
                        className={`map-filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('all')}
                    >All Active ({visibleIncidents.counts.all})</button>
                    <button
                        className={`map-filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('pending')}
                    >Open Tickets ({visibleIncidents.counts.pending})</button>
                    <button
                        className={`map-filter-btn ${filterStatus === 'progress' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('progress')}
                    >In Progress ({visibleIncidents.counts.progress})</button>
                </div>
            </header>

            <div className="map-view-wrapper">
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%', backgroundColor: '#f3f4f6' }}
                    center={INITIAL_CENTER}
                    zoom={13}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                    options={{
                        backgroundColor: '#f3f4f6',
                        disableDefaultUI: true,
                        zoomControl: true,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false
                    }}
                >
                    {/* Incident Markers */}
                    {visibleIncidents.filtered.map(incident => (
                        incident.latitude && incident.longitude && (
                            <OverlayView
                                key={`incident-${incident.id}`}
                                position={{ lat: parseFloat(incident.latitude), lng: parseFloat(incident.longitude) }}
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                                <div className="incident-marker-container" onClick={() => handleSelectIncident(incident)}>
                                    {incident.status === 'pending' && (
                                        <div className="incident-label-web">🚨 OPEN TICKET</div>
                                    )}
                                    {(incident.status === 'accepted' || incident.status === 'arrived' || incident.status === 'in_progress') && (
                                        <div className="incident-label-web in-progress">🔵 IN PROGRESS</div>
                                    )}
                                    <div className="incident-radar" style={{ borderColor: CATEGORY_CONFIG[incident.categories?.[0]]?.color || '#3b82f6' }}></div>
                                    <div className="incident-marker-dot" style={{ backgroundColor: CATEGORY_CONFIG[incident.categories?.[0]]?.color || '#3b82f6' }}>
                                        {'!'}
                                    </div>
                                </div>
                            </OverlayView>
                        )
                    ))}

                    {/* Responder Markers */}
                    {Object.values(responderLocations).map(loc => {
                        const role = (loc.user?.role || loc.role || '').toLowerCase();
                        const name = loc.user?.name || loc.name || 'UNIT';
                        const shortName = name.split(' ')[0].toUpperCase();

                        let color = '#3b82f6';
                        let icon = '🛡️';

                        if (role === 'user') {
                            color = '#f59e0b';
                            icon = '👤';
                            return (
                                <OverlayView
                                    key={`reporter-${loc.user_id}`}
                                    position={{ lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude) }}
                                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                >
                                    <div className="reporter-marker-container">
                                        <div className="reporter-label-web">REPORTER: {shortName}</div>
                                        <div className="reporter-icon-web">
                                            {icon}
                                        </div>
                                    </div>
                                </OverlayView>
                            );
                        }

                        if (role.includes('police')) { color = '#1e3a5f'; icon = '👮'; }
                        else if (role.includes('fire')) { color = '#dc2626'; icon = '🔥'; }
                        else if (role.includes('ambulance') || role.includes('medical')) { color = '#10b981'; icon = '🚑'; }
                        else if (role === 'admin') { color = '#9333ea'; icon = '⭐'; }

                        return (
                            <OverlayView
                                key={`responder-${loc.user_id}`}
                                position={{ lat: parseFloat(loc.latitude), lng: parseFloat(loc.longitude) }}
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                                <div className="responder-marker-container">
                                    <div className="responder-label-web" style={{ backgroundColor: color }}>
                                        {shortName}
                                    </div>
                                    <div className="responder-icon-web" style={{ backgroundColor: color }}>
                                        {icon}
                                    </div>
                                </div>
                            </OverlayView>
                        );
                    })}
                </GoogleMap>

                {/* Selected Incident Card Overlay */}
                {selectedIncident && (
                    <div className="map-floating-card">
                        <div className="card-top">
                            <div className="card-title-group">
                                <h3>{selectedIncident.title}</h3>
                                <div className="card-info-row">
                                    <MapPin size={14} />
                                    <span>{selectedIncident.address || 'Address not listed'}</span>
                                </div>
                            </div>
                            <button className="card-close-btn" onClick={() => setSelectedIncident(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <p className="card-desc">
                            {selectedIncident.description || 'No additional details provided for this emergency.'}
                        </p>

                        <div className="card-bottom">
                            <div className="card-info-row" style={{ marginBottom: '12px' }}>
                                <Radio size={14} color="#f59e0b" />
                                <span style={{ color: '#f59e0b', fontWeight: '800' }}>
                                    {selectedIncident.status.replace('_', ' ').toUpperCase()}
                                </span>
                            </div>

                            {selectedIncident.ai_analysis && (
                                <div className="ai-map-insight-card">
                                    <div className="ai-insight-header">
                                        <div className="ai-sparkle-mini">✨</div>
                                        <span>AI INTELLIGENCE INSIGHT</span>
                                    </div>
                                    <div className="ai-insight-content">
                                        <div className="ai-insight-row">
                                            <span className="ai-insight-label">Confidence:</span>
                                            <span className="ai-insight-val">
                                                {Math.round((selectedIncident.ai_analysis.confidence || selectedIncident.ai_analysis.authenticity_score) * 100)}%
                                            </span>
                                        </div>
                                        <p className="ai-insight-summary">
                                            {selectedIncident.ai_analysis.summary || selectedIncident.ai_analysis.scene_description}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <button className="card-navigate-btn" onClick={() => navigate(`/incident-details/${selectedIncident.id}`)}>
                                <Navigation size={18} />
                                View Full Intelligence File
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapDashboard;
