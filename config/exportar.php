<?php

// 1. Incluir tu archivo de conexión PDO
// Esto asume que db_connect.php define $pdo (el objeto de conexión PDO)
// y la constante DB_NAME.
require_once 'db_connect.php'; //

// Verificar que la conexión PDO y DB_NAME existan
if (!isset($pdo) || !($pdo instanceof PDO)) {
    die("El archivo db_connect.php no estableció una conexión PDO válida en la variable \$pdo.");
}
if (!defined('DB_NAME') || empty(DB_NAME)) {
    die("El archivo db_connect.php no definió la constante DB_NAME con el nombre de la base de datos.");
}

// PDO ya maneja el charset a través del DSN y las excepciones para errores de conexión,
// por lo que no es necesario verificar $pdo->connect_error o set_charset explícitamente aquí
// si db_connect.php está configurado correctamente como el tuyo.

$output = "";
$dbname = DB_NAME; // Usar la constante definida en tu archivo

// 2. Obtener la sentencia CREATE DATABASE
// Con PDO, las consultas SHOW pueden no devolver rowCount() de forma fiable,
// así que verificaremos si fetch() devuelve algo.
try {
    $stmtShowCreateDb = $pdo->query("SHOW CREATE DATABASE `{$dbname}`");
    $rowCreateDb = $stmtShowCreateDb->fetch(PDO::FETCH_ASSOC);

    if ($rowCreateDb) {
        $output .= "-- --------------------------------------------------------\n";
        $output .= "-- Estructura de la base de datos `{$dbname}`\n";
        $output .= "-- --------------------------------------------------------\n";
        // Asegurarse de que el nombre de la base de datos en la sentencia CREATE sea el correcto
        $create_db_statement = preg_replace('/CREATE DATABASE `[^`]+`/i', 'CREATE DATABASE `'.$dbname.'`', $rowCreateDb['Create Database'], 1);
        $output .= $create_db_statement . ";\n\n";
        $output .= "USE `{$dbname}`;\n\n";
    } else {
        $output .= "-- No se pudo obtener la información de creación para la base de datos `{$dbname}`.\n";
        $output .= "-- Asegúrate de que el usuario tiene los permisos necesarios y que la base de datos existe.\n\n";
    }
    if ($stmtShowCreateDb) {
        $stmtShowCreateDb->closeCursor();
    }
} catch (PDOException $e) {
    $output .= "-- Error al obtener la estructura de la base de datos: " . $e->getMessage() . "\n\n";
}

// 3. Obtener todas las tablas de la base de datos
try {
    $stmtShowTables = $pdo->query("SHOW TABLES FROM `{$dbname}`");
    $tables = $stmtShowTables->fetchAll(PDO::FETCH_NUM);
    $stmtShowTables->closeCursor();

    if (count($tables) > 0) {
        $output .= "-- --------------------------------------------------------\n";
        $output .= "-- Estructura de las tablas\n";
        $output .= "-- --------------------------------------------------------\n\n";

        foreach ($tables as $tableRow) {
            $tableName = $tableRow[0];

            try {
                $stmtShowCreateTable = $pdo->query("SHOW CREATE TABLE `{$dbname}`.`{$tableName}`");
                $createTableRow = $stmtShowCreateTable->fetch(PDO::FETCH_ASSOC);
                $stmtShowCreateTable->closeCursor();

                if ($createTableRow) {
                    $output .= "--\n";
                    $output .= "-- Estructura de tabla para la tabla `{$tableName}`\n";
                    $output .= "--\n\n";
                    $output .= $createTableRow['Create Table'] . ";\n\n";
                } else {
                    $output .= "-- No se pudo obtener la información de creación para la tabla `{$tableName}`.\n\n";
                }
            } catch (PDOException $e) {
                $output .= "-- Error al obtener la estructura de la tabla `{$tableName}`: " . $e->getMessage() . "\n\n";
            }
        }
    } else {
        $output .= "-- No se encontraron tablas en la base de datos `{$dbname}`.\n\n";
    }
} catch (PDOException $e) {
    $output .= "-- Error al obtener la lista de tablas: " . $e->getMessage() . "\n\n";
}


// 4. (Opcional) Obtener la estructura de Vistas, Procedimientos Almacenados y Funciones

// Obtener Vistas
try {
    $stmtShowViews = $pdo->query("SHOW FULL TABLES IN `{$dbname}` WHERE TABLE_TYPE LIKE 'VIEW'");
    $views = $stmtShowViews->fetchAll(PDO::FETCH_ASSOC);
    $stmtShowViews->closeCursor();

    if (count($views) > 0) {
        $output .= "-- --------------------------------------------------------\n";
        $output .= "-- Estructura de las Vistas\n";
        $output .= "-- --------------------------------------------------------\n\n";
        foreach ($views as $viewRow) {
            $viewName = $viewRow['Tables_in_'.$dbname]; // El nombre de la columna es 'Tables_in_NOMBREDATOS'
            try {
                $stmtShowCreateView = $pdo->query("SHOW CREATE VIEW `{$dbname}`.`{$viewName}`");
                $createViewRow = $stmtShowCreateView->fetch(PDO::FETCH_ASSOC);
                $stmtShowCreateView->closeCursor();

                if ($createViewRow) {
                    $output .= "--\n";
                    $output .= "-- Estructura de vista para la vista `{$viewName}`\n";
                    $output .= "--\n\n";
                    $output .= $createViewRow['Create View'] . ";\n\n";
                } else {
                     $output .= "-- No se pudo obtener la información de creación para la vista `{$viewName}`.\n\n";
                }
            } catch (PDOException $e) {
                 $output .= "-- Error al obtener la estructura de la vista `{$viewName}`: " . $e->getMessage() . "\n\n";
            }
        }
    }
} catch (PDOException $e) {
    $output .= "-- Error al intentar obtener vistas: " . $e->getMessage() . "\n\n";
}

// Obtener Procedimientos Almacenados
try {
    $stmtShowProcedures = $pdo->query("SHOW PROCEDURE STATUS WHERE Db = '{$dbname}'");
    $procedures = $stmtShowProcedures->fetchAll(PDO::FETCH_ASSOC);
    $stmtShowProcedures->closeCursor();

    if (count($procedures) > 0) {
        $output .= "-- --------------------------------------------------------\n";
        $output .= "-- Estructura de los Procedimientos Almacenados\n";
        $output .= "-- --------------------------------------------------------\n\n";
        foreach ($procedures as $procedureRow) {
            $procedureName = $procedureRow['Name'];
            try {
                $stmtShowCreateProcedure = $pdo->query("SHOW CREATE PROCEDURE `{$dbname}`.`{$procedureName}`");
                $createProcedureRow = $stmtShowCreateProcedure->fetch(PDO::FETCH_ASSOC);
                $stmtShowCreateProcedure->closeCursor();

                if ($createProcedureRow) {
                    $output .= "--\n";
                    $output .= "-- Estructura de procedimiento para el procedimiento `{$procedureName}`\n";
                    $output .= "--\n\n";
                    $create_statement_key = isset($createProcedureRow['Create Procedure']) ? 'Create Procedure' : (isset($createProcedureRow['SQL Original Statement']) ? 'SQL Original Statement' : null);
                    if ($create_statement_key) {
                        $output .= $createProcedureRow[$create_statement_key] . ";\n\n";
                    } else {
                         $output .= "-- No se encontró la clave 'Create Procedure' o 'SQL Original Statement' para el procedimiento `{$procedureName}`.\n\n";
                    }
                } else {
                    $output .= "-- No se pudo obtener la información de creación para el procedimiento `{$procedureName}`.\n\n";
                }
            } catch (PDOException $e) {
                $output .= "-- Error al obtener la estructura del procedimiento `{$procedureName}`: " . $e->getMessage() . "\n\n";
            }
        }
    }
} catch (PDOException $e) {
     $output .= "-- Error al intentar obtener procedimientos: " . $e->getMessage() . "\n\n";
}

// Obtener Funciones Almacenadas
try {
    $stmtShowFunctions = $pdo->query("SHOW FUNCTION STATUS WHERE Db = '{$dbname}'");
    $functions = $stmtShowFunctions->fetchAll(PDO::FETCH_ASSOC);
    $stmtShowFunctions->closeCursor();

    if (count($functions) > 0) {
        $output .= "-- --------------------------------------------------------\n";
        $output .= "-- Estructura de las Funciones Almacenadas\n";
        $output .= "-- --------------------------------------------------------\n\n";
        foreach ($functions as $functionRow) {
            $functionName = $functionRow['Name'];
            try {
                $stmtShowCreateFunction = $pdo->query("SHOW CREATE FUNCTION `{$dbname}`.`{$functionName}`");
                $createFunctionRow = $stmtShowCreateFunction->fetch(PDO::FETCH_ASSOC);
                $stmtShowCreateFunction->closeCursor();

                if ($createFunctionRow) {
                    $output .= "--\n";
                    $output .= "-- Estructura de función para la función `{$functionName}`\n";
                    $output .= "--\n\n";
                    $create_statement_key = isset($createFunctionRow['Create Function']) ? 'Create Function' : (isset($createFunctionRow['SQL Original Statement']) ? 'SQL Original Statement' : null);
                    if ($create_statement_key) {
                         $output .= $createFunctionRow[$create_statement_key] . ";\n\n";
                    } else {
                         $output .= "-- No se encontró la clave 'Create Function' o 'SQL Original Statement' para la función `{$functionName}`.\n\n";
                    }
                } else {
                     $output .= "-- No se pudo obtener la información de creación para la función `{$functionName}`.\n\n";
                }
            } catch (PDOException $e) {
                 $output .= "-- Error al obtener la estructura de la función `{$functionName}`: " . $e->getMessage() . "\n\n";
            }
        }
    }
} catch (PDOException $e) {
    $output .= "-- Error al intentar obtener funciones: " . $e->getMessage() . "\n\n";
}


// El objeto PDO se destruirá y la conexión se cerrará automáticamente cuando el script termine.
// No es estrictamente necesario llamar a $pdo = null; a menos que quieras cerrar la conexión antes.

// Mostrar la salida para copiar y pegar
if (php_sapi_name() !== 'cli') {
    echo "<pre>";
}

echo "-- Script generado el: " . date('Y-m-d H:i:s') . "\n";
echo "-- Base de datos: `{$dbname}`\n";
// DB_HOST es una constante de tu archivo
echo "-- Host: " . DB_HOST . "\n\n";


echo "SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\n";
echo "START TRANSACTION;\n";
echo "SET time_zone = \"+00:00\";\n\n";

echo "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n";
echo "/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n";
echo "/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n";
// DB_CHARSET es una constante de tu archivo
echo "/*!40101 SET NAMES ".DB_CHARSET." */;\n\n";

echo $output;

echo "\nCOMMIT;\n\n";
echo "/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n";
echo "/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n";
echo "/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n";

if (php_sapi_name() !== 'cli') {
    echo "</pre>";
}

?>