import { context, getOctokit } from '@actions/github';
import type { GitHub } from '@actions/github/lib/utils.js';

export class GitHubService {
  private context: typeof context;
  private readonly owner: string;
  private readonly repo: string;
  private octokit: InstanceType<typeof GitHub>;
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
      try {
        const response = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: location,
          ref: this.baseBranch,
        });

        if (
          'type' in response.data &&
          response.data.type === 'file' &&
          response.data.content
        ) {
          if (location !== response.data.path) {
            console.log(
              `Found CODEOWNERS file at ${response.data.path} in ${this.baseBranch}, but expected ${location}`
            );
          }

          return {
            content: Buffer.from(response.data.content, 'base64').toString(),
            location: response.data.path,
          };
        }
      } catch (error) {
        if (
          error instanceof Error &&
          'status' in error &&
          error.status !== 404
        ) {
          console.log(error);
        }
      }
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
