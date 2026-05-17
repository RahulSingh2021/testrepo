"use client";

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import Header from './Header';
import SubHeader from './SubHeader';
import LoginPage from './LoginPage';
import AcademyPublicHome from './AcademyPublicHome';
import { X } from 'lucide-react';

const DashboardContent = lazy(() => import('./DashboardContent'));
const SubscriptionManagement = lazy(() => import('./SubscriptionManagement'));
import { NotificationProvider } from './NotificationContext';
import { NotificationToastStack } from './NotificationPanel';
import { AuthState, Entity, Category, NavItem, Supplier, StockItem, MandatoryProtocol, DeptStockItem, DeptStockBatch, DeptStockTransaction, CookingRecordEntry, CoolingRecordEntry, ReheatingEntry, Brand } from '../types';
import { postRegistry, setReloadHandler, noteMaxFromRecords } from '../utils/registrySave';
import { MOCK_ENTITIES as INITIAL_ENTITIES, INITIAL_LICENSE_SCHEMA, NAVIGATION_ITEMS as INITIAL_NAV_ITEMS, INITIAL_PROTOCOLS } from '../constants';

const INITIAL_STOCK: StockItem[] = [
  {
    id: "1",
    name: "MEATZZA BEEF NUGGETS",
    sku: "SKU-MEAT-001",
    unit: "KG",
    defaultLocation: "FREEZER A",
    batches: [
      { id: "b1", number: "Gcp0761", locCode: "XP01", qty: 45.5, mfg: "2025-01-10", exp: "2026-01-10", vendor: "HI-GROWTH", brand: "MEATZZA" },
      { id: "b2", number: "Gcp0762", locCode: "XP02", qty: 20.0, mfg: "2025-02-15", exp: "2026-02-15", vendor: "HI-GROWTH", brand: "MEATZZA" }
    ],
    transactions: [
      {
        id: "t1", type: 'IN', reason: 'PURCHASE RECEIPT', amount: 65.5, date: "2025-02-20 10:00:00",
        openingTotal: 0, closingTotal: 65.5, openingBatches: [], closingBatches: [
          { id: "b1", number: "Gcp0761", locCode: "XP01", qty: 45.5, mfg: "2025-01-10", exp: "2026-01-10" },
          { id: "b2", number: "Gcp0762", locCode: "XP02", qty: 20.0, mfg: "2025-02-15", exp: "2026-02-15" }
        ],
        details: [
          { number: "Gcp0761", qty: 45.5, mfg: "2025-01-10", exp: "2026-01-10" },
          { number: "Gcp0762", qty: 20.0, mfg: "2025-02-15", exp: "2026-02-15" }
        ]
      }
    ]
  }
];

const INITIAL_THAWING_ENTRIES: any[] = [
  {
    uuid: `thaw-initial-1`,
    status: 'PENDING',
    productName: "FROZEN CHICKEN BREAST",
    batchNumber: "BN-2025-X101",
    mfgDate: "2025-01-01",
    expDate: "2026-01-01",
    supplierName: "Prime Cuts",
    thawStartDate: "2025-02-20",
    totalQuantity: 25.0,
    remainingQuantity: 25.0,
    isVerified: false,
    issued: [],
    unitName: "NYC Central Kitchen",
    locationName: "Prep Station A",
    regionalName: "North America",
    departmentName: "Butchery"
  }
];

const INITIAL_COOKING_ENTRIES: CookingRecordEntry[] = [
    {
      uuid: 'cook-completed-demo-1',
      status: 'COMPLETED',
      // Added missing properties to satisfy CookingRecordEntry interface
      productId: 'P-101',
      brandName: 'Prime Choice',
      category: 'Poultry',
      productName: 'GRILLED CHICKEN BREAST BATCH A',
      sourceProductName: 'Thawed Chicken Breast',
      batchNumber: 'BT-CB-2025-01',
      totalThawedQty: 50,
      availableThawedQty: 0,
      cookingQuantity: 48.5,
      storedUnit: 'KG',
      // Added missing properties to satisfy CookingRecordEntry interface
      method: 'Oven Roast',
      cookingPurpose: 'Direct Serve',
      thawStartTime: "2025-02-19T10:00:00.000Z",
      thawCompletedTime: "2025-02-20T08:00:00.000Z",
      cookStart: "2025-02-20T09:00:00.000Z",
      cookCompleted: "2025-02-20T10:00:00.000Z",
      initialTemp: 4.2,
      finalTemp: 78.5,
      cookingVessel: 'OVEN-01',
      initiatedBy: 'Chef Alex',
      completedBy: 'Chef Alex',
      isVerified: true,
      verifierName: 'Jane Smith (QA)',
      unitName: 'NYC Central Kitchen',
      locationName: 'Hot Kitchen',
      departmentName: 'Production',
      regionName: 'North America',
      corporateName: 'Acme Catering Group',
      outletId: 1,
      mfgDate: '2025-01-10',
      expDate: '2025-06-10',
      thawingMethod: 'Refrigerator',
      thawStartTemp: -18,
      thawFinalTemp: 3.5,
      issued: []
    }
];

const INITIAL_COOLING_ENTRIES: CoolingRecordEntry[] = [
    {
      uuid: `cool-pending-1`,
      status: 'NOT_STARTED',
      isVerified: false,
      outletId: 'unit-ny-kitchen',
      corporateName: 'Acme Catering Group',
      regionName: 'North America',
      unitName: 'NYC Central Kitchen',
      departmentName: 'Production',
      locationName: 'Hot Kitchen Line 1',
      productId: 'P-101',
      productName: 'CHICKEN ADOBO BATCH B',
      batchNumber: 'BT-CA-2025-09',
      quantity: 25.0,
      remainingQuantity: 25.0,
      storedUnit: 'KG',
      cookingEndTime: "2025-02-20T10:30:00.000Z",
      cookTemp: 89.2,
      mfgDate: '2025-02-01',
      expDate: '2025-05-01',
      thawingMethod: 'Refrigerator',
      thawStartTemp: -18,
      thawFinalTemp: 3.2,
      cookingTimeLapse: '0h 42m 15s',
      motherThawQty: 50.0,
      motherThawUnit: 'KG',
      sisterThawSplits: [
          { location: 'Main Kitchen', quantity: 25.0, timestamp: '2025-02-20T08:00:00.000Z' },
          { location: 'Prep Station B', quantity: 25.0, timestamp: '2025-02-20T08:05:00.000Z' }
      ],
      cookingQty: 25.0,
      cookingStartTime: '2025-02-20T09:48:00.000Z',
      cookingVessel: 'OVEN-02',
      cookingSplits: [
          { purpose: 'Cooling', quantity: 25.0, timestamp: '2025-02-20T10:30:00.000Z' }
      ],
      issued: []
    }
];

interface LoginModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

// Wraps the existing LoginPage as a dismissible modal/overlay shown on top
// of the public landing. ESC, the close (X) button, and clicks on the
// dark backdrop area outside the login container all dismiss it. Body
// scroll is locked while open. Note: the underlying LoginPage uses a
// full-bleed layout, so the backdrop-click area is small in practice
// (mostly the area around the centered desktop card), but the handler
// is wired correctly via stopPropagation on the inner container.
const LoginModal: React.FC<LoginModalProps> = ({ onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onMouseDown={onClose}
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm overflow-y-auto"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close sign in"
        style={{ top: 'max(env(safe-area-inset-top), 12px)' }}
        className="fixed right-3 z-[60] inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 shadow-lg ring-1 ring-slate-200 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <div onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

interface ClientAppProps {
  // True when this request was served on a domain listed in
  // PUBLIC_ONLY_HOSTS (see lib/publicOnlyHosts.ts). In that mode we
  // render only the public landing page — no login, no signup, no
  // dashboard, no admin — regardless of any stale auth in localStorage.
  isPublicOnly?: boolean;
}

const ClientApp: React.FC<ClientAppProps> = ({ isPublicOnly = false }) => {
  const [mounted, setMounted] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ isLoggedIn: false, scope: 'corporate' });
  const [showLogin, setShowLogin] = useState(false);
  const [currentEntityId, setCurrentEntityId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>(INITIAL_ENTITIES);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);
  const entitySaveQueue = useRef<Map<string, Entity>>(new Map());
  const entitySaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const suppliersLoaded = useRef(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [protocols, setProtocols] = useState<MandatoryProtocol[]>(INITIAL_PROTOCOLS);
  const protocolsLoaded = useRef(false);
  const protocolSaveTimer = useRef<NodeJS.Timeout | null>(null);
  
  const [inventory, setInventory] = useState<StockItem[]>(INITIAL_STOCK);
  const [inventory2, setInventory2] = useState<StockItem[]>(INITIAL_STOCK);
  const [deptStock, setDeptStock] = useState<DeptStockItem[]>([]);
  
  const [thawingEntries, setThawingEntries] = useState<any[]>(INITIAL_THAWING_ENTRIES);
  const [cookingEntries, setCookingEntries] = useState<CookingRecordEntry[]>(INITIAL_COOKING_ENTRIES);
  const [coolingEntries, setCoolingEntries] = useState<CoolingRecordEntry[]>(INITIAL_COOLING_ENTRIES);
  const [reheatingEntries, setReheatingEntries] = useState<ReheatingEntry[]>([]);
  
  const [navConfig, setNavConfig] = useState<NavItem[]>(INITIAL_NAV_ITEMS);
  const navConfigLoaded = useRef(false);
  const navConfigSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const latestNavConfigRef = useRef<NavItem[]>(INITIAL_NAV_ITEMS);
  const [isPermissionManagerOpen, setIsPermissionManagerOpen] = useState(false);
  const [permissionTargetId, setPermissionTargetId] = useState<string | null>(null);

  const [licenseSchema, setLicenseSchema] = useState<Category[]>(INITIAL_LICENSE_SCHEMA);
  const [licenseSchemaLoaded, setLicenseSchemaLoaded] = useState(false);
  const schemaSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const latestSchemaRef = useRef<Category[]>(INITIAL_LICENSE_SCHEMA);
  const schemaDirty = useRef(false);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('db-summary');

  useEffect(() => {
    // Public-only mirror domains never restore auth from storage —
    // visitors there must always see the signed-out landing page.
    if (isPublicOnly) {
      setMounted(true);
      return;
    }
    try {
      const savedAuth = localStorage.getItem('haccp_auth');
      if (savedAuth) setAuth(JSON.parse(savedAuth));
    } catch {}
    try {
      const savedEntity = localStorage.getItem('haccp_entityId');
      if (savedEntity) setCurrentEntityId(savedEntity);
    } catch {}
    let restoredTab: string | null = null;
    let restoredSubTab: string | null = null;
    try {
      restoredTab = localStorage.getItem('haccp_tab');
    } catch {}
    try {
      restoredSubTab = localStorage.getItem('haccp_subTab');
    } catch {}
    // Backward compat: Content used to live under LMS as the
    // `academy-content` sub-tab. It is now its own top-level tab.
    if (restoredSubTab === 'academy-content') {
      restoredTab = 'academy-content';
      restoredSubTab = null;
    }
    if (restoredTab) setActiveTab(restoredTab);
    if (restoredSubTab) setActiveSubTab(restoredSubTab);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const loadEntities = async () => {
      try {
        const res = await fetch('/api/entities');
        const json = await res.json();
        if (json.seeded && json.items?.length > 0) {
          setEntities(json.items as Entity[]);
        } else {
          await fetch('/api/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(INITIAL_ENTITIES),
          });
        }
      } catch (err) {
        console.error('Failed to load entities from DB, using fallback:', err);
      } finally {
        setEntitiesLoaded(true);
      }
    };
    loadEntities();

    const loadProtocols = async () => {
      try {
        const res = await fetch('/api/protocols');
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          setProtocols(json);
        } else {
          await fetch('/api/protocols', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(INITIAL_PROTOCOLS),
          });
        }
      } catch (err) {
        console.error('Failed to load protocols from DB:', err);
      } finally {
        protocolsLoaded.current = true;
      }
    };
    loadProtocols();

    const loadNavConfig = async () => {
      try {
        const res = await fetch('/api/app-settings?key=nav_config');
        const json = await res.json();
        if (json && typeof json.value === 'string' && json.value) {
          const parsed = JSON.parse(json.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Merge persisted overrides with INITIAL_NAV_ITEMS so newly added
            // modules in code still appear even if the saved snapshot is older.
            const byId = new Map(parsed.map((it: NavItem) => [it.id, it]));
            const merged = INITIAL_NAV_ITEMS.map(def => {
              const saved = byId.get(def.id);
              if (!saved) return def;
              return {
                ...def,
                allowedSubscriptions: saved.allowedSubscriptions ?? def.allowedSubscriptions,
                allowedIndustries: saved.allowedIndustries ?? def.allowedIndustries,
                allowedEntityIds: saved.allowedEntityIds ?? def.allowedEntityIds,
                deniedEntityIds: saved.deniedEntityIds ?? def.deniedEntityIds,
                subItems: (def.subItems || []).map(sd => {
                  const ss = (saved.subItems || []).find((x: any) => x.id === sd.id);
                  if (!ss) return sd;
                  return {
                    ...sd,
                    allowedSubscriptions: ss.allowedSubscriptions ?? sd.allowedSubscriptions,
                    allowedIndustries: ss.allowedIndustries ?? sd.allowedIndustries,
                    allowedEntityIds: ss.allowedEntityIds ?? sd.allowedEntityIds,
                    deniedEntityIds: ss.deniedEntityIds ?? sd.deniedEntityIds,
                  };
                }),
              };
            });
            setNavConfig(merged);
          }
        }
      } catch (err) {
        console.error('Failed to load nav config from DB:', err);
      } finally {
        navConfigLoaded.current = true;
      }
    };
    loadNavConfig();
  }, [mounted]);

  // Debounced persistence for navConfig (Global Access Matrix). Also
  // keeps `latestNavConfigRef` in sync so the beforeunload handler
  // (which is attached once) can flush the freshest value.
  useEffect(() => {
    latestNavConfigRef.current = navConfig;
    if (!navConfigLoaded.current) return;
    if (navConfigSaveTimer.current) clearTimeout(navConfigSaveTimer.current);
    navConfigSaveTimer.current = setTimeout(() => {
      fetch('/api/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'nav_config', value: JSON.stringify(navConfig) }),
      }).catch(err => console.error('Failed to save nav config:', err));
    }, 800);
    return () => { if (navConfigSaveTimer.current) clearTimeout(navConfigSaveTimer.current); };
  }, [navConfig]);

  const flushEntitySaves = useCallback(async () => {
    const queue = entitySaveQueue.current;
    if (queue.size === 0) return;
    const batch = Array.from(queue.values());
    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        batch.forEach(e => queue.delete(e.id));
      }
    } catch (err) {
      console.error('Failed to persist entity updates, will retry:', err);
    }
  }, []);

  const scheduleEntitySave = useCallback((entity: Entity) => {
    entitySaveQueue.current.set(entity.id, entity);
    if (entitySaveTimer.current) clearTimeout(entitySaveTimer.current);
    entitySaveTimer.current = setTimeout(flushEntitySaves, 1500);
  }, [flushEntitySaves]);

  useEffect(() => {
    if (!protocolsLoaded.current) return;
    if (protocolSaveTimer.current) clearTimeout(protocolSaveTimer.current);
    protocolSaveTimer.current = setTimeout(() => {
      const valid = protocols.filter(p => p.id);
      if (valid.length === 0) return;
      fetch('/api/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      }).catch(e => console.error('Failed to save protocols:', e));
    }, 2000);
    return () => { if (protocolSaveTimer.current) clearTimeout(protocolSaveTimer.current); };
  }, [protocols]);

  useEffect(() => {
    if (!mounted) return;
    const loadLicenseSchema = async () => {
      try {
        const currentEntity = entities.find(e => e.id === (currentEntityId || auth.entityId));
        const ancestorIds = currentEntity?.parentIds?.length > 0 ? currentEntity.parentIds.join(',') : '';
        const params = new URLSearchParams();
        if (currentEntity?.id) params.set('corporateId', currentEntity.id);
        if (ancestorIds) params.set('ancestorIds', ancestorIds);
        const queryString = params.toString();
        const url = queryString ? `/api/license-schema?${queryString}` : '/api/license-schema';
        
        const res = await fetch(url);
        const json = await res.json();
        if (json.seeded && json.items?.length > 0) {
          setLicenseSchema(json.items as Category[]);
        } else {
          await fetch('/api/license-schema', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(INITIAL_LICENSE_SCHEMA),
          });
        }
      } catch (err) {
        console.error('Failed to load license schema from DB, using fallback:', err);
      } finally {
        setLicenseSchemaLoaded(true);
      }
    };
    loadLicenseSchema();
  }, [mounted, currentEntityId]);

  const flushSchemaSave = useCallback(async (schemaData: Category[]) => {
    try {
      const res = await fetch('/api/license-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schemaData),
      });
      if (!res.ok) {
        console.error('Failed to persist license schema, will retry on next change');
      }
    } catch (err) {
      console.error('Failed to persist license schema:', err);
    }
  }, []);

  const handleSetLicenseSchema: React.Dispatch<React.SetStateAction<Category[]>> = useCallback((action) => {
    setLicenseSchema(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      latestSchemaRef.current = next;
      schemaDirty.current = true;
      return next;
    });
    if (schemaSaveTimer.current) clearTimeout(schemaSaveTimer.current);
    schemaSaveTimer.current = setTimeout(() => {
      schemaDirty.current = false;
      flushSchemaSave(latestSchemaRef.current);
    }, 1500);
  }, [flushSchemaSave]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushEntitySaves();
      if (schemaDirty.current) {
        const blob = new Blob([JSON.stringify(latestSchemaRef.current)], { type: 'application/json' });
        navigator.sendBeacon('/api/license-schema', blob);
        schemaDirty.current = false;
      }
      // Flush any pending nav config changes (Global Access Matrix)
      if (navConfigSaveTimer.current && navConfigLoaded.current) {
        clearTimeout(navConfigSaveTimer.current);
        navConfigSaveTimer.current = null;
        try {
          const blob = new Blob(
            [JSON.stringify({ key: 'nav_config', value: JSON.stringify(latestNavConfigRef.current) })],
            { type: 'application/json' }
          );
          navigator.sendBeacon('/api/app-settings', blob);
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (entitySaveTimer.current) clearTimeout(entitySaveTimer.current);
      flushEntitySaves();
      if (schemaSaveTimer.current) clearTimeout(schemaSaveTimer.current);
      if (schemaDirty.current) {
        flushSchemaSave(latestSchemaRef.current);
        schemaDirty.current = false;
      }
    };
  }, [flushEntitySaves, flushSchemaSave]);

  useEffect(() => {
    if (mounted) { try { localStorage.setItem('haccp_tab', activeTab); } catch {} }
  }, [activeTab, mounted]);

  useEffect(() => {
    if (mounted) { try { localStorage.setItem('haccp_subTab', activeSubTab); } catch {} }
  }, [activeSubTab, mounted]);

  useEffect(() => {
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
          console.log('HACCP PRO SW Registered:', reg.scope);
          reg.update();
        } catch (err) {
          console.error('SW Registration Failed:', err);
        }
      };
      registerSW();
    }
  }, []);

  const handleLogin = (newAuth: AuthState) => {
    setAuth(newAuth);
    setShowLogin(false);
    setCurrentEntityId(null); 
    setActiveTab('dashboard');
    setActiveSubTab('db-summary');
    try {
      localStorage.setItem('haccp_auth', JSON.stringify(newAuth));
      localStorage.removeItem('haccp_entityId');
      // Wipe any stale admin token from a prior session — LoginPage will
      // re-mint one if the new credentials are an actual admin. Without
      // this, a previous admin login could leave behind a token that lets
      // a later non-admin login still see admin-gated UI (WhatsApp inbox).
      if (newAuth.scope !== 'super-admin') localStorage.removeItem('admin_session_token');
    } catch {}
  };

  const handleLogout = () => {
    setAuth({ isLoggedIn: false, scope: 'corporate' });
    setShowLogin(false);
    setCurrentEntityId(null);
    setBrands([]);
    lastBrandCorpRef.current = null;
    try { localStorage.removeItem('haccp_auth'); localStorage.removeItem('haccp_entityId'); localStorage.removeItem('admin_session_token'); } catch {}
  };

  const handleEntitySelect = (entityId: string | null) => {
    setCurrentEntityId(entityId);
    try { if (entityId) localStorage.setItem('haccp_entityId', entityId); else localStorage.removeItem('haccp_entityId'); } catch {}
  };

  const handleUpdateEntity = useCallback((updatedEntity: Entity) => {
    setEntities(prev => prev.map(e => e.id === updatedEntity.id ? updatedEntity : e));
    scheduleEntitySave(updatedEntity);
  }, [scheduleEntitySave]);

  const handleAddEntity = useCallback((newEntity: Entity) => {
    setEntities(prev => [...prev, newEntity]);
    scheduleEntitySave(newEntity);
  }, [scheduleEntitySave]);

  const handleOpenPermissions = (targetId?: string) => {
    setPermissionTargetId(targetId || null);
    setIsPermissionManagerOpen(true);
  };

  // Both supplier save paths route through the shared registry-save manager
  // so the RegistrySaveBadge in SupplierDetails reflects Saving / Saved /
  // Save failed / Newer-server-version state and the optimistic-conflict
  // guard kicks in. Mirrors the recipes/ingredients pattern.
  const persistSupplier = useCallback(async (supplier: Supplier) => {
    await postRegistry('suppliers', '/api/suppliers', supplier);
  }, []);

  const persistSuppliers = useCallback(async (arr: Supplier[]) => {
    await postRegistry('suppliers', '/api/suppliers', arr);
  }, []);

  const reloadSuppliers = useCallback(async () => {
    try {
      const resp = await fetch('/api/suppliers');
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data)) {
        noteMaxFromRecords('suppliers', data);
        setSuppliers(data);
      }
    } catch (e) { console.error('Failed to reload suppliers', e); }
  }, []);

  useEffect(() => {
    setReloadHandler('suppliers', reloadSuppliers);
    return () => setReloadHandler('suppliers', null);
  }, [reloadSuppliers]);

  const deleteSupplierFromDb = useCallback(async (id: string) => {
    try { await fetch('/api/suppliers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch (e) { console.error('Failed to delete supplier from DB', e); }
  }, []);

  useEffect(() => {
    if (suppliersLoaded.current) return;
    suppliersLoaded.current = true;
    const load = async () => {
      try {
        const resp = await fetch('/api/suppliers');
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) {
            // Capture the freshest server timestamp so the next save can do
            // optimistic-conflict detection.
            noteMaxFromRecords('suppliers', data);
            setSuppliers(data);
          }
        }
      } catch (e) { console.error('Failed to load suppliers', e); }
      finally { setSuppliersLoading(false); }
    };
    load();
  }, []);

  const findCorporateAncestor = (entityId: string | undefined): string | null => {
    if (!entityId) return null;
    let curr = entities.find(e => e.id === entityId);
    while (curr) {
      if (curr.type === 'corporate') return curr.id;
      curr = entities.find(e => e.id === curr?.parentId);
    }
    return null;
  };

  const lastBrandCorpRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.isLoggedIn || !entitiesLoaded) return;
    const rootId = currentEntityId || auth.entityId;
    const corpId = findCorporateAncestor(rootId);
    const cacheKey = corpId || '__all__';
    if (lastBrandCorpRef.current === cacheKey) return;
    lastBrandCorpRef.current = cacheKey;
    const load = async () => {
      try {
        let url = '/api/brands';
        if (corpId) {
          url = `/api/brands?corporateId=${encodeURIComponent(corpId)}`;
        }
        const resp = await fetch(url);
        if (resp.ok) {
          const data: Brand[] = await resp.json();
          const arr = Array.isArray(data) ? data : [];
          // Capture freshest server timestamp for optimistic-conflict guard.
          noteMaxFromRecords('brands', arr);
          setBrands(arr);
        }
      } catch (e) { console.error('Failed to load brands', e); }
    };
    load();
    // Wire the registry-save badge "Reload" button to refetch brands on
    // demand (e.g. after a conflict, the user picks Reload to discard
    // their local edits and pick up the server version). Cleanup avoids
    // a stale handler being held after unmount or scope switches.
    setReloadHandler('brands', () => {
      lastBrandCorpRef.current = null;
      load();
    });
    return () => setReloadHandler('brands', null);
  }, [auth.isLoggedIn, auth.entityId, currentEntityId, entitiesLoaded, entities]);

  const handleUpdateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, ...updates } : s);
      const target = updated.find(s => s.id === id);
      if (target) persistSupplier(target);
      return updated;
    });
  };

  const handleAddSupplier = (newSupplier: Supplier) => {
    setSuppliers(prev => [newSupplier, ...prev]);
    persistSupplier(newSupplier);
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    deleteSupplierFromDb(id);
  };

  const handleIssueToDepartment = (issueData: any) => {
      const { productName, unit, items, issuedTo, unitName } = issueData;
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      setDeptStock(prev => {
          const existingItem = prev.find(i => i.name === productName);
          const totalAmount = items.reduce((sum: number, it: any) => sum + (it.qty || 0), 0);
          
          let nextItem: DeptStockItem;

          if (existingItem) {
              const openingTotal = existingItem.batches.reduce((sum, b) => sum + b.quantity, 0);
              const openingBatches = JSON.parse(JSON.stringify(existingItem.batches));
              
              const nextBatches = [...existingItem.batches];
              items.forEach((inc: any) => {
                  const existingBatchIdx = nextBatches.findIndex(b => b.number === inc.number);
                  if (existingBatchIdx !== -1) {
                      nextBatches[existingBatchIdx] = {
                          ...nextBatches[existingBatchIdx],
                          quantity: nextBatches[existingBatchIdx].quantity + inc.qty
                      };
                  } else {
                      nextBatches.push({
                          id: `db-${Date.now()}-${Math.random()}`,
                          number: inc.number,
                          location: issuedTo || 'Dept Storage',
                          quantity: inc.qty,
                          mfgDate: inc.mfg,
                          expDate: inc.exp,
                          receivingDate: nowStr.split(' ')[0]
                      });
                  }
              });

              const transaction: DeptStockTransaction = {
                  id: `tx-in-${Date.now()}`,
                  type: 'IN',
                  reason: 'HANDSHAKE RECEIPT',
                  amount: totalAmount,
                  date: nowStr,
                  sourceNode: `Main Warehouse (${unitName})`,
                  destinationNode: issuedTo,
                  openingTotal,
                  closingTotal: openingTotal + totalAmount,
                  openingBatches,
                  closingBatches: nextBatches,
                  details: items
              };

              nextItem = {
                  ...existingItem,
                  batches: nextBatches,
                  transactions: [...existingItem.transactions, transaction]
              };

              return prev.map(i => i.id === existingItem.id ? nextItem : i);
          } else {
              const nextBatches: DeptStockBatch[] = items.map((inc: any) => ({
                  id: `db-${Date.now()}-${Math.random()}`,
                  number: inc.number,
                  location: issuedTo || 'Dept Storage',
                  quantity: inc.qty,
                  mfgDate: inc.mfg,
                  expDate: inc.exp,
                  receivingDate: nowStr.split(' ')[0]
              }));

              const transaction: DeptStockTransaction = {
                  id: `tx-in-${Date.now()}`,
                  type: 'IN',
                  reason: 'INITIAL HANDSHAKE',
                  amount: totalAmount,
                  date: nowStr,
                  sourceNode: `Main Warehouse (${unitName})`,
                  destinationNode: issuedTo,
                  openingTotal: 0,
                  closingTotal: totalAmount,
                  openingBatches: [],
                  closingBatches: nextBatches,
                  details: items
              };

              nextItem = {
                  id: `di-${Date.now()}`,
                  name: productName,
                  unit: unit,
                  batches: nextBatches,
                  transactions: [transaction]
              };

              return [...prev, nextItem];
          }
      });
  };

  const handlePullForThawing = (deptItem: DeptStockItem, pullQty: number, signature: string, details: any[]) => {
      const now = new Date();
      const currentEntity = entities.find(e => e.id === (currentEntityId || auth.entityId));
      
      const newThawEntry = {
          uuid: `thaw-node-${Date.now()}`,
          status: 'PENDING',
          productName: deptItem.name,
          batchNumber: details.map(d => d.number).join(', '),
          mfgDate: details[0]?.mfg || '',
          expDate: details[0]?.exp || '',
          supplierName: 'Internal Departmental Stock',
          thawStartDate: now.toISOString().split('T')[0],
          totalQuantity: pullQty,
          remainingQuantity: pullQty,
          isVerified: false,
          issued: [],
          unitName: currentEntity?.name || "Unit Registry",
          regionalName: currentEntity?.location || "Central Region",
          departmentName: details[0]?.department || "Main Kitchen",
          locationName: details[0]?.location || "Prep Station"
      };

      setThawingEntries(prev => [newThawEntry, ...prev]);
  };

  const handleThawIssueToCooking = (thawEntry: any, quantity: number, location: string) => {
      const now = new Date();
      const newCookEntry: CookingRecordEntry = {
          uuid: `cook-rtc-${Date.now()}`,
          status: 'THAWED',
          corporateName: thawEntry.corporateName || 'Acme Corp',
          regionName: thawEntry.regionalName || 'North America',
          unitName: thawEntry.unitName,
          departmentName: thawEntry.departmentName || 'Kitchen',
          locationName: location,
          productId: thawEntry.productId || `P-${Date.now()}`,
          productName: thawEntry.productName,
          sourceProductName: `Thawed ${thawEntry.productName}`,
          brandName: thawEntry.supplierName,
          category: thawEntry.category || 'General',
          batchNumber: thawEntry.batchNumber,
          totalThawedQty: quantity,
          availableThawedQty: quantity,
          cookingQuantity: 0,
          storedUnit: thawEntry.storedUnit || 'KG',
          method: '',
          cookingPurpose: '',
          thawStartTime: thawEntry.thawStartTime || '',
          thawCompletedTime: thawEntry.thawEndTime || now.toISOString(),
          cookStart: '',
          initialTemp: '',
          cookingVessel: '',
          initiatedBy: '',
          cookCompleted: '',
          finalTemp: '',
          completedBy: '',
          isVerified: false,
          issued: [],
          mfgDate: thawEntry.mfgDate,
          expDate: thawEntry.expDate,
          thawingMethod: thawEntry.thawMethod,
          thawStartTemp: thawEntry.initialTemp,
          thawFinalTemp: thawEntry.finalTemp,
          outletId: 1
      };

      setCookingEntries(prev => [newCookEntry, ...prev]);
  };

  const handleCookIssueToCooling = (cookEntry: CookingRecordEntry, quantity: number) => {
      const now = new Date();
      const cookTimeLapse = cookEntry.cookStart && cookEntry.cookCompleted
          ? (() => {
              const diff = Math.max(0, new Date(cookEntry.cookCompleted).getTime() - new Date(cookEntry.cookStart).getTime());
              const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
              return `${h}h ${m}m ${s}s`;
          })()
          : 'N/A';

      const newCoolEntry: CoolingRecordEntry = {
          uuid: `cool-handshake-${Date.now()}`,
          status: 'NOT_STARTED',
          isVerified: false,
          outletId: cookEntry.outletId.toString(),
          corporateName: cookEntry.corporateName,
          regionName: cookEntry.regionName,
          unitName: cookEntry.unitName,
          departmentName: cookEntry.departmentName,
          locationName: cookEntry.locationName,
          productId: cookEntry.productId,
          productName: cookEntry.productName,
          batchNumber: cookEntry.batchNumber,
          quantity: quantity,
          remainingQuantity: quantity,
          storedUnit: cookEntry.storedUnit,
          cookingEndTime: cookEntry.cookCompleted || now.toISOString(),
          cookTemp: typeof cookEntry.initialTemp === 'number' ? cookEntry.initialTemp : (typeof cookEntry.finalTemp === 'number' ? cookEntry.finalTemp : (parseFloat(String(cookEntry.initialTemp)) || 0)),
          mfgDate: cookEntry.mfgDate,
          expDate: cookEntry.expDate,
          thawingMethod: cookEntry.thawingMethod,
          thawStartTemp: cookEntry.thawStartTemp,
          thawFinalTemp: cookEntry.thawFinalTemp,
          cookingTimeLapse: cookTimeLapse,
          thawStartTime: cookEntry.thawStartTime,
          thawCompletedTime: cookEntry.thawCompletedTime,
          motherThawQty: cookEntry.totalThawedQty || 0,
          motherThawUnit: cookEntry.storedUnit,
          sisterThawSplits: (cookEntry.splits || []).map(s => ({ location: s.name || 'Split', quantity: s.quantity, timestamp: s.timestamp || '' })),
          cookingQty: cookEntry.cookingQuantity || quantity,
          cookingStartTime: cookEntry.cookStart,
          cookingVessel: cookEntry.cookingVessel,
          cookingSplits: (cookEntry.issued || []).map((iss: any) => ({ purpose: iss.purpose || iss.location || 'Issued', quantity: iss.quantity || 0, timestamp: iss.timestamp || '' })),
          issued: []
      };

      setCoolingEntries(prev => [newCoolEntry, ...prev]);
  };

  const handleCoolIssueToReheating = (coolEntry: CoolingRecordEntry, quantity: number) => {
      const now = new Date();
      const newReheatEntry: ReheatingEntry = {
          uuid: `reheat-node-${Date.now()}`,
          status: 'READY',
          corporate: coolEntry.corporateName,
          regional: coolEntry.regionName,
          unit: coolEntry.unitName,
          department: coolEntry.departmentName,
          location: coolEntry.locationName,
          productName: coolEntry.productName,
          category: 'General',
          sourceProductName: coolEntry.productName,
          batchNumber: coolEntry.batchNumber,
          standardRecipe: 'Registry Sync',
          reheatingVessel: '',
          reheatingQuantity: quantity,
          method: '',
          reheatStart: '',
          reheatCompleted: '',
          initialTemp: coolEntry.finalTemp || 0,
          duration: '',
          completedBy: '',
          reheatingPurpose: 'Hold and Serve',
          issued: [],
          thawTime: coolEntry.thawStartTime || 'N/A',
          cookTime: coolEntry.cookingEndTime || 'N/A',
          cookTemp: coolEntry.cookTemp,
          coolTime: coolEntry.finalTime || 'N/A',
          coolTemp: coolEntry.finalTemp || 0,
          mfgDate: coolEntry.mfgDate,
          expDate: coolEntry.expDate
      };

      setReheatingEntries(prev => [newReheatEntry, ...prev]);
  };

  const activeEntity = entities.find(e => e.id === currentEntityId);
  const effectiveScope = activeEntity ? activeEntity.type : auth.scope;
  const effectiveRootId = currentEntityId || auth.entityId;

  const canManagePermissions = ['super-admin', 'corporate', 'regional', 'unit'].includes(auth.scope);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-500 font-medium">Loading HACCP PRO...</span>
        </div>
      </div>
    );
  }

  if (isPublicOnly) {
    // Public-only mirror: render the landing screen with every
    // sign-in CTA hidden. The login modal is never reachable here.
    return <AcademyPublicHome hideSignIn />;
  }

  if (!auth.isLoggedIn) {
    return (
      <>
        <AcademyPublicHome onSignInClick={() => setShowLogin(true)} />
        {showLogin && (
          <LoginModal onClose={() => setShowLogin(false)}>
            <LoginPage onLogin={handleLogin} entities={entities} />
          </LoginModal>
        )}
      </>
    );
  }

  return (
    <NotificationProvider>
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
      <NotificationToastStack />
      <Header 
        currentScope={auth.scope}
        effectiveScope={effectiveScope}
        onScopeChange={(scope) => {
          setAuth({ ...auth, scope });
          setCurrentEntityId(null);
        }} 
        onLogout={handleLogout}
        onEntitySelect={handleEntitySelect}
        currentEntityId={currentEntityId}
        entities={entities}
        userRootId={auth.entityId} 
        onOpenPermissionManager={() => handleOpenPermissions()}
      />
      
      <SubHeader 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        selectedEntityId={currentEntityId}
        entities={entities}
        currentScope={effectiveScope}
        navItems={navConfig}
        userRootId={effectiveRootId} 
      />
      
      <div className="flex-1 overflow-y-auto pb-24 md:pb-6 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto w-full px-0 md:px-2 lg:px-4">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" /></div>}>
          <DashboardContent 
            currentScope={effectiveScope} 
            selectedEntityId={currentEntityId}
            onEntityLevelChange={setCurrentEntityId}
            activeTab={activeTab}
            activeSubTab={activeSubTab}
            setActiveSubTab={setActiveSubTab}
            entities={entities}
            suppliers={suppliers}
            protocols={protocols}
            setProtocols={setProtocols}
            onUpdateSupplier={handleUpdateSupplier}
            onAddSupplier={handleAddSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            suppliersLoading={suppliersLoading}
            persistSuppliers={persistSuppliers}
            onUpdateEntity={handleUpdateEntity}
            onAddEntity={handleAddEntity}
            onFlushEntitySaves={flushEntitySaves}
            userRootId={effectiveRootId}
            userName={auth.userName}
            userEmail={auth.email}
            brands={brands}
            onBrandsChange={setBrands}
            licenseSchema={licenseSchema}
            setLicenseSchema={handleSetLicenseSchema}
            navItems={navConfig}
            onOpenPermissions={handleOpenPermissions}
            onUpdateNavConfig={setNavConfig}
            
            // Stock Props
            inventory={inventory}
            setInventory={setInventory}
            inventory2={inventory2}
            setInventory2={setInventory2}
            deptStock={deptStock}
            setDeptStock={setDeptStock}
            onIssueToDepartment={handleIssueToDepartment}
            onPullForThawing={handlePullForThawing}

            // Traceability Props
            thawingEntries={thawingEntries}
            setThawingEntries={setThawingEntries}
            cookingEntries={cookingEntries}
            setCookingEntries={setCookingEntries}
            onThawIssueToCooking={handleThawIssueToCooking}
            coolingEntries={coolingEntries}
            setCoolingEntries={setCoolingEntries}
            onIssueToCooling={handleCookIssueToCooling}
            reheatingEntries={reheatingEntries}
            setReheatingEntries={setReheatingEntries}
            onCoolIssueToReheating={handleCoolIssueToReheating}
          />
          </Suspense>
        </div>
      </div>
      
      {canManagePermissions && isPermissionManagerOpen && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" /></div>}>
        <SubscriptionManagement 
          currentScope={auth.scope}
          entities={entities}
          onUpdateEntity={handleUpdateEntity}
          navItems={navConfig}
          onUpdateNavConfig={setNavConfig}
          onClose={() => setIsPermissionManagerOpen(false)}
          targetEntityId={permissionTargetId}
        />
        </Suspense>
      )}

      <footer className="hidden md:flex bg-white border-t border-gray-100 py-6 px-10 flex-col sm:flex-row items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
        <span>&copy; 2025 HACCP PRO Global Systems</span>
        <div className="flex gap-8 mt-4 sm:mt-0">
          <a href="#" className="hover:text-red-600 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-red-600 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-red-600 transition-colors">Security Audit</a>
        </div>
      </footer>
    </div>
    </NotificationProvider>
  );
};

export default ClientApp;
