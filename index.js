import { exec } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
import AWS from "aws-sdk";
import sgMail from "@sendgrid/mail";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const execAsync = util.promisify(exec);

function registerTools(server) {
  //
  // ─── FLUTTER ──────────────────────────────────────────
  //
  server.registerTool({
    name: "flutter_create",
    description: "Create a new Flutter project",
    inputSchema: z.object({ name: z.string() }),
    async handler({ name }) {
      const { stdout, stderr } = await execAsync(`flutter create ${name}`);
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "flutter_run",
    description: "Run a Flutter project on a device/emulator",
    inputSchema: z.object({
      projectPath: z.string(),
      target: z.string().optional(),
    }),
    async handler({ projectPath, target }) {
      let cmd = "flutter run";
      if (target) cmd += ` --target=${target}`;
      const { stdout, stderr } = await execAsync(cmd, { cwd: projectPath });
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "flutter_pub",
    description: "Run flutter pub commands (get, add, outdated, etc.)",
    inputSchema: z.object({
      projectPath: z.string(),
      command: z.string(),
    }),
    async handler({ projectPath, command }) {
      const { stdout, stderr } = await execAsync(`flutter pub ${command}`, {
        cwd: projectPath,
      });
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "flutter_build",
    description: "Build Flutter project (apk, ios, web, etc.)",
    inputSchema: z.object({
      projectPath: z.string(),
      target: z.string(),
    }),
    async handler({ projectPath, target }) {
      const { stdout, stderr } = await execAsync(`flutter build ${target}`, {
        cwd: projectPath,
      });
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  //
  // ─── LARAVEL ──────────────────────────────────────────
  //
  server.registerTool({
    name: "laravel_new",
    description: "Create a new Laravel project",
    inputSchema: z.object({ name: z.string() }),
    async handler({ name }) {
      const { stdout, stderr } = await execAsync(
        `composer create-project laravel/laravel ${name}`
      );
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "laravel_artisan",
    description: "Run any artisan command",
    inputSchema: z.object({
      projectPath: z.string(),
      command: z.string(),
    }),
    async handler({ projectPath, command }) {
      const { stdout, stderr } = await execAsync(`php artisan ${command}`, {
        cwd: projectPath,
      });
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "laravel_make",
    description: "Generate Laravel resources (controller, model, migration, etc.)",
    inputSchema: z.object({
      projectPath: z.string(),
      type: z.string(),
      name: z.string(),
      options: z.record(z.string()).optional(),
    }),
    async handler({ projectPath, type, name, options }) {
      let command = `php artisan make:${type} ${name}`;
      if (options) {
        for (const [key, value] of Object.entries(options)) {
          const prefix = key.length === 1 ? "-" : "--";
          if (value === "true" || value === "") {
            command += ` ${prefix}${key}`;
          } else {
            command += ` ${prefix}${key}=${value}`;
          }
        }
      }
      const { stdout, stderr } = await execAsync(command, { cwd: projectPath });
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "laravel_version",
    description: "Manage Laravel project version stored in .env",
    inputSchema: z.object({
      projectPath: z.string(),
      action: z.enum(["get", "set", "bump"]),
      version: z.string().optional(),
      part: z.enum(["major", "minor", "patch"]).default("patch").optional(),
    }),
    async handler({ projectPath, action, version, part }) {
      const envFilePath = path.join(projectPath, ".env");
      const versionKey = "APP_VERSION";

      const readVersion = async () => {
        try {
          const envContent = await fs.readFile(envFilePath, "utf8");
          const match = envContent.match(
            new RegExp(`^${versionKey}=(.*)`, "m")
          );
          return match ? match[1] : null;
        } catch (error) {
          if (error.code === "ENOENT") return null;
          throw error;
        }
      };

      const writeVersion = async (newVersion) => {
        let envContent = "";
        try {
          envContent = await fs.readFile(envFilePath, "utf8");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }

        let lines = envContent.split("\n");
        let found = false;
        lines = lines
          .map((line) => {
            if (line.startsWith(`${versionKey}=`)) {
              found = true;
              return `${versionKey}=${newVersion}`;
            }
            return line;
          })
          .filter((line) => line.trim() !== "");

        if (!found) {
          lines.push(`${versionKey}=${newVersion}`);
        }

        await fs.writeFile(envFilePath, lines.join("\n") + "\n");
        return newVersion;
      };

      try {
        switch (action) {
          case "get": {
            const currentVersion = await readVersion();
            return {
              content: [
                {
                  type: "text",
                  text: currentVersion
                    ? `Current version: ${currentVersion}`
                    : `No version set in .env file.`,
                },
              ],
            };
          }
          case "set": {
            if (!version) {
              throw new Error("A 'version' is required for the 'set' action.");
            }
            const newVersion = await writeVersion(version);
            return {
              content: [{ type: "text", text: `Version set to: ${newVersion}` }],
            };
          }
          case "bump": {
            const currentVersion = await readVersion();
            if (!currentVersion) {
              const newVersion = "0.0.1";
              await writeVersion(newVersion);
              return {
                content: [
                  {
                    type: "text",
                    text: `No version found. Initialized to: ${newVersion}`,
                  },
                ],
              };
            }

            let [major, minor, patch] = currentVersion.split(".").map(Number);

            if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Invalid version format '${currentVersion}'. Use semantic versioning (e.g., 1.2.3).`,
                  },
                ],
              };
            }

            switch (part) {
              case "major":
                major++;
                minor = 0;
                patch = 0;
                break;
              case "minor":
                minor++;
                patch = 0;
                break;
              case "patch":
                patch++;
                break;
            }

            const newVersion = `${major}.${minor}.${patch}`;
            await writeVersion(newVersion);
            return {
              content: [{ type: "text", text: `Version bumped to: ${newVersion}` }],
            };
          }
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    },
  });

  //
  // ─── NODE ─────────────────────────────────────────────
  //
  server.registerTool({
    name: "node_init",
    description: "Initialize a new Node.js project",
    inputSchema: z.object({ projectName: z.string() }),
    async handler({ projectName }) {
      await fs.mkdir(projectName, { recursive: true });
      const { stdout, stderr } = await execAsync("npm init -y", {
        cwd: projectName,
      });
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "node_install",
    description: "Install npm packages into a Node.js project",
    inputSchema: z.object({
      projectPath: z.string(),
      packages: z.array(z.string()),
    }),
    async handler({ projectPath, packages }) {
      const { stdout, stderr } = await execAsync(
        `npm install ${packages.join(" ")}`,
        { cwd: projectPath }
      );
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "node_run",
    description: "Run npm script or JS file in a Node.js project",
    inputSchema: z.object({
      projectPath: z.string(),
      script: z.string(),
    }),
    async handler({ projectPath, script }) {
      const cmd = script.endsWith(".js")
        ? `node ${script}`
        : `npm run ${script}`;
      const { stdout, stderr } = await execAsync(cmd, { cwd: projectPath });
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  //
  // ─── DATABASE ──────────────────────────────────────────
  //
  server.registerTool({
    name: "db_query_mysql",
    description: "Run a SQL query on a MySQL database",
    inputSchema: z.object({
      host: z.string(),
      user: z.string(),
      password: z.string(),
      database: z.string(),
      query: z.string(),
    }),
    async handler({ host, user, password, database, query }) {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection({
        host,
        user,
        password,
        database,
      });
      const [rows] = await conn.execute(query);
      await conn.end();
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      };
    },
  });

  //
  // ─── ENV FILE ──────────────────────────────────────────
  //
  server.registerTool({
    name: "env_manage",
    description: "Read, create, update, or delete .env variables",
    inputSchema: z.object({
      projectPath: z.string(),
      action: z.enum(["read", "create", "update", "delete"]),
      key: z.string().optional(),
      value: z.string().optional(),
    }),
    async handler({ projectPath, action, key, value }) {
      const envFilePath = path.join(projectPath, ".env");
      try {
        let envContent = "";
        try {
          envContent = await fs.readFile(envFilePath, "utf8");
        } catch {}
        let lines = envContent.split("\n").filter(Boolean);

        switch (action) {
          case "read": {
            const result = lines
              .map((line) => line.split("="))
              .reduce((acc, [k, v]) => ((acc[k] = v), acc), {});
            return {
              content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
              ],
            };
          }
          case "create":
          case "update": {
            let found = false;
            lines = lines.map((line) => {
              if (line.startsWith(`${key}=`)) {
                found = true;
                return `${key}=${value}`;
              }
              return line;
            });
            if (!found) lines.push(`${key}=${value}`);
            await fs.writeFile(envFilePath, lines.join("\n") + "\n");
            return { content: [{ type: "text", text: `${key}=${value}` }] };
          }
          case "delete": {
            lines = lines.filter((line) => !line.startsWith(`${key}=`));
            await fs.writeFile(envFilePath, lines.join("\n") + "\n");
            return { content: [{ type: "text", text: `Deleted ${key}` }] };
          }
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    },
  });

  //
  // ─── EMAIL (SMTP, SES, SENDGRID) ───────────────
  //
  server.registerTool({
    name: "email_smtp",
    description: "Send email via SMTP",
    inputSchema: z.object({
      smtpHost: z.string(),
      smtpPort: z.number(),
      secure: z.boolean(),
      authUser: z.string(),
      authPass: z.string(),
      from: z.string(),
      to: z.string(),
      subject: z.string(),
      text: z.string().optional(),
      html: z.string().optional(),
    }),
    async handler(config) {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.secure,
        auth: { user: config.authUser, pass: config.authPass },
      });
      const info = await transporter.sendMail(config);
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    },
  });

  server.registerTool({
    name: "email_ses",
    description: "Send email using AWS SES SDK",
    inputSchema: z.object({
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
      region: z.string(),
      from: z.string(),
      to: z.string(),
      subject: z.string(),
      text: z.string().optional(),
      html: z.string().optional(),
    }),
    async handler(config) {
      const ses = new AWS.SES({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        region: config.region,
      });
      const params = {
        Source: config.from,
        Destination: { ToAddresses: [config.to] },
        Message: {
          Subject: { Data: config.subject },
          Body: {
            Text: { Data: config.text || "" },
            Html: { Data: config.html || "" },
          },
        },
      };
      const result = await ses.sendEmail(params).promise();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  });

  server.registerTool({
    name: "email_sendgrid",
    description: "Send email using SendGrid",
    inputSchema: z.object({
      apiKey: z.string(),
      from: z.string(),
      to: z.string(),
      subject: z.string(),
      text: z.string().optional(),
      html: z.string().optional(),
    }),
    async handler(config) {
      sgMail.setApiKey(config.apiKey);
      const msg = {
        to: config.to,
        from: config.from,
        subject: config.subject,
        text: config.text,
        html: config.html,
      };
      const result = await sgMail.send(msg);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  });

server.registerTool({
  name: "httpRequestTester",
  description: "Send HTTP requests to any endpoint for testing APIs.",
  inputSchema: z.object({
    method: z.string().describe("HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)"),
    url: z.string().url().describe("The full request URL."),
    headers: z.record(z.string()).optional().describe("Optional HTTP headers."),
    data: z.any().optional().describe("Request body (for POST/PUT/PATCH)."),
  }),
  async handler({ method, url, headers, data }) {
    try {
      const response = await axios({
        method,
        url,
        headers,
        data,
        validateStatus: () => true, // Don’t throw on non-200s
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Request failed: ${error.message}`,
          },
        ],
      };
    }
  },
});


  server.registerTool({
    name: "smtp_check",
    description: "Check SMTP connectivity and credentials",
    inputSchema: z.object({
      host: z.string(),
      port: z.number(),
      secure: z.boolean(),
      authUser: z.string(),
      authPass: z.string(),
    }),
    async handler(config) {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.authUser, pass: config.authPass },
      });
      try {
        await transporter.verify();
        return {
          content: [
            {
              type: "text",
              text: "SMTP server is reachable and credentials are valid.",
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `SMTP Error: ${error.message}` }],
        };
      }
    },
  });
}



async function main() {
  const server = new McpServer({
    name: "cyber-mcp",
    version: "1.2.0",
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Cyber MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
