import * as React from 'react';

export type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'error';

export type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
};

export declare function StatusBadge(props: StatusBadgeProps): React.ReactElement;
