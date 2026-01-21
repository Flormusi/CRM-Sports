import { CpuInfo } from 'os';

export interface SystemSettings {
  id: number;
  key: string;
  value: any;
  created_at: Date;
  updated_at: Date;
}

export interface SystemStatus {
  uptime: number;
  memory: {
    total: number;
    free: number;
  };
  cpu: CpuInfo[];
  loadAvg: number[];
}