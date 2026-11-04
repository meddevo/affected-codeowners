import { jest } from '@jest/globals';
import type { context } from '@actions/github';

const getOctokit = jest.fn();
const warning = jest.fn();
jest.unstable_mockModule('@actions/github', () => ({ getOctokit }));
jest.unstable_mockModule('@actions/core', () => ({ warning }));

const { GitHubService } = await import('../src/github.service.js');

const ghContext = {
  eventName: 'pull_request',
  repo: { repo: 'example-repo', owner: 'example-owner' },
  payload: { pull_request: { number: 1234, base: { ref: 'main' } } },
} as unknown as typeof context;

const file = (path: string, content: string) => ({
  data: {
    name: 'CODEOWNERS',
    path,
    type: 'file',
    encoding: 'base64',
    content: Buffer.from(content, 'utf-8').toString('base64'),
  },
});

const serviceWith = (octokit: unknown) => {
  getOctokit.mockReturnValue(octokit);
  return new GitHubService('fakegithubtoken', ghContext);
};

const serviceWithContent = (getContent: () => Promise<unknown>) =>
  serviceWith({ rest: { repos: { getContent } } });

describe('GitHubService', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should refuse to run outside of pull requests', () => {
    expect(
      () =>
        new GitHubService('fakegithubtoken', {
          ...ghContext,
          payload: {},
        } as unknown as typeof context)
    ).toThrow('This action can only be run on pull requests.');
  });

  describe('listChangedFiles', () => {
    const serviceWithPages = (...pages: { filename: string }[][]) =>
      serviceWith({
        paginate: {
          iterator: async function* () {
            for (const data of pages) yield { data };
          },
        },
        rest: { pulls: { listFiles: jest.fn() } },
      });

    it('should return a list of changed file names for the pull request', async () => {
      const service = serviceWithPages(
        [{ filename: 'file1.js' }],
        [{ filename: 'file2.js' }, { filename: 'file3.js' }]
      );

      expect(await service.listChangedFiles()).toEqual([
        'file1.js',
        'file2.js',
        'file3.js',
      ]);
      expect(warning).not.toHaveBeenCalled();
    });

    it('should warn when the 3000 file listing cap is reached', async () => {
      const page = Array.from({ length: 3000 }, (_, i) => ({
        filename: `f${i}`,
      }));

      expect(await serviceWithPages(page).listChangedFiles()).toHaveLength(
        3000
      );
      expect(warning).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCodeownersFile', () => {
    it('should return the content and location of the CODEOWNERS file if found', async () => {
      const service = serviceWithContent(async () =>
        file('.github/CODEOWNERS', 'test-codeowners-content')
      );

      expect(await service.getCodeownersFile()).toEqual({
        content: 'test-codeowners-content',
        location: '.github/CODEOWNERS',
      });
    });

    it('should find the correct location of the CODEOWNERS file and return its content', async () => {
      const getContent = jest
        .fn<() => Promise<unknown>>()
        .mockRejectedValueOnce({ status: 404, message: 'Not Found' })
        .mockResolvedValueOnce(file('CODEOWNERS', 'test-codeowners-content'));

      expect(await serviceWithContent(getContent).getCodeownersFile()).toEqual({
        content: 'test-codeowners-content',
        location: 'CODEOWNERS',
      });
    });

    it('should return null if no location has a CODEOWNERS file', async () => {
      const service = serviceWithContent(async () => {
        throw { status: 404 };
      });

      expect(await service.getCodeownersFile()).toEqual({
        content: null,
        location: null,
      });
    });

    it('should use an empty CODEOWNERS file instead of falling through', async () => {
      const getContent = jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue(file('.github/CODEOWNERS', ''));

      expect(await serviceWithContent(getContent).getCodeownersFile()).toEqual({
        content: '',
        location: '.github/CODEOWNERS',
      });
      expect(getContent).toHaveBeenCalledTimes(1);
    });

    it('should rethrow errors other than 404', async () => {
      const service = serviceWithContent(async () => {
        throw { status: 500, message: 'Server Error' };
      });

      await expect(service.getCodeownersFile()).rejects.toEqual({
        status: 500,
        message: 'Server Error',
      });
    });

    it('should fail on files too large for the contents API', async () => {
      const service = serviceWithContent(async () => ({
        data: {
          path: '.github/CODEOWNERS',
          type: 'file',
          encoding: 'none',
          content: '',
        },
      }));

      await expect(service.getCodeownersFile()).rejects.toThrow(
        'too large to read'
      );
    });
  });

  describe('getCodeownersErrors', () => {
    const serviceWithErrors = (errors: { line: number; path: string }[]) =>
      serviceWith({
        rest: {
          repos: { codeownersErrors: async () => ({ data: { errors } }) },
        },
      });

    it('should return error lines and location if errors exist', async () => {
      const service = serviceWithErrors([
        { line: 5, path: '.github/CODEOWNERS' },
        { line: 8, path: '.github/CODEOWNERS' },
      ]);

      expect(await service.getCodeownersErrors()).toEqual({
        lines: [5, 8],
        location: '.github/CODEOWNERS',
      });
    });

    it('should return empty lines and null location if no errors exist', async () => {
      expect(await serviceWithErrors([]).getCodeownersErrors()).toEqual({
        lines: [],
        location: null,
      });
    });
  });
});
