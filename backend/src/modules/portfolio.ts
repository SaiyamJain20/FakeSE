import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { holdings, orders } from "../db/schema";
import { authenticate } from "../lib/auth";
import { db } from "../lib/db";
import { PortfolioService } from "../domain/portfolio/portfolioService";

/**
 * portfolioModule — route controller only.
 * All computation is delegated to PortfolioService (SRP, GRASP Controller).
 */
export const portfolioModule = new Elysia({ prefix: "/portfolio" })
  .get("/", async (ctx) => {
    const { user } = await authenticate(ctx as any);

    const userHoldings = await db
      .select({
        ticker: holdings.ticker,
        quantity: holdings.quantity,
        avgCost: holdings.avgCost
      })
      .from(holdings)
      .where(eq(holdings.userId, user.id));

    return PortfolioService.buildSummary(userHoldings, user.virtualBalance);
  })
  .get(
    "/history",
    async (ctx) => {
      const { user } = await authenticate(ctx as any);
      const limit = Math.min(Number((ctx as any).query.limit ?? 50), 100);
      const offset = Math.max(Number((ctx as any).query.offset ?? 0), 0);

      const rows = await db
        .select({
          id: orders.id,
          ticker: orders.ticker,
          type: orders.type,
          side: orders.side,
          quantity: orders.quantity,
          status: orders.status,
          filledPrice: orders.filledPrice,
          createdAt: orders.createdAt,
          executedAt: orders.executedAt
        })
        .from(orders)
        .where(eq(orders.userId, user.id))
        .limit(limit)
        .offset(offset);

      return { history: rows };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      })
    }
  );
