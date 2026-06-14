import type { Category } from "@/types";

export const SKILL_CATEGORY_OPTIONS: { key: Category; label: string }[] = [
  { key: "network_security", label: "Network security" },
  { key: "web_security", label: "Web security" },
  { key: "cloud_security", label: "Cloud security" },
  { key: "incident_response", label: "Incident response" },
  { key: "malware_analysis", label: "Malware analysis" },
  { key: "forensics", label: "Forensics" },
];
