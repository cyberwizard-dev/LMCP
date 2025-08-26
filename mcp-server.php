<?php

require __DIR__ . '/vendor/autoload.php';

use PhpMcp\Server\Server;
use PhpMcp\Server\Attributes\McpTool;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

class MyApi
{
    #[McpTool(
        name: 'hello',
        description: 'A simple tool that returns a greeting.'
    )]
    public function hello(string $name = 'world'): string
    {
        return "Hello, {$name}!";
    }

    #[McpTool(
        name: 'makeHttpRequest',
        description: 'Makes an HTTP request to a specified URL.'
    )]
    public function makeHttpRequest(
        string $method,
        string $url,
        array $headers = [],
        string $body = ''
    ): array {
        $client = new Client();

        try {
            $response = $client->request($method, $url, [
                'headers' => $headers,
                'body' => $body,
            ]);

            return [
                'statusCode' => $response->getStatusCode(),
                'headers' => $response->getHeaders(),
                'body' => (string) $response->getBody(),
            ];
        } catch (RequestException $e) {
            return [
                'error' => $e->getMessage(),
                'statusCode' => $e->hasResponse() ? $e->getResponse()->getStatusCode() : null,
            ];
        } catch (\Throwable $e) {
            return [
                'error' => $e->getMessage(),
                'statusCode' => null,
            ];
        }
    }

    #[McpTool(
        name: 'ping',
        description: 'Pings a host to check its reachability.'
    )]
    public function ping(string $host): array
    {
        $command = sprintf('ping -c 1 -W 1 %s', escapeshellarg($host));
        exec($command, $output, $status);

        return [
            'status' => $status === 0 ? 'success' : 'failure',
            'output' => implode("\n", $output),
        ];
    }

    #[McpTool(
        name: 'readFile',
        description: 'Reads the content of a specified file.'
    )]
    public function readFile(string $filePath): array
    {
        if (!file_exists($filePath)) {
            return ['error' => 'File not found.'];
        }
        if (!is_readable($filePath)) {
            return ['error' => 'File is not readable.'];
        }
        return ['content' => file_get_contents($filePath)];
    }

    #[McpTool(
        name: 'writeFile',
        description: 'Writes content to a specified file.'
    )]
    public function writeFile(string $filePath, string $content): array
    {
        $dir = dirname($filePath);

        if (!is_dir($dir)) {
            return ['error' => 'Directory does not exist.'];
        }
        if (!is_writable($dir)) {
            return ['error' => 'Directory is not writable.'];
        }
        if (file_put_contents($filePath, $content) === false) {
            return ['error' => 'Failed to write to file.'];
        }
        return ['status' => 'success', 'message' => 'File written successfully.'];
    }
}

$server = Server::make()
    ->withBasePath(__DIR__)
    ->withScanDirectories([__DIR__])
    ->discover()
    ->build(); // ✅ IMPORTANT



exit($server->run('stdio'));
