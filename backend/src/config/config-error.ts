export interface ConfigIssue {
  /** The environment variable name. */
  readonly variable: string;
  /** What is wrong, without the value that was received. */
  readonly problem: string;
}

/** The environment is not valid. Lists every problem at once so the operator fixes them in one go. */
export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(`Invalid configuration:\n${issues.map((i) => `  - ${i.variable}: ${i.problem}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}
