// src/IncidentDetails.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { CATEGORY_CONFIG, STATUS_CONFIG } from './constants/category';
import './IncidentDetails.css';

const IncidentDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [incident, setIncident] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeMediaIndex, setActiveMediaIndex] = useState(0);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [availableResponders, setAvailableResponders] = useState([]);
    const [fetchingResponders, setFetchingResponders] = useState(false);

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

            // Sort timeline by date
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

    if (loading && !incident) return <div className="loading-overlay">⏳ Loading mission details...</div>;
    if (!incident) return <div className="error-container">Incident not found</div>;

    const mediaUrls = incident.image_url ? incident.image_url.split(',') : [];
    if (incident.video_url) mediaUrls.push(incident.video_url);

    const isResponder = incident.responder_id === user?.id;
    const primaryCategory = incident.categories?.find(cat => ['police', 'fire', 'ambulance'].includes(cat)) || 'police';
    const catConfig = CATEGORY_CONFIG[primaryCategory];

    return (
        <div className="incident-details-container">
            <div className="details-gradient-bg">
                <div className="details-content-wrapper">

                    {/* Header Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                        <button className="back-btn" onClick={() => navigate(-1)}>⬅️</button>
                        <h1 className="active-reports-page-title">Mission Intel</h1>
                    </div>

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
                                        <span className="ai-label-web">AI Confidence Intelligence</span>
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
                            <p style={{ fontWeight: '700', margin: '0' }}>{incident.address}</p>
                            <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '5px' }}>{incident.location?.latitude.toFixed(4)}, {incident.location?.longitude.toFixed(4)}</p>
                            <button className="clear-all-btn" style={{ marginTop: '10px' }} onClick={() => navigate(`/map?trackingIncidentId=${incident.id}`)}>View on Map ➡️</button>
                        </div>
                        <div className="details-section-web">
                            <div className="section-head-web">
                                <span className="section-icon-web">👤</span>
                                <h2 className="section-title-web">Reporter Info</h2>
                            </div>
                            <p style={{ fontWeight: '700', margin: '0' }}>{incident.user?.name || 'Anonymous'}</p>
                            <p style={{ color: '#4B5563', fontSize: '14px' }}>📞 {incident.user?.phone || 'N/A'}</p>
                            <p style={{ color: '#4B5563', fontSize: '14px' }}>✉️ {incident.user?.email || 'N/A'}</p>
                        </div>
                    </div>

                    {/* assigned Responder */}
                    {incident.responder && (
                        <div className="details-section-web" style={{ borderLeft: '5px solid #10B981' }}>
                            <div className="section-head-web">
                                <span className="section-icon-web">🛡️</span>
                                <h2 className="section-title-web">Assigned Responder</h2>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontSize: '30px' }}>👮</div>
                                <div>
                                    <p style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>{incident.responder.name}</p>
                                    <p style={{ color: '#6B7280', fontSize: '13px', textTransform: 'uppercase', margin: 0 }}>{incident.responder.role.replace('_', ' ')}</p>
                                </div>
                            </div>
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
