import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { promises as fs } from "fs";
import fetch from "node-fetch";
import { z } from "zod";
import * as os from "os";
import * as path from "path";
import * as url from "url";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";
import nodemailer from "nodemailer";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const execAsync = promisify(exec);
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const server = new McpServer({
  name: "dev-mcp-server",
  version: "1.0.0"
});

// -------------------- FLUTTER TOOLS --------------------

server.registerTool("flutterCreate", {
  description: "Create a new Flutter project",
  inputSchema: {
    projectName: z.string().describe("Project name"),
    template: z.enum(["app", "package", "plugin"]).default("app")
  },
}, async ({ projectName, template }) => {
  try {
    const { stdout, stderr } = await execAsync(`flutter create --template=${template} ${projectName}`);
    return { content: [{ type: "text", text: `Flutter project created!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

server.registerTool("flutterRun", {
  description: "Run Flutter app",
  inputSchema: {
    target: z.string().default("lib/main.dart"),
    deviceId: z.string().optional(),
    flavor: z.string().optional(),
    release: z.boolean().default(false)
  },
}, async ({ target, deviceId, flavor, release }) => {
  try {
    let command = `flutter run`;
    if (deviceId) command += ` -d ${deviceId}`;
    if (flavor) command += ` --flavor=${flavor}`;
    if (release) command += ` --release`;
    command += ` ${target}`;

    const { stdout, stderr } = await execAsync(command);
    return { content: [{ type: "text", text: `Flutter app running!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

server.registerTool("flutterPub", {
  description: "Manage Flutter packages",
  inputSchema: {
    command: z.enum(["get", "add", "remove", "upgrade"]),
    packageName: z.string().optional()
  },
}, async ({ command, packageName }) => {
  try {
    let cmd = `flutter pub ${command}`;
    if (packageName) cmd += ` ${packageName}`;

    const { stdout, stderr } = await execAsync(cmd);
    return { content: [{ type: "text", text: `Pub command completed!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

server.registerTool("flutterBuild", {
  description: "Build Flutter app",
  inputSchema: {
    platform: z.enum(["apk", "appbundle", "ios", "web", "macos", "windows", "linux"]),
    release: z.boolean().default(true),
    flavor: z.string().optional()
  },
}, async ({ platform, release, flavor }) => {
  try {
    let command = `flutter build ${platform}`;
    if (release) command += ` --release`;
    if (flavor) command += ` --flavor=${flavor}`;

    const { stdout, stderr } = await execAsync(command);
    return { content: [{ type: "text", text: `Build completed!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

// -------------------- LARAVEL TOOLS --------------------

server.registerTool("laravelCreate", {
  description: "Create Laravel project",
  inputSchema: {
    projectName: z.string(),
    version: z.string().optional()
  },
}, async ({ projectName, version }) => {
  try {
    let command = `composer create-project laravel/laravel ${projectName}`;
    if (version) command += ` ${version}`;

    const { stdout, stderr } = await execAsync(command);
    return { content: [{ type: "text", text: `Laravel project created!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

server.registerTool("laravelArtisan", {
  description: "Run Laravel Artisan",
  inputSchema: {
    command: z.string(),
    arguments: z.record(z.string()).optional()
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
    return { content: [{ type: "text", text: `Artisan executed!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

server.registerTool("laravelMake", {
  description: "Make Laravel classes",
  inputSchema: {
    type: z.enum(["model", "controller", "migration", "seed", "factory", "middleware", "request"]),
    name: z.string(),
    options: z.record(z.string()).optional()
  },
}, async ({ type, name, options }) => {
  try {
    let command = `php artisan make:${type} ${name}`;
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        command += value === 'true' ? ` --${key}` : ` --${key}=${value}`;
      }
    }

    const { stdout, stderr } = await execAsync(command);
    return { content: [{ type: "text", text: `${type} created!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

server.registerTool("laravelMigrate", {
  description: "Run migrations",
  inputSchema: {
    action: z.enum(["migrate", "rollback", "fresh", "refresh"]).default("migrate"),
    step: z.number().optional()
  },
}, async ({ action, step }) => {
  try {
    let command = `php artisan ${action}`;
    if (step && action === "rollback") command += ` --step=${step}`;

    const { stdout, stderr } = await execAsync(command);
    return { content: [{ type: "text", text: `Migration ${action} done!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

// -------------------- NODE TOOLS --------------------

server.registerTool("npmInit", {
  description: "Initialize Node.js project",
  inputSchema: {
    projectName: z.string(),
    type: z.enum(["commonjs", "module"]).default("commonjs")
  },
}, async ({ projectName, type }) => {
  try {
    const { stdout, stderr } = await execAsync(`npm init -y`, { cwd: projectName });
    if (type === "module") {
      const packagePath = path.join(projectName, "package.json");
      const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
      packageJson.type = "module";
      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
    }
    return { content: [{ type: "text", text: `Node.js initialized!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

server.registerTool("npmInstall", {
  description: "Install npm packages",
  inputSchema: {
    packages: z.string(),
    dev: z.boolean().default(false),
    global: z.boolean().default(false)
  },
}, async ({ packages, dev, global }) => {
  try {
    let command = global ? "npm install -g" : "npm install";
    if (dev) command += " --save-dev";
    command += ` ${packages}`;

    const { stdout, stderr } = await execAsync(command);
    return { content: [{ type: "text", text: `Packages installed!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

server.registerTool("nodeRun", {
  description: "Run Node.js script",
  inputSchema: {
    script: z.string(),
    watch: z.boolean().default(false),
    args: z.string().optional()
  },
}, async ({ script, watch, args }) => {
  try {
    let command = watch ? "nodemon" : "node";
    if (watch && !script.includes(".")) {
      command += ` --exec \"npm run ${script}\"`;
    } else if (!watch && !script.includes(".")) {
      command = `npm run ${script}`;
    } else {
      command += ` ${script}`;
    }
    if (args) command += ` ${args}`;

    const { stdout, stderr } = await execAsync(command);
    return { content: [{ type: "text", text: `Node executed!\n${stdout}\n${stderr}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}\n${error.stderr || ''}` }] };
  }
});

// -------------------- DATABASE TOOLS --------------------

server.registerTool("dbQuery", {
  description: "Run database query",
  inputSchema: {
    query: z.string(),
    database: z.string(),
    host: z.string().default("localhost"),
    user: z.string().default("root"),
    password: z.string().optional(),
    port: z.number().optional()
  },
}, async ({ query, database, host, user, password, port }) => {
  try {
    const mysql = require("mysql2/promise");
    const connection = await mysql.createConnection({ host, user, password, database, port: port || 3306 });
    const [results] = await connection.execute(query);
    await connection.end();
    return { content: [{ type: "text", text: `Query OK!\n${JSON.stringify(results, null, 2)}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Database error: ${error.message}` }] };
  }
});

// -------------------- API TEST TOOLS --------------------

server.registerTool("testApiEndpoint", {
  description: "Test API endpoints",
  inputSchema: {
    url: z.string(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
    expectedStatus: z.number().optional()
  },
}, async ({ url, method, headers, body, expectedStatus }) => {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body
    });
    const responseBody = await response.text();
    const success = expectedStatus ? response.status === expectedStatus : response.ok;
    return { content: [{ type: "text", text: `API ${success ? 'PASSED' : 'FAILED'}\nStatus: ${response.status}\n${responseBody}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `API error: ${error.message}` }] };
  }
});

// -------------------- ENV TOOLS --------------------

server.registerTool("manageEnv", {
  description: "Manage .env files",
  inputSchema: {
    action: z.enum(["create", "read", "update", "delete"]),
    key: z.string().optional(),
    value: z.string().optional(),
    file: z.string().default(".env")
  },
}, async ({ action, key, value, file }) => {
  try {
    let content = "";
    if (await fs.access(file).then(() => true).catch(() => false)) {
      content = await fs.readFile(file, "utf8");
    }
    let lines = content.split("\n").filter(l => l.trim());

    switch (action) {
      case "create":
      case "update":
        if (!key || !value) throw new Error("Key and value required");
        const idx = lines.findIndex(l => l.startsWith(`${key}=`));
        if (idx >= 0) lines[idx] = `${key}=${value}`; else lines.push(`${key}=${value}`);
        break;
      case "delete":
        if (!key) throw new Error("Key required");
        lines = lines.filter(l => !l.startsWith(`${key}=`));
        break;
      case "read":
        if (key) {
          const line = lines.find(l => l.startsWith(`${key}=`));
          return { content: [{ type: "text", text: line || `Not found` }] };
        }
        break;
    }
    if (action !== "read") await fs.writeFile(file, lines.join("\n") + "\n");
    return { content: [{ type: "text", text: action === "read" ? content : `Env updated!` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Env error: ${error.message}` }] };
  }
});

// -------------------- EMAIL TOOLS --------------------

// -------------------- COMPREHENSIVE EMAIL TOOLS --------------------

server.registerTool("sendEmail", {
  description: "Send email using various providers (SMTP, AWS SES, SendGrid, etc.)",
  inputSchema: {
    provider: z.enum(["smtp", "aws-ses-sdk", "aws-ses-smtp", "sendgrid", "gmail"]).default("smtp"),
    from: z.string(),
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    html: z.string().optional(),

    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpSecure: z.boolean().default(true),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional(),

    awsRegion: z.string().optional(),
    awsAccessKeyId: z.string().optional(),
    awsSecretAccessKey: z.string().optional(),

    sendgridApiKey: z.string().optional(),
    gmailAppPassword: z.string().optional(),

    cc: z.string().optional(),
    bcc: z.string().optional(),
    attachments: z.array(z.object({
      filename: z.string(),
      content: z.string(),
      encoding: z.enum(["base64", "utf8"]).default("utf8")
    })).optional()
  },
}, async ({
  provider, from, to, subject, body, html,
  smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass,
  awsRegion, awsAccessKeyId, awsSecretAccessKey,
  sendgridApiKey, gmailAppPassword,
  cc, bcc, attachments
}) => {
  try {
    let result;

    switch (provider) {
      case "smtp":
        result = await sendViaSmtp({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: { user: smtpUser, pass: smtpPass },
          from, to, subject, body, html, cc, bcc, attachments
        });
        break;

      case "aws-ses-sdk":
        result = await sendViaAwsSesSdk({
          region: awsRegion,
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          from, to, subject, body, html, cc, bcc
        });
        break;

      case "aws-ses-smtp":
        result = await sendViaAwsSesSmtp({
          region: awsRegion,
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          from, to, subject, body, html, cc, bcc, attachments
        });
        break;

      case "sendgrid":
        result = await sendViaSendGrid({
          apiKey: sendgridApiKey,
          from, to, subject, body, html, cc, bcc, attachments
        });
        break;

      case "gmail":
        result = await sendViaGmail({
          appPassword: gmailAppPassword,
          from, to, subject, body, html, cc, bcc, attachments
        });
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return {
      content: [{
        type: "text",
        text: `✅ Email sent successfully via ${provider}!\n${result}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `❌ Email sending failed: ${error.message}\n\nProvider: ${provider}\nFrom: ${from}\nTo: ${to}`
      }]
    };
  }
});

async function sendViaSmtp(config) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });

  const mailOptions = {
    from: config.from,
    to: config.to,
    cc: config.cc,
    bcc: config.bcc,
    subject: config.subject,
    text: config.body,
    html: config.html,
    attachments: config.attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      encoding: att.encoding
    }))
  };

  const info = await transporter.sendMail(mailOptions);
  return `Message ID: ${info.messageId}`;
}

async function sendViaAwsSesSdk(config) {
  const sesClient = new SESClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  const command = new SendEmailCommand({
    Source: config.from,
    Destination: {
      ToAddresses: [config.to],
      CcAddresses: config.cc ? [config.cc] : undefined,
      BccAddresses: config.bcc ? [config.bcc] : undefined
    },
    Message: {
      Subject: { Data: config.subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: config.body, Charset: 'UTF-8' },
        Html: config.html ? { Data: config.html, Charset: 'UTF-8' } : undefined
      }
    }
  });

  const response = await sesClient.send(command);
  return `AWS SES Message ID: ${response.MessageId}`;
}

async function sendViaAwsSesSmtp(config) {
  const smtpPassword = crypto
    .createHmac('sha256', config.secretAccessKey)
    .update(`SendRawEmail${new Date().toISOString().slice(0, 10)}${config.region}`)
    .digest('base64');

  return sendViaSmtp({
    host: `email-smtp.${config.region}.amazonaws.com`,
    port: 587,
    secure: false,
    auth: {
      user: config.accessKeyId,
      pass: smtpPassword
    },
    ...config
  });
}

async function sendViaSendGrid(config) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: config.to }],
        cc: config.cc ? [{ email: config.cc }] : undefined,
        bcc: config.bcc ? [{ email: config.bcc }] : undefined
      }],
      from: { email: config.from },
      subject: config.subject,
      content: [
        { type: 'text/plain', value: config.body },
        ...(config.html ? [{ type: 'text/html', value: config.html }] : [])
      ],
      attachments: config.attachments?.map(att => ({
        content: Buffer.from(att.content).toString('base64'),
        filename: att.filename,
        type: 'application/octet-stream',
        disposition: 'attachment'
      }))
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${error}`);
  }

  return `SendGrid API: Message queued successfully`;
}

async function sendViaGmail(config) {
  return sendViaSmtp({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: config.from,
      pass: config.appPassword
    },
    ...config
  });
}

// Email template tool
server.registerTool("createEmailTemplate", {
  description: "Create and manage email templates with variables",
  inputSchema: {
    action: z.enum(["create", "render", "list", "delete"]),
    templateName: z.string().optional(),
    templateContent: z.string().optional(),
    variables: z.record(z.string()).optional()
  },
}, async ({ action, templateName, templateContent, variables }) => {
  const templatesDir = path.join(os.homedir(), '.email-templates');

  try {
    await fs.mkdir(templatesDir, { recursive: true });

    switch (action) {
      case "create":
        if (!templateName || !templateContent) {
          throw new Error("Template name and content are required");
        }
        await fs.writeFile(path.join(templatesDir, `${templateName}.html`), templateContent);
        return { content: [{ type: "text", text: `Template "${templateName}" created successfully` }] };

      case "render":
        if (!templateName) throw new Error("Template name is required");
        const templatePath = path.join(templatesDir, `${templateName}.html`);
        let content = await fs.readFile(templatePath, 'utf8');

        if (variables) {
          Object.entries(variables).forEach(([key, value]) => {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
          });
        }

        return { content: [{ type: "text", text: content }] };

      case "list":
        const files = await fs.readdir(templatesDir);
        const templates = files.filter(f => f.endsWith('.html')).map(f => f.replace('.html', ''));
        return { content: [{ type: "text", text: `Available templates:\n${templates.join('\n')}` }] };

      case "delete":
        if (!templateName) throw new Error("Template name is required");
        await fs.unlink(path.join(templatesDir, `${templateName}.html`));
        return { content: [{ type: "text", text: `Template "${templateName}" deleted` }] };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Template error: ${error.message}` }] };
  }
});

// Email validation tool
server.registerTool("validateEmail", {
  description: "Validate email addresses and check deliverability",
  inputSchema: {
    email: z.string().email(),
    checkMx: z.boolean().default(true),
    checkSmtp: z.boolean().default(false)
  },
}, async ({ email, checkMx, checkSmtp }) => {
  try {
    const results = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }
    results.push("✅ Email format is valid");

    if (checkMx) {
      const domain = email.split('@')[1];
      try {
        const { stdout } = await execAsync(`nslookup -type=MX ${domain}`);
        if (stdout.includes('mail exchanger')) {
          results.push("✅ MX records found");
        } else {
          results.push("❌ No MX records found");
        }
      } catch {
        results.push("❌ MX lookup failed");
      }
    }

    if (checkSmtp) {
      results.push("⚠️ SMTP validation requires specialized services like NeverBounce or Hunter.io");
    }

    return { content: [{ type: "text", text: `Email Validation Results for ${email}:\n\n${results.join('\n')}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Validation error: ${error.message}` }] };
  }
});

// Bulk email tool
server.registerTool("sendBulkEmails", {
  description: "Send emails to multiple recipients with rate limiting",
  inputSchema: {
    provider: z.enum(["smtp", "aws-ses-sdk"]).default("smtp"),
    from: z.string().email(),
    recipients: z.array(z.string().email()),
    subject: z.string(),
    body: z.string(),
    html: z.string().optional(),
    delayMs: z.number().min(100).max(5000).default(1000),

    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional(),
    awsRegion: z.string().optional(),
    awsAccessKeyId: z.string().optional(),
    awsSecretAccessKey: z.string().optional()
  },
}, async (config) => {
  const results = [];

  for (const [index, recipient] of config.recipients.entries()) {
    try {
      let result;

      if (config.provider === "smtp") {
        result = await sendViaSmtp({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: true,
          auth: { user: config.smtpUser, pass: config.smtpPass },
          from: config.from,
          to: recipient,
          subject: config.subject,
          body: config.body.replace(/{{email}}/g, recipient),
          html: config.html?.replace(/{{email}}/g, recipient)
        });
      } else {
        result = await sendViaAwsSesSdk({
          region: config.awsRegion,
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: config.awsSecretAccessKey,
          from: config.from,
          to: recipient,
          subject: config.subject,
          body: config.body.replace(/{{email}}/g, recipient),
          html: config.html?.replace(/{{email}}/g, recipient)
        });
      }

      results.push({ email: recipient, status: "✅ Success", error: result });

      if (index < config.recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, config.delayMs));
      }

    } catch (error) {
      results.push({ email: recipient, status: "❌ Failed", error: error.message });
    }
  }

  const successCount = results.filter(r => r.status === "✅ Success").length;
  const failureCount = results.filter(r => r.status === "❌ Failed").length;

  return {
    content: [{
      type: "text",
      text: `Bulk email sending completed!\n\n` +
        `✅ Success: ${successCount}\n` +
        `❌ Failed: ${failureCount}\n\n` +
        `Detailed results:\n${results.map(r => `${r.status} ${r.email}${r.error ? ` - ${r.error}` : ''}`).join('\n')}`
    }]
  };
});


// Enhanced SMTP tool with better error handling and diagnostics
server.registerTool("testSmtpConnection", {
  description: "Test SMTP server (SES SMTP creds) with TLS/SSL options",
  inputSchema: {
    host: z.string(),
    port: z.number(),
    secure: z.boolean().default(true),
    user: z.string(),
    pass: z.string(),
    requireTLS: z.boolean().default(true),
    ignoreTLS: z.boolean().default(false),
    tlsVersion: z.enum(["TLSv1", "TLSv1.1", "TLSv1.2", "TLSv1.3"]).optional()
  },
}, async ({ host, port, secure, user, pass, requireTLS, ignoreTLS, tlsVersion }) => {
  try {
    const tlsOptions = {};
    if (tlsVersion) {
      tlsOptions.minVersion = tlsVersion;
      tlsOptions.maxVersion = tlsVersion;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for other ports
      requireTLS,
      ignoreTLS,
      auth: {
        user,
        pass
      },
      tls: tlsOptions
    });

    await transporter.verify();
    return { 
      content: [{ 
        type: "text", 
        text: "SMTP connection successful! ✅\nConnection details:" +
              `\n- Host: ${host}:${port}` +
              `\n- Secure: ${secure}` +
              `\n- TLS Required: ${requireTLS}` +
              `\n- TLS Ignored: ${ignoreTLS}` +
              (tlsVersion ? `\n- TLS Version: ${tlsVersion}` : "")
      }] 
    };
  } catch (error) {
    let diagnosticInfo = `SMTP error: ${error.message}\n\n`;
    
    // Common error diagnostics
    if (error.code === 'ESOCKET' || error.message.includes('ECONNREFUSED')) {
      diagnosticInfo += "🔍 Diagnostic: Connection refused. Check if:\n";
      diagnosticInfo += "- SMTP server is running\n";
      diagnosticInfo += "- Host and port are correct\n";
      diagnosticInfo += "- Firewall allows connections\n";
    } else if (error.message.includes('wrong version') || error.message.includes('SSL')) {
      diagnosticInfo += "🔍 Diagnostic: TLS/SSL version mismatch. Try:\n";
      diagnosticInfo += "- Setting secure: false for STARTTLS (ports 587, 25)\n";
      diagnosticInfo += "- Setting secure: true for SSL (port 465)\n";
      diagnosticInfo += "- Adjusting TLS version requirements\n";
      diagnosticInfo += "- Using ignoreTLS: true for plaintext connections\n";
    } else if (error.message.includes('Authentication failed') || error.message.includes('535')) {
      diagnosticInfo += "🔍 Diagnostic: Authentication failed. Check:\n";
      diagnosticInfo += "- Username and password are correct\n";
      diagnosticInfo += "- SMTP credentials have proper permissions\n";
    }

    diagnosticInfo += `\nSuggested configurations:\n`;
    diagnosticInfo += `For AWS SES SMTP (port 587): secure: false, requireTLS: true\n`;
    diagnosticInfo += `For AWS SES SMTP (port 465): secure: true, requireTLS: false\n`;
    diagnosticInfo += `For plaintext testing: secure: false, ignoreTLS: true\n`;

    return { 
      content: [{ 
        type: "text", 
        text: diagnosticInfo 
      }] 
    };
  }
});

// Additional tool for testing different SMTP configurations
server.registerTool("diagnoseSmtp", {
  description: "Diagnose SMTP connection issues by testing multiple configurations",
  inputSchema: {
    host: z.string(),
    port: z.number(),
    user: z.string(),
    pass: z.string()
  },
}, async ({ host, port, user, pass }) => {
  const configurations = [
    { name: "SSL (port 465 style)", secure: true, requireTLS: false, ignoreTLS: false },
    { name: "STARTTLS (port 587 style)", secure: false, requireTLS: true, ignoreTLS: false },
    { name: "Plaintext", secure: false, requireTLS: false, ignoreTLS: true }
  ];

  const results = [];

  for (const config of configurations) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: config.secure,
        requireTLS: config.requireTLS,
        ignoreTLS: config.ignoreTLS,
        auth: { user, pass }
      });

      await transporter.verify();
      results.push(`✅ ${config.name}: SUCCESS`);
    } catch (error) {
      results.push(`❌ ${config.name}: ${error.message}`);
    }
  }

  return {
    content: [{
      type: "text",
      text: `SMTP Diagnostic Results for ${host}:${port}\n\n${results.join('\n')}\n\n` +
            "Most common AWS SES configurations:\n" +
            "- Port 465: Use SSL configuration (secure: true)\n" +
            "- Port 587: Use STARTTLS configuration (secure: false, requireTLS: true)\n" +
            "- Port 25: Usually requires STARTTLS but may be blocked by ISP"
    }]
  };
});

// Tool to get AWS SES SMTP credentials from AWS CLI configuration
server.registerTool("getAwsSesSmtpInfo", {
  description: "Get AWS SES SMTP information from AWS configuration",
  inputSchema: {
    profile: z.string().default("default"),
    region: z.string().default("us-east-1")
  },
}, async ({ profile, region }) => {
  try {
    // Try to get AWS credentials from CLI config
    const { stdout } = await execAsync(`aws configure get aws_access_key_id --profile ${profile}`);
    const accessKeyId = stdout.trim();
    
    if (!accessKeyId) {
      throw new Error("AWS access key not found. Make sure AWS CLI is configured.");
    }

    // AWS SES SMTP password is generated from secret key
    const { stdout: secretKeyStdout } = await execAsync(`aws configure get aws_secret_access_key --profile ${profile}`);
    const secretAccessKey = secretKeyStdout.trim();

    if (!secretAccessKey) {
      throw new Error("AWS secret key not found.");
    }

    // Generate SMTP password (AWS specific algorithm)
    const smtpPassword = crypto
      .createHmac('sha256', secretAccessKey)
      .update(`SendRawEmail${new Date().toISOString().slice(0, 10)}${region}`)
      .digest('base64');

    const smtpInfo = `
AWS SES SMTP Configuration:
──────────────────────────
SMTP Endpoint: email-smtp.${region}.amazonaws.com
Ports: 587 (STARTTLS) or 465 (SSL)
Username: ${accessKeyId}
Password: ${smtpPassword}
Region: ${region}

Connection strings:
- STARTTLS (port 587): secure: false, requireTLS: true
- SSL (port 465): secure: true, requireTLS: false

Note: Ensure IAM user has SES sending permissions
    `.trim();

    return {
      content: [{
        type: "text",
        text: smtpInfo
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error getting AWS SES SMTP info: ${error.message}\n\n` +
              "Make sure:\n" +
              "1. AWS CLI is installed: https://aws.amazon.com/cli/\n" +
              "2. AWS CLI is configured: aws configure\n" +
              "3. IAM user has SES permissions"
      }]
    };
  }
});

server.registerTool("testAmazonSes", {
  description: "Send email using AWS SDK (IAM creds)",
  inputSchema: {
    region: z.string(),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    from: z.string(),
    to: z.string(),
    subject: z.string(),
    body: z.string()
  },
}, async ({ region, accessKeyId, secretAccessKey, from, to, subject, body }) => {
  try {
    const sesClient = new SESClient({ 
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    const command = new SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: body,
            Charset: 'UTF-8'
          }
        }
      }
    });

    const response = await sesClient.send(command);
    return { 
      content: [{ 
        type: "text", 
        text: `Email sent successfully! Message ID: ${response.MessageId}` 
      }] 
    };
  } catch (error) {
    return { 
      content: [{ 
        type: "text", 
        text: `AWS SES error: ${error.message}` 
      }] 
    };
  }
});

// -------------------- FILE SYSTEM TOOLS --------------------

server.registerTool("fileOperations", {
  description: "Perform file operations (read, write, append, delete)",
  inputSchema: {
    operation: z.enum(["read", "write", "append", "delete"]),
    path: z.string(),
    content: z.string().optional(),
    encoding: z.string().default("utf8")
  },
}, async ({ operation, path, content, encoding }) => {
  try {
    switch (operation) {
      case "read":
        const data = await fs.readFile(path, encoding);
        return { content: [{ type: "text", text: data }] };
      
      case "write":
        if (!content) throw new Error("Content is required for write operation");
        await fs.writeFile(path, content, encoding);
        return { content: [{ type: "text", text: `File written successfully: ${path}` }] };
      
      case "append":
        if (!content) throw new Error("Content is required for append operation");
        await fs.appendFile(path, content, encoding);
        return { content: [{ type: "text", text: `Content appended to: ${path}` }] };
      
      case "delete":
        await fs.unlink(path);
        return { content: [{ type: "text", text: `File deleted: ${path}` }] };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `File operation error: ${error.message}` }] };
  }
});

// -------------------- PROCESS MANAGEMENT TOOLS --------------------

server.registerTool("processManagement", {
  description: "Manage system processes",
  inputSchema: {
    action: z.enum(["start", "stop", "restart", "status"]),
    processName: z.string(),
    command: z.string().optional()
  },
}, async ({ action, processName, command }) => {
  try {
    switch (action) {
      case "start":
        if (!command) throw new Error("Command is required to start a process");
        const childProcess = spawn(command, { shell: true, detached: true });
        childProcess.unref();
        return { content: [{ type: "text", text: `Process started: ${processName}` }] };
      
      case "stop":
        await execAsync(`pkill -f "${processName}"`);
        return { content: [{ type: "text", text: `Process stopped: ${processName}` }] };
      
      case "restart":
        await execAsync(`pkill -f "${processName}"`);
        if (command) {
          const childProcess = spawn(command, { shell: true, detached: true });
          childProcess.unref();
        }
        return { content: [{ type: "text", text: `Process restarted: ${processName}` }] };
      
      case "status":
        try {
          await execAsync(`pgrep -f "${processName}"`);
          return { content: [{ type: "text", text: `Process is running: ${processName}` }] };
        } catch {
          return { content: [{ type: "text", text: `Process is not running: ${processName}` }] };
        }
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Process management error: ${error.message}` }] };
  }
});

// -------------------- SECURITY TOOLS --------------------

server.registerTool("generateSecureToken", {
  description: "Generate secure random tokens",
  inputSchema: {
    length: z.number().min(16).max(256).default(32),
    type: z.enum(["hex", "base64", "urlsafe"]).default("hex")
  },
}, async ({ length, type }) => {
  try {
    let token;
    switch (type) {
      case "hex":
        token = crypto.randomBytes(length).toString('hex').slice(0, length);
        break;
      case "base64":
        token = crypto.randomBytes(length).toString('base64').slice(0, length);
        break;
      case "urlsafe":
        token = crypto.randomBytes(length).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '')
          .slice(0, length);
        break;
    }
    
    return { content: [{ type: "text", text: `Secure token generated: ${token}` }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Token generation error: ${error.message}` }] };
  }
});




// -------------------- SERVER STARTUP --------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dev MCP Server running on stdio");
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});