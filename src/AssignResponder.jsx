
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { COLORS } from './constants/colors';
import './AssignResponder.css';

const AssignResponder = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const incidentId = searchParams.get('incidentId');
    const { user } = useAuth();

    const [responders, setResponders] = useState([]);
    const [selectedResponder, setSelectedResponder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [incidentInfo, setIncidentInfo] = useState(null);

    useEffect(() => {
        if (incidentId) {
            loadData();
        }
    }, [incidentId]);

    const loadData = async () => {
        try {
            setIsLoading(true);

            
            const { data: incidentData, error: incidentError } = await supabase
                .from('incidents')
                .select(`
                    *,
                    user:profiles!incidents_user_id_fkey(id, name, phone)
                `)
                .eq('id', incidentId)
                .single();

            if (incidentError) {
                console.error('Incident load error:', incidentError);
                throw incidentError;
            }

            setIncidentInfo(incidentData);

            
            const mainCategories = ['police', 'fire', 'ambulance'];
            const serviceType = (incidentData?.categories?.find(cat =>
                mainCategories.includes(cat.toLowerCase())
            ))?.toLowerCase() || 'police';

            console.log(`🔍 Fetching responders for service: ${serviceType}`);

            
            const { data: respondersData, error: respondersError } = await supabase
                .from('profiles')
                .select('*')
                .in('role', getResponderRoles(serviceType))
                .order('name');

            if (respondersError) {
                console.error('Responders load error:', respondersError);
                throw respondersError;
            }

            console.log(`✅ Found ${respondersData?.length || 0} responders`);
            setResponders(respondersData || []);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Failed to load data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getResponderRoles = (serviceType) => {
        switch (serviceType) {
            case 'police': return ['police_responder'];
            case 'fire': return ['firefighter'];
            case 'ambulance': return ['ambulance_responder'];
            default: return [];
        }
    };

    const handleAssign = async () => {
        if (!selectedResponder) {
            alert('Please select a responder');
            return;
        }

        try {
            setIsLoading(true);
            const selectedResponderData = responders.find(r => r.id === selectedResponder);

            
            const { error: incidentError } = await supabase
                .from('incidents')
                .update({
                    responder_id: selectedResponder,
                    station_id: user?.station_id,  
                    status: 'accepted',
                    accepted_at: new Date().toISOString()
                })
                .eq('id', incidentId);

            if (incidentError) {
                console.error('Incident update error:', incidentError);
                throw incidentError;
            }

            
            const { error: responderError } = await supabase
                .from('profiles')
                .update({
                    status: 'busy',
                    current_incident_id: parseInt(incidentId)
                })
                .eq('id', selectedResponder);

            if (responderError) {
                console.error('Responder update error:', responderError);
                throw responderError;
            }

            
            const { error: timelineError } = await supabase
                .from('incident_updates')
                .insert({
                    incident_id: parseInt(incidentId),
                    status: 'accepted',
                    message: `Assigned to ${selectedResponderData?.name || 'responder'}`,
                    user_id: user?.id,
                    created_at: new Date().toISOString()
                });

            if (timelineError) {
                console.error('Timeline error:', timelineError);
                throw timelineError;
            }

            alert(`Incident successfully assigned to ${selectedResponderData?.name}`);
            navigate(`/map?trackingIncidentId=${incidentId}`);
        } catch (error) {
            console.error('Error assigning responder:', error);
            alert('Failed to assign responder. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getRoleDisplay = (role) => {
        switch (role) {
            case 'police_responder': return 'Police Officer';
            case 'firefighter': return 'Firefighter';
            case 'ambulance_responder': return 'Paramedic';
            default: return role.replace('_', ' ').toUpperCase();
        }
    };

    const getAvailabilityStatus = (responder) => {
        const isBusy = responder.status === 'busy' || responder.current_incident_id !== null;
        if (isBusy) {
            return { text: 'BUSY', color: COLORS.status.error, bgColor: COLORS.status.errorBg, icon: '🔒' };
        }
        return { text: 'AVAILABLE', color: COLORS.status.success, bgColor: COLORS.status.successBg, icon: '✅' };
    };

    return (
        <div className="assign-responder-container">
            <div className="assign-responder-gradient-bg">
                <div className="assign-responder-content-wrapper">

                    {/* Header */}
                    <div className="assign-responder-header">
                        <button className="back-btn" onClick={() => navigate(-1)}>
                            ⬅️
                        </button>
                        <h1 className="page-title">Assign Responder</h1>
                    </div>

                    {/* Incident Info */}
                    {incidentInfo && (
                        <div className="incident-info-box">
                            <h2 className="incident-title-web">{incidentInfo.title}</h2>
                            <p className="incident-desc-web">{incidentInfo.description}</p>
                            <div className="incident-meta-web">
                                <div className="meta-item-web">
                                    <span>📍</span> {incidentInfo.address || 'N/A'}
                                </div>
                                <div className="meta-item-web">
                                    <span>⏰</span> {new Date(incidentInfo.created_at).toLocaleString()}
                                </div>
                                <div className="meta-item-web">
                                    <span>👤</span> {incidentInfo.user?.name || 'Unknown'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Available Responders */}
                    <div className="responders-section">
                        <div className="section-titles-web">
                            <h2 className="section-title-web">Available Field Units</h2>
                            <p className="section-subtitle-web">Select a responder to deploy to this emergency</p>
                        </div>

                        {isLoading && responders.length === 0 ? (
                            <div className="state-container-web">
                                <span className="state-icon-web">⏳</span>
                                <span className="state-title-web">Searching for available units...</span>
                            </div>
                        ) : responders.length === 0 ? (
                            <div className="state-container-web">
                                <span className="state-icon-web">🚫</span>
                                <span className="state-title-web">No Responders Available</span>
                                <span className="state-subtitle-web">All units are currently busy or offline.</span>
                                <button className="retry-btn-web" onClick={loadData}>Retry Refresh</button>
                            </div>
                        ) : (
                            <div className="responders-grid-web">
                                {responders.map(r => {
                                    const availability = getAvailabilityStatus(r);
                                    const isBusy = availability.text === 'BUSY';

                                    return (
                                        <div
                                            key={r.id}
                                            className={`responder-card-web ${selectedResponder === r.id ? 'selected' : ''} ${isBusy ? 'busy' : ''}`}
                                            onClick={() => !isBusy && setSelectedResponder(r.id)}
                                        >
                                            <div className="responder-main-web">
                                                <div className="responder-avatar-circle">
                                                    👤
                                                </div>
                                                <div className="responder-text-web">
                                                    <span className="responder-name-web">
                                                        {r.name}
                                                        {isBusy && <span className="busy-lock"> {availability.icon}</span>}
                                                    </span>
                                                    <span className="responder-role-web">{getRoleDisplay(r.role)}</span>
                                                    <span
                                                        className="responder-status-pill"
                                                        style={{ backgroundColor: availability.bgColor, color: availability.color }}
                                                    >
                                                        {availability.text}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="responder-side-web">
                                                {selectedResponder === r.id && <span style={{ fontSize: '20px' }}>✅</span>}
                                                {isBusy && <span style={{ fontSize: '18px', opacity: 0.5 }}>🔒</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer / Assign Button */}
                    <div className="assign-footer-web">
                        <button
                            className="assign-action-btn-web"
                            disabled={!selectedResponder || isLoading}
                            onClick={handleAssign}
                        >
                            <span>👤➕</span> {isLoading ? 'Assigning...' : 'Assign Responder Now'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AssignResponder;
