import { Elysia, t } from "elysia";
import { authenticate, hashPassword, verifyPassword } from "../lib/auth";
import { sql } from "../lib/db";
import { redis } from "../lib/redis";

export const authModule = new Elysia({ prefix: "/auth" })
  .get("/login", () => ({
    error: "Use POST /auth/login with JSON body: { usernameOrEmail, password }"
  }))
  .post(
    "/register",
    async (ctx: any) => {
      const body = ctx.body as any;
      const username = body.username.trim();
      const email = body.email.trim().toLowerCase();

      const [existing] = await sql<{ id: string }[]>`
        SELECT id FROM users WHERE username = ${username} OR email = ${email} LIMIT 1
      `;

      if (existing) {
        ctx.set.status = 409;
        return { error: "Username or email already exists" };
      }

      const passwordHash = await hashPassword(body.password);

      const [created] = await sql<
        { id: string; username: string; role: "user" | "educator" | "admin"; email: string; virtualBalance: string }[]
      >`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (${username}, ${email}, ${passwordHash}, ${body.role ?? "user"})
        RETURNING id, username, role, email, virtual_balance as "virtualBalance"
      `;

      const token = await ctx.jwt.sign({
        sub: created.id,
        username: created.username,
        role: created.role
      });

      await redis.set(`session:active:${token}`, created.id, "EX", 7 * 24 * 60 * 60);

      return { token, user: created };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3, maxLength: 50 }),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8, maxLength: 128 }),
        role: t.Optional(t.Union([t.Literal("user"), t.Literal("educator")]))
      })
    }
  )
  .post(
    "/login",
    async (ctx: any) => {
      const body = ctx.body as any;
      const identifier = String(body.usernameOrEmail ?? body.username ?? body.email ?? "").trim();

      if (!identifier || !body.password) {
        ctx.set.status = 400;
        return { error: "usernameOrEmail (or username/email) and password are required" };
      }

      const usernameOrEmail = identifier.toLowerCase();

      const [user] = await sql<
        {
          id: string;
          username: string;
          email: string;
          passwordHash: string;
          role: "user" | "educator" | "admin";
          virtualBalance: string;
        }[]
      >`
        SELECT id,
               username,
               email,
               password_hash as "passwordHash",
               role,
               virtual_balance as "virtualBalance"
        FROM users
        WHERE email = ${usernameOrEmail} OR username = ${identifier}
        LIMIT 1
      `;

      if (!user) {
        ctx.set.status = 401;
        return { error: "Invalid credentials" };
      }

      const ok = await verifyPassword(body.password, user.passwordHash);
      if (!ok) {
        ctx.set.status = 401;
        return { error: "Invalid credentials" };
      }

      const token = await ctx.jwt.sign({
        sub: user.id,
        username: user.username,
        role: user.role
      });

      await redis.set(`session:active:${token}`, user.id, "EX", 7 * 24 * 60 * 60);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          virtualBalance: user.virtualBalance
        }
      };
    },
    {
      body: t.Object({
        usernameOrEmail: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        username: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        email: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        password: t.String({ minLength: 8, maxLength: 128 })
      })
    }
  )
  .post(
    "/signin",
    async (ctx: any) => {
      const body = ctx.body as any;
      const identifier = String(body.usernameOrEmail ?? body.username ?? body.email ?? "").trim();

      if (!identifier || !body.password) {
        ctx.set.status = 400;
        return { error: "usernameOrEmail (or username/email) and password are required" };
      }

      const usernameOrEmail = identifier.toLowerCase();

      const [user] = await sql<
        {
          id: string;
          username: string;
          email: string;
          passwordHash: string;
          role: "user" | "educator" | "admin";
          virtualBalance: string;
        }[]
      >`
        SELECT id,
               username,
               email,
               password_hash as "passwordHash",
               role,
               virtual_balance as "virtualBalance"
        FROM users
        WHERE email = ${usernameOrEmail} OR username = ${identifier}
        LIMIT 1
      `;

      if (!user) {
        ctx.set.status = 401;
        return { error: "Invalid credentials" };
      }

      const ok = await verifyPassword(body.password, user.passwordHash);
      if (!ok) {
        ctx.set.status = 401;
        return { error: "Invalid credentials" };
      }

      const token = await ctx.jwt.sign({
        sub: user.id,
        username: user.username,
        role: user.role
      });

      await redis.set(`session:active:${token}`, user.id, "EX", 7 * 24 * 60 * 60);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          virtualBalance: user.virtualBalance
        }
      };
    },
    {
      body: t.Object({
        usernameOrEmail: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        username: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        email: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        password: t.String({ minLength: 8, maxLength: 128 })
      })
    }
  )
  .post("/logout", async (ctx) => {
    try {
      const { token } = await authenticate(ctx as any);
      const payload = await (ctx as any).jwt.verify(token);
      const exp = typeof payload?.exp === "number" ? payload.exp : Math.floor(Date.now() / 1000) + 3600;
      const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);

      await redis.set(`session:blacklist:${token}`, "1", "EX", ttl);
      await redis.del(`session:active:${token}`);

      return { ok: true };
    } catch {
      return { ok: true };
    }
  })
  .get("/me", async (ctx: any) => {
    const { user } = await authenticate(ctx as any);
    return { user };
  });
