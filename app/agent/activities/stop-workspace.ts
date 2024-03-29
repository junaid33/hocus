import { WorkspaceStatus } from "@prisma/client";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

import type { CreateActivity } from "./types";

export type StopWorkspaceActivity = (workspaceId: bigint) => Promise<void>;
export const stopWorkspace: CreateActivity<StopWorkspaceActivity> =
  ({ injector, db }) =>
  async (workspaceId) => {
    const workspaceAgentService = injector.resolve(Token.WorkspaceAgentService);

    await db.$transaction((tdb) =>
      workspaceAgentService.markWorkspaceAs(
        tdb,
        workspaceId,
        WorkspaceStatus.WORKSPACE_STATUS_PENDING_STOP,
      ),
    );
    const workspace = await db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        activeInstance: true,
      },
    });
    const instance = unwrap(workspace.activeInstance);
    const firecrackerService = injector.resolve(Token.FirecrackerService)(
      instance.firecrackerInstanceId,
    );

    const vmInfo = await firecrackerService.getVMInfo();
    if (vmInfo?.status === "on") {
      await firecrackerService.shutdownVM();
    }
    if (vmInfo != null) {
      await firecrackerService.releaseVmResources(vmInfo.info.ipBlockId);
    }
    await firecrackerService.tryDeleteVmDir();

    await db.$transaction((tdb) =>
      workspaceAgentService.removeWorkspaceInstanceFromDb(tdb, workspaceId),
    );
  };
