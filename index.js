import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { promises as fs } from "fs";
import fetch from "node-fetch";
import pingLib from "ping";
import { z } from "zod";
import * as os from "os";
import * as path from "path";
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as url from 'url';

const execAsync = promisify(exec);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const server = new McpServer({
  name: "dev-mcp-server",
  version: "1.0.0"
});


server.registerTool("flutterCreate", {
  description: "Create a new Flutter project",
  inputSchema: {
    projectName: z.string().describe("Project name"),
    template: z.enum(["app", "package", "plugin"]).default("app").describe("Project template")
  },
}, async ({ projectName, template }) => {
  try {
    const { stdout, stderr } = await execAsync(`flutter create --template=${template} ${projectName}`);
    return {
      content: [{
        type: "text",
        text: `Flutter project created successfully!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

server.registerTool("flutterRun", {
  description: "Run Flutter app on specific device",
  inputSchema: {
    target: z.string().default("lib/main.dart").describe("Main dart file"),
    deviceId: z.string().optional().describe("Device ID (use 'flutter devices' to get IDs)"),
    flavor: z.string().optional().describe("Build flavor"),
    release: z.boolean().default(false).describe("Run in release mode")
  },
}, async ({ target, deviceId, flavor, release }) => {
  try {
    let command = `flutter run`;
    if (deviceId) command += ` -d ${deviceId}`;
    if (flavor) command += ` --flavor=${flavor}`;
    if (release) command += ` --release`;
    command += ` ${target}`;

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [{
        type: "text",
        text: `Flutter app running!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

server.registerTool("flutterPub", {
  description: "Manage Flutter packages",
  inputSchema: {
    command: z.enum(["get", "add", "remove", "upgrade"]).describe("Pub command"),
    packageName: z.string().optional().describe("Package name (for add/remove)")
  },
}, async ({ command, packageName }) => {
  try {
    let cmd = `flutter pub ${command}`;
    if (packageName) cmd += ` ${packageName}`;

    const { stdout, stderr } = await execAsync(cmd);
    return {
      content: [{
        type: "text",
        text: `Package operation completed!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

server.registerTool("flutterBuild", {
  description: "Build Flutter app for specific platform",
  inputSchema: {
    platform: z.enum(["apk", "appbundle", "ios", "web", "macos", "windows", "linux"]).describe("Target platform"),
    release: z.boolean().default(true).describe("Build in release mode"),
    flavor: z.string().optional().describe("Build flavor")
  },
}, async ({ platform, release, flavor }) => {
  try {
    let command = `flutter build ${platform}`;
    if (release) command += ` --release`;
    if (flavor) command += ` --flavor=${flavor}`;

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [{
        type: "text",
        text: `Build completed!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

// LARAVEL DEVELOPMENT TOOLS
server.registerTool("laravelCreate", {
  description: "Create new Laravel project",
  inputSchema: {
    projectName: z.string().describe("Project name"),
    version: z.string().optional().describe("Laravel version (e.g., ^10.0)")
  },
}, async ({ projectName, version }) => {
  try {
    let command = `composer create-project laravel/laravel ${projectName}`;
    if (version) command += ` ${version}`;

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [{
        type: "text",
        text: `Laravel project created!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

server.registerTool("laravelArtisan", {
  description: "Run Laravel Artisan commands",
  inputSchema: {
    command: z.string().describe("Artisan command"),
    arguments: z.record(z.string()).optional().describe("Command arguments")
  },
}, async ({ command, arguments: args }) => {
  try {
    let fullCommand = `php artisan ${command}`;
    if (args) {
      for (const [key, value] of Object.entries(args)) {
        fullCommand += ` --${key}=${value}`;
      }
    }

    const { stdout, stderr } = await execAsync(fullCommand);
    return {
      content: [{
        type: "text",
        text: `Artisan command executed!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

server.registerTool("laravelMake", {
  description: "Generate Laravel classes using Artisan",
  inputSchema: {
    type: z.enum(["model", "controller", "migration", "seed", "factory", "middleware", "request"]).describe("Type of class to generate"),
    name: z.string().describe("Class name"),
    options: z.record(z.string()).optional().describe("Additional options")
  },
}, async ({ type, name, options }) => {
  try {
    let command = `php artisan make:${type} ${name}`;
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        if (value === 'true') {
          command += ` --${key}`;
        } else {
          command += ` --${key}=${value}`;
        }
      }
    }

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [{
        type: "text",
        text: `Laravel ${type} created!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

server.registerTool("laravelMigrate", {
  description: "Run Laravel database migrations",
  inputSchema: {
    action: z.enum(["migrate", "rollback", "fresh", "refresh"]).default("migrate").describe("Migration action"),
    step: z.number().optional().describe("Number of steps to rollback")
  },
}, async ({ action, step }) => {
  try {
    let command = `php artisan ${action}`;
    if (step && action === "rollback") command += ` --step=${step}`;

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [{
        type: "text",
        text: `Migrations ${action} completed!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

// NODE.JS DEVELOPMENT TOOLS
server.registerTool("npmInit", {
  description: "Initialize new Node.js project",
  inputSchema: {
    projectName: z.string().describe("Project name"),
    type: z.enum(["commonjs", "module"]).default("commonjs").describe("Project type")
  },
}, async ({ projectName, type }) => {
  try {
    const { stdout, stderr } = await execAsync(`npm init -y`, { cwd: projectName });
    
    // Update package.json for module type
    if (type === "module") {
      const packagePath = path.join(projectName, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      packageJson.type = "module";
      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
    }

    return {
      content: [{
        type: "text",
        text: `Node.js project initialized!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

server.registerTool("npmInstall", {
  description: "Install npm packages",
  inputSchema: {
    packages: z.string().describe("Package names (space-separated)"),
    dev: z.boolean().default(false).describe("Install as dev dependency"),
    global: z.boolean().default(false).describe("Install globally")
  },
}, async ({ packages, dev, global }) => {
  try {
    let command = global ? 'npm install -g' : 'npm install';
    if (dev) command += ' --save-dev';
    command += ` ${packages}`;

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [{
        type: "text",
        text: `Packages installed!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

server.registerTool("nodeRun", {
  description: "Run Node.js script or start development server",
  inputSchema: {
    script: z.string().describe("Script to run or package.json script name"),
    watch: z.boolean().default(false).describe("Run in watch mode"),
    args: z.string().optional().describe("Additional arguments")
  },
}, async ({ script, watch, args }) => {
  try {
    let command = watch ? 'nodemon' : 'node';
    if (watch && !script.includes('.')) {
      command += ` --exec "npm run ${script}"`;
    } else if (!watch && !script.includes('.')) {
      command = `npm run ${script}`;
    } else {
      command += ` ${script}`;
    }
    
    if (args) command += ` ${args}`;

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [{
        type: "text",
        text: `Node script executed!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

// DATABASE TOOLS
server.registerTool("dbQuery", {
  description: "Execute database query (MySQL/PostgreSQL)",
  inputSchema: {
    query: z.string().describe("SQL query to execute"),
    database: z.string().describe("Database name"),
    host: z.string().default("localhost").describe("Database host"),
    user: z.string().default("root").describe("Database user"),
    password: z.string().optional().describe("Database password"),
    port: z.number().optional().describe("Database port")
  },
}, async ({ query, database, host, user, password, port }) => {
  try {
    // This is a simplified example - you might want to use proper database clients
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port: port || 3306
    });

    const [results] = await connection.execute(query);
    await connection.end();

    return {
      content: [{
        type: "text",
        text: `Query executed successfully!\nResults: ${JSON.stringify(results, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Database error: ${error.message}`
      }]
    };
  }
});

// API TESTING TOOLS
server.registerTool("testApiEndpoint", {
  description: "Test REST API endpoints",
  inputSchema: {
    url: z.string().describe("API endpoint URL"),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET").describe("HTTP method"),
    headers: z.record(z.string()).optional().describe("Request headers"),
    body: z.string().optional().describe("Request body (JSON)"),
    expectedStatus: z.number().optional().describe("Expected HTTP status code")
  },
}, async ({ url, method, headers, body, expectedStatus }) => {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body
    });

    const responseBody = await response.text();
    const success = expectedStatus ? response.status === expectedStatus : response.ok;

    return {
      content: [{
        type: "text",
        text: `API Test ${success ? 'PASSED' : 'FAILED'}
Status: ${response.status} ${response.statusText}
Expected: ${expectedStatus || '2xx'}
Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}
Response: ${responseBody}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `API Test ERROR: ${error.message}`
      }]
    };
  }
});

// CODE QUALITY TOOLS
server.registerTool("runLint", {
  description: "Run code linter",
  inputSchema: {
    language: z.enum(["dart", "javascript", "php", "typescript"]).describe("Programming language"),
    path: z.string().default(".").describe("Path to lint")
  },
}, async ({ language, path: lintPath }) => {
  try {
    let command;
    switch (language) {
      case "dart":
        command = `dart format ${lintPath} && dart analyze ${lintPath}`;
        break;
      case "javascript":
      case "typescript":
        command = `npx eslint ${lintPath}`;
        break;
      case "php":
        command = `./vendor/bin/phpstan analyse ${lintPath}`;
        break;
    }

    const { stdout, stderr } = await execAsync(command);
    return {
      content: [{
        type: "text",
        text: `Linting completed for ${language}!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Linting error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

// GIT TOOLS
server.registerTool("gitCommand", {
  description: "Execute Git commands",
  inputSchema: {
    command: z.string().describe("Git command (e.g., 'status', 'add .', 'commit -m \"message\"')")
  },
}, async ({ command }) => {
  try {
    const { stdout, stderr } = await execAsync(`git ${command}`);
    return {
      content: [{
        type: "text",
        text: `Git command executed!\n${stdout}\n${stderr}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Git error: ${error.message}\n${error.stderr || ''}`
      }]
    };
  }
});

// ENVIRONMENT CONFIG TOOLS
server.registerTool("manageEnv", {
  description: "Manage environment configuration files",
  inputSchema: {
    action: z.enum(["create", "read", "update", "delete"]).describe("Action to perform"),
    key: z.string().optional().describe("Environment variable key"),
    value: z.string().optional().describe("Environment variable value"),
    file: z.string().default(".env").describe("Environment file path")
  },
}, async ({ action, key, value, file }) => {
  try {
    let content = "";
    if (await fs.access(file).then(() => true).catch(() => false)) {
      content = await fs.readFile(file, 'utf8');
    }

    let lines = content.split('\n').filter(line => line.trim());
    
    switch (action) {
      case "create":
      case "update":
        if (!key || !value) {
          throw new Error("Key and value are required for create/update");
        }
        const existingIndex = lines.findIndex(line => line.startsWith(`${key}=`));
        if (existingIndex >= 0) {
          lines[existingIndex] = `${key}=${value}`;
        } else {
          lines.push(`${key}=${value}`);
        }
        break;
      
      case "delete":
        if (!key) throw new Error("Key is required for delete");
        lines = lines.filter(line => !line.startsWith(`${key}=`));
        break;
      
      case "read":
        if (key) {
          const line = lines.find(l => l.startsWith(`${key}=`));
          return {
            content: [{
              type: "text",
              text: line ? line : `Variable ${key} not found`
            }]
          };
        }
        break;
    }

    if (action !== "read") {
      await fs.writeFile(file, lines.join('\n') + '\n');
    }

    return {
      content: [{
        type: "text",
        text: action === "read" ? content : `Environment file ${file} updated successfully!`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Environment error: ${error.message}`
      }]
    };
  }
});

// start the MCP server over stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server is running with Flutter, Laravel, and Node.js tools...");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});