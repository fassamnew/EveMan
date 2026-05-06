CREATE TABLE `events` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `archivedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `events_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `registration_links` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `registration_links_eventId_slug_key`(`eventId`, `slug`),
  INDEX `registration_links_organizationId_slug_idx`(`organizationId`, `slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `link_rules` (
  `id` VARCHAR(191) NOT NULL,
  `registrationLinkId` VARCHAR(191) NOT NULL,
  `visibility` ENUM('PUBLIC', 'UNLISTED', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
  `capacity` INTEGER NULL,
  `approvalMode` ENUM('AUTO', 'MANUAL') NOT NULL DEFAULT 'AUTO',
  `opensAt` DATETIME(3) NULL,
  `closesAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `link_rules_registrationLinkId_key`(`registrationLinkId`),
  INDEX `link_rules_visibility_opensAt_closesAt_idx`(`visibility`, `opensAt`, `closesAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `events`
  ADD CONSTRAINT `events_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `registration_links`
  ADD CONSTRAINT `registration_links_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `registration_links_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `link_rules`
  ADD CONSTRAINT `link_rules_registrationLinkId_fkey`
  FOREIGN KEY (`registrationLinkId`) REFERENCES `registration_links`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
