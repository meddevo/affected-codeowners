import {
  findMatchingCodeOwners,
  isRootedLiteralPattern,
  matchRootedLiteralPattern,
} from '../src/filename-match.js';

describe('match pattern and path', () => {
  describe('isRootedLiteralPattern', () => {
    it('should return true for a valid rooted literal pattern starting with / (folder)', () => {
      expect(isRootedLiteralPattern('/rooted/path')).toBe(true);
    });

    it('should return true for a valid rooted literal pattern starting with / (file)', () => {
      expect(isRootedLiteralPattern('/rooted/path/file.txt')).toBe(true);
    });

    it('should return false for a pattern containing a wildcard', () => {
      expect(isRootedLiteralPattern('/path/*')).toBe(false);
    });

    it('should return false for a pattern containing a question mark', () => {
      expect(isRootedLiteralPattern('/path/?')).toBe(false);
    });

    it('should return false for a pattern containing a backslash', () => {
      expect(isRootedLiteralPattern('/path\\subpath')).toBe(false);
    });

    it('should return false for a pattern not starting with /', () => {
      expect(isRootedLiteralPattern('relative/path')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(isRootedLiteralPattern('')).toBe(false);
    });
  });

  describe('matchRootedLiteralPattern', () => {
    it('should return true for an exact match between pattern and path', () => {
      expect(matchRootedLiteralPattern('/rooted/path', 'rooted/path')).toBe(
        true
      );
    });

    it('should return true for a directory-like pattern ending with / that matches a prefix of the path', () => {
      expect(
        matchRootedLiteralPattern('/rooted/path/', 'rooted/path/subpath')
      ).toBe(true);
    });

    it('should return true for a directory-like pattern not ending with / that matches a prefix of the path', () => {
      expect(
        matchRootedLiteralPattern('/rooted/path', 'rooted/path/and/more')
      ).toBe(true);
    });

    it('should return true for a subpath that extends the structure of the pattern', () => {
      expect(matchRootedLiteralPattern('/rooted', 'rooted/subpath')).toBe(true);
    });

    it('should return false for a path shorter than the pattern', () => {
      expect(matchRootedLiteralPattern('/rooted/path', 'rooted')).toBe(false);
    });

    it('should return false for a path that does not start with the pattern', () => {
      expect(matchRootedLiteralPattern('/rooted', 'different/subpath')).toBe(
        false
      );
    });

    it('should return false if the pattern does not end with / and has additional mismatching path elements', () => {
      expect(matchRootedLiteralPattern('/rooted/path', 'rooted/paths')).toBe(
        false
      );
    });
  });
});

describe('findMatchingCodeOwners', () => {
  it('should parse the README example', () => {
    const changedFilePaths = [
      'src/file.js',
      'src/utils/helper.js',
      'docs/guide.md',
      'docs/setup/config.md',
      'tests/unit/test.spec.js',
      'package.json',
    ];

    const ruleset = [
      {
        lineNumber: 7,
        owners: ['@team-maintainers', '@user3'],
        pattern: '/package.json',
        regexPattern: /^package\.json(?:\/.*)?$/,
      },
      {
        lineNumber: 6,
        owners: ['@team-a', '@user2'],
        pattern: '/tests/unit/*',
        regexPattern: /^tests\/unit\/[^/]+$/,
      },
      {
        lineNumber: 5,
        owners: ['@team-b', '@user1'],
        pattern: '/docs/*',
        regexPattern: /^docs\/[^/]+$/,
      },
      {
        lineNumber: 4,
        owners: ['@team-c', '@user2', '@user3'],
        pattern: '/src/utils/*',
        regexPattern: /^src\/utils\/[^/]+$/,
      },
      {
        lineNumber: 3,
        owners: ['@team-a', '@user1'],
        pattern: '/src/*',
        regexPattern: /^src\/[^/]+$/,
      },
      {
        lineNumber: 2,
        owners: ['@team-global'],
        pattern: '/**/*.js',
        regexPattern: /^(?:.+\/)?[^/]*\.js(?:\/.*)?$/,
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [
        ['@team-a', '@user1'],
        ['@team-c', '@user2', '@user3'],
        ['@team-b', '@user1'],
        ['@team-a', '@user2'],
        ['@team-maintainers', '@user3'],
      ],
      individual: [
        '@team-a',
        '@user1',
        '@team-c',
        '@user2',
        '@user3',
        '@team-b',
        '@team-maintainers',
      ],
    });
  });

  it('should return no owners for an empty overwrite', () => {
    const changedFilePaths = ['libs/workspace/feature/frontend/package.json'];
    const ruleset = [
      {
        lineNumber: 3,
        owners: [],
        pattern: '/libs/**/package.json',
        regexPattern: /^libs(?:\/.+)?\/package\.json(?:\/.*)?$/,
      },
      {
        lineNumber: 2,
        owners: ['@user1'],
        pattern: '/libs/workspace',
        regexPattern: /^libs\/workspace(?:\/.*)?$/,
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [],
      individual: [],
    });
  });

  it('should return the owners for a matching file path with a simple rule', () => {
    const changedFilePaths = ['src/utils/helpers.ts'];
    const ruleset = [
      {
        pattern: 'src/utils/',
        regexPattern: /src\/utils\/.*\.ts/,
        lineNumber: 1,
        owners: ['@owner1'],
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [['@owner1']],
      individual: ['@owner1'],
    });
  });

  it('should return the owners for a matching file path with a single rule', () => {
    const changedFilePaths = ['src/utils/helpers.ts'];
    const ruleset = [
      {
        pattern: 'src/utils/*.ts',
        regexPattern: /src\/utils\/.*\.ts/,
        lineNumber: 1,
        owners: ['@owner1'],
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [['@owner1']],
      individual: ['@owner1'],
    });
  });

  it('should return owners for multiple matching file paths with different rules', () => {
    const changedFilePaths = [
      'src/utils/helpers.ts',
      'src/components/button.tsx',
    ];
    const ruleset = [
      {
        pattern: 'src/utils/*.ts',
        regexPattern: /src\/utils\/.*\.ts/,
        lineNumber: 1,
        owners: ['@owner1', '@owner3'],
      },
      {
        pattern: 'src/components/*.tsx',
        regexPattern: /src\/components\/.*\.tsx/,
        lineNumber: 2,
        owners: ['@owner2', '@owner3'],
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [
        ['@owner1', '@owner3'],
        ['@owner2', '@owner3'],
      ],
      individual: ['@owner1', '@owner3', '@owner2'],
    });
  });

  it('should return combined owners for a file path matching multiple rules but deduplicated', () => {
    const changedFilePaths = [
      'src/utils/helpers.ts',
      'src/components/button.tsx',
    ];
    const ruleset = [
      {
        pattern: 'src/utils/*.ts',
        regexPattern: /src\/utils\/.*\.ts/,
        lineNumber: 1,
        owners: ['@owner1', '@owner3'],
      },
      {
        pattern: 'src/components/*.tsx',
        regexPattern: /src\/components\/.*\.tsx/,
        lineNumber: 2,
        owners: ['@owner3', '@owner1'],
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [['@owner1', '@owner3']],
      individual: ['@owner1', '@owner3'],
    });
  });

  it('should handle duplicate owners for the same file path gracefully', () => {
    const changedFilePaths = ['src/utils/helpers.ts'];
    const ruleset = [
      {
        pattern: 'src/utils/*.ts',
        regexPattern: /src\/utils\/.*\.ts/,
        lineNumber: 1,
        owners: ['@owner1'],
      },
      {
        pattern: 'src/**/*.ts',
        regexPattern: /src\/.*\.ts/,
        lineNumber: 2,
        owners: ['@owner1'],
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [['@owner1']],
      individual: ['@owner1'],
    });
  });

  it('should return an empty array if no file paths match any rules', () => {
    const changedFilePaths = ['src/styles/theme.css'];
    const ruleset = [
      {
        pattern: 'src/utils/*.ts',
        regexPattern: /src\/utils\/.*\.ts/,
        lineNumber: 1,
        owners: ['@owner1'],
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [],
      individual: [],
    });
  });

  it('should return first owner for a single file path with multiple matching rules', () => {
    const changedFilePaths = ['src/utils/helpers.ts'];
    const ruleset = [
      {
        pattern: 'src/utils/*.ts',
        regexPattern: /src\/utils\/.*\.ts/,
        lineNumber: 1,
        owners: ['@owner2'],
      },
      {
        pattern: 'src/**/*.ts',
        regexPattern: /src\/.*\.ts/,
        lineNumber: 2,
        owners: ['@owner1'],
      },
    ];

    const result = findMatchingCodeOwners(changedFilePaths, ruleset);

    expect(result).toEqual({
      grouped: [['@owner2']],
      individual: ['@owner2'],
    });
  });
});
