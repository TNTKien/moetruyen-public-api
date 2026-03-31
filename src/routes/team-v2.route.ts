import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { teamIdParamsSchema, teamListQuerySchema, teamMemberSchema, teamSummarySchema, teamUpdateItemSchema, teamUpdatesQuerySchema } from "../contracts/team.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { getPaginationMeta } from "../lib/pagination.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { teamService } from "../services/team.service.js";

export const teamRouteV2 = new Hono<AppBindings>();

teamRouteV2.get(
  "/teams",
  describeRoute({
    tags: ["Teams"],
    summary: "List public teams (v2)",
    description: "Returns paginated approved translation teams with optional search and team-specific sort modes.",
    responses: {
      200: {
        description: "Paginated team list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(teamSummarySchema))),
          },
        },
      },
      400: {
        description: "Invalid query parameters",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("query", teamListQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await teamService.listPublicTeams(query);

    c.header("Cache-Control", CACHE_CONTROL.teamList);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);

teamRouteV2.get(
  "/teams/:id",
  describeRoute({
    tags: ["Teams"],
    summary: "Get public team (v2)",
    description: "Returns public-safe metadata for an approved translation team.",
    responses: {
      200: {
        description: "Team detail",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(teamSummarySchema)),
          },
        },
      },
      400: {
        description: "Invalid route parameters",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
      404: {
        description: "Team not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", teamIdParamsSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const item = await teamService.getPublicTeamById(id);

    if (!item) {
      throw new AppError({
        code: "TEAM_NOT_FOUND",
        message: "Team not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.teamDetail);

    return jsonSuccess(c, item);
  },
);

teamRouteV2.get(
  "/teams/:id/updates",
  describeRoute({
    tags: ["Teams"],
    summary: "List public team updates (v2)",
    description: "Returns paginated recent chapter updates associated with an approved translation team.",
    responses: {
      200: {
        description: "Paginated team update list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(teamUpdateItemSchema))),
          },
        },
      },
      400: {
        description: "Invalid request parameters",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
      404: {
        description: "Team not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", teamIdParamsSchema, validationHook),
  validator("query", teamUpdatesQuerySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const result = await teamService.listPublicTeamUpdatesByTeamId(id, query);

    if (!result) {
      throw new AppError({
        code: "TEAM_NOT_FOUND",
        message: "Team not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.teamUpdates);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);

teamRouteV2.get(
  "/teams/:id/members",
  describeRoute({
    tags: ["Teams"],
    summary: "List public team members (v2)",
    description: "Returns approved public-facing members for an approved translation team.",
    responses: {
      200: {
        description: "Team members",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(teamMemberSchema))),
          },
        },
      },
      400: {
        description: "Invalid route parameters",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
      404: {
        description: "Team not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", teamIdParamsSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const items = await teamService.listPublicTeamMembersByTeamId(id);

    if (!items) {
      throw new AppError({
        code: "TEAM_NOT_FOUND",
        message: "Team not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.teamMembers);

    return jsonSuccess(c, items);
  },
);
