// src/constants/category.js

export const CATEGORY_CONFIG = {
    police: { label: 'Police', color: '#1e3a5f', icon: '👮' },
    fire: { label: 'Fire', color: '#dc2626', icon: '🔥' },
    ambulance: { label: 'Ambulance', color: '#10b981', icon: '🚑' },
    medical: { label: 'Medical', color: '#10b981', icon: '🩺' },
    traffic: { label: 'Traffic', color: '#f59e0b', icon: '🚗' },
    other: { label: 'Other', color: '#6b7280', icon: '❓' }
};

export const STATUS_CONFIG = {
    pending: { label: 'Pending', color: '#f59e0b', bgColor: '#fef3c7' },
    accepted: { label: 'Accepted', color: '#2563eb', bgColor: '#dbeafe' },
    arrived: { label: 'Arrived', color: '#8b5cf6', bgColor: '#ede9fe' },
    in_progress: { label: 'In Progress', color: '#3b82f6', bgColor: '#eff6ff' },
    completed: { label: 'Completed', color: '#10b981', bgColor: '#d1fae5' },
    cancelled: { label: 'Cancelled', color: '#dc2626', bgColor: '#fee2e2' }
};
