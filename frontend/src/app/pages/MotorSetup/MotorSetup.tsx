import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Save } from "lucide-react";
import {
  PageHeader,
  RefreshButton,
  SubTabs,
} from "../../components/wireframe";
import { apiDelete, apiGet, apiPost } from "../../services/apiClient";
import { symToDisplayLabel, buildPortOptions } from "../../services/portLabels";
import { useLeStudioStore } from "../../store";
import { SETUP_MOTORS, ARM_TYPES, toArmSymlink } from "./constants";
import { MotorCard } from "./components/MotorCard";
import { MappingTabPanel } from "./components/MappingTabPanel";
import { SetupTabPanel } from "./components/SetupTabPanel";
import { MonitorTabPanel } from "./components/MonitorTabPanel";
import { CalibrationTabPanel } from "./components/CalibrationTabPanel";
import type {
  ActionResponse,
  ArmDevice,
  CalibrationFileItem,
  CalibrationFileStatusResponse,
  CalibrationListResponse,
  DeviceResponse,
  MotorConnectResponse,
  MotorData,
  MotorPositionsResponse,
  RulesResponse,
} from "./types";

const ARM_ROLE_OPTIONS = ["Follower Arm 1", "Follower Arm 2", "Leader Arm 1", "Leader Arm 2"];

// ─── Main Component ───────────────────────────────────────────────────────────

export function MotorSetup() {
  const procStatus = useLeStudioStore((s) => s.procStatus);
  const setProcStatus = useLeStudioStore((s) => s.setProcStatus);
  const appendLog = useLeStudioStore((s) => s.appendLog);
  const clearLog = useLeStudioStore((s) => s.clearLog);
  const addToast = useLeStudioStore((s) => s.addToast);

  // ── Device data ──────────────────────────────────────────────────────────
  const [arms, setArms] = useState<ArmDevice[]>([]);

  // ── Motor Setup (CLI) ────────────────────────────────────────────────────
  const setupRunning = Boolean(procStatus.motor_setup);
  const calibrateRunning = Boolean(procStatus.calibrate);
  const [setupArmType, setSetupArmType] = useState("so101_follower");
  const [setupPort, setSetupPort] = useState("");
  const [armTypes, setArmTypes] = useState<string[]>(ARM_TYPES);
  const [_hasRun, setHasRun] = useState(false);

  // ── Motor Monitor ─────────────────────────────────────────────────────────
  const [monConnected, setMonConnected] = useState(false);
  const [monConnecting, setMonConnecting] = useState(false);
  const [monPort, setMonPort] = useState("");
  const [monMotors, setMonMotors] = useState<MotorData[]>([]);
  const [freewheel, setFreewheel] = useState(false);
  const [monError, setMonError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const identifyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const identifyBaselineSerialsRef = useRef<string[]>([]);
  const identifyMissingSerialRef = useRef("");

  // ── Calibration (mock UI only — real API in Calibration page) ────────────
  const [calibMode, setCalibMode] = useState("Single Arm");
  const [calibArmType, setCalibArmType] = useState("so101_follower");
  const [calibPort, setCalibPort] = useState("");
  const [calibArmId, setCalibArmId] = useState("");
  const [calibBiType, setCalibBiType] = useState("bi_so_follower");
  const [calibBiId, setCalibBiId] = useState("bimanual_follower");
  const [calibBiLeftPort, setCalibBiLeftPort] = useState("");
  const [calibBiRightPort, setCalibBiRightPort] = useState("");
  const [calibFiles, setCalibFiles] = useState<CalibrationFileItem[]>([]);

  // ── Setup Wizard ──────────────────────────────────────────────────────────
  const [wizardRunning, setWizardRunning] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardMotorState, setWizardMotorState] = useState<("pending" | "waiting" | "writing" | "done" | "error")[]>(
    SETUP_MOTORS.map(() => "pending")
  );
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardDetectedId, setWizardDetectedId] = useState("");
  const [wizardBaudRate, setWizardBaudRate] = useState("1000000");
  const [wizardConnectionConfirmed, setWizardConnectionConfirmed] = useState(false);

  // ── Mapping tab ───────────────────────────────────────────────────────────
  const [armRoleMap, setArmRoleMap] = useState<Record<string, string>>({});
  const [persistedArmRoleMap, setPersistedArmRoleMap] = useState<Record<string, string>>({});
  const [mappingSaving, setMappingSaving] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [motorTab, setMotorTab] = useState("mapping");
  const [identifyStep, setIdentifyStep] = useState<"idle" | "waiting" | "found" | "conflict">("idle");
  const [identifyRole, setIdentifyRole] = useState("(none)");
  const [identifySerial, setIdentifySerial] = useState("");
  const [identifyMissingSerial, setIdentifyMissingSerial] = useState("");
  const [_conflictTarget] = useState("");
  const [noPort, setNoPort] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadDevices = useCallback(async () => {
    try {
      const res = await apiGet<DeviceResponse>("/api/devices");
      const nextArms = Array.isArray(res.arms) ? res.arms : [];
      setArms(nextArms);

      // Auto-select port for Setup tab
      if (nextArms.length > 0) {
        const best = nextArms[0];
        const bestPort = best.path ?? `/dev/${best.device ?? "ttyUSB0"}`;
        const second = nextArms[1] ?? nextArms[0];
        const secondPort = second.path ?? `/dev/${second.device ?? "ttyUSB1"}`;
        setSetupPort((prev) => prev || bestPort);
        setMonPort((prev) => prev || bestPort);
        setCalibPort((prev) => prev || bestPort);
        setCalibBiLeftPort((prev) => prev || bestPort);
        setCalibBiRightPort((prev) => prev || secondPort);
      }

      // Pre-populate armRoleMap from existing symlinks
      const symToLabel = Object.fromEntries(
        ARM_ROLE_OPTIONS.map((label) => [label.toLowerCase().replace(/ /g, "_"), label]),
      );
      const initialMap: Record<string, string> = {};
      for (const arm of nextArms) {
        initialMap[arm.device] = arm.symlink && symToLabel[arm.symlink] ? symToLabel[arm.symlink] : "(none)";
      }
      setPersistedArmRoleMap(initialMap);
      setArmRoleMap((prev) => ({ ...prev, ...initialMap }));
    } catch {
      // ignore
    }
  }, []);

  const resetIdentifyState = useCallback(() => {
    if (identifyPollRef.current) {
      clearInterval(identifyPollRef.current);
      identifyPollRef.current = null;
    }
    identifyBaselineSerialsRef.current = [];
    identifyMissingSerialRef.current = "";
    setIdentifyStep("idle");
    setIdentifyRole("(none)");
    setIdentifySerial("");
    setIdentifyMissingSerial("");
  }, []);

  const handleStartIdentify = useCallback(() => {
    const baselineSerials = arms
      .map((arm) => arm.serial?.trim() ?? "")
      .filter(Boolean);

    if (baselineSerials.length === 0) {
      addToast("No arm serial numbers detected. Refresh devices and try again.", "error");
      return;
    }

    identifyBaselineSerialsRef.current = baselineSerials;
    identifyMissingSerialRef.current = "";
    setIdentifyRole("(none)");
    setIdentifySerial("");
    setIdentifyMissingSerial("");
    setIdentifyStep("waiting");
  }, [addToast, arms]);

  const handleAssignIdentifiedArm = useCallback(async () => {
    if (!identifySerial) {
      addToast("No identified arm serial is available yet.", "error");
      return;
    }

    const symlink = toArmSymlink(identifyRole);
    if (symlink === "(none)") {
      addToast("Choose a role before assigning the identified arm.", "error");
      return;
    }

    const currentRules = await apiGet<RulesResponse>("/api/udev/rules")
      .catch(() => apiGet<RulesResponse>("/api/rules/current"));
    const cameraAssignments: Record<string, string> = {};
    for (const rule of Array.isArray(currentRules.camera_rules) ? currentRules.camera_rules : []) {
      const kernels = (rule.kernel ?? "").trim();
      const role = (rule.symlink ?? "").trim();
      if (kernels && role && role !== "(none)") {
        cameraAssignments[kernels] = role;
      }
    }

    const result = await apiPost<ActionResponse>("/api/rules/apply", {
      assignments: cameraAssignments,
      arm_assignments: {
        [identifySerial]: symlink,
      },
    });

    if (!result.ok) {
      addToast(result.error ?? "Failed to apply identified arm mapping.", "error");
      return;
    }

    setArmRoleMap((prev) => {
      const next = { ...prev };
      for (const arm of arms) {
        if (arm.serial === identifySerial) {
          next[arm.device] = identifyRole;
        }
      }
      return next;
    });

    addToast(`Mapped identified arm (${identifySerial}) to ${identifyRole}.`, "success");
    resetIdentifyState();
    await loadDevices();
  }, [addToast, arms, identifyRole, identifySerial, loadDevices, resetIdentifyState]);

  const handleSimulateIdentify = useCallback(() => {
    const simulatedSerial = arms.find((arm) => arm.serial?.trim())?.serial?.trim() ?? "";
    if (!simulatedSerial) {
      addToast("No arm serial is available to simulate identification.", "error");
      return;
    }
    setIdentifySerial(simulatedSerial);
    setIdentifyStep("found");
  }, [addToast, arms]);

  const loadArmTypes = useCallback(async () => {
    try {
      const res = await apiGet<{ types?: string[] }>("/api/robots");
      if (Array.isArray(res.types) && res.types.length > 0) {
        const dynamicTypes = res.types
          .filter((type): type is string => typeof type === "string")
          .filter((type) => type.includes("_leader") || type.includes("_follower"));
        const merged = Array.from(new Set([...ARM_TYPES, ...dynamicTypes]));
        setArmTypes(merged);
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    void loadDevices();
    void loadArmTypes();
  }, [loadDevices, loadArmTypes]);

  useEffect(() => {
    if (identifyStep !== "waiting") {
      if (identifyPollRef.current) {
        clearInterval(identifyPollRef.current);
        identifyPollRef.current = null;
      }
      return;
    }

    const pollIdentifyDevices = async () => {
      try {
        const res = await apiGet<DeviceResponse>("/api/devices");
        const nextArms = Array.isArray(res.arms) ? res.arms : [];
        setArms(nextArms);

        const baselineSerials = identifyBaselineSerialsRef.current;
        const missingSerial = identifyMissingSerialRef.current;
        const currentSerials = nextArms
          .map((arm) => arm.serial?.trim() ?? "")
          .filter(Boolean);
        const currentSerialSet = new Set(currentSerials);
        const removedSerials = baselineSerials.filter((serial) => !currentSerialSet.has(serial));
        const addedSerials = currentSerials.filter((serial) => !baselineSerials.includes(serial));

        if (!missingSerial && removedSerials.length === 1 && addedSerials.length === 0) {
          identifyMissingSerialRef.current = removedSerials[0];
          setIdentifyMissingSerial(removedSerials[0]);
          return;
        }

        if (missingSerial && currentSerialSet.has(missingSerial)) {
          setIdentifySerial(missingSerial);
          setIdentifyMissingSerial("");
          setIdentifyStep("found");
          return;
        }

        if (removedSerials.length > 1 || addedSerials.length > 1 || (removedSerials.length > 0 && addedSerials.length > 0)) {
          setIdentifyStep("conflict");
          identifyMissingSerialRef.current = "";
          setIdentifyMissingSerial("");
        }
      } catch {
      }
    };

    void pollIdentifyDevices();
    identifyPollRef.current = setInterval(() => {
      void pollIdentifyDevices();
    }, 1500);

    return () => {
      if (identifyPollRef.current) {
        clearInterval(identifyPollRef.current);
        identifyPollRef.current = null;
      }
    };
  }, [addToast, identifyStep]);

  // Auto-select port matching arm type keyword (follower/leader)
  const findPortByKeyword = useCallback(
    (keyword: string) => {
      const match = keyword
        ? arms.find((a) => (a.symlink ?? a.device ?? "").toLowerCase().includes(keyword))
        : undefined;
      const best = match ?? arms[0];
      return best ? (best.path ?? `/dev/${best.device ?? "ttyUSB0"}`) : "";
    },
    [arms],
  );

  useEffect(() => {
    if (arms.length === 0) return;
    const keyword = setupArmType.includes("follower") ? "follower" : setupArmType.includes("leader") ? "leader" : "";
    const p = findPortByKeyword(keyword);
    setSetupPort(p);
    if (!monConnected) setMonPort(p);
  }, [arms, setupArmType, monConnected, findPortByKeyword]);

  // Auto-select calibration port matching arm type keyword
  useEffect(() => {
    if (arms.length === 0) return;
    const keyword = calibArmType.includes("follower") ? "follower" : calibArmType.includes("leader") ? "leader" : "";
    setCalibPort(findPortByKeyword(keyword));
  }, [arms, calibArmType, findPortByKeyword]);

  // ─── Motor Monitor polling ──────────────────────────────────────────────────

  useEffect(() => {
    if (!monConnected) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiGet<MotorPositionsResponse>("/api/motor/positions");
        if (!res.ok || !res.connected) {
          setMonConnected(false);
          setMonMotors([]);
          setFreewheel(false);
          return;
        }

        if (res.freewheel !== undefined) setFreewheel(res.freewheel);

        setMonMotors((prev) => {
          const next = [...prev];
          for (const motor of next) {
            const idStr = String(motor.id);
            if (res.motors && res.motors[idStr]) {
              const d = res.motors[idStr];
              motor.pos = d.position;
              motor.load = d.load;
              motor.current = d.current;
              motor.collision = d.collision;
            } else if (res.positions[idStr] !== undefined) {
              motor.pos = res.positions[idStr];
            }
          }
          return next;
        });
      } catch {
        // ignore transient errors
      }
    }, 100);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [monConnected]);

  // ─── Motor Monitor handlers ─────────────────────────────────────────────────

  const handleMonConnect = async () => {
    if (!monPort) { setMonError("Select a port first."); return; }
    setMonConnecting(true);
    setMonError("");
    try {
      const res = await apiPost<MotorConnectResponse>("/api/motor/connect", { port: monPort });
      if (!res.ok) {
        setMonError(res.error ?? "Connection failed");
        return;
      }
      const ids = res.connected_ids ?? [];
      setMonMotors(ids.map((id) => ({ id, pos: null, load: null, current: null, collision: false, target: 2048 })));
      setFreewheel(false);
      setMonConnected(true);
      addToast(`Motor monitor connected (${ids.length} motors)`, "success");
    } catch (err) {
      setMonError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setMonConnecting(false);
    }
  };

  const handleMonDisconnect = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    await apiPost("/api/motor/disconnect", {});
    setMonConnected(false);
    setMonMotors([]);
    setFreewheel(false);
    setMonError("");
  }, []);

  const handleFreewheelToggle = async () => {
    const endpoint = freewheel ? "/api/motor/freewheel/exit" : "/api/motor/freewheel/enter";
    const res = await apiPost<ActionResponse>(endpoint, {});
    if (!res.ok) {
      addToast(`Freewheel ${freewheel ? "exit" : "enter"} failed: ${res.error}`, "error");
      return;
    }
    setFreewheel(!freewheel);
    addToast(freewheel ? "Freewheel OFF — torque restored" : "Freewheel ON — move motors freely by hand", "info");
  };

  const handleEmergencyStop = async () => {
    const res = await apiPost<ActionResponse>("/api/motor/torque_off", {});
    if (!res.ok) {
      addToast(`Emergency stop failed: ${res.error}`, "error");
    } else {
      setFreewheel(false);
      addToast("Emergency stop — all torque OFF", "info");
    }
  };

  const handleMoveMotor = async (id: number, target: number) => {
    const res = await apiPost<ActionResponse>(`/api/motor/${id}/move`, { position: target });
    if (!res.ok) addToast(`Motor ${id} move failed: ${res.error}`, "error");
  };

  const handleClearCollision = async (id: number) => {
    const res = await apiPost<ActionResponse>(`/api/motor/${id}/clear_collision`, {});
    if (!res.ok) {
      addToast(`Clear collision failed: ${res.error}`, "error");
    } else {
      setMonMotors((prev) => prev.map((m) => m.id === id ? { ...m, collision: false } : m));
      addToast(`Motor ${id} collision cleared`, "info");
    }
  };

  const handleTargetChange = (id: number, target: number) => {
    setMonMotors((prev) => prev.map((m) => m.id === id ? { ...m, target } : m));
  };

  // ─── Motor Setup (CLI) handlers ────────────────────────────────────────────

  const handleSetupStart = async () => {
    if (!setupPort.startsWith("/dev/")) {
      addToast("Port must start with /dev/", "error");
      return;
    }
    clearLog("motor_setup");
    const res = await apiPost<ActionResponse>("/api/motor_setup/start", {
      robot_type: setupArmType,
      port: setupPort,
    });
    if (!res.ok) {
      appendLog("motor_setup", `[ERROR] ${res.error ?? "failed to start motor setup"}`, "error");
      addToast("Failed to start motor setup", "error");
    } else {
      addToast("Motor setup started", "success");
      setHasRun(true);
      startWizard();
    }
  };

  const refreshCalibrationList = useCallback(async () => {
    try {
      const res = await apiGet<CalibrationListResponse>("/api/calibrate/list");
      const files = Array.isArray(res.files) ? res.files : [];
      setCalibFiles(files);
    } catch {
      setCalibFiles([]);
    }
  }, []);

  const refreshCalibrationFileStatus = useCallback(async () => {
    if (!calibArmType || !calibArmId) return;
    try {
      await apiGet<CalibrationFileStatusResponse>(
        `/api/calibrate/file/status?robot_type=${encodeURIComponent(calibArmType)}&robot_id=${encodeURIComponent(calibArmId)}`,
      );
    } catch {
      // ignore
    }
  }, [calibArmId, calibArmType]);

  useEffect(() => {
    void refreshCalibrationList();
  }, [refreshCalibrationList]);

  // Auto-refresh calibration file list when calibrate process finishes
  const prevCalibrateRunning = useRef(false);
  useEffect(() => {
    if (prevCalibrateRunning.current && !calibrateRunning) {
      void refreshCalibrationList();
      void refreshCalibrationFileStatus();
    }
    prevCalibrateRunning.current = calibrateRunning;
  }, [calibrateRunning, refreshCalibrationList, refreshCalibrationFileStatus]);

  const handleCalibrationStart = async () => {
    if (calibMode === "Single Arm" && calibFileNameError) {
      addToast(calibFileNameError, "error");
      return;
    }

    const payload = calibMode === "Bi-Arm"
      ? {
          robot_mode: "bi",
          bi_type: calibBiType,
          robot_id: calibBiId,
          left_port: calibBiLeftPort,
          right_port: calibBiRightPort,
        }
      : {
          robot_mode: "single",
          robot_type: calibArmType,
          robot_id: calibArmId.trim(),
          port: calibPort,
        };

    const res = await apiPost<ActionResponse>("/api/calibrate/start", payload);
    if (!res.ok) {
      addToast(res.error ?? "Calibration start failed", "error");
      appendLog("calibrate", `[ERROR] ${res.error ?? "failed to start calibration"}`, "error");
      return;
    }

    addToast("Calibration started", "success");
    appendLog("calibrate", "[info] calibration started", "info");
  };

  const handleCalibrationStop = async () => {
    const res = await apiPost<ActionResponse>("/api/process/calibrate/stop", {});
    if (!res.ok) {
      addToast(res.error ?? "Calibration stop failed", "error");
      return;
    }
    setProcStatus({ ...procStatus, calibrate: false });
    addToast("Calibration stopped", "success");
    await refreshCalibrationList();
    await refreshCalibrationFileStatus();
  };

  const handleCalibrationDelete = async (file: CalibrationFileItem) => {
    if (!window.confirm(`Delete calibration file?\n\n${file.id}\n\nThis cannot be undone.`)) return;
    const guessedType = typeof file.guessed_type === "string" && file.guessed_type ? file.guessed_type : calibArmType;
    const body = await apiDelete<ActionResponse>(
      `/api/calibrate/file?robot_type=${encodeURIComponent(guessedType)}&robot_id=${encodeURIComponent(file.id)}`,
    );
    if (!body.ok) {
      addToast(body.error ?? "Calibration file delete failed", "error");
      return;
    }
    addToast(`Deleted calibration: ${file.id}`, "success");
    await refreshCalibrationList();
    await refreshCalibrationFileStatus();
  };

  const applyArmMapping = async (roleMap: Record<string, string>) => {
    setMappingSaving(true);
    const armAssignments: Record<string, string> = {};
    for (const arm of arms) {
      if (!arm.serial) continue;
      const roleLabel = roleMap[arm.device] ?? "(none)";
      armAssignments[arm.serial] = toArmSymlink(roleLabel);
    }

    const currentRules = await apiGet<RulesResponse>("/api/udev/rules")
      .catch(() => apiGet<RulesResponse>("/api/rules/current"));
    const cameraAssignments: Record<string, string> = {};
    for (const rule of Array.isArray(currentRules.camera_rules) ? currentRules.camera_rules : []) {
      const kernels = (rule.kernel ?? "").trim();
      const role = (rule.symlink ?? "").trim();
      if (kernels && role && role !== "(none)") {
        cameraAssignments[kernels] = role;
      }
    }

    try {
      const result = await apiPost<ActionResponse>("/api/rules/apply", {
        assignments: cameraAssignments,
        arm_assignments: armAssignments,
      });

      if (!result.ok) {
        addToast(result.error ?? "Failed to apply arm mapping.", "error");
        return;
      }

      addToast("Arm mapping rules applied.", "success");

      // Refresh devices so other tabs pick up new symlinks and auto-select ports
      await loadDevices();
    } finally {
      setMappingSaving(false);
    }
  };

  // ─── Setup Wizard helpers ──────────────────────────────────────────────────

  const startWizard = () => {
    setWizardRunning(true);
    setWizardStep(0);
    setWizardMotorState(SETUP_MOTORS.map((_, i) => i === 0 ? "waiting" : "pending"));
    setWizardError(null);
    setWizardDetectedId("");
    setWizardBaudRate("1000000");
    setWizardConnectionConfirmed(false);
  };

  const wizardPressEnter = () => {
    if (!wizardRunning) return;
    if (!wizardConnectionConfirmed) {
      setWizardError("Confirm that only the current motor is connected.");
      return;
    }
    if (!wizardDetectedId.trim()) {
      setWizardError("Enter the detected motor ID.");
      return;
    }

    const newState = [...wizardMotorState];
    newState[wizardStep] = "writing";
    setWizardMotorState(newState);
    setWizardError(null);
    setTimeout(() => {
      const doneState = [...newState];
      doneState[wizardStep] = "done";
      const nextStep = wizardStep + 1;
      if (nextStep < SETUP_MOTORS.length) {
        doneState[nextStep] = "waiting";
        setWizardStep(nextStep);
        setWizardDetectedId("");
        setWizardConnectionConfirmed(false);
      }
      setWizardMotorState(doneState);
      if (nextStep >= SETUP_MOTORS.length) {
        setTimeout(() => setWizardRunning(false), 500);
      }
    }, 1000);
  };

  const wizardSimulateError = () => {
    const newState = [...wizardMotorState];
    newState[wizardStep] = "error";
    setWizardMotorState(newState);
    setWizardError(`Failed to write EEPROM for '${SETUP_MOTORS[wizardStep].name}'.`);
  };

  const wizardRetry = () => {
    const newState = [...wizardMotorState];
    newState[wizardStep] = "waiting";
    setWizardMotorState(newState);
    setWizardError(null);
  };

  const resetWizardState = () => {
    setWizardMotorState(SETUP_MOTORS.map(() => "pending"));
    setWizardStep(0);
    setWizardError(null);
    setWizardDetectedId("");
    setWizardBaudRate("1000000");
    setWizardConnectionConfirmed(false);
  };

  const stopWizard = () => {
    setWizardRunning(false);
    resetWizardState();
  };

  const wizardAllDone = wizardMotorState.every((s) => s === "done");

  const ARM_ROLES = ["(none)", ...ARM_ROLE_OPTIONS];

  const monPortArm = arms.find((a) => a.path === monPort);
  const monPortLabel = monPortArm?.symlink ? symToDisplayLabel(monPortArm.symlink) : monPort;

  const calibTypeMismatch =
    calibMode === "Single Arm" &&
    ((calibArmType.includes("follower") && calibPort.includes("leader")) ||
      (calibArmType.includes("leader") && calibPort.includes("follower")));

  /** Port options with symlink labels for all port dropdowns */
  const portOptions = useMemo(() => buildPortOptions(arms), [arms]);
  const hasPendingArmMappingChanges = useMemo(
    () => arms.some((arm) => (armRoleMap[arm.device] ?? "(none)") !== (persistedArmRoleMap[arm.device] ?? "(none)")),
    [armRoleMap, arms, persistedArmRoleMap],
  );

  const calibPortOptions = portOptions;
  const autoSingleCalibId = useMemo(() => {
    const selectedArm = arms.find((arm) => arm.path === calibPort) ?? arms[0];
    const raw = selectedArm?.symlink?.trim()
      || selectedArm?.serial?.trim().toLowerCase()
      || `${calibArmType}_arm`;
    return raw
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64);
  }, [arms, calibArmType, calibPort]);
  const autoBiCalibId = useMemo(() => {
    const leftArm = arms.find((arm) => arm.path === calibBiLeftPort);
    const rightArm = arms.find((arm) => arm.path === calibBiRightPort);
    const leftRaw = leftArm?.symlink?.trim()
      || leftArm?.serial?.trim().toLowerCase()
      || "left";
    const rightRaw = rightArm?.symlink?.trim()
      || rightArm?.serial?.trim().toLowerCase()
      || "right";
    const raw = `${leftRaw}_${rightRaw}`;
    return raw
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64);
  }, [arms, calibBiLeftPort, calibBiRightPort, calibBiType]);
  const calibArmIdTrimmed = calibArmId.trim();
  const calibFileNameError = useMemo(() => {
    if (!calibArmIdTrimmed) return "Enter Calibration File Name.";
    if (calibArmIdTrimmed.length > 64) return "Calibration file name must be 1-64 characters.";
    if (calibArmIdTrimmed === "." || calibArmIdTrimmed === "..") return "Calibration file name is invalid.";
    if (!/^[A-Za-z0-9._-]+$/.test(calibArmIdTrimmed)) {
      return "Use only letters, numbers, dot (.), underscore (_), or hyphen (-).";
    }
    return "";
  }, [calibArmIdTrimmed]);
  const singleArmCalibTypes = useMemo(() => {
    const filtered = armTypes.filter((type) => !type.startsWith("bi_") && (type.includes("_leader") || type.includes("_follower")));
    return filtered.length > 0 ? filtered : ARM_TYPES;
  }, [armTypes]);
  const biArmCalibTypes = useMemo(() => {
    const defaults = ["bi_so_follower", "bi_so_leader"];
    const dynamic = armTypes.filter((type) => type.startsWith("bi_"));
    return Array.from(new Set([...defaults, ...dynamic]));
  }, [armTypes]);

  useEffect(() => {
    if (calibMode !== "Single Arm") return;
    if (!autoSingleCalibId) return;
    if (calibArmId !== autoSingleCalibId) {
      setCalibArmId(autoSingleCalibId);
    }
  }, [autoSingleCalibId, calibArmId, calibMode]);

  useEffect(() => {
    if (calibMode !== "Bi-Arm") return;
    if (!autoBiCalibId) return;
    if (calibBiId !== autoBiCalibId) {
      setCalibBiId(autoBiCalibId);
    }
  }, [autoBiCalibId, calibBiId, calibMode]);

  useEffect(() => {
    if (!singleArmCalibTypes.includes(calibArmType)) {
      setCalibArmType(singleArmCalibTypes[0] ?? "so101_follower");
    }
  }, [calibArmType, singleArmCalibTypes]);

  useEffect(() => {
    if (!biArmCalibTypes.includes(calibBiType)) {
      setCalibBiType(biArmCalibTypes[0] ?? "bi_so_follower");
    }
  }, [biArmCalibTypes, calibBiType]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-4 max-w-[1600px] mx-auto w-full">
          <PageHeader
            title="Motor Setup"
            subtitle="Arm mapping, motor ID setup and verification"
            action={
              <div className="flex items-center gap-2">
                {motorTab === "mapping" && arms.length > 0 && <button onClick={() => { void applyArmMapping(armRoleMap); }} disabled={mappingSaving || !hasPendingArmMappingChanges} className={`flex items-center gap-1.5 px-3 py-1 rounded border text-sm transition-colors ${mappingSaving || !hasPendingArmMappingChanges ? "border-zinc-600 text-zinc-500 cursor-not-allowed" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"}`}><Save size={12} />{mappingSaving ? "Applying..." : "Apply Mapping"}</button>}
                {import.meta.env.DEV && <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span className="hidden sm:inline">Demo:</span>
                  <button onClick={() => setNoPort((v) => !v)} className={`px-2 py-0.5 rounded border cursor-pointer text-sm ${noPort ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-zinc-200 dark:border-zinc-700 text-zinc-500"}`}>
                    no port
                  </button>
                  <button onClick={() => setHasConflict((v) => !v)} className={`px-2 py-0.5 rounded border cursor-pointer text-sm ${hasConflict ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-zinc-200 dark:border-zinc-700 text-zinc-500"}`}>
                    conflict
                  </button>
                </div>}
                <RefreshButton onClick={() => { void loadDevices(); void loadArmTypes(); }} />
              </div>
            }
          />

          <div className="flex flex-col gap-6">
            <SubTabs
              tabs={[
                { key: "mapping", label: "Mapping" },
                { key: "setup", label: "Motor Setup" },
                { key: "monitor", label: "Motor Monitor" },
                { key: "calibration", label: "Calibration" },
              ]}
              activeKey={motorTab}
              onChange={setMotorTab}
              className="mx-auto"
            />

            {motorTab === "mapping" && (
              <MappingTabPanel
                arms={arms}
                armRoleMap={armRoleMap}
                onSetArmRoleMap={setArmRoleMap}
                identifyStep={identifyStep}
                identifyRole={identifyRole}
                identifySerial={identifySerial}
                identifyMissingSerial={identifyMissingSerial}
                armRoles={ARM_ROLES}
                onStartIdentify={handleStartIdentify}
                onCancelIdentify={resetIdentifyState}
                onAssignIdentify={() => { void handleAssignIdentifiedArm(); }}
                onSimulateIdentify={handleSimulateIdentify}
                onSetIdentifyRole={setIdentifyRole}
              />
            )}

            {motorTab === "setup" && (
              <SetupTabPanel
                wizardRunning={wizardRunning}
                wizardAllDone={wizardAllDone}
                noPort={noPort}
                arms={arms}
                hasConflict={hasConflict}
                setupArmType={setupArmType}
                armTypes={armTypes}
                setupPort={setupPort}
                portOptions={portOptions}
                wizardStep={wizardStep}
                wizardMotorState={wizardMotorState}
                wizardError={wizardError}
                wizardDetectedId={wizardDetectedId}
                wizardBaudRate={wizardBaudRate}
                wizardConnectionConfirmed={wizardConnectionConfirmed}
                onSetSetupArmType={setSetupArmType}
                onSetSetupPort={setSetupPort}
                onHandleSetupStart={() => { void handleSetupStart(); }}
                onSetWizardDetectedId={setWizardDetectedId}
                onSetWizardBaudRate={setWizardBaudRate}
                onSetWizardConnectionConfirmed={setWizardConnectionConfirmed}
                onWizardPressEnter={wizardPressEnter}
                onWizardRetry={wizardRetry}
                onWizardSimulateError={wizardSimulateError}
                onStopWizard={stopWizard}
                onResetWizard={resetWizardState}
                onSetMotorTab={setMotorTab}
              />
            )}

            {motorTab === "monitor" && (
              <MonitorTabPanel
                freewheel={freewheel}
                monConnected={monConnected}
                monConnecting={monConnecting}
                monPort={monPort}
                arms={arms}
                portOptions={portOptions}
                setupRunning={setupRunning}
                monPortLabel={monPortLabel}
                monMotors={monMotors}
                monError={monError}
                MotorCardComponent={MotorCard}
                onHandleFreewheelToggle={() => { void handleFreewheelToggle(); }}
                onHandleMonConnect={() => { void handleMonConnect(); }}
                onHandleEmergencyStop={() => { void handleEmergencyStop(); }}
                onHandleMonDisconnect={() => { void handleMonDisconnect(); }}
                onSetMonPort={setMonPort}
                onHandleMoveMotor={(id, target) => { void handleMoveMotor(id, target); }}
                onHandleClearCollision={(id) => { void handleClearCollision(id); }}
                onHandleTargetChange={handleTargetChange}
              />
            )}

            {motorTab === "calibration" && (
              <CalibrationTabPanel
                arms={arms}
                calibrateRunning={calibrateRunning}
                calibMode={calibMode}
                calibTypeMismatch={calibTypeMismatch}
                calibArmType={calibArmType}
                singleArmTypes={singleArmCalibTypes}
                calibPortOptions={calibPortOptions}
                calibPort={calibPort}
                calibArmId={calibArmId}
                calibArmIdAuto={calibMode === "Single Arm"}
                calibFileNameError={calibFileNameError}
                calibBiType={calibBiType}
                biArmTypes={biArmCalibTypes}
                calibBiLeftPort={calibBiLeftPort}
                calibBiRightPort={calibBiRightPort}
                calibBiId={calibBiId}
                calibBiIdAuto={calibMode === "Bi-Arm"}
                calibFiles={calibFiles}
                onSetCalibMode={setCalibMode}
                onSetCalibArmType={setCalibArmType}
                onSetCalibPort={setCalibPort}
                onSetCalibArmId={setCalibArmId}
                onSetCalibBiType={setCalibBiType}
                onSetCalibBiLeftPort={setCalibBiLeftPort}
                onSetCalibBiRightPort={setCalibBiRightPort}
                onSetCalibBiId={setCalibBiId}
                onHandleCalibrationStart={() => { void handleCalibrationStart(); }}
                onHandleCalibrationStop={() => { void handleCalibrationStop(); }}
                onHandleCalibrationDelete={(file) => { void handleCalibrationDelete(file); }}
              />
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
