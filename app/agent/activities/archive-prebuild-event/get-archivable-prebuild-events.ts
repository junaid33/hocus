import type { PrebuildEvent } from "@prisma/client";
import { Token } from "~/token";

import type { CreateActivity } from "../types";

export type GetArchivablePrebuildEventsActivity = (projectId: bigint) => Promise<PrebuildEvent[]>;
export const getArchivablePrebuildEvents: CreateActivity<GetArchivablePrebuildEventsActivity> =
  ({ db, injector }) =>
  async (projectId) => {
    const prebuildService = injector.resolve(Token.PrebuildService);
    return await prebuildService.getArchivablePrebuildEvents(db, projectId);
  };
