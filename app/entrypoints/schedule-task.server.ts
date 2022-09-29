// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "@prisma/client";
import { TaskService } from "~/services/task.service.server";

const db = new PrismaClient();

const taskService = new TaskService();
// eslint-disable-next-line @typescript-eslint/no-floating-promises
taskService.scheduleTask(db, "hello", { name: "Hugo" });