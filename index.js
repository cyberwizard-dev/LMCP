import { exec } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import sgMail from "@sendgrid/mail";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const execAsync = util.promisify(exec);

// Security: Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/[&|;`$<>(){}!"'\\]/g, '');
};

// Logging utility
const log = (level, message) => {
  const levels = ['error', 'warn', 'info', 'debug'];
  if (levels.includes(level)) {
    console.log(`[${level.toUpperCase()}] ${new Date().toISOString()}: ${message}`);
  }
};

// Database connection pooling
let mysqlPool = null;
let mysqlConfig = null;

function registerTools(server) {
  //
  // ─── FLUTTER ──────────────────────────────────────────
  //
  server.registerTool(
    "flutter_create",
    {
      title: "Flutter Create",
      description: "Create a new Flutter project",
      inputSchema: z.string(),
    },
    async ({ name }) => {
      try {
        const sanitizedName = sanitizeInput(name);
        log('info', `Creating Flutter project: ${sanitizedName}`);
        const { stdout, stderr } = await execAsync(`flutter create ${sanitizedName}`);
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Flutter create failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "flutter_run",
    {
      title: "Flutter Run",
      description: "Run a Flutter project on a device/emulator",
      inputSchema: z.object({
        projectPath: z.string(),
        target: z.string().optional(),
      }),
    },
    async ({ projectPath, target }) => {
      try {
        let cmd = "flutter run";
        if (target) cmd += ` --target=${sanitizeInput(target)}`;
        log('info', `Running Flutter project at: ${projectPath}`);
        const { stdout, stderr } = await execAsync(cmd, { cwd: projectPath });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Flutter run failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "flutter_pub",
    {
      title: "Flutter Pub",
      description: "Run flutter pub commands (get, add, outdated, etc.)",
      inputSchema: z.object({
        projectPath: z.string(),
        command: z.string(),
      }),
    },
    async ({ projectPath, command }) => {
      try {
        const sanitizedCommand = sanitizeInput(command);
        log('info', `Running flutter pub ${sanitizedCommand} at: ${projectPath}`);
        const { stdout, stderr } = await execAsync(`flutter pub ${sanitizedCommand}`, {
          cwd: projectPath,
        });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Flutter pub failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "flutter_build",
    {
      title: "Flutter Build",
      description: "Build Flutter project (apk, ios, web, etc.)",
      inputSchema: z.object({
        projectPath: z.string(),
        target: z.string(),
      }),
    },
    async ({ projectPath, target }) => {
      try {
        const sanitizedTarget = sanitizeInput(target);
        log('info', `Building Flutter project for target: ${sanitizedTarget}`);
        const { stdout, stderr } = await execAsync(`flutter build ${sanitizedTarget}`, {
          cwd: projectPath,
        });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Flutter build failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── LARAVEL ──────────────────────────────────────────
  //
  server.registerTool(
    "laravel_new",
    {
      title: "Laravel New Project",
      description: "Create a new Laravel project",
      inputSchema: z.object({ name: z.string() }),
    },
    async ({ name }) => {
      try {
        const sanitizedName = sanitizeInput(name);
        log('info', `Creating Laravel project: ${sanitizedName}`);
        const { stdout, stderr } = await execAsync(
          `composer create-project laravel/laravel ${sanitizedName}`
        );
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Laravel create failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "laravel_artisan",
    {
      title: "Laravel Artisan",
      description: "Run any artisan command",
      inputSchema: z.object({
        projectPath: z.string(),
        command: z.string(),
      }),
    },
    async ({ projectPath, command }) => {
      try {
        const sanitizedCommand = sanitizeInput(command);
        log('info', `Running artisan command: ${sanitizedCommand}`);
        const { stdout, stderr } = await execAsync(`php artisan ${sanitizedCommand}`, {
          cwd: projectPath,
        });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Artisan command failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "laravel_make",
    {
      title: "Laravel Make",
      description: "Generate Laravel resources (controller, model, migration, etc.)",
      inputSchema: z.object({
        projectPath: z.string(),
        type: z.string(),
        name: z.string(),
        options: z.record(z.string()).optional(),
      }),
    },
    async ({ projectPath, type, name, options }) => {
      try {
        let command = `php artisan make:${sanitizeInput(type)} ${sanitizeInput(name)}`;
        if (options) {
          for (const [key, value] of Object.entries(options)) {
            const prefix = key.length === 1 ? "-" : "--";
            if (value === "true" || value === "") {
              command += ` ${prefix}${sanitizeInput(key)}`;
            } else {
              command += ` ${prefix}${sanitizeInput(key)}=${sanitizeInput(value)}`;
            }
          }
        }
        log('info', `Running Laravel make command: ${command}`);
        const { stdout, stderr } = await execAsync(command, { cwd: projectPath });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Laravel make failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "laravel_version",
    {
      title: "Laravel Version Manager",
      description: "Manage Laravel project version stored in .env",
      inputSchema: z.object({
        projectPath: z.string(),
        action: z.enum(["get", "set", "bump"]),
        version: z.string().optional(),
        part: z.enum(["major", "minor", "patch"]).default("patch").optional(),
      }),
    },
    async ({ projectPath, action, version, part }) => {
      try {
        const envFilePath = path.join(projectPath, ".env");
        const versionKey = "APP_VERSION";

        const readVersion = async () => {
          try {
            const envContent = await fs.readFile(envFilePath, "utf8");
            const match = envContent.match(new RegExp(`^${versionKey}=(.*)`, "m"));
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
            if (!version) throw new Error("A 'version' is required for 'set'.");
            const newVersion = await writeVersion(version);
            log('info', `Set Laravel version to: ${newVersion}`);
            return { content: [{ type: "text", text: `Version set to: ${newVersion}` }] };
          }
          case "bump": {
            const currentVersion = await readVersion();
            if (!currentVersion) {
              const newVersion = "0.0.1";
              await writeVersion(newVersion);
              log('info', `Initialized Laravel version to: ${newVersion}`);
              return { content: [{ type: "text", text: `Initialized to: ${newVersion}` }] };
            }

            let [major, minor, patch] = currentVersion.split(".").map(Number);
            if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
              return { content: [{ type: "text", text: `Invalid version format '${currentVersion}'` }] };
            }

            switch (part) {
              case "major": major++; minor = 0; patch = 0; break;
              case "minor": minor++; patch = 0; break;
              case "patch": patch++; break;
            }

            const newVersion = `${major}.${minor}.${patch}`;
            await writeVersion(newVersion);
            log('info', `Bumped Laravel version to: ${newVersion}`);
            return { content: [{ type: "text", text: `Version bumped to: ${newVersion}` }] };
          }
        }
      } catch (error) {
        log('error', `Laravel version management failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── NODE ─────────────────────────────────────────────
  //
  server.registerTool(
    "node_init",
    {
      title: "Node Init",
      description: "Initialize a new Node.js project",
      inputSchema: z.object({ projectName: z.string() }),
    },
    async ({ projectName }) => {
      try {
        const sanitizedName = sanitizeInput(projectName);
        log('info', `Initializing Node.js project: ${sanitizedName}`);
        await fs.mkdir(sanitizedName, { recursive: true });
        const { stdout, stderr } = await execAsync("npm init -y", { cwd: sanitizedName });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Node init failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "node_install",
    {
      title: "Node Install",
      description: "Install npm packages into a Node.js project",
      inputSchema: z.object({ projectPath: z.string(), packages: z.array(z.string()) }),
    },
    async ({ projectPath, packages }) => {
      try {
        const sanitizedPackages = packages.map(pkg => sanitizeInput(pkg)).join(" ");
        log('info', `Installing packages: ${sanitizedPackages}`);
        const { stdout, stderr } = await execAsync(`npm install ${sanitizedPackages}`, { cwd: projectPath });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Node install failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "node_run",
    {
      title: "Node Run",
      description: "Run npm script or JS file in a Node.js project",
      inputSchema: z.object({ projectPath: z.string(), script: z.string() }),
    },
    async ({ projectPath, script }) => {
      try {
        const sanitizedScript = sanitizeInput(script);
        const cmd = script.endsWith(".js") ? `node ${sanitizedScript}` : `npm run ${sanitizedScript}`;
        log('info', `Running Node.js script: ${cmd}`);
        const { stdout, stderr } = await execAsync(cmd, { cwd: projectPath });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Node run failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── DATABASE ──────────────────────────────────────────
  //
  server.registerTool(
    "db_query_mysql",
    {
      title: "MySQL Query",
      description: "Run a SQL query on a MySQL database",
      inputSchema: z.object({
        host: z.string(),
        user: z.string(),
        password: z.string(),
        database: z.string(),
        query: z.string(),
      }),
    },
    async ({ host, user, password, database, query }) => {
      try {
        log('info', `Executing MySQL query on database: ${database}`);
        
        // Use connection pooling for better performance
        if (!mysqlPool || mysqlConfig?.host !== host || mysqlConfig?.database !== database) {
          const mysql = await import("mysql2/promise");
          mysqlPool = mysql.createPool({
            connectionLimit: 10,
            host,
            user,
            password,
            database,
            connectTimeout: 60000,
            acquireTimeout: 60000,
            timeout: 60000,
          });
          mysqlConfig = { host, database };
        }

        const connection = await mysqlPool.getConnection();
        try {
          const [rows] = await connection.execute(query);
          connection.release();
          return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
        } catch (error) {
          connection.release();
          throw error;
        }
      } catch (error) {
        log('error', `MySQL query failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── ENV FILE ──────────────────────────────────────────
  //
  server.registerTool(
    "env_manage",
    {
      title: "ENV Manager",
      description: "Read, create, update, or delete .env variables",
      inputSchema: z.object({ 
        projectPath: z.string(), 
        action: z.enum(["read","create","update","delete"]), 
        key: z.string().optional(), 
        value: z.string().optional() 
      }),
    },
    async ({ projectPath, action, key, value }) => {
      try {
        const envFilePath = path.join(projectPath, ".env");
        let envContent = "";
        try { 
          envContent = await fs.readFile(envFilePath, "utf8"); 
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        let lines = envContent.split("\n").filter(Boolean);

        switch (action) {
          case "read": {
            const result = lines.map(line => line.split("=")).reduce((acc,[k,v])=>((acc[k]=v),acc),{});
            return { content:[{type:"text",text:JSON.stringify(result,null,2)}] };
          }
          case "create":
          case "update": {
            if (!key || !value) {
              throw new Error("Key and value are required for create/update operations");
            }
            let found=false;
            lines=lines.map(line=>line.startsWith(`${key}=`)?(found=true,`${key}=${value}`):line);
            if(!found) lines.push(`${key}=${value}`);
            await fs.writeFile(envFilePath, lines.join("\n")+"\n");
            log('info', `Updated env variable: ${key}=${value}`);
            return { content:[{type:"text",text:`${key}=${value}`}] };
          }
          case "delete": {
            if (!key) {
              throw new Error("Key is required for delete operation");
            }
            lines = lines.filter(line=>!line.startsWith(`${key}=`));
            await fs.writeFile(envFilePath, lines.join("\n")+"\n");
            log('info', `Deleted env variable: ${key}`);
            return { content:[{type:"text",text:`Deleted ${key}`}] };
          }
        }
      } catch(error) {
        log('error', `Env management failed: ${error.message}`);
        return { content:[{type:"text",text:`Error: ${error.message}`}] };
      }
    }
  );

  //
  // ─── EMAIL ──────────────────────────────────────────
  //
  server.registerTool(
    "email_smtp",
    {
      title: "Email SMTP",
      description: "Send email via SMTP",
      inputSchema: z.object({ 
        smtpHost:z.string(), 
        smtpPort:z.number(), 
        secure:z.boolean(), 
        authUser:z.string(), 
        authPass:z.string(), 
        from:z.string(), 
        to:z.string(), 
        subject:z.string(), 
        text:z.string().optional(), 
        html:z.string().optional() 
      }),
    },
    async (config) => {
      try {
        log('info', `Sending email via SMTP to: ${config.to}`);
        const transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.secure,
          auth: { user: config.authUser, pass: config.authPass },
        });
        const info = await transporter.sendMail(config);
        return { content:[{type:"text",text:JSON.stringify(info,null,2)}] };
      } catch (error) {
        log('error', `SMTP email failed: ${error.message}`);
        return { content:[{type:"text",text:`Error: ${error.message}`}] };
      }
    }
  );

  server.registerTool(
    "email_ses",
    {
      title: "Email SES",
      description: "Send email using AWS SES SDK",
      inputSchema: z.object({ 
        accessKeyId:z.string(), 
        secretAccessKey:z.string(), 
        region:z.string(), 
        from:z.string(), 
        to:z.string(), 
        subject:z.string(), 
        text:z.string().optional(), 
        html:z.string().optional() 
      }),
    },
    async (config) => {
      try {
        log('info', `Sending email via SES to: ${config.to}`);
        const sesClient = new SESClient({
          credentials: { 
            accessKeyId: config.accessKeyId, 
            secretAccessKey: config.secretAccessKey 
          },
          region: config.region,
        });
        const params = {
          Source: config.from,
          Destination: { ToAddresses: [config.to] },
          Message: { 
            Subject: { Data: config.subject }, 
            Body: { 
              Text:{Data:config.text||""}, 
              Html:{Data:config.html||""} 
            } 
          },
        };
        const command = new SendEmailCommand(params);
        const result = await sesClient.send(command);
        return { content:[{type:"text",text:JSON.stringify(result,null,2)}] };
      } catch (error) {
        log('error', `SES email failed: ${error.message}`);
        return { content:[{type:"text",text:`Error: ${error.message}`}] };
      }
    }
  );

  server.registerTool(
    "email_sendgrid",
    {
      title: "Email SendGrid",
      description: "Send email using SendGrid",
      inputSchema: z.object({ 
        apiKey:z.string(), 
        from:z.string(), 
        to:z.string(), 
        subject:z.string(), 
        text:z.string().optional(), 
        html:z.string().optional() 
      }),
    },
    async (config) => {
      try {
        log('info', `Sending email via SendGrid to: ${config.to}`);
        sgMail.setApiKey(config.apiKey);
        const msg = { 
          to: config.to, 
          from: config.from, 
          subject: config.subject, 
          text: config.text, 
          html: config.html 
        };
        const result = await sgMail.send(msg);
        return { content:[{type:"text",text:JSON.stringify(result,null,2)}] };
      } catch (error) {
        log('error', `SendGrid email failed: ${error.message}`);
        return { content:[{type:"text",text:`Error: ${error.message}`}] };
      }
    }
  );

  server.registerTool(
    "http_request",
    {
      title: "HTTP Request Tester",
      description: "Send HTTP requests to any endpoint for testing APIs",
      inputSchema: z.object({
        method: z.string(),
        url: z.string().url(),
        headers: z.record(z.string()).optional(),
        data: z.any().optional(),
      }),
    },
    async ({ method, url, headers, data }) => {
      try {
        log('info', `Making HTTP ${method} request to: ${url}`);
        const response = await axios({ 
          method, 
          url, 
          headers, 
          data, 
          validateStatus: () => true,
          timeout: 30000 
        });
        return { 
          content: [{ 
            type:"text", 
            text: JSON.stringify({ 
              status: response.status, 
              statusText: response.statusText, 
              headers: response.headers, 
              data: response.data 
            }, null, 2) 
          }] 
        };
      } catch(error) {
        log('error', `HTTP request failed: ${error.message}`);
        return { content: [{ type:"text", text:`Request failed: ${error.message}` }] };
      }
    }
  );

  server.registerTool(
    "smtp_check",
    {
      title: "SMTP Check",
      description: "Check SMTP connectivity and credentials",
      inputSchema: z.object({
        host: z.string(),
        port: z.number(),
        secure: z.boolean(),
        authUser: z.string(),
        authPass: z.string(),
      }),
    },
    async (config) => {
      try {
        log('info', `Checking SMTP connection to: ${config.host}`);
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.authUser, pass: config.authPass },
        });
        await transporter.verify();
        return { content: [{ type:"text", text: "SMTP server is reachable and credentials are valid." }] };
      } catch(error) {
        log('error', `SMTP check failed: ${error.message}`);
        return { content: [{ type:"text", text:`SMTP Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── FILE OPERATIONS ──────────────────────────────────
  //
  server.registerTool(
    "file_operations",
    {
      title: "File Operations",
      description: "Read, write, copy, move, or delete files",
      inputSchema: z.object({
        operation: z.enum(["read", "write", "copy", "move", "delete"]),
        path: z.string(),
        content: z.string().optional(),
        destination: z.string().optional(),
      }),
    },
    async ({ operation, path, content, destination }) => {
      try {
        log('info', `Performing file operation: ${operation} on ${path}`);
        switch (operation) {
          case "read":
            const data = await fs.readFile(path, "utf8");
            return { content: [{ type: "text", text: data }] };
          case "write":
            if (!content) throw new Error("Content is required for write operation");
            await fs.writeFile(path, content);
            return { content: [{ type: "text", text: "File written successfully" }] };
          case "copy":
            if (!destination) throw new Error("Destination is required for copy operation");
            await fs.copyFile(path, destination);
            return { content: [{ type: "text", text: "File copied successfully" }] };
          case "move":
            if (!destination) throw new Error("Destination is required for move operation");
            await fs.rename(path, destination);
            return { content: [{ type: "text", text: "File moved successfully" }] };
          case "delete":
            await fs.unlink(path);
            return { content: [{ type: "text", text: "File deleted successfully" }] };
        }
      } catch (error) {
        log('error', `File operation failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── GIT OPERATIONS ───────────────────────────────────
  //
  server.registerTool(
    "git_operation",
    {
      title: "Git Operations",
      description: "Execute git commands",
      inputSchema: z.object({
        projectPath: z.string(),
        command: z.string(),
      }),
    },
    async ({ projectPath, command }) => {
      try {
        const sanitizedCommand = sanitizeInput(command);
        log('info', `Running git command: ${sanitizedCommand}`);
        const { stdout, stderr } = await execAsync(`git ${sanitizedCommand}`, {
          cwd: projectPath,
        });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        log('error', `Git operation failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── DIRECTORY OPERATIONS ─────────────────────────────
  //
  server.registerTool(
    "directory_operations",
    {
      title: "Directory Operations",
      description: "Create, list, or delete directories",
      inputSchema: z.object({
        operation: z.enum(["create", "list", "delete"]),
        path: z.string(),
      }),
    },
    async ({ operation, path }) => {
      try {
        log('info', `Performing directory operation: ${operation} on ${path}`);
        switch (operation) {
          case "create":
            await fs.mkdir(path, { recursive: true });
            return { content: [{ type: "text", text: "Directory created successfully" }] };
          case "list":
            const items = await fs.readdir(path);
            return { content: [{ type: "text", text: items.join("\n") }] };
          case "delete":
            await fs.rm(path, { recursive: true, force: true });
            return { content: [{ type: "text", text: "Directory deleted successfully" }] };
        }
      } catch (error) {
        log('error', `Directory operation failed: ${error.message}`);
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );
}

async function main() {
  const server = new McpServer({ 
    name: "cyber-mcp", 
    version: "1.3.0",
    capabilities: {
      tools: {}
    }
  });
  
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  log('info', 'Cyber MCP server started successfully');
}

main().catch(error => {
  log('error', `Fatal error: ${error.message}`);
  process.exit(1);
});