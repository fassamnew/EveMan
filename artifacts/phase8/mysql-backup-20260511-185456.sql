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
INSERT INTO `audit_logs` VALUES ('0da84e43-253e-4cfa-a694-baa1b18d9348',NULL,'cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','REGISTRATION_SUBMIT','REGISTRANT','3228a6be-0594-40a3-9d03-e94fcf6d704c','SUCCESS','::ffff:127.0.0.1','{\"policyVersion\": \"v1\", \"confirmationTriggered\": true}','2026-05-10 20:33:27.452'),('0f92dc20-e41a-495a-b856-4dca70b3f822','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'AUTH_LOGIN','USER','840299f5-95b3-4df9-8921-534b6db2b149','SUCCESS','::1',NULL,'2026-05-11 15:53:42.166'),('1b69a632-2a13-4736-b0f8-8286b1d7d70e','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','AUTH_REFRESH','REFRESH_TOKEN','1178577f-bfcc-4aae-8d47-9e1754420f0d','SUCCESS','::1',NULL,'2026-05-11 08:00:46.783'),('2d593177-096c-4f98-bc19-5e386ac6c3e6','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'AUTH_LOGIN','USER','840299f5-95b3-4df9-8921-534b6db2b149','SUCCESS','::1',NULL,'2026-05-11 15:54:14.362'),('5faf03a2-0a6e-48d6-acec-37e46ea7e3e7','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'AUTH_LOGIN','USER','840299f5-95b3-4df9-8921-534b6db2b149','SUCCESS','::1',NULL,'2026-05-11 07:16:39.478'),('77b48fdb-f6b2-4eee-b56c-c9999e07c453','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'AUTH_LOGIN','USER','840299f5-95b3-4df9-8921-534b6db2b149','SUCCESS','::1',NULL,'2026-05-11 06:56:40.049'),('9d666896-8874-4ac6-8355-ee8da8eee99b','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'AUTH_LOGIN','USER','840299f5-95b3-4df9-8921-534b6db2b149','SUCCESS','::1',NULL,'2026-05-11 15:54:55.365'),('b364ae33-12f0-4b2a-8096-6d6c9f1dec80','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'OPS_BACKUP_RESTORE_DRILL_TRIGGERED','OPERATION',NULL,'SUCCESS','::1','{\"pid\": 22551, \"scriptPath\": \"/Users/fitsum/EventRegistration/EveMange/scripts/phase8/backup_restore_drill.sh\"}','2026-05-11 15:54:55.440'),('b60b8859-d421-4411-9f2d-9514ab270c9e','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','AUTH_REFRESH','REFRESH_TOKEN','1178577f-bfcc-4aae-8d47-9e1754420f0d','SUCCESS','::1',NULL,'2026-05-11 08:00:46.766'),('b7c5f862-abad-415d-979a-764799d5abc5','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'AUTH_LOGIN','USER','840299f5-95b3-4df9-8921-534b6db2b149','SUCCESS','::1',NULL,'2026-05-11 06:53:44.748'),('c4af67a9-346d-4df2-a041-513170e080c4','840299f5-95b3-4df9-8921-534b6db2b149','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','USER_INVITE_CREATE','INVITE',NULL,'SUCCESS','::1','{\"email\": \"kalkidanmulu4@gmail.com\", \"roleName\": \"ORG_ADMIN\"}','2026-05-11 07:18:06.445'),('d0f87922-94a9-475a-9173-a1b1271482a8','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','AUTH_REFRESH','REFRESH_TOKEN','1178577f-bfcc-4aae-8d47-9e1754420f0d','SUCCESS','::1',NULL,'2026-05-11 08:00:46.770'),('e032af45-abf2-4113-9127-6854023a06f7','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','AUTH_REFRESH','REFRESH_TOKEN','1178577f-bfcc-4aae-8d47-9e1754420f0d','SUCCESS','::1',NULL,'2026-05-11 08:00:46.777'),('e58bd1df-d021-4a7b-8fe7-439e36fe8fa9','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'AUTH_LOGIN','USER','840299f5-95b3-4df9-8921-534b6db2b149','SUCCESS','::1',NULL,'2026-05-11 08:05:50.683'),('f35c4c40-b037-4244-8307-02b0e7772abb','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','AUTH_LOGIN','USER','7df25b2d-8aa4-4931-9cd6-985153f5239e','SUCCESS','::1',NULL,'2026-05-11 07:19:17.948'),('fd61291f-cafe-4f45-879b-49d5b6ddbaf9','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','USER_INVITE_ACCEPT','INVITE','5edcc73f-1276-4cab-b9cc-24b0ceadf78f','SUCCESS','::1',NULL,'2026-05-11 07:18:55.833');
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
INSERT INTO `events` VALUES ('cdc1fe78-d2c5-4d50-b854-3a7313843f83','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','E2E Event',NULL,'PUBLISHED',NULL,NULL,NULL,'2026-05-10 20:33:26.301','2026-05-10 20:33:26.301');
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
  `type` enum('TEXT','TEXTAREA','EMAIL','NUMBER','SELECT','CHECKBOX') COLLATE utf8mb4_unicode_ci NOT NULL,
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
INSERT INTO `form_fields` VALUES ('dae15e63-3932-4e5d-8444-fdcf6d971783','506db4dd-6a10-4fa7-9e35-859a1b9bca12','nickname','Nickname','TEXT',1,1,NULL,NULL,2,NULL,NULL,NULL,NULL,'2026-05-10 20:33:26.374','2026-05-10 20:33:26.374');
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
INSERT INTO `invites` VALUES ('5edcc73f-1276-4cab-b9cc-24b0ceadf78f','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','kalkidanmulu4@gmail.com','b4a28181-488d-11f1-b1c2-e6e9bf23618b','e0d5d618ba89552b1ec77c22ca28a5068e5b323b83855af3561efd137060908a','2026-05-18 07:18:06.430','2026-05-11 07:18:55.814','840299f5-95b3-4df9-8921-534b6db2b149','2026-05-11 07:18:06.432');
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
INSERT INTO `link_rules` VALUES ('21fd643f-7c7f-445d-96df-cbab7e3fda13','506db4dd-6a10-4fa7-9e35-859a1b9bca12','PUBLIC',NULL,'AUTO',NULL,NULL,'2026-05-10 20:33:26.334','2026-05-10 20:33:26.334');
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
INSERT INTO `migration_metadata` VALUES ('ac1568d3-eb6c-4627-974d-3ba4a1d32377','super-admin:communications-config','{\"emailProvider\":\"ses\",\"smsProvider\":\"twilio\",\"senderEmail\":\"noreply@platform.test\"}','2026-05-10 20:28:35.933','2026-05-10 20:28:35.933'),('c9364274-8d40-4c7a-a2cb-dd4ea0159b1c','super-admin:subscription-config','{\"plans\":[{\"code\":\"enterprise\",\"seats\":250}],\"defaultPlan\":\"enterprise\"}','2026-05-10 20:28:35.830','2026-05-10 20:28:35.830');
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
INSERT INTO `organizations` VALUES ('cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','e2e-org','E2E Org',1,'2026-05-10 20:33:26.240','2026-05-10 20:33:26.240');
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
INSERT INTO `refresh_tokens` VALUES ('01149ad0-03a9-476d-9097-f34623d74701','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'a32a7bf7faa922d93aa39c95277a99dd48f5dbaa06a03f3ab2747977d3227679','2026-05-18 15:54:55.349',NULL,NULL,'::1',NULL,NULL,'2026-05-11 15:54:55.350'),('1178577f-bfcc-4aae-8d47-9e1754420f0d','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','71e6f7225156c3e2d2a32e93b7cb61fa9909c3c86973aca94f4e44769c88073a','2026-05-18 07:19:17.939','2026-05-11 08:00:46.752','708343ce-9540-4749-b70a-bad713736679','::1','2026-05-11 08:00:46.752','::1','2026-05-11 07:19:17.940'),('26e22fac-12ba-4992-9998-9631e5325255','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'45827f5f952b2c6e313973dd898855de8f2b4ccb61b7519243c3164689a44bd6','2026-05-18 15:54:14.350',NULL,NULL,'::1',NULL,NULL,'2026-05-11 15:54:14.351'),('2a028242-38d3-4169-a21c-28be991474a5','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','fee7228732cf4464a12c335b5e283d227287583c515220e6777aea2f4a6a7d48','2026-05-18 08:00:46.729',NULL,NULL,'::1',NULL,NULL,'2026-05-11 08:00:46.730'),('708343ce-9540-4749-b70a-bad713736679','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','b923046daffc66bdf61f4224a0631248a328c333c6154df7bf8e718091f2a493','2026-05-18 08:00:46.735',NULL,NULL,'::1',NULL,NULL,'2026-05-11 08:00:46.736'),('7561f1ec-4003-4f63-871a-7b924127985d','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'5a9557e6eba5f10db6522e0d71a3ad545bab55ed6e2e0a8fb12b1d3f3bc96aed','2026-05-18 15:53:42.134',NULL,NULL,'::1',NULL,NULL,'2026-05-11 15:53:42.135'),('9092bf58-6ac6-404e-b509-af6592352858','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','c4c7eafbf7c45e31c16d79590d691a18ef52d3f6520c9ea50b5c6f95ffc88b64','2026-05-18 08:00:46.734',NULL,NULL,'::1',NULL,NULL,'2026-05-11 08:00:46.735'),('aac56ee0-f011-4f0d-b798-ab322ff4d9cd','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'81c1c60e5a43d49078b74a725ccf50a38a3b1fd29de53b848409093c4ffec9e2','2026-05-18 06:56:40.040',NULL,NULL,'::1',NULL,NULL,'2026-05-11 06:56:40.041'),('b0f5ac7f-b14a-49c6-acb7-29bfe8b73d68','7df25b2d-8aa4-4931-9cd6-985153f5239e','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','f1451cdbf98897f07066404c2b88c434aef2996a982b5182b71e2e161914131b','2026-05-18 08:00:46.732',NULL,NULL,'::1',NULL,NULL,'2026-05-11 08:00:46.732'),('b6567a80-ba89-447b-a139-b033f80260ba','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'76b8e92e799ef55ff008cd50c4a5a024e970ea66f37902bd34266b59a5621462','2026-05-18 07:16:39.469',NULL,NULL,'::1',NULL,NULL,'2026-05-11 07:16:39.470'),('d33e8f61-5997-45d0-937c-6a182f3c7fdf','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'14e18d0ec43301d782c3ca380b6b480d5e7d915cff28bb6b919c4348f49e42b3','2026-05-18 06:53:44.738',NULL,NULL,'::1',NULL,NULL,'2026-05-11 06:53:44.739'),('e04540d4-3e8b-4e39-bc05-1cc6ef654bea','840299f5-95b3-4df9-8921-534b6db2b149',NULL,'9f3fcde8c213e47aef7f61388fa85bc4bc25da61c7b6dcbc17f3ae688e0a9146','2026-05-18 08:05:50.675',NULL,NULL,'::1',NULL,NULL,'2026-05-11 08:05:50.676');
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
INSERT INTO `registrant_responses` VALUES ('02ee5f91-880c-46fd-b722-4f4ec202a34a','3228a6be-0594-40a3-9d03-e94fcf6d704c','dae15e63-3932-4e5d-8444-fdcf6d971783','nickname','EU','2026-05-10 20:33:27.315');
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
INSERT INTO `registrants` VALUES ('3228a6be-0594-40a3-9d03-e94fcf6d704c','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','cdc1fe78-d2c5-4d50-b854-3a7313843f83','506db4dd-6a10-4fa7-9e35-859a1b9bca12','J3X72PQS','e2e@example.com','E2E User',1,'v1','2026-05-10 20:33:27.310','2026-05-10 20:33:27.311','::ffff:127.0.0.1',NULL,'2026-05-10 20:33:27.315','2026-05-10 20:33:27.315','APPROVED','2026-05-10 20:33:27.311');
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
INSERT INTO `registration_links` VALUES ('506db4dd-6a10-4fa7-9e35-859a1b9bca12','cdc1fe78-d2c5-4d50-b854-3a7313843f83','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','e2e-flow','E2E Flow',1,'2026-05-10 20:33:26.334','2026-05-10 20:33:26.334',NULL,NULL);
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
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `organizationId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_per_org` (`name`,`organizationId`),
  KEY `roles_organizationId_idx` (`organizationId`),
  CONSTRAINT `roles_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES ('b4a25e3f-488d-11f1-b1c2-e6e9bf23618b','SUPER_ADMIN','Platform super administrator',1,'2026-05-05 14:21:28.326','2026-05-11 15:54:44.306',NULL),('b4a28181-488d-11f1-b1c2-e6e9bf23618b','ORG_ADMIN','Organization administrator',1,'2026-05-05 14:21:28.326','2026-05-11 15:54:44.324',NULL),('b4a283ec-488d-11f1-b1c2-e6e9bf23618b','ORG_STAFF','Organization staff member',1,'2026-05-05 14:21:28.326','2026-05-11 15:54:44.337',NULL);
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
INSERT INTO `user_roles` VALUES ('2638fb8e-87cd-48a1-8238-7ebd0af72753','840299f5-95b3-4df9-8921-534b6db2b149','b4a25e3f-488d-11f1-b1c2-e6e9bf23618b',NULL,'2026-05-11 06:32:03.649'),('6316a0bf-f3ab-459d-bc2d-185990ad325c','7df25b2d-8aa4-4931-9cd6-985153f5239e','b4a28181-488d-11f1-b1c2-e6e9bf23618b','cd62213e-50fd-4c5c-9cd2-0b76fc5152ed','2026-05-11 07:18:55.818');
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
INSERT INTO `users` VALUES ('7df25b2d-8aa4-4931-9cd6-985153f5239e','kalkidanmulu4@gmail.com','$argon2id$v=19$m=65536,t=3,p=1$ihE6o4/RF2i/aCE2CpK8VA$u5gk1awkDA8sHtiqIaLZL+p3f94c4QEqGliBhfB96BQ','Kalkidan','Mulu',1,0,NULL,'2026-05-11 07:19:17.926','2026-05-11 07:18:55.803','2026-05-11 07:19:17.927'),('82a3f3a3-988f-4582-9e8f-3f701466675f','admin@rocket.com','$argon2id$v=19$m=65536,t=3,p=1$psJEHbYwkP2bnLpkfT3ETg$LaYWqsxN2d1ivYgKLFvoFBHeeT5jkBzjUVGF1ASitSE',NULL,NULL,1,0,NULL,'2026-05-10 20:32:19.645','2026-05-10 20:32:17.514','2026-05-10 20:32:19.648'),('840299f5-95b3-4df9-8921-534b6db2b149','superadmin@example.com','$argon2id$v=19$m=65536,t=3,p=1$W8+GUW2pB6a54mt29XshoA$6n8TZXY/R7lY/xbnXpuJmpyzOpgvg4zc7HEHPBu1M2w',NULL,NULL,1,0,NULL,'2026-05-11 15:54:55.326','2026-05-11 06:32:03.621','2026-05-11 15:54:55.327');
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

-- Dump completed on 2026-05-11 15:54:57
