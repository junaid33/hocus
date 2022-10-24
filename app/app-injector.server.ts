import { createInjector, Scope } from "typed-inject";
import { GoogleAnalyticsService } from "~/analytics/google-analytics.service.server";
import { config } from "~/config";
import { newLogger } from "~/logger.server";
import { TaskService } from "~/tasks/task.service.server";
import { Token } from "~/token";
import { UserService } from "~/user/user.service.server";

export const createAppInjector = () =>
  createInjector()
    .provideValue(Token.Config, config)
    .provideFactory(Token.Logger, newLogger, Scope.Transient)
    .provideClass(Token.GoogleAnalyticsService, GoogleAnalyticsService)
    .provideClass(Token.TaskService, TaskService)
    .provideClass(Token.UserService, UserService);
export type AppInjector = ReturnType<typeof createAppInjector>;