export type PlaywrightResultStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

export type PlaywrightJsonReport = {
  suites?: PlaywrightSuite[];
  stats?: {
    duration?: number;
  };
};

export type PlaywrightSuite = {
  title?: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
};

export type PlaywrightSpec = {
  title: string;
  tags?: string[];
  file?: string;
  tests?: PlaywrightTest[];
};

export type PlaywrightTest = {
  projectName?: string;
  results?: PlaywrightResult[];
};

export type PlaywrightAnnotation = {
  type: string;
  description?: string;
};

export type PlaywrightResult = {
  status: PlaywrightResultStatus;
  annotations?: PlaywrightAnnotation[];
  retry?: number;
  duration?: number;
  error?: {
    message?: string;
  };
};
