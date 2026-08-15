import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { removeImageBackground, SUPPORTED_IMAGE_TYPES } from "./backgroundRemoval";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  background: router({
    remove: publicProcedure
      .input(
        z.object({
          dataUrl: z.string().min(32).max(12_000_000),
          filename: z.string().min(1).max(160),
          mimeType: z.enum(SUPPORTED_IMAGE_TYPES),
          mode: z.enum(["background", "tshirt-design"]),
        })
      )
      .mutation(({ input }) => removeImageBackground(input.dataUrl, input.mimeType, input.mode)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
