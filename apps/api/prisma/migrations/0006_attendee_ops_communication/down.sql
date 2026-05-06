ALTER TABLE `import_errors` DROP FOREIGN KEY `import_errors_importJobId_fkey`;
ALTER TABLE `import_jobs` DROP FOREIGN KEY `import_jobs_organizationId_fkey`;
ALTER TABLE `import_jobs` DROP FOREIGN KEY `import_jobs_uploadedByUserId_fkey`;
ALTER TABLE `communication_logs` DROP FOREIGN KEY `communication_logs_organizationId_fkey`;
ALTER TABLE `communication_logs` DROP FOREIGN KEY `communication_logs_registrantId_fkey`;
ALTER TABLE `communication_logs` DROP FOREIGN KEY `communication_logs_templateId_fkey`;
ALTER TABLE `communication_logs` DROP FOREIGN KEY `communication_logs_senderUserId_fkey`;
ALTER TABLE `communication_templates` DROP FOREIGN KEY `communication_templates_organizationId_fkey`;
ALTER TABLE `communication_templates` DROP FOREIGN KEY `communication_templates_createdByUserId_fkey`;

DROP TABLE IF EXISTS `import_errors`;
DROP TABLE IF EXISTS `import_jobs`;
DROP TABLE IF EXISTS `communication_logs`;
DROP TABLE IF EXISTS `communication_templates`;

ALTER TABLE `registrants`
  DROP COLUMN `lifecycleStatus`,
  DROP COLUMN `lifecycleUpdatedAt`;
