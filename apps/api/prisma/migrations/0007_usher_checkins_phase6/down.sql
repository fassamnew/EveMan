ALTER TABLE `checkins` DROP FOREIGN KEY `checkins_organizationId_fkey`;
ALTER TABLE `checkins` DROP FOREIGN KEY `checkins_eventId_fkey`;
ALTER TABLE `checkins` DROP FOREIGN KEY `checkins_registrantId_fkey`;
ALTER TABLE `checkins` DROP FOREIGN KEY `checkins_usherUserId_fkey`;

DROP TABLE IF EXISTS `checkins`;
