<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

const MAX_NUMBER = 2500;
$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'raffle-state.json';

function seedState(): array {
    return [
        'title' => 'Sorteio da corrida.',
        'subtitle' => 'Gire a roleta para sortear um dos números participantes.',
        'prizeName' => 'Prêmio padrão da corrida',
        'prizeDescription' => 'Procure a organização da corrida para receber seu prêmio.',
        'available' => range(1, MAX_NUMBER),
        'drawn' => [],
    ];
}

function sendJson(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!is_dir($dataDir) && !mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
    sendJson(['error' => 'Não foi possível criar a pasta de dados.'], 500);
}
$handle = @fopen($dataFile, 'c+');
if (!$handle || !flock($handle, LOCK_EX)) {
    sendJson(['error' => 'O servidor não conseguiu acessar os dados do sorteio.'], 500);
}
$raw = stream_get_contents($handle);
$state = json_decode($raw ?: '', true);
if (!is_array($state) || !isset($state['available'], $state['drawn']) || !is_array($state['available']) || !is_array($state['drawn'])) {
    $state = seedState();
}
$state += seedState();
$state['available'] = array_values(array_unique(array_filter($state['available'], static fn($n) => is_int($n) && $n >= 1 && $n <= MAX_NUMBER)));
$state['drawn'] = array_values(array_filter($state['drawn'], static fn($entry) => (is_int($entry) && $entry >= 1 && $entry <= MAX_NUMBER) || (is_array($entry) && isset($entry['number']) && is_numeric($entry['number']) && (int)$entry['number'] >= 1 && (int)$entry['number'] <= MAX_NUMBER)));

$action = $_SERVER['REQUEST_METHOD'] === 'POST' ? ($_POST['action'] ?? '') : 'load';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_POST)) {
    $body = json_decode(file_get_contents('php://input') ?: '', true);
    if (is_array($body)) { $action = $body['action'] ?? ''; }
}

if ($action === 'save') {
    $body = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($body)) { sendJson(['error' => 'Dados inválidos.'], 400); }
    foreach (['title' => 64, 'subtitle' => 110, 'prizeName' => 64, 'prizeDescription' => 130] as $field => $limit) {
        if (isset($body[$field]) && is_string($body[$field])) {
            $characters = preg_split('//u', trim($body[$field]), -1, PREG_SPLIT_NO_EMPTY);
            $state[$field] = $characters === false ? substr(trim($body[$field]), 0, $limit) : implode('', array_slice($characters, 0, $limit));
        }
    }
} elseif ($action === 'draw') {
    if (!$state['available']) { sendJson(['error' => 'Não há números disponíveis.'], 409); }
    $index = random_int(0, count($state['available']) - 1);
    $winner = $state['available'][$index];
    array_splice($state['available'], $index, 1);
    $state['drawn'][] = ['number' => $winner, 'drawnAt' => gmdate('c')];
} elseif ($action === 'reset') {
    $state['available'] = range(1, MAX_NUMBER);
    $state['drawn'] = [];
} elseif ($action !== 'load') {
    sendJson(['error' => 'Ação inválida.'], 400);
}

if ($action === 'load') {
    flock($handle, LOCK_UN);
    fclose($handle);
    sendJson(['state' => $state, 'winner' => null]);
}

rewind($handle);
ftruncate($handle, 0);
$encoded = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false || fwrite($handle, $encoded) === false || !fflush($handle)) {
    flock($handle, LOCK_UN); fclose($handle);
    sendJson(['error' => 'Não foi possível salvar os dados no servidor.'], 500);
}
flock($handle, LOCK_UN);
fclose($handle);
sendJson(['state' => $state, 'winner' => $winner ?? null]);
