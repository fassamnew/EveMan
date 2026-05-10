-- AlterTable: Add organizationId to Role to support org-scoped custom roles

-- Step 1: Add the organizationId column first (optional for now)
ALTER TABLE `roles` 
  ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- Step 2: Add foreign key
ALTER TABLE `roles` 
  ADD CONSTRAINT `roles_organizationId_fkey` 
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE;

-- Step 3: Add index for organization lookup
ALTER TABLE `roles` 
  ADD INDEX `roles_organizationId_idx` (`organizationId`);

-- Step 4: Change name from enum to varchar (CHANGE modifies the column definition)
-- First, drop the existing unique constraint
ALTER TABLE `roles` 
  DROP INDEX `roles_name_key`;

-- Then modify the column type
ALTER TABLE `roles` 
  MODIFY COLUMN `name` VARCHAR(120) NOT NULL;

-- Step 5: Add new unique constraint allowing duplicates across orgs
ALTER TABLE `roles` 
  ADD UNIQUE KEY `unique_role_per_org` (`name`, `organizationId`);
