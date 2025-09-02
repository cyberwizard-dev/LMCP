import { exec } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
import AWS from "aws-sdk";
import sgMail from "@sendgrid/mail";
import { z } from "zod";

const execAsync = util.promisify(exec);

export function registerTools(server) {
  //
  // ─── FLUTTER TOOLS ──────────────────────────────────────────
  //
  server.registerTool({
    name: "flutter_create_project",
    description: "Create a new Flutter project",
    inputSchema: z.object({ name: z.string() }),
    async handler({ name }) {
      const { stdout, stderr } = await execAsync(`flutter create ${name}`);
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "flutter_run_app",
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
    name: "flutter_pub_command",
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
    name: "flutter_build_project",
    description: "Build Flutter project for given platform (apk, ios, web, etc.)",
    inputSchema: z.object({
      projectPath: z.string(),
      target: z.string(),
    }),
    async handler({ projectPath, target }) {
      const { stdout, stderr } = await execAsync(
        `flutter build ${target}`,
        { cwd: projectPath }
      );
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  //
  // ─── LARAVEL TOOLS ──────────────────────────────────────────
  //
  server.registerTool({
    name: "laravel_new_project",
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
    name: "laravel_artisan_command",
    description: "Run any artisan command",
    inputSchema: z.object({
      projectPath: z.string(),
      command: z.string(),
    }),
    async handler({ projectPath, command }) {
      const { stdout, stderr } = await execAsync(
        `php artisan ${command}`,
        { cwd: projectPath }
      );
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  server.registerTool({
    name: "laravel_make_generator",
    description: "Generate Laravel resources (controller, model, migration, etc.)",
    inputSchema: z.object({
      projectPath: z.string(),
      type: z.string(),
      name: z.string(),
    }),
    async handler({ projectPath, type, name }) {
      const { stdout, stderr } = await execAsync(
        `php artisan make:${type} ${name}`,
        { cwd: projectPath }
      );
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  //
  // ─── NODE TOOLS ─────────────────────────────────────────────
  //
  server.registerTool({
    name: "node_init_project",
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
    name: "node_install_packages",
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
    name: "node_run_script",
    description: "Run npm script or JS file in a Node.js project",
    inputSchema: z.object({
      projectPath: z.string(),
      script: z.string(),
    }),
    async handler({ projectPath, script }) {
      const cmd = script.endsWith(".js") ? `node ${script}` : `npm run ${script}`;
      const { stdout, stderr } = await execAsync(cmd, { cwd: projectPath });
      return { content: [{ type: "text", text: stdout || stderr }] };
    },
  });

  //
  // ─── DATABASE TOOL ──────────────────────────────────────────
  //
  server.registerTool({
    name: "database_query_mysql",
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
      const conn = await mysql.createConnection({ host, user, password, database });
      const [rows] = await conn.execute(query);
      await conn.end();
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  });

  //
  // ─── ENV FILE TOOL ──────────────────────────────────────────
  //
  server.registerTool({
    name: "env_file_manager",
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
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
  // ─── EMAIL TOOLS (SMTP, SES, SENDGRID, GMAIL) ───────────────
  //
  server.registerTool({
    name: "email_send_smtp",
    description: "Send email via SMTP (generic servers, SES, Gmail, etc.)",
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
    name: "email_send_ses_sdk",
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
    name: "email_send_sendgrid",
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
    name: "smtp_diagnostics",
    description: "Diagnose SMTP connectivity and credentials",
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
        return { content: [{ type: "text", text: "SMTP server is reachable and credentials are valid." }] };
      } catch (error) {
        return { content: [{ type: "text", text: `SMTP Error: ${error.message}` }] };
      }
    },
  });
}
