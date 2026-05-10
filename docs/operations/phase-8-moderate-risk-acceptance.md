# Phase 8 Moderate Risk Acceptance Matrix

## Scope

This matrix records explicit acceptance and remediation intent for moderate findings from `artifacts/phase8/security-audit-raw-20260507-221339.json`.

## Summary

1. Critical findings: 0
2. High findings: 0
3. Moderate findings: 13
4. Acceptance review owner: Security lead
5. Review due date: 2026-05-22

## Acceptance Matrix

| Package | Severity | Exposure Context | Decision | Owner | Target Date | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| @expo/cli | Moderate | Mobile toolchain dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Address in planned Expo upgrade cycle |
| @expo/metro-config | Moderate | Mobile toolchain dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Coupled with Expo upgrade planning |
| expo | Moderate | Mobile runtime/toolchain | Accept temporarily | Mobile Engineering | 2026-05-22 | Track with SDK compatibility verification |
| @react-native-community/cli | Moderate | Mobile build dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Upgrade with React Native compatibility window |
| @react-native-community/cli-doctor | Moderate | Mobile build dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Transitive through React Native CLI stack |
| @react-native-community/cli-hermes | Moderate | Mobile build dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Transitive through React Native CLI stack |
| @react-native-community/cli-platform-android | Moderate | Android build dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Upgrade with React Native CLI stack |
| @react-native-community/cli-platform-apple | Moderate | iOS build dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Upgrade with React Native CLI stack |
| @react-native-community/cli-platform-ios | Moderate | iOS build dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Upgrade with React Native CLI stack |
| react-native | Moderate | Mobile runtime dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Requires coordinated SDK and app validation |
| fast-xml-parser | Moderate | Transitive mobile build dependency | Accept temporarily | Mobile Engineering | 2026-05-22 | Resolved via upstream React Native dependency updates |
| next | Moderate | Web framework dependency | Mitigate in next patch cycle | Web Engineering | 2026-05-22 | Evaluate safe upgrade path and regression test web UI |
| postcss | Moderate | Web build pipeline dependency | Mitigate in next patch cycle | Web Engineering | 2026-05-22 | Upgrade coordinated with Next.js patch strategy |

## Approval

1. Security lead signoff: pending (owner: Security representative)
2. Engineering manager signoff: pending (owner: Engineering manager)
3. Product acknowledgment: pending (owner: Product manager)
4. Decision date: target 2026-05-15

## Signature Block

1. Security lead
- Name: TBD (Security representative)
- Signature: pending
- Date: pending
2. Engineering manager
- Name: TBD (Engineering manager)
- Signature: pending
- Date: pending
3. Product manager
- Name: TBD (Product manager)
- Signature: pending
- Date: pending

## Decision Metadata

1. Decision: accept temporarily / partially mitigate / reject
2. Effective date: pending approval
3. Expiration/review date: 2026-05-22
4. Related launch identifier: phase8-hardening-rc1
