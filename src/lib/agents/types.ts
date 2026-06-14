export interface AgentMessage {
  agent: "environment" | "adversary" | "mentor" | "evaluator" | "placement";
  type: "status" | "action" | "alert" | "hint" | "score";
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface VirtualHost {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  services: VirtualService[];
  users: VirtualUser[];
  files: VirtualFile[];
  isCompromised: boolean;
}

export interface VirtualService {
  name: string;
  port: number;
  version: string;
  banner: string;
  vulnerabilities: Vulnerability[];
}

export interface VirtualUser {
  username: string;
  groups: string[];
  privileges: "user" | "admin" | "system";
  hasWeakPassword: boolean;
}

export interface VirtualFile {
  path: string;
  name: string;
  size: number;
  permissions: string;
  suspicious: boolean;
  content?: string;
}

export interface Vulnerability {
  cve?: string;
  name: string;
  severity: "low" | "medium" | "high" | "critical";
  exploitable: boolean;
  description: string;
}

export interface NetworkTopology {
  hosts: VirtualHost[];
  firewallRules: FirewallRule[];
  subnet: string;
}

export interface FirewallRule {
  source: string;
  destination: string;
  port: number;
  action: "allow" | "deny";
}

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};
