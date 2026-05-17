"use client";

import React, { useEffect, useState, useCallback } from 'react';
import WhatsAppObservationConfirm, { type ConfirmObservationSummary } from './WhatsAppObservationConfirm';

export type WhatsAppConfirmEventDetail = {
  observations: ConfirmObservationSummary[];
  unitName?: string;
  auditorName?: string;
};

export const WHATSAPP_CONFIRM_EVENT = 'haccp:wa-confirm-observations';

export const requestWhatsAppObservationConfirm = (detail: WhatsAppConfirmEventDetail) => {
  if (typeof window === 'undefined') return;
  if (!detail || !Array.isArray(detail.observations) || detail.observations.length === 0) return;
  window.dispatchEvent(new CustomEvent<WhatsAppConfirmEventDetail>(WHATSAPP_CONFIRM_EVENT, { detail }));
};

const WhatsAppObservationHost: React.FC = () => {
  const [active, setActive] = useState<WhatsAppConfirmEventDetail | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const ce = e as CustomEvent<WhatsAppConfirmEventDetail>;
      if (!ce.detail) return;
      setActive(ce.detail);
    };
    window.addEventListener(WHATSAPP_CONFIRM_EVENT, onEvent);
    return () => window.removeEventListener(WHATSAPP_CONFIRM_EVENT, onEvent);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  if (!active && !toast) return null;

  return (
    <>
      {active && (
        <WhatsAppObservationConfirm
          observations={active.observations}
          unitName={active.unitName}
          auditorName={active.auditorName}
          onDone={({ missingPhone }) => {
            setActive(null);
            if (missingPhone) showToast('No WhatsApp number on file');
          }}
        />
      )}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10060] pointer-events-none">
          <div className="bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl">
            {toast}
          </div>
        </div>
      )}
    </>
  );
};

export default WhatsAppObservationHost;
