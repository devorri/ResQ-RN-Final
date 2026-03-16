
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { CATEGORY_CONFIG, STATUS_CONFIG } from './constants/category';
import { COLORS } from './constants/colors';
import './IncidentDetails.css';

const IncidentDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [incident, setIncident] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeMediaIndex, setActiveMediaIndex] = useState(0);

    // Assign responder state
    const [showAssignSection, setShowAssignSection] = useState(false);
    const [availableResponders, setAvailableResponders] = useState([]);
    const [selectedResponder, setSelectedResponder] = useState(null);
    const [fetchingResponders, setFetchingResponders] = useState(false);
    const [assignSuccess, setAssignSuccess] = useState(false);

    useEffect(() => {
        fetchIncidentDetails();

        const subscription = supabase
            .channel(`incident_${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `id=eq.${id}` }, () => {
                fetchIncidentDetails();
            })
            .subscribe();

        return () => supabase.removeChannel(subscription);
    }, [id]);

    const fetchIncidentDetails = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('incidents')
                .select(`
                    *,
                    user:profiles!incidents_user_id_fkey(id, name, phone, email),
                    responder:profiles!incidents_responder_id_fkey(id, name, role),
                    timeline:incident_updates(*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            if (data.timeline) {
                data.timeline.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }

            setIncident(data);
        } catch (error) {
            console.error('Error fetching incident:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (nextStatus, message) => {
        try {
            if (nextStatus === 'completed' && !window.confirm('Confirm mission resolution?')) return;

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

            fetchIncidentDetails();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Update failed');
        }
    };

    // Fetch available responders for inline assign
    const fetchResponders = async () => {
        try {
            setFetchingResponders(true);
            const mainCategories = ['police', 'fire', 'ambulance'];
            const serviceType = (incident?.categories?.find(cat =>
                mainCategories.includes(cat.toLowerCase())
            ))?.toLowerCase() || 'police';

            let roles = [];
            switch (serviceType) {
                case 'police': roles = ['police_responder']; break;
                case 'fire': roles = ['firefighter']; break;
                case 'ambulance': roles = ['ambulance_responder']; break;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('role', roles)
                .order('name');

            if (error) throw error;
            setAvailableResponders(data || []);
        } catch (error) {
            console.error('Error fetching responders:', error);
        } finally {
            setFetchingResponders(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedResponder) {
            alert('Please select a responder');
            return;
        }

        try {
            const responderData = availableResponders.find(r => r.id === selectedResponder);

            const { error: incidentError } = await supabase
                .from('incidents')
                .update({
                    responder_id: selectedResponder,
                    station_id: user?.station_id,
                    status: 'accepted',
                    accepted_at: new Date().toISOString()
                })
                .eq('id', id);

            if (incidentError) throw incidentError;

            const { error: responderError } = await supabase
                .from('profiles')
                .update({
                    status: 'busy',
                    current_incident_id: parseInt(id)
                })
                .eq('id', selectedResponder);

            if (responderError) throw responderError;

            await supabase.from('incident_updates').insert({
                incident_id: parseInt(id),
                status: 'accepted',
                message: `Assigned to ${responderData?.name || 'responder'}`,
                user_id: user?.id,
                created_at: new Date().toISOString()
            });

            setAssignSuccess(true);
            setShowAssignSection(false);
            setSelectedResponder(null);

            // Auto-dismiss success after 4 seconds
            setTimeout(() => setAssignSuccess(false), 4000);

            fetchIncidentDetails();
        } catch (error) {
            console.error('Error assigning responder:', error);
            alert('Failed to assign responder. Please try again.');
        }
    };

    const toggleAssignSection = () => {
        if (!showAssignSection) {
            fetchResponders();
        }
        setShowAssignSection(!showAssignSection);
    };

    const getAvailabilityStatus = (responder) => {
        const isBusy = responder.status === 'busy' || responder.current_incident_id !== null;
        if (isBusy) return { text: 'BUSY', color: COLORS.status.error, bgColor: COLORS.status.errorBg };
        return { text: 'AVAILABLE', color: COLORS.status.success, bgColor: COLORS.status.successBg };
    };

    const getRoleDisplay = (role) => {
        switch (role) {
            case 'police_responder': return 'Police Officer';
            case 'firefighter': return 'Firefighter';
            case 'ambulance_responder': return 'Paramedic';
            default: return role?.replace('_', ' ').toUpperCase();
        }
    };

    if (loading && !incident) return <div className="loading-overlay">⏳ Loading report details...</div>;
    if (!incident) return <div className="error-container">Incident not found</div>;

    const mediaUrls = incident.image_url ? incident.image_url.split(',') : [];
    if (incident.video_url) mediaUrls.push(incident.video_url);

    const isResponder = incident.responder_id === user?.id;
    const isStationAdmin = ['admin', 'police_station', 'fire_station', 'ambulance_station'].includes(user?.role);
    const primaryCategory = incident.categories?.find(cat => ['police', 'fire', 'ambulance'].includes(cat)) || 'police';
    const catConfig = CATEGORY_CONFIG[primaryCategory];

    return (
        <div className="incident-details-container">
            <div className="details-gradient-bg">
                <div className="details-content-wrapper">

                    {/* Header Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                        <button className="back-btn" onClick={() => navigate('/dashboard')}>⬅️</button>
                        <h1 className="active-reports-page-title">Report Information</h1>
                    </div>

                    {/* Success Banner */}
                    {assignSuccess && (
                        <div className="assign-success-banner">
                            <span>✅</span>
                            <span>Responder has been successfully assigned to this incident!</span>
                        </div>
                    )}

                    {/* Media Carousel */}
                    <div className="media-section-web">
                        {mediaUrls.length > 0 ? (
                            <>
                                {mediaUrls[activeMediaIndex].includes('mp4') || mediaUrls[activeMediaIndex].includes('video') ? (
                                    <video
                                        src={mediaUrls[activeMediaIndex]}
                                        className="main-media-web"
                                        controls
                                        autoPlay
                                        muted
                                    />
                                ) : (
                                    <img
                                        src={mediaUrls[activeMediaIndex]}
                                        className="main-media-web"
                                        alt="Incident Evidence"
                                    />
                                )}

                                {mediaUrls.length > 1 && (
                                    <>
                                        <button
                                            className="media-nav-btn prev-btn"
                                            onClick={() => setActiveMediaIndex(prev => prev === 0 ? mediaUrls.length - 1 : prev - 1)}
                                        >
                                            ◀️
                                        </button>
                                        <button
                                            className="media-nav-btn next-btn"
                                            onClick={() => setActiveMediaIndex(prev => prev === mediaUrls.length - 1 ? 0 : prev + 1)}
                                        >
                                            ▶️
                                        </button>
                                        <div className="media-counter-web">{activeMediaIndex + 1} / {mediaUrls.length}</div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="no-media-web" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                                📷 No visual evidence provided
                            </div>
                        )}

                        {mediaUrls.length > 1 && (
                            <div className="thumbnail-strip-web">
                                {mediaUrls.map((url, idx) => (
                                    <div
                                        key={idx}
                                        className={`thumb-wrapper-web ${activeMediaIndex === idx ? 'active' : ''}`}
                                        onClick={() => setActiveMediaIndex(idx)}
                                    >
                                        {url.includes('mp4') ? (
                                            <div className="thumb-img-web" style={{ background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎬</div>
                                        ) : (
                                            <img src={url} className="thumb-img-web" alt="Thumbnail" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Basic Info */}
                    <div className="details-section-web">
                        <div className="section-head-web">
                            <span className="section-icon-web">🚨</span>
                            <h2 className="section-title-web">Emergency Overview</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <span className="cat-pill-web" style={{ background: catConfig?.color }}>{catConfig?.label}</span>
                            <span className="status-pill-web" style={{
                                background: STATUS_CONFIG[incident.status]?.bgColor,
                                color: STATUS_CONFIG[incident.status]?.color
                            }}>
                                {STATUS_CONFIG[incident.status]?.label}
                            </span>
                        </div>
                        <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 10px 0' }}>{incident.title}</h3>
                        <p style={{ color: '#4B5563', lineHeight: '1.6', fontSize: '16px' }}>{incident.description}</p>
                    </div>

                    {/* AI Scene Analysis */}
                    {incident.ai_analysis && primaryCategory === 'fire' && (
                        <div className="details-section-web" style={{ border: '2px solid #D4AF37' }}>
                            <div className="section-head-web">
                                <span className="section-icon-web">✨</span>
                                <h2 className="section-title-web">AI Scene Analysis</h2>
                            </div>
                            <div className="ai-analysis-card-web">
                                <div className="ai-sparkle-icon">🪄</div>
                                <div className="ai-info-web">
                                    <div className="ai-row-web">
                                        <span className="ai-label-web">Fire Classification</span>
                                        <span className="ai-val-web">{incident.ai_analysis.fire_class || 'Pending Analysis...'}</span>
                                    </div>
                                    <div className="ai-row-web">
                                        <span className="ai-label-web">Intelligence Summary</span>
                                        <span className="ai-val-web">{incident.ai_analysis.scene_description || incident.ai_analysis.summary}</span>
                                    </div>
                                    <div className="ai-row-web">
                                        <span className="ai-label-web">AI Confidence</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="ai-val-web" style={{ fontWeight: 800, color: '#059669' }}>
                                                {Math.round((incident.ai_analysis.confidence || incident.ai_analysis.authenticity_score) * 100)}% Reliable
                                            </span>
                                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>(Deep Learning Evaluation)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="ai-disclaimer-web">
                                <strong>DISCLAIMER:</strong> AI results are generated via neural processing and are for intelligence support only. Manual verification by on-site responders is mandatory.
                            </div>
                        </div>
                    )}

                    {/* Location & Reporter */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="details-section-web">
                            <div className="section-head-web">
                                <span className="section-icon-web">📍</span>
                                <h2 className="section-title-web">Location</h2>
                            </div>
                            <p style={{ fontWeight: '700', margin: '0' }}>{incident.address || 'Address not available'}</p>
                            <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '5px' }}>
                                {incident.latitude ? `${parseFloat(incident.latitude).toFixed(4)}, ${parseFloat(incident.longitude).toFixed(4)}` : 'Coordinates not available'}
                            </p>
                            <button className="clear-all-btn" style={{ marginTop: '10px' }} onClick={() => navigate(`/map?trackingIncidentId=${incident.id}`)}>View on Map ➡️</button>
                        </div>
                        <div className="details-section-web">
                            <div className="section-head-web">
                                <span className="section-icon-web">👤</span>
                                <h2 className="section-title-web">Reporter Info</h2>
                            </div>
                            <p style={{ fontWeight: '700', margin: '0' }}>{incident.user?.name || 'Anonymous'}</p>
                            <p style={{ color: '#4B5563', fontSize: '14px', margin: '6px 0 0 0' }}>📞 {incident.user?.phone || 'N/A'}</p>
                            <p style={{ color: '#4B5563', fontSize: '14px', margin: '4px 0 0 0' }}>✉️ {incident.user?.email || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Assigned Responder */}
                    {incident.responder && (
                        <div className="details-section-web" style={{ borderLeft: '5px solid #10B981' }}>
                            <div className="section-head-web">
                                <span className="section-icon-web">🛡️</span>
                                <h2 className="section-title-web">Assigned Responder</h2>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ fontSize: '30px' }}>👮</div>
                                    <div>
                                        <p style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>{incident.responder.name}</p>
                                        <p style={{ color: '#6B7280', fontSize: '13px', textTransform: 'uppercase', margin: 0 }}>{incident.responder.role.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <button className="clear-all-btn" onClick={() => navigate(`/map?trackingIncidentId=${incident.id}`)}>
                                    🗺️ Track Responder
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Inline Assign Responder (for station admins on pending incidents) */}
                    {isStationAdmin && incident.status === 'pending' && !incident.responder_id && (
                        <div className="details-section-web" style={{ borderLeft: '5px solid #3B82F6' }}>
                            <div className="section-head-web" style={{ cursor: 'pointer' }} onClick={toggleAssignSection}>
                                <span className="section-icon-web">👤➕</span>
                                <h2 className="section-title-web">Assign a Responder</h2>
                                <span style={{ marginLeft: 'auto', fontSize: '18px' }}>{showAssignSection ? '▲' : '▼'}</span>
                            </div>

                            {showAssignSection && (
                                <div className="inline-assign-section">
                                    {fetchingResponders ? (
                                        <p style={{ textAlign: 'center', color: '#666' }}>⏳ Loading available responders...</p>
                                    ) : availableResponders.length === 0 ? (
                                        <p style={{ textAlign: 'center', color: '#666' }}>No responders available for this service type</p>
                                    ) : (
                                        <>
                                            <div className="inline-responders-grid">
                                                {availableResponders.map(r => {
                                                    const availability = getAvailabilityStatus(r);
                                                    const isBusy = availability.text === 'BUSY';
                                                    return (
                                                        <div
                                                            key={r.id}
                                                            className={`inline-responder-card ${selectedResponder === r.id ? 'selected' : ''} ${isBusy ? 'busy' : ''}`}
                                                            onClick={() => !isBusy && setSelectedResponder(r.id)}
                                                        >
                                                            <div className="inline-responder-info">
                                                                <span className="inline-responder-name">
                                                                    {r.name} {isBusy && '🔒'}
                                                                </span>
                                                                <span className="inline-responder-role">{getRoleDisplay(r.role)}</span>
                                                            </div>
                                                            <span
                                                                className="inline-responder-status"
                                                                style={{ backgroundColor: availability.bgColor, color: availability.color }}
                                                            >
                                                                {availability.text}
                                                            </span>
                                                            {selectedResponder === r.id && <span style={{ fontSize: '18px' }}>✅</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <button
                                                className="inline-assign-btn"
                                                disabled={!selectedResponder}
                                                onClick={handleAssign}
                                            >
                                                👤➕ Assign Selected Responder
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="details-section-web">
                        <div className="section-head-web">
                            <span className="section-icon-web">⏱️</span>
                            <h2 className="section-title-web">Mission Timeline</h2>
                        </div>
                        <div className="timeline-web">
                            {incident.timeline?.map((update, idx) => {
                                const status = STATUS_CONFIG[update.status] || STATUS_CONFIG.pending;
                                return (
                                    <div key={idx} className="timeline-item-web">
                                        <div className="timeline-marker-web">
                                            <div className="marker-dot-web" style={{ background: status.color }}>
                                                {idx + 1}
                                            </div>
                                            <div className="marker-line-web" />
                                        </div>
                                        <div className="timeline-body-web">
                                            <div className="timeline-header-web">
                                                <span className="timeline-status-text" style={{ color: status.color }}>{status.label.toUpperCase()}</span>
                                                <span className="timeline-time-text">{new Date(update.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="timeline-msg-text">{update.message}</p>
                                            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{new Date(update.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

            {/* Action Footer */}
            {isResponder && (
                <div className="details-footer-web">
                    <div className="footer-content-web">
                        <div className="mission-banner-web">
                            <div className="mission-indicator">
                                <div className="status-dot-web" style={{ background: STATUS_CONFIG[incident.status]?.color || '#F59E0B' }} />
                                <span className="mission-title-text">MISSION: {STATUS_CONFIG[incident.status]?.label.toUpperCase()}</span>
                            </div>
                            <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: '600' }}>Update Mission Status ⬇️</span>
                        </div>

                        {incident.status === 'pending' && (
                            <>
                                <button className="premium-action-btn btn-accept" onClick={() => handleStatusUpdate('accepted', 'Responder accepted the mission.')}>
                                    ✅ Accept Mission
                                </button>
                                <button className="btn-decline" onClick={() => handleStatusUpdate('cancelled', 'Mission declined by responder.')}>Decline Mission</button>
                            </>
                        )}
                        {incident.status === 'accepted' && (
                            <button className="premium-action-btn btn-start" onClick={() => handleStatusUpdate('in_progress', 'Navigation to scene started.')}>
                                ▶️ Start Navigation
                            </button>
                        )}
                        {incident.status === 'in_progress' && (
                            <button className="premium-action-btn btn-arrive" onClick={() => handleStatusUpdate('arrived', 'Responder has arrived on-site.')}>
                                📍 Mark as Arrived
                            </button>
                        )}
                        {incident.status === 'arrived' && (
                            <button className="premium-action-btn btn-complete" onClick={() => handleStatusUpdate('completed', 'Emergency situation resolved.')}>
                                🏁 Complete Mission
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncidentDetails;
