CREATE TABLE `checkins` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `registrantId` VARCHAR(191) NOT NULL,
  `usherUserId` VARCHAR(191) NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `source` ENUM('MOBILE_ONLINE', 'OFFLINE_SYNC') NOT NULL,
  `syncState` ENUM('ACCEPTED', 'CONFLICT') NOT NULL DEFAULT 'ACCEPTED',
  `scannedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `checkins_organizationId_idempotencyKey_key`(`organizationId`, `idempotencyKey`),
  UNIQUE INDEX `checkins_eventId_registrantId_key`(`eventId`, `registrantId`),
  INDEX `checkins_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  INDEX `checkins_usherUserId_createdAt_idx`(`usherUserId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `checkins`
  ADD CONSTRAINT `checkins_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `checkins_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `checkins_registrantId_fkey`
  FOREIGN KEY (`registrantId`) REFERENCES `registrants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `checkins_usherUserId_fkey`
  FOREIGN KEY (`usherUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
