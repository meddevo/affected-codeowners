import { parseLine } from './parse-line.js';
import { warning } from '@actions/core';
import { CodeOwnerRule } from './code-owner-rule.interface.js';

export const parseFile = (fileContent: string, errors: number[]) => {
  const rules: CodeOwnerRule[] = [];
  const lines = fileContent.split(/\r?\n/);

  let lineNo = 0;
  for (const rawLine of lines) {
    lineNo++;

    // skip lines which have errors according to the api
    if (errors.includes(lineNo)) {
      continue;
    }

    const line = rawLine.trim();

    // skip empty lines and comments
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    try {
      const rule = parseLine(line, lineNo);
      rules.push(rule);
    } catch (error) {
      if (error instanceof Error) {
        warning(`CODEOWNERS line ${lineNo} skipped: ${error.message}`);
      }
    }
  }

  // Ensure precedence for last matching patterns
  return rules.reverse();
};
