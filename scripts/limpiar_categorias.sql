-- ============================================================
-- Script: limpiar_categorias.sql
-- Proyecto: Chukuta Express v2.1
-- Propósito: Corregir encoding roto y eliminar categorías duplicadas
--            reasignando productos de forma segura e idempotente.
-- ============================================================

BEGIN;

DO $$
DECLARE
    rec RECORD;
    bad_id INT;
    good_id INT;
BEGIN
    -- Crear tabla temporal con las correcciones conocidas
    CREATE TEMP TABLE correcciones (mal VARCHAR, bien VARCHAR);
    INSERT INTO correcciones VALUES
    ('ElectrÃ³nica', 'Electrónica'),
    ('Hogar y JardÃ­n', 'Hogar y Jardín'),
    ('Hogar y JardÃn', 'Hogar y Jardín');

    FOR rec IN SELECT * FROM correcciones LOOP
        -- Buscar si existe la categoría con nombre incorrecto
        SELECT id_categoria INTO bad_id FROM categoria WHERE nombre_categoria = rec.mal LIMIT 1;
        
        IF bad_id IS NOT NULL THEN
            -- Buscar si ya existe la categoría con el nombre correcto
            SELECT id_categoria INTO good_id FROM categoria WHERE nombre_categoria = rec.bien LIMIT 1;
            
            IF good_id IS NOT NULL THEN
                -- Reasignar productos y eliminar la incorrecta
                UPDATE almacen SET id_categoria = good_id WHERE id_categoria = bad_id;
                DELETE FROM categoria WHERE id_categoria = bad_id;
                RAISE NOTICE 'Corregido: Reasignados productos de "%" a "%" y eliminada la duplicada.', rec.mal, rec.bien;
            ELSE
                -- Si no existe la buena, simplemente renombrar la mala
                UPDATE categoria SET nombre_categoria = rec.bien WHERE id_categoria = bad_id;
                RAISE NOTICE 'Corregido: Renombrada categoría "%" a "%".', rec.mal, rec.bien;
            END IF;
        ELSE
            RAISE NOTICE 'Ok: No se encontró la categoría "%".', rec.mal;
        END IF;
    END LOOP;
    
    DROP TABLE correcciones;
END $$;

COMMIT;
