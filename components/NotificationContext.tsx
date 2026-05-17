"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface AppNotification {
    id: string;
    type: 'NEW_OBSERVATION' | 'OBSERVATION_CLOSED' | 'NON_COMPLIANCE' | 'SYSTEM' | 'COOLING_INITIATED' | 'COOLING_MONITOR' | 'COOLING_FINAL' | 'THAWING_STARTED' | 'THAWING_MONITOR' | 'THAWING_COMPLETED' | 'THAWING_ISSUED' | 'AUDIT_PUBLISHED';
    title: string;
    message: string;
    observationId?: string;
    department?: string;
    timestamp: Date;
    read: boolean;
    icon?: 'alert' | 'check' | 'shield' | 'info';
    severity?: 'info' | 'warning' | 'critical';
    recipients?: string[];
    senderName?: string;
}

interface NotificationContextType {
    notifications: AppNotification[];
    unreadCount: number;
    addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    toastQueue: AppNotification[];
    dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
    return ctx;
};

const requestNotificationPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
};

const sendSWNotification = async (title: string, body: string, data?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            if (registration.active) {
                registration.active.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title,
                    body,
                    tag: `haccp-${Date.now()}`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/1162/1162961.png',
                    data: data || {},
                });
                return;
            }
        }
    } catch {
        // fallback below
    }

    try {
        const n = new Notification(title, {
            body,
            icon: 'https://cdn-icons-png.flaticon.com/512/1162/1162961.png',
            tag: `haccp-${Date.now()}`,
        });
        setTimeout(() => n.close(), 8000);
    } catch {
        // silent
    }
};

const playNotificationSound = () => {
    if (typeof window === 'undefined') return;
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(1108, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.4);
    } catch {
        // silent
    }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [toastQueue, setToastQueue] = useState<AppNotification[]>([]);
    const permissionRequested = useRef(false);

    useEffect(() => {
        if (!permissionRequested.current) {
            permissionRequested.current = true;
            requestNotificationPermission();
        }
    }, []);

    const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const fullNotif: AppNotification = {
            ...notif,
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: new Date(),
            read: false,
        };

        setNotifications(prev => [fullNotif, ...prev].slice(0, 100));
        setToastQueue(prev => [...prev, fullNotif]);
        playNotificationSound();
        sendSWNotification(fullNotif.title, fullNotif.message, {
            type: fullNotif.type,
            observationId: fullNotif.observationId,
            department: fullNotif.department,
        });

        setTimeout(() => {
            setToastQueue(prev => prev.filter(t => t.id !== fullNotif.id));
        }, 6000);
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToastQueue(prev => prev.filter(t => t.id !== id));
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll, toastQueue, dismissToast }}>
            {children}
        </NotificationContext.Provider>
    );
};
