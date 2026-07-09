/*
  Otorgar permisos de monitoreo al usuario existente.
  Ejecutar en SQL Server 2019 con cuenta sysadmin.
*/
USE [master];
GO

GRANT VIEW SERVER STATE TO [kipuprod];
GO

-- Verificacion del permiso asignado al login usado por el dashboard.
SELECT
  sp.name AS login_name,
  perm.state_desc,
  perm.permission_name
FROM sys.server_principals AS sp
LEFT JOIN sys.server_permissions AS perm
  ON perm.grantee_principal_id = sp.principal_id
  AND perm.permission_name = 'VIEW SERVER STATE'
WHERE sp.name = N'kipuprod';
GO