
export type HierarchyScope = 'super-admin' | 'corporate' | 'regional' | 'unit' | 'department' | 'user';
export type IndustryType = 'catering' | 'dairy' | 'nutraceutical' | 'manufacturing' | 'mid-day-meal' | 'general';
export type SubscriptionType = 'trial' | 'basic' | 'advance' | 'pro';
export type EntityStatus = 'active' | 'inactive' | 'pending-approval' | 'suspended';

export type AuthorityLevel = 'CORPORATE' | 'REGIONAL' | 'UNIT';

export interface MandatoryProtocol {
    id: string;
    name: string;
    frequency: string;
    level: AuthorityLevel;
    entityId: string;
    effectiveDate: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

// --- AUDIT & INSPECTION TYPES ---
export type AuditTaskStatus = 'Scheduled' | 'In Progress' | 'Under Review' | 'Completed' | 'Released' | 'Overdue';

export interface AuditQuestion {
  id: string;
  text: string;
  clause: string;
  response?: 'Yes' | 'No' | 'NA';
  findings?: string;
  evidenceUrls?: string[];
  severity?: 'Minor' | 'Major' | 'Critical';
}

export interface AuditObservation {
  questionId: string;
  questionText: string;
  sectionTitle: string;
  pageTitle: string;
  marksObtained: number;
  marksMax: number;
  selectedResponse: string;
  comment: string;
  images: string[];
  location: string;
  department: string;
  risk: string;
  category: string;
  closureStatus: 'Open' | 'Closed';
  closureComments?: string;
  closureEvidence?: string[];
  responsibility?: string[];
  checklistName?: string;
  entryId?: string;
  selectedResponseIndex?: number | null;
  createdAtMs?: number;
  isRepeat?: boolean;
  repeatOriginalDate?: string;
  repeatTrail?: { date: string; comment: string }[];
  repeatSourceId?: string;
  managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
  resourceRequired?: boolean;
}

export interface AuditTask {
  id: string;
  title: string;
  unitId: string;
  unitName: string;
  department: string;
  auditorId: string;
  auditorName: string;
  scheduledDate: string;
  status: AuditTaskStatus;
  progress: number;
  checklistId: string;
  checklistName: string;
  questions: AuditQuestion[];
  startTime?: string;
  endTime?: string;
  score?: number;
  scoreObtained?: number;
  scoreMax?: number;
  auditorSignature?: string;
  managerSignature?: string;
  summary?: string;
  groupId?: string;
  assignedLocations?: string[];
  isCombinedAudit?: boolean;
  createdAt?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewRequired?: boolean;
  submittedForReviewAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  reviewerSignature?: string;
  releasedAt?: string;
  sentBackAt?: string;
  lastEditedAt?: string;
  observations?: AuditObservation[];
}

// --- EMPLOYEE TYPES ---
export type AccessLevel = 'Unit Admin' | 'Dept Head' | 'Staff';

export interface EmployeeHistory {
  date: string;
  action: string;
  details: string;
}

export interface Employee {
  id: string;
  Corporate: string;
  Regional: string;
  Unit: string;
  Name: string;
  ID: string;
  Gender: string;
  JoinedDate: string;
  BirthDate: string;
  Email: string;
  Phone: string;
  Department: string;
  Role: string;
  Category: string;
  FoodHandler: string;
  Status: "Active" | "Inactive";
  accessLevel: AccessLevel;
  inactiveComment?: string;
  lastUpdated: string;
  history: EmployeeHistory[];
  similarity?: number;
  matchedWith?: { name: string; id: string; department: string };
}

// --- FOOD TEMP RECORD TYPES ---
export interface FoodTempLog {
  id: string;
  date: string;
  time: string;
  temperature: number;
  recordedBy: string;
  signature?: string;
  tempImage?: string; 
  comments?: string;
  isVerified: boolean;
  verifiedBy?: string;
  verificationComments?: string;
  verificationSignature?: string;
}

export interface EquipmentTempRecord {
  id: string;
  name: string;
  idNumber: string;
  type: 'Chiller' | 'Freezer';
  location: string;
  department: string;
  targetRange: { min: number; max: number };
  status: 'Operational' | 'Maintenance' | 'Alert';
  logs: FoodTempLog[];
  workingHours?: { start: string; end: string }; 
}

// --- TRACEABILITY TYPES ---
export type TraceStepType = 'Thawing' | 'Cooking' | 'Cooling' | 'Reheating' | 'Holding' | 'Serving' | 'Location 1' | 'Location 2' | 'Direct Serving';
export type TraceStepStatus = 'pending' | 'active' | 'completed' | 'critical';

export interface TraceStep {
  type: TraceStepType;
  status: TraceStepStatus;
  data?: {
    temp?: number;
    initialTemp?: number;
    time?: string;
    startTime?: string;
    staff?: string;
    remarks?: string;
    duration?: string;
    equipment?: string;
    customerTable?: string;
    method?: string;
  };
  completedAt?: string;
  completedBy?: string;
}

export interface TraceBatch {
  id: string;
  batchId: string; 
  productName: string;
  quantity: number;
  unit: string;
  currentStepIndex: number;
  steps: TraceStep[];
  startedAt: string;
  lastUpdate: string;
  isFlagged: boolean;
}

// --- COOKING RECORD TYPES ---
export interface CookingSplitRecord {
  childId: string;
  name: string;
  quantity: number;
  timestamp: string;
}

export interface CookingRecordEntry {
  uuid: string;
  status: 'THAWED' | 'IN_PROGRESS' | 'COMPLETED';
  outletId: number;
  corporateName: string;
  regionName: string;
  unitName: string;
  departmentName: string;
  locationName: string;
  productId: string;
  productName: string;
  sourceProductName: string;
  brandName: string;
  category: string;
  batchNumber: string;
  totalThawedQty: number;
  availableThawedQty: number;
  cookingQuantity: number;
  storedUnit: string;
  method: string;
  cookingPurpose: string;
  thawStartTime: string;
  thawCompletedTime: string;
  cookStart: string;
  initialTemp: number | string;
  initialTempImg?: string;
  cookingVessel: string;
  initiatedBy: string;
  cookComments?: string;
  cookCompleted: string;
  finalTemp: number | string;
  finalTempImg?: string;
  completedBy: string;
  isVerified: boolean;
  verifierName?: string;
  verificationComments?: string;
  verifierSignature?: string;
  verificationDate?: string;
  issued: any[]; 
  parentThawId?: string;
  parentName?: string;
  parentTotalQty?: number;
  parentAvailableQty?: number;
  splits?: CookingSplitRecord[];
  splitSequence?: number;
  sourceThawIds?: string[];
  initiatedBySign?: string;
  completedBySign?: string;
  mfgDate?: string;
  expDate?: string;
  thawingMethod?: string;
  thawStartTemp?: number;
  thawFinalTemp?: number;
}

// --- COOLING RECORD TYPES ---
export interface CoolingIssuedItem {
  id: string;
  purpose: string;
  quantity: number;
  timestamp: string;
  user: string;
}

export interface CoolingRecordEntry {
  uuid: string;
  status: 'NOT_STARTED' | 'INITIAL' | 'STAGE_1' | 'COMPLETED';
  isVerified?: boolean;
  outletId: string;
  corporateName: string;
  regionName: string;
  unitName: string;
  departmentName: string;
  locationName: string;
  productId: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  remainingQuantity: number;
  storedUnit: string;
  cookingEndTime: string;
  cookTemp: number;
  
  // Ancestry Fields
  mfgDate?: string;
  expDate?: string;
  thawingMethod?: string;
  thawStartTemp?: number;
  thawFinalTemp?: number;
  cookingTimeLapse?: string;

  thawStartTime?: string;
  thawCompletedTime?: string;

  // Thawing Traceability
  motherThawQty?: number;
  motherThawUnit?: string;
  sisterThawSplits?: { location: string; quantity: number; timestamp: string }[];

  // Cooking Traceability
  cookingQty?: number;
  cookingStartTime?: string;
  cookingVessel?: string;
  cookingSplits?: { purpose: string; quantity: number; timestamp: string }[];
  startTime?: string;
  initialTemp?: number;
  initialTempImg?: string;
  method?: string;
  vesselId?: string;
  initiatedBy?: string;
  initiationSign?: string;
  operatorComments?: string;
  ambientLapse?: string;
  stage1Time?: string;
  stage1Temp?: number;
  stage1TempImg?: string;
  stage1Sign?: string;
  stage1By?: string;
  stage1Comments?: string;
  finalTime?: string;
  finalTemp?: number;
  finalTempImg?: string;
  finalSign?: string;
  finalBy?: string;
  finalComments?: string;
  shelfLifeExpiry?: string;
  verifierName?: string;
  verificationComments?: string;
  verifierSignature?: string;
  verificationDate?: string;
  issued: CoolingIssuedItem[];
}

// --- REHEATING RECORD TYPES ---
export interface ReheatedItem {
    purpose: string;
    quantity: number;
}

export interface ReheatingEntry {
    uuid: string;
    status: 'READY' | 'IN_PROGRESS' | 'DUE_VERIFICATION' | 'COMPLETED';
    corporate: string;
    regional: string;
    unit: string;
    department: string;
    location: string;
    productName: string;
    category: string;
    sourceProductName: string;
    batchNumber: string;
    standardRecipe: string;
    reheatingVessel: string;
    reheatingQuantity: number;
    method: string;
    reheatStart: string;
    reheatCompleted: string;
    initialTemp: number;
    finalTemp?: number;
    duration: string;
    completedBy: string;
    reheatingPurpose: string;
    correctiveAction?: string;
    verifierName?: string;
    verificationComments?: string;
    verifierSignature?: string;
    issued: ReheatedItem[];
    thawTime: string;
    cookTime: string;
    cookTemp: number;
    coolTime: string;
    coolTemp: number;
    completedBySign?: string;
    mfgDate?: string;
    expDate?: string;
}

// --- FOOD HOLDING TYPES ---
export interface FoodHoldingEntry {
  uuid: string;
  status: 'READY' | 'INITIATED' | 'MONITORED' | 'COMPLETED';
  type: 'HOT' | 'COLD';
  date: string;
  locationName: string;
  departmentName: string;
  unitName: string;
  regionName: string;
  productName: string;
  batchNumber: string;
  startTime?: string;
  startTemp?: number;
  startTempImg?: string;
  monitoringTime?: string;
  monitoringTemp?: number;
  terminalTime?: string;
  terminalTemp?: number;
  terminalTempImg?: string;
  operatorName?: string;
  operatorSignature?: string;
  operatorComments?: string;
  isVerified: boolean;
  verifierName?: string;
  verifierSignature?: string;
  verifierComments?: string;
  verificationDate?: string;
}

// --- SANITIZATION RECORD TYPES ---
export interface SanitizationRecordEntry {
  uuid: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  isVerified: boolean;
  regional: string;
  unit: string;
  department: string;
  location: string;
  date: string;
  time: string;
  startTime?: string; 
  endTime?: string;   
  productName: string;
  categoryName: string; 
  chemicalName: string;
  concentration: string; 
  contactTime: string; 
  photos: string[];
  userName: string;
  userSignature?: string;
  userComments?: string;
  verifierName?: string;
  verifierSignature?: string;
  verifierComments?: string;
  verificationDate?: string;
}

// --- YIELD REGISTER TYPES ---
export interface YieldStorage {
  type: string;
  qty: number;
  outlet?: string;
}

export interface YieldVariant {
  id: number;
  yieldName: string;
  weight: number;
  storage: YieldStorage[];
}

export interface YieldProduct {
  id: string;
  productName: string;
  vendorName: string;
  brandName: string;
  receivingDate: string;
  batchNumber: string;
  processingDate: string;
  expiryDate: string;
  tags: string[];
  uploadedBy: string;
  totalWeight: number;
  balanceWeight: number;
  lastUpdated: string;
  specificationName: string | null;
  variants: YieldVariant[];
}

// --- RECEIVING REGISTER TYPES ---
export interface ReceivingEntry {
  id: string;
  rec: string; 
  date: string;
  time: string;
  materialName: string;
  brand: string;
  vendor: string;
  invoiceNo: string;
  poNumber?: string;
  batchNo: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  mfgDate: string;
  expDate: string;
  temperature?: number;
  tempImageSrc?: string | null;
  receiver?: string;
  receiverSignature?: string | null;
  discrepancyType?: string;
  rejectionRemarks?: string;
  correctiveAction?: string;
  condition?: string;
  qcStatus?: string;
  status?: string;
  verified?: boolean;
  verifiedBy?: string;
  verificationComments?: string;
  verificationDate?: string;
  signatureData?: string;
  vendorEval?: number;
  unitId?: string;
  attachments: {
    invoice: boolean;
    formE: boolean;
    coa: boolean;
  };
}

// --- SUPPLIER SUBMISSION TYPES ---
export type SupplierSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface SupplierSubmission {
  id: string;
  unitId: string;
  supplierId: string;
  supplierName: string;
  materialName: string;
  brand: string;
  batchNo: string;
  quantity: number;
  unit: string;
  expectedDeliveryDate: string;
  mfgDate?: string;
  expiryDate?: string;
  status: SupplierSubmissionStatus;
  reviewerComments?: string;
  temperature?: number;
  tempImageSrc?: string | null;
  correctiveAction?: string;
  coaFile?: string | null;
  invoiceFile?: string | null;
  formEFile?: string | null;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  promotedRecordId?: string;
}

// --- NAVIGATION & PERMISSIONS ---
export interface SubNavItem {
  id: string;
  label: string;
  allowedScopes?: HierarchyScope[];
  allowedSubscriptions?: SubscriptionType[];
  requiredSubscription?: SubscriptionType;
  allowedIndustries?: IndustryType[];
  allowedEntityIds?: string[];
  deniedEntityIds?: string[];
}

export interface NavItem extends SubNavItem {
  subItems: SubNavItem[];
}

export interface AuthState {
  isLoggedIn: boolean;
  scope: HierarchyScope;
  entityId?: string | null;
  email?: string;
  userName?: string;
}

// --- ENTITY & CONTACT ---
export interface EntityContact {
  name: string;
  role: string;
  email: string;
  phone: string;
  password?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: HierarchyScope;
  industryType?: IndustryType;
  location: string;
  compliance: number;
  issuesCount: number;
  status: EntityStatus;
  parentId?: string;
  subscriptionType?: SubscriptionType;
  subscribedDate?: string;
  subscriptionEndDate?: string;
  address?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  description?: string;
  masterDepartments?: string[];
  masterRoles?: string[];
  masterCategories?: { name: string; workforce: 'core' | 'extended' }[];
  masterSops?: SopDefinition[];
  masterBrands?: Brand[];
  autoRenewal?: boolean;
  regionCount?: number;
  unitCount?: number;
  deptCount?: number;
  userCount?: number;
  metrics?: any;
  departmentLocations?: Record<string, string[]>;
  departmentSubLocations?: Record<string, string[]>;
  locationAssignments?: Record<string, Record<string, string[]>>;
  escalationMatrixOverrides?: any;
}

// --- BRAND & SUPPLIER ---
export interface Brand {
  id: string;
  name: string;
  logo?: string;
  description: string;
  status: 'Active' | 'Pending' | 'Provisional' | 'Rejected' | 'Flagged';
  addedByUnitId: string;
  addedByUnitName: string;
  addedByUserName: string;
  createdAt: string;
  similarityScore?: number;
  corporateId?: string;
  supplierIds?: string[];
  adoptedByUnitIds?: string[];
}

export interface SupplierLink {
    id?: string;
    name: string;
    status: 'Active' | 'Inactive';
}

export interface Supplier {
  id: string;
  name: string;
  uploadedBy: string;
  serviceNature: string;
  email: string;
  phone: string;
  fssai: string;
  fssaiStatus: string;
  fssaiExpiry?: string;
  address: string;
  updatedOn: string;
  accepted: boolean;
  type: string;
  contractNo: string;
  startDate: string;
  endDate: string;
  uploadStatus: string;
  risk: 'High' | 'Medium' | 'Low';
  totalItems: number;
  auditScore: number;
  auditMax: number;
  auditFreq: string;
  lastAudit: string;
  nextAuditDate?: string;
  ncClosed: number;
  ncOpen: number;
  evalScore: number;
  evalTarget: number;
  evalFreq: string;
  lastEval: string;
  complaints: number;
  lastComplaint: string;
  status: 'Active' | 'Inactive';
  locationPath: string;
  unitId?: string;
  portalPin?: string;
  licenseHistory?: any[];
  contractHistory?: any[];
  auditHistory?: any[];
  evalHistory?: any[];
}

// --- STOCK & INVENTORY ---
export interface StockBatch {
    id: string;
    number: string;
    locCode: string;
    qty: number;
    mfg: string;
    exp: string;
    vendor?: string;
    brand?: string;
    receivingDate?: string;
}

export interface StockTransaction {
    id: string;
    type: 'IN' | 'OUT';
    reason: string;
    amount: number;
    date: string;
    location?: string;
    issuedTo?: string;
    vendor?: string;
    thawing?: boolean;
    openingTotal: number;
    closingTotal: number;
    openingBatches: StockBatch[];
    closingBatches: StockBatch[];
    details: any[];
    comments?: string;
    signature?: string;
    sourceNode?: string;
    destinationNode?: string;
}

export interface StockItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  defaultLocation: string;
  batches: StockBatch[];
  transactions: StockTransaction[];
}

// --- DEPT STOCK ---
export interface DeptStockBatch {
    id: string;
    number: string;
    location: string;
    quantity: number;
    mfgDate: string;
    expDate: string;
    receivingDate: string;
}

export interface DeptStockTransaction {
    id: string;
    type: 'IN' | 'OUT';
    reason: string;
    amount: number;
    date: string;
    sourceNode: string;
    destinationNode: string;
    openingTotal: number;
    closingTotal: number;
    openingBatches: DeptStockBatch[];
    closingBatches: DeptStockBatch[];
    details: any[];
    signature?: string;
    comments?: string;
}

export interface DeptStockItem {
    id: string;
    name: string;
    unit: string;
    batches: DeptStockBatch[];
    transactions: DeptStockTransaction[];
}

// --- LICENSE & CERTIFICATION ---
export interface SubCategory {
    id: string;
    name: string;
    active: boolean;
    createdByScope: HierarchyScope;
    createdByEntityId?: string | null;
    subSubs?: { id: string; name: string }[];
}

export interface Category {
  id: string;
  name: string;
  active: boolean;
  hiddenInConfig?: boolean;
  createdByScope: HierarchyScope;
  createdByEntityId?: string | null;
  subs: SubCategory[];
}

// --- RAW MATERIAL ---
export interface CoaRecord {
  id: string;
  fileName: string;
  batchNumber: string;
  manufacturingDate: string;
  testingDate: string;
  expiryDate: string;
  uploadedBy: string;
  uploadedAt: string;
  fileData?: string;
}

export interface MaterialBrand {
    id: string;
    name: string;
    status: 'Active' | 'Inactive';
    allergens: string;
    storage: string;
    shelfLife: string;
    specialHandling: string;
    testingDate: string;
    coaStatus: string;
    coaRecords?: CoaRecord[];
    lastReceived: string;
    vendor: string;
    linkedSuppliers: SupplierLink[];
    qtyAccRej: string;
    formE: string;
    reviewedOn: string;
    complianceStatus: 'Compliant' | 'Non-Compliant' | 'Pending' | 'Provisional';
    nextReview: string;
    openPoints: number;
    auditTrail: any[];
    dietaryType?: 'Veg' | 'Non-Veg';
    energy?: string;
    protein?: string;
    carb?: string;
    fat?: string;
    image?: string;
    images?: string[];
    collageImage?: string;
    nutritionPanelImages?: string[];
    ingredientsLabelImages?: string[];
}

export interface RawMaterial {
  id: string;
  name: string;
  organization: string;
  updatedOn: string;
  uploadedBy: string;
  accepted: boolean;
  risk: 'High' | 'Medium' | 'Low' | 'NA';
  riskActive: boolean;
  yield: boolean;
  stockable: boolean;
  vendors: string[];
  brands: MaterialBrand[];
  isActive?: boolean;
  createdByEntityId?: string;
  createdByScope?: HierarchyScope;
  specifications?: string[];
  discrepancyType?: string;
  rejectionRemarks?: string;
}

// --- RAW MATERIAL SPECIFICATION ---
export interface SpecSection {
    id: string;
    title: string;
    content: string;
}

export interface RawMaterialSpecification {
  id: string;
  genericName: string;
  technicalFunctionName?: string;
  sections: SpecSection[];
  linkedRawMaterialId?: string;
  linkedRawMaterialName?: string;
  createdAt: string;
  updatedAt: string;
}

// --- SOP & DOCUMENTATION ---
export interface SopSection {
  id: string;
  title: string;
  content: string;
}

export interface SopContent {
  version: string;
  lastReviewDate: string;
  sections: SopSection[];
}

export interface SubTopicEntry {
  name: string;
  createdByScope: 'corporate' | 'regional' | 'unit';
  createdByEntityId: string;
}

export interface SopDefinition {
  id: string;
  name: string;
  subTopics: string[];
  subTopicEntries?: SubTopicEntry[];
  content?: SopContent;
  createdByScope?: 'corporate' | 'regional' | 'unit';
  createdByEntityId?: string;
}

// --- ESCALATION ---
export interface EscalationContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface EscalationLevel {
  level: number;
  timeframe: string;
  contacts: EscalationLevel[];
}

export type NotificationConditionType =
  | 'on_create'
  | 'on_status_change'
  | 'on_verification'
  | 'on_rejection'
  | 'on_temp_breach'
  | 'on_time_exceeded'
  | 'on_expiry_approaching'
  | 'on_non_compliance'
  | 'on_completion'
  | 'on_approval'
  | 'on_overdue'
  | 'on_escalation';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';

export interface NotificationCondition {
  id: string;
  type: NotificationConditionType;
  label: string;
  enabled: boolean;
  severity: NotificationSeverity;
  channels: NotificationChannel[];
  recipients: string[];
  customMessage?: string;
  thresholdValue?: number;
  thresholdUnit?: string;
  cooldownMinutes?: number;
  repeatEnabled?: boolean;
  repeatIntervalMinutes?: number;
}

export interface ModuleNotificationConfig {
  moduleId: string;
  moduleLabel: string;
  enabled: boolean;
  conditions: NotificationCondition[];
}
