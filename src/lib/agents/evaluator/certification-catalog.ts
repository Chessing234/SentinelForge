export interface Requirement {
  skillCategory: string;
  minimumScore: number;
  scenariosCompleted: number;
}

export interface Certification {
  id: string;
  name: string;
  description: string;
  requirements: Requirement[];
  badge: string;
}

export const CERTIFICATIONS: Certification[] = [
  {
    id: "soc_analyst_1",
    name: "SOC Analyst Level 1",
    description: "Baseline monitoring and triage readiness.",
    badge: "soc1",
    requirements: [
      { skillCategory: "network_security", minimumScore: 70, scenariosCompleted: 5 },
      { skillCategory: "incident_response", minimumScore: 60, scenariosCompleted: 5 },
    ],
  },
  {
    id: "soc_analyst_2",
    name: "SOC Analyst Level 2",
    description: "Expanded coverage across web and cloud.",
    badge: "soc2",
    requirements: [
      { skillCategory: "network_security", minimumScore: 70, scenariosCompleted: 10 },
      { skillCategory: "incident_response", minimumScore: 60, scenariosCompleted: 10 },
      { skillCategory: "web_security", minimumScore: 70, scenariosCompleted: 10 },
      { skillCategory: "cloud_security", minimumScore: 60, scenariosCompleted: 10 },
    ],
  },
  {
    id: "threat_hunter",
    name: "Threat Hunter",
    description: "Deep IR and malware hunting proficiency.",
    badge: "hunter",
    requirements: [
      { skillCategory: "incident_response", minimumScore: 85, scenariosCompleted: 15 },
      { skillCategory: "malware_analysis", minimumScore: 70, scenariosCompleted: 15 },
    ],
  },
  {
    id: "incident_responder",
    name: "Incident Responder",
    description: "Structured response and forensic awareness.",
    badge: "ir",
    requirements: [
      { skillCategory: "incident_response", minimumScore: 80, scenariosCompleted: 12 },
      { skillCategory: "forensics", minimumScore: 70, scenariosCompleted: 12 },
    ],
  },
  {
    id: "security_engineer",
    name: "Security Engineer",
    description: "Balanced excellence across domains.",
    badge: "eng",
    requirements: [
      { skillCategory: "network_security", minimumScore: 75, scenariosCompleted: 20 },
      { skillCategory: "web_security", minimumScore: 75, scenariosCompleted: 20 },
      { skillCategory: "cloud_security", minimumScore: 75, scenariosCompleted: 20 },
      { skillCategory: "incident_response", minimumScore: 75, scenariosCompleted: 20 },
      { skillCategory: "malware_analysis", minimumScore: 75, scenariosCompleted: 20 },
      { skillCategory: "forensics", minimumScore: 75, scenariosCompleted: 20 },
    ],
  },
];
