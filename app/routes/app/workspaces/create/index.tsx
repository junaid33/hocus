import { PrebuildEventStatus } from "@prisma/client";
import type { ActionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import { runCreateWorkspace } from "~/agent/workflows";
import { AppPage } from "~/components/app-page";
import { HttpError } from "~/http-error.server";
import { CreateWorkspaceFormValidator } from "~/schema/create-workspace-form.validator.server";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";
import { unwrap } from "~/utils.shared";

export const action = async ({ context: { app, db, req, user } }: ActionArgs) => {
  const withClient = app.resolve(Token.TemporalClient);
  const workspaceService = app.resolve(Token.WorkspaceService);
  const formData = req.body;
  const { success, value: workspaceInfo } = CreateWorkspaceFormValidator.SafeParse(formData);
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Invalid form data");
  }
  const prebuildEvent = await db.prebuildEvent.findUnique({
    where: { externalId: workspaceInfo.prebuildEventId },
    include: { gitBranchLinks: { include: { gitBranch: true } } },
  });
  if (prebuildEvent == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Prebuild not found");
  }
  const gitBranch = prebuildEvent.gitBranchLinks.find(
    (link) => link.gitBranch.externalId === workspaceInfo.gitBranchId,
  )?.gitBranch;
  if (gitBranch == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Git branch not found");
  }
  if (prebuildEvent.status !== PrebuildEventStatus.PREBUILD_EVENT_STATUS_SUCCESS) {
    throw new HttpError(
      StatusCodes.BAD_REQUEST,
      "Prebuild must be successful before a workspace can be created",
    );
  }
  const externalWorkspaceId = uuidv4();
  const workspaceName = workspaceService.generateWorkspaceName();

  await withClient(async (client) => {
    return await client.workflow.execute(runCreateWorkspace, {
      workflowId: uuidv4(),
      taskQueue: MAIN_TEMPORAL_QUEUE,
      retry: { maximumAttempts: 1 },
      args: [
        {
          name: workspaceName,
          externalId: externalWorkspaceId,
          prebuildEventId: prebuildEvent.id,
          gitBranchId: gitBranch.id,
          userId: unwrap(user).id,
        },
      ],
    });
  });

  return json({ workspaceId: externalWorkspaceId });
};

export default function ProjectRoute(): JSX.Element {
  const actionData = useActionData<typeof action>();

  return <AppPage>workspace id: {actionData?.workspaceId}</AppPage>;
}