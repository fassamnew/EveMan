ALTER TABLE `registrants`
  ADD COLUMN `lifecycleStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN `lifecycleUpdatedAt` DATETIME(3) NULL;

CREATE TABLE `communication_templates` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `channel` ENUM('EMAIL', 'SMS') NOT NULL,
  `subject` VARCHAR(191) NULL,
  `body` LONGTEXT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `communication_templates_organizationId_name_channel_key`(`organizationId`, `name`, `channel`),
  INDEX `communication_templates_organizationId_isActive_idx`(`organizationId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `communication_logs` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `registrantId` VARCHAR(191) NULL,
  `templateId` VARCHAR(191) NULL,
  `channel` ENUM('EMAIL', 'SMS') NOT NULL,
  `status` ENUM('QUEUED', 'SENT', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `senderUserId` VARCHAR(191) NULL,
  `recipientAddress` VARCHAR(191) NOT NULL,
  `providerMessageId` VARCHAR(191) NULL,
  `errorMessage` VARCHAR(191) NULL,
  `metadataJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` DATETIME(3) NULL,

  INDEX `communication_logs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  INDEX `communication_logs_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `import_jobs` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `uploadedByUserId` VARCHAR(191) NULL,
  `sourceFilename` VARCHAR(191) NOT NULL,
  `sourceFileType` VARCHAR(191) NOT NULL,
  `status` ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  `duplicateStrategy` ENUM('SKIP', 'UPDATE', 'FLAG') NOT NULL DEFAULT 'SKIP',
  `mappingProfileJson` JSON NULL,
  `totalRows` INTEGER NULL,
  `successfulRows` INTEGER NULL,
  `failedRows` INTEGER NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `import_jobs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  INDEX `import_jobs_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `import_errors` (
  `id` VARCHAR(191) NOT NULL,
  `importJobId` VARCHAR(191) NOT NULL,
  `rowNumber` INTEGER NOT NULL,
  `columnName` VARCHAR(191) NULL,
  `message` VARCHAR(191) NOT NULL,
  `rawDataJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `import_errors_importJobId_rowNumber_idx`(`importJobId`, `rowNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `communication_templates`
  ADD CONSTRAINT `communication_templates_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `communication_templates_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `communication_logs`
  ADD CONSTRAINT `communication_logs_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `communication_logs_registrantId_fkey`
  FOREIGN KEY (`registrantId`) REFERENCES `registrants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `communication_logs_templateId_fkey`
  FOREIGN KEY (`templateId`) REFERENCES `communication_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `communication_logs_senderUserId_fkey`
  FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `import_jobs`
  ADD CONSTRAINT `import_jobs_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `import_jobs_uploadedByUserId_fkey`
  FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `import_errors`
  ADD CONSTRAINT `import_errors_importJobId_fkey`
  FOREIGN KEY (`importJobId`) REFERENCES `import_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
