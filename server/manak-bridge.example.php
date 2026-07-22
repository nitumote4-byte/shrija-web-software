<?php
/**
 * Example Manak bridge — drop on any PHP host (or adapt Gold Shark automate_request.php).
 *
 * Shrija POSTs JSON:
 *   { "username", "password", "night", "action": "fetch_requests" }
 *
 * Respond with:
 *   { "requests": [ { partyName, item, pic, weight, purity, requestNo, receiptNo, jobCardNo, cml } ] }
 *
 * Replace the body of fetch_from_manak() with your Gold Shark / portal logic.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$raw = file_get_contents('php://input');
$in = json_decode($raw ?: '{}', true);
if (!is_array($in)) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid JSON']);
  exit;
}

$username = trim((string)($in['username'] ?? ''));
$password = (string)($in['password'] ?? '');
$night = (string)($in['night'] ?? 'Night');

if ($username === '' || $password === '') {
  http_response_code(400);
  echo json_encode(['error' => 'username and password required']);
  exit;
}

try {
  $requests = fetch_from_manak($username, $password, $night);
  echo json_encode(['ok' => true, 'requests' => $requests]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}

/**
 * TODO: paste Gold Shark automate_request.php login + scrape / API calls here.
 * Return list of associative arrays with the keys below.
 */
function fetch_from_manak(string $username, string $password, string $night): array {
  // Example empty response — replace with real Manak fetch
  return [
    // [
    //   'partyName' => 'Sample Jewellers',
    //   'item' => 'Necklace',
    //   'pic' => 12,
    //   'weight' => 45.6,
    //   'purity' => '916',
    //   'requestNo' => 'REQ-001',
    //   'receiptNo' => 'RC-001',
    //   'jobCardNo' => 'JC-001',
    //   'cml' => 'CML-001',
    // ],
  ];
}
