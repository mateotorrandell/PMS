<?php
// config/db_connect.php

// --- Configuración de la Base de Datos ---
// !! Reemplaza estos valores con tus credenciales reales !!
define('DB_HOST', 'localhost:3306');     // O la IP/hostname de tu servidor de BD
define('DB_NAME', 'pms_arete'); // El nombre de tu base de datos
define('DB_USER', 'admin_pms');  // Usuario de la base de datos
define('DB_PASS', 'Arete//pms//'); // Contraseña del usuario
define('DB_CHARSET', 'utf8mb4');
// *** BLOQUE DE TEST TEMPORAL ***
if (!defined('DB_CHARSET')) {
    die("ERROR INTERNO: DB_CHARSET NO ESTA DEFINIDA DESPUES DE SU LINEA!");
}
// *** FIN BLOQUE TEST ***

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

$dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4"; // Usar el valor directamente

try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (\PDOException $e) {
    // Loguea el error (si es posible)
    error_log("Error de conexión a la base de datos: " . $e->getMessage());

    // Respuesta de error genérica para la API
    http_response_code(500);
    // Asegurarse que no haya salida previa antes de header()
    if (!headers_sent()) {
         header('Content-Type: application/json');
    }
    // Detener ejecución y mostrar error JSON
    // Usar die() o exit() es crucial aquí
    die(json_encode([
        'success' => false,
        'message' => 'Error interno del servidor: No se pudo conectar a la base de datos.'
    ]));
}
// $pdo queda disponible si la conexión fue exitosa
?>
