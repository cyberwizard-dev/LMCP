# LMCP Server

A simple PHP-based MCP server built using the `php-mcp/server` SDK.

## How to Run

1.  Make sure you have PHP (8.1+) and Composer installed.
2.  Install dependencies:

    ```bash
    composer install
    ```

3.  Run the MCP server:

    ```bash
    php mcp-server.php
    ```

4.  The server will be running and listening for MCP client connections. By default, it uses HTTP with Server-Sent Events.

## Available Tools

*   `hello(string $name = 'world')`: A simple tool that returns a greeting.

    Example usage (conceptual, depends on MCP client implementation):

    ```json
    {
        "tool": "hello",
        "args": {
            "name": "Alice"
        }
    }
    ```

    This would return: `"Hello, Alice!"`

*   `makeHttpRequest(string $method, string $url, array $headers = [], string $body = '')`: Makes an HTTP request to a specified URL.

    Example usage (conceptual, depends on MCP client implementation):

    ```json
    {
        "tool": "makeHttpRequest",
        "args": {
            "method": "GET",
            "url": "https://jsonplaceholder.typicode.com/todos/1"
        }
    }
    ```

    This would return the JSON response from the URL, including status code, headers, and body.

*   `ping(string $host)`: Pings a host to check its reachability.

    Example usage:

    ```json
    {
        "tool": "ping",
        "args": {
            "host": "google.com"
        }
    }
    ```

*   `readFile(string $filePath)`: Reads the content of a specified file.

    Example usage:

    ```json
    {
        "tool": "readFile",
        "args": {
            "filePath": "./README.md"
        }
    }
    ```

*   `writeFile(string $filePath, string $content)`: Writes content to a specified file.

    Example usage:

    ```json
    {
        "tool": "writeFile",
        "args": {
            "filePath": "./test.txt",
            "content": "Hello from MCP server!"
        }
    }
    ```