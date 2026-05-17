"use client";

import React, { useState, useMemo } from "react";
import {
  Bell,
  BellRing,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Settings,
  Smartphone,
  Mail,
  MessageSquare,
  Users,
  Clock,
  Repeat,
  Save,
  X,
  Plus,
  Minus,
  Info,
  Thermometer,
  Timer,
  ClipboardCheck,
  Zap,
} from "lucide-react";
import {
  ModuleNotificationConfig,
  NotificationCondition,
  NotificationConditionType,
  NotificationSeverity,
  NotificationChannel,
} from "../types";

interface NotificationSettingsProps {
  currentScope: string;
}

const SEVERITY_CONFIG: Record<
  NotificationSeverity,
  { label: string; color: string; dot: string; bg: string }
> = {
  info: {
    label: "Info",
    color: "text-blue-600",
    dot: "bg-blue-500",
    bg: "bg-blue-50 border-blue-200",
  },
  warning: {
    label: "Warning",
    color: "text-amber-600",
    dot: "bg-amber-500",
    bg: "bg-amber-50 border-amber-200",
  },
  critical: {
    label: "Critical",
    color: "text-red-600",
    dot: "bg-red-500",
    bg: "bg-red-50 border-red-200",
  },
};

const CHANNEL_CONFIG: Record<
  NotificationChannel,
  { label: string; icon: React.ReactNode }
> = {
  in_app: { label: "In-App", icon: <Bell size={12} /> },
  push: { label: "Push", icon: <Smartphone size={12} /> },
  email: { label: "Email", icon: <Mail size={12} /> },
  sms: { label: "SMS", icon: <MessageSquare size={12} /> },
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  "Record Keeping": { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  "Inspections & Audits": { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
  Facilities: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
};

interface ModuleDefinition {
  moduleId: string;
  moduleLabel: string;
  category: string;
  conditions: { type: NotificationConditionType; label: string; defaultEnabled: boolean; defaultSeverity: NotificationSeverity }[];
}

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    moduleId: "receiving-register",
    moduleLabel: "Receiving Register",
    category: "Record Keeping",
    conditions: [
      { type: "on_create", label: "New intake logged", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_verification", label: "Intake verified/rejected", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_rejection", label: "Material rejected", defaultEnabled: true, defaultSeverity: "warning" },
      { type: "on_temp_breach", label: "Temperature out of range", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_non_compliance", label: "Vendor compliance fail", defaultEnabled: true, defaultSeverity: "critical" },
    ],
  },
  {
    moduleId: "thawing-record",
    moduleLabel: "Thawing Record",
    category: "Record Keeping",
    conditions: [
      { type: "on_create", label: "Thawing initiated", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_time_exceeded", label: "Thawing time limit exceeded", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_completion", label: "Thawing completed", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_verification", label: "Record verified", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_temp_breach", label: "Temperature breach during thawing", defaultEnabled: true, defaultSeverity: "critical" },
    ],
  },
  {
    moduleId: "cooking-record",
    moduleLabel: "Cooking Record",
    category: "Record Keeping",
    conditions: [
      { type: "on_create", label: "Cooking started", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_completion", label: "Cooking completed", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_temp_breach", label: "Core temp not reached", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_verification", label: "Record verified", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_non_compliance", label: "Process deviation", defaultEnabled: true, defaultSeverity: "warning" },
    ],
  },
  {
    moduleId: "cooling-record",
    moduleLabel: "Cooling Record",
    category: "Record Keeping",
    conditions: [
      { type: "on_create", label: "Cooling initiated", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_time_exceeded", label: "Cooling time exceeded", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_temp_breach", label: "Target temp not reached", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_completion", label: "Cooling completed", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_verification", label: "Record verified", defaultEnabled: false, defaultSeverity: "info" },
    ],
  },
  {
    moduleId: "reheating-record",
    moduleLabel: "Reheating Record",
    category: "Record Keeping",
    conditions: [
      { type: "on_create", label: "Reheating started", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_temp_breach", label: "Reheat temp insufficient", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_completion", label: "Reheating done", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_verification", label: "Record verified", defaultEnabled: false, defaultSeverity: "info" },
    ],
  },
  {
    moduleId: "food-holding-record",
    moduleLabel: "Food Holding Record",
    category: "Record Keeping",
    conditions: [
      { type: "on_create", label: "Holding started", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_time_exceeded", label: "Max hold time exceeded", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_temp_breach", label: "Holding temp out of range", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_completion", label: "Holding ended", defaultEnabled: false, defaultSeverity: "info" },
    ],
  },
  {
    moduleId: "chiller-freezer-record",
    moduleLabel: "Chiller/Freezer Record",
    category: "Record Keeping",
    conditions: [
      { type: "on_temp_breach", label: "Equipment temp breach", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_time_exceeded", label: "Door open too long", defaultEnabled: true, defaultSeverity: "warning" },
      { type: "on_non_compliance", label: "Equipment failure", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_escalation", label: "Repeated breach alert", defaultEnabled: true, defaultSeverity: "critical" },
    ],
  },
  {
    moduleId: "sanitization-record",
    moduleLabel: "Sanitization Record",
    category: "Record Keeping",
    conditions: [
      { type: "on_create", label: "Sanitation logged", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_overdue", label: "Sanitation overdue", defaultEnabled: true, defaultSeverity: "warning" },
      { type: "on_verification", label: "Record verified", defaultEnabled: false, defaultSeverity: "info" },
    ],
  },
  {
    moduleId: "observations",
    moduleLabel: "Observations",
    category: "Inspections & Audits",
    conditions: [
      { type: "on_create", label: "New observation", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_status_change", label: "Observation status changed", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_escalation", label: "Observation escalated", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_overdue", label: "Observation overdue", defaultEnabled: true, defaultSeverity: "warning" },
    ],
  },
  {
    moduleId: "my-audits",
    moduleLabel: "My Audits",
    category: "Inspections & Audits",
    conditions: [
      { type: "on_create", label: "Audit assigned", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_status_change", label: "Audit status changed", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_completion", label: "Audit completed", defaultEnabled: false, defaultSeverity: "info" },
      { type: "on_overdue", label: "Audit overdue", defaultEnabled: true, defaultSeverity: "warning" },
      { type: "on_approval", label: "Audit report approved", defaultEnabled: false, defaultSeverity: "info" },
    ],
  },
  {
    moduleId: "follow-up",
    moduleLabel: "Follow Up",
    category: "Inspections & Audits",
    conditions: [
      { type: "on_create", label: "Follow-up created", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_overdue", label: "Follow-up overdue", defaultEnabled: true, defaultSeverity: "warning" },
      { type: "on_completion", label: "Follow-up resolved", defaultEnabled: false, defaultSeverity: "info" },
    ],
  },
  {
    moduleId: "cleaning-checklist",
    moduleLabel: "Cleaning Checklist",
    category: "Facilities",
    conditions: [
      { type: "on_create", label: "Cleaning logged", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_overdue", label: "Cleaning overdue", defaultEnabled: true, defaultSeverity: "warning" },
      { type: "on_verification", label: "Cleaning verified", defaultEnabled: false, defaultSeverity: "info" },
    ],
  },
  {
    moduleId: "preventive-maintenance",
    moduleLabel: "Preventive Maintenance",
    category: "Facilities",
    conditions: [
      { type: "on_create", label: "Maintenance scheduled", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_overdue", label: "Maintenance overdue", defaultEnabled: true, defaultSeverity: "warning" },
      { type: "on_completion", label: "Maintenance done", defaultEnabled: false, defaultSeverity: "info" },
    ],
  },
  {
    moduleId: "calibration",
    moduleLabel: "Calibration",
    category: "Facilities",
    conditions: [
      { type: "on_create", label: "Calibration due", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_overdue", label: "Calibration overdue", defaultEnabled: true, defaultSeverity: "warning" },
      { type: "on_non_compliance", label: "Calibration fail", defaultEnabled: true, defaultSeverity: "critical" },
    ],
  },
  {
    moduleId: "pest-management",
    moduleLabel: "Pest Management",
    category: "Facilities",
    conditions: [
      { type: "on_create", label: "Pest activity logged", defaultEnabled: true, defaultSeverity: "info" },
      { type: "on_escalation", label: "Pest level escalated", defaultEnabled: true, defaultSeverity: "critical" },
      { type: "on_overdue", label: "Treatment overdue", defaultEnabled: true, defaultSeverity: "warning" },
    ],
  },
];

const buildInitialConfigs = (): ModuleNotificationConfig[] => {
  return MODULE_DEFINITIONS.map((mod) => ({
    moduleId: mod.moduleId,
    moduleLabel: mod.moduleLabel,
    enabled: true,
    conditions: mod.conditions.map((c) => ({
      id: `${mod.moduleId}-${c.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: c.type,
      label: c.label,
      enabled: c.defaultEnabled,
      severity: c.defaultSeverity,
      channels: ["in_app"] as NotificationChannel[],
      recipients: [],
      customMessage: "",
      thresholdValue: undefined,
      thresholdUnit: undefined,
      cooldownMinutes: 15,
      repeatEnabled: false,
      repeatIntervalMinutes: 60,
    })),
  }));
};

const getCategoryForModule = (moduleId: string): string => {
  const def = MODULE_DEFINITIONS.find((m) => m.moduleId === moduleId);
  return def?.category || "Record Keeping";
};

const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: (val: boolean) => void;
  size?: "sm" | "md";
}> = ({ enabled, onChange, size = "md" }) => {
  const dims = size === "sm" ? "w-8 h-[18px]" : "w-10 h-[22px]";
  const circle =
    size === "sm"
      ? "w-3.5 h-3.5 top-[2px]"
      : "w-4 h-4 top-[3px]";
  const translate = size === "sm" ? "translate-x-[14px]" : "translate-x-[18px]";

  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`${dims} rounded-full relative transition-colors duration-200 shrink-0 ${
        enabled ? "bg-indigo-600" : "bg-slate-300"
      }`}
    >
      <div
        className={`${circle} bg-white rounded-full absolute left-[3px] transition-transform duration-200 shadow-sm ${
          enabled ? translate : "translate-x-0"
        }`}
      />
    </button>
  );
};

const RecipientInput: React.FC<{
  recipients: string[];
  onChange: (val: string[]) => void;
}> = ({ recipients, onChange }) => {
  const [inputVal, setInputVal] = useState("");

  const addRecipient = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !recipients.includes(trimmed)) {
      onChange([...recipients, trimmed]);
    }
    setInputVal("");
  };

  const removeRecipient = (r: string) => {
    onChange(recipients.filter((x) => x !== r));
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {recipients.map((r) => (
        <span
          key={r}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wide rounded-full border border-indigo-200"
        >
          {r}
          <button
            type="button"
            onClick={() => removeRecipient(r)}
            className="hover:text-red-500 transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRecipient();
            }
          }}
          placeholder="Add recipient..."
          className="w-24 px-2 py-1 text-[10px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
        />
        <button
          type="button"
          onClick={addRecipient}
          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
};

const ConditionRow: React.FC<{
  condition: NotificationCondition;
  onUpdate: (updated: NotificationCondition) => void;
  moduleEnabled: boolean;
}> = ({ condition, onUpdate, moduleEnabled }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isDisabled = !moduleEnabled;

  const updateField = <K extends keyof NotificationCondition>(
    key: K,
    value: NotificationCondition[K]
  ) => {
    onUpdate({ ...condition, [key]: value });
  };

  const toggleChannel = (ch: NotificationChannel) => {
    const current = condition.channels;
    if (current.includes(ch)) {
      updateField(
        "channels",
        current.filter((c) => c !== ch)
      );
    } else {
      updateField("channels", [...current, ch]);
    }
  };

  const severityCfg = SEVERITY_CONFIG[condition.severity];

  return (
    <div
      className={`border rounded-xl p-3 lg:p-4 transition-all ${
        isDisabled
          ? "opacity-40 pointer-events-none bg-slate-50"
          : condition.enabled
          ? "bg-white border-slate-200 shadow-sm"
          : "bg-slate-50/50 border-slate-100"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-3 lg:w-[220px] shrink-0">
          <ToggleSwitch
            enabled={condition.enabled}
            onChange={(val) => updateField("enabled", val)}
            size="sm"
          />
          <span
            className={`text-[11px] font-bold uppercase tracking-tight ${
              condition.enabled ? "text-slate-800" : "text-slate-400"
            }`}
          >
            {condition.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative">
            <select
              value={condition.severity}
              onChange={(e) =>
                updateField("severity", e.target.value as NotificationSeverity)
              }
              className={`appearance-none text-[9px] font-black uppercase tracking-wider pl-5 pr-6 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-300 ${severityCfg.bg}`}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <div
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${severityCfg.dot}`}
            />
            <ChevronDown
              size={10}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          <div className="flex items-center gap-1">
            {(Object.keys(CHANNEL_CONFIG) as NotificationChannel[]).map(
              (ch) => {
                const cfg = CHANNEL_CONFIG[ch];
                const isActive = condition.channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide border transition-all ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {cfg.icon}
                    <span className="hidden lg:inline">{cfg.label}</span>
                  </button>
                );
              }
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="ml-auto p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Advanced settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Recipients
            </label>
            <RecipientInput
              recipients={condition.recipients}
              onChange={(val) => updateField("recipients", val)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                Threshold Value
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={condition.thresholdValue ?? ""}
                  onChange={(e) =>
                    updateField(
                      "thresholdValue",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  placeholder="e.g. 65"
                  className="w-full px-3 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <input
                  type="text"
                  value={condition.thresholdUnit ?? ""}
                  onChange={(e) =>
                    updateField("thresholdUnit", e.target.value || undefined)
                  }
                  placeholder="°C"
                  className="w-16 px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                Cooldown (min)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateField(
                      "cooldownMinutes",
                      Math.max(0, (condition.cooldownMinutes || 0) - 5)
                    )
                  }
                  className="p-1 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-lg"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="number"
                  value={condition.cooldownMinutes ?? 15}
                  onChange={(e) =>
                    updateField("cooldownMinutes", Number(e.target.value))
                  }
                  className="w-16 text-center px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateField(
                      "cooldownMinutes",
                      (condition.cooldownMinutes || 0) + 5
                    )
                  }
                  className="p-1 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-lg"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                Repeat
              </label>
              <div className="flex items-center gap-2">
                <ToggleSwitch
                  enabled={condition.repeatEnabled || false}
                  onChange={(val) => updateField("repeatEnabled", val)}
                  size="sm"
                />
                {condition.repeatEnabled && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-400 font-bold">Every</span>
                    <input
                      type="number"
                      value={condition.repeatIntervalMinutes ?? 60}
                      onChange={(e) =>
                        updateField(
                          "repeatIntervalMinutes",
                          Number(e.target.value)
                        )
                      }
                      className="w-14 text-center px-1 py-1 text-[10px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                    <span className="text-[9px] text-slate-400 font-bold">min</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Custom Message
            </label>
            <textarea
              value={condition.customMessage ?? ""}
              onChange={(e) => updateField("customMessage", e.target.value)}
              placeholder="Override default notification message..."
              rows={2}
              className="w-full px-3 py-2 text-[11px] border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ModuleCard: React.FC<{
  config: ModuleNotificationConfig;
  onToggleModule: (moduleId: string) => void;
  onUpdateCondition: (
    moduleId: string,
    conditionId: string,
    updated: NotificationCondition
  ) => void;
}> = ({ config, onToggleModule, onUpdateCondition }) => {
  const [expanded, setExpanded] = useState(false);
  const category = getCategoryForModule(config.moduleId);
  const catStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES["Record Keeping"];
  const activeCount = config.conditions.filter((c) => c.enabled).length;

  return (
    <div
      className={`rounded-2xl border transition-all ${
        config.enabled
          ? "bg-white border-slate-200 shadow-sm hover:shadow-md"
          : "bg-slate-50/80 border-slate-100"
      }`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <button
          type="button"
          className="text-slate-400 transition-transform"
          style={{
            transform: expanded ? "rotate(0deg)" : "rotate(0deg)",
          }}
        >
          {expanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={`text-xs font-black uppercase tracking-tight ${
                config.enabled ? "text-slate-800" : "text-slate-400"
              }`}
            >
              {config.moduleLabel}
            </h3>
            <span
              className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text}`}
            >
              {category}
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
            {activeCount} of {config.conditions.length} conditions active
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {activeCount > 0 && config.enabled && (
            <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
              <Zap size={10} className="text-emerald-600" />
              <span className="text-[9px] font-black text-emerald-700">
                {activeCount} ACTIVE
              </span>
            </div>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <ToggleSwitch
              enabled={config.enabled}
              onChange={() => onToggleModule(config.moduleId)}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="border-t border-slate-100 pt-3" />
          {config.conditions.map((cond) => (
            <ConditionRow
              key={cond.id}
              condition={cond}
              moduleEnabled={config.enabled}
              onUpdate={(updated) =>
                onUpdateCondition(config.moduleId, cond.id, updated)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  currentScope,
}) => {
  const [configs, setConfigs] = useState<ModuleNotificationConfig[]>(
    buildInitialConfigs
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isSaved, setIsSaved] = useState(false);

  const totalActiveRules = useMemo(() => {
    return configs.reduce((acc, mod) => {
      if (!mod.enabled) return acc;
      return acc + mod.conditions.filter((c) => c.enabled).length;
    }, 0);
  }, [configs]);

  const enabledModulesCount = useMemo(() => {
    return configs.filter((m) => m.enabled).length;
  }, [configs]);

  const categories = useMemo(() => {
    const cats = new Set(
      MODULE_DEFINITIONS.map((m) => m.category)
    );
    return ["all", ...Array.from(cats)];
  }, []);

  const filteredConfigs = useMemo(() => {
    return configs.filter((config) => {
      const matchesSearch =
        config.moduleLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.conditions.some((c) =>
          c.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const category = getCategoryForModule(config.moduleId);
      const matchesCategory =
        categoryFilter === "all" || category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [configs, searchTerm, categoryFilter]);

  const handleToggleModule = (moduleId: string) => {
    setConfigs((prev) =>
      prev.map((m) =>
        m.moduleId === moduleId ? { ...m, enabled: !m.enabled } : m
      )
    );
    setIsSaved(false);
  };

  const handleUpdateCondition = (
    moduleId: string,
    conditionId: string,
    updated: NotificationCondition
  ) => {
    setConfigs((prev) =>
      prev.map((m) =>
        m.moduleId === moduleId
          ? {
              ...m,
              conditions: m.conditions.map((c) =>
                c.id === conditionId ? updated : c
              ),
            }
          : m
      )
    );
    setIsSaved(false);
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm">
                <BellRing size={24} className="text-indigo-300" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  Notification Settings
                </h2>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Configure alert conditions for each module
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Active Rules
                </span>
                <span className="text-lg font-black text-white leading-none">
                  {totalActiveRules}
                </span>
              </div>
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Modules Enabled
                </span>
                <span className="text-lg font-black text-white leading-none">
                  {enabledModulesCount}
                  <span className="text-xs text-slate-500 font-bold">
                    /{configs.length}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
        <div className="relative flex-1 w-full lg:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search modules or conditions..."
            className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 shadow-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border transition-all ${
                categoryFilter === cat
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {cat === "all" ? "All Modules" : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredConfigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Search size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-black text-slate-300 uppercase tracking-widest">
              No modules found
            </p>
            <p className="text-[10px] text-slate-400 mt-2">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          filteredConfigs.map((config) => (
            <ModuleCard
              key={config.moduleId}
              config={config}
              onToggleModule={handleToggleModule}
              onUpdateCondition={handleUpdateCondition}
            />
          ))
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:bottom-4 lg:left-auto lg:right-8 z-50">
        <div className="bg-white/80 backdrop-blur-xl border-t lg:border border-slate-200 lg:rounded-2xl p-4 lg:shadow-2xl flex items-center justify-between lg:justify-end gap-4">
          <div className="lg:hidden">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {totalActiveRules} active rules across {enabledModulesCount}{" "}
              modules
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 ${
              isSaved
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isSaved ? (
              <>
                <Check size={14} />
                Configuration Saved
              </>
            ) : (
              <>
                <Save size={14} />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
