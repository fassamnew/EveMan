ALTER TABLE `registration_links` DROP FOREIGN KEY `registration_links_badgeTemplateId_fkey`;
ALTER TABLE `registration_links` DROP INDEX `registration_links_badgeTemplateId_idx`;
ALTER TABLE `registration_links` DROP COLUMN `badgeTemplateId`;

DROP TABLE IF EXISTS `badges`;
DROP TABLE IF EXISTS `qr_codes`;
DROP TABLE IF EXISTS `badge_templates`;
