# LMCP: Local Model Context Protocol Server

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![npm version](https://badge.fury.io/js/lmcp.svg)](https://badge.fury.io/js/lmcp)
[![Powered by @modelcontextprotocol/sdk](https://img.shields.io/badge/Powered%20by-MCP%20SDK-orange)](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

LMCP is a powerful Node.js-based server that exposes a rich set of local development tools to Large Language Models (LLMs) like Google's Gemini through the Model Context Protocol (MCP). It acts as a bridge, allowing the LLM to safely and effectively interact with your local file system, run commands, manage projects, and much more.

This server is designed to be run in your development environment, turning your local machine into a powerful toolkit that an AI agent can leverage to perform complex software engineering tasks.

## ✨ Features

The server provides a wide array of tools, categorized for ease of use:

- **🚀 Project Scaffolding**:
  - **Flutter**: `flutterCreate`
  - **Laravel**: `laravelCreate`
  - **Node.js**: `npmInit`

- **🛠️ Project Management**:
  - **Flutter**: `flutterRun`, `flutterPub`, `flutterBuild`
  - **Laravel**: `laravelArtisan`, `laravelMake`, `laravelMigrate`
  - **Node.js**: `npmInstall`, `nodeRun`

- **🗃️ Database & API**:
  - `dbQuery`: Execute SQL queries.
  - `testApiEndpoint`: Test REST API endpoints.

- **📧 Emailing**:
  - `sendEmail`: A comprehensive tool to send emails via SMTP, AWS SES, SendGrid, and Gmail.
  - `createEmailTemplate`, `validateEmail`, `sendBulkEmails`: Advanced email utilities.
  - `testSmtpConnection`, `diagnoseSmtp`: SMTP debugging tools.

- **⚙️ System & Files**:
  - `fileOperations`: Read, write, append, and delete files.
  - `processManagement`: Start, stop, and check the status of system processes.
  - `manageEnv`: Create and manage `.env` files.

- **🔒 Security**:
  - `generateSecureToken`: Create secure random tokens.

## 📦 Installation

To get started, clone the repository and install the required dependencies.

```bash
git clone https://github.com/cyberwizard_Dev/LMCP.git
cd LMCP
npm install
```

## 🚀 Usage

To start the MCP server, simply run the `start` script:

```bash
npm start
```
or
```bash
node index.js
```

The server will start and listen for incoming JSON-RPC messages on its standard input/output (stdio).

## 🤖 How it Works with an LLM

The LMCP server does not directly connect to the LLM. Instead, the environment hosting the LLM (like a custom Python script, a VS Code extension, or a cloud service) is responsible for managing the connection.

1.  **Tool Registration**: The hosting environment registers the tools available on this server (e.g., `fileOperations`, `flutterCreate`) with the LLM.
2.  **LLM Invocation**: The LLM, when tasked with something like "create a new flutter app", decides to call the `flutterCreate` tool.
3.  **Environment Execution**: The hosting environment receives the tool call, constructs a JSON-RPC message, and sends it to the LMCP server's `stdin`.
4.  **LMCP Response**: The server executes the tool and sends the result back as a JSON-RPC response to its `stdout`.
5.  **Result Delivery**: The hosting environment parses the response and delivers the result back to the LLM, which then decides the next step.

This architecture ensures a secure and structured way for the LLM to interact with your local development environment.

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📜 License

Distributed under the ISC License. See `LICENSE` file for more information (if one exists).

## 📞 Contact


Project Link: [https://github.com/cyberwizard_dev/LMCP](https://github.com/cyberwizard_dev/LMCP)
