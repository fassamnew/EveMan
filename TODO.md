# Software Requirements Specification (SRS) & Project Evolution Tracker
## EveMange: Multi-Event Multi-Organizer Platform

### 1. Project Pivot & Vision
After reviewing the [System Design](system%20design.md), the project is evolving from a single-event tool into a **Multi-Tenant SaaS Platform**. The current implementation serves as a prototype/MVP for the core registration and check-in logic. We are now "redoing" the architecture to support:
**One Platform → Multiple Organizers → Multiple Events → Multiple Registration Links.**

### 2. Core System Architecture (New)
#### 2.1 Multi-Tenancy (Organizers)
- Organizers are the top-level entities.
- Each Organizer has its own set of Events, Staff, and Custom Settings.
- Authentication & RBAC (Super Admin, Organizer Admin, Staff, Usher).

#### 2.2 Event Management
- Each Event can have multiple Registration Links (VIP, Media, Speaker, etc.).
- Each Registration Link has its own:
    - Custom Form Fields & Layout.
    - Specialized Badge Template & Category Colors.
    - Specific Approval Workflows (Manual vs. Auto).

#### 2.3 Mobile Usher Eco-system
- Dedicated login for Ushers.
- Event-specific scanning sessions.
- Real-time sync with attendee photos for security verification.

### 3. Current Implementation Status (Transitioning)
The items below are the "V1" legacy features which will be refactored into the new multi-tenant structure.

#### 🔧 Backend Infrastructure (Targeting Refactor)
- ✅ **SQLite MVP**: Current single-table database. (Target: Migrate to multi-table relational schema).
- ✅ **Badge Engine**: PDF generation logic. (Target: Move to dynamic template-based engine).
- ✅ **Registration API**: Basic endpoint. (Target: Refactor to `/api/v2/:organizer/:event/register`).

#### 🎨 Frontend Experience (Targeting Refactor)
- ✅ **Tailwind UI**: Modern dashboard and forms. (Target: Themeable per registration link).
- ✅ **Navigation**: Flat structure. (Target: Sidebar-based portal architecture).

---

## 📋 Detailed Task List for "The Great Refactor"

### Phase 1: Database & Backend Core [NOT STARTED]
- [ ] **Design Multi-Tenant Schema**: Create tables for `organizers`, `users`, `events`, `registration_links`, `form_fields`, `badge_templates`, and `attendees`.
- [ ] **Auth System**: Implement JWT-based multi-role authentication (RBAC).
- [ ] **Dynamic API Routing**: 
    - `/api/admin/*` for platform management.
    - `/api/organizer/*` for event management.
    - `/api/public/:event-slug/:link-slug` for registration.

### Phase 2: Organizer Portal (The Creator) [NOT STARTED]
- [ ] **Event Builder**: UI to create events with logos, banners, and dates.
- [ ] **Link Manager**: Interface to generate multiple registration paths (VIP, Speaker, etc.).
- [ ] **Form Builder**: Configurable field management for each link.
- [ ] **Badge Designer (Lite)**: Set category colors and logos for PDF badges.

### Phase 3: Public Registrant Portal [NOT STARTED]
- [ ] **Dynamic Landing Pages**: Generate pages based on event/link configuration.
- [ ] **Photo Upload Integration**: Capture and store attendee photos for security.
- [ ] **Reference Tracker**: Allow registrants to re-download badges via email lookup.

### Phase 4: Mobile Usher Refactor [NOT STARTED]
- [ ] **Usher Login/Handshake**: Secure mobile login.
- [ ] **Scanning Context**: Link scanning app to a specific event/entry point.
- [ ] **Verification View**: Enhanced UI showing attendee photo and check-in status.

### Phase 5: Analytics & Expansion [NOT STARTED]
- [ ] **Global Dashboard**: Aggregated stats for the Super Admin.
- [ ] **Export Engine**: Per-event and per-link CSV/Excel reporting.
- [ ] **Bulk Communication 2.0**: Event-specific manual/scheduled emails.

### Section 3.1: Super Admin Portal Features [COMPLETE]
- [x] **Manage Organizers**: List organizations and create organizations.
- [x] **Edit/Suspend Organizer Accounts**: Super-admin organization update endpoint for name/code/isActive.
- [x] **View All Events Across Organizers**: Platform-wide event list endpoint.
- [x] **Manage System Users**: Platform user listing and active-status toggle endpoint.
- [x] **Configure Email/SMS Settings**: Super-admin communications config get/update endpoints.
- [x] **View Platform-wide Analytics**: Platform overview metrics endpoint.
- [x] **Audit System Activity**: Super-admin audit log listing endpoint.
- [x] **Backup and Restore Data Visibility**: Backup/restore artifact listing endpoint.
- [x] **Manage Subscription/Licensing Config**: Super-admin subscription config get/update endpoints.
- [x] **Manage Global Badge Templates**: Global badge template catalog get/update endpoints.
- [x] **Manage Global Registration Page Templates**: Global registration template catalog get/update endpoints.
- [x] **Super Admin UI Completion**: Dashboard now exposes platform overview, events, system users, audit logs, backup visibility, and JSON editors for all section 3.1 settings/template endpoints.
- [x] **Operational Actions**: Added guarded API workflow and Super Admin portal action for triggering backup/restore drill.
- [x] **E2E Tests**: Added API integration coverage for all current super-admin section 3.1 routes in `apps/api/src/modules/super-admin/super-admin.integration.test.ts`.

### Section 3.2: Organizer Portal Features [IN PROGRESS]

#### Implemented ✅
- [x] **Create & Manage Events**: API endpoints for event CRUD operations.
- [x] **Multiple Registration Links**: Support for multiple links per event (VIP, General, Speaker, etc.).
- [x] **Manage Registrants**: View and filter attendees by status.
- [x] **Approve/Reject Registrations**: Manual approval workflow for registration requests.
- [x] **Generate Badges & QR Codes**: Badge generation with QR code integration.
- [x] **Confirmation Emails**: Automated email notifications on registration and approval.
- [x] **Bulk Communications**: Send emails to registered attendees.
- [x] **Report Export**: Export attendance data and registration reports.
- [x] **Organizer UI Portal**: Dashboard with navigation to all major features.
- [x] **Custom Role Management**: Create org-scoped custom user roles (Event Manager, Scanner Admin, etc.).
- [x] **User/Role Management API**: Endpoints to manage team members and assign roles.

#### Partially Implemented 🟡
- [x] **Attendee Import**: CSV import support (missing XLSX format).
- [x] **Automated Bulk Communications**: Added scheduled bulk-send support with delayed queue dispatch and organizer scheduling UI.
- [x] **Usher API**: Check-in endpoints exist but no organizer UI for usher management.
- [x] **Analytics**: Live dashboard with periodic auto-refresh and KPI deltas is now available.

#### Missing 🔴
- [x] **Registration Form Builder**: Added organizer API and UI to configure per-link registration form fields.
- [ ] **Registration Page Designer**: No UI for organizers to design registration page branding/layout (template-based only).
- [x] **Bulk User Invitations**: Added organizer bulk CSV invite endpoint and settings UI with per-row results.
- [x] **Event Templates**: Organizer-scoped templates can be saved from draft values, listed, applied to create events, and deleted.
- [x] **Advanced Approval Rules**: Added per-link conditional rules (approve/pending/reject) evaluated from registrant response data.
- [x] **Registration Link Access Controls**: Enforced PUBLIC/PASSWORD_PROTECTED/INVITE_ONLY behavior in public resolve/schema/submit flows.
- [x] **Live Analytics Dashboard**: Added organizer live mode with auto-refresh and KPI delta tracking for real-time registration/check-in metrics.
- [x] **Attendee Communication History**: Added attendee-level communication history API and organizer UI timeline with status filters.
- [x] **Webhook Integrations**: Send registration events to external systems.
- [ ] **Mobile App for Organizers**: Mobile view for portable event management.
- [ ] **Usher Portal UI**: Organizer-facing usher team and device management.

---

### Phase 6: Production Readiness & Scale
- [ ] **Database Migration to MySQL/PostgreSQL**: Transition from SQLite to a production-grade relational database to handle higher concurrency and horizontal scaling.
- [ ] **Infrastructure Setup**: Configure Docker/Kubernetes for containerized deployment.
- [ ] **Static Asset Management**: Move uploads from local storage to S3 or similar cloud storage.
 
