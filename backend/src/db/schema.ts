import { sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
  text,
  jsonb
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "educator", "admin"]);
export const orderTypeEnum = pgEnum("order_type", ["market", "limit", "stop_loss"]);
export const orderSideEnum = pgEnum("order_side", ["buy", "sell"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "filled", "cancelled"]);
export const competitionStatusEnum = pgEnum("competition_status", ["draft", "active", "ended"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  virtualBalance: numeric("virtual_balance", { precision: 15, scale: 2 }).notNull().default("10000.00"),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const priceTicks = pgTable(
  "price_ticks",
  {
    time: timestamp("time", { withTimezone: true }).notNull(),
    ticker: text("ticker").notNull(),
    price: numeric("price", { precision: 12, scale: 4 }).notNull(),
    volume: integer("volume").notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.time, table.ticker] })
  })
);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  type: orderTypeEnum("type").notNull(),
  side: orderSideEnum("side").notNull(),
  quantity: integer("quantity").notNull(),
  limitPrice: numeric("limit_price", { precision: 12, scale: 4 }),
  status: orderStatusEnum("status").notNull().default("pending"),
  filledPrice: numeric("filled_price", { precision: 12, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  competitionId: uuid("competition_id")
});

export const holdings = pgTable(
  "holdings",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ticker: text("ticker").notNull(),
    quantity: integer("quantity").notNull().default(0),
    avgCost: numeric("avg_cost", { precision: 12, scale: 4 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.ticker] })
  })
);

export const competitions = pgTable("competitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  startBalance: decimal("start_balance", { precision: 12, scale: 2 }).notNull(),
  joinCode: text("join_code").notNull().unique(),
  isPublic: boolean("is_public").notNull().default(true),
  password: text("password"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  status: text("status", { enum: ["draft", "pending", "active", "finished"] }).notNull().default("draft"),
  stockDataSource: text("stock_data_source", { enum: ["simulated", "excel", "live"] }).notNull().default("simulated"),
  stockDataConfig: jsonb("stock_data_config"),
  allowUserInfluence: boolean("allow_user_influence").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const competitionParticipants = pgTable(
  "competition_participants",
  {
    competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    virtualBalance: numeric("virtual_balance", { precision: 15, scale: 2 }).notNull(),
    rank: integer("rank"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.competitionId, table.userId] })
  })
);

export const competitionHoldings = pgTable(
  "competition_holdings",
  {
    competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ticker: text("ticker").notNull(),
    quantity: integer("quantity").notNull().default(0),
    avgCost: numeric("avg_cost", { precision: 12, scale: 4 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.competitionId, table.userId, table.ticker] })
  })
);

export const updatedAtNow = sql`NOW()`;
