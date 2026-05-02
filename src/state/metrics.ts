export type MetricsState = {
  failedLogins: number;
  lastLoginAt: Date | null;
  lastRequestAt: Date | null;
  requestCount: number;
  successfulLogins: number;
};

export const metrics: MetricsState = {
  failedLogins: 0,
  lastLoginAt: null,
  lastRequestAt: null,
  requestCount: 0,
  successfulLogins: 0,
};

export const startTime = new Date();
