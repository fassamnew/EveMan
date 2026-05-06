CREATE TABLE `form_fields` (
  `id` VARCHAR(191) NOT NULL,
  `registrationLinkId` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `type` ENUM('TEXT', 'TEXTAREA', 'EMAIL', 'NUMBER', 'SELECT', 'CHECKBOX') NOT NULL,
  `required` BOOLEAN NOT NULL DEFAULT true,
  `position` INTEGER NOT NULL DEFAULT 0,
  `placeholder` VARCHAR(191) NULL,
  `optionsJson` JSON NULL,
  `minLength` INTEGER NULL,
  `maxLength` INTEGER NULL,
  `minValue` DOUBLE NULL,
  `maxValue` DOUBLE NULL,
  `pattern` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `form_fields_registrationLinkId_key_key`(`registrationLinkId`, `key`),
  INDEX `form_fields_registrationLinkId_position_idx`(`registrationLinkId`, `position`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `registrants` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `registrationLinkId` VARCHAR(191) NOT NULL,
  `referenceCode` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `consentAccepted` BOOLEAN NOT NULL DEFAULT false,
  `consentPolicyVersion` VARCHAR(191) NOT NULL,
  `consentCapturedAt` DATETIME(3) NOT NULL,
  `confirmationSentAt` DATETIME(3) NULL,
  `ipAddress` VARCHAR(191) NULL,
  `userAgent` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `registrants_referenceCode_key`(`referenceCode`),
  UNIQUE INDEX `registrants_registrationLinkId_email_key`(`registrationLinkId`, `email`),
  INDEX `registrants_eventId_createdAt_idx`(`eventId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `registrant_responses` (
  `id` VARCHAR(191) NOT NULL,
  `registrantId` VARCHAR(191) NOT NULL,
  `formFieldId` VARCHAR(191) NULL,
  `fieldKey` VARCHAR(191) NOT NULL,
  `valueText` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `registrant_responses_registrantId_fieldKey_key`(`registrantId`, `fieldKey`),
  INDEX `registrant_responses_formFieldId_idx`(`formFieldId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `form_fields`
  ADD CONSTRAINT `form_fields_registrationLinkId_fkey`
  FOREIGN KEY (`registrationLinkId`) REFERENCES `registration_links`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `registrants`
  ADD CONSTRAINT `registrants_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `registrants_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `registrants_registrationLinkId_fkey`
  FOREIGN KEY (`registrationLinkId`) REFERENCES `registration_links`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `registrant_responses`
  ADD CONSTRAINT `registrant_responses_registrantId_fkey`
  FOREIGN KEY (`registrantId`) REFERENCES `registrants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `registrant_responses_formFieldId_fkey`
  FOREIGN KEY (`formFieldId`) REFERENCES `form_fields`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
