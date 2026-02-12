
export type AppMode = 'ANALYSIS' | 'GENERATION' | 'LOGS';

export interface AnalysisData {
  id: string;
  title: string;
  views: number;
  followers: number;
  buzzRate: number; // views / followers
  transcription: string;
  structure: {
    hook: string;
    problem: string;
    solution: string;
    cta: string;
  };
  direction: {
    camera: string;
    person: string;
    caption: string;
  };
  duration: number;
  createdAt: string;
  fileName?: string;
  fileSize?: number;
}

export interface GeneratedScript {
  id: string;
  theme: string;
  tone: string;
  patternId: string;
  scenes: {
    time: string;
    dialogue: string;
    caption: string;
    direction: string;
  }[];
}

export interface GrowthData {
  date: string;
  accuracy: number;
  revisions: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface UserMetrics {
  totalGenerations: number;
  totalEdits: number;
  editHistory: {
    scriptId: string;
    instruction: string;
    timestamp: string;
  }[];
  growthData: GrowthData[];
}

export interface CrossAnalysisResult {
  commonHookPatterns: string[];
  commonStructure: string;
  commonDirection: string;
  recommendations: string[];
  analyzedCount: number;
  createdAt: string;
}
