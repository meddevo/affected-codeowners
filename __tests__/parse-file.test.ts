import { parseFile } from '../src/codeowners/parse-file.js';

describe('parseFile', () => {
  it('should parse the README example', () => {
    const input =
      '# CODEOWNERS rules\n' +
      '/**/*.js @team-global\n' +
      '/src/* @team-a @user1\n' +
      '/src/utils/* @team-c @user2 @user3\n' +
      '/docs/* @team-b @user1\n' +
      '/tests/unit/* @team-a @user2\n' +
      '/package.json @team-maintainers @user3\n';

    const output = parseFile(input, []);
    expect(output).toEqual([
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
    ]);
  });

  it('should parse a file with an empty overwrite', () => {
    const input =
      '# CODEOWNERS rules\n' +
      '/libs/workspace @user1\n' +
      '/libs/writer @user2\n' +
      '/libs/**/package.json\n';

    const output = parseFile(input, []);

    expect(output).toEqual([
      {
        lineNumber: 4,
        owners: [],
        pattern: '/libs/**/package.json',
        regexPattern: /^libs(?:\/.+)?\/package\.json(?:\/.*)?$/,
      },
      {
        lineNumber: 3,
        owners: ['@user2'],
        pattern: '/libs/writer',
        regexPattern: /^libs\/writer(?:\/.*)?$/,
      },
      {
        lineNumber: 2,
        owners: ['@user1'],
        pattern: '/libs/workspace',
        regexPattern: /^libs\/workspace(?:\/.*)?$/,
      },
    ]);
  });

  it('should parse space correctly', () => {
    const input = 'hello/wo\\ rld @owner1';
    const output = parseFile(input, []);

    expect(output).toEqual([
      {
        lineNumber: 1,
        owners: ['@owner1'],
        pattern: 'hello/wo\\ rld',
        regexPattern: expect.any(RegExp),
      },
    ]);
  });

  it('should parse leading, trailing and middle whitespace correctly', () => {
    const input = '  \t*.md \t @owner1\t@owner2\t ';
    const output = parseFile(input, []);

    expect(output).toEqual([
      {
        lineNumber: 1,
        owners: ['@owner1', '@owner2'],
        pattern: '*.md',
        regexPattern: expect.any(RegExp),
      },
    ]);
  });

  it('should parse github example codeowners content', () => {
    // https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners#example-of-a-codeowners-file
    const input =
      '# This is a comment.\n' +
      '# Each line is a file pattern followed by one or more owners.\n' +
      '\n' +
      '# These owners will be the default owners for everything in\n' +
      '# the repo. Unless a later match takes precedence,\n' +
      '# @global-owner1 and @global-owner2 will be requested for\n' +
      '# review when someone opens a pull request.\n' +
      '*       @global-owner1 @global-owner2\n' +
      '\n' +
      '# Order is important; the last matching pattern takes the most\n' +
      '# precedence. When someone opens a pull request that only\n' +
      '# modifies JS files, only @js-owner and not the global\n' +
      '# owner(s) will be requested for a review.\n' +
      '*.js    @js-owner #This is an inline comment.\n' +
      '\n' +
      "# You can also use email addresses if you prefer. They'll be\n" +
      '# used to look up users just like we do for commit author\n' +
      '# emails.\n' +
      '*.go docs@example.com\n' +
      '\n' +
      '# Teams can be specified as code owners as well. Teams should\n' +
      '# be identified in the format @org/team-name. Teams must have\n' +
      '# explicit write access to the repository. In this example,\n' +
      '# the octocats team in the octo-org organization owns all .txt files.\n' +
      '*.txt @octo-org/octocats\n' +
      '\n' +
      '# In this example, @doctocat owns any files in the build/logs\n' +
      '# directory at the root of the repository and any of its\n' +
      '# subdirectories.\n' +
      '/build/logs/ @doctocat\n' +
      '\n' +
      '# The `docs/*` pattern will match files like\n' +
      '# `docs/getting-started.md` but not further nested files like\n' +
      '# `docs/build-app/troubleshooting.md`.\n' +
      'docs/* docs@example.com\n' +
      '\n' +
      '# In this example, @octocat owns any file in an apps directory\n' +
      '# anywhere in your repository.\n' +
      'apps/ @octocat\n' +
      '\n' +
      '# In this example, @doctocat owns any file in the `/docs`\n' +
      '# directory in the root of your repository and any of its\n' +
      '# subdirectories.\n' +
      '/docs/ @doctocat\n' +
      '\n' +
      '# In this example, any change inside the `/scripts` directory\n' +
      '# will require approval from @doctocat or @octocat.\n' +
      '/scripts/ @doctocat @octocat\n' +
      '\n' +
      '# In this example, @octocat owns any file in a `/logs` directory such as\n' +
      '# `/build/logs`, `/scripts/logs`, and `/deeply/nested/logs`. Any changes\n' +
      '# in a `/logs` directory will require approval from @octocat.\n' +
      '**/logs @octocat\n' +
      '\n' +
      '# In this example, @octocat owns any file in the `/apps`\n' +
      '# directory in the root of your repository except for the `/apps/github`\n' +
      '# subdirectory, as its owners are left empty. Without an owner, changes\n' +
      '# to `apps/github` can be made with the approval of any user who has\n' +
      '# write access to the repository.\n' +
      '/apps/ @octocat\n' +
      '/apps/github\n' +
      '\n' +
      '# In this example, @octocat owns any file in the `/apps`\n' +
      '# directory in the root of your repository except for the `/apps/github`\n' +
      '# subdirectory, as this subdirectory has its own owner @doctocat\n' +
      '/apps/ @octocat\n' +
      '/apps/github @doctocat';
    const output = parseFile(input, []);

    expect(output).toEqual([
      {
        lineNumber: 67,
        owners: ['@doctocat'],
        pattern: '/apps/github',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 66,
        owners: ['@octocat'],
        pattern: '/apps/',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 61,
        owners: [],
        pattern: '/apps/github',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 60,
        owners: ['@octocat'],
        pattern: '/apps/',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 53,
        owners: ['@octocat'],
        pattern: '**/logs',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 48,
        owners: ['@doctocat', '@octocat'],
        pattern: '/scripts/',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 44,
        owners: ['@doctocat'],
        pattern: '/docs/',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 39,
        owners: ['@octocat'],
        pattern: 'apps/',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 35,
        owners: ['docs@example.com'],
        pattern: 'docs/*',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 30,
        owners: ['@doctocat'],
        pattern: '/build/logs/',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 25,
        owners: ['@octo-org/octocats'],
        pattern: '*.txt',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 19,
        owners: ['docs@example.com'],
        pattern: '*.go',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 14,
        owners: ['@js-owner'],
        pattern: '*.js',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 8,
        owners: ['@global-owner1', '@global-owner2'],
        pattern: '*',
        regexPattern: expect.any(RegExp),
      },
    ]);
  });

  it('should parse valid file content into a Ruleset', async () => {
    const fileContent = `
# This is a comment
valid line 1

valid line 2
`;
    const errors: number[] = [];
    const result = parseFile(fileContent, errors);
    expect(result).toEqual([
      {
        lineNumber: 5,
        owners: ['line', '2'],
        pattern: 'valid',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 3,
        owners: ['line', '1'],
        pattern: 'valid',
        regexPattern: expect.any(RegExp),
      },
    ]);
  });

  it('should skip empty lines and comments', async () => {
    const fileContent = `
# This is a comment
# Another comment

`;
    const errors: number[] = [];
    const result = await parseFile(fileContent, errors);
    expect(result).toEqual([]);
  });

  it('should skip lines specified in the errors array', async () => {
    const fileContent =
      'valid line 1\n' +
      'valid line 2\n' +
      'line with error\n' +
      'valid line 4';
    const errors: number[] = [3];
    const result = parseFile(fileContent, errors);
    expect(result).toEqual([
      {
        lineNumber: 4,
        owners: ['line', '4'],
        pattern: 'valid',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 2,
        owners: ['line', '2'],
        pattern: 'valid',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 1,
        owners: ['line', '1'],
        pattern: 'valid',
        regexPattern: expect.any(RegExp),
      },
    ]);
  });

  it('should throw an error for invalid lines', async () => {
    const fileContent = 'valid line\n' + '***\n' + 'another valid line';
    const errors: number[] = [];
    const output = parseFile(fileContent, errors);

    expect(output).toEqual([
      {
        lineNumber: 3,
        owners: ['valid', 'line'],
        pattern: 'another',
        regexPattern: expect.any(RegExp),
      },
      {
        lineNumber: 1,
        owners: ['line'],
        pattern: 'valid',
        regexPattern: expect.any(RegExp),
      },
    ]);
  });
});
