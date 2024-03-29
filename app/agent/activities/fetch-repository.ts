import { v4 as uuidv4 } from "uuid";
import { Token } from "~/token";

import type { CreateActivity } from "./types";

export type FetchRepositoryActivity = (gitRepositoryId: bigint) => Promise<void>;
export const fetchRepository: CreateActivity<FetchRepositoryActivity> =
  ({ injector, db }) =>
  async (gitRepositoryId) => {
    const instanceId = `fetchrepo-${uuidv4()}`;
    const firecrackerService = injector.resolve(Token.FirecrackerService)(instanceId);
    const gitService = injector.resolve(Token.AgentGitService);
    const agentUtilService = injector.resolve(Token.AgentUtilService);
    const repo = await db.gitRepository.findUniqueOrThrow({
      where: { id: gitRepositoryId },
      include: {
        sshKeyPair: true,
      },
    });
    const repoFile = await db.$transaction(async (tdb) => {
      const agentInstance = await agentUtilService.getOrCreateSoloAgentInstance(tdb);
      return await gitService.getOrCreateGitRepositoryFile(tdb, agentInstance.id, repo.id);
    });
    await gitService.fetchRepository(
      firecrackerService,
      {
        pathOnHost: repoFile.file.path,
        maxSizeMiB: 5000,
      },
      {
        url: repo.url,
        credentials: {
          privateSshKey: repo.sshKeyPair.privateKey,
        },
      },
    );
  };
