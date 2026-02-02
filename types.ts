
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
