<?php
// api/reservations.php
// VERSIÓN COMPLETA CON GET, POST, PUT implementados

ini_set('display_errors', 1);
error_reporting(E_ALL);

// --- INCLUIR Y VERIFICAR CONEXIÓN ---
try {
    require_once __DIR__ . '/../config/db_connect.php'; // Conexión PDO
    if (!isset($pdo) || !$pdo instanceof PDO) {
        throw new Exception("Variable \$pdo no definida después de incluir db_connect.php.", 500);
    }
} catch (\Throwable $e) {
    http_response_code(500); header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Error crítico de configuración: ' . $e->getMessage()]);
    error_log("Error fatal en reservations.php al incluir db_connect: " . $e->getMessage()); exit;
}


$response = ['success' => false, 'message' => 'Solicitud no procesada', 'data' => null];
$statusCode = 400;

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

$method = $_SERVER['REQUEST_METHOD'];
define('DEFAULT_ESTADO_ID', 7); // ID correcto para 'Pendiente'

// --- Funciones Auxiliares ---
function generarNumeroReserva(PDO $pdo): string { /* ... (Sin cambios aquí, como en la versión anterior) ... */
    $anioActual = date('Y'); $numeroSecuencial = 0;
    try {
        $pdo->beginTransaction();
        $stmtSelect = $pdo->prepare("SELECT ultimo_numero FROM reserva_secuencia WHERE anio = :anio FOR UPDATE");
        $stmtSelect->execute([':anio' => $anioActual]); $row = $stmtSelect->fetch(PDO::FETCH_ASSOC);
        if ($row) { $numeroSecuencial = $row['ultimo_numero'] + 1; }
        else { $numeroSecuencial = 1;
            $stmtInsert = $pdo->prepare("INSERT INTO reserva_secuencia (anio, ultimo_numero) VALUES (:anio, 0)");
             try { $stmtInsert->execute([':anio' => $anioActual]); }
             catch (PDOException $e) { if ($e->errorInfo[1] == 1062) { $stmtSelect->execute([':anio' => $anioActual]); $row = $stmtSelect->fetch(PDO::FETCH_ASSOC); if ($row) { $numeroSecuencial = $row['ultimo_numero'] + 1; } else { throw new Exception("Error concurrencia reserva.", 500); }} else { throw $e; }}}
        $stmtUpdate = $pdo->prepare("UPDATE reserva_secuencia SET ultimo_numero = :nuevo_numero WHERE anio = :anio");
        $stmtUpdate->execute([':nuevo_numero' => $numeroSecuencial, ':anio' => $anioActual]);
        $pdo->commit();
        return $anioActual . '-' . str_pad($numeroSecuencial, 8, '0', STR_PAD_LEFT);
    } catch (Exception $e) { if ($pdo->inTransaction()) { $pdo->rollBack(); } error_log("Error generando numero_reserva: " . $e->getMessage()); throw new Exception("No se pudo generar el número de reserva.", 500); }
}

function verificarConflicto(PDO $pdo, int $habitacionId, string $fechaIngreso, string $fechaSalida, ?int $excluirReservaId = null): bool { /* ... (Sin cambios aquí, como en la versión anterior con logging) ... */
    $sql = "SELECT COUNT(*) as count FROM reservas WHERE habitacion_id = :habitacion_id AND fecha_ingreso < :fecha_salida AND fecha_salida > :fecha_ingreso";
    if ($excluirReservaId !== null) { $sql .= " AND id != :excluir_id"; $params = [':habitacion_id'=>$habitacionId, ':fecha_ingreso'=>$fechaIngreso, ':fecha_salida'=>$fechaSalida, ':excluir_id'=>$excluirReservaId]; }
    else { $params = [':habitacion_id'=>$habitacionId, ':fecha_ingreso'=>$fechaIngreso, ':fecha_salida'=>$fechaSalida]; }
    $stmt = $pdo->prepare($sql);
    // error_log("--- DEBUG VERIFICAR CONFLICTO ---"); error_log("SQL CONFLICT CHECK: " . $sql); error_log("PARAMS CONFLICT CHECK: " . print_r($params, true)); // Mantener logs si aún depuras
    $stmt->execute($params); $result = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($result === false) { $errorInfo = $stmt->errorInfo(); error_log("Error fetch en verificarConflicto: SQLSTATE[{$errorInfo[0]}] {$errorInfo[2]}"); return true; } // Asumir conflicto si falla
    return ($result['count'] > 0);
}

// --- Procesamiento de Solicitudes ---
try {

    // === METODO GET ===
    if ($method === 'GET') {
        if (isset($_GET['id'])) { // Obtener UNA reserva por ID
             $reservaId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]);
             if ($reservaId === false || $reservaId === null) { throw new Exception("ID reserva inválido.", 400); }
             // Incluir todos los campos necesarios para poblar el formulario de edición
             $sql = "SELECT r.*, e.nombre AS estado_nombre, e.color AS estado_color
                     FROM reservas r
                     LEFT JOIN estados_reserva e ON r.estado_id = e.id
                     WHERE r.id = :id";
             $stmt = $pdo->prepare($sql); $stmt->execute([':id' => $reservaId]); $reserva = $stmt->fetch(PDO::FETCH_ASSOC);
             if ($reserva) { /* Convertir tipos */
                $reserva['id']=(int)$reserva['id']; $reserva['habitacion_id']=(int)$reserva['habitacion_id']; $reserva['estado_id']=(int)$reserva['estado_id']; $reserva['adultos']=(int)$reserva['adultos']; $reserva['menores']=(int)$reserva['menores'];
                if($reserva['precio_total']!==null){$reserva['precio_total']=(float)$reserva['precio_total'];} if($reserva['tipo_venta_id']!==null){$reserva['tipo_venta_id']=(int)$reserva['tipo_venta_id'];} if($reserva['canal_venta_id']!==null){$reserva['canal_venta_id']=(int)$reserva['canal_venta_id'];}
                 // Asegurar que campos NULL de DB sean realmente null y no string vacíos en PHP fetch
                 foreach ($reserva as $key => $value) { if ($value === '') $reserva[$key] = null; }
                 $response = ['success' => true, 'message' => 'Reserva encontrada.', 'data' => $reserva]; $statusCode = 200;
             } else { throw new Exception("Reserva no encontrada.", 404); }
        } else if (isset($_GET['startDate']) && isset($_GET['endDate'])) { // Obtener RANGO para Gantt
            $startDate = $_GET['startDate']; $endDate = $_GET['endDate'];
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) { throw new Exception("Formato fecha inválido.", 400); }
            if ($endDate < $startDate) { throw new Exception("Fecha fin anterior a inicio.", 400); }
            $sql = "SELECT r.id, r.numero_reserva, r.habitacion_id, r.fecha_ingreso, r.fecha_salida, r.huesped_nombre, r.huesped_apellido, r.estado_id, e.nombre AS estado_nombre, e.color AS estado_color FROM reservas r JOIN estados_reserva e ON r.estado_id = e.id WHERE r.fecha_ingreso <= :endDate AND r.fecha_salida > :startDate ORDER BY r.habitacion_id, r.fecha_ingreso";
            $stmt = $pdo->prepare($sql); $stmt->execute([':startDate' => $startDate, ':endDate' => $endDate]); $reservas = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach($reservas as &$res){$res['id']=(int)$res['id'];$res['habitacion_id']=(int)$res['habitacion_id'];$res['estado_id']=(int)$res['estado_id'];}unset($res);
            $response = ['success' => true, 'message' => 'Reservas obtenidas.', 'data' => $reservas]; $statusCode = 200;
        } else { throw new Exception("Faltan parámetros para GET.", 400); }

    // === METODO POST ===
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) { throw new Exception("Error decodificando JSON: " . json_last_error_msg(), 400); }
        if ($input === null || !is_array($input)) { throw new Exception("Entrada JSON inválida.", 400); }
        $required_fields = ['habitacion_id', 'fecha_ingreso', 'fecha_salida', 'huesped_nombre', 'estado_id']; // Añadir estado_id como obligatorio
        foreach ($required_fields as $field) { if (empty($input[$field])) { throw new Exception("Falta campo: '$field'.", 400); } }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['fecha_ingreso']) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['fecha_salida'])) { throw new Exception("Formato fecha.", 400); }
        if ($input['fecha_salida'] <= $input['fecha_ingreso']) { throw new Exception("Salida <= Ingreso.", 400); }
        $habitacionId = filter_var($input['habitacion_id'], FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]); $estadoId = filter_var($input['estado_id'] ?? DEFAULT_ESTADO_ID, FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]); $adultos = filter_var($input['adultos'] ?? 1, FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]); $menores = filter_var($input['menores'] ?? 0, FILTER_VALIDATE_INT, ["options" => ["min_range"=>0]]); $tipoVentaId = isset($input['tipo_venta_id']) && $input['tipo_venta_id'] !== '' ? filter_var($input['tipo_venta_id'], FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]) : null; $canalVentaId = isset($input['canal_venta_id']) && $input['canal_venta_id'] !== '' ? filter_var($input['canal_venta_id'], FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]) : null; $precioTotal = isset($input['precio_total']) && is_numeric($input['precio_total']) ? filter_var($input['precio_total'], FILTER_VALIDATE_FLOAT, ['flags' => FILTER_FLAG_ALLOW_FRACTION]) : null;
        if ($habitacionId===false || $estadoId===false || $adultos===false || $menores===false || (isset($input['tipo_venta_id'])&&$input['tipo_venta_id']!==''&&$tipoVentaId===false) || (isset($input['canal_venta_id'])&&$input['canal_venta_id']!==''&&$canalVentaId===false) || (isset($input['precio_total'])&&$input['precio_total']!==''&&$precioTotal===false) ){ throw new Exception("Valor numérico inválido.", 400); }
        if (verificarConflicto($pdo, $habitacionId, $input['fecha_ingreso'], $input['fecha_salida'], null)) { throw new Exception("Conflicto de fechas.", 409); }
        $numeroReserva = generarNumeroReserva($pdo);
        $sql = "INSERT INTO reservas (numero_reserva, habitacion_id, fecha_ingreso, hora_ingreso, fecha_salida, hora_salida, estado_id, huesped_nombre, huesped_apellido, huesped_email, huesped_telefono, adultos, menores, precio_total, tipo_venta_id, canal_venta_id, comentario, patente) VALUES (:numero_reserva, :habitacion_id, :fecha_ingreso, :hora_ingreso, :fecha_salida, :hora_salida, :estado_id, :huesped_nombre, :huesped_apellido, :huesped_email, :huesped_telefono, :adultos, :menores, :precio_total, :tipo_venta_id, :canal_venta_id, :comentario, :patente)";
        $stmt = $pdo->prepare($sql);
        $params = [ /* ... (igual que antes) ... */
            ':numero_reserva' => $numeroReserva, ':habitacion_id' => $habitacionId, ':fecha_ingreso' => $input['fecha_ingreso'], ':hora_ingreso' => $input['hora_ingreso'] ?? '14:00:00', ':fecha_salida' => $input['fecha_salida'], ':hora_salida' => $input['hora_salida'] ?? '11:00:00', ':estado_id' => $estadoId, ':huesped_nombre' => trim($input['huesped_nombre']), ':huesped_apellido' => isset($input['huesped_apellido']) ? trim($input['huesped_apellido']) : null, ':huesped_email' => isset($input['huesped_email']) && !empty($input['huesped_email']) ? trim($input['huesped_email']) : null, ':huesped_telefono' => isset($input['huesped_telefono']) ? trim($input['huesped_telefono']) : null, ':adultos' => $adultos, ':menores' => $menores, ':precio_total' => ($precioTotal !== false && $precioTotal !== null) ? $precioTotal : null, ':tipo_venta_id' => ($tipoVentaId !== false) ? $tipoVentaId : null, ':canal_venta_id' => ($canalVentaId !== false) ? $canalVentaId : null, ':comentario' => isset($input['comentario']) ? trim($input['comentario']) : null, ':patente' => isset($input['patente']) ? trim($input['patente']) : null,
        ];
        $success = $stmt->execute($params);
        if ($success) { $newId = $pdo->lastInsertId(); $response = ['success' => true, 'message' => 'Reserva creada.', 'data' => ['id' => (int)$newId, 'numero_reserva' => $numeroReserva]]; $statusCode = 201; }
        else { $errorInfo = $stmt->errorInfo(); error_log("Error DB INSERT: SQLSTATE[{$errorInfo[0]}] {$errorInfo[2]}"); throw new Exception("No se pudo guardar. SQLSTATE[{$errorInfo[0]}]", 500); }

    // === METODO PUT: Actualizar Reserva (Implementado) ===
    } elseif ($method === 'PUT') {
        $reservaId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]);
        if ($reservaId === false || $reservaId === null) { throw new Exception("Falta ID reserva a actualizar.", 400); }
        $input = json_decode(file_get_contents('php://input'), true);
        if (json_last_error() !== JSON_ERROR_NONE) { throw new Exception("JSON inválido.", 400); }
        if ($input === null || !is_array($input)) { throw new Exception("Cuerpo JSON vacío/inválido.", 400); }
        $required_fields = ['habitacion_id', 'fecha_ingreso', 'fecha_salida', 'huesped_nombre', 'estado_id'];
        foreach ($required_fields as $field) { if (empty($input[$field])) { throw new Exception("Falta campo (update): '$field'.", 400); } }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['fecha_ingreso']) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['fecha_salida'])) { throw new Exception("Formato fecha.", 400); }
        if ($input['fecha_salida'] <= $input['fecha_ingreso']) { throw new Exception("Salida <= Ingreso.", 400); }
        $habitacionId = filter_var($input['habitacion_id'], FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]); $estadoId = filter_var($input['estado_id'] ?? DEFAULT_ESTADO_ID, FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]); $adultos = filter_var($input['adultos'] ?? 1, FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]); $menores = filter_var($input['menores'] ?? 0, FILTER_VALIDATE_INT, ["options" => ["min_range"=>0]]); $tipoVentaId = isset($input['tipo_venta_id']) && $input['tipo_venta_id'] !== '' ? filter_var($input['tipo_venta_id'], FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]) : null; $canalVentaId = isset($input['canal_venta_id']) && $input['canal_venta_id'] !== '' ? filter_var($input['canal_venta_id'], FILTER_VALIDATE_INT, ["options" => ["min_range"=>1]]) : null; $precioTotal = isset($input['precio_total']) && is_numeric($input['precio_total']) ? filter_var($input['precio_total'], FILTER_VALIDATE_FLOAT, ['flags' => FILTER_FLAG_ALLOW_FRACTION]) : null;
        if ($habitacionId===false || $estadoId===false || $adultos===false || $menores===false || (isset($input['tipo_venta_id'])&&$input['tipo_venta_id']!==''&&$tipoVentaId===false) || (isset($input['canal_venta_id'])&&$input['canal_venta_id']!==''&&$canalVentaId===false) || (isset($input['precio_total'])&&$input['precio_total']!==''&&$precioTotal===false) ){ throw new Exception("Valor numérico inválido (update).", 400); }

        // *** Verificar conflicto EXCLUYENDO ID actual ***
        if (verificarConflicto($pdo, $habitacionId, $input['fecha_ingreso'], $input['fecha_salida'], $reservaId)) {
            throw new Exception("Conflicto de fechas: El cambio se solapa con otra reserva.", 409);
        }

        $sql = "UPDATE reservas SET habitacion_id=:habitacion_id, fecha_ingreso=:fecha_ingreso, hora_ingreso=:hora_ingreso, fecha_salida=:fecha_salida, hora_salida=:hora_salida, estado_id=:estado_id, huesped_nombre=:huesped_nombre, huesped_apellido=:huesped_apellido, huesped_email=:huesped_email, huesped_telefono=:huesped_telefono, adultos=:adultos, menores=:menores, precio_total=:precio_total, tipo_venta_id=:tipo_venta_id, canal_venta_id=:canal_venta_id, comentario=:comentario, patente=:patente WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $params = [ /* ... (igual que POST pero con :id al final) ... */
            ':habitacion_id' => $habitacionId, ':fecha_ingreso' => $input['fecha_ingreso'], ':hora_ingreso' => $input['hora_ingreso'] ?? '14:00:00', ':fecha_salida' => $input['fecha_salida'], ':hora_salida' => $input['hora_salida'] ?? '11:00:00', ':estado_id' => $estadoId, ':huesped_nombre' => trim($input['huesped_nombre']), ':huesped_apellido' => isset($input['huesped_apellido']) ? trim($input['huesped_apellido']) : null, ':huesped_email' => isset($input['huesped_email']) && !empty($input['huesped_email']) ? filter_var(trim($input['huesped_email']), FILTER_VALIDATE_EMAIL) : null, ':huesped_telefono' => isset($input['huesped_telefono']) ? trim($input['huesped_telefono']) : null, ':adultos' => $adultos, ':menores' => $menores, ':precio_total' => ($precioTotal !== false && $precioTotal !== null) ? $precioTotal : null, ':tipo_venta_id' => ($tipoVentaId !== false) ? $tipoVentaId : null, ':canal_venta_id' => ($canalVentaId !== false) ? $canalVentaId : null, ':comentario' => isset($input['comentario']) ? trim($input['comentario']) : null, ':patente' => isset($input['patente']) ? trim($input['patente']) : null,
            ':id' => $reservaId // ID para el WHERE
        ];
        if ($params[':huesped_email'] === false) $params[':huesped_email'] = null; // Corregir email inválido a null

        $success = $stmt->execute($params);
        if ($success) { $response = ['success' => true, 'message' => 'Reserva actualizada.']; $statusCode = 200; }
        else { $errorInfo = $stmt->errorInfo(); error_log("Error DB UPDATE ID {$reservaId}: SQLSTATE[{$errorInfo[0]}] {$errorInfo[2]}"); throw new Exception("No se pudo actualizar. SQLSTATE[{$errorInfo[0]}]", 500); }


    // === DELETE (Esqueleto) ===
    } elseif ($method === 'DELETE') { throw new Exception("Método DELETE no implementado.", 501); }
    else { throw new Exception("Método HTTP no soportado.", 405); }

} catch (Exception $e) { // Manejo de errores general
    error_log("API Error reservations.php: " . $e->getMessage() . " | Code: " . $e->getCode() . " | Method: " . $method . " | Trace: " . $e->getTraceAsString());
    $response['success'] = false; $response['message'] = $e->getMessage(); $response['data'] = null;
    $exceptionCode = $e->getCode(); $statusCode = (is_int($exceptionCode) && $exceptionCode >= 400 && $exceptionCode < 600) ? $exceptionCode : 500;
} finally { if (!headers_sent()) { http_response_code($statusCode); } echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT); }
exit;
?>