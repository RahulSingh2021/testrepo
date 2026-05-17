import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import SubHeader from './components/SubHeader';
import DashboardContent from './components/DashboardContent';
import LoginPage from './components/LoginPage';
import SubscriptionManagement from './components/SubscriptionManagement';
import { AuthState, Entity, Category, NavItem, Supplier, StockItem, DeptStockItem, DeptStockBatch, DeptStockTransaction, CookingRecordEntry, CoolingRecordEntry, ReheatingEntry, MandatoryProtocol } from './types';
import { MOCK_ENTITIES as INITIAL_ENTITIES, INITIAL_LICENSE_SCHEMA, NAVIGATION_ITEMS as INITIAL_NAV_ITEMS, INITIAL_SUPPLIERS, INITIAL_PROTOCOLS } from './constants';

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
    thawStartDate: new Date().toISOString().split('T')[0],
    totalQuantity: 25.0,
    remainingQuantity: 25.0,
    isVerified: false,
    issued: [],
    unitName: "NYC Central Kitchen",
    locationName: "Prep Station A"
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
      thawStartTime: new Date(Date.now() - 86400000).toISOString(),
      thawCompletedTime: new Date(Date.now() - 7200000).toISOString(),
      cookStart: new Date(Date.now() - 3600000).toISOString(),
      cookCompleted: new Date().toISOString(),
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
      cookingEndTime: new Date().toISOString(),
      cookTemp: 89.2,
      mfgDate: '2025-02-01',
      expDate: '2025-05-01',
      issued: []
    },
    { 
      uuid: `cool-102`, 
      status: 'COMPLETED', 
      isVerified: true,
      outletId: 'unit-ny-kitchen', 
      corporateName: 'Acme Catering Group', 
      regionName: 'North America', 
      unitName: 'NYC Central Kitchen', 
      departmentName: 'Butchery', 
      locationName: `Station 4`, 
      productId: `P-402`, 
      productName: "LAMB REDUCTION SAUCE", 
      batchNumber: `BT-LM-2025-42`, 
      quantity: 15.0, 
      remainingQuantity: 0, 
      storedUnit: 'KG', 
      cookingEndTime: new Date().toISOString(), 
      cookTemp: 94.5, 
      cookingTimeLapse: '2h 15m',
      thawStartTime: new Date().toISOString(), 
      thawCompletedTime: new Date().toISOString(),
      thawingMethod: 'Ice Bath',
      thawStartTemp: -20,
      thawFinalTemp: 4.1,
      mfgDate: '2025-02-01',
      expDate: '2025-05-01',
      startTime: new Date().toISOString(),
      initialTemp: 85.0,
      initialTempImg: "https://images.unsplash.com/photo-1584269656462-2334cb2823c1?q=80&w=200&auto=format&fit=crop",
      operatorComments: "Rapid cooling initiated immediately after strain.",
      method: "Ice Bath",
      initiatedBy: "Chef Maria",
      initiationSign: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=",
      stage1Time: new Date().toISOString(),
      stage1Temp: 21.0,
      stage1By: "Staff John",
      stage1Comments: "Stirring continuous. Ice replenished.",
      stage1Sign: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=",
      finalTime: new Date().toISOString(),
      finalTemp: 3.5,
      finalBy: "Chef Maria",
      finalSign: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=",
      finalComments: "Target temp reached within 2 hours. Transferred to Walk-in.",
      verifierName: "QA Supervisor",
      verificationComments: "Critical limit met (75 to 5 in 120m)",
      verifierSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=",
      issued: [{ id: 'iss1', purpose: 'Storage', quantity: 15, timestamp: new Date().toISOString(), user: 'Chef Maria' }] 
    }
];

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ isLoggedIn: false, scope: 'corporate' });
  const [currentEntityId, setCurrentEntityId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>(INITIAL_ENTITIES);
  const entitySaveQueue = useRef<Map<string, Entity>>(new Map());
  const entitySaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [protocols, setProtocols] = useState<MandatoryProtocol[]>(INITIAL_PROTOCOLS);
  
  // Shared Inventory State
  const [inventory, setInventory] = useState<StockItem[]>(JSON.parse(JSON.stringify(INITIAL_STOCK)));
  const [inventory2, setInventory2] = useState<StockItem[]>(JSON.parse(JSON.stringify(INITIAL_STOCK)));
  const [deptStock, setDeptStock] = useState<DeptStockItem[]>([]);
  
  // Shared Traceability State
  const [thawingEntries, setThawingEntries] = useState<any[]>(INITIAL_THAWING_ENTRIES);
  const [cookingEntries, setCookingEntries] = useState<CookingRecordEntry[]>(INITIAL_COOKING_ENTRIES);
  const [coolingEntries, setCoolingEntries] = useState<CoolingRecordEntry[]>(INITIAL_COOLING_ENTRIES);
  const [reheatingEntries, setReheatingEntries] = useState<ReheatingEntry[]>([]);

  // Navigation Configuration State
  const [navConfig, setNavConfig] = useState<NavItem[]>(INITIAL_NAV_ITEMS);
  const [isPermissionManagerOpen, setIsPermissionManagerOpen] = useState(false);
  const [permissionTargetId, setPermissionTargetId] = useState<string | null>(null);

  // Global State for License Configuration Schema
  const [licenseSchema, setLicenseSchema] = useState<Category[]>(INITIAL_LICENSE_SCHEMA);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('db-summary');

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
      }
    };
    loadEntities();
  }, []);

  const handleLogin = (newAuth: AuthState) => {
    setAuth(newAuth);
    setCurrentEntityId(null); 
    setActiveTab('dashboard');
    setActiveSubTab('db-summary');
  };

  const handleLogout = () => {
    setAuth({ isLoggedIn: false, scope: 'corporate' });
    setCurrentEntityId(null);
  };

  const handleEntitySelect = (entityId: string | null) => {
    setCurrentEntityId(entityId);
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

  const handleUpdateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleAddSupplier = (newSupplier: Supplier) => {
    setSuppliers(prev => [newSupplier, ...prev]);
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
                          id: `db-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
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
                  id: `db-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
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
          locationName: details[0]?.location || "Prep Station"
      };

      setThawingEntries(prev => [newThawEntry, ...prev]);
  };

  const handleIssueToCooking = (thawEntry: any, quantity: number, location: string) => {
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
          thawStartTime: thawEntry.thawStartTime,
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
          thawingMethod: thawEntry.thawingMethod,
          thawStartTemp: thawEntry.thawStartTemp,
          thawFinalTemp: thawEntry.thawFinalTemp,
          outletId: 1
      };

      setCookingEntries(prev => [newCookEntry, ...prev]);
  };

  const handleCookIssueToCooling = (cookEntry: CookingRecordEntry, quantity: number) => {
      const now = new Date();
      const newCoolEntry: CoolingRecordEntry = {
          uuid: `cool-cycle-${Date.now()}`,
          status: 'NOT_STARTED',
          isVerified: false,
          outletId: String(cookEntry.outletId),
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
          cookTemp: typeof cookEntry.finalTemp === 'number' ? cookEntry.finalTemp : parseFloat(cookEntry.finalTemp) || 0,
          cookingTimeLapse: 'Registry Sync',
          thawStartTime: cookEntry.thawStartTime,
          thawCompletedTime: cookEntry.thawCompletedTime,
          thawingMethod: cookEntry.thawingMethod,
          thawStartTemp: cookEntry.thawStartTemp,
          thawFinalTemp: cookEntry.thawFinalTemp,
          mfgDate: cookEntry.mfgDate,
          expDate: cookEntry.expDate,
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

  if (!auth.isLoggedIn) {
    return <LoginPage onLogin={handleLogin} entities={entities} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
      <Header 
        currentScope={auth.scope} 
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
        userRootId={auth.entityId} 
      />
      
      <div className="flex-1 overflow-y-auto pb-24 md:pb-6 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto w-full">
          <DashboardContent 
            currentScope={effectiveScope} 
            selectedEntityId={currentEntityId}
            onEntityLevelChange={setCurrentEntityId}
            activeTab={activeTab}
            activeSubTab={activeSubTab}
            entities={entities}
            suppliers={suppliers}
            protocols={protocols}
            setProtocols={setProtocols}
            onUpdateSupplier={handleUpdateSupplier}
            onAddSupplier={handleAddSupplier}
            onUpdateEntity={handleUpdateEntity}
            onAddEntity={handleAddEntity}
            userRootId={effectiveRootId}
            licenseSchema={licenseSchema}
            setLicenseSchema={setLicenseSchema}
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
            onThawIssueToCooking={handleIssueToCooking}
            coolingEntries={coolingEntries}
            setCoolingEntries={setCoolingEntries}
            onIssueToCooling={handleCookIssueToCooling}
            reheatingEntries={reheatingEntries}
            setReheatingEntries={setReheatingEntries}
            onCoolIssueToReheating={handleCoolIssueToReheating}
          />
        </div>
      </div>
      
      {canManagePermissions && isPermissionManagerOpen && (
        <SubscriptionManagement 
          currentScope={auth.scope}
          entities={entities}
          onUpdateEntity={handleUpdateEntity}
          navItems={navConfig}
          onUpdateNavConfig={setNavConfig}
          onClose={() => setIsPermissionManagerOpen(false)}
          targetEntityId={permissionTargetId}
        />
      )}

      <footer className="hidden md:flex bg-white border-t border-gray-100 py-6 px-10 flex-col sm:flex-row items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
        <span>&copy; {new Date().getFullYear()} HACCP PRO Global Systems</span>
        <div className="flex gap-8 mt-4 sm:mt-0">
          <a href="#" className="hover:text-red-600 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-red-600 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-red-600 transition-colors">Security Audit</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
