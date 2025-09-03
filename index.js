import { exec } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import nodemailer from "nodemailer";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import sgMail from "@sendgrid/mail";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const execAsync = util.promisify(exec);

// Security: Input sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/[&|;`$<>(){}!"'\\]/g, '');
};

// Database connection pooling
let mysqlPool = null;
let mysqlConfig = null;

function registerTools(server) {
  //
  // ─── FLUTTER ──────────────────────────────────────────
  //
  server.tool(
    "flutter_create",
    {
      name: "flutter_create",
      description: "Create a new Flutter project",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        required: ["name"]
      }
    },
    async ({ name }) => {
      try {
        const sanitizedName = sanitizeInput(name);
        const { stdout, stderr } = await execAsync(`flutter create ${sanitizedName}`);
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "flutter_run",
    {
      name: "flutter_run",
      description: "Run a Flutter project on a device/emulator",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          target: { type: "string" }
        },
        required: ["projectPath"]
      }
    },
    async ({ projectPath, target }) => {
      try {
        let cmd = "flutter run";
        if (target) cmd += ` --target=${sanitizeInput(target)}`;
        const { stdout, stderr } = await execAsync(cmd, { cwd: projectPath });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "flutter_pub",
    {
      name: "flutter_pub",
      description: "Run flutter pub commands (get, add, outdated, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          command: { type: "string" }
        },
        required: ["projectPath", "command"]
      }
    },
    async ({ projectPath, command }) => {
      try {
        const sanitizedCommand = sanitizeInput(command);
        const { stdout, stderr } = await execAsync(`flutter pub ${sanitizedCommand}`, {
          cwd: projectPath,
        });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "flutter_build",
    {
      name: "flutter_build",
      description: "Build Flutter project (apk, ios, web, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          target: { type: "string" }
        },
        required: ["projectPath", "target"]
      }
    },
    async ({ projectPath, target }) => {
      try {
        const sanitizedTarget = sanitizeInput(target);
        const { stdout, stderr } = await execAsync(`flutter build ${sanitizedTarget}`, {
          cwd: projectPath,
        });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── LARAVEL ──────────────────────────────────────────
  //
  server.tool(
    "laravel_new",
    {
      name: "laravel_new",
      description: "Create a new Laravel project",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        required: ["name"]
      }
    },
    async ({ name }) => {
      try {
        const sanitizedName = sanitizeInput(name);
        const { stdout, stderr } = await execAsync(
          `composer create-project laravel/laravel ${sanitizedName}`
        );
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "laravel_artisan",
    {
      name: "laravel_artisan",
      description: "Run any artisan command",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          command: { type: "string" }
        },
        required: ["projectPath", "command"]
      }
    },
    async ({ projectPath, command }) => {
      try {
        const sanitizedCommand = sanitizeInput(command);
        const { stdout, stderr } = await execAsync(`php artisan ${sanitizedCommand}`, {
          cwd: projectPath,
        });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "laravel_make",
    {
      name: "laravel_make",
      description: "Generate Laravel resources (controller, model, migration, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          type: { type: "string" },
          name: { type: "string" },
          options: { 
            type: "object",
            additionalProperties: { type: "string" }
          }
        },
        required: ["projectPath", "type", "name"]
      }
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
        const { stdout, stderr } = await execAsync(command, { cwd: projectPath });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "laravel_version",
    {
      name: "laravel_version",
      description: "Manage Laravel project version stored in .env",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          action: { 
            type: "string",
            enum: ["get", "set", "bump"]
          },
          version: { type: "string" },
          part: { 
            type: "string",
            enum: ["major", "minor", "patch"]
          }
        },
        required: ["projectPath", "action"]
      }
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
            return { content: [{ type: "text", text: `Version set to: ${newVersion}` }] };
          }
          case "bump": {
            const currentVersion = await readVersion();
            if (!currentVersion) {
              const newVersion = "0.0.1";
              await writeVersion(newVersion);
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
            return { content: [{ type: "text", text: `Version bumped to: ${newVersion}` }] };
          }
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── NODE ─────────────────────────────────────────────
  //
  server.tool(
    "node_init",
    {
      name: "node_init",
      description: "Initialize a new Node.js project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: { type: "string" }
        },
        required: ["projectName"]
      }
    },
    async ({ projectName }) => {
      try {
        const sanitizedName = sanitizeInput(projectName);
        await fs.mkdir(sanitizedName, { recursive: true });
        const { stdout, stderr } = await execAsync("npm init -y", { cwd: sanitizedName });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "node_install",
    {
      name: "node_install",
      description: "Install npm packages into a Node.js project",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          packages: { 
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["projectPath", "packages"]
      }
    },
    async ({ projectPath, packages }) => {
      try {
        const sanitizedPackages = packages.map(pkg => sanitizeInput(pkg)).join(" ");
        const { stdout, stderr } = await execAsync(`npm install ${sanitizedPackages}`, { cwd: projectPath });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "node_run",
    {
      name: "node_run",
      description: "Run npm script or JS file in a Node.js project",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          script: { type: "string" }
        },
        required: ["projectPath", "script"]
      }
    },
    async ({ projectPath, script }) => {
      try {
        const sanitizedScript = sanitizeInput(script);
        const cmd = script.endsWith(".js") ? `node ${sanitizedScript}` : `npm run ${sanitizedScript}`;
        const { stdout, stderr } = await execAsync(cmd, { cwd: projectPath });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── DATABASE ──────────────────────────────────────────
  //
  server.tool(
    "db_query_mysql",
    {
      name: "db_query_mysql",
      description: "Run a SQL query on a MySQL database",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string" },
          user: { type: "string" },
          password: { type: "string" },
          database: { type: "string" },
          query: { type: "string" }
        },
        required: ["host", "user", "password", "database", "query"]
      }
    },
    async ({ host, user, password, database, query }) => {
      try {
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
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── ENV FILE ──────────────────────────────────────────
  //
  server.tool(
    "env_manage",
    {
      name: "env_manage",
      description: "Read, create, update, or delete .env variables",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          action: { 
            type: "string",
            enum: ["read", "create", "update", "delete"]
          },
          key: { type: "string" },
          value: { type: "string" }
        },
        required: ["projectPath", "action"]
      }
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
            return { content:[{type:"text",text:`${key}=${value}`}] };
          }
          case "delete": {
            if (!key) {
              throw new Error("Key is required for delete operation");
            }
            lines = lines.filter(line=>!line.startsWith(`${key}=`));
            await fs.writeFile(envFilePath, lines.join("\n")+"\n");
            return { content:[{type:"text",text:`Deleted ${key}`}] };
          }
        }
      } catch(error) {
        return { content:[{type:"text",text:`Error: ${error.message}`}] };
      }
    }
  );

  //
  // ─── EMAIL ──────────────────────────────────────────
  //
  server.tool(
    "email_smtp",
    {
      name: "email_smtp",
      description: "Send email via SMTP",
      inputSchema: {
        type: "object",
        properties: {
          smtpHost: { type: "string" },
          smtpPort: { type: "number" },
          secure: { type: "boolean" },
          authUser: { type: "string" },
          authPass: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          subject: { type: "string" },
          text: { type: "string" },
          html: { type: "string" }
        },
        required: ["smtpHost", "smtpPort", "secure", "authUser", "authPass", "from", "to", "subject"]
      }
    },
    async (config) => {
      try {
        const transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.secure,
          auth: { user: config.authUser, pass: config.authPass },
        });
        const info = await transporter.sendMail(config);
        return { content:[{type:"text",text:JSON.stringify(info,null,2)}] };
      } catch (error) {
        return { content:[{type:"text",text:`Error: ${error.message}`}] };
      }
    }
  );

  server.tool(
    "email_ses",
    {
      name: "email_ses",
      description: "Send email using AWS SES SDK",
      inputSchema: {
        type: "object",
        properties: {
          accessKeyId: { type: "string" },
          secretAccessKey: { type: "string" },
          region: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          subject: { type: "string" },
          text: { type: "string" },
          html: { type: "string" }
        },
        required: ["accessKeyId", "secretAccessKey", "region", "from", "to", "subject"]
      }
    },
    async (config) => {
      try {
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
        return { content:[{type:"text",text:`Error: ${error.message}`}] };
      }
    }
  );

  server.tool(
    "email_sendgrid",
    {
      name: "email_sendgrid",
      description: "Send email using SendGrid",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          subject: { type: "string" },
          text: { type: "string" },
          html: { type: "string" }
        },
        required: ["apiKey", "from", "to", "subject"]
      }
    },
    async (config) => {
      try {
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
        return { content:[{type:"text",text:`Error: ${error.message}`}] };
      }
    }
  );

  server.tool(
    "http_request",
    {
      name: "http_request",
      description: "Send HTTP requests to any endpoint for testing APIs",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string" },
          url: { type: "string" },
          headers: { 
            type: "object",
            additionalProperties: { type: "string" }
          },
          data: { type: "object" }
        },
        required: ["method", "url"]
      }
    },
    async ({ method, url, headers, data }) => {
      try {
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
        return { content: [{ type:"text", text:`Request failed: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "smtp_check",
    {
      name: "smtp_check",
      description: "Check SMTP connectivity and credentials",
      inputSchema: {
        type: "object",
        properties: {
          host: { type: "string" },
          port: { type: "number" },
          secure: { type: "boolean" },
          authUser: { type: "string" },
          authPass: { type: "string" }
        },
        required: ["host", "port", "secure", "authUser", "authPass"]
      }
    },
    async (config) => {
      try {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.authUser, pass: config.authPass },
        });
        await transporter.verify();
        return { content: [{ type:"text", text: "SMTP server is reachable and credentials are valid." }] };
      } catch(error) {
        return { content: [{ type:"text", text:`SMTP Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── FILE OPERATIONS ──────────────────────────────────
  //
  server.tool(
    "file_operations",
    {
      name: "file_operations",
      description: "Read, write, copy, move, or delete files",
      inputSchema: {
        type: "object",
        properties: {
          operation: { 
            type: "string",
            enum: ["read", "write", "copy", "move", "delete"]
          },
          path: { type: "string" },
          content: { type: "string" },
          destination: { type: "string" }
        },
        required: ["operation", "path"]
      }
    },
    async ({ operation, path, content, destination }) => {
      try {
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
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── GIT OPERATIONS ───────────────────────────────────
  //
  server.tool(
    "git_operation",
    {
      name: "git_operation",
      description: "Execute git commands",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          command: { type: "string" }
        },
        required: ["projectPath", "command"]
      }
    },
    async ({ projectPath, command }) => {
      try {
        const sanitizedCommand = sanitizeInput(command);
        const { stdout, stderr } = await execAsync(`git ${sanitizedCommand}`, {
          cwd: projectPath,
        });
        return { content: [{ type: "text", text: stdout || stderr }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  //
  // ─── DIRECTORY OPERATIONS ─────────────────────────────
  //
  server.tool(
    "directory_operations",
    {
      name: "directory_operations",
      description: "Create, list, or delete directories",
      inputSchema: {
        type: "object",
        properties: {
          operation: { 
            type: "string",
            enum: ["create", "list", "delete"]
          },
          path: { type: "string" }
        },
        required: ["operation", "path"]
      }
    },
    async ({ operation, path }) => {
      try {
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
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );
}

async function main() {
  const server = new McpServer({
    name: "cyber-mcp",
    version: "1.3.0"
  });
  
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => {
  process.exit(1);
}); 