<?php
// api/rooms.php
// Versión que devuelve claves en inglés para GET y espera claves en inglés para POST

ini_set('display_errors', 1); // Mantener para desarrollo
error_reporting(E_ALL);     // Mantener para desarrollo

require_once __DIR__ . '/../config/db_connect.php';

$response = ['success' => false, 'message' => 'Solicitud no procesada', 'data' => null];
$statusCode = 500;

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
} else {
     error_log("API Rooms - WARNING: Headers already sent before processing request!");
}

$method = $_SERVER['REQUEST_METHOD'];

// --- GET ---
if ($method === 'GET') {
    error_log("API Rooms - Procesando GET /api/rooms");
    try {
        if (!isset($pdo) || !$pdo instanceof PDO) { throw new Exception("Conexión DB no disponible."); }
        error_log("API Rooms - GET: PDO OK. Ejecutando SELECT...");

        // *** USA ALIAS PARA DEVOLVER CLAVES EN INGLÉS ***
        $query = "SELECT id, numero AS number, nombre AS name, color FROM habitaciones ORDER BY numero ASC";
        $stmt = $pdo->query($query);

        if ($stmt === false) {
             $errorInfo = $pdo->errorInfo();
             error_log("API Rooms - GET: Error en pdo->query. Info: " . print_r($errorInfo, true));
             throw new Exception("Fallo consulta habitaciones. SQLSTATE[{$errorInfo[0]}] {$errorInfo[2]}");
        }
        error_log("API Rooms - GET: Query OK. Obteniendo resultados...");

        $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log("API Rooms - GET: fetchAll devolvió (" . count($rooms) . " filas): " . print_r($rooms, true));

        error_log("API Rooms - GET: Preparando JSON...");
        $jsonOutput = json_encode($rooms);

        if ($jsonOutput === false) {
            $jsonError = json_last_error_msg();
            error_log("API Rooms - GET: ¡¡json_encode FALLÓ!! Error: " . $jsonError);
            throw new Exception("Error al codificar datos a JSON: " . $jsonError);
        }

        error_log("API Rooms - GET: JSON a enviar: " . $jsonOutput);

        if (!headers_sent()) { http_response_code(200); } // OK
        echo $jsonOutput;
        exit;

    } catch (\Throwable $e) {
        error_log("ERROR CAPTURADO en GET /api/rooms: " . $e->getMessage() . " EN ARCHIVO: " . $e->getFile() . " LINEA: " . $e->getLine());
        $errorResponse = ['success' => false, 'message' => 'Error interno: ' . $e->getMessage()];
        if (!headers_sent()) { http_response_code(500); }
        echo json_encode($errorResponse);
        exit;
    }
}
// --- POST --- (Espera claves 'number', 'name', 'color')
elseif ($method === 'POST') {
     error_log("API Rooms - Procesando POST /api/rooms");
    $rawData = file_get_contents('php://input');
    $input = json_decode($rawData, true);

    error_log("API Rooms - POST DEBUG - Raw POST data: " . $rawData);
    error_log("API Rooms - POST DEBUG - Decoded input: " . print_r($input, true));

    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        $response['message'] = 'Error: Cuerpo de la petición no es JSON válido.';
        $statusCode = 400;
    }
    elseif (!isset($input['number']) || empty($input['number']) || !is_numeric($input['number']) || $input['number'] <= 0) {
        $response['message'] = 'El número de habitación es inválido o falta (clave "number").';
        $statusCode = 400;
    }
    elseif (!isset($input['name']) || trim($input['name']) === '') {
        $response['message'] = 'El nombre de la habitación es obligatorio (clave "name").';
        $statusCode = 400;
    }
    elseif (!isset($input['color']) || !preg_match('/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/', $input['color'])) {
        $response['message'] = 'El formato del color es inválido (clave "color", debe ser #RRGGBB).';
        $statusCode = 400;
    } else {
        try {
            if (!isset($pdo) || !$pdo instanceof PDO) { throw new Exception("Conexión DB no disponible para POST."); }

            $stmtCheck = $pdo->prepare("SELECT id FROM habitaciones WHERE numero = :numero LIMIT 1");
            $stmtCheck->execute([':numero' => $input['number']]);

            if ($stmtCheck->fetch()) {
                $response['message'] = 'Error: El número de habitación ' . htmlspecialchars($input['number']) . ' ya existe.';
                $statusCode = 409;
            } else {
                $sql = "INSERT INTO habitaciones (numero, nombre, color) VALUES (:numero_val, :nombre_val, :color_val)";
                $stmt = $pdo->prepare($sql);
                $success = $stmt->execute([
                    ':numero_val' => $input['number'],
                    ':nombre_val' => $input['name'],
                    ':color_val'  => $input['color']
                ]);

                if ($success && $stmt->rowCount() > 0) {
                    $newId = $pdo->lastInsertId();
                    $response['success'] = true;
                    $response['message'] = 'Habitación añadida correctamente.';
                    $response['data'] = ['id' => $newId, 'number' => (int)$input['number'], 'name' => $input['name'], 'color' => $input['color']];
                    $statusCode = 201;
                } else { throw new Exception("No se pudo añadir la habitación (rowCount fue 0)."); }
            }
        } catch (\Throwable $e) {
             error_log("ERROR CAPTURADO en POST /api/rooms: " . $e->getMessage() . " EN ARCHIVO: " . $e->getFile() . " LINEA: " . $e->getLine());
             $response['message'] = 'Error interno: ' . $e->getMessage();
             if ($e instanceof \PDOException && $e->errorInfo[1] == 1062) {
                 $response['message'] = 'Error: El número de habitación ya existe (detectado por DB).'; $statusCode = 409;
             } else { $statusCode = 500; }
        }
    }
    if (!headers_sent()) { http_response_code($statusCode); }
    echo json_encode($response);
    exit;
}
// --- DELETE --- (Espera id en query string)
elseif ($method === 'DELETE') {
    error_log("API Rooms - Procesando DELETE /api/rooms");
    $roomId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

    if (!$roomId || $roomId <= 0) {
        $response['message'] = 'Falta el ID de la habitación a eliminar o es inválido (?id=...).';
        $statusCode = 400;
    } else {
        try {
             if (!isset($pdo) || !$pdo instanceof PDO) { throw new Exception("Conexión DB no disponible para DELETE."); }
            error_log("API Rooms - DELETE: Intentando eliminar ID: " . $roomId);
            $sql = "DELETE FROM habitaciones WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $success = $stmt->execute([':id' => $roomId]);

            if ($success && $stmt->rowCount() > 0) {
                $response['success'] = true; $response['message'] = 'Habitación eliminada.'; $statusCode = 200;
            } elseif ($success) {
                 $response['message'] = 'Habitación no encontrada (ID: '.$roomId.').'; $statusCode = 404;
            } else { throw new Exception("No se pudo eliminar (execute devolvió false)."); }
        } catch (\Throwable $e) {
             error_log("ERROR CAPTURADO en DELETE /api/rooms: " . $e->getMessage() . " EN ARCHIVO: " . $e->getFile() . " LINEA: " . $e->getLine());
             $response['message'] = 'Error interno: ' . $e->getMessage(); $statusCode = 500;
        }
    }
    if (!headers_sent()) { http_response_code($statusCode); }
    echo json_encode($response);
    exit;
}
// --- Método no soportado ---
else {
    error_log("API Rooms - Método no soportado: " . $method);
    $response['message'] = 'Método HTTP no soportado.';
    $statusCode = 405;
    if (!headers_sent()) { header('Allow: GET, POST, DELETE'); }
    if (!headers_sent()) { http_response_code($statusCode); }
    echo json_encode($response);
    exit;
}
?>