import { warning } from '@actions/core';
import { context, getOctokit } from '@actions/github';

// Hard cap of the "list pull request files" endpoint
const MAX_LISTED_FILES = 3000;

export class GitHubService {
  private context: typeof context;
  private readonly owner: string;
  private readonly repo: string;
  private octokit: ReturnType<typeof getOctokit>;
  private readonly pullNumber: number;
  private readonly baseBranch: string;

  constructor(token: string, ghContext: typeof context) {
    this.context = ghContext;
    this.validateContext();
    this.octokit = getOctokit(token);
    this.owner = this.context.repo.owner;
    this.repo = this.context.repo.repo;
    this.pullNumber = this.context.payload.pull_request!.number;
    this.baseBranch = this.context.payload.pull_request!.base.ref;
  }

  async listChangedFiles() {
    try {
      const filesIterator = this.octokit.paginate.iterator(
        this.octokit.rest.pulls.listFiles,
        {
          owner: this.owner,
          repo: this.repo,
          pull_number: this.pullNumber,
          per_page: 100,
        }
      );

      const changedFiles: string[] = [];
      for await (const { data: files } of filesIterator) {
        for (const file of files) {
          changedFiles.push(file.filename);
        }
      }

      if (changedFiles.length >= MAX_LISTED_FILES) {
        warning(
          `GitHub lists at most ${MAX_LISTED_FILES} changed files per pull request; owners of files beyond that are missing.`
        );
      }

      return changedFiles;
    } catch (error) {
      console.error('Failed to list changed files:', error);
      throw new Error('Failed to retrieve files.', { cause: error });
    }
  }

  async getCodeownersFile() {
    // https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners#codeowners-file-location
    // Order matters!
    // GitHub does not ignore empty files or files with errors even if there are others in the repo
    const CODEOWNERS_LOCATIONS = [
      '.github/CODEOWNERS',
      'CODEOWNERS',
      'docs/CODEOWNERS',
    ];

    for (const location of CODEOWNERS_LOCATIONS) {
      let data;
      try {
        ({ data } = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: location,
          ref: this.baseBranch,
        }));
      } catch (error) {
        // Only "not found" means "try the next location"; anything else
        // (403, 5xx, rate limit) would otherwise silently pick the wrong file
        if ((error as { status?: number }).status === 404) continue;
        throw error;
      }

      // An empty file still counts: GitHub uses it, so it must not fall through
      if (!('type' in data) || data.type !== 'file') continue;

      // The contents API omits content above 1 MB; GitHub allows up to 3 MB
      if (data.encoding === 'none') {
        throw new Error(
          `CODEOWNERS file at ${data.path} is too large to read (over 1 MB)`
        );
      }

      if (location !== data.path) {
        console.log(
          `Found CODEOWNERS file at ${data.path} in ${this.baseBranch}, but expected ${location}`
        );
      }

      return {
        content: Buffer.from(data.content, 'base64').toString(),
        location: data.path,
      };
    }

    return { content: null, location: null };
  }

  async getCodeownersErrors() {
    try {
      const { data } = await this.octokit.rest.repos.codeownersErrors({
        owner: this.owner,
        repo: this.repo,
        ref: this.baseBranch,
      });

      if (data.errors.length > 0) {
        return {
          lines: data.errors.map((error) => error.line),
          location: data.errors[0].path,
        };
      }
      return { lines: [], location: null };
    } catch (error) {
      console.log('Failed to get codeowners errors:', error);
      throw new Error('Failed getCodeownersErrors().', { cause: error });
    }
  }

  private validateContext() {
    if (!this.context.payload.pull_request) {
      throw new Error('This action can only be run on pull requests.');
    }
  }
}
