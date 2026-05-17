"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Bell,
    X,
    AlertCircle,
    CheckCircle2,
    ShieldAlert,
    Info,
    Clock,
    CheckCheck,
    Trash2,
    Volume2,
    VolumeX,
    Snowflake,
    Droplets,
    Split
} from 'lucide-react';
import { useNotifications, AppNotification } from './NotificationContext';

const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const getNotificationIcon = (notif: AppNotification) => {
    switch (notif.type) {
        case 'NEW_OBSERVATION': return <AlertCircle size={16} className="text-rose-500" />;
        case 'OBSERVATION_CLOSED': return <CheckCircle2 size={16} className="text-emerald-500" />;
        case 'NON_COMPLIANCE': return <ShieldAlert size={16} className="text-amber-500" />;
        case 'COOLING_INITIATED': return <Info size={16} className="text-cyan-500" />;
        case 'COOLING_MONITOR': return <AlertCircle size={16} className="text-orange-500" />;
        case 'COOLING_FINAL': return <ShieldAlert size={16} className="text-red-600" />;
        case 'THAWING_STARTED': return <Snowflake size={16} className="text-blue-500" />;
        case 'THAWING_MONITOR': return <Droplets size={16} className="text-indigo-500" />;
        case 'THAWING_COMPLETED': return <CheckCircle2 size={16} className="text-teal-500" />;
        case 'THAWING_ISSUED': return <Split size={16} className="text-violet-500" />;
        default: return <Info size={16} className="text-blue-500" />;
    }
};

const getNotificationBg = (notif: AppNotification) => {
    if (notif.read) return 'bg-white';
    switch (notif.type) {
        case 'NEW_OBSERVATION': return 'bg-rose-50/60';
        case 'OBSERVATION_CLOSED': return 'bg-emerald-50/60';
        case 'NON_COMPLIANCE': return 'bg-amber-50/60';
        case 'COOLING_INITIATED': return 'bg-cyan-50/60';
        case 'COOLING_MONITOR': return 'bg-orange-50/60';
        case 'COOLING_FINAL': return 'bg-red-50/60';
        case 'THAWING_STARTED': return 'bg-blue-50/60';
        case 'THAWING_MONITOR': return 'bg-indigo-50/60';
        case 'THAWING_COMPLETED': return 'bg-teal-50/60';
        case 'THAWING_ISSUED': return 'bg-violet-50/60';
        default: return 'bg-blue-50/60';
    }
};

const getNotificationBorder = (notif: AppNotification) => {
    if (notif.read) return 'border-slate-100';
    switch (notif.type) {
        case 'NEW_OBSERVATION': return 'border-rose-200/60';
        case 'OBSERVATION_CLOSED': return 'border-emerald-200/60';
        case 'NON_COMPLIANCE': return 'border-amber-200/60';
        case 'COOLING_INITIATED': return 'border-cyan-200/60';
        case 'COOLING_MONITOR': return 'border-orange-200/60';
        case 'COOLING_FINAL': return 'border-red-200/60';
        case 'THAWING_STARTED': return 'border-blue-200/60';
        case 'THAWING_MONITOR': return 'border-indigo-200/60';
        case 'THAWING_COMPLETED': return 'border-teal-200/60';
        case 'THAWING_ISSUED': return 'border-violet-200/60';
        default: return 'border-blue-200/60';
    }
};

const NotificationPanelContent: React.FC<{
    notifications: AppNotification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    onClose: () => void;
    isMobile: boolean;
}> = ({ notifications, unreadCount, markAsRead, markAllAsRead, clearAll, onClose, isMobile }) => {
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

    return (
        <>
            <div
                className={isMobile
                    ? "fixed inset-0 z-[9998] bg-black/30 backdrop-blur-[2px]"
                    : "fixed inset-0 z-[150] bg-transparent"
                }
                onClick={onClose}
            />
            <div
                className={isMobile
                    ? "fixed inset-x-0 top-[80px] bottom-0 z-[9999] bg-white flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300"
                    : "absolute right-0 top-full mt-3 w-[420px] max-h-[70vh] rounded-3xl bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 z-[200]"
                }
            >
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Bell size={16} strokeWidth={3} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Notifications</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="p-2 hover:bg-indigo-50 rounded-xl text-indigo-500 transition-colors"
                                title="Mark all as read"
                            >
                                <CheckCheck size={16} strokeWidth={3} />
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500 transition-colors"
                                title="Clear all"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="px-4 py-2 border-b border-slate-50 flex gap-2 bg-slate-50/50 shrink-0">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        All ({notifications.length})
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'unread' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Unread ({unreadCount})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                <Bell size={24} className="text-slate-300" />
                            </div>
                            <p className="text-sm font-black text-slate-300 uppercase tracking-widest">
                                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                            </p>
                            <p className="text-[10px] text-slate-300 mt-2 max-w-[200px]">
                                Notifications will appear here when observations are created or closed
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {filtered.map(notif => (
                                <button
                                    key={notif.id}
                                    onClick={() => markAsRead(notif.id)}
                                    className={`w-full text-left px-5 py-4 hover:bg-slate-50/80 transition-all ${getNotificationBg(notif)} border-l-4 ${getNotificationBorder(notif)}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${notif.read ? 'bg-slate-100' : notif.type === 'NEW_OBSERVATION' ? 'bg-rose-100' : notif.type === 'OBSERVATION_CLOSED' ? 'bg-emerald-100' : notif.type === 'NON_COMPLIANCE' ? 'bg-amber-100' : notif.type === 'COOLING_INITIATED' ? 'bg-cyan-100' : notif.type === 'COOLING_MONITOR' ? 'bg-orange-100' : notif.type === 'COOLING_FINAL' ? 'bg-red-100' : notif.type === 'THAWING_STARTED' ? 'bg-blue-100' : notif.type === 'THAWING_MONITOR' ? 'bg-indigo-100' : notif.type === 'THAWING_COMPLETED' ? 'bg-teal-100' : notif.type === 'THAWING_ISSUED' ? 'bg-violet-100' : 'bg-blue-100'}`}>
                                            {getNotificationIcon(notif)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <h4 className={`text-xs uppercase tracking-tight truncate ${notif.read ? 'font-bold text-slate-500' : 'font-black text-slate-800'}`}>
                                                    {notif.title}
                                                </h4>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {!notif.read && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />}
                                                    <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                                                        {getTimeAgo(notif.timestamp)}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className={`text-[11px] leading-relaxed line-clamp-2 ${notif.read ? 'text-slate-400' : 'text-slate-600'}`}>
                                                {notif.message}
                                            </p>
                                            {notif.department && (
                                                <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100 text-[9px] font-bold text-slate-500 rounded-md uppercase tracking-wider">
                                                    {notif.department}
                                                </span>
                                            )}
                                            {notif.recipients && notif.recipients.length > 0 && (
                                                <p className="text-[9px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                                                    Sent to: {notif.recipients.slice(0, 3).join(', ')}{notif.recipients.length > 3 ? ` +${notif.recipients.length - 3}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export const NotificationBell: React.FC = () => {
    const { unreadCount, notifications, markAsRead, markAllAsRead, clearAll } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const bellRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (!isOpen || isMobile) return;
        const handler = (e: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, isMobile]);

    const panelContent = isOpen ? (
        <NotificationPanelContent
            notifications={notifications}
            unreadCount={unreadCount}
            markAsRead={markAsRead}
            markAllAsRead={markAllAsRead}
            clearAll={clearAll}
            onClose={() => setIsOpen(false)}
            isMobile={isMobile}
        />
    ) : null;

    return (
        <div className="relative" ref={bellRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 relative group transition-all active:scale-95 touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                <Bell className={`w-5 h-5 transition-colors ${isOpen ? 'text-indigo-600' : 'group-hover:text-indigo-600'}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white ring-4 ring-rose-500/10 animate-in zoom-in">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && isMobile && typeof document !== 'undefined' && createPortal(panelContent, document.body)}
            {isOpen && !isMobile && panelContent}
        </div>
    );
};

export const NotificationToastStack: React.FC = () => {
    const { toastQueue, dismissToast } = useNotifications();

    if (toastQueue.length === 0) return null;

    return (
        <>
            <div className="hidden md:flex fixed top-24 right-4 z-[300] flex-col gap-3 w-[360px] pointer-events-none">
                {toastQueue.slice(0, 3).map((toast, idx) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto bg-white border rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-right duration-300 ${getNotificationBorder(toast)}`}
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className={`p-2 rounded-xl shrink-0 ${toast.type === 'NEW_OBSERVATION' ? 'bg-rose-100' : toast.type === 'OBSERVATION_CLOSED' ? 'bg-emerald-100' : toast.type === 'NON_COMPLIANCE' ? 'bg-amber-100' : toast.type === 'COOLING_INITIATED' ? 'bg-cyan-100' : toast.type === 'COOLING_MONITOR' ? 'bg-orange-100' : toast.type === 'COOLING_FINAL' ? 'bg-red-100' : toast.type === 'THAWING_STARTED' ? 'bg-blue-100' : toast.type === 'THAWING_MONITOR' ? 'bg-indigo-100' : toast.type === 'THAWING_COMPLETED' ? 'bg-teal-100' : toast.type === 'THAWING_ISSUED' ? 'bg-violet-100' : 'bg-blue-100'}`}>
                            {getNotificationIcon(toast)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{toast.title}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{toast.message}</p>
                            {toast.department && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-[8px] font-bold text-slate-500 rounded uppercase tracking-wider">{toast.department}</span>
                            )}
                        </div>
                        <button onClick={() => dismissToast(toast.id)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 shrink-0 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="md:hidden fixed bottom-20 left-3 right-3 z-[300] flex flex-col gap-2 pointer-events-none">
                {toastQueue.slice(0, 2).map((toast, idx) => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto bg-white border rounded-2xl shadow-2xl p-3 flex items-start gap-3 animate-in slide-in-from-bottom duration-300 ${getNotificationBorder(toast)}`}
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className={`p-1.5 rounded-lg shrink-0 ${toast.type === 'NEW_OBSERVATION' ? 'bg-rose-100' : toast.type === 'OBSERVATION_CLOSED' ? 'bg-emerald-100' : toast.type === 'NON_COMPLIANCE' ? 'bg-amber-100' : toast.type === 'COOLING_INITIATED' ? 'bg-cyan-100' : toast.type === 'COOLING_MONITOR' ? 'bg-orange-100' : toast.type === 'COOLING_FINAL' ? 'bg-red-100' : toast.type === 'THAWING_STARTED' ? 'bg-blue-100' : toast.type === 'THAWING_MONITOR' ? 'bg-indigo-100' : toast.type === 'THAWING_COMPLETED' ? 'bg-teal-100' : toast.type === 'THAWING_ISSUED' ? 'bg-violet-100' : 'bg-blue-100'}`}>
                            {getNotificationIcon(toast)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate">{toast.title}</h4>
                            <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{toast.message}</p>
                            {toast.department && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 text-[8px] font-bold text-slate-500 rounded uppercase">{toast.department}</span>
                            )}
                        </div>
                        <button onClick={() => dismissToast(toast.id)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 shrink-0 transition-colors">
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </>
    );
};

export default NotificationBell;
