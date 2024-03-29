import path from "path";

import { WorkspaceStatus } from "@prisma/client";
import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import { runStopWorkspace } from "~/agent/workflows";
import { HttpError } from "~/http-error.server";
import { getWorkspacePath } from "~/page-paths.shared";
import { UuidValidator } from "~/schema/uuid.validator.server";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export const action = async ({ context: { app, db, req, user } }: ActionArgs) => {
  const withClient = app.resolve(Token.TemporalClient);
  const { success, value: workspaceExternalId } = UuidValidator.SafeParse(
    path.parse(req.params[0]).name,
  );
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Workspace id must be a UUID");
  }
  const workspace = await db.workspace.findUnique({
    where: { externalId: workspaceExternalId },
  });
  if (workspace == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Workspace not found");
  }
  if (workspace.userId !== unwrap(user).id) {
    throw new HttpError(StatusCodes.FORBIDDEN, "Workspace does not belong to user");
  }
  if (workspace.status !== WorkspaceStatus.WORKSPACE_STATUS_STARTED) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Workspace must be started before stopping");
  }

  await withClient(async (client) => {
    return await client.workflow.start(runStopWorkspace, {
      workflowId: uuidv4(),
      taskQueue: MAIN_TEMPORAL_QUEUE,
      retry: { maximumAttempts: 1 },
      args: [workspace.id],
    });
  });

  return redirect(getWorkspacePath(workspaceExternalId, { justStopped: true }));
};
