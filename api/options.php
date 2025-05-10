<?php
// api/options.php
// VERSIÓN CORREGIDA: Asegura que GET devuelva {success: true, data: [...]}

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config/db_connect.php'; // Ajusta la ruta si es necesario

// Configuración de entidades (tablas, campos, si tiene color)
$entityConfig = [
    'sale_types' => ['table' => 'tipos_venta',     'fields' => ['nombre'],          'has_color' => false],
    'channels'   => ['table' => 'canales_venta',   'fields' => ['nombre'],          'has_color' => false],
    'statuses'   => ['table' => 'estados_reserva', 'fields' => ['nombre', 'color'], 'has_color' => true]
];

// Respuesta y estado por defecto
$response = ['success' => false, 'message' => 'Solicitud no procesada.', 'data' => null];
$statusCode = 400; // Bad Request por defecto

// Establecer cabecera JSON (importante antes de CUALQUIER salida)
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

// --- Obtener y Validar Parámetros ---
$method = $_SERVER['REQUEST_METHOD'];
$type = filter_input(INPUT_GET, 'type', FILTER_SANITIZE_SPECIAL_CHARS); // Obtener 'type' de la URL
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);             // Obtener 'id' opcional

// Validar que 'type' sea uno de los permitidos
if (!$type || !isset($entityConfig[$type])) {
    $response['message'] = 'Parámetro "type" inválido o faltante. Valores permitidos: ' . implode(', ', array_keys($entityConfig));
    $statusCode = 400;
    // Salir directamente si el tipo es inválido
    http_response_code($statusCode);
    echo json_encode($response);
    exit;
}

$config = $entityConfig[$type];
$tableName = "`" . $config['table'] . "`"; // Usar backticks por si el nombre tiene caracteres especiales

// --- Lógica Principal ---
try {
    if (!isset($pdo) || !$pdo instanceof PDO) {
        throw new Exception("Conexión DB no disponible.", 503); // Service Unavailable
    }

    switch ($method) {
        // --- OBTENER OPCIONES ---
        case 'GET':
            // Construir la consulta SELECT dinámicamente
            $selectFields = ['id'];
            foreach ($config['fields'] as $field) {
                $selectFields[] = "`" . $field . "`"; // Asegurar nombres de campo con backticks
            }
            $query = "SELECT " . implode(', ', $selectFields) . " FROM {$tableName} ORDER BY nombre ASC"; // Ordenar por nombre generalmente

            $stmt = $pdo->query($query);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // *** CORRECCIÓN CLAVE AQUÍ ***
            // Envolver el array de items dentro de la estructura estándar de respuesta
            $response = [
                'success' => true,
                'message' => 'Opciones obtenidas correctamente.',
                'data'    => $items // El array de resultados va DENTRO de la clave 'data'
            ];
            $statusCode = 200; // OK
            break;

        // --- AÑADIR NUEVA OPCIÓN ---
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);

            // Validar JSON y campo 'nombre'
            if (json_last_error() !== JSON_ERROR_NONE) { throw new Exception("Cuerpo de la petición no es JSON válido.", 400); }
            if (empty($input['nombre'])) { throw new Exception("El campo 'nombre' es obligatorio.", 400); }

            $nombre = trim($input['nombre']);
            $sqlParams = [':nombre' => $nombre];
            $sqlFields = ["`nombre`"];
            $sqlValues = [":nombre"];
            $responseData = ['nombre' => $nombre]; // Empezar a construir datos de respuesta

            // Validar y añadir color si es necesario
            if ($config['has_color']) {
                if (empty($input['color']) || !preg_match('/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/', $input['color'])) {
                     throw new Exception("El campo 'color' es obligatorio y debe tener formato #RRGGBB o #RGB.", 400);
                }
                $sqlParams[':color'] = $input['color'];
                $sqlFields[] = "`color`";
                $sqlValues[] = ":color";
                $responseData['color'] = $input['color'];
            }

            // Verificar si ya existe una opción con ese nombre
            $stmtCheck = $pdo->prepare("SELECT id FROM {$tableName} WHERE nombre = :nombre LIMIT 1");
            $stmtCheck->execute([':nombre' => $nombre]);
            if ($stmtCheck->fetch()) {
                throw new Exception("La opción '" . htmlspecialchars($nombre) . "' ya existe.", 409); // Conflict
            }

            // Construir y ejecutar INSERT
            $sql = "INSERT INTO {$tableName} (" . implode(', ', $sqlFields) . ") VALUES (" . implode(', ', $sqlValues) . ")";
            $stmt = $pdo->prepare($sql);
            $success = $stmt->execute($sqlParams);

            if ($success && $stmt->rowCount() > 0) {
                $newId = $pdo->lastInsertId();
                $responseData['id'] = (int)$newId; // Devolver ID como entero
                $response = [
                    'success' => true,
                    'message' => 'Opción añadida correctamente.',
                    'data' => $responseData // Devolver los datos del nuevo item
                ];
                $statusCode = 201; // Created
            } else {
                 $errorInfo = $stmt->errorInfo();
                 error_log("API Options POST Error DB: SQLSTATE[{$errorInfo[0]}] {$errorInfo[2]}");
                 throw new Exception("No se pudo añadir la opción en la base de datos.", 500);
            }
            break;

        // --- ELIMINAR OPCIÓN ---
        case 'DELETE':
            if (!$id || $id <= 0) {
                throw new Exception("Falta el ID de la opción a eliminar en la URL (?id=...).", 400);
            }
            $sql = "DELETE FROM {$tableName} WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $success = $stmt->execute([':id' => $id]);

            if ($success && $stmt->rowCount() > 0) {
                $response = ['success' => true, 'message' => 'Opción eliminada.'];
                $statusCode = 200; // OK
            } else if ($success) {
                 // Execute OK pero no afectó filas -> No encontrada
                 throw new Exception("Opción no encontrada (ID: " . $id . ").", 404); // Not Found
            }
            else {
                 $errorInfo = $stmt->errorInfo();
                 error_log("API Options DELETE Error DB: SQLSTATE[{$errorInfo[0]}] {$errorInfo[2]}");
                 throw new Exception("No se pudo eliminar la opción de la base de datos.", 500);
            }
            break;

        // --- MÉTODO NO SOPORTADO ---
        default:
            $response['message'] = 'Método HTTP no soportado.';
            $statusCode = 405; // Method Not Allowed
            if (!headers_sent()) { header('Allow: GET, POST, DELETE'); }
            break;
    }

} catch (\Throwable $e) { // Capturar cualquier tipo de error/excepción
    $errorMsg = $e->getMessage();
    $exceptionCode = $e->getCode();
    // Loguear error detallado en el servidor
    error_log("ERROR API Options (Type: {$type}, Method: {$method}): {$errorMsg} en " . basename($e->getFile()) . ":" . $e->getLine() . "\nTrace: " . $e->getTraceAsString());

    // Determinar código de estado HTTP (usar código de excepción si es válido, sino 500)
    $statusCode = (is_int($exceptionCode) && $exceptionCode >= 400 && $exceptionCode < 600) ? $exceptionCode : 500;

    // Preparar respuesta de error para el cliente
    $response = [
        'success' => false,
        'message' => $errorMsg, // Devolver el mensaje de error (podría ser más genérico en producción)
        'data' => null
    ];
}

// --- Enviar Respuesta Final ---
if (!headers_sent()) {
    http_response_code($statusCode);
}
// Asegurarse que la respuesta final siempre sea JSON
// JSON_UNESCAPED_UNICODE para no escapar tildes, etc. JSON_PRETTY_PRINT para desarrollo.
echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
exit; // Terminar ejecución
?>