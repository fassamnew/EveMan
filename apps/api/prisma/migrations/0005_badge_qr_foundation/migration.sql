ALTER TABLE `registration_links`
  ADD COLUMN `badgeTemplateId` VARCHAR(191) NULL;

CREATE TABLE `badge_templates` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `configJson` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `badge_templates_organizationId_name_version_key`(`organizationId`, `name`, `version`),
  INDEX `badge_templates_organizationId_isActive_idx`(`organizationId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `qr_codes` (
  `id` VARCHAR(191) NOT NULL,
  `registrantId` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NULL,
  `status` ENUM('ACTIVE', 'VERIFIED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `expiresAt` DATETIME(3) NULL,
  `lastVerifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `qr_codes_tokenHash_key`(`tokenHash`),
  INDEX `qr_codes_organizationId_status_idx`(`organizationId`, `status`),
  INDEX `qr_codes_eventId_status_idx`(`eventId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `badges` (
  `id` VARCHAR(191) NOT NULL,
  `registrantId` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `registrationLinkId` VARCHAR(191) NOT NULL,
  `badgeTemplateId` VARCHAR(191) NULL,
  `qrCodeId` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'RENDERING', 'READY', 'FAILED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
  `storagePath` VARCHAR(191) NULL,
  `renderedAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `failureReason` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `badges_organizationId_status_idx`(`organizationId`, `status`),
  INDEX `badges_registrantId_createdAt_idx`(`registrantId`, `createdAt`),
  INDEX `badges_qrCodeId_idx`(`qrCodeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `registration_links`
  ADD INDEX `registration_links_badgeTemplateId_idx`(`badgeTemplateId`),
  ADD CONSTRAINT `registration_links_badgeTemplateId_fkey`
  FOREIGN KEY (`badgeTemplateId`) REFERENCES `badge_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `badge_templates`
  ADD CONSTRAINT `badge_templates_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `qr_codes`
  ADD CONSTRAINT `qr_codes_registrantId_fkey`
  FOREIGN KEY (`registrantId`) REFERENCES `registrants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `qr_codes_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `qr_codes_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `badges`
  ADD CONSTRAINT `badges_registrantId_fkey`
  FOREIGN KEY (`registrantId`) REFERENCES `registrants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `badges_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `badges_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `badges_registrationLinkId_fkey`
  FOREIGN KEY (`registrationLinkId`) REFERENCES `registration_links`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `badges_badgeTemplateId_fkey`
  FOREIGN KEY (`badgeTemplateId`) REFERENCES `badge_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `badges_qrCodeId_fkey`
  FOREIGN KEY (`qrCodeId`) REFERENCES `qr_codes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
