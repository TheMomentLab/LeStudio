import { getLeStudioState } from "../store";
import { DEFAULT_TYPE_CATALOG_RESPONSE, type TypeCatalogDefaults, type TypePolicyCatalogResponse, type TypePolicyRecord } from "../store/types";

type RobotMode = "single" | "bi";
type UiCalibrationMode = "required" | "optional" | "hidden";

function currentCatalog(): TypePolicyCatalogResponse {
  return getLeStudioState().typeCatalog ?? DEFAULT_TYPE_CATALOG_RESPONSE;
}

function readCatalog(catalog?: TypePolicyCatalogResponse): TypePolicyCatalogResponse {
  return catalog ?? currentCatalog();
}

export function getDefaults(mode: RobotMode, catalog?: TypePolicyCatalogResponse): TypeCatalogDefaults {
  const source = readCatalog(catalog);
  return source.defaults[mode];
}

export function getTypePolicy(typeName: string, catalog?: TypePolicyCatalogResponse): TypePolicyRecord | null {
  const source = readCatalog(catalog);
  return source.types[typeName] ?? null;
}

export function getCanonicalPair(
  typeName: string,
  catalog?: TypePolicyCatalogResponse,
): { robotType: string; teleopType: string } {
  const policy = getTypePolicy(typeName, catalog);
  if (!policy) {
    return { robotType: typeName, teleopType: "" };
  }
  return {
    robotType: policy.pairing.canonical_robot_type,
    teleopType: policy.pairing.canonical_teleop_type,
  };
}

export function getCalibrationUiMode(typeName: string, catalog?: TypePolicyCatalogResponse): UiCalibrationMode {
  const policy = getTypePolicy(typeName, catalog);
  const mode = policy?.calibration.enforcement.ui;
  return mode === "optional" || mode === "hidden" ? mode : "required";
}

export function isCalibrationOptional(typeName: string, catalog?: TypePolicyCatalogResponse): boolean {
  return getCalibrationUiMode(typeName, catalog) === "optional";
}

export function supportsMotorSetup(typeName: string, catalog?: TypePolicyCatalogResponse): boolean {
  return Boolean(getTypePolicy(typeName, catalog)?.motor_setup.supported);
}

export function getCalibrationHelperText(typeName: string, catalog?: TypePolicyCatalogResponse): string {
  const mode = getCalibrationUiMode(typeName, catalog);
  if (mode === "optional") return "Calibration files are optional for this device type.";
  if (mode === "hidden") return "Calibration is not required for this device type.";
  return "";
}
