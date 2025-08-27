# LMCP

This project provides a set of development tools exposed through the Model Context Protocol (MCP). It allows you to interact with your development environment using a standardized protocol.

## Installation

To get started, clone the repository and install the dependencies:

```bash
git clone https://github.com/cyberwizard/LMCP.git
cd LMCP
npm install
```

## Usage

To start the MCP server, run the following command:

```bash
node index.js
```

The server will start and listen for incoming connections.

## Connecting a Large Language Model (LLM) like Gemini

This MCP server is designed to be used as a tool provider for large language models like Gemini. The LLM does not directly interact with this server. Instead, the environment in which the LLM operates is responsible for managing the connection.

Here's how it works:

1.  **Tool Registration**: The tools defined in this MCP server (e.g., `flutterCreate`, `laravelArtisan`) are registered with the LLM's execution environment. The environment knows how to call these tools.

2.  **LLM Invokes a Tool**: When the LLM decides to use one of the tools, it generates a tool call request. This request contains the tool name and the parameters for that tool.

3.  **Environment Executes the Tool**: The LLM's environment receives the tool call request. It then translates this request into a JSON-RPC message and sends it to this MCP server.

4.  **MCP Server Responds**: This server receives the JSON-RPC message, executes the corresponding tool, and sends a JSON-RPC response back to the environment.

5.  **Environment Returns Result to LLM**: The environment parses the response from the MCP server and returns the result to the LLM, which can then use the result to continue its task.

This MCP server uses a standard I/O transport, meaning it communicates over `stdin` and `stdout`. The LLM's execution environment would be responsible for spawning the `node index.js` process and managing the communication with it.

### Conceptual Python Example

Here is a conceptual Python example of how an LLM's execution environment might interact with this MCP server. This is a simplified illustration of the communication flow.

```python
import subprocess
import json

# 1. The environment starts the MCP server.
print("Starting MCP server...")
mcp_process = subprocess.Popen(
    ["node", "index.js"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# 2. The LLM decides to call a tool. For example, to create a new Flutter project.
# The LLM would generate a tool call like: flutterCreate(projectName='my_flutter_app')

# 3. The environment constructs a JSON-RPC message for this tool call.
tool_call_request = {
    "jsonrpc": "2.0",
    "method": "flutterCreate",
    "params": {
        "projectName": "my_flutter_app"
    },
    "id": 1
}

# 4. The environment sends the message to the MCP server.
print(f"Sending to MCP server: {json.dumps(tool_call_request)}")
mcp_process.stdin.write(json.dumps(tool_call_request) + '\n')
mcp_process.stdin.flush()

# 5. The environment reads the response from the MCP server.
response_str = mcp_process.stdout.readline()
print(f"Received from MCP server: {response_str}")

# 6. The environment parses the response and provides the result to the LLM.
response = json.loads(response_str)

# ... The LLM can then use the result ...

# Clean up the server process
mcp_process.terminate()
```

## Simple Client Example

If you want to manually interact with the MCP server, you can use this simple Node.js CLI. It allows you to send JSON-RPC messages to the server and view the responses.

Create a file named `client.js` with the following content:

```javascript
import { spawn } from 'child_process';
import readline from 'readline';

const mcpServer = spawn('node', ['index.js']);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

mcpServer.stdout.on('data', (data) => {
  console.log(`MCP Server: ${data}`);
});

mcpServer.stderr.on('data', (data) => {
  console.error(`MCP Server Error: ${data}`);
});

mcpServer.on('close', (code) => {
  console.log(`MCP Server exited with code ${code}`);
  process.exit();
});

function askQuestion() {
  rl.question('Enter JSON-RPC message to send to MCP server (or type \'exit\'): ', (message) => {
    if (message.toLowerCase() === 'exit') {
      mcpServer.kill();
      rl.close();
      return;
    }
    mcpServer.stdin.write(message + '\n');
    askQuestion();
  });
}

askQuestion();
```

To run the CLI, execute the following command:

```bash
node client.js
```

You can then type your JSON-RPC messages into the terminal and press Enter to send them to the MCP server. The server's responses will be printed to the console.

## Included Tools

This MCP server comes with a variety of tools to assist in development workflows.

### Flutter

- **flutterCreate**: Create a new Flutter project.
- **flutterRun**: Run a Flutter app on a specific device.
- **flutterPub**: Manage Flutter packages.
- **flutterBuild**: Build a Flutter app for a specific platform.

### Laravel

- **laravelCreate**: Create a new Laravel project.
- **laravelArtisan**: Run Laravel Artisan commands.
- **laravelMake**: Generate Laravel classes using Artisan.
- **laravelMigrate**: Run Laravel database migrations.

### Node.js

- **npmInit**: Initialize a new Node.js project.
- **npmInstall**: Install npm packages.
- **nodeRun**: Run a Node.js script or start a development server.

### Database

- **dbQuery**: Execute database queries (MySQL/PostgreSQL).

### API Testing

- **testApiEndpoint**: Test REST API endpoints.

### Code Quality

- **runLint**: Run a code linter for various languages.

### Git

- **gitCommand**: Execute Git commands.

### Environment Configuration

- **manageEnv**: Manage environment configuration files.

## Dependencies

- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [node-fetch](https://www.npmjs.com/package/node-fetch)
- [ping](https://www.npmjs.com/package/ping)
- [zod](https://www.npmjs.com/package/zod)

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.