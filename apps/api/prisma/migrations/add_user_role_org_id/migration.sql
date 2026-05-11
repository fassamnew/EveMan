-- AddColumn organizationId to user_roles for org-scoped role assignments

-- Step 1: Add organizationId column (nullable initially to support existing data)
ALTER TABLE `user_roles`
  ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- Step 2: Add foreign key constraint
ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE;

-- Step 3: Add index for organization lookup
ALTER TABLE `user_roles`
  ADD INDEX `user_roles_organizationId_idx` (`organizationId`);

-- Step 4: Update the unique constraint to include organizationId
-- First drop the old unique constraint
ALTER TABLE `user_roles`
  DROP INDEX `user_roles_userId_roleId_key`;

-- Add new unique constraint with organizationId
ALTER TABLE `user_roles`
  ADD UNIQUE KEY `unique_user_role_per_org` (`userId`, `roleId`, `organizationId`);
