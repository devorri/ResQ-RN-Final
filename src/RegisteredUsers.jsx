
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { COLORS } from './constants/colors';
import './RegisteredUsers.css';

const RegisteredUsers = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    const fetchUsers = useCallback(async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, email, phone, selfie_url, id_photo_url, id_status, avatar_url, created_at')
                .eq('role', 'user')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching registered users:', error);
            alert('Failed to load registered users');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const filteredUsers = users.filter(u => {
        const q = searchQuery.toLowerCase();
        return (
            (u.name?.toLowerCase().includes(q) ?? false) ||
            u.email.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q)
        );
    });

    const getStatusConfig = (status) => {
        switch (status) {
            case 'approved':
                return { label: 'Verified', color: COLORS.status?.success || '#10b981', bg: '#ecfdf5' };
            case 'pending':
                return { label: 'Pending', color: COLORS.status?.warning || '#f59e0b', bg: '#fffbeb' };
            case 'rejected':
                return { label: 'Rejected', color: COLORS.status?.error || '#ef4444', bg: '#fef2f2' };
            default:
                return { label: 'Not Submitted', color: '#6b7280', bg: '#f3f4f6' };
        }
    };

    const openUserDetail = (user) => {
        setSelectedUser(user);
        setModalVisible(true);
    };

    return (
        <div className="registered-users-container">
            <div className="gradient-bg">
                <div className="content-wrapper">
                    {/* Header */}
                    <div className="header">
                        <div className="header-left">
                            <button className="back-btn" onClick={() => navigate(-1)}>
                                ⬅️
                            </button>
                            <h1 className="page-title">Registered Citizens</h1>
                        </div>
                        <div className="count-badge">
                            {filteredUsers.length} Users
                        </div>
                    </div>

                    {/* Search */}
                    <div className="search-bar">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by name, email, or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Grid */}
                    <div className="users-grid">
                        {isLoading && users.length === 0 ? (
                            <div className="loading-placeholder">Loading users...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="empty-placeholder">No users found</div>
                        ) : (
                            filteredUsers.map(user => {
                                const statusCfg = getStatusConfig(user.id_status);
                                const displayImage = user.selfie_url || user.avatar_url;

                                return (
                                    <div key={user.id} className="user-card-web" onClick={() => openUserDetail(user)}>
                                        <div className="card-top">
                                            {displayImage ? (
                                                <img src={displayImage} alt={user.name} className="user-thumb" />
                                            ) : (
                                                <div className="user-thumb-placeholder">👤</div>
                                            )}
                                            <div className="card-info">
                                                <h3 className="user-name">{user.name || 'Unnamed User'}</h3>
                                                <p className="user-email">{user.email}</p>
                                                <p className="user-id">ID: {user.id.substring(0, 8)}...</p>
                                            </div>
                                        </div>
                                        <div className="card-bottom">
                                            <span className="status-badge" style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}>
                                                {statusCfg.label}
                                            </span>
                                            <button className="view-btn">Details →</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Modal */}
                    {modalVisible && selectedUser && (
                        <div className="modal-overlay" onClick={() => setModalVisible(false)}>
                            <div className="modal-content" onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>User Details</h2>
                                    <button className="close-btn" onClick={() => setModalVisible(false)}>✖</button>
                                </div>
                                <div className="modal-body">
                                    <div className="user-profile-section">
                                        <div className="selfie-container">
                                            {(selectedUser.selfie_url || selectedUser.avatar_url) ? (
                                                <img src={selectedUser.selfie_url || selectedUser.avatar_url} alt="Profile" className="large-selfie" />
                                            ) : (
                                                <div className="large-selfie-placeholder">👤</div>
                                            )}
                                        </div>
                                        <div className="user-details-list">
                                            <DetailItem label="Full Name" value={selectedUser.name || 'N/A'} />
                                            <DetailItem label="Email" value={selectedUser.email} />
                                            <DetailItem label="Phone" value={selectedUser.phone || 'N/A'} />
                                            <DetailItem label="User ID" value={selectedUser.id} />
                                            <DetailItem label="Joined" value={new Date(selectedUser.created_at).toLocaleDateString()} />
                                            <div className="detail-item">
                                                <span className="detail-label">Verification Status</span>
                                                <span className="status-badge-large" style={{ 
                                                    color: getStatusConfig(selectedUser.id_status).color, 
                                                    backgroundColor: getStatusConfig(selectedUser.id_status).bg 
                                                }}>
                                                    {getStatusConfig(selectedUser.id_status).label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedUser.id_photo_url && (
                                        <div className="id-photo-section">
                                            <h3>Government ID Photo</h3>
                                            <div className="id-photo-container">
                                                <img src={selectedUser.id_photo_url} alt="ID Document" className="id-photo-image" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DetailItem = ({ label, value }) => (
    <div className="detail-item">
        <span className="detail-label">{label}</span>
        <span className="detail-value">{value}</span>
    </div>
);

export default RegisteredUsers;
