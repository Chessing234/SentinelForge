import type { NetworkTopology } from "@/lib/agents/types";

export type EnvironmentOverview = {
  subnet: string;
  hostCount: number;
  hosts: Array<{
    id: string;
    hostname: string;
    ip: string;
    os: string;
    openPorts: number[];
    compromised: boolean;
  }>;
};

export function toOverview(topology: NetworkTopology): EnvironmentOverview {
  return {
    subnet: topology.subnet,
    hostCount: topology.hosts.length,
    hosts: topology.hosts.map((h) => ({
      id: h.id,
      hostname: h.hostname,
      ip: h.ip,
      os: h.os,
      openPorts: h.services.map((s) => s.port),
      compromised: h.isCompromised,
    })),
  };
}
