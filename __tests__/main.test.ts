import { jest } from '@jest/globals';

const core = {
  getInput: jest.fn(() => 'token'),
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
};
const github = {
  getCodeownersFile: jest.fn<() => Promise<unknown>>(),
  getCodeownersErrors: jest.fn<() => Promise<unknown>>(),
  listChangedFiles: jest.fn<() => Promise<unknown>>(),
};
jest.unstable_mockModule('@actions/core', () => core);
jest.unstable_mockModule('@actions/github', () => ({ context: {} }));
jest.unstable_mockModule('../src/github.service.js', () => ({
  GitHubService: jest.fn(() => github),
}));

const { run } = await import('../src/main.js');

const outputs = () => Object.fromEntries(core.setOutput.mock.calls);

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    github.getCodeownersFile.mockResolvedValue({
      content: '* @default\n/src/ @team-src\n',
      location: '.github/CODEOWNERS',
    });
    github.getCodeownersErrors.mockResolvedValue({ lines: [], location: null });
    github.listChangedFiles.mockResolvedValue(['src/a.ts', 'README.md']);
  });

  it('should output the affected owners', async () => {
    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(outputs()).toEqual({
      'grouped-owners': '[["@team-src"],["@default"]]',
      'individual-owners': '["@team-src","@default"]',
    });
  });

  it('should skip without calling the errors API when there is no CODEOWNERS file', async () => {
    github.getCodeownersFile.mockResolvedValue({
      content: null,
      location: null,
    });

    await run();

    expect(github.getCodeownersErrors).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(outputs()).toEqual({
      'grouped-owners': '[]',
      'individual-owners': '[]',
    });
  });

  it('should output empty JSON arrays for an empty CODEOWNERS file', async () => {
    github.getCodeownersFile.mockResolvedValue({
      content: '',
      location: '.github/CODEOWNERS',
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(outputs()).toEqual({
      'grouped-owners': '[]',
      'individual-owners': '[]',
    });
  });

  it('should fail when the errors API points at a different file', async () => {
    github.getCodeownersErrors.mockResolvedValue({
      lines: [1],
      location: 'docs/CODEOWNERS',
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('does not match')
    );
  });

  it('should fail on non-Error throws', async () => {
    github.getCodeownersFile.mockRejectedValue('boom');

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('boom');
  });
});
