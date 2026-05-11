-- MySQL dump 10.13  Distrib 8.4.9, for Linux (x86_64)
--
-- Host: localhost    Database: evemange
-- ------------------------------------------------------
-- Server version	8.4.9

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('0b7a67c1-8341-443d-8315-a80d4c21468d','b4d29219d323cbb0c6548653027e2a2c7e85ca7c649efa17deb1673aeb61f7b8','2026-05-06 04:52:16.597','0004_registrant_experience',NULL,NULL,'2026-05-06 04:52:16.138',1),('2c718b29-395d-4c7b-809b-870221103aba','492b153b683ea47207dbe3b62a8f136ddfa41ef430d3adce210a1be1034e7e15','2026-05-06 14:37:16.687','0005_badge_qr_foundation',NULL,NULL,'2026-05-06 14:37:15.493',1),('2ebc49c7-9308-488b-81d2-1c6f1e264498','f12dd58b8c3fac621f5e36c30b121f239f2280f001410d52500aca0e5b2a24c3','2026-05-06 04:28:22.234','0003_events_links',NULL,NULL,'2026-05-06 04:28:21.770',1),('3a247905-cff8-4b80-96f7-b85c30b4f0ca','6ed9352a40653175ae4792a4d88b77c772d41a1a7dbf150dacb2fc4af7a99a87','2026-05-05 14:21:27.873','0001_init',NULL,NULL,'2026-05-05 14:21:27.829',1),('611319c2-be66-43ea-878a-528d59c76cc5','02747a9326f4fc2457245bd80d81dfc721db3dfd6713235f31bee1996dc045b3','2026-05-07 07:11:44.751','0007_usher_checkins_phase6',NULL,NULL,'2026-05-07 07:11:43.915',1),('765cdad2-6635-4d01-b461-adf753956797','07323001823bbbd72e00b671f828ead14d7c810ad980123b6ddaa9dff8e27e33',NULL,'add_user_role_org_id','A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: add_user_role_org_id\n\nDatabase error code: 1060\n\nDatabase error:\nDuplicate column name \'organizationId\'\n\nPlease check the query number 1 from the migration file.\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name=\"add_user_role_org_id\"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name=\"add_user_role_org_id\"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226','2026-05-10 20:02:22.193','2026-05-10 20:00:24.559',0),('974758d7-02cf-4ac8-abe9-a6600e4acdff','4408f9d179baba33508c2bc5337b4e306e03936d9a04398b1c8587be076482f4','2026-05-06 16:24:10.444','0006_attendee_ops_communication',NULL,NULL,'2026-05-06 16:24:09.409',1),('f2e6d7ad-fac9-4a3e-84a2-7d028cc805a2','6ce66430b33c6ffe24b059d7ac4a7f055a9a9727994eeeafd90abc8a38d524c4','2026-05-10 19:56:49.172','add_org_scoped_roles',NULL,NULL,'2026-05-10 19:56:47.985',1),('fc2d0c1b-15c4-4b91-a296-8b66b78e755e','bbcb386f7bf5235a62e500e7c38063ca3aab756f1f120bd74a7f86afb4a2bd02','2026-05-05 14:21:28.338','0002_identity_tenancy',NULL,NULL,'2026-05-05 14:21:27.876',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actorUserId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcome` enum('SUCCESS','FAILURE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadataJson` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_organizationId_createdAt_idx` (`organizationId`,`createdAt`),
  KEY `audit_logs_actorUserId_createdAt_idx` (`actorUserId`,`createdAt`),
  CONSTRAINT `audit_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `audit_logs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES ('210e67c9-0cb4-491b-9218-00d8d42c568c','0bb89c97-01d4-48ab-9882-e0fc319ab8ff',NULL,'OPS_BACKUP_RESTORE_DRILL_TRIGGERED','OPERATION',NULL,'SUCCESS','::ffff:127.0.0.1','{\"pid\": 60926, \"scriptPath\": \"/Users/fitsum/EventRegistration/EveMange/scripts/phase8/backup_restore_drill.sh\"}','2026-05-11 21:40:22.293'),('5def91c8-86c1-4a9c-9ef5-84bd1cd94574','0bb89c97-01d4-48ab-9882-e0fc319ab8ff',NULL,'AUTH_LOGIN','USER','0bb89c97-01d4-48ab-9882-e0fc319ab8ff','SUCCESS','::ffff:127.0.0.1',NULL,'2026-05-11 21:40:22.184'),('6541c9e3-dc88-4ea7-a40c-e949e057c7bc','0bb89c97-01d4-48ab-9882-e0fc319ab8ff',NULL,'USER_STATUS_UPDATE','USER','bf8b37ae-abc9-4121-8a13-8aa073bb066d','SUCCESS','::ffff:127.0.0.1','{\"email\": \"staff@ops.test\", \"isActive\": false}','2026-05-11 21:40:22.274');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `badge_templates`
--

DROP TABLE IF EXISTS `badge_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `badge_templates` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `configJson` json NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `badge_templates_organizationId_name_version_key` (`organizationId`,`name`,`version`),
  KEY `badge_templates_organizationId_isActive_idx` (`organizationId`,`isActive`),
  CONSTRAINT `badge_templates_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `badge_templates`
--

LOCK TABLES `badge_templates` WRITE;
/*!40000 ALTER TABLE `badge_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `badge_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `badges`
--

DROP TABLE IF EXISTS `badges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `badges` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrantId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eventId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrationLinkId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `badgeTemplateId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qrCodeId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','RENDERING','READY','FAILED','REVOKED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `storagePath` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `renderedAt` datetime(3) DEFAULT NULL,
  `deliveredAt` datetime(3) DEFAULT NULL,
  `failureReason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `badges_organizationId_status_idx` (`organizationId`,`status`),
  KEY `badges_registrantId_createdAt_idx` (`registrantId`,`createdAt`),
  KEY `badges_qrCodeId_idx` (`qrCodeId`),
  KEY `badges_eventId_fkey` (`eventId`),
  KEY `badges_registrationLinkId_fkey` (`registrationLinkId`),
  KEY `badges_badgeTemplateId_fkey` (`badgeTemplateId`),
  CONSTRAINT `badges_badgeTemplateId_fkey` FOREIGN KEY (`badgeTemplateId`) REFERENCES `badge_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `badges_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `badges_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `badges_qrCodeId_fkey` FOREIGN KEY (`qrCodeId`) REFERENCES `qr_codes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `badges_registrantId_fkey` FOREIGN KEY (`registrantId`) REFERENCES `registrants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `badges_registrationLinkId_fkey` FOREIGN KEY (`registrationLinkId`) REFERENCES `registration_links` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `badges`
--

LOCK TABLES `badges` WRITE;
/*!40000 ALTER TABLE `badges` DISABLE KEYS */;
/*!40000 ALTER TABLE `badges` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `checkins`
--

DROP TABLE IF EXISTS `checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checkins` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eventId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrantId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `usherUserId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deviceId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `idempotencyKey` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` enum('MOBILE_ONLINE','OFFLINE_SYNC') COLLATE utf8mb4_unicode_ci NOT NULL,
  `syncState` enum('ACCEPTED','CONFLICT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACCEPTED',
  `scannedAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `checkins_organizationId_idempotencyKey_key` (`organizationId`,`idempotencyKey`),
  UNIQUE KEY `checkins_eventId_registrantId_key` (`eventId`,`registrantId`),
  KEY `checkins_organizationId_createdAt_idx` (`organizationId`,`createdAt`),
  KEY `checkins_usherUserId_createdAt_idx` (`usherUserId`,`createdAt`),
  KEY `checkins_registrantId_fkey` (`registrantId`),
  CONSTRAINT `checkins_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `checkins_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `checkins_registrantId_fkey` FOREIGN KEY (`registrantId`) REFERENCES `registrants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `checkins_usherUserId_fkey` FOREIGN KEY (`usherUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `checkins`
--

LOCK TABLES `checkins` WRITE;
/*!40000 ALTER TABLE `checkins` DISABLE KEYS */;
/*!40000 ALTER TABLE `checkins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `communication_logs`
--

DROP TABLE IF EXISTS `communication_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `communication_logs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrantId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `templateId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` enum('EMAIL','SMS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('QUEUED','SENT','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'QUEUED',
  `senderUserId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipientAddress` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `providerMessageId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `errorMessage` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadataJson` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `communication_logs_organizationId_createdAt_idx` (`organizationId`,`createdAt`),
  KEY `communication_logs_status_createdAt_idx` (`status`,`createdAt`),
  KEY `communication_logs_registrantId_fkey` (`registrantId`),
  KEY `communication_logs_templateId_fkey` (`templateId`),
  KEY `communication_logs_senderUserId_fkey` (`senderUserId`),
  CONSTRAINT `communication_logs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `communication_logs_registrantId_fkey` FOREIGN KEY (`registrantId`) REFERENCES `registrants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `communication_logs_senderUserId_fkey` FOREIGN KEY (`senderUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `communication_logs_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `communication_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `communication_logs`
--

LOCK TABLES `communication_logs` WRITE;
/*!40000 ALTER TABLE `communication_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `communication_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `communication_templates`
--

DROP TABLE IF EXISTS `communication_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `communication_templates` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('EMAIL','SMS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdByUserId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `communication_templates_organizationId_name_channel_key` (`organizationId`,`name`,`channel`),
  KEY `communication_templates_organizationId_isActive_idx` (`organizationId`,`isActive`),
  KEY `communication_templates_createdByUserId_fkey` (`createdByUserId`),
  CONSTRAINT `communication_templates_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `communication_templates_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `communication_templates`
--

LOCK TABLES `communication_templates` WRITE;
/*!40000 ALTER TABLE `communication_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `communication_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('DRAFT','PUBLISHED','ARCHIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `startsAt` datetime(3) DEFAULT NULL,
  `endsAt` datetime(3) DEFAULT NULL,
  `archivedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `events_organizationId_createdAt_idx` (`organizationId`,`createdAt`),
  CONSTRAINT `events_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `events`
--

LOCK TABLES `events` WRITE;
/*!40000 ALTER TABLE `events` DISABLE KEYS */;
/*!40000 ALTER TABLE `events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `form_fields`
--

DROP TABLE IF EXISTS `form_fields`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_fields` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrationLinkId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('TEXT','TEXTAREA','EMAIL','NUMBER','SELECT','CHECKBOX','DATE','RADIO_BUTTON','FILE_UPLOAD','PHOTO_UPLOAD') COLLATE utf8mb4_unicode_ci NOT NULL,
  `required` tinyint(1) NOT NULL DEFAULT '1',
  `position` int NOT NULL DEFAULT '0',
  `placeholder` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `optionsJson` json DEFAULT NULL,
  `minLength` int DEFAULT NULL,
  `maxLength` int DEFAULT NULL,
  `minValue` double DEFAULT NULL,
  `maxValue` double DEFAULT NULL,
  `pattern` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `allowedFileTypesJson` json DEFAULT NULL,
  `maxDate` datetime(3) DEFAULT NULL,
  `maxFileSize` int DEFAULT NULL,
  `minDate` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `form_fields_registrationLinkId_key_key` (`registrationLinkId`,`key`),
  KEY `form_fields_registrationLinkId_position_idx` (`registrationLinkId`,`position`),
  CONSTRAINT `form_fields_registrationLinkId_fkey` FOREIGN KEY (`registrationLinkId`) REFERENCES `registration_links` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `form_fields`
--

LOCK TABLES `form_fields` WRITE;
/*!40000 ALTER TABLE `form_fields` DISABLE KEYS */;
/*!40000 ALTER TABLE `form_fields` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `import_errors`
--

DROP TABLE IF EXISTS `import_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `import_errors` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `importJobId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rowNumber` int NOT NULL,
  `columnName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rawDataJson` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `import_errors_importJobId_rowNumber_idx` (`importJobId`,`rowNumber`),
  CONSTRAINT `import_errors_importJobId_fkey` FOREIGN KEY (`importJobId`) REFERENCES `import_jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `import_errors`
--

LOCK TABLES `import_errors` WRITE;
/*!40000 ALTER TABLE `import_errors` DISABLE KEYS */;
/*!40000 ALTER TABLE `import_errors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `import_jobs`
--

DROP TABLE IF EXISTS `import_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `import_jobs` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploadedByUserId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sourceFilename` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sourceFileType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('QUEUED','PROCESSING','COMPLETED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'QUEUED',
  `duplicateStrategy` enum('SKIP','UPDATE','FLAG') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SKIP',
  `mappingProfileJson` json DEFAULT NULL,
  `totalRows` int DEFAULT NULL,
  `successfulRows` int DEFAULT NULL,
  `failedRows` int DEFAULT NULL,
  `startedAt` datetime(3) DEFAULT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `import_jobs_organizationId_createdAt_idx` (`organizationId`,`createdAt`),
  KEY `import_jobs_status_createdAt_idx` (`status`,`createdAt`),
  KEY `import_jobs_uploadedByUserId_fkey` (`uploadedByUserId`),
  CONSTRAINT `import_jobs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `import_jobs_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `import_jobs`
--

LOCK TABLES `import_jobs` WRITE;
/*!40000 ALTER TABLE `import_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `import_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invites`
--

DROP TABLE IF EXISTS `invites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invites` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `acceptedAt` datetime(3) DEFAULT NULL,
  `invitedByUserId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `invites_tokenHash_key` (`tokenHash`),
  KEY `invites_organizationId_email_idx` (`organizationId`,`email`),
  KEY `invites_roleId_fkey` (`roleId`),
  KEY `invites_invitedByUserId_fkey` (`invitedByUserId`),
  CONSTRAINT `invites_invitedByUserId_fkey` FOREIGN KEY (`invitedByUserId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `invites_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invites_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invites`
--

LOCK TABLES `invites` WRITE;
/*!40000 ALTER TABLE `invites` DISABLE KEYS */;
/*!40000 ALTER TABLE `invites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `link_rules`
--

DROP TABLE IF EXISTS `link_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `link_rules` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrationLinkId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `visibility` enum('PUBLIC','UNLISTED','PRIVATE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PUBLIC',
  `capacity` int DEFAULT NULL,
  `approvalMode` enum('AUTO','MANUAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AUTO',
  `opensAt` datetime(3) DEFAULT NULL,
  `closesAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `link_rules_registrationLinkId_key` (`registrationLinkId`),
  KEY `link_rules_visibility_opensAt_closesAt_idx` (`visibility`,`opensAt`,`closesAt`),
  CONSTRAINT `link_rules_registrationLinkId_fkey` FOREIGN KEY (`registrationLinkId`) REFERENCES `registration_links` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `link_rules`
--

LOCK TABLES `link_rules` WRITE;
/*!40000 ALTER TABLE `link_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `link_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `link_types`
--

DROP TABLE IF EXISTS `link_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `link_types` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#6366f1',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `link_types_organizationId_name_key` (`organizationId`,`name`),
  KEY `link_types_organizationId_idx` (`organizationId`),
  CONSTRAINT `link_types_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `link_types`
--

LOCK TABLES `link_types` WRITE;
/*!40000 ALTER TABLE `link_types` DISABLE KEYS */;
/*!40000 ALTER TABLE `link_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migration_metadata`
--

DROP TABLE IF EXISTS `migration_metadata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migration_metadata` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `migration_metadata_key_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migration_metadata`
--

LOCK TABLES `migration_metadata` WRITE;
/*!40000 ALTER TABLE `migration_metadata` DISABLE KEYS */;
INSERT INTO `migration_metadata` VALUES ('36d9e656-b06e-4319-8b9c-e8d2d9dd2665','event:f321c5ce-24ae-4063-855e-879dd8601f67:settings:registrationEndsAt','2026-11-10T18:00:00.000Z','2026-05-11 21:40:19.312','2026-05-11 21:40:19.312'),('409b76a5-90d3-403e-b836-379868df8976','super-admin:subscription-config','{\"plans\":[{\"code\":\"enterprise\",\"seats\":250}],\"defaultPlan\":\"enterprise\"}','2026-05-11 21:40:22.194','2026-05-11 21:40:22.194'),('472a91b2-1283-4fe6-b9d2-0a65068fd992','link:3c232b28-6d91-4d87-b140-5cc0e65bf84d:settings:accessMode','PASSWORD_PROTECTED','2026-05-11 21:40:19.390','2026-05-11 21:40:19.390'),('4f00fc88-b40a-4d42-bac3-0ea4d2eb9e13','super-admin:global-registration-page-templates','{\"templates\":[{\"id\":\"conference-clean\",\"name\":\"Conference Clean\"}]}','2026-05-11 21:40:22.238','2026-05-11 21:40:22.238'),('5a4fedf2-1d14-4acc-991e-f43492596d3c','link:a88a27ea-dd43-405b-9965-54951ca071d6:settings:emailTemplateName','missing-template','2026-05-11 21:40:19.721','2026-05-11 21:40:19.721'),('5bcdfd85-00b6-4f14-8237-4bafa198d4b3','event:f321c5ce-24ae-4063-855e-879dd8601f67:settings:registrationStartsAt','2026-11-01T08:00:00.000Z','2026-05-11 21:40:19.306','2026-05-11 21:40:19.306'),('6f0c2cc9-3f9e-4b4e-8cfa-26a33de4ed74','link:3c232b28-6d91-4d87-b140-5cc0e65bf84d:settings:emailTemplateName','section4-template','2026-05-11 21:40:19.369','2026-05-11 21:40:19.369'),('7d5920f3-af2c-4e2c-8e85-3a290bebd621','super-admin:communications-config','{\"emailProvider\":\"ses\",\"smsProvider\":\"twilio\",\"senderEmail\":\"noreply@platform.test\"}','2026-05-11 21:40:22.211','2026-05-11 21:40:22.211'),('83e4c60e-3a68-43f4-9792-cfa5bc11ce99','link:3c232b28-6d91-4d87-b140-5cc0e65bf84d:settings:registrationInstructions','Arrive 30 minutes early and bring your QR code.','2026-05-11 21:40:19.376','2026-05-11 21:40:19.376'),('8e670ae8-e873-4418-955d-adccba098784','event:f321c5ce-24ae-4063-855e-879dd8601f67:settings:eventBannerUrl','https://cdn.example.com/banner.png','2026-05-11 21:40:19.299','2026-05-11 21:40:19.299'),('8eab817a-f192-48e5-aee4-1820563ea53b','link:3c232b28-6d91-4d87-b140-5cc0e65bf84d:settings:accessPassword','Secret123','2026-05-11 21:40:19.396','2026-05-11 21:40:19.396'),('9f802d50-c41d-4189-a8e9-bf41ee1aee45','link:a88a27ea-dd43-405b-9965-54951ca071d6:settings:accessMode','PUBLIC','2026-05-11 21:40:19.742','2026-05-11 21:40:19.742'),('ba4c8024-6124-4f25-bf0a-655f8fc3bbd6','event:f321c5ce-24ae-4063-855e-879dd8601f67:settings:venue','Millennium Hall','2026-05-11 21:40:19.285','2026-05-11 21:40:19.285'),('be6938d8-dbc1-46c8-b2d7-f8bea533ccb8','event:f321c5ce-24ae-4063-855e-879dd8601f67:settings:eventLogoUrl','https://cdn.example.com/logo.png','2026-05-11 21:40:19.293','2026-05-11 21:40:19.293'),('bff5d8cf-befe-4976-a3d3-48173848abd2','link:3c232b28-6d91-4d87-b140-5cc0e65bf84d:settings:confirmationMessage','Welcome to Section4.','2026-05-11 21:40:19.362','2026-05-11 21:40:19.362'),('c387f700-6a2a-4d47-8882-427e5d93d037','event:f321c5ce-24ae-4063-855e-879dd8601f67:settings:checkinPolicy','APPROVED_ONLY','2026-05-11 21:40:19.319','2026-05-11 21:40:19.319'),('dad935ec-ac98-4827-8445-36693dfc83f4','link:a88a27ea-dd43-405b-9965-54951ca071d6:settings:confirmationMessage','Fallback message.','2026-05-11 21:40:19.712','2026-05-11 21:40:19.712'),('e4bd2d6c-0a52-44ee-86ea-9d90d4328140','link:a88a27ea-dd43-405b-9965-54951ca071d6:settings:photoUpload','OPTIONAL','2026-05-11 21:40:19.733','2026-05-11 21:40:19.733'),('ec2a4b76-0e78-476d-897a-ad9818d79f3a','link:3c232b28-6d91-4d87-b140-5cc0e65bf84d:settings:photoUpload','REQUIRED','2026-05-11 21:40:19.383','2026-05-11 21:40:19.383'),('efc731ad-fa03-4073-833c-b3985f7b513d','super-admin:global-badge-templates','{\"templates\":[{\"id\":\"vip-dark\",\"name\":\"VIP Dark\"}]}','2026-05-11 21:40:22.225','2026-05-11 21:40:22.225');
/*!40000 ALTER TABLE `migration_metadata` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organizations`
--

DROP TABLE IF EXISTS `organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organizations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizations_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organizations`
--

LOCK TABLES `organizations` WRITE;
/*!40000 ALTER TABLE `organizations` DISABLE KEYS */;
INSERT INTO `organizations` VALUES ('c661162a-f6bc-4467-9b51-d7ce1a4b5991','ops-org','Ops Org',1,'2026-05-11 21:40:21.801','2026-05-11 21:40:21.801');
/*!40000 ALTER TABLE `organizations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qr_codes`
--

DROP TABLE IF EXISTS `qr_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qr_codes` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrantId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eventId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenHash` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','VERIFIED','REVOKED','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `expiresAt` datetime(3) DEFAULT NULL,
  `lastVerifiedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `qr_codes_tokenHash_key` (`tokenHash`),
  KEY `qr_codes_organizationId_status_idx` (`organizationId`,`status`),
  KEY `qr_codes_eventId_status_idx` (`eventId`,`status`),
  KEY `qr_codes_registrantId_fkey` (`registrantId`),
  CONSTRAINT `qr_codes_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `qr_codes_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `qr_codes_registrantId_fkey` FOREIGN KEY (`registrantId`) REFERENCES `registrants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qr_codes`
--

LOCK TABLES `qr_codes` WRITE;
/*!40000 ALTER TABLE `qr_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `qr_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tokenHash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `revokedAt` datetime(3) DEFAULT NULL,
  `replacedByTokenId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdByIp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastUsedAt` datetime(3) DEFAULT NULL,
  `lastUsedIp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `refresh_tokens_tokenHash_key` (`tokenHash`),
  KEY `refresh_tokens_userId_idx` (`userId`),
  KEY `refresh_tokens_organizationId_idx` (`organizationId`),
  KEY `refresh_tokens_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `refresh_tokens_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
INSERT INTO `refresh_tokens` VALUES ('20114258-460c-4d53-af6a-5fbfcb83a11d','0bb89c97-01d4-48ab-9882-e0fc319ab8ff',NULL,'fe4fce7402ee2d89229198d0cca4e0f99524a7cc4526f4cdb80dc4b594db8b56','2026-05-18 21:40:22.174',NULL,NULL,'::ffff:127.0.0.1',NULL,NULL,'2026-05-11 21:40:22.174');
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `registrant_responses`
--

DROP TABLE IF EXISTS `registrant_responses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `registrant_responses` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrantId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `formFieldId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fieldKey` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `valueText` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `registrant_responses_registrantId_fieldKey_key` (`registrantId`,`fieldKey`),
  KEY `registrant_responses_formFieldId_idx` (`formFieldId`),
  CONSTRAINT `registrant_responses_formFieldId_fkey` FOREIGN KEY (`formFieldId`) REFERENCES `form_fields` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `registrant_responses_registrantId_fkey` FOREIGN KEY (`registrantId`) REFERENCES `registrants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `registrant_responses`
--

LOCK TABLES `registrant_responses` WRITE;
/*!40000 ALTER TABLE `registrant_responses` DISABLE KEYS */;
/*!40000 ALTER TABLE `registrant_responses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `registrants`
--

DROP TABLE IF EXISTS `registrants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `registrants` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eventId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registrationLinkId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `referenceCode` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fullName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consentAccepted` tinyint(1) NOT NULL DEFAULT '0',
  `consentPolicyVersion` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consentCapturedAt` datetime(3) NOT NULL,
  `confirmationSentAt` datetime(3) DEFAULT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `lifecycleStatus` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'APPROVED',
  `lifecycleUpdatedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `registrants_referenceCode_key` (`referenceCode`),
  UNIQUE KEY `registrants_registrationLinkId_email_key` (`registrationLinkId`,`email`),
  KEY `registrants_eventId_createdAt_idx` (`eventId`,`createdAt`),
  KEY `registrants_organizationId_fkey` (`organizationId`),
  CONSTRAINT `registrants_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registrants_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registrants_registrationLinkId_fkey` FOREIGN KEY (`registrationLinkId`) REFERENCES `registration_links` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `registrants`
--

LOCK TABLES `registrants` WRITE;
/*!40000 ALTER TABLE `registrants` DISABLE KEYS */;
/*!40000 ALTER TABLE `registrants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `registration_links`
--

DROP TABLE IF EXISTS `registration_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `registration_links` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eventId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `badgeTemplateId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linkTypeId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `registration_links_eventId_slug_key` (`eventId`,`slug`),
  KEY `registration_links_organizationId_slug_idx` (`organizationId`,`slug`),
  KEY `registration_links_badgeTemplateId_idx` (`badgeTemplateId`),
  KEY `registration_links_linkTypeId_idx` (`linkTypeId`),
  CONSTRAINT `registration_links_badgeTemplateId_fkey` FOREIGN KEY (`badgeTemplateId`) REFERENCES `badge_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `registration_links_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registration_links_linkTypeId_fkey` FOREIGN KEY (`linkTypeId`) REFERENCES `link_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `registration_links_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `registration_links`
--

LOCK TABLES `registration_links` WRITE;
/*!40000 ALTER TABLE `registration_links` DISABLE KEYS */;
/*!40000 ALTER TABLE `registration_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_organizationId_key` (`name`,`organizationId`),
  KEY `roles_organizationId_idx` (`organizationId`),
  CONSTRAINT `roles_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES ('b4a25e3f-488d-11f1-b1c2-e6e9bf23618b','SUPER_ADMIN','Platform super administrator',1,'2026-05-05 14:21:28.326','2026-05-11 21:40:21.610',NULL),('b4a28181-488d-11f1-b1c2-e6e9bf23618b','ORG_ADMIN','Organization administrator',1,'2026-05-05 14:21:28.326','2026-05-11 21:40:21.623',NULL),('b4a283ec-488d-11f1-b1c2-e6e9bf23618b','ORG_STAFF','Organization staff member',1,'2026-05-05 14:21:28.326','2026-05-11 21:40:21.632',NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `roleId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_roles_userId_roleId_organizationId_key` (`userId`,`roleId`,`organizationId`),
  KEY `user_roles_organizationId_idx` (`organizationId`),
  KEY `user_roles_roleId_fkey` (`roleId`),
  CONSTRAINT `user_roles_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES ('56a0a736-38aa-467a-b615-4936030374b0','bf8b37ae-abc9-4121-8a13-8aa073bb066d','b4a283ec-488d-11f1-b1c2-e6e9bf23618b','c661162a-f6bc-4467-9b51-d7ce1a4b5991','2026-05-11 21:40:21.997'),('7597fcfb-8380-4d2a-a547-c1760e961961','0bb89c97-01d4-48ab-9882-e0fc319ab8ff','b4a25e3f-488d-11f1-b1c2-e6e9bf23618b',NULL,'2026-05-11 21:40:21.788');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwordHash` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firstName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `failedLoginCount` int NOT NULL DEFAULT '0',
  `lockedUntil` datetime(3) DEFAULT NULL,
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('0bb89c97-01d4-48ab-9882-e0fc319ab8ff','super@platform.test','$argon2id$v=19$m=65536,t=3,p=1$7th3E21OaZc+pVXZumJhdA$6LXS72e0/GrMx4xzKj04Hjevx2SI4v7KcsNdf8LO3cw',NULL,NULL,1,0,NULL,'2026-05-11 21:40:22.162','2026-05-11 21:40:21.775','2026-05-11 21:40:22.162'),('bf8b37ae-abc9-4121-8a13-8aa073bb066d','staff@ops.test','$argon2id$v=19$m=65536,t=3,p=1$9jdNFI9PE0w2Ch5zLaCZ9g$+EcWQt2mYzpzYXaIH246KwzfryBhDr8oBfIQD9zXNv4',NULL,NULL,0,0,NULL,NULL,'2026-05-11 21:40:21.988','2026-05-11 21:40:22.266');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-11 21:40:23
