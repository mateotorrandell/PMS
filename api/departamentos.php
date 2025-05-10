<?php
// api/departamentos.php - API para gestionar departamentos

// Activar reporte de errores para depuración
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Configuración de cabeceras
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar solicitudes OPTIONS (CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Preparar respuesta por defecto
$response = ['success' => false, 'message' => 'Solicitud no procesada', 'data' => null];
$statusCode = 400;

// --- INCLUIR Y VERIFICAR CONEXIÓN ---
try {
    require_once __DIR__ . '/../config/db_connect.php'; // Conexión PDO
    if (!isset($pdo) || !$pdo instanceof PDO) {
        throw new Exception("Variable \$pdo no definida después de incluir db_connect.php.", 500);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error crítico de configuración: ' . $e->getMessage()]);
    error_log("Error fatal en departamentos.php al incluir db_connect: " . $e->getMessage());
    exit;
}

// Determinar la acción según el método HTTP
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Obtener departamentos
            if (isset($_GET['id'])) {
                // Obtener un departamento específico
                getDepartamentoById($pdo, $_GET['id']);
            } else {
                // Obtener todos los departamentos
                getAllDepartamentos($pdo);
            }
            break;

        case 'POST':
            // Crear nuevo departamento
            createDepartamento($pdo);
            break;

        case 'PUT':
            // Actualizar departamento existente
            if (isset($_GET['id'])) {
                updateDepartamento($pdo, $_GET['id']);
            } else {
                throw new Exception('ID de departamento no especificado', 400);
            }
            break;

        case 'DELETE':
            // Eliminar departamento
            if (isset($_GET['id'])) {
                deleteDepartamento($pdo, $_GET['id']);
            } else {
                throw new Exception('ID de departamento no especificado', 400);
            }
            break;

        default:
            throw new Exception('Método no permitido', 405);
            break;
    }
} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
    $exceptionCode = $e->getCode();
    $statusCode = (is_int($exceptionCode) && $exceptionCode >= 400 && $exceptionCode < 600) ? $exceptionCode : 500;
    error_log("API Error departamentos.php: " . $e->getMessage() . " | Code: " . $e->getCode() . " | Method: " . $method);
} finally {
    if (!headers_sent()) {
        http_response_code($statusCode);
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

// Función para obtener todos los departamentos
function getAllDepartamentos($pdo) {
    global $response, $statusCode;
    
    try {
        // Consulta para obtener todos los departamentos con información del padre
        $sql = "SELECT d.*, 
                    p.nombre AS departamento_padre_nombre,
                    p.codigo AS departamento_padre_codigo
                FROM departamentos d
                LEFT JOIN departamentos p ON d.departamento_padre_id = p.id
                ORDER BY d.departamento_padre_id IS NULL DESC, d.departamento_padre_id, d.orden, d.nombre";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        
        $departamentos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Convertir tipos de datos
        foreach ($departamentos as &$dept) {
            $dept['id'] = (int)$dept['id'];
            $dept['departamento_padre_id'] = $dept['departamento_padre_id'] !== null ? (int)$dept['departamento_padre_id'] : null;
            $dept['activo'] = (bool)(int)$dept['activo'];
            $dept['orden'] = (int)$dept['orden'];
        }
        
        $response = ['success' => true, 'message' => 'Departamentos obtenidos correctamente', 'data' => $departamentos];
        $statusCode = 200;
    } catch (PDOException $e) {
        throw new Exception('Error al obtener departamentos: ' . $e->getMessage(), 500);
    }
}

// Función para obtener un departamento específico
function getDepartamentoById($pdo, $id) {
    global $response, $statusCode;
    
    try {
        // Validar ID
        $id = filter_var($id, FILTER_VALIDATE_INT);
        if ($id === false) {
            throw new Exception('ID de departamento inválido', 400);
        }
        
        // Consulta para obtener el departamento con información del padre
        $sql = "SELECT d.*, 
                    p.nombre AS departamento_padre_nombre,
                    p.codigo AS departamento_padre_codigo
                FROM departamentos d
                LEFT JOIN departamentos p ON d.departamento_padre_id = p.id
                WHERE d.id = :id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        
        $departamento = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$departamento) {
            throw new Exception('Departamento no encontrado', 404);
        }
        
        // Convertir tipos de datos
        $departamento['id'] = (int)$departamento['id'];
        $departamento['departamento_padre_id'] = $departamento['departamento_padre_id'] !== null ? (int)$departamento['departamento_padre_id'] : null;
        $departamento['activo'] = (bool)(int)$departamento['activo'];
        $departamento['orden'] = (int)$departamento['orden'];
        
        $response = ['success' => true, 'message' => 'Departamento obtenido correctamente', 'data' => $departamento];
        $statusCode = 200;
    } catch (PDOException $e) {
        throw new Exception('Error al obtener departamento: ' . $e->getMessage(), 500);
    }
}

// Función para crear un nuevo departamento
function createDepartamento($pdo) {
    global $response, $statusCode;
    
    try {
        // Obtener datos del cuerpo de la solicitud
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Error decodificando JSON: ' . json_last_error_msg(), 400);
        }
        
        // Validar datos requeridos
        if (!isset($data['codigo']) || !isset($data['nombre'])) {
            throw new Exception('Código y nombre son obligatorios', 400);
        }
        
        // Validar código (alfanumérico, máximo 10 caracteres)
        if (!preg_match('/^[A-Za-z0-9]{1,10}$/', $data['codigo'])) {
            throw new Exception('El código debe ser alfanumérico y tener máximo 10 caracteres', 400);
        }
        
        // Verificar si el código ya existe
        $checkSql = "SELECT id FROM departamentos WHERE codigo = :codigo";
        $checkStmt = $pdo->prepare($checkSql);
        $checkStmt->bindParam(':codigo', $data['codigo'], PDO::PARAM_STR);
        $checkStmt->execute();
        
        if ($checkStmt->rowCount() > 0) {
            throw new Exception('El código ya está en uso', 409);
        }
        
        // Preparar datos
        $codigo = strtoupper($data['codigo']);
        $nombre = $data['nombre'];
        $descripcion = $data['descripcion'] ?? null;
        $departamentoPadreId = !empty($data['departamento_padre_id']) ? $data['departamento_padre_id'] : null;
        $activo = isset($data['activo']) ? (bool)$data['activo'] : true;
        $orden = isset($data['orden']) ? (int)$data['orden'] : 0;
        
        // Validar departamento padre si se proporciona
        if ($departamentoPadreId !== null) {
            $checkParentSql = "SELECT id FROM departamentos WHERE id = :id";
            $checkParentStmt = $pdo->prepare($checkParentSql);
            $checkParentStmt->bindParam(':id', $departamentoPadreId, PDO::PARAM_INT);
            $checkParentStmt->execute();
            
            if ($checkParentStmt->rowCount() === 0) {
                throw new Exception('El departamento padre no existe', 400);
            }
        }
        
        // Insertar nuevo departamento
        $sql = "INSERT INTO departamentos (codigo, nombre, descripcion, departamento_padre_id, activo, orden) 
                VALUES (:codigo, :nombre, :descripcion, :departamento_padre_id, :activo, :orden)";
        
        $stmt = $pdo->prepare($sql);
        
        // Convertir valores a tipos adecuados
        $activoInt = $activo ? 1 : 0;
        
        $stmt->bindParam(':codigo', $codigo, PDO::PARAM_STR);
        $stmt->bindParam(':nombre', $nombre, PDO::PARAM_STR);
        $stmt->bindParam(':descripcion', $descripcion, PDO::PARAM_STR);
        $stmt->bindParam(':departamento_padre_id', $departamentoPadreId, $departamentoPadreId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindParam(':activo', $activoInt, PDO::PARAM_INT);
        $stmt->bindParam(':orden', $orden, PDO::PARAM_INT);
        
        if ($stmt->execute()) {
            $newId = $pdo->lastInsertId();
            
            // Obtener el departamento recién creado
            $newDepartamento = [
                'id' => (int)$newId,
                'codigo' => $codigo,
                'nombre' => $nombre,
                'descripcion' => $descripcion,
                'departamento_padre_id' => $departamentoPadreId,
                'activo' => (bool)$activoInt,
                'orden' => $orden
            ];
            
            $response = ['success' => true, 'message' => 'Departamento creado correctamente', 'data' => $newDepartamento];
            $statusCode = 201;
        } else {
            throw new Exception('Error al crear departamento: ' . implode(', ', $stmt->errorInfo()), 500);
        }
    } catch (PDOException $e) {
        throw new Exception('Error al crear departamento: ' . $e->getMessage(), 500);
    }
}

// Función para actualizar un departamento existente
function updateDepartamento($pdo, $id) {
    global $response, $statusCode;
    
    try {
        // Validar ID
        $id = filter_var($id, FILTER_VALIDATE_INT);
        if ($id === false) {
            throw new Exception('ID de departamento inválido', 400);
        }
        
        // Obtener datos del cuerpo de la solicitud
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Error decodificando JSON: ' . json_last_error_msg(), 400);
        }
        
        // Verificar si el departamento existe
        $checkSql = "SELECT id FROM departamentos WHERE id = :id";
        $checkStmt = $pdo->prepare($checkSql);
        $checkStmt->bindParam(':id', $id, PDO::PARAM_INT);
        $checkStmt->execute();
        
        if ($checkStmt->rowCount() === 0) {
            throw new Exception('Departamento no encontrado', 404);
        }
        
        // Verificar si se está intentando establecer el departamento como su propio padre
        if (isset($data['departamento_padre_id']) && $data['departamento_padre_id'] == $id) {
            throw new Exception('Un departamento no puede ser su propio padre', 400);
        }
        
        // Verificar si el código ya existe (si se está cambiando)
        if (isset($data['codigo'])) {
            // Validar código (alfanumérico, máximo 10 caracteres)
            if (!preg_match('/^[A-Za-z0-9]{1,10}$/', $data['codigo'])) {
                throw new Exception('El código debe ser alfanumérico y tener máximo 10 caracteres', 400);
            }
            
            $codigo = strtoupper($data['codigo']);
            $checkCodeSql = "SELECT id FROM departamentos WHERE codigo = :codigo AND id != :id";
            $checkCodeStmt = $pdo->prepare($checkCodeSql);
            $checkCodeStmt->bindParam(':codigo', $codigo, PDO::PARAM_STR);
            $checkCodeStmt->bindParam(':id', $id, PDO::PARAM_INT);
            $checkCodeStmt->execute();
            
            if ($checkCodeStmt->rowCount() > 0) {
                throw new Exception('El código ya está en uso por otro departamento', 409);
            }
        }
        
        // Validar departamento padre si se proporciona
        if (isset($data['departamento_padre_id']) && $data['departamento_padre_id'] !== null) {
            $departamentoPadreId = $data['departamento_padre_id'];
            $checkParentSql = "SELECT id FROM departamentos WHERE id = :id";
            $checkParentStmt = $pdo->prepare($checkParentSql);
            $checkParentStmt->bindParam(':id', $departamentoPadreId, PDO::PARAM_INT);
            $checkParentStmt->execute();
            
            if ($checkParentStmt->rowCount() === 0) {
                throw new Exception('El departamento padre no existe', 400);
            }
            
            // Verificar que no se cree un ciclo en la jerarquía
            if (!verificarCicloJerarquia($pdo, $id, $departamentoPadreId)) {
                throw new Exception('La operación crearía un ciclo en la jerarquía de departamentos', 400);
            }
        }
        
        // Construir consulta dinámica para actualizar solo los campos proporcionados
        $updateFields = [];
        $params = [];
        
        if (isset($data['codigo'])) {
            $updateFields[] = 'codigo = :codigo';
            $params[':codigo'] = strtoupper($data['codigo']);
        }
        
        if (isset($data['nombre'])) {
            $updateFields[] = 'nombre = :nombre';
            $params[':nombre'] = $data['nombre'];
        }
        
        if (array_key_exists('descripcion', $data)) {
            $updateFields[] = 'descripcion = :descripcion';
            $params[':descripcion'] = $data['descripcion'];
        }
        
        if (array_key_exists('departamento_padre_id', $data)) {
            $updateFields[] = 'departamento_padre_id = :departamento_padre_id';
            $params[':departamento_padre_id'] = $data['departamento_padre_id'] !== null ? $data['departamento_padre_id'] : null;
        }
        
        if (isset($data['activo'])) {
            $updateFields[] = 'activo = :activo';
            $params[':activo'] = (bool)$data['activo'] ? 1 : 0;
        }
        
        if (isset($data['orden'])) {
            $updateFields[] = 'orden = :orden';
            $params[':orden'] = (int)$data['orden'];
        }
        
        // Si no hay campos para actualizar
        if (empty($updateFields)) {
            throw new Exception('No se proporcionaron campos para actualizar', 400);
        }
        
        // Añadir ID al final de los parámetros
        $params[':id'] = $id;
        
        // Construir consulta SQL
        $sql = "UPDATE departamentos SET " . implode(', ', $updateFields) . " WHERE id = :id";
        
        // Preparar y ejecutar la consulta
        $stmt = $pdo->prepare($sql);
        
        // Vincular parámetros
        foreach ($params as $param => $value) {
            $type = PDO::PARAM_STR;
            if (is_int($value)) {
                $type = PDO::PARAM_INT;
            } elseif (is_null($value)) {
                $type = PDO::PARAM_NULL;
            } elseif (is_bool($value)) {
                $type = PDO::PARAM_BOOL;
            }
            $stmt->bindValue($param, $value, $type);
        }
        
        if ($stmt->execute()) {
            // Obtener el departamento actualizado
            $getDeptSql = "SELECT * FROM departamentos WHERE id = :id";
            $getDeptStmt = $pdo->prepare($getDeptSql);
            $getDeptStmt->bindParam(':id', $id, PDO::PARAM_INT);
            $getDeptStmt->execute();
            $departamento = $getDeptStmt->fetch(PDO::FETCH_ASSOC);
            
            // Convertir tipos de datos
            $departamento['id'] = (int)$departamento['id'];
            $departamento['departamento_padre_id'] = $departamento['departamento_padre_id'] !== null ? (int)$departamento['departamento_padre_id'] : null;
            $departamento['activo'] = (bool)(int)$departamento['activo'];
            $departamento['orden'] = (int)$departamento['orden'];
            
            $response = ['success' => true, 'message' => 'Departamento actualizado correctamente', 'data' => $departamento];
            $statusCode = 200;
        } else {
            throw new Exception('Error al actualizar departamento: ' . implode(', ', $stmt->errorInfo()), 500);
        }
    } catch (PDOException $e) {
        throw new Exception('Error al actualizar departamento: ' . $e->getMessage(), 500);
    }
}

// Función para eliminar un departamento
function deleteDepartamento($pdo, $id) {
    global $response, $statusCode;
    
    try {
        // Validar ID
        $id = filter_var($id, FILTER_VALIDATE_INT);
        if ($id === false) {
            throw new Exception('ID de departamento inválido', 400);
        }
        
        // Verificar si el departamento existe
        $checkSql = "SELECT id FROM departamentos WHERE id = :id";
        $checkStmt = $pdo->prepare($checkSql);
        $checkStmt->bindParam(':id', $id, PDO::PARAM_INT);
        $checkStmt->execute();
        
        if ($checkStmt->rowCount() === 0) {
            throw new Exception('Departamento no encontrado', 404);
        }
        
        // Verificar si tiene departamentos hijos
        $checkChildrenSql = "SELECT id FROM departamentos WHERE departamento_padre_id = :id";
        $checkChildrenStmt = $pdo->prepare($checkChildrenSql);
        $checkChildrenStmt->bindParam(':id', $id, PDO::PARAM_INT);
        $checkChildrenStmt->execute();
        
        if ($checkChildrenStmt->rowCount() > 0) {
            throw new Exception('No se puede eliminar el departamento porque tiene departamentos hijos', 409);
        }
        
        // Verificar si está siendo utilizado en otras tablas (ejemplo)
        // Aquí deberías añadir verificaciones para otras tablas que puedan referenciar a este departamento
        
        // Eliminar departamento
        $sql = "DELETE FROM departamentos WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        
        if ($stmt->execute()) {
            if ($stmt->rowCount() > 0) {
                $response = ['success' => true, 'message' => 'Departamento eliminado correctamente'];
                $statusCode = 200;
            } else {
                throw new Exception('No se pudo eliminar el departamento', 500);
            }
        } else {
            throw new Exception('Error al eliminar departamento: ' . implode(', ', $stmt->errorInfo()), 500);
        }
    } catch (PDOException $e) {
        throw new Exception('Error al eliminar departamento: ' . $e->getMessage(), 500);
    }
}

// Función para verificar que no se cree un ciclo en la jerarquía
function verificarCicloJerarquia($pdo, $departamentoId, $nuevoPadreId) {
    try {
        // Si el nuevo padre es null, no hay ciclo
        if ($nuevoPadreId === null) {
            return true;
        }
        
        // Si el departamento y el nuevo padre son iguales, hay ciclo
        if ($departamentoId == $nuevoPadreId) {
            return false;
        }
        
        // Verificar si el departamento es padre del nuevo padre (o de algún ancestro)
        $ancestroId = $nuevoPadreId;
        $visitados = [$departamentoId];
        
        while ($ancestroId !== null) {
            // Si encontramos el departamento en la cadena de ancestros, hay ciclo
            if (in_array($ancestroId, $visitados)) {
                return false;
            }
            
            // Obtener el padre del ancestro actual
            $sql = "SELECT departamento_padre_id FROM departamentos WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':id', $ancestroId, PDO::PARAM_INT);
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$result) {
                // El ancestro no existe, no hay ciclo
                return true;
            }
            
            $ancestroId = $result['departamento_padre_id'];
            
            // Si llegamos a un nodo raíz, no hay ciclo
            if ($ancestroId === null) {
                return true;
            }
            
            // Añadir el ancestro a los visitados
            $visitados[] = $ancestroId;
        }
        
        return true;
    } catch (PDOException $e) {
        // En caso de error, asumimos que hay ciclo para prevenir problemas
        error_log("Error en verificarCicloJerarquia: " . $e->getMessage());
        return false;
    }
}

exit;
?>
