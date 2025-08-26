<?php

// A simple MCP server for testing RESTful APIs

// Get the request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['PATH_INFO'] ?? '/';

// A simple router
switch ($path) {
    case '/':
        handle_root($method);
        break;
    case '/hello':
        handle_hello($method);
        break;
    default:
        handle_not_found();
        break;
}

function handle_root($method) {
    if ($method === 'GET') {
        json_response(['message' => 'Welcome to the MCP server!']);
    } else {
        handle_method_not_allowed();
    }
}

function handle_hello($method) {
    if ($method === 'GET') {
        json_response(['message' => 'Hello, world!']);
    } elseif ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        json_response(['message' => 'Hello, ' . ($body['name'] ?? 'stranger') . '!']);
    } else {
        handle_method_not_allowed();
    }
}

function handle_not_found() {
    http_response_code(404);
    json_response(['error' => 'Not Found']);
}

function handle_method_not_allowed() {
    http_response_code(405);
    json_response(['error' => 'Method Not Allowed']);
}

function json_response($data, $status_code = 200) {
    http_response_code($status_code);
    header('Content-Type: application/json');
    echo json_encode($data);
}

