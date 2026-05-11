1. Product Concept

EveMange is a multi-event, multi-organizer registration and attendance management platform. It supports public registrant-facing pages, organizer dashboards, badge design, QR code generation, attendee communication, onsite registration, and a mobile usher app for badge scanning.

The system is designed so that:

One platform → many organizers → many events → many registration links → many badge types → one live dashboard.

2. Main User Groups
User Group	Description
Super Admin	Platform owner managing all organizers, events, templates, users, system settings, and reports.
Organizer Admin	Organization/event owner who creates events, registration links, badges, and manages attendees.
Organizer Staff	Team members supporting registration, communication, data import, and onsite operations.
Usher / Scanner User	Mobile app user responsible for scanning badges and checking in attendees.
Registrant / Attendee	Public user registering for an event through category-specific registration links.
3. Core System Modules
3.1 Super Admin Portal

The Super Admin Portal manages the entire platform.

Features
Manage organizers
Create/edit/suspend organizer accounts
View all events across organizers
Manage subscription or licensing if needed
Manage global badge templates
Manage global registration page templates
Manage system users
Configure email/SMS settings
View platform-wide analytics
Audit system activity
Backup and restore data
3.2 Organizer Portal

The Organizer Portal is the main working dashboard for event owners.

Features
Create and manage events
Create multiple registration links per event
Design registration forms
Design registration pages
Design badges
Manage registrants
Approve/reject registrations
Import attendees from Excel/CSV
Generate badges and QR codes
Send confirmation emails/SMS
Send reminder messages
Assign ushers/scanner users
Monitor live check-ins
Export attendance reports
3.3 Registrant Portal

The Registrant Portal is the public-facing side of the system.

Features
Register through category-specific links
Upload photo if required
Receive confirmation message
Download badge
Receive QR code by email/SMS
Re-download badge using email or reference number
Update registration if organizer allows
View event information and instructions
3.4 Mobile Usher App

The mobile app is used at event entry points.

Features
Secure usher login
Event assignment
QR code scanning
Attendee verification
Photo display during verification
Check-in confirmation
Duplicate scan warning
Manual search by name, email, phone, or reference number
Offline scan capture
Sync when internet is restored
Scan history
Usher performance logs
4. Event Structure
4.1 Organizer

Each organizer can create and manage multiple events.

Example:

Organizer	Events
Weder Strategies	Construction Week, FinTech Forum, STRIDE Talk Series
DMG Events	Big 5 Ethiopia, Industry Expo
Ministry Partner	Policy Forum, Innovation Summit
4.2 Event

Each event contains:

Event name
Event description
Event date/time
Venue
Organizer
Event logo
Event banner
Event status
Registration start/end date
Check-in rules
Badge templates
Registration links
Attendee database
Reports
4.3 Multiple Registration Links per Event

A single event can have many registration links.

Example:

Link Type	Example URL
VIP	/register/event-name/vip
Exhibitor	/register/event-name/exhibitor
Sponsor	/register/event-name/sponsor
Media	/register/event-name/media
Speaker	/register/event-name/speaker
Participant	/register/event-name/participant
Staff	/register/event-name/staff

Each registration link can have its own:

Form fields
Badge design
Category color
Approval workflow
Registration limit
Confirmation message
Email template
Access rules
Visibility setting
Photo upload setting
5. Registration Link Design

Each registration link should be configurable independently.

5.1 Registration Link Settings
Setting	Description
Link Name	VIP, Media, Speaker, Exhibitor, etc.
Slug	Unique public URL path
Visibility	Public, private, invite-only, password-protected
Capacity Limit	Maximum number of registrants
Approval Rule	Auto-approved or requires organizer approval
Badge Template	Badge design assigned to this link
Email Template	Confirmation message assigned to this link
Photo Upload	Required, optional, or disabled
Open/Close Date	Registration availability period
Custom Fields	Fields shown only for this link
6. Registration Form Builder

Organizers should be able to create custom forms for each registration link.

6.1 Default Fields
Full name
Email address
Phone number
Organization/company
Designation/title
Country/city
Photo upload
Consent checkbox
6.2 Custom Field Types
Field Type	Example
Text	Full Name
Email	Email Address
Phone	Phone Number
Dropdown	Country, Category
Checkbox	Consent agreement
Radio Button	Meal preference
File Upload	ID, business license, company profile
Photo Upload	Badge photo
Long Text	Bio, special request
Date	Arrival date
Number	Number of booth staff
7. Registration Page Designer

Organizers should design the look of each registration page.

7.1 Customizable Elements
Event logo
Header/banner image
Background color
Button color
Font style
Event description
Sponsor logos
Registration instructions
Form layout
Confirmation message
Footer text
Privacy notice
Terms and conditions
7.2 Page Templates

The system should include pre-designed templates such as:

Conference template
Exhibition template
VIP invitation template
Media accreditation template
Speaker registration template
Workshop/training template
8. Badge Design Feature

The badge designer should allow organizers to create professional event badges.

8.1 Badge Designer Functions
Drag-and-drop layout editor
Upload event logo
Upload background image
Add sponsor logos
Add QR code placeholder
Add registrant photo placeholder
Add text placeholders
Add category label
Add access zone indicator
Select badge size
Select orientation
Preview badge using sample data
Save badge template
Duplicate badge template
Assign badge template to registration link
8.2 Dynamic Badge Fields

Badges should support:

Full name
Photo
Organization/company
Designation/title
Category
QR code
Registration ID
Event name
Event date
Access level
Booth number
Speaker session
Sponsor level
8.3 Badge Sizes
Badge Type	Size
Standard Event Badge	4 x 6 inches
Small Badge	3 x 4 inches
Landscape Badge	4 x 3 inches
Custom Badge	User-defined size
8.4 Badge Photo Upload

Photo upload can be configured per registration link:

Option	Description
Required	Registrant must upload photo before submitting
Optional	Registrant may upload photo
Disabled	No photo is collected

Photo requirements:

JPG/PNG support
Maximum file size limit
Crop/resize tool
Preview before upload
Organizer review option
Used automatically on badge
9. QR Code & Badge Generation
9.1 QR Code

Each registrant receives a unique QR code.

The QR code should contain:

Unique attendee ID
Event ID
Registration link/category ID
Secure verification token
9.2 Badge Generation

Badge generation should happen:

Immediately after successful registration
After organizer approval
After CSV import
After manual onsite registration
After badge design update, if regenerated

Badge output:

PDF badge
PNG badge preview
Printable format
Email attachment/link
10. Attendee Management

Organizers should manage all attendees from one dashboard.

10.1 Attendee Table

Fields:

Full name
Email
Phone
Organization
Designation
Category
Registration link
Badge status
Approval status
Check-in status
Photo status
Registration date
Last updated date
10.2 Attendee Actions
View profile
Edit details
Approve/reject
Upload/change photo
Generate badge
Resend badge
Mark checked-in manually
Cancel registration
Export record
Add internal notes
11. Onsite Registration

The system should support fast onsite registration for walk-in attendees.

11.1 Onsite Features
Quick registration form
Category selection
Optional photo capture/upload
Instant QR generation
Instant badge generation
Label printing
Full badge printing
Immediate dashboard update
Duplicate email/phone warning
12. Mobile Usher App Design
12.1 App Screens
Screen	Purpose
Login	Secure usher access
Event Selection	Shows assigned events
Scanner	QR code scanning
Verification Result	Shows attendee details and photo
Manual Search	Search attendee manually
Scan History	Shows previous scans
Sync Status	Shows offline/online sync
Settings	App preferences
12.2 Scan Result States
State	Meaning
Valid	Attendee exists and can enter
Already Checked In	Duplicate entry detected
Invalid QR	QR not recognized
Wrong Event	Badge belongs to another event
Not Approved	Registration pending/rejected
Access Denied	Attendee does not have access to this zone
Offline Saved	Scan stored locally for later sync
13. Access Control & Roles
13.1 Roles
Role	Access
Super Admin	Full platform access
Organizer Admin	Full access to own organization
Event Manager	Manage assigned events
Registration Officer	Manage attendees and onsite registration
Designer	Manage badge and page designs
Communication Officer	Send emails/SMS
Usher	Scan and check in attendees only
Viewer	Read-only dashboard access
14. Communication Module

The system should support automated and manual messages.

14.1 Message Types
Registration confirmation
Badge delivery
Approval confirmation
Rejection message
Reminder email/SMS
Event update
VIP instruction
Speaker instruction
Media accreditation notice
Thank-you message
14.2 Communication Channels
Email
SMS
WhatsApp integration, optional future feature
15. Dashboard & Analytics
15.1 Organizer Dashboard

Metrics:

Total registrations
Registrations by category
Registrations by link
Approved/pending/rejected registrations
Badges generated
Emails sent
Check-ins completed
No-show count
Live arrival rate
Attendance by time
15.2 Live Check-in Dashboard
Total checked in
Check-ins by category
Check-ins by entrance
Check-ins by usher
Duplicate scan attempts
Invalid scan attempts
Last scanned attendees
Real-time refresh
16. Import & Export
16.1 Import

The system should support:

CSV import
Excel import
Category mapping
Column mapping
Duplicate detection
Bulk QR generation
Bulk badge generation
Bulk email sending
16.2 Export

Export options:

Full registration list
Approved list
Pending list
Checked-in list
No-show list
Category report
Usher scan report
Communication report
17. Printing
17.1 Printing Options
Print full badge
Print label only
Batch badge printing
Reprint badge
Print onsite badge instantly
Support standard badge printers
Support label printers
17.2 Label Content
Full name
Designation
Company
Category
QR code, optional
18. Security & Data Protection
18.1 Security Features
Secure login
Role-based access
Organizer data isolation
Encrypted passwords
Secure QR token
Audit logs
File upload validation
Duplicate prevention
Data backup
Export permission control
18.2 Data Ownership

Each organizer should own its event data. The platform should allow:

Data export
Data deletion after event
Data ownership agreement support
Access logs
Consent capture from registrants
19. Suggested Database Entities
Entity	Purpose
Organizations	Stores organizer/company accounts
Users	Stores system users
Roles	Defines permissions
Events	Stores event information
Registration Links	Stores category-specific links
Form Fields	Stores custom registration fields
Registrants	Stores attendee profiles
Registrant Responses	Stores custom field answers
Photos	Stores uploaded badge photos
Badge Templates	Stores badge design templates
Registration Page Templates	Stores page design settings
QR Codes	Stores QR/token details
Check-ins	Stores attendance scans
Ushers	Stores scanner users
Communication Templates	Stores email/SMS templates
Communication Logs	Tracks sent messages
Imports	Tracks uploaded CSV/Excel imports
Audit Logs	Tracks system actions
20. Recommended Development Phases
Phase 1: Multi-Event Foundation
Organizer accounts
Event creation
Registration link creation
Registrant database linked to event and category
Phase 2: Registration & Badge Upgrade
Multiple registration links per event
Custom form builder
Photo upload
Badge template assignment
Automated badge generation
Phase 3: Organizer Design Tools
Badge designer
Registration page designer
Email template editor
Phase 4: Mobile Usher App
Login
QR scanner
Verification
Offline scan storage
Sync
Scan history
Phase 5: Advanced Dashboard & Reporting
Live dashboard
Export reports
Usher activity logs
Category analytics
Communication analytics
Phase 6: Platform Scaling
Multi-organizer isolation
Super admin portal
Subscription/licensing
Advanced security
Backup and audit controls
21. Final System Summary

The improved EveMange system should be a complete event registration platform that allows organizers to independently create events, generate multiple registration links, customize forms, design registration pages, design badges, collect photos, generate QR-based badges, communicate with attendees, manage onsite registration, and monitor attendance in real time. Ushers should use a dedicated mobile app to scan badges, verify attendees, prevent duplicate entry, and sync check-in data with the organizer dashboard.